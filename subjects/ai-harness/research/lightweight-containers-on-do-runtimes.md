# Can lightweight containers run on cellb, celld and workerd alike?

Research for `statewalker/statewalker-root#415`. Sources read and experiments run on 2026-11-24.
Every claim is marked **(verified)** (an experiment in this session), **(sourced)** (a primary
source, cited) or **(inference)** (this note's own reasoning). Builds on
`subjects/ai-harness/research/node-python-clis-in-sandbox.md` (the engines compared),
`subjects/ai-harness/research/external-wasmer-executor-pools.md` (Wasmer outside the DO) and
`subjects/runtimes/research/almostnode-on-do-runtimes.md` (an eval-based emulator on the three runtimes); what
those notes already establish is cited, not repeated.

## Question

Can Wasmer/WASIX, Lifo, QuickJS, Pyodide or another WASI runner run inside a Durable Object's
runtime on cellb (browser and Node), celld and workerd, so that a DO gets them through one field
beside `ctx.container` (`ctx.sandbox` for now) with `ctx.container`'s interface plus an
initialisation taking a FilesApi, a working path, packages or image, env and limits? Per engine and
runtime: where it runs, files, network, isolation, what runs, cost; then a sketch of the field.

## Short answer

Places: **DO** = the Durable Object's own isolate; **WL** = a Worker Loader (Dynamic Worker)
isolate; **W** = a Web Worker / worker thread / child process the host owns (cellb only).

| Engine | cellb, browser | cellb, Node | celld 0.6.3 | workerd / Cloudflare |
|---|---|---|---|---|
| **WASI runner in pure JS** (CPython 3.12 WASI under `@bjorn3/browser_wasi_shim`) | runs: DO, WL, W (sourced + inference) | **runs**: WL (verified); DO (inference: the same runner ran in plain Node 22, not in a cellb DO) | runs with conditions: DO with bundled wasm, WL with `{wasm}` modules; not run here (inference) | **runs**: DO with the wasm bundled, WL with wasm bytes supplied at run time; JSPI serves files from async storage per operation (verified) |
| **QuickJS** (`quickjs-emscripten`, sync and asyncify) | runs: DO, WL, W (sourced) | runs (sourced; `wasmer/quickjs` measured in cellb) | runs with conditions: bundled wasm or `{wasm}` modules (inference) | **runs**: DO with bundled wasm (sync and asyncify), WL with wasm bytes at run time (verified) |
| **Pyodide** (npm) | runs: W (harness, sourced) | runs: W, a child process (harness, sourced) | no as a DO engine; only Python *Workers* (fetch handlers, no DOs, no JSPI) (sourced) | no in DO or WL as a library (runtime compile and package fetch, verified for compile); only Cloudflare's own Python Workers / `py` Dynamic Workers (sourced, not run here) |
| **Wasmer** (`@wasmer/sdk`, WASIX) | runs: W, needs COOP/COEP (sourced) | runs: W (sourced) | no: needs threads (sourced) | no: needs threads; `Atomics.wait` refused, no `Worker` (verified) |
| **Lifo** (`@lifo-sh/core`) | runs: W, not a boundary (sourced) | runs: W, and `node` in a WL worker thread (verified); not a boundary | shell yes; `node` likely in DO (celld allows `eval`), not a boundary (inference) | shell only; `node` fails at request time on `new Function`, even in a WL (verified) |

- **One field on all three runtimes is feasible for the WebAssembly engines that need neither
  threads nor run-time code generation: a WASI preview 1 runner in plain JavaScript and QuickJS.**
  On workerd both ran in the DO's own isolate (wasm bundled) and in a Worker Loader isolate whose
  wasm bytes the DO produced at request time (verified). That covers `python` (CPython built for
  WASI, standard library only) and a `node`-like JavaScript (QuickJS plus our own shims). It does
  not cover real Node, `npm install` inside the sandbox, Python C-extension packages, `bash` as a
  WASIX binary, or servers inside the sandbox (WASI preview 1 has no sockets).
- **The blockers named in the ticket, settled.**
  - Wasm compiled from bytes at run time is refused in a Worker's and a DO's code
    ("Wasm code generation disallowed by embedder"), but **the Worker Loader compiles `{wasm: bytes}`
    modules handed to it at run time**, so fetched engines can still run, one isolate per load
    (verified; Cloudflare docs list `{wasm: ArrayBuffer}` as a module type, sourced).
  - **JSPI works on workerd** in a DO and in a Worker Loader isolate, at compatibility dates
    2025-01-01 and 2026-11-01 (verified). It is the way to give synchronous WASI an asynchronous,
    per-operation FilesApi without threads; asyncify (QuickJS's asyncify build) works too
    (verified).
  - No threads: `Worker` is undefined and `Atomics.wait` throws "cannot be called in this context",
    in DOs and Worker Loader isolates alike, though `SharedArrayBuffer` exists (verified). This is
    what rules Wasmer out.
  - workerd allows `eval`/`new Function` and wasm compilation **during startup** (top-level
    evaluation) since compatibility date 2025-06-01 (sourced: `allow_eval_during_startup`), never at
    request time (verified). It is not enough for Lifo: its `node` ran a script at startup but then
    failed on a timer, which the global scope refuses (verified).
- **Cost.** CPython WASI is a 26 MB module (12 MB gzipped); in Node its compiled module cost about
  50 MB of RSS, and three live instances another 65 MB; each run starts in about 90-180 ms with
  10 MB of linear memory (verified, Node 22). Against Workers' 128 MB per isolate, including Wasm
  allocations (sourced), this is tight; per-run Worker Loader isolates are the safer place
  (inference). QuickJS is 0.5 MB (sync) or 1.0 MB (asyncify) of wasm and evaluated in 90 ms
  including its load in a DO (verified).
- **Isolation.** Both engines are a WebAssembly sandbox: the guest reaches only its imports
  (inference). In the DO's own isolate a runaway guest blocks the DO: QuickJS can be interrupted
  (verified), a WASI `_start` cannot (inference). Worker Loader isolates add a separate V8 isolate,
  `globalOutbound: null` (verified to block `fetch` there) and `limits.cpuMs` on workerd and celld
  (sourced), so the sandbox's runs belong there.
- **Recommendation (inference).** Build the shared part as a runtime-neutral package: a WASI
  preview 1 host whose file calls go to a FilesApi (JSPI where available, copy-in/write-back where
  not), a QuickJS runner with a small Node shim, and a `ctx.container`-shaped facade over a Worker
  Loader. The per-runtime part is small: where the wasm bytes come from and which loader runs them.
  Keep Wasmer (and Lifo) behind `ctx.container` on cellb, where they already work, and do not
  promise them through the shared field.

## Findings

### 1. What workerd allows (verified unless marked)

Experiment: workerd `1.20261124.1` run as `workerd serve --experimental` (Worker Loader bindings
need `--experimental` locally), one Worker with a SQLite-less in-memory Durable Object `Box` and a
`workerLoader` binding; probes run from the DO's `fetch`.

```
DO isolate, at request time
  SharedArrayBuffer: function   Worker: undefined
  Atomics.wait            => ERR Atomics.wait cannot be called in this context
  new Function            => ERR Code generation from strings disallowed for this context
  WebAssembly.compile(bytes) / new WebAssembly.Module(bytes)
                          => ERR Wasm code generation disallowed by embedder
  bundled .wasm module    => instantiates, 42
  WebAssembly.Suspending / promising: function
  JSPI: wasm import awaiting ctx.storage.get() => 42

Worker Loader isolate (modules: {"g.js": …, "tiny.wasm": {wasm: <bytes made at request time>}},
globalOutbound: null)
  at startup:    new Function => 1;  new WebAssembly.Module(bytes) => ok
  after a microtask at startup: new Function => 1
  at request:    new Function => ERR Code generation …;  new WebAssembly.Module(bytes) => ERR …
                 imported {wasm} module => instantiates;  JSPI => 42
                 Atomics.wait => ERR …;  Worker: undefined
  guest fetch()  => "This worker is not permitted to access the internet via global functions like fetch()…"
```

Sources for the same rules:

- `eval()`, `new Function`, `WebAssembly.compile`, `compileStreaming`, `instantiate` with a buffer
  and `instantiateStreaming` are not allowed; "Threading is not possible in Workers … the Web Worker
  API is not supported" (cloudflare-docs `src/content/docs/workers/runtime-apis/web-standards.mdx`
  and `…/webassembly/index.mdx`, commit `6ef58e7`, 2026-11-23).
- In workerd, `allowWasmCallback` returns `evalAllowed`, so wasm compilation follows the eval
  permission; bundled wasm is compiled inside an `AllowEvalScope` (`src/workerd/jsg/setup.c++`
  lines 1376-1381, `src/workerd/io/worker-modules.h` lines 318-335). Startup runs with
  `setAllowEval(getAllowEvalDuringStartup())`, because startup is deterministic and replayable
  (`src/workerd/io/worker.c++` lines 2513-2519); the flag `allow_eval_during_startup` is on from
  2025-06-01 (`src/workerd/io/compatibility-date.capnp` lines 789-792). workerd commit `579da7a`,
  2026-11-23.
- Dynamic Worker modules: `{js}`, `{cjs}`, `{py}`, `{text}`, `{data}`, `{wasm: ArrayBuffer}`,
  `{json}`; `globalOutbound` null blocks `fetch()` and `connect()`, a `WorkerEntrypoint` gateway
  intercepts them; `limits: {cpuMs, subRequests}` per Worker or per `getEntrypoint()`; at most
  10 Dynamic Workers with in-flight requests per Durable Object
  (cloudflare-docs `dynamic-workers/api-reference.mdx`, `usage/egress-control.mdx`,
  `usage/limits.mdx`, `platform/limits.mdx`, commit `6ef58e7`).
- Limits: 128 MB per isolate "including the JavaScript heap and WebAssembly allocations"; Worker
  size 64 MiB uncompressed on both plans; startup 1 s; CPU 30 s by default, up to 5 min on Paid
  (cloudflare-docs `workers/platform/limits.mdx`, commit `6ef58e7`).

**(inference)** Production Cloudflare uses the same `allowWasmCallback` code, so the Worker Loader
route holds there; JSPI in production was not tested.

### 2. Per engine

#### WASI runner in plain JavaScript (CPython for WASI)

- **What was run.** `@antonz/python-wasi` 3.12.0 (Apache-2.0): VMware Wasm Labs' CPython 3.12.0
  build for `wasi_snapshot_preview1`, standard library inside the binary, 26,267,204 bytes. Its
  only import module is `wasi_snapshot_preview1` (verified). The host is `@bjorn3/browser_wasi_shim`
  0.4.2 (MIT OR Apache-2.0), a WASI implementation in plain JavaScript with no `eval`, threads or
  `SharedArrayBuffer` (verified by running it on workerd).
- **workerd, Worker Loader isolate (verified).** The DO copied the bytes into a new `ArrayBuffer`
  at request time (standing in for bytes fetched from R2 or a cache) and loaded
  `{"g.js": <runner>, "python.wasm": {wasm: bytes}}` with `globalOutbound: null`:
  `{"stdout":"3.12.0 42","exit":0,"files":{"in.json":…,"out.txt":"written by python"},"memMB":10,
  "runMs":190-208,"totalMs":218-242}`, and the guest's `fetch` was refused.
- **workerd, the DO's own isolate, files through JSPI (verified).** With `python.wasm` bundled as a
  wasm module, `path_open` on the preopened `/work` was wrapped in `WebAssembly.Suspending`; each
  open awaited a capability check and, for files not yet seen, a read from `ctx.storage`, and
  `_start` ran through `WebAssembly.promising`:
  `{"stdout":"FROM ASYNC STORAGE\nsecret: PermissionError 2","log":["data.txt:allow",
  "secret.txt:deny","out.txt:allow"],"ms":164,"storedOut":"py wrote this"}`. A denied open is
  `EACCES` (WASI errno 2), which Python raises as `PermissionError`. Writes went back to storage
  after the run.
- **cellb on Node (verified).** `@statewalker/cellb` 0.13.1, `loadProject` over a project with a
  `worker_loaders` binding: the same runner in a Worker Loader isolate (a worker thread) printed
  `3.12.0 42` with `globalOutbound: null` blocking `fetch`, `totalMs` 377 (a thread start
  included). In plain Node 22: `node pynode.mjs` ran it in 132 ms including compile.
- **cellb in a browser (inference).** `browser_wasi_shim` is written for browsers, and cellb's
  isolate is a Dedicated Worker; not run here (no browser in this session).
- **celld (inference, not run).** celld imports `.wasm` in bundles and accepts `{wasm: bytes}` in
  Dynamic Workers, refusing bare bytes as workerd does; it compiles each module once per process
  (`denoland/celld` `docs/wasm.md`, `docs/services/dynamic-workers.md`, `v0.6.3`, 2026-10-21).
  Its V8 has JSPI: celld hides `Suspending`, `promising` and `Suspender` from Pyodide only, because
  "under JSPI each async entry leaks C stack until the interpreter stops"
  (`crates/celld/python/shims.js` lines 42-51; `docs/services/workers.md`). Per-isolate heap is
  128 MB by default (`CELLD_V8_HEAP_LIMIT_MB`, `crates/celld/js.rs` line 2352). The celld binary
  was not reachable from this sandbox (`celld.dev/install.sh` answered 403).
- **Memory and start (verified, Node 22).** Compiling the module: 25 ms (lazy compilation),
  ~50 MB RSS. Three runs of `import json,re,collections`: 177, 100, 89 ms, 10 MB linear memory
  each; three live instances added 65 MB of RSS. **(inference)** On Cloudflare, one Python run per
  Worker Loader isolate fits 128 MB with a margin of tens of MB; several runs in the DO's own
  isolate, beside the DO's own heap, may not.
- **What runs, what does not (inference unless marked).** CPython and its pure-Python standard
  library; pure-Python packages copied onto the mounted files and put on `sys.path`. No C
  extensions beyond those built in (WASI preview 1 has no dynamic linking), no `subprocess` or
  threads, no sockets (preview 1 has none), so no `pip install` inside. The 3.12 build is from
  2023; CPython's own `wasm32-wasip1` builds are the maintained source to switch to (open question).
- **Network.** None inside the guest (no sockets in preview 1); the runner's own `fetch` is
  `globalOutbound`'s (verified null).
- **Isolation.** A wasm guest reaches memory and the imports it was given (inference). On workerd
  and celld the Worker Loader adds a V8 isolate; on cellb Node it is a worker thread in the host's
  process, which "does not take away … the platform's own APIs" (cellb `docs/security.md`,
  `bab33bf`, 2026-11-23), harmless for wasm that cannot reach JavaScript (inference).

#### QuickJS (`quickjs-emscripten`)

- **workerd (verified).** `quickjs-emscripten-core` 0.32.0 with `@jitl/quickjs-wasmfile-release-sync`
  (wasm 503 KB) bundled as a wasm module, in the DO: `[1,2,3].map(x=>x*2)` gave `2,4,6`; a
  `while(true){}` stopped with `InternalError: interrupted` from an interrupt handler; 90 ms with
  the module load. The asyncify build (1.0 MB) in the DO: a synchronous guest
  `readFileSync('/a.txt')` was served by an async `ctx.storage.get()` (`newAsyncifiedFunction`):
  `CONTENT FROM DO STORAGE len=23`. In a Worker Loader isolate with the wasm handed over as
  `{wasm: bytes}` at request time: `undefined undefined 42` for
  `typeof fetch + typeof process + 6*7` (the guest has neither).
- **Other runtimes (sourced).** "Supports browsers, NodeJS, Deno, Bun, Cloudflare Workers"; memory
  limits and interrupt handlers; asyncify is 2x the size and about 40% of the speed of the sync
  build (`quickjs-emscripten` `README.md`, 0.32.0). Inside Wasmer on cellb, `wasmer/quickjs`
  measured 17-28 MB per running sandbox and 21 ms per run in a warm pool
  (`cellb.dev/packages/containers/docs/isolated-pools.md`, Node 22).
- **What runs.** ECMAScript only; `require`, `fs`, `process` and `child_process` are what the
  embedder provides (`node-python-clis-in-sandbox.md`). No npm install inside; dependencies are
  bundled first (inference). `quickjs-wasi` 3.7.0 (QuickJS-NG for WASI, vercel-labs, npm) would run
  under the same WASI host (sourced from its npm description only; not tried).

#### Pyodide

- **Not as a library in workerd (verified for the mechanism, sourced for Pyodide).** npm Pyodide
  fetches and compiles its wasm and its packages at run time, which workerd refuses at request time
  (above); the harness reports `ENOSYS` there (`node-python-clis-in-sandbox.md`). **(inference)**
  Package wheels with C extensions are side modules compiled at load time, so even with the main
  module bundled they hit the same refusal.
- **Cloudflare's Python Workers** run Pyodide in a V8 isolate with a memory snapshot taken at
  deploy time (cloudflare-docs `workers/languages/python/how-python-workers-work.mdx`); Dynamic
  Workers accept `{py}` modules with `python_workers`, "much slower to start than JavaScript
  Workers" (`dynamic-workers/api-reference.mdx`, `getting-started.mdx`). Local test: the
  `python_workers` Worker Loader isolate failed because workerd downloads the Pyodide bundle from
  `pyodide-capnp-bin.edgeworker.net`, which is unreachable here (verified failure, not a verdict).
  **(inference)** A Python Worker is a request handler, not a sandbox API: no exec, no FilesApi
  mount, files through bindings only.
- **celld.** Python Workers are `fetch` handlers on the Pyodide 0.28 line; no Durable Objects in
  Python, no C-extension packages, JSPI hidden (`docs/services/workers.md`, v0.6.3). Its Worker
  Loader parser lists `py` as a module kind (`crates/celld/js/harness.js` line 3360); whether a
  Python Dynamic Worker runs was not checked.
- **cellb.** Runs in a module Worker (browser) or a child process under Node's permission model,
  files copied in and written back through the gate (`statewalker-ai`
  `packages/ai-environment/src/pyodide.ts` lines 1-12, `e87f2f4`, 2026-11-24).

#### Wasmer (WASIX)

- Unchanged from the earlier notes: browsers need Web Workers and `SharedArrayBuffer` with
  COOP/COEP, the FilesApi bridge blocks on `Atomics.wait`, and workerd and celld answer `ENOSYS`
  (`external-wasmer-executor-pools.md`; `cellb.dev/packages/containers/README.md`, "FilesApi in
  containers"; `statewalker-ai/packages/ai-environment/src/wasmer.ts` lines 1-12). This session
  verified the two facts behind it on workerd: no `Worker`, and `Atomics.wait` refused, in DOs and
  Worker Loader isolates.
- **(inference)** A Worker Loader isolate does not help: the SDK's scheduler needs threads, and
  WASIX binaries (`wasmer/bash`, `wasmer/coreutils`) import `wasix_32v1`, for which no
  single-threaded JavaScript host exists.
- On cellb it is the working engine behind `ctx.container`: Python, PHP, bash, `wasmer/quickjs`,
  `wasmer/edgejs` (JSPI: Node 24+, Chromium 137+); ~100 MB per Python sandbox in a shared client,
  ~275 MB per worker-isolated container (`cellb.dev/packages/containers/README.md` and
  `docs/isolated-pools.md`).

#### Lifo

- **workerd (verified).** `@lifo-sh/core` 0.10.36 bundled (2.0 MB) into a Worker Loader isolate.
  At startup (eval allowed): the shell ran and `node /home/user/h.js` printed `node says 42
  function`, then failed with "Disallowed operation called within global scope … setting a timeout
  … not allowed"; exit 1. At request time: shell fine, `node` fails with `EvalError: Code
  generation from strings disallowed`. So on workerd Lifo is a shell, as the earlier note says.
- **cellb Node (verified).** In a Worker Loader isolate (worker thread), shell and `node` work at
  startup and at request time (`node says 42 function`, exit 0), with `globalOutbound: null`.
- **celld (inference).** celld allows `eval` in the DO isolate (verified with almostnode,
  `almostnode-on-do-runtimes.md`), so Lifo's `node` likely runs there; whether celld's Worker
  Loader isolates allow `eval` is still open.
- **Isolation.** "Not a security boundary": guest JS reaches the realm's real globals
  (`cellb.dev/packages/containers/README.md`, "Isolation"). Only a Worker Loader isolate makes it
  tolerable, and only where `eval` is allowed there (cellb, perhaps celld).

### 3. Files: a FilesApi checked per operation

| Mechanism | Needs | Where it works | Status |
|---|---|---|---|
| JSPI: wrap WASI imports (`path_open`, `fd_read`, `fd_write`, …) in `WebAssembly.Suspending`, run `_start` through `WebAssembly.promising` | JSPI in the engine; no rebuild of the guest | workerd DO and Worker Loader (verified); Chromium 137+ and Node 24+ (sourced, cellb-containers README); celld's V8 has it (inference); **not Node 22** (`Suspending` undefined in cellb on Node 22.23, verified) | verified with CPython WASI on workerd |
| Asyncify (guest built with it) | a special build, 2x size | everywhere | verified with QuickJS asyncify on workerd |
| Synchronous bridge (`SharedArrayBuffer` + `Atomics.wait` from a worker) | threads | cellb only | used by cellb-containers (Wasmer, Lifo `syncHostFiles`) (sourced) |
| Copy in, run, write back through the gate | memory for the copy | everywhere | verified (CPython WASI in a Worker Loader isolate); the harness's Pyodide engine does it (sourced) |

**(inference)** JSPI suspends the whole wasm stack at each awaited call, so every file operation
becomes one FilesApi call checked by the capability, as `cellb-containers`' `FilesVolume` does
with threads. A capability RPC per `stat`/`open` costs a round trip; CPython opens many files at
start (its standard library is inside the binary in this build, so not on the FilesApi). Calls
from a Worker Loader isolate to a FilesApi binding cross RPC; on celld they cross as structured
clones only, not stubs (`statewalker-ai/packages/ai-host-do/src/tool-executor.ts` lines 9-16).

### 4. Network

- WASI preview 1 CPython and QuickJS have no network of their own; only what the runner passes
  in. The runner's `fetch` in a Worker Loader isolate follows `globalOutbound`: `null` throws
  (verified on workerd and cellb Node), a Fetcher routes it through a gateway (sourced for workerd;
  celld: the Fetcher cannot carry `connect()` or WebSockets, `docs/services/dynamic-workers.md`;
  cellb: `globalOutbound: null` replaces only `fetch`, not `WebSocket`, cellb `docs/security.md`).
- Wasmer: off unless granted; Lifo: the realm's `fetch`, guarded by cellb-containers (sourced).

### 5. What an `npm install` needs

Registry access (metadata and tarballs), tarball extraction, many file writes, and for most
packages lifecycle scripts or native builds (inference; lifo and almostnode skip scripts,
`node-python-clis-in-sandbox.md`). None of the engines that run on all three runtimes installs
packages: QuickJS has no npm, WASI CPython no `pip`. **(inference)** Install outside the
sandbox: a trusted build step with egress (cellb-containers' layered files: "install once, run
read-only"), or bundle with `@cloudflare/worker-bundler` before loading, then mount the result
read-only.

### 6. Cost summary

| Engine | Package | Start / run | Memory |
|---|---|---|---|
| CPython WASI + shim | 26 MB wasm (12 MB gzip) + 48 KB runner | 90-210 ms per run; compile 25 ms (verified) | ~50 MB compiled + ~10-20 MB per live run (verified, Node) |
| QuickJS sync / asyncify | 0.5 / 1.0 MB wasm | 90 ms incl. load in a DO (verified) | 17-28 MB per sandbox in Wasmer (sourced) |
| Lifo | 2.0 MB bundle (verified) | ~0.1 s (sourced) | ~31 MB per box (sourced) |
| Wasmer Python | SDK 5.6 MB + registry packages | 0.4-0.8 s per container (sourced) | 100-275 MB (sourced) |
| Pyodide | npm 13.9 MB | seconds cold (harness `START_MS` 120 s ceiling) | not measured |

All of these are under the 64 MiB Worker and Dynamic Worker code limits (sourced: cloudflare-docs
limits; celld `CELLD_MAX_DYNAMIC_WORKER_CODE_BYTES`, 64 MiB default).

## Sketch: a `ctx.sandbox`-style field (inference)

```ts
interface SandboxInit {
  files: FilesApi;                 // checked per operation (JSPI) or copied in and written back
  cwd: string;                     // mounted at /work in the guest
  image: { engine: "python-wasi" | "quickjs"; packages?: string[] }; // packages: read-only layers
  env?: Record<string, string>;
  limits?: { cpuMs?: number; memoryMb?: number; timeoutMs?: number; outputBytes?: number };
  network?: null | Fetcher;        // the Worker Loader's globalOutbound
}
interface Sandbox {                // ctx.container's shape, minus what WASI cannot do
  init(init: SandboxInit): Promise<void>;
  start(): Promise<void>;          // warms: fetches and caches engine bytes, loads the isolate
  exec(argv: string[], opts?: { stdin?: string; env?: Record<string, string> }):
    Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }>;
  destroy(): Promise<void>;
  // getTcpPort(): only for engines with sockets (Wasmer, Lifo on cellb); absent here
}
```

- **Shared code, one package any runtime loads** (ESM, no `eval`, wasm only as modules):
  1. a WASI preview 1 host whose file calls go to a FilesApi, with a JSPI path and a
     copy-in/write-back path chosen by feature detection (`typeof WebAssembly.Suspending`);
  2. a QuickJS runner (asyncify build for synchronous `fs`) with a small Node shim
     (`fs`, `path`, `process.argv/env/exit`, `console`);
  3. the guest module that goes into a Worker Loader isolate, and the facade that turns `exec`
     into one `LOADER.load({modules: {runner, engine: {wasm: bytes}}, globalOutbound, limits})`
     and one entrypoint call, passing the FilesApi as a binding (RPC stub on workerd and cellb;
     the token transport on celld, as the harness's isolate executor already does).
- **Per runtime:** where engine bytes come from (bundled, R2, a static asset, a cache; the
  Worker Loader caches compiled isolates by id), which loader to use (`env.LOADER` on workerd and
  celld, cellb's isolates), and on cellb an optional fast path to `ctx.container` engines for
  Wasmer and Lifo.
- **Where it lives.** The shared package needs only `@statewalker/webrun-files` (L1) and the
  Worker Loader's types, so it can sit in cellb.dev next to `@statewalker/cellb-containers`
  (private today); the new package must be published and must not depend on the cellb runtime, so a workerd or celld DO can import it; or
  as a lower-layer package if other L2 projects want it. statewalker-ai should consume it from
  `ai-environment`'s executor plan (`executors.ts`: `python` → `pyodide | wasmer | pool`) as one
  more executor kind, not own it; on workerd and celld it would become the default `python` there,
  where today the answer is `ENOSYS`.

## Open questions

- Production Cloudflare: is JSPI on, and does a 26 MB CPython module fit 128 MB and the 1 s
  startup together with the runner (not testable locally: workerd enforces neither limit)?
- celld: JSPI exposure, `eval` in Worker Loader isolates, `{py}` Dynamic Workers. Needs a run
  with the celld binary, which this sandbox could not download.
- cellb in a browser: run the same runner in its isolate worker (Chromium, with and without
  cross-origin isolation).
- A maintained CPython for `wasm32-wasip1` (CPython's own tier-2 builds) with the standard
  library on a read-only layer instead of inside the binary; how many FilesApi round trips its
  start costs through JSPI.
- POSIX programs: are WASI preview 1 builds of coreutils (uutils) and a shell good enough, or does
  `bash` stay just-bash (JavaScript) on workerd and celld?
- Per-run vs reused Worker Loader isolates: compile cost per load against cross-run leakage; the
  limit of 10 Dynamic Workers in flight per DO caps parallel runs.

## Sources

- Cloudflare docs, `github.com/cloudflare/cloudflare-docs` commit `6ef58e7` (2026-11-23),
  `src/content/docs/`: `workers/runtime-apis/web-standards.mdx`,
  `workers/runtime-apis/webassembly/index.mdx`, `workers/platform/limits.mdx`,
  `workers/languages/python/how-python-workers-work.mdx`, `dynamic-workers/api-reference.mdx`,
  `dynamic-workers/getting-started.mdx`, `dynamic-workers/usage/egress-control.mdx`,
  `dynamic-workers/usage/limits.mdx`, `dynamic-workers/platform/limits.mdx`
- workerd, `github.com/cloudflare/workerd` commit `579da7a` (2026-11-23):
  `src/workerd/jsg/setup.c++`, `src/workerd/jsg/setup.h`, `src/workerd/io/worker.c++`,
  `src/workerd/io/worker-modules.h`, `src/workerd/io/compatibility-date.capnp`,
  `src/workerd/server/workerd.capnp`; npm `workerd` 1.20261124.1
- celld, `github.com/denoland/celld` `v0.6.3` (`8702f6d`, 2026-10-21): `docs/wasm.md`,
  `docs/services/dynamic-workers.md`, `docs/services/workers.md`, `docs/security.md`,
  `crates/celld/python/shims.js`, `crates/celld/js/harness.js`, `crates/celld/js.rs`
- cellb, `statewalker/cellb.dev` `bab33bf` (2026-11-23): `packages/containers/README.md`,
  `packages/containers/docs/isolated-pools.md`, `packages/cellb/README.md`,
  `packages/cellb/docs/security.md`, `packages/cellb/src/bindings/worker-loader.ts`,
  `packages/cellb/src/isolate/host.ts`; npm `@statewalker/cellb` 0.13.1
- statewalker-ai `e87f2f4` (2026-11-24): `packages/ai-environment/src/executors.ts`, `wasmer.ts`,
  `pyodide.ts`; `packages/ai-host-do/src/tool-executor.ts`
- npm packages: `@antonz/python-wasi` 3.12.0 (https://github.com/nalgeon/python-wasi, VMware Wasm
  Labs build), `@bjorn3/browser_wasi_shim` 0.4.2, `quickjs-emscripten-core` 0.32.0 and
  `@jitl/quickjs-wasmfile-release-{sync,asyncify}` 0.32.0 (https://github.com/justjake/quickjs-emscripten),
  `@lifo-sh/core` 0.10.36, `pyodide` 314.0.8, `@wasmer/sdk` 0.19.1, `quickjs-wasi` 3.7.0, `wabt`
  1.0.39, `esbuild` 0.28.2
- Experiments (scratchpad, not committed): `scripts/host.js` (DO probes: `env`, `jspi`, `qjs`,
  `qjsasync`, `py-jspi`, `loader-*`), `scripts/pyguest.js`, `scripts/qjsguest.js`,
  `scripts/evalguest.js`, `scripts/lifoguest.js`, `scripts/pyjspi.js`, `scripts/tiny.wat`,
  `wk/config.capnp` (workerd), `cb/proj/` and `cb/run.mjs` (cellb on Node), `scripts/pynode.mjs`
  and `scripts/mem.mjs` (Node 22.23.5)
- Earlier notes: `subjects/ai-harness/research/node-python-clis-in-sandbox.md`,
  `subjects/ai-harness/research/external-wasmer-executor-pools.md`, `subjects/runtimes/research/almostnode-on-do-runtimes.md`
