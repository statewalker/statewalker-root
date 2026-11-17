# Can a fragment's capabilities be a named Durable Object called over RPC by other fragments?

Research for `statewalker/statewalker-root#147`. Sources read on 2026-11-17. Statements marked
**(inference)** are this note's own reasoning, not a source's claim. Cloudflare pages were read as
Markdown (`<page>/index.md`) with `curl`. workerd and celld files were read from
`raw.githubusercontent.com` at `main` on the read date (the GitHub API was not reachable from the
session, so no commit hash). CellB was read from the shallow clone `repos/cellb.dev` at commit
`5fac4fd` (2026-11-16); its paths are given relative to that clone, with line numbers.

## Question

Decision 7 of "Destination and base unit" (`statewalker/statewalker-root#113`) and the ADR
[`2026-11-17-fragments-with-wrangler-server-halves.md`](../adr/2026-11-17-fragments-with-wrangler-server-halves.md)
say a fragment's server half calls only the fragments it declares as dependencies, through service
bindings with a typed contract (Zod → OpenAPI → MCP). The refinement to test: each fragment maps to
a Durable Object named after the fragment, its capabilities are that DO's methods, and other
fragments call them over Workers RPC on a DO stub, while each fragment's server half is its own
`wrangler.jsonc` Worker, loaded and unloaded on its own on CellB (browser, Node), CellD/workerd and
Cloudflare ([`unified-do-platform.md`](unified-do-platform.md) §2.1).

1. What does Cloudflare allow across Workers (cross-script DO bindings, `WorkerEntrypoint`,
   `RpcTarget`, passed stubs), including dynamic Workers, and with what limits?
2. What do CellB and CellD/workerd support today for cross-project DO bindings, JS RPC on DO
   stubs and service bindings, and Worker Loader payloads calling the host or each other?
3. Can the DO name come from the fragment id, and how does it meet the route table and moving a
   fragment between hosts?
4. How does the typed contract map onto RPC methods, and what stays HTTP-only?
5. Service bindings with a typed contract, named fragment DO with RPC, or both? What must CellB
   close?

## Short answer

- **On Cloudflare the mechanics all exist:** a Worker can call RPC methods on a DO class of
  another Worker through a `script_name` binding, or on another Worker's `WorkerEntrypoint`
  through a service binding; functions, `RpcTarget`s and stubs pass by reference, and streams
  stream. But the runtime's own configuration schema **discourages binding another Worker's DO
  namespace** and recommends a service binding to that Worker with an API, and a **dynamic Worker's
  `env` accepts only structured-clone values and service bindings**, not DO namespaces.
- **CellB today is one project per runtime.** `script_name` DO bindings and service bindings to
  other scripts are reported as unsupported; JS RPC on DO stubs and on service bindings to the
  script's own entrypoints works; stubs pass by reference within one runtime and into loaded
  Workers, but are refused between nodes. **celld runs one application per fleet**, refuses stubs
  across isolates, and gives a loaded Worker only structured-clone values and service-binding
  capabilities.
- **Naming works but is the wrong axis.** The binding already selects the fragment (its script
  and class); `idFromName` is free for the instance inside it. One DO per fragment is a
  documented anti-pattern (a global singleton, about 1,000 requests per second soft limit).
  Ids derive from the script name, so the fragment id must be the Worker's stable `name`.
- **The contract maps cleanly to RPC methods** if it stays within cloneable values and byte
  streams; callbacks, `RpcTarget`s, stubs and pipelining have no OpenAPI or MCP form, and do not
  cross nodes on CellB or celld. HTTP stays the only path for the client half, external agents,
  WebSockets and fragments placed on another host.
- **Recommendation: both, layered (inference).** Keep "declared dependency + typed contract", and
  make the server-side binding a **service binding to the fragment's `WorkerEntrypoint`**, whose
  methods are generated from the Zod contract and route to the fragment's own named DOs. Do not
  expose fragment DO classes across Workers with `script_name`. CellB must add cross-project
  service bindings in a multi-project host, placement-aware bindings and unloading.

