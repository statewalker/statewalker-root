# Prototype: httpeers hub and member inside the extension

Part of statewalker/statewalker-root#430; design in
[webrun-devtools-capabilities.md](webrun-devtools-capabilities.md) §6.1.

## Question

Can webrun-devtools host an httpeers hub and members? If so, where:

- the service worker,
- an offscreen document, or
- a managed tab, either an extension page or a web page?

## Answer

Yes. **The offscreen document is the right host.** It ran the hub assembly from httpeers'
`apps/demos/src/shared/hub-runtime.ts`, using the published packages (member 0.7.0, hub 0.1.6,
libp2p 0.7.0, access 0.1.5) and a local relay.

| Context | Result |
|---|---|
| Service worker | Works in relay mode only: it has no `RTCPeerConnection`. |
| Managed tab | Works while it holds a WebRTC connection. Use it only for what an offscreen document cannot do, such as File System Access pickers. |

## What was built

The prototype was throwaway code in the session scratchpad and is not kept. It had six parts:

- **Hub core.** `createBrowserNode`, `dialRelay`, the circuit reservation, `superviseRelay`,
  `createHub` with `idbStorage(<name>)`, and `servePeer` with `withAccess`. It left out `mountEdge`,
  added a `/devtools/ping` mount, and kept one Ed25519 key per hub in extension IndexedDB.
- **Extension.**
  - The service worker is the broker. It keeps the managed tabs alive by reopening one on
    `onRemoved` and reloading one when it is discarded.
  - The offscreen document runs the hub.
  - An extension page, `mesh.html`, is managed-tab variant (b).
  - A content script carries the app channel for variant (a).
  - CSP is `script-src 'self'`.
- **Second participant.** A Node member using `startMember` with the Node platform, plus non-member
  checks.
- **Variant (a).** httpeers' demo hub page, source unchanged, served from a local web origin.
- **Relay.** A local relay copied from httpeers `apps/relay`.
- **Drivers.**
  - Playwright for function tests.
  - **Raw CDP attached only to a control page** for the lifetime and throttling tests: Playwright
    keeps every page "visible" and every service worker awake.

## Results

### Offscreen document hosts the hub

**Offscreen reasons.** Every `chrome.offscreen.Reason` was accepted, except `TESTING`, which needs a
command-line switch. Chrome does not check that the reason matches what the document does.

- `WEB_RTC` is the honest justification.
- Avoid `AUDIO_PLAYBACK`: Chrome documents that it closes the document after 30 s of silence.

The document has `RTCPeerConnection`. Of the `chrome.*` APIs it has only `runtime`, not `storage`.

**Hub and member.**
- The hub was ready in about 340 ms, with a relay reservation and a `/p2p-circuit/webrtc` address.
- A Node member joined by invitation in about 390 ms, over a **direct WebRTC** link.
  `/devtools/ping` returned 200 in 5–27 ms.

**Access control.**
- A join with no invitation failed with `not-a-member`.
- A raw call with no token got 401 `membership token required`, over WebRTC and over the relay alike.

**Rules.** They must grant `std:presence.write` and `std:mesh.read`. Without them the member never
shows as online, and nothing reports a refusal.

### Hub inside the service worker

The worker has `WebSocket`, IndexedDB and `crypto.subtle`, but no `RTCPeerConnection`, `Worker` or
`document`. The hub still starts and reserves on the relay. What happens to a member:

- Its WebRTC upgrade times out after about 6 s, and it falls back to the relay.
- With `serveOnLimitedConnection: false`, the default in `hub-runtime.ts`, the join then dies
  (`PeerStreamResetError`).
- With `serveOnLimitedConnection: true` it works, but every byte crosses the relay (1 GiB / 6 h limit
  per connection), and no member can reserve on the hub.

Over 90 s of idle, the libp2p liveness traffic on the WebSocket kept the worker alive. Longer runs and
a network drop were not tested.

### Service worker idle while the offscreen document holds connections

Without a debugger attached, Chrome stopped the worker 30 s after its last event.

- The offscreen hub kept serving. A member joined and pinged while the worker was down.
- The offscreen document's `chrome.runtime.sendMessage` restarted the worker.
- Its long-lived Port was cut by the stop.

So broker ⇄ offscreen messaging should follow these rules:

1. **The worker is stateless.** State lives in the offscreen document, IndexedDB or
   `chrome.storage.session`.
2. **Requests go both ways by `sendMessage`.** Each side sends a message with a reply; an offscreen
   message wakes the worker.
3. **Ports are reopened lazily.** Reopening a Port on every disconnect keeps the worker alive for ever.

The extension's own service worker receives `fetch` events from the offscreen document and from
extension pages (`fetch('/peers/...')` returned 200 from its handler). It can therefore be the
**edge** for extension pages, forwarding to the offscreen document's `member.fetch`.

