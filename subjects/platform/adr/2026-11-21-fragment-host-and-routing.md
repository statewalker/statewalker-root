# One fragment host per host, one fragment DO per fragment, `/fragments/{id}/` routing

**Status**: accepted, 2026-11-21. Decided in
[How do CellB and CellD host, wire and unload many fragment Workers on one host?](https://github.com/statewalker/statewalker-root/issues/183),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It amends [fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md).

## Context

Each fragment's server half is its own `wrangler.jsonc` project ([fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md)). It is installed and removed while the platform runs ([fragment-lifecycle](2026-11-20-fragment-lifecycle.md)).

The runtimes don't support that yet (`subjects/platform/research/fragment-do-rpc.md`):

- CellB's `loadProject` returns one runtime per project, with no service bindings to other scripts;
- stubs pass by reference only within one runtime;
- a browser never unloads a module;
- celld runs one application per fleet.

On Cloudflare, Dynamic Workers can't take DO namespaces.

## Decision

1. **One fragment host per CellB host** (browser or server; Cloudflare has none). A multi-project CellB runtime loads every enabled fragment's project side by side, with namespaces per project. Fragments share the host's realm because they are trusted.
   - Servers run CellB on Node; CellD joins once it can run several applications.
   - On Cloudflare, each fragment is a separately deployed Worker with native service bindings, and its lifecycle is a deploy through the Cloudflare API.
2. **One fragment DO per fragment**, at `idFromName(<fragment-id>)`, is the entry point and the anchor of the server lifecycle: awake is active, hibernating is idle, and disabled means never woken. Private DO classes behind it are allowed.
3. **Routing.**
   - In the browser, one ServiceWorker and a shared pool of shard workers route by fragment prefix, then by DO id.
   - Locally the prefix is `/fragments/{fragment-id}/{path}`; across HTTPeers it is `/peers/{peerId}/fragments/{fragment-id}/{path}`.
   - The route table maps each prefix to its serving host.
   - For a fragment that isn't installed, or is disabled or unresolved, the ServiceWorker answers 404 or 503 itself, without waking a DO.
   - Fragments are not exposed to peers by default. The user grants exposure per fragment and per peer or team, as a Biscuit capability checked by HTTPeers; only HTTP data crosses.
4. **Wiring and transport.** The kernel computes the wiring from the manifests, and bindings exist only while the fragment is active, and later calls raise the defined unavailable error. A binding is in-runtime on the same shard, MessagePort across shards, and HTTP across hosts. **Contracts between fragments carry only cloneable values and streams.**
5. **Unload and upgrade:** stop routing, drain in-flight requests with a timeout, then gracefully restart the affected shard workers or Node worker threads. DO state is durable, and there are no realms per fragment.
6. **Capacity:** no fixed cap. Memory and shard counts are measured in the demo applications. celld's limit of 256 live Dynamic Workers doesn't apply, because the fragment host loads projects, not Dynamic Workers.

## Considered options

- **One runtime per fragment, joined over HTTP or MessagePort.** Rejected: it loses RPC between fragments and multiplies workers.
- **An entrypoint routing to the fragment's named DOs, with no single fragment DO** (the #147 recommendation). Rejected by the human: a single fragment DO gives one identity and one lifecycle anchor. Its load limit (about 1,000 requests per second) matters little for one principal, and private DOs remain for heavy fragments.
- **A realm per fragment, so code can be unloaded alone.** Rejected: it costs a worker per fragment per shard; restarts are cheap because DO state is durable.
- **Dynamic Workers for fragments on Cloudflare.** Rejected: their `env` can't take DO namespaces.

## Consequences

- **CellB work,** filed in cellb.dev:
  - [#191](https://github.com/statewalker/cellb.dev/issues/191): fragment host;
  - [#192](https://github.com/statewalker/cellb.dev/issues/192): service bindings that follow placement;
  - [#193](https://github.com/statewalker/cellb.dev/issues/193): graceful restart.

  Class migrations on upgrade depend on [#182](https://github.com/statewalker/cellb.dev/issues/182).
- **Cloudflare deploys** need an account token kept in the vault.
- **Open:** the route table's format and where it lives remain open in [the route table ticket](https://github.com/statewalker/statewalker-root/issues/184).