## 1. Cloudflare Workers

**Cross-script DO RPC exists.** The RPC page says Workers RPC lets you "define public methods on
Durable Objects that can be called by other workers on the same Cloudflare account that declare a
binding to it", and public methods on a `WorkerEntrypoint` reached through service bindings
(Workers RPC, intro). A DO binding takes `script_name`, "the name of the Worker where the Durable
Object is defined, if it is external to this Worker"; locally the external Worker must run in a
separate `wrangler dev` process (Wrangler configuration, `durable_objects.bindings`). RPC on DO
stubs and service bindings needs compatibility date `2024-04-03` or the `rpc` flag (Workers RPC,
note; Durable Object stubs best practices). `wrangler types -c a -c b` types a
`DurableObjectNamespace<Counter>` or `Service<SumService>` from the other project's sources
(RPC TypeScript page).

**But workerd discourages it.** In workerd's configuration schema, `DurableObjectNamespaceDesignator.serviceName`
names "the service name of the worker that defines this class", and the comment continues: "Use of
this field is discouraged. Instead, when accessing a different Worker's Durable Objects, specify a
`service` binding to that worker, and have the worker implement an appropriate API"
(`src/workerd/server/workerd.capnp`, lines 847–862). A service designator also carries an
`entrypoint` and `props` (lines 506–536).

**What crosses an RPC call** (Workers RPC, "Structured cloneable types, and more"): structured
cloneable values, except application-defined classes; functions and `RpcTarget` subclasses, as
stubs that call back; byte-oriented `ReadableStream`/`WritableStream`, `Request` and `Response`,
with flow control and transferred ownership; and stubs received from a third Worker, which are
proxied through the introducer "only until the end of the Workers' execution contexts" ("Forwarding
RPC stubs"). Calls return a custom thenable that supports promise pipelining. Limits: 32 MiB
serialized per call (streams bypass it), and Smart Placement is ignored for RPC ("Limitations").
Only prototype methods and getters are exposed; instance properties, arrow functions and `#private`
members are not (Visibility and security model).

**Lifecycle.** Stubs created during an event are disposed when it ends; stubs received as
parameters are disposed when the call returns unless `dup()`ed; an RPC to a `WorkerEntrypoint`
keeps its execution context alive until every stub passed in or out is disposed; an `RpcTarget`'s
disposer runs after its last stub is disposed (RPC lifecycle page).

**Dynamic Workers.** `WorkerCode.env` "is serialized and transferred into the dynamic Worker" and
may contain structured cloneable types and service bindings, including `ctx.exports` loopback
bindings (Dynamic Workers API reference, `env`). Other resources are passed by wrapping them in a
`WorkerEntrypoint` of the loader, scoped with `props` that the dynamic Worker never sees; stubs
"cannot be forged. The only way to obtain one is to receive it" (Dynamic Workers, Bindings). A
loaded Worker's DO classes are reached through `worker.getDurableObjectClass(name)` and run as
**facets** of a supervisor DO in the loader, each with its own SQLite database (Durable Object
Facets). Isolates are cached by id but "two requests are never guaranteed to reach the same
isolate" (API reference, `get`).

**Versioning (inference).** Each Worker keeps its own compatibility date; RPC needs both sides on
`2024-04-03` or later. Fragments deployed separately see each other's methods as a wire API: a
renamed method or changed argument breaks callers at run time, so the contract needs a version and
additive-only changes, as an HTTP API does. A `script_name` binding additionally couples the caller
to the callee's class name and migrations.

## 2. CellB, celld and workerd

### CellB (0.11.x, `packages/cellb`)

| Capability | Status | Where |
|---|---|---|
| JS RPC on DO stubs | yes; celld's `rpc` example runs unchanged | `docs/architecture.md` 60–62; `conformance/celld-examples/rpc/index.js` |
| Service bindings to the script's **own** entrypoints, `fetch` and JS RPC, with `props` | yes | `src/project/wrangler.ts` 365–373 |
| Service bindings to **other** scripts | reported unsupported, not bound | `src/project/wrangler.ts` 238–242; `docs/gaps.md` 71–77 |
| `durable_objects.bindings[].script_name` | reported unsupported, and the binding is still made against a **local** class of that name | `src/project/wrangler.ts` 187–190 |
| Stubs, functions, `RpcTarget`s by reference | within one runtime and into or out of a loaded Worker's isolate; RpcPromise pipelining | `docs/gaps.md` 20–34; `src/core/handles.ts` 82–110 |
| Stubs to another node (tab, shard worker, peer) | refused with `DataCloneError` | `docs/gaps.md` 35–39; `src/core/handles.ts` 112–125 |
| Loaded Worker `env` | plain values copied; any binding or stub becomes a stub calling back to the parent runtime | `docs/architecture.md` 133–134; `docs/services/dynamic-workers.md` 84–87, 98–100 |
| Loaded Worker DO classes | facets in the isolate; `getDurableObjectClass(name, { props })` ignores props | `docs/architecture.md` 149–151; `docs/gaps.md` 17 |
| Unloading | `dispose()` only drops the id from the cache; `abortIsolate()` ends an isolate | `src/bindings/worker-loader.ts` 298–301; `docs/services/dynamic-workers.md` 104–107 |
| DO ids | derived from `cells:v1:<len>:<script>:<class>`, so from the wrangler `name` | `src/core/id.ts` 29–30; `docs/celld-compatibility.md` 77 |

Two more facts shape a multi-project design:

- **There is no multi-project host.** `loadProject` returns one runtime per project
  (`docs/architecture.md` 74–76), and the comment on service bindings says "a celld fleet runs one
  application" (`src/project/wrangler.ts` 365). No file in `packages/cellb` wires one project's
  bindings to another loaded project.
- **The seams for it exist.** `createCellRuntime` takes `namespaceKeys` overriding the
  script-scoped key per class (`src/core/runtime.ts` 72–75, 315–316), and a `route` that sends a
  cell's calls to another runtime as HTTP, RPC included (`src/core/runtime.ts` 317–319;
  `docs/architecture.md` 65–70). But the routed cell key is `<class>/<id>`, without the script
  (`src/core/runtime.ts` 318–320), so routing is per project today.

