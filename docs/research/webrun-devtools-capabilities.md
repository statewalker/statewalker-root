# webrun-devtools on webrun-wire and Biscuit capabilities, and as an HTTPeers peer

Ticket: statewalker/statewalker-root#430. Prototype findings for its open subjects are added below as they land (§10).

Analysis of `statewalker/webrun-devtools` (v0.1.7, extension manifest 0.1.5) against `webrun-wire`
(webrun-rpc, webrun-http-streams, webrun-http-proxy) and httpeers (`webrun-biscuit`,
`httpeers-access`, `-hub`, `-member`, `-person`, `-bridge`). Read-only analysis; nothing changed.

## 1. What the extension is today

Three parts, all plain JavaScript:

- **Content script** (`src/content/index.js`, injected into `<all_urls>`, all frames): answers a
  `connection-request` posted on `window` by handing the page a `MessagePort`, relayed to the
  background through `chrome.runtime.connect`.
- **Background service worker** (`src/background/index.js`): on `init` compares the page's API key
  with the one stored in IndexedDB, then exposes every method of `newExtensionApi()`:
  `windows.*`, `tabs.*`, `debugger.*` (raw CDP `sendCommand`), `custom.injectScript` (runs arbitrary
  code in the MAIN world of any tab) and `http.fetch` (a fetch from the extension origin, i.e.
  CORS-free, to any host, through `webrun-http` over `webrun-ports` with base64 chunks).
  Events (`on*`) are callbacks re-registered by listener id.
- **Popup** (`src/popup/index.js`): one global API key, made with `Math.random().toString(36)`.

What that implies for security:

| Problem | Consequence |
|---|---|
| One shared key, all or nothing | Any page that has the key gets the debugger on every tab, script injection into every origin and a CORS-free fetch. |
| The key travels through `window.postMessage(…, "*")` | Every script and frame on the page (ads, dependencies, extensions) sees it. |
| No idea who is calling | `port.sender` (origin, tab, frame, documentId, which Chrome supplies and the page cannot forge) is never read. |
| Events are not scoped | `tabs.onUpdated` etc. report every tab: browsing history leaks to the key holder. |
| `Math.random` key | Not a CSPRNG. |
| Old wire stack | `@statewalker/webrun-ports` / `webrun-http` with ad-hoc base64 framing. |

## 2. Target architecture

```
 page (app)                         content script            background SW (broker)           offscreen doc
 ─────────────                      ──────────────            ──────────────────────           ─────────────
 app key (Ed25519, non-extractable)                           grants DB, root key,             libp2p node(s):
 Biscuit token                       MessagePort ⇄             authorizer, resource owner map   hubs + members
 client lib  ── MessagePort ──────▶  chrome.runtime.Port ───▶  serveMethods / fetch / events ◀─▶ (runtime.Port)
                                     (JSON pipe adapter)        approval window (extension page)
```

- The **background service worker is the only place a call is authorized.** The client library is
  convenience only.
- The **approval UI** is an extension page opened with `chrome.windows.create({type: "popup"})`, or
  `chrome.action.openPopup()` where available. Only extension pages can show trusted UI.
- **Mesh networking lives in an offscreen document** (§6), because an MV3 service worker has no
  `RTCPeerConnection` and is suspended when idle.

## 3. Transport on webrun-wire

The old calls survive under the same names: `callPort`, `listenPort`, `ioSend` and `ioHandle` moved
into `@statewalker/webrun-rpc`. So the port can be gradual, but the target shape is:

| Hop | Mechanism |
|---|---|
| page ⇄ content script | One real `MessagePort` (transferred once, as now). Use the RPC tier directly (`callPort`/`serveMethods` with structured clone), or `overPipe(port, { codec: structuredCodec })` plus `connect`/`serve` for streams; `ArrayBuffer`s move without copies. |
| content script ⇄ service worker | `chrome.runtime.Port` is **JSON-only, no transferables**. This needs an adapter that **does not exist yet**: copy `webrun-streams-ws`'s `messageTargetOverWebSocket` built on `newMessagePipe`, base64 the frames in `send`/`deliver`, run `overPipe(target, { codec: msgpackCodec, side })`, and have `port.onDisconnect` end the pipe (it becomes `closeSignal`, failing pending calls). Small, generic, worth putting in webrun-wire as `webrun-streams-chrome` (also usable for extension ⇄ offscreen document). |
| Content script role | A dumb byte relay between the two. It never sees tokens in clear text in any meaningful way (they are bound, §4.3). |

