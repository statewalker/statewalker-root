# Fragments are the unit of the platform; their server halves are wrangler projects, one Worker each

**Status**: accepted, 2026-11-17; amended by [kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md) (extension references are a third channel between fragments) and by [fragment-host-and-routing](2026-11-21-fragment-host-and-routing.md) (one fragment DO per fragment). Decided in
[Destination and base unit: fragment or wrangler.jsonc per fragment?](https://github.com/statewalker/statewalker-root/issues/113),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).

## Context

The platform loads and runs **fragments** (`GLOSSARY.md`). On 2026-10-20 the Sandclaw grilling
decided that fragments are the base and that Durable Objects are "one more way to package apps",
because the DO design was then a spike. Since then cellb has reached 0.11.1:

- it replays 70 conformance scenarios against celld;
- `loadProject` takes a `wrangler.jsonc` folder or a FilesApi;
- `cellb.dev/apps/sandbox` uses `wrangler.jsonc` plus `client/` as its project format.

That makes a `wrangler.jsonc` project a server packaging that runs unchanged in the browser
(CellB), on a server (CellD/workerd) and on Cloudflare. The research digest
`docs/research/unified-do-platform.md` holds the background.

## Decision

1. **The fragment stays the unit of extension.** It carries the identity, version, dependencies,
   contributions and lifecycle. It has a manifest and at least one of a server half, a client half
   or an agent half; each half is optional.
2. **A fragment's server half, when it has one, is always a `wrangler.jsonc` project**: Workers and
   Durable Objects. There is no other server packaging: no plain Node services and no
   ServiceWorker-only handlers. The 2026-10-20 decision is reversed for server code only.
3. **One Worker per fragment.** Each server half is loaded and unloaded on its own, so fragments
   can be installed and removed while a host runs. Merging several fragments into one Worker at
   build time is allowed only as a deployment optimisation, as `cellb.dev/packages/platform` does
   today.
4. **Portable by default.** A fragment may require bindings that only some hosts provide; a host
   that lacks them refuses to activate it and says why.

## Considered options

- **DOs as one packaging among several**, the 2026-10-20 decision. Rejected: two server models
  double the lifecycle, placement and security work, and the reason (an immature runtime) no
  longer holds.
- **All fragments merged into one Worker**, as `packages/platform` does. Rejected as the default:
  it rules out installing and removing fragments while a host runs.

## Consequences

- **Calls between fragments.** On the client, fragments call each other only through commands. On
  the server, a fragment calls only the fragments it declares as dependencies, through service
  bindings with a typed contract (Zod, projected to OpenAPI and MCP). The research for #147
  (`docs/research/fragment-do-rpc.md`) refines it: the binding is a service binding to the
  dependency's `WorkerEntrypoint`, routing to the fragment's own named DOs, with no `script_name`
  bindings across fragments. [fragment-host-and-routing](2026-11-21-fragment-host-and-routing.md)
  later chose one fragment DO per fragment as the entry point instead.
- **The boundary between halves.** It is native HTTP and WebSocket at a base URL. A route table
  places each fragment on a host, and moving a fragment is a configuration change.
- **Runtime gaps.** CellB and CellD must load, isolate and unload many small projects: the host
  cannot end a loaded Worker's isolate (`dispose()` only drops the cached id; only the loaded
  code's own `abortIsolate()` ends it), and celld caps a process at 256
  live Dynamic Workers (`docs/research/fragment-do-rpc.md`). CellB runs one project per runtime
  today, so loading and wiring several fragment projects is new work.