### celld (0.6.3, the version CellB pins)

- "A fleet runs one application" (celld `README.md`, line 214); its Workers support service
  bindings and JS RPC within it (line 48). Cross-application bindings are not offered **(inference
  from the one-application model; no `script_name` support is documented)**.
- "An RPC stub cannot cross an isolate boundary", and an `AbortSignal` in a DO RPC call does not
  cross a node (`docs/cloudflare-compat.md`, RPC, lines 87–92). CellB records celld refusing stubs
  through stubs and into loaded Workers (`packages/cellb/docs/celld-compatibility.md` 147).
- A loaded Worker "gets no binding and no `vars` entry of the deployment, and no Worker Loader
  binding"; `WorkerCode.env` accepts structured-clone values and service-binding capabilities (1
  MiB in total); "a loaded Worker entrypoint cannot transfer to another Worker"; `stub.dispose()`
  releases a loaded Worker (`docs/services/dynamic-workers.md`, lines 28–32, 66–69, 121–124).
- The process limit is now **256 live Dynamic Workers** (255 per script generation), and the
  process **rejects the removed `CELLD_MAX_LOADED_WORKERS`** (same page, lines 99–105). The ADR's
  "Runtime gaps" bullet still names that variable.

### workerd

workerd supports a cross-service DO binding (`serviceName`, discouraged) and service bindings with
`entrypoint` and `props` (`workerd.capnp` lines 506–536, 847–862). Wrangler runs several projects
locally as one workerd process with `wrangler dev -c a/wrangler.jsonc -c b/wrangler.jsonc`
(Service bindings RPC page).

## 3. Naming and placement

- **Yes, a name can be the fragment id**: `idFromName`/`getByName` derive an id from any string
  within a namespace (Durable Object namespace API). CellB derives ids synchronously the same way
  celld does (`packages/cellb/docs/architecture.md` 51).