Mapping of the API surface:

- **Methods** → `serveMethods(port, impl, { channelName: "devtools", methods: [...] })` /
  `methodsClient`. Methods are listed explicitly; unknown ones get `ENOSYS`. The broker wraps `impl`
  so each method first runs the authorizer (§5).
- **Events** → there is no function marshalling. Use `callBidi`/`listenBidi`: `api.tabs.onUpdated`
  becomes an async iterator (the client lib can keep the `addListener` shape on top). A client `break`
  cancels the channel and the server generator's `finally` removes the Chrome listener. This
  replaces the listener-id bookkeeping and `METHOD_RESET_CONNECTION`.
- **`http.fetch`** → `fetchOverDuplex(call, request)` on the page and
  `serveFetchOverDuplex(handler)` in the broker, with bodies streamed both ways. The handler
  authorizes, then uses `webrun-http-proxy`'s `urlUpstream({ base: origin, forwardCookies: false })`
  (one upstream per origin; hop-by-hop headers and cookies dropped).
- **Things to watch when porting:**
  - `callPort`'s default timeout is 1 s (the old one was 5 min).
  - `serveMethods` sends errors as `{name, message, code}` only, with no stack.
  - `injectScript`'s error positions must travel in the result, not in the error.

## 4. Apps, keys and pairing

### 4.1 App identity

- Each app generates an **Ed25519 key pair with WebCrypto** (`extractable: false`) and stores the
  `CryptoKey` in its IndexedDB.
- Its id is the libp2p-style peerId of the public key (`meshIdOf(publicKey)` in httpeers-access; no
  libp2p needed). Local apps and mesh peers then share one id format, and httpeers' token vocabulary
  (`subject`, `bound`) applies unchanged.
- An app never needs to mint or attenuate with this key. It only signs handshake challenges, so a
  non-extractable key is fine. (Contrast: httpeers `generateSigner` needs an extractable seed, but
  that is the issuer side, i.e. the extension.)

An **app record** in the broker is keyed by (appId, origin). The origin comes from `port.sender.origin`
and is part of the identity: the same key presented from another origin is a different, unapproved
app. This blocks a stolen key/token pair from being used from an attacker page.

### 4.2 Pairing with a displayed number

httpeers-person's **link code** (`link-code.ts`) is exactly this protocol and should be reused rather
than re-invented:

1. **App → broker:** `requestAccess({ appId, capabilities, name?, commitment })`, where
   `commitment = commitment(appNonce)`.
2. **Broker → app:** `{ requestId, extNonce }`. The broker records `sender.origin`, `sender.tab`,
   `sender.frameId` and `documentId`.
3. **App → broker:** reveals `appNonce`. The broker runs `checkReveal`.
4. **Both compute the number:**
   `code = linkCode({ mesh: "webrun-devtools", keeper: extId, mover: appId, keeperNonce: extNonce, moverNonce: appNonce })`,
   a 6-digit number. The app shows it in its own UI.
5. **The broker opens the approval window**, showing:
   - the **origin from `sender`** (never a URL the page supplies), the tab title and favicon;
   - the same number;
   - the requested capabilities grouped by risk (§5.3), each of which the user can untick;
   - an expiry (session, 1 day, 30 days, until revoked).

   It also focuses or highlights the requesting tab so the user can compare the two numbers.

Because the app commits before it learns `extNonce`, neither side can choose the number. A hostile
page therefore cannot show a number that matches another pending request. Requests time out after a
minute or two, and there is at most one pending request per tab.

On **Allow**, the broker:

- stores the grant;
- mints the token (§5.1);
- returns it over the same port.

On **Reject**, it returns an error and rate-limits further requests from that origin.

### 4.3 Using the token (proof of possession)

Every connection begins with `hello({ appId, token })`, followed by a challenge:

1. The broker sends a nonce.
2. The app signs `"webrun-devtools/hello/v1" ‖ nonce ‖ sender.origin`.
3. The broker verifies the signature and sets `connection_peer = appId` and
   `connection_origin = sender.origin` for the life of the port.

