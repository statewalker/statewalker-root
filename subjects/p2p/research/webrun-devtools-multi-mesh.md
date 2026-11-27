# Prototype: several meshes in one runtime, and the app ⇄ mesh cases

Part of statewalker/statewalker-root#430; design in
[webrun-devtools-capabilities.md](webrun-devtools-capabilities.md) §6.1–§6.2.

## Question

Can one runtime P:

- (a) host two hubs,
- (b) be a member of two meshes hosted elsewhere,
- (c) do both at once,

and implement the app-to-mesh cases A, B and C?

## Answer

Yes, with real libp2p nodes and a local relay, in Node. The prototype ran 16 tests, twice on both
exchange paths (mux-per-peer and per-exchange).

Three rules came out of it:

- every hub and every membership needs **its own libp2p node**;
- `ruleSet` cannot express the design's `app_mesh_role` rule as written;
- tokens can carry extra authority *facts*, but not *checks*, if they are to stay valid mesh tokens.

## What was built

The prototype was throwaway code: Vitest tests inside a scratch copy of httpeers'
`httpeers-conformance`, not kept. One process ran 15 nodes:

- a relay;
- P's hubs H1 and H2, with distinct keys and storages, both serving `/devtools`;
- outside hubs H3 and H4, and P's memberships of those two meshes, M3 and M4;
- remote peers Y3 (in M3) and Y4 (in M4);
- members of H1 and H2 with and without an `observer` role.

## Results

### Several hubs and memberships

- **All at once works.** Each hub admits only its own members, and each membership presents its own
  mesh's token. Y3 → P's M3 membership and Y4 → P's M4 membership both return 200, and the handler
  sees the right `mesh`. A call from P's M3 membership to a peer of M4 is unreachable (502).
- **One node per hub is required.** A hub's mesh id is its node's peerId (`signerOf(key)`), so two
  hubs on one node would be one mesh.
- **One shared node for two memberships fails.**
  - The second `startMember` throws `DuplicateProtocolHandlerError` on `/httpeers/1.0.0/ports`.
  - Its cleanup then stops the shared node (`start-member.ts:243`), which breaks the first membership
    too.
- **One shared key on two nodes works.** Same peerId, both direct, both reachable.
  - It links the two memberships publicly, so it is sane only per device.
  - The relay-mode fallback with a shared peerId was not tested.
- **Hubs on a shared storage collide.**
  - `createHub` always writes the snapshot key `"snapshot"` (`create-hub.ts:115`), so a hub built on a
    shared `memoryStorage` inherits the other hub's members.
  - Use a distinct `idbStorage(name)` per hub, or a key-prefixing wrapper.
- **`RevocationCache` is keyed by subject only** (`revocation.ts:222`). That is fine per membership,
  but a broker that checks tokens from several meshes needs one cache or registry per mesh. Otherwise
  a subject revoked in one mesh is refused in all of them.
- **Relay limit.** Eight nodes dialling one relay at once from one host: 5 succeed, 3 fail with
  `EncryptionFailedError` (libp2p's default inbound threshold of 5 per host; the relay app does not
  configure it). An extension starting many nodes must stagger them; 300 ms worked.

### Case B: mesh roles grant local rights

**Identity and token.**
- The app has a non-extractable WebCrypto Ed25519 key, with `appId = meshIdOf(publicKey)`. It proves
  possession by signing a nonce.
- H1 adds it with `members.add(appId, ["screenshots"])` and mints with `mintToken`.
- `verifyToken(token, { issuer: H1, connectionPeer: appId })` returns the claims.
  - The same token over another identity fails with `peer-binding`.
  - An H2 token checked against issuer H1 fails with `signature`.

**The rule.** The design's rule `right(...) <- app_mesh_role(...)` is refused by `ruleSet`, which only
knows its fixed fact vocabulary (`rules.ts:87`, `:95`, `:211`). The form that works, with one line per
trusted mesh:

```datalog
capability("tabs.captureVisibleTab") <- mesh("<H1>"), role("screenshots");
capability("debugger.Page")          <- mesh("<H1>"), role("automation");
allow if capability($c), operation($c);
```

Through `authorize(rules, { operation, resource, connectionPeer }, claims)`:
- capture is allowed;
- `debugger.Page` is refused;
- the same role from H2, which is not trusted, is refused.

`ruleSet` takes no `{params}`, so the mesh id is spliced into the rule text.