- **The namespace already names the fragment (inference).** A binding selects a script and a
  class, so the fragment is fixed before any name is chosen. Using the name for the fragment id
  gives one object per fragment, which Cloudflare calls an anti-pattern: "Do not use a single
  Durable Object as a global singleton"; an object has a soft limit of 1,000 requests per second
  (Rules of Durable Objects; Durable Objects limits). The name is better spent on the unit of
  coordination inside the fragment (a workspace, a document, a session), which the Rules page
  recommends.
- **The fragment id must be the Worker's `name`, and stable.** "Renaming the project's `name`
  makes every object start empty", because ids derive from the script name
  (`packages/cellb/docs/services/durable-objects.md` 90–91). Renaming a DO class needs
  `renamed_classes`, which CellB does not support (`docs/gaps.md` 71–77).
- **Route table (inference).** Workers RPC only reaches Workers in the same account (Cloudflare)
  or the same runtime (CellB, celld). When the route table places a dependency on another host (the
  browser, a celld fleet, Cloudflare), the binding must fall back to HTTP at the fragment's base
  URL. CellB already carries RPC over HTTP between runtimes for DOs (`route`, `peers`), but with
  copies only: stubs are refused between nodes. A contract that uses callbacks or stubs would work
  co-located and fail after a move.
- **Moving state (inference).** A cell moves between celld and CellB through one shared bucket
  with the same ids and storage format (`packages/cellb/docs/celld-compatibility.md` 1–6, 77;
  `docs/services/durable-objects.md` 84–86). Moving to or from Cloudflare moves no DO state; that
  needs an export and import, which no source describes.

## 4. The typed contract on RPC

**Mapping (inference).** One Zod operation `{ name, input, output }` becomes:

- a `WorkerEntrypoint` method `name(input): Promise<output>`, validating `input` on entry;
- an OpenAPI operation (`operationId = name`, request body `input`, response `output`), served at
  the fragment's base URL, which [`openapi-mcp-tool-mapping.md`](openapi-mcp-tool-mapping.md)
  already projects to MCP tools;
- a typed client: `Service<Api>` from `wrangler types` on Cloudflare, or a type generated from the
  same Zod schemas for HTTP callers.

What RPC carries that the contract can keep: cloneable values (the JSON Schema subset is a strict
subset of these), byte streams, `Request` and `Response`. What it must leave out, because OpenAPI
and MCP cannot express it and CellB and celld cannot move it between nodes: functions, `RpcTarget`
returns, passed stubs and pipelined calls on results. RPC also skips HTTP's per-call costs (no URL
routing, headers or JSON encoding), which is its advantage for co-located fragments.

**What stays HTTP-only:**

- calls from the client half and the browser (decision 8 of #113: native HTTP and WebSocket at a
  base URL);
- external agents over MCP and A2UI streams;
- WebSockets: Cloudflare's examples upgrade them in the DO's `fetch` handler, reached with
  `stub.fetch(request)` (Durable Objects WebSockets best practices); this note found no documented
  way to hand a WebSocket through an RPC method **(inference from what the pages show)**;
- fragments placed on another host by the route table, and anything that relies on HTTP caching,
  status codes or headers.

## 5. Recommendation

**Both, layered (inference):**

1. **Keep the rule of #113**: a fragment calls only declared dependencies, through a binding, with
   a typed contract. The contract is the public surface; nothing else crosses.
2. **Make the server-side binding a service binding to a named `WorkerEntrypoint`** of the
   dependency (for example `export class Api`), whose methods are generated from the Zod contract
   and validated. Callers use JS RPC on it when co-located; the same operations are served over
   HTTP for every other caller.
3. **Named DOs stay inside the fragment.** The entrypoint resolves `getByName(<instance>)` on the
   fragment's own namespace. Fragments do not bind each other's DO classes with `script_name`,
   because workerd discourages it, dynamic Workers cannot receive DO namespaces, and it would tie
   callers to the callee's classes, migrations and storage.
4. **Keep the contract cloneable**: no callbacks, `RpcTarget`s or stubs in it, so a fragment can
   move hosts by configuration without changing callers.