The token is **bound** (`check if bound($k), connection_peer($k)`), so a leaked token is useless
without the app's private key. This replaces the API key that is visible on `window`.

## 5. Capabilities as Biscuit tokens

### 5.1 Token

The token is minted with `Biscuit.build(extRootSecret, code, { params })`. All values go in as
`{params}`: no string concatenation, no Datalog injection. It reuses httpeers' authority facts so the
same verifier helpers apply:

```datalog
mesh({ext});            subject({app}); bound({app}); issued_at({iat}); expires_at({exp});
origin({origin});
// grants (one fact per approved capability, parameterised where it has a scope)
right("windows", "create"); right("windows", "remove"); right("tabs", "captureVisibleTab");
tab_scope("own");                                   // own | origin:<pattern> | any
cdp_domain("Page"); cdp_domain("DOM"); cdp_domain("Input");
http_host("api.example.com"); http_method("GET");
check if bound($k), connection_peer($k);
check if origin($o), connection_origin($o);
check if time_ms($t), $t < {exp};
```

Instead of listing rights, a grant may name **bundles**, defined once in the broker's rule set with
`httpeers-access`'s `ruleSet`, which validates them:

```datalog
right("tabs","query") <- role("tabs.read");
right("tabs","captureVisibleTab") <- role("tabs.read");
```

Small tokens, readable approval screens.

### 5.2 Authorizer, per call

The broker asserts facts that only it knows, then fixed policies:

```datalog
operation("tabs", "captureVisibleTab");      // or: cdp_call("Runtime", "evaluate")
target_tab({tabId}); target_owned(true|false); target_url({url}); target_origin({o});
request_host({host}); request_method({m}); request_credentials(false);
connection_peer({app}); connection_origin({origin}); time_ms({now}); root_mesh({ext});

allow if operation($n, $m), right($n, $m), tab_ok();
allow if cdp_call($d, $m), cdp_domain($d), right("debugger", "sendCommand"), tab_ok(), !cdp_denied($d, $m);
allow if operation("http", "fetch"), request_host($h), http_host($h), request_method($m), http_method($m);
tab_ok() <- tab_scope("any");
tab_ok() <- tab_scope("own"), target_owned(true);
tab_ok() <- tab_scope($p), target_origin($o), $o.matches($p) ...   // origin-pattern form
deny if true;
```

Supporting rules:

- **Ownership:**
  - The broker keeps an owner map: windows and tabs an app created, plus tabs whose `openerTabId`
    is owned. That feeds `target_owned`.
  - On `done`, or when the app's last port disconnects, owned resources can optionally be closed.
- **Event streams** are filtered through the same authorizer *per event*: `tabs.onUpdated` delivers
  only tabs that pass `tab_ok()`. This closes the history leak.
- **Revocation:**
  - `VerifiedBiscuit.revocationIds` against a revoked-ids set in the broker (webrun-biscuit has no
    helper for this; a few lines in the broker).
  - Plus `RevocationRegistry`-style "everything issued before t for this subject" for "forget this
    app".
  - Revoking closes the app's open ports.
- **Delegation for free:**
  - An app can `attenuate()` its token for an iframe, worker or notebook cell, e.g.
    `check if operation("tabs", "captureVisibleTab")`.
  - The holder of the attenuated token still has to prove the app key, though. So delegation to code
    that should not hold the key means the app proxies the calls, or the broker supports a
    third-party-block sub-key (`thirdPartyBlock` exists, but it is not wire-compatible with other
    Biscuit implementations; fine here).

### 5.3 Capability catalogue and risk levels

| Namespace | Capabilities | Risk |
|---|---|---|
| `windows`, `tabs` | read (`get`, `query`, events) / control (`create`, `update`, `remove`, `move`, zoom) / `captureVisibleTab` | low → medium; scope via `tab_scope` |
| `debugger` | `attach`/`detach`/`getTargets` + `cdp_domain(d)`; optional `cdp_method(d, m)` for fine grain | high for `Runtime`, `Network` (cookies, bodies), `Storage`, `Fetch`, `Input`, `Page.navigate` on non-owned tabs; `cdp_denied` keeps `Browser.*` / `Target.*`-escapes out unless explicitly granted |
| `custom.injectScript` | `script_origin(pattern)` | critical: code in the page's MAIN world = that origin's session |
| `http.fetch` | `http_host(host or *.suffix)`, `http_method`, `http_credentials(host)` | medium, high with credentials; private/loopback ranges denied unless `http_private(true)` |
| `mesh` | §6 | per mesh |

