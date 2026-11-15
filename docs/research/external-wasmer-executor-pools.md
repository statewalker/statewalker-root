# Can a pool of external Wasmer-based executors serve Durable Objects?

Research for `statewalker/statewalker-root#93` (map: `statewalker/statewalker-root#70`). Sources
read on 2026-11-15. Statements marked **(inference)** are this note's own reasoning, not a
source's claim. `PROTO` is `statewalker-sandbox/apps/flue-capfs-do`; `WSDK` is the local clone
of `wasmerio/wasmer-js` (now the multi-language Wasmer SDK) at commit `ddbd6cd` (2026-11-07),
whose `js/` is `@wasmer/sdk` 0.19.1, the version `PROTO/package.json:42` pins.

## Question

The alternative to embedding Wasmer, almostnode or Pyodide inside Durable Objects: real processes
on physical servers, each hosting many Wasmer (WASIX) environments. The environments connect to
the DOs and form a **pool**. A Flue session picks an environment, sends it pre-bundled code and
runs operations, and all code, tools and file access come from the DOs under the session's
Biscuit capability. What would it take: density, connection and authentication (on CellB, CellD
and Workers), loading bundles and files with caching, pool mechanics, isolation, and prior art?

## Short answer

- **Feasible, and the prototype already holds the hard half.** `PROTO` runs Wasmer on cellb's
  Node host as a child process whose sandboxes see the capability as `/workspace`, with every
  guest file operation forwarded to the Agent cell and answered by the capability
  (`PROTO/README.md:509-602`, `PROTO/src/wasmer/kernel.ts:1-8`). An external executor is that
  engine with the pipe to its parent replaced by a network connection to a DO. What is missing:
  a network edge that accepts the token transport (today `Workspace.fsCall` is reachable only
  by DO RPC, `PROTO/src/workspace.ts:150-153`, and no HTTP route exposes it,
  `PROTO/src/worker.ts:129-215`), an executor identity separate from the session capability,
  time-limited leases, and a registry.
- **Density is the selling point, limits are the weak point.** Wasmer's own (vendor) benchmark,
  with packages cached: a new sandbox in 0.14 ms, a warm command in 5.6 ms, a new sandbox to a
  finished CPython no-op in 25 ms, Edge.js `node` start in 37 ms; sequential only, no concurrency
  measured (`WSDK/benchmarks/sandboxes/RESULTS-2026-09-01.md`). Native Rust embedding can cap
  memory per instance (custom `Tunables`) and CPU (metering middleware); `@wasmer/sdk` on Node
  exposes only per-command `timeoutMs`/`outputBytes`, no memory or CPU cap
  (`WSDK/js/src/index.ts:138-147,176-183`), and dead guest memory is freed only by the worker
  thread's garbage collector (`WSDK/js/src/guest-memory-budget.ts:4-29`).
- **Let executors dial out, by WebSocket, to DOs.** Workers DOs accept hibernatable WebSockets
  (clients stay connected while the DO sleeps; pings are answered without waking it), cellb
  passes workerd's hibernation test, celld supports WebSockets but fails that test. A DO inside a
  browser tab (CellB in a page) cannot be dialled; it must dial the executor or go through a
  relay. Every prior-art pool attaches compute the same way: the node calls out (Daytona runners
  poll the control plane, GitHub self-hosted runners need only outbound HTTPS 443).
- **A DO can be the pool registry; it should not carry the traffic.** A Pool DO holds
  registrations, leases (with alarms for expiry) and placement; session traffic then goes over a
  per-lease connection between the executor and the session's Agent DO, and file operations to
  the Workspace DO under the session's token **(inference)**. A single DO has a soft limit of
  1,000 requests per second and a CPU budget per message.
- **Isolation inside one process is WASIX's sandbox and nothing else.** A guest reaches only its
  mounts and has no network unless granted (SDK default `{mode: "disabled"}`,
  `WSDK/js/src/index.ts:545`). Tenants sharing a process share one runtime's bugs, one V8 (on
  Node) and one memory pool. Every commercial pool (Cloudflare Containers, E2B, Fly, Deno Sandbox)
  puts each sandbox in a Firecracker microVM; Modal uses gVisor or microVMs. So: one OS process
  (or microVM) per tenant, many sessions per process **(inference)**.