Under a Worker Loader host (one host Worker loading fragments as dynamic Workers), the same shape
holds: the host passes each fragment `ctx.exports.FragmentApi({ props: { target } })` stubs for its
declared dependencies, and runs each fragment's DO classes as facets of a host DO named by the
fragment and instance. That is where `idFromName(fragmentId)` naturally appears.

**Gaps CellB would need to close:**

1. **A multi-project host**: load, wire and unload several `wrangler.jsonc` projects in one runtime
   or one origin, resolving `services[].service` to another loaded project's entrypoint, failing
   with a clear error while the target is absent (`src/project/wrangler.ts` 238–242, 365–373).
2. **Cross-node bindings by placement**: a service binding whose target sits on another shard, tab
   or host goes over HTTP; the routed cell key needs the script in it (`src/core/runtime.ts`
   318–320).
3. **`script_name`**, only if wanted at all: today it is reported but silently bound to a local
   class (`src/project/wrangler.ts` 187–190); it should at least not bind, and a real
   implementation would use the `namespaceKeys` seam (`src/core/runtime.ts` 315–316).
4. **Unloading**: `dispose()` does not end an isolate (`src/bindings/worker-loader.ts` 298–301), and
   `getDurableObjectClass` ignores `props` (`docs/gaps.md` 17).
5. **celld parity**: celld runs one application per fleet and gives loaded Workers only
   structured-clone values and service-binding capabilities, so on celld per-fragment Workers need
   either a loader host inside one deployment or HTTP between fleets. The ADR's
   `CELLD_MAX_LOADED_WORKERS` note should become "256 live Dynamic Workers per process".

## Sources

- Cloudflare, Workers RPC: https://developers.cloudflare.com/workers/runtime-apis/rpc/index.md
  (updated 2026-10-12), `/rpc/lifecycle/index.md`, `/rpc/visibility/index.md`,
  `/rpc/typescript/index.md`, `/rpc/error-handling/index.md`, `/rpc/reserved-methods/index.md`
- Cloudflare, service bindings:
  https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/index.md,
  https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/index.md
- Cloudflare, Durable Objects:
  https://developers.cloudflare.com/durable-objects/api/namespace/index.md,
  https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/index.md,
  https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/index.md,
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md,
  https://developers.cloudflare.com/durable-objects/platform/limits/index.md
- Cloudflare, Wrangler configuration (`durable_objects.bindings[].script_name`):
  https://developers.cloudflare.com/workers/wrangler/configuration/index.md
- Cloudflare, Dynamic Workers: https://developers.cloudflare.com/dynamic-workers/index.md,
  `/dynamic-workers/api-reference/index.md`, `/dynamic-workers/usage/bindings/index.md` (updated
  2026-10-31), `/dynamic-workers/usage/durable-object-facets/index.md`,
  `/dynamic-workers/platform/limits/index.md`
- workerd: https://raw.githubusercontent.com/cloudflare/workerd/main/src/workerd/server/workerd.capnp
- celld: https://raw.githubusercontent.com/denoland/celld/main/README.md,
  `docs/cloudflare-compat.md`, `docs/services/dynamic-workers.md`,
  `docs/services/durable-objects.md`, `docs/services/workers.md` (same base URL)
- CellB, `repos/cellb.dev` at `5fac4fd`: `packages/cellb/src/project/wrangler.ts`,
  `src/core/runtime.ts`, `src/core/handles.ts`, `src/core/id.ts`,
  `src/bindings/worker-loader.ts`, `docs/architecture.md`, `docs/gaps.md`,
  `docs/celld-compatibility.md`, `docs/services/durable-objects.md`,
  `docs/services/dynamic-workers.md`, `docs/services/workers.md`,
  `conformance/celld-examples/rpc/`; `packages/platform/wrangler.jsonc`
- Related notes: [`unified-do-platform.md`](unified-do-platform.md),
  [`openapi-mcp-tool-mapping.md`](openapi-mcp-tool-mapping.md),
  [`mcp-and-skills-on-do.md`](mcp-and-skills-on-do.md)