**Revocation.** `H1.hub.revocations.revoke(app)` refuses the app on its next check. Because P hosts H1,
there is one revocation path.

**Extra authority facts.**
- `mintToken` cannot add them (`tokens.ts:297`).
- A token built with `Biscuit.build` that copies `mintToken`'s authority block and adds the facts
  `origin(...)` and `tab_scope(...)` still passes `verifyToken`, so every mesh peer accepts it. The
  extra facts are not in `MeshClaims`, so the broker re-verifies the token and authorizes on its own.
- An authority **check** that needs a fact only the broker asserts, such as
  `check if origin($o), connection_origin($o)`, makes `verifyToken` fail (`unsatisfied-constraint`).
  So a token meant to be valid in a mesh may carry such conditions only as facts, with the broker's
  authorizer enforcing them, for example:

  ```datalog
  allow if operation($o), right($o), origin($org), connection_origin($org), tab_ok(true);
  ```

  A block appended to the token cannot change this, because the broker reads the authority block
  only.

### Case A: an app calls a mesh through the extension

The broker checks the grant locally (webrun-biscuit `evaluate` with no token), then dispatches through
`createGateway({ source: <P's membership of M3> })`. The grant:

```datalog
allow if request_mesh($m), request_peer($p), request_path($r), mesh_fetch($m, $p, $pre), $r.starts_with($pre);
allow if request_mesh($m), request_path($r), mesh_fetch($m, "*", $pre), $r.starts_with($pre);
deny if true;
```

| Request | Result |
|---|---|
| `/hello` (granted) | 200; Y3 sees P's membership as the caller, not the app |
| `/other` (outside the grant) | 403, refused locally |
| An M4 call with no grant | 403, refused locally |
| `/secret` (granted locally) | 403 from Y3: the target's own policy still decides |

Y3's handler logged only `/hello`.

**Finding:** a token the app supplies itself passes through. `createGateway` strips only the peer
binding (`gateway.ts:87`), and the edge keeps a caller's `x-httpeers-token`
(`edge-dispatch.ts:265`). The broker must delete that header before dispatching.

### Case C: remote peers call the extension

One `/devtools` handler is mounted on H1 and on H2 (`extraMounts`, guarded by `withAccess`). The
rules:

```datalog
capability("mesh:any") <- role("member");
capability("devtools:tabs.read") <- role("observer");
allow if capability("devtools:tabs.read"), operation("GET"), resource($r), $r.starts_with("/devtools/tabs/");
allow if capability("mesh:any"), resource($r), !$r.starts_with("/devtools/");
```

| Caller | Request | Result |
|---|---|---|
| H1 observer | `GET /devtools/tabs/list` | 200 |
| H1 observer | `POST /devtools/tabs/list` | 403 |
| H1 member only | `GET /devtools/tabs/list` | 403 |
| H2 member only | `GET /devtools/tabs/list` on H2 | 403 |
| H2 observer | `GET /devtools/tabs/list` on H2 | 200 |
| H2 observer | `GET /devtools/tabs/list` on H1 | unreachable (502): H1 refuses the connection before any token is read |

## Gaps in httpeers and proposed changes

| Gap | Proposal |
|---|---|
| `startMember` owns its node, takes no `protocol`, and stops a shared node on a failed start (`start-member.ts:241–257`) | Accept a borrowed node (`ownsNode: false`), forward `protocol`, document one node per mesh |
| `mintToken` takes no extra facts; `verifyToken` returns fixed claims (`tokens.ts:297`, `:566`) | `facts` option (facts only, as params); `verifyToken` returns `extra` read from the authority block |
| `ruleSet` has a closed vocabulary and no params; `authorize`'s request facts are fixed; `Datalog`/`evaluate` helpers are private (`rules.ts`, `biscuit.ts`) | Declare an application vocabulary and params in `ruleSet`; pass extra facts to `authorize`; or export the helpers |
| Fixed snapshot key per storage (`create-hub.ts:115`) | `namespace` option |
| `RevocationCache` keyed by subject only (`revocation.ts:222`) | Per-mesh checkers for brokers |
| `createGateway` forwards a caller-supplied mesh token | Strip it by default |
| Apps added as members show as offline members in the mesh view (`mesh-view.ts:62`) | The `hidden` role, or a member kind |
| The relay keeps libp2p's default 5 inbound connections per host | Configure it, or document staggering |
