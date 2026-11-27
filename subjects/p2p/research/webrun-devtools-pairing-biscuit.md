# Prototype: pairing, proof of possession and Biscuit capabilities in an MV3 service worker

Part of statewalker/statewalker-root#430; design in
[webrun-devtools-capabilities.md](webrun-devtools-capabilities.md) §4–§5.

**Question.** Does the design (app key, link-code pairing, proof of possession, Biscuit token,
per-call authorizer, owner map, filtered events, revocation) work inside a real Chrome MV3 service
worker, and what does it cost? It was built with `@statewalker/webrun-biscuit` 0.2.3,
`@statewalker/httpeers-access` 0.1.5 and `@statewalker/httpeers-person` 0.1.0 from npm.

**Answer.** Yes. All 27 scripted checks pass, three runs in a row, in headless Chromium (build 1243)
loading the unpacked extension (`launchPersistentContext`, `channel: "chromium"`, new headless; no
xvfb needed). Two parts of the design needed correcting: how tabs become owned, and which checks run
at hello.

## What was built

The prototype was throwaway code in the session scratchpad and is not kept:

- **Broker service worker.** It:
  - holds the root key in `chrome.storage.local`;
  - records `port.sender`;
  - runs the link-code exchange, opens the approval popup and mints the token;
  - runs hello and challenge, the per-call authorizer, the owner map, event filtering and revocation.
- **Content script.** A JSON relay between a page `MessagePort` and a `chrome.runtime.Port`; no
  secret crosses `window`.
- **Approval window.** Opened with `chrome.windows.create({type: "popup"})`. It shows the sender
  origin, tab title, appId, the code, capability checkboxes, tab scope and expiry.
- **App page.**
  - Its key is a non-extractable WebCrypto Ed25519 key pair, stored in IndexedDB.
  - Its appId is `meshIdOf(publicKey)`, a `12D3KooW…` peerId.
  - Pairing uses `newNonce` / `commitment` / `linkCode`.
  - It signs challenges over the length-prefixed `"webrun-devtools/hello/v1"`, the nonce and the origin.
- **Playwright driver.**
  - Serves the app on two origins (`localhost` and `127.0.0.1`).
  - Clicks Allow.
  - Inspects the broker through `serviceWorkers()[0].evaluate`.

## Results

**Pairing.**
- The app and the popup showed the same code (e.g. `502 871`) in every run.
- The popup showed the origin from `port.sender.origin`.
- A capability the user unticked was missing from the minted token.

The broker accepts approval decisions only when `sender.origin === "chrome-extension://<id>"`.
`sender.id` alone is not enough: content scripts carry the extension id too.

**Proof of possession and authorization.** The broker derives the app's public key from the appId
(`publicKeyOf`), so no key is sent. WebCrypto Ed25519 sign and verify both work in the service worker.

| Case | Outcome |
|---|---|
| Granted `tabs.create`, `windows.create` | allowed |
| Unticked `tabs.remove`, never-requested `windows.remove` | denied |
| `tabs.update` on an owned tab | allowed |
| `tabs.update` on a tab the app didn't open, under `tab_scope("own")` | denied |
| `tabs.query` with 4 tabs open | only the 2 owned tabs returned |
| Victim's token, attacker's key, victim's appId | signature does not verify |
| Victim's token, attacker's own appId and key | `check if bound($k), connection_peer($k)` fails |
| Token and stolen key used from another origin | `check if origin($o), connection_origin($o)` fails |
| Attenuated `check if operation("tabs", "query")` | query allowed, create denied |
| Attenuation adding `right("tabs","remove"); tab_scope("any")` | ignored (the authorizer trusts only the authority block) |
| Revoke the authority block's revocation id | all 3 open ports close (2 of them attenuated); new hellos refused |
| `RevocationRegistry.revoke(appId)` | hello refused (`membership revoked`) |