The approval screen labels critical items in red, and expiry for those is capped (for example, at
most one day).

## 6. The extension as an HTTPeers peer

### 6.1 Feasibility

| Piece | Where it runs | Notes |
|---|---|---|
| webrun-biscuit, httpeers-access, httpeers-hub logic, httpeers-person | Service worker or offscreen | Pure TS / WebCrypto, no DOM. |
| libp2p node (`createBrowserNode`: websockets + WebRTC + circuit relay) | **Offscreen document** (`chrome.offscreen.createDocument`, reason `WEB_RTC`) | The service worker lacks WebRTC and is suspended when idle. |
| ServiceWorker edge (`mountEdge`) | Not applicable | It needs a same-origin page. The broker uses `member.fetch` / `createGateway` directly, behind its own message routing. |
| Keys | Extension IndexedDB | One Ed25519 key per hub (= the mesh id). A member key per membership, or one device key shared. Hub signers must be extractable seeds (Biscuit signs from raw bytes). |

Broker ⇄ offscreen uses the same `chrome.runtime.Port` pipe adapter as §3.

- **Several hubs** in one runtime: `createHub` keeps no globals. Each hub needs its own key, its own
  storage (pass a distinct `idbStorage` db name; the default name is fixed) and its own libp2p
  node/`servePeer`.
- **Several memberships**: one `startMember` per mesh, each with its own node and `key`. Nothing global
  forbids it, but it is not exercised anywhere in httpeers. The browser `session` layer assumes one
  mesh per origin, so use `startMember` with a custom `MemberPlatform`, not `createSession`.

UI (options page):

- list of meshes;
- **create mesh**: generate a key, `createHub`, invite links/QR through `httpeers-qr`;
- **join mesh**: paste or scan a join blob, then `startMember`;
- per-mesh roles and a member list (revoke).

### 6.2 Three ways apps and meshes relate

**A. Local app reaches a mesh through the extension (extension as broker).**

- The grant carries `mesh_fetch({mesh}, {peer or "*"}, {pathPrefix})`. The app calls
  `api.mesh.fetch(meshId, "/<peerId>/path")`, which is `fetchOverDuplex` to the broker. The broker
  authorizes and dispatches through that mesh's member or hub (`createGateway` semantics) with the
  extension's own membership token.
- The app **never sees the mesh token**, and the target peer's Datalog still has the final say. This
  is security-model §6 ("isolated + broker"): the narrower `mesh_fetch` scope is exactly what the
  session shell's `/peers/` lacks today.

**B. Mesh membership grants local capabilities.** This is "access = capabilities for an app
participating in a mesh".

- The broker's rule set maps mesh roles to extension rights:
  ```datalog
  right("tabs","captureVisibleTab") <- app_mesh_role({meshX}, "screenshots");
  right("debugger","sendCommand"), cdp_domain("Page") <- app_mesh_role({meshX}, "automation");
  ```
- Two ways an app gets `app_mesh_role`:
  - **The extension is that mesh's hub.** Pairing then *is* joining. The approval screen offers
    "add this app to mesh X with roles R", the broker calls `hub.members.add(appId, R)`, and the app's
    token is the hub's membership token plus the local facts of §5.1. One token, one revocation path
    (`hub.revocations`), and the same roles are honoured by every other peer in mesh X.
  - **Another hub issued the app's membership.** The app presents its httpeers membership token on
    `hello`. The broker checks it with `verifyToken(token, { issuer: meshX, connectionPeer: appId })`
    (the PoP of §4.3 proves `connection_peer`). Then it asserts `app_mesh_role(meshX, r)` for each
    claimed role, subject to a user-approved trust entry "trust mesh X's roles", because an outside
    hub must not grant browser control silently.

**C. Remote mesh peers automate this browser.**