### Bundles

esbuild, IIFE, browser conditions. The bundles contain no `eval`, no `new Function` and no dynamic
`import()`, and they load under `script-src 'self'`.

| Bundle | Minified | gzip |
|---|---|---|
| Offscreen hub | 837 KB | 248 KB |
| Extension page with `mountEdge` | 925 KB | 276 KB |
| Demo web hub page | 957 KB | 291 KB |

**Bundling problem.** `@statewalker/httpeers-member/browser` re-exports `mountEdge`, so
`@statewalker/webrun-http-browser` must be installed even by code that never mounts an edge.

### Managed page (tab)

Test tabs were pinned, inactive and set `autoDiscardable: false`, and were `hidden`. Neither
`chrome.windows.create({state: "minimized"})` (it stayed `visible` under xvfb and headless) nor
folder selection could be verified here.

**13-minute endurance run.** Three hubs ran at once (offscreen, extension tab, web tab), each with a
member pinging every 30 s.

- All 26 pings returned 200 over direct WebRTC, for each hub, and every member stayed online
  (15 s presence TTL).
- The offscreen document's timers ran normally.
- The hidden tabs' 1 s timers fired 54–60 times a minute.

**Control run, hidden tabs:**

| Tab holds | Timers from minute 3 |
|---|---|
| nothing | one wake-up per minute (intensive throttling) |
| an open WebSocket | one wake-up per minute: a WebSocket does **not** exempt the tab |
| an RTCDataChannel | normal |

**So a hub tab stays healthy only while it holds a WebRTC connection.** A hub with no member connected
(relay WebSocket only) drops to one wake-up a minute.

**Discard.** `chrome.tabs.discard`, which is what Memory Saver does, works even with
`autoDiscardable: false`; that flag only stops automatic discards. The worker saw `discarded` and
reloaded the tab, and the hub came back with the same peer id (its key is in IndexedDB).

**Closing.** `tabs.onRemoved` fired when the tab was closed, and the worker reopened it with the same
key and member list. The worker must keep its tab list in `chrome.storage.session`, because a stopped
worker loses its memory.

**(a) Web-origin page.**
- Its ServiceWorker edge installs and controls the page.
- But the demo hub's calls to itself through the edge return 401 "token subject does not match
  connected peer". This looks like a demo defect: `selfToken` against an anonymous proven peer.
- A content script's `fetch` bypasses the page's ServiceWorker.
- The app channel (Port to the worker, a MessagePort posted to the page) works.

**(b) Extension page (`chrome-extension://<id>/mesh.html`).**
- `navigator.serviceWorker.register` fails (`NotSupportedError`): an extension cannot register a
  second ServiceWorker. The extension's own worker plays that role instead.
- `showDirectoryPicker` exists but needs a user gesture. Playwright cannot complete a directory picker,
  so picking a folder and keeping its permission remain a manual test.

## Comparison

| | Offscreen document | Extension-page tab | Web-page tab |
|---|---|---|---|
| WebRTC, direct hub link | yes | yes | yes |
| Timers over 13 min | normal (never hidden) | fine while WebRTC is open; 1/min without | same |
| Survives the worker stopping | yes | yes | yes |
| User can close it | no | yes; reopened on `onRemoved` | yes; reopened |
| Discard / Memory Saver | not a tab | possible; reloaded | possible; same peer id after reload |
| ServiceWorker edge | the extension's worker sees its fetches | `register` refused; the extension's worker sees its fetches | works (self-call 401 is a demo bug) |
| File System Access picker | no (needs a gesture and a visible page) | yes with a gesture; persistence untested | yes, per-origin prompts |
| Code | `hub-runtime.ts` minus the edge | same | demo page as is; the extension trusts whatever that origin serves |

## Recommendations

1. **Host hubs and members in one offscreen document** (reason `WEB_RTC`), with one libp2p node per
   mesh. The service worker stays a stateless broker. Extension pages use the extension's own worker
   as their edge; web apps use the content-script app channel.
2. **Use a managed tab only for what the offscreen document lacks:** File System Access pickers and
   anything else that needs a gesture. Prefer an **extension page**: its code ships with the extension,
   and a web origin could change the code that holds the hub keys. The tab must be watched and
   reopened, and a hub there must keep a WebRTC connection or live with one-per-minute timers.
3. **httpeers changes:**
   - an `extensionPlatform()` `MemberPlatform`: no `mountEdge`, wake-up driven by broker messages;
   - move `mountEdge` out of `httpeers-member/browser`, or make `webrun-http-browser` an optional
     import;
   - hub assembly with a configurable `idbStorage` name and no edge;
   - document a relay-only hub mode (`serveOnLimitedConnection: true`);
   - fix the demo hub's self-call 401 through its own edge;
   - test several hubs and members in one document.