- **Trade-off (inference):** an external pool brings real `bash`/`python`/`node` to Workers and
  CellD (where in-DO Wasmer answers `ENOSYS`, `PROTO/README.md:559`), at the cost of operating
  servers, a WAN round trip on every guest file operation, and a second trust domain. Worker
  Loader isolates remain the cheaper choice for JavaScript tools; the pool is for programs that
  need a POSIX process.

## Findings

### 1. Density: many WASIX environments in one process

**Three ways to embed.**

- **Rust (`wasmer` + `wasmer-wasix`).** `wasmer-wasix` 0.705.0 is the "WASI and WASIX
  implementation library for Wasmer" (https://docs.rs/wasmer-wasix/latest/wasmer_wasix/). Native
  compiler backends (Singlepass, Cranelift, LLVM) generate machine code; the runtime lists
  **caching** ("compiled WebAssembly modules can be reused so subsequent runs … have very little
  start up time") and **metering** ("computation time and other resources can be monitored and
  limits set") as features (https://docs.wasmer.io/runtime/features). The new Rust SDK is
  "Workspace/Git while crate publishing is disabled" (`WSDK/README.md`, "Pick your SDK").
- **`@wasmer/sdk` on Node.** "Runs packages locally through the host's WebAssembly engine; it
  does not contact a remote sandbox service and Node.js does not load a native addon"; one
  `Wasmer` client is reused for many sandboxes (https://docs.wasmer.io/runtime/js). npm
  `@wasmer/sdk` latest 0.19.1, published 2026-10-07 (npm registry). The SDK calls itself alpha
  (`WSDK/README.md`, last section).
- **`wasmer` CLI.** One OS process per run; `--volume HOST:GUEST` maps directories, the guest
  sees no host file or network without grants, `--net` (with rules such as
  `dns:allow=example.com:80`) or the narrower `--http-client` turns network on
  (https://docs.wasmer.io/runtime/cli; flags in
  https://github.com/wasmerio/wasmer/blob/main/lib/cli/src/commands/run/wasi.rs). Cached
  artefacts go to `--cache-dir` (default `~/.wasmer/cache`).

**Startup.** Wasmer's own benchmark (Apple M5 Max, native Python SDK on Wasmer 7.4.0, 30
sequential samples, packages and compiled artefacts already in `.wasmer`):

| Measure | Wasmer SDK p50 | Docker | E2B | Modal |
|---|---:|---:|---:|---:|
| New sandbox | 0.140 ms | 206 ms | 517 ms | 336 ms |
| Warm command | 5.6 ms | 49 ms | 83 ms | 103 ms |
| New sandbox → CPython no-op done | 25.0 ms | 281 ms | 807 ms | 1,611 ms |
| Node start in a sandbox (Edge.js for Wasmer) | 36.9 ms | 61.7 ms | 164 ms | 172 ms |

Source: `WSDK/benchmarks/sandboxes/RESULTS-2026-09-01.md`. The report itself notes the remote
providers include a network round trip, that runtime versions differ, and that "these runs
measure sequential latency, not allocation throughput or contention at 10–100 concurrent
sandbox creates" (its conclusion 6). **No source measures how many WASIX sandboxes one process
holds.**

**Caching.** "Native Rust, Python, and Node.js clients share the same registry metadata and
downloaded package data. Native compiled artifacts live in target-specific cache partitions"
(`WSDK/README.md`, "Fast, shared package caching"). The first sandbox downloads; "later
sandboxes reuse the local `.wasmer` cache"; pin versions with `@=`
(https://docs.wasmer.io/runtime/js). `PROTO` loads its allowed packages once per engine and
caches them in `WASMER_CACHE` (`PROTO/README.md:561-571`).

**Per-instance limits.**

- Native: the `tunables_limit_memory` example defines `LimitingTunables`, "a custom tunables that
  allows you to set a memory limit" in Wasm pages
  (https://github.com/wasmerio/wasmer/blob/main/examples/tunables_limit_memory.rs); the
  `metering` example makes "execution fail if cost exceeds a given limit"
  (https://github.com/wasmerio/wasmer/blob/main/examples/metering.rs). The CLI also has
  `--enable-cpu-backoff` (pause the process CPU when there are no run tokens; `wasi.rs`).
- `@wasmer/sdk`: `SandboxOptions` takes packages, files, env, network and shell, with no memory,
  CPU or thread limit (`WSDK/js/src/index.ts:138-147`); a run takes `timeoutMs` and
  `outputBytes` (`:176-183`). "Every WASIX process gets its own shared `WebAssembly.Memory`. Once
  the process has finished … only this worker's garbage collector can free that memory", and
  where no collection hook exists the pool retires the worker (`WSDK/js/src/guest-memory-budget.ts:4-29`,
  wasmer-sdk#547).
- **(inference)** On Node, memory and CPU are therefore capped per OS process (cgroups,
  container limits) rather than per sandbox; a per-tenant process is the unit of accounting.

**Snapshots.** Wasmer journals record a process's file-system and memory changes; snapshot
triggers include idle, first `listen`, first stdin read, first environment read and a timer;
restoring thread stacks needs the module built with asyncify, otherwise "a restoration will
restart the main thread" (https://github.com/wasmerio/wasmer/blob/main/docs/journal.md; CLI flags
`--journal`, `--snapshot-on`, `--snapshot-period` in `wasi.rs`). Wasmer Edge's InstaBoot uses a
snapshot taken after warm-up requests to start apps "almost instantly"
(https://docs.wasmer.io/edge/learn/instaboot). **(inference)** For a pool, the cheaper win is the
compiled-module cache; process snapshots matter only for runtimes with heavy start-up (CPython
with imports).

**Packages.** `python/python` latest 3.13.20 (2026-09-11) and `wasmer/edgejs` latest 0.2.5
(2026-09-30) (registry GraphQL, `registry.wasmer.io/graphql`). One sandbox can combine
`python/python`, `wasmer/edgejs` (command `node`) and `php/php-32`
(https://docs.wasmer.io/runtime/js). Edge.js is "a secure JavaScript runtime … Fully compatible
with Node.js", pluggable with V8, JavaScriptCore or QuickJS, and "uses WebAssembly for sandboxing
when in `--safe` mode" (https://github.com/wasmerio/edgejs, README). The earlier note covers both
in more depth (`docs/research/node-python-clis-in-sandbox.md`, "Wasmer / WASIX, Edge.js and
`python/python`").

**What the prototype does today.** One engine per Agent cell, stopped after 5 minutes idle; on
Node "one request is served at a time for every sandbox, so none may hold the others"; a file
operation not answered in 20 s fails; 60 s per command (at most 300 s), 1 MB output, 256 open
files, 64 MiB of written files in memory (`PROTO/README.md:576-590`;
`PROTO/src/wasmer/kernel.ts:52-60`). **(inference)** A pool host needs the opposite shape: one
long-lived engine serving many sessions, with file requests served concurrently per sandbox.

### 2. Connecting executors to DOs

**What exists in the prototype.**

- Two capability transports through the same gate: a `FilteredFiles` stub (per connection, cannot
  cross runtimes) and a token transport (the Biscuit string and workspace name; "survives
  hibernation and restarts", "crosses runtimes and nodes") (`PROTO/README.md:140-150`). The token
  path is `TokenCap` → `Workspace.fsCall(token, req)` (`PROTO/src/caps.ts:76-108`,
  `PROTO/src/workspace.ts:1-7,150-153`). Attenuation is offline: `TokenCap.attenuate` appends a
  Datalog block to the token (`PROTO/src/caps.ts:102-106`).
- The files RPC moves content "as chunks keyed by (streamId, chunkId), each an ordinary
  capability call", because `ReadableStream` over DO RPC is refused on cellb and celld while a
  streamed `fetch()` body works everywhere (`PROTO/src/files-rpc.ts:1-5,14-29`;
  `PROTO/README.md:697-720`). The Wasmer host-fs reads a file through its own files-RPC stream,
  1 MiB at a time, and appends through the files-RPC append (`PROTO/README.md:528-554`).
- The README already names the gap: `webrun-files-http` "could serve a FilesApi over the Durable
  Object's `fetch`, which streams everywhere, but it would need a second, token-checking HTTP
  surface beside the capability" (`PROTO/README.md:715-718`). The worker's routes today are
  `/api/runtime`, admin `/api/w/:ws/*` and `/api/agents/:name/run` (`PROTO/src/worker.ts:129-215`).
  **(inference)** An executor needs exactly that surface: a WebSocket (or HTTP) route whose
  messages are `FsRequest`s (`PROTO/src/authority.ts`, `FsRequest` union at `:392`), answered
  by `fsCall`. Because `fsCall` already takes `{op: "rpc", method, args}`, the files-RPC chunk
  protocol works over a WebSocket unchanged.

**Workers / workerd.** "Durable Objects can act as WebSocket servers that connect thousands of
clients per instance. You can also use WebSockets as a client"; with the Hibernation API "clients
remain connected while the Durable Object is not in memory" and billable duration does not accrue;
state is restored with `serializeAttachment`/`deserializeAttachment`; incoming pings get automatic
pongs that "do not interrupt hibernation"
(https://developers.cloudflare.com/durable-objects/best-practices/websockets/). Limits: received
WebSocket messages up to 32 MiB; 30 s CPU per request or message by default, configurable to
5 minutes; a soft limit of 1,000 requests per second per object
(https://developers.cloudflare.com/durable-objects/platform/limits/).

**CellB and CellD.** CellB accepts hibernatable sockets (`ctx.acceptWebSocket()`,
`webSocketMessage()`), and "workerd's `wd-websocket-hibernation` test passes on CellB; celld fails
it" (`cellb.dev/packages/cellb/docs/services/websockets.md:1-5,62`;
`docs/celld-compatibility.md:23`). In a browser, "a WebSocket is a MessagePort" and
`new WebSocket(url)` "returns the host's own client socket" (`websockets.md:48-53,71-72`).
**(inference)** So a DO in a browser tab can dial out to an executor (over `wss://`) but no
executor can dial it; for that case either the page's DO opens the lease connection, or the
connection goes through a relay such as httpeers' circuit relay (`httpeers/README.md`, "What it
is"). celld and CellB-on-Node already form a mixed fleet: a CellB node puts its address in the
node record (`bucket.advertise(addr)`) and every peer request is signed with the fleet's
HMAC-SHA-256 secret, a timestamp within ±30 s and a fresh nonce
(`cellb.dev/packages/cellb/docs/celld-compatibility.md:115-131`): a working precedent for
admitting a node with a fleet credential.

**Authentication: two credentials, not one (inference).**

1. *Executor identity* (may this machine join the pool?): a pool credential such as the celld
   fleet's signed requests, an Ed25519 key per executor, or mTLS. It never grants file access.
2. *Session capability* (what may this lease touch?): the session's Biscuit, attenuated before it
   leaves the DO, to the lease's paths and, ideally, an expiry. Biscuit expresses expiry as a
   check such as `check if time($0), $0 < 2019-02-05T23:00:00Z`
   (https://github.com/eclipse-biscuit/biscuit/blob/main/SPECIFICATIONS.md), but the prototype's
   authorizer supplies only `operation`, `resource` and `session` facts
   (`PROTO/src/authority.ts:380-386`), so a time check in a token would never pass until the
   authorizer adds a `time` fact.

The executor host holds the lease token; the guest gets only the mount. Cloudflare states the
reason plainly: "once a value is in the sandbox, all the code there can read it and send it
anywhere the sandbox can reach" (https://developers.cloudflare.com/sandbox/concepts/security/).
The prototype's tool isolates already follow it: the token sits in the `ToolFilesEntrypoint`
props, which the tool cannot read, and every call checks that the run is still active
(`PROTO/src/tool-files-entrypoint.ts:1-11,32-53`; `PROTO/src/agent.ts:288-292`).

**Loading bundles and tools.** Bundles are named by content hash (`"sha256-…"`, what a deployment
lists in `allowedBundles`) (`PROTO/README.md:178-190`). **(inference)** An executor can cache
bundles and Wasmer packages by hash across sessions and tenants: fetch each bundle through the
capability the first time, cache it by hash, check the hash on load, and still ask the DO whether
this lease may use that hash before serving it from the cache. Files are not cacheable across sessions: each guest file operation is a round trip
under the capability, which the metadata cache cuts "3–20×" on shell work
(`PROTO/README.md:591-599`) and whose remaining cost the README already flags: "file contents and
writes are still one round trip each … package installs that write thousands of files stay slow"
(`:600-602`).

**Latency (inference).** On cellb that round trip is a local pipe; to an external executor it is a
WAN round trip per uncached operation. Cloudflare itself does not co-locate: "Durable Objects and
their associated Container instances are not guaranteed to run in the same location"
(https://developers.cloudflare.com/containers/concepts/architecture/). A pool should therefore
place executors near the Workspace DO's region, keep the connection open per lease, and keep
scratch work (package installs, build output) on a sandbox-local in-memory directory that is not
the capability.

### 3. Pool mechanics

**How existing pools work.**

- **Registration, outbound only.** Daytona: "Each runner polls the control plane API for jobs and
  executes sandbox operations"; organisations attach their own runners as custom regions
  ("bring your own compute") (https://www.daytona.io/docs/en/architecture.md,
  https://www.daytona.io/docs/en/bring-your-own-compute.md). GitHub self-hosted runners "connect
  to GitHub to receive job assignments" and need only outbound HTTPS on port 443
  (https://docs.github.com/en/actions/reference/runners/self-hosted-runners).
- **Placement.** E2B's API "keeps a live map of orchestrator nodes (discovered via Nomad,
  Kubernetes, or a static list)" and picks one per sandbox by best-of-K: sample K ready nodes,
  score by load, pick the lowest; a node that refuses (`ResourceExhausted`) stays eligible and
  retries back off with jitter (https://github.com/e2b-dev/runtime/blob/main/docs/ARCHITECTURE.md,
  "Placement"). Control plane and data plane are separate: "sandbox traffic goes straight from
  the edge to the node and never passes through the API" (https://github.com/e2b-dev/runtime,
  README).
- **One sandbox per DO.** Cloudflare: "Each container instance belongs to one Durable Object";
  to route across a fixed pool, "choose a name at random"
  (https://developers.cloudflare.com/containers/configuration/scaling-and-routing/). Shutdown:
  an inactivity timeout, `signal()` or `destroy()`; the platform sends `SIGTERM`, waits up to
  15 minutes, then `SIGKILL`; the DO runs exit work when `monitor()` settles and scheduled work
  from an alarm (https://developers.cloudflare.com/containers/concepts/architecture/).

**A DO as the registry (inference).**

- *Pool DO* (one per region or per tenant group): executors open a hibernatable WebSocket to it
  and send a hello (executor id, signed; capacity; cached package hashes); the attachment keeps
  that across hibernation. Capacity updates are messages, liveness is the open socket plus a
  periodic heartbeat message.
- *Lease*: a session's Agent DO asks the Pool DO for an environment; the Pool DO picks one
  (best-of-K over capacity and cache hits), records `{lease, executor, agent, expiresAt}` in its
  SQLite, sets an alarm at expiry, and tells the executor. The executor then opens a second
  connection, per lease, to the Agent DO (or the Agent DO dials it, on browser CellB), so session
  traffic does not pass through the Pool DO.
- *Cleanup*: lease end or expiry closes the sandbox and drops its mount, as `PROTO` does at the
  end of a run ("when the run ends its mount is dropped and late calls are refused",
  `PROTO/src/wasmer/kernel.ts:5`); revoking the lease token (`/sessions/:sid/revoke`,
  `PROTO/README.md:75-90`) stops file access even if the executor misbehaves.
- *Scaling*: a DO cannot start a machine it does not own. The Pool DO can only publish demand
  (queue depth, refusals) to whatever starts executors (systemd, Nomad, Kubernetes, a Fly
  Machines call). On Cloudflare the same Pool DO could fall back to a Container.

### 4. Isolation

**Inside one process: WASIX.** The CLI guest "cannot see your filesystem or network unless you
grant access" (https://docs.wasmer.io/runtime/cli). The SDK's network policy defaults to
`{mode: "disabled"}`, with `host`, `http` (browser virtual TCP, no egress) and `wisp` (egress over
a WISP WebSocket endpoint) as opt-ins (`WSDK/js/src/index.ts:85-106,545`). `PROTO` adds: each run
a sandbox of its own, no network, packages restricted to `WASMER_PACKAGES`, the built-in `wasmer`
command cannot fetch because the engine removes `fetch` after loading packages, and "a WASI guest
cannot reach the host's files" (`PROTO/README.md:561-575`).

**What one process shares (inference).** All tenants in one Node engine share one V8 and its
worker pool, the package cache, the event loop and the host process's memory; a bug in the
runtime or in the host-fs bridge is a cross-tenant bug. The `wisp` mode is worth noting: egress
could go to a WISP endpoint run by the DO side, the WASIX analogue of Cloudflare's outbound
intercepts, rather than to the host network.

**Process level.** Node's permission model, which `PROTO` already uses for the engine
(`PROTO/README.md:568-571`), "does not protect against malicious code … Malicious code can bypass
the permission model" (https://github.com/nodejs/node/blob/main/doc/api/permissions.md). Stronger
options, as the prior art uses them: Linux namespaces with dedicated CPU, RAM and disk per sandbox
(Daytona runners, https://www.daytona.io/docs/en/architecture.md), gVisor or microVMs (Modal,
https://modal.com/docs/guide/security), Firecracker microVMs (Cloudflare Containers, E2B, Fly).
Cloudflare calls the sandbox "the smallest unit of trust": a separate Linux user does not keep
code away from files (https://developers.cloudflare.com/sandbox/concepts/security/).
**(inference)** Layering for the pool: WASIX sandbox per session, one OS process (container or
microVM) per tenant, no host credentials in the process beyond the executor key and active lease
tokens.

### 5. Prior art and how each attaches to a control plane

| System | Isolation | Attachment to control plane | Notes |
|---|---|---|---|
| Cloudflare Containers | Firecracker microVM per instance | Accessed **only through its DO** (`ctx.container`); one instance per DO | Cold start "often … in the 1-3 second range"; ephemeral disk, filesystem snapshots (beta, no memory) (https://developers.cloudflare.com/containers/concepts/architecture/, https://developers.cloudflare.com/containers/guides/snapshots/). `enableInternet: false` plus outbound intercepts route container HTTP to a `WorkerEntrypoint` with per-instance `props`, where all bindings are available (https://developers.cloudflare.com/containers/configuration/outbound-traffic/, https://developers.cloudflare.com/containers/configuration/workers-connections/) |
| Cloudflare Sandbox SDK | Same (Containers) or Dynamic Workers | Worker → Sandbox DO → container over HTTP (`getSandbox`) | 1.0 offers Containers and Dynamic Workers (`globalOutbound: null`) as the two environments (https://developers.cloudflare.com/sandbox/, https://developers.cloudflare.com/sandbox/sdk/concepts/architecture/) |
| E2B | Firecracker microVM, cgroup, netns, nftables egress firewall | API places sandboxes on orchestrator nodes over gRPC; nodes discovered via Nomad/Kubernetes/static list; `envd` inside each VM serves processes and files over Connect RPC | Apache-2.0, self-hostable on one machine ("Embed"); sandbox = resumed snapshot with lazy memory (https://github.com/e2b-dev/runtime) |
| Modal Sandboxes | gVisor or microVMs | Created from Modal's API; tunnels for inbound | `block_network=True`, CIDR and domain allowlists; `idle_timeout`; up to 24 h (https://modal.com/docs/guide/sandbox, https://modal.com/docs/guide/sandbox-networking) |
| Daytona | Linux namespaces per sandbox on runners | **Runners poll the control plane for jobs**; BYOC custom regions | Closed source since 2026-06-11 (`cellb.dev/apps/sandbox/docs/alternatives.md`, §1) |
| Fly Machines | Firecracker VMs | REST Machines API (create, start, stop, suspend) | Suspend/resume "a few hundred ms" via Firecracker snapshots (https://fly.io/docs/machines/, https://fly.io/docs/reference/suspend-resume/) |
| Wasmer Edge | WASIX in Wasmer's own runtime | Closed hosted platform: "distributed monolith", "shared nothing" nodes; no external control plane | InstaBoot snapshots; remote sessions "do not persist after the connection is closed" (https://docs.wasmer.io/edge/architecture, https://docs.wasmer.io/edge/learn/remote-sessions) |
| Deno Sandbox | Linux microVMs | API-driven from `@deno/sandbox`, orchestrated by Deno Deploy | `allowNet`; "secrets never enter the sandbox", substituted on outbound requests to approved hosts; Deno Deploy "will be sunset in April 2027" (https://docs.deno.com/sandbox/) |
| GitHub self-hosted runners | Whatever the host gives | Runner connects out to GitHub for jobs (HTTPS 443) | (https://docs.github.com/en/actions/reference/runners/self-hosted-runners) |

No source describes a pool of WASIX environments that registers itself with Durable Objects; the
closest shapes are Cloudflare's DO-owned container (the DO as the only door) and Daytona's polling
runners (compute dials the control plane).

## Sketch: attaching a pool to the harness (inference)

1. **Executor host** (Node with `@wasmer/sdk`, or Rust with `wasmer-wasix` for per-instance
   limits): one process per tenant, many sandboxes per process. It reuses `PROTO`'s engine and
   host-fs protocol (`src/wasmer/engine.mjs`, `host-fs.ts`), replacing the pipe to the Agent cell
   with a lease connection; packages and bundles are cached by hash.
2. **Pool DO**: registry and leases as in §3; alarms expire leases; it never sees file data.
3. **Workspace DO**: gains a token-checked WebSocket route that carries `FsRequest`s to `fsCall`
   (and so the files-RPC chunks), plus a `time` fact in the authorizer for lease expiry.
4. **Agent DO / Flue adapter**: a `sandbox: "pool"` option beside `just-bash` and `wasmer`, with
   the same Flue `Sandbox` shape `flueSandboxOnWasmer` already implements
   (`PROTO/src/wasmer/flue-sandbox.ts:24-75`); `exec` goes over the lease connection, `read`,
   `write` and `edit` stay on the capability.
5. **Flow**: session asks Pool DO for a lease → Agent DO attenuates the session token (paths,
   expiry) → executor receives `{lease, workspace, token, bundles}` → builds a sandbox with
   `/workspace` mounted on the capability → runs commands, streaming output to the Agent DO →
   lease ends, mount dropped, token revoked or expired.

| | In-DO engines (Wasmer/Pyodide on cellb, just-bash) | Worker Loader isolates | External Wasmer pool |
|---|---|---|---|
| Runs on Workers / CellD | just-bash yes; Wasmer and Pyodide `ENOSYS` (`PROTO/README.md:559`) | yes (see `node-python-clis-in-sandbox.md`) | yes, over the network |
| Real `bash`, CPython, `node` | cellb only | JavaScript only | yes |
| File access latency | local (pipe or in-process) | in-runtime RPC | WAN round trip per uncached operation |
| Isolation | WASIX inside the runtime's process | V8 isolate, `globalOutbound: null` | WASIX + per-tenant process or microVM |
| Operations | none extra | none extra | servers, autoscaling, upgrades, a second trust domain |
| Cost when idle | none | none | executors keep running (or scale to zero slowly) |

## Open questions

- How many sandboxes, and how many concurrent file requests, does one `@wasmer/sdk` Node process
  hold before memory or the host-fs bridge saturates? Wasmer's benchmark is sequential; we need a
  concurrency measurement on our host-fs path.
- Node SDK or Rust? Rust gives per-instance memory and CPU limits and native compilation, but its
  SDK crate is not published yet and the host-fs bridge would need porting from `PROTO`'s JS.
- `storageHost` is experimental and not in the SDK's public options (`PROTO/README.md:528-532`):
  does Wasmer intend to make an embedder file system public, and with an async variant that
  suits a network round trip?
- Who dials whom on browser CellB: the page's DO dialling the executor over `wss://`, or httpeers'
  relay? Both need the executor reachable with TLS.
- Lease token shape: attenuation with a `time` check needs an authorizer change; is a lease nonce
  checked by the Agent DO (as `ToolFilesEntrypoint` does) enough instead?
- Does celld's failure of `wd-websocket-hibernation` matter for a Pool DO on celld, or is a
  non-hibernating socket acceptable there?
- Scratch space: which paths are sandbox-local (fast, lost at lease end) versus on the capability
  (durable, one round trip each), and how does a session ask for that split?
- Is a self-hosted Firecracker pool (E2B's runtime, Apache-2.0) a better fit than WASIX when the
  workloads need native binaries?

## Sources

- Prototype (`statewalker-sandbox/apps/flue-capfs-do`): `README.md` (transports `:140-150`,
  routes `:75-127`, bundles `:178-190`, Wasmer `:509-602`, streaming `:697-720`),
  `src/workspace.ts:1-7,140-153`, `src/caps.ts:76-108`, `src/authority.ts:373-397`,
  `src/files-rpc.ts:1-29`, `src/worker.ts:119-215`, `src/tool-files-entrypoint.ts:1-53`,
  `src/agent.ts:274-300`, `src/wasmer/kernel.ts:1-60`, `src/wasmer/flue-sandbox.ts:24-75`,
  `package.json:42`.
- Wasmer SDK, local clone of `wasmerio/wasmer-js` at `ddbd6cd`: `README.md`,
  `js/src/index.ts:85-183,545`, `js/src/guest-memory-budget.ts:1-140`,
  `benchmarks/sandboxes/README.md`, `benchmarks/sandboxes/RESULTS-2026-09-01.md`.
- Wasmer docs: https://docs.wasmer.io/runtime/js, https://docs.wasmer.io/runtime/cli,
  https://docs.wasmer.io/runtime/features, https://docs.wasmer.io/edge/learn/instaboot,
  https://docs.wasmer.io/edge/architecture, https://docs.wasmer.io/edge/learn/remote-sessions
  (read as the `ai-docs/*.md` versions).
- Wasmer runtime repo: https://github.com/wasmerio/wasmer (`docs/journal.md`,
  `examples/tunables_limit_memory.rs`, `examples/metering.rs`,
  `lib/cli/src/commands/run/wasi.rs`); https://docs.rs/wasmer-wasix/latest/wasmer_wasix/.
- Edge.js: https://github.com/wasmerio/edgejs (README). Registry versions:
  `registry.wasmer.io/graphql` (`python/python`, `wasmer/edgejs`). npm: `@wasmer/sdk`.
- Cloudflare: https://developers.cloudflare.com/durable-objects/best-practices/websockets/,
  https://developers.cloudflare.com/durable-objects/platform/limits/,
  https://developers.cloudflare.com/containers/concepts/architecture/,
  https://developers.cloudflare.com/containers/configuration/outbound-traffic/,
  https://developers.cloudflare.com/containers/configuration/workers-connections/,
  https://developers.cloudflare.com/containers/configuration/scaling-and-routing/,
  https://developers.cloudflare.com/containers/platform/limits/,
  https://developers.cloudflare.com/containers/guides/snapshots/,
  https://developers.cloudflare.com/sandbox/,
  https://developers.cloudflare.com/sandbox/concepts/security/,
  https://developers.cloudflare.com/sandbox/sdk/concepts/architecture/,
  https://developers.cloudflare.com/dynamic-workers/.
- CellB / celld: `cellb.dev/packages/cellb/docs/services/websockets.md`,
  `cellb.dev/packages/cellb/docs/celld-compatibility.md`, `cellb.dev/packages/cellb/docs/gaps.md`,
  `cellb.dev/apps/sandbox/docs/alternatives.md`; httpeers: `httpeers/README.md`.
- E2B: https://github.com/e2b-dev/runtime (README, `docs/ARCHITECTURE.md`).
- Modal: https://modal.com/docs/guide/sandbox, https://modal.com/docs/guide/sandbox-networking,
  https://modal.com/docs/guide/security.
- Daytona: https://www.daytona.io/docs/en/architecture.md,
  https://www.daytona.io/docs/en/bring-your-own-compute.md,
  https://www.daytona.io/docs/en/regions.md.
- Fly: https://fly.io/docs/machines/, https://fly.io/docs/reference/suspend-resume/.
- Deno: https://docs.deno.com/sandbox/.
- GitHub: https://docs.github.com/en/actions/reference/runners/self-hosted-runners.
- Biscuit: https://github.com/eclipse-biscuit/biscuit/blob/main/SPECIFICATIONS.md.
- Node.js permission model: https://github.com/nodejs/node/blob/main/doc/api/permissions.md.
- Related notes: `docs/research/node-python-clis-in-sandbox.md`,
  `docs/research/flue-capfs-do-inventory.md`.
