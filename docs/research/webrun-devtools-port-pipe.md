# Prototype: webrun-rpc over `chrome.runtime.Port`

Part of statewalker/statewalker-root#430; design in
[webrun-devtools-capabilities.md](webrun-devtools-capabilities.md) §3.

**Question.** Can webrun-rpc's port stack run from a page to an MV3 service worker? The path is two
hops:

- **page to content script:** a real `MessagePort`;
- **content script to service worker:** a `chrome.runtime.Port`, which carries JSON only, with no
  transferables.

The prototype tested request/response, event streams, streamed fetch and service-worker restarts
along that path, and compared it with the current webrun-ports path.

**Answer.** It works. All four scenarios pass in headless Chromium 158. The new path is 3–10 times
faster than the old one for bulk data. The prototype found one leak bug in webrun-rpc, below.

## What was built

The prototype was throwaway code in the session scratchpad and is not kept. It has five parts:

- **`chromePortPipe(port, { maxFrameBytes, maxMessageSize, name })`** is built on webrun-streams'
  `newMessagePipe`. It:
  - sends each frame as one base64 string (native `Uint8Array.toBase64`/`fromBase64`, present in
    Chromium 158);
  - ends the pipe on `onDisconnect`, with `chrome.runtime.lastError` as the reason when set;
  - ends the pipe when `postMessage` throws;
  - calls `port.disconnect()` on a local close.
- **`messagePortPipe(port)`** sends bytes over a real `MessagePort`, transferring the buffer of a copy.
  It adds an explicit `{type: "webrun-pipe-closed", reason}` control message, because a
  `MessagePort` gives no reliable close notice. It also adds `closeWith(reason)`, so a relay can pass
  the other side's reason on.
- **The content script** is a dumb byte relay between the two pipes, with their ends linked. It never
  decodes the multiplexer.
- **The service worker** runs one `overPipe(chromePortPipe(port).target, { codec: msgpackCodec, side:
  "responder", window: "auto" })` per Chrome port, and routes each new port by its meta:

  | Port meta `kind` | Served by |
  |---|---|
  | `methods` | `serveMethods` |
  | `events` | `listenBidi` |
  | `stream` | `serve(…, serveFetchOverDuplex(handler))` |

- **The page** runs one multiplexer as initiator, with `methodsClient`, `fetchOverDuplex`, and one
  `callBidi` per subscription.

Playwright needs `channel: "chromium"` to load an extension headless. Its default
chromium_headless_shell loads none, and `waitForEvent("serviceworker")` then times out. No xvfb was
needed.

## Results

**Request/response: passes.**
- Nested objects and UTF-8 text round-trip.
- An error arrives as `{name, message, code}`, with no stack.
- `port.sender` (url, origin, tabId, frameId, documentId) reaches the broker, which is the identity §4
  relies on.
- Sequential call latency: median 0.7–0.8 ms. 200 parallel calls take 33–49 ms.

**Event stream with a client `break`: passes.**
- Five ticks arrive. After `break`, the server generator's `finally` runs.
- Caveat: `callBidi` does not close the mux port it was given, so the client library has to close it
  in its own `finally`.

**Streamed fetch, 5 MiB, every byte checked: passes.**

| Measure | Time |
|---|---|
| Download generated in the service worker | 53–95 ms |
| Upload streamed in 64 KiB chunks, echoed back (`duplex: "half"` works on both sides) | 129–245 ms |
| Real CORS-free fetch from the service worker | 109–219 ms |
| The page fetching directly (baseline) | 29–56 ms |

Frame sizes from 64 KiB to 4 MiB change little; 256 KiB–1 MiB is a good default.

**Service worker stopped under load: passes.** The stop used CDP `ServiceWorker.stopAllWorkers`, with
three operations in flight: a pending call, an open event stream and a 200 MiB download.
- All three rejected within about 10 ms, with a chained reason: "page<->cs: peer closed: cs<->sw: the
  chrome.runtime.Port disconnected".
- Later calls on the dead connection fail at once.
- A new connect request wakes a fresh service worker in about 40 ms.

So the client library needs only to mark the connection dead when `pipe.signal` aborts, and reconnect
lazily on the next call. It must re-subscribe its event listeners, because the service worker's state
is gone.

**Natural idle termination: inconclusive.** Playwright's DevTools attachment keeps the service worker
alive. This needs a run without Playwright attached; from the port's side, the CDP stop exercises the
same `onDisconnect` path.

## Compared with the current webrun-ports path

Both paths use the same relay and the same base64 encoding, with a 5 MiB body:

| | New stack | webrun-ports + webrun-http |
|---|---|---|
| Download | 53–95 ms | 272–327 ms |
| Upload + echo | 129–245 ms | 1177–1469 ms |
| One call | 0.7–0.8 ms | 0.3–0.6 ms |

The old client buffers the whole body into one base64 chunk, and every chunk is an acknowledged
`callPort` with a 1 s default timeout. A single call costs a little more on the new stack because of
the mux envelope.

## Bug found: `throughAbort` leaks the producer when its consumer stops early

`webrun-rpc/src/through-abort.ts` forwards `return()` to the source only when its own abort signal
fires. When the consumer stops for another reason, the wrapper's `finally` runs but the source
generator stays suspended at `yield` for ever. One such reason is the per-chunk `callPort` inside
`send`/`ioHandle` rejecting on the port's close signal.

Consequence: when a page goes away (tab closed, mux closed) while a `listenBidi` subscription is
open, the server generator's `finally` never runs. In the extension, that `finally` is what removes
the Chrome event listener. This affects any long-lived `listenBidi` handler, on any transport.

- **Fix:** in the `finally`, if the source is not done and the signal did not abort, call
  `iter.return()`. Patched in the installed bundle, this cleaned up within 200 ms.
- **Workaround until it ships:** the broker ends each served generator on the port's close signal
  (`gen.return()` on `getPortCloseSignal(port)`).

A producer that the client stops pulling without `break` stalls through backpressure. That is
expected: a broker wrapping Chrome events must buffer or drop events itself.

## Recommendations

Add **`webrun-streams-chrome`** to webrun-wire, with:

| Export | What it does |
|---|---|
| `chromePortPipe(port, opts)` | base64 frames; disconnect becomes `closeSignal`. Works in content scripts, service workers and offscreen documents. |
| `messagePortPipe(port, opts)` | the close control message and `closeWith(reason)` |
| `relayPipes(a, b)` | the content script's two-way relay |
| `connectToExtension()`, `acceptExtensionConnections(onConnection)` (optional) | helpers; the second gives the broker a mux factory plus `port.sender` |

Recommended defaults: `msgpackCodec`, `window: "auto"`, and `maxMessageSize` 256 KiB–1 MiB.

Upstream fixes in webrun-wire:

1. Fix `throughAbort`, with a regression test: a port closing under a pending chunk send must run the
   producer's `finally`.
2. Have `callBidi` close its port, or document that the caller must.
3. Let `newMessagePipe`'s `target.close(reason?)` take a reason.