- The broker mounts the devtools API as HTTP under `/devtools/` on the extension's node for a chosen
  mesh: REST per method, or `webrun-rpc-http`'s `newRpcServer`, with events as SSE via
  `webrun-http-events`.
- It is guarded by `withAccess({ issuer: meshX, rules })`, with `operation`/`resource` mapped to the
  same rights:
  ```datalog
  capability("devtools:tabs.read") <- role("observer");
  allow if capability("devtools:tabs.read"), operation("GET"), resource($r), $r.starts_with("/devtools/tabs/");
  ```
- Off by default, enabled per mesh, with an **Ask** mode: the call suspends until the user confirms in
  the extension UI. This is the Allow/Ask/Block model of statewalker-root#268.

**Recommended unification.** Treat local apps as members of an implicit **"local" mesh** whose hub is
the extension itself (key = extension root key). Pairing = invitation + approval, the app token = a
membership token with extra facts, and the authorizer = `ruleSet` rules. Then cases A, B and C are
all "a subject with roles in mesh M", with one policy language and one revocation mechanism, whether
the caller arrived over a MessagePort or over libp2p.

The only difference is how `connection_peer` is proven:

- **MessagePort:** the handshake signature plus `sender.origin`.
- **libp2p:** Noise.

`httpeers-bridge`'s `PeerLink` is the seam where a MessagePort-backed link with a *proven* peer (after
§4.3) could plug in. Its `./ports` variant only *asserts* identity, so it is not suitable as is.

## 7. Gaps found (candidate tickets)

| Where | Gap |
|---|---|
| webrun-wire | No `chrome.runtime.Port` pipe adapter (JSON, base64 frames, disconnect → closeSignal). |
| webrun-biscuit (moving to `webrun-capabilities`, statewalker-root#98) | No revocation-id helper; third-party blocks not wire-compatible (acceptable here). |
| httpeers-access | `mintToken` writes only roles/audience. It needs extra authority facts (origin, scopes) or a documented way to append them; `generateSigner` needs extractable keys. |
| httpeers-hub | `idbStorage` db name/snapshot key fixed per origin (several hubs per runtime need distinct names; check). |
| httpeers-member | Several `startMember` in one runtime untested; `createSession` is one-mesh-per-origin; libp2p in an extension offscreen document untested. |
| httpeers-bridge | No `PeerLink` over a MessagePort with proven (signature-based) identity. |
| webrun-devtools | Whole rewrite of background/client/popup (TS per ecosystem norms); protocol version bump (0.1 → 0.2), keeping `api.windows.create(...)` call shapes; legacy API-key mode removed or behind a developer toggle. |

## 8. Suggested order

Lower layers first:

1. **webrun-wire:** chrome Port pipe adapter.
2. **webrun-capabilities** (after #98): revocation helper.
3. **devtools:** port to webrun-rpc / http-streams with the current API key still in place
   (behaviour unchanged).
4. **devtools:** app keys, link-code pairing, approval window, Biscuit tokens, authorizer, owner map,
   filtered events. **This step removes the shared key.**
5. **httpeers:** `mintToken` extra facts, multi-hub storage names, multi-member test.
6. **devtools:** offscreen libp2p; create or join meshes; case A (`mesh.fetch`).
7. **devtools:** cases B and C, and the "local mesh" unification; the Ask mode.

## 9. Open questions for the human

- Should a grant be origin-bound only, or also allow `file://` / `null` origins (local HTML
  examples)? Opaque origins cannot be identified, so they would need a per-session-only grant.
- Should apps be able to request access silently once paired (refresh the token without UI), and for
  how long?
- In case B with an *external* hub: is "trust mesh X's roles" a per-mesh user decision, or never?
- Case C (remote automation of the user's browser): in scope at all, or mesh access only outward (A, B)?

## 10. Prototypes

One prototype per open subject of statewalker/statewalker-root#430. Each one's findings get their
own note, linked here when it lands:

| Subject | Note |
|---|---|
| `chrome.runtime.Port` pipe adapter for webrun-rpc | pending |
| Pairing, proof of possession, Biscuit mint and authorize in an MV3 service worker | pending |
| httpeers hub and member in an extension offscreen document | pending |
| Several hubs and memberships in one runtime; app ⇄ mesh cases A, B, C | pending |
| Local debugging and CI testing of extensions; Obscura | pending |