**Event filtering.** Of 3 `tabs.onUpdated` `complete` events (1 on an owned tab, 2 on a tab the app
didn't open), only the owned one was delivered.

**Cost** (sandbox VM):

| Measure | Result |
|---|---|
| `authorize()`, full authorizer, 5-right token | 0.12–0.16 ms mean |
| `verifyAsync` | 0.22–0.41 ms |
| pure-JS `verify` | 0.9–1.7 ms |
| Whole hello | about 2.5 ms |
| Token size | 759 bytes, 1012 base64 characters (attenuated: 1191) |

**Bundling.** esbuild with `platform: browser` produces a 128 kB minified service worker:

| Part | Size |
|---|---|
| webrun-biscuit | 55 kB |
| @noble/curves | 41 kB |
| @noble/hashes | 13 kB |
| broker | 10 kB |

It has no `node:*` imports, no `eval` and no WASM, so the default MV3 CSP is enough.

## Token and authorizer that worked

Every value goes in as a `{param}`.

```datalog
// authority block
mesh({ext}); subject({app}); bound({app}); issued_at({iat}); expires_at({exp});
origin({origin}); tab_scope({scope}); right({ns}, {method});   // one right per grant
check if bound($k), connection_peer($k);
check if mesh($m), root_mesh($m);
check if origin($o), connection_origin($o);
check if time_ms($t), $t < {exp};
```

```datalog
// authorizer, per call
operation({ns}, {method});
target_tab({tab}); target_owned({owned}); target_origin({torigin}); target_none({none});
connection_peer({peer}); connection_origin({corigin}); time_ms({now}); root_mesh({mesh});
tab_ok(true) <- target_none(true);
tab_ok(true) <- tab_scope("any");
tab_ok(true) <- tab_scope("own"), target_owned(true);
allow if operation($n, $m), right($n, $m), tab_ok(true);
deny if true;
```

At hello the authorizer has only the connection facts and `allow if true`, and **only block 0's
failed checks count**. An attenuation's `check if operation(...)` would always fail there, because
no operation exists yet.

## Corrections to the design

1. **Tab ownership.** Owning every tab in an owned window leaks: a tab opened outside the app landed
   in the app's window and its browsing reached the app as events. `openerTabId` is unreliable as
   well: a `window.open` from a background tab reported the window's *active* tab as its opener.
   **Rule:** a tab is owned only if the app created it through the API, or if
   `webNavigation.onCreatedNavigationTarget`'s `sourceTabId` is owned. This needs the
   `webNavigation` permission.
2. **Predicate arity.** Biscuit predicates need at least one term, so write `tab_ok(true)`, not
   `tab_ok()`.
3. **Hello checks.** As described above, hello filters failed checks to block 0.

## Gaps upstream (candidate tickets)

- **webrun-biscuit** (moving to webrun-capabilities, statewalker-root#98):
  - no revocation-id helper;
  - `print` is not exported;
  - no exported parameterised-code builder.
- **httpeers-access:**
  - `mintToken` takes no extra authority facts (the broker mints with `Biscuit.build` itself, about
    20 lines);
  - no claims helper that returns `issued_at`, which `RevocationRegistry.check` needs;
  - `ruleSet`'s fixed fact vocabulary rejects the broker's predicates (`tab_scope`, `target_owned`,
    `right`) as dead; it accepts only role bundles (`right(..) <- role(..)`);
  - its `Datalog` template is private.
- **httpeers-person:** `lengthPrefixed` is not exported.

## Not covered

- **State is in memory.** Grants, the owner map and connections live in service-worker globals; only
  the root key and revoked ids are persisted. They should be persisted in `chrome.storage` and rebuilt
  when the service worker starts.
- **No restart test.** The open ports kept the service worker alive throughout, so a forced restart in
  mid-session is still to be tested.
- **The root secret is raw bytes in `chrome.storage.local`.** webrun-biscuit signs with raw keys, so
  it cannot use a non-extractable one.
