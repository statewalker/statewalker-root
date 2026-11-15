# Can tools run as node and python CLIs inside the sandbox?

Research for `statewalker/statewalker-root#88` (map: `statewalker/statewalker-root#70`). Sources
read on 2026-11-15. Statements marked **(inference)** are this note's own reasoning, not a
source's claim.

## Question

Can agents run tools as `node <script>` and `python <script>` CLIs inside an agent session's
sandbox, on the capability file view (a capability-filtered webrun-files `FilesApi`), in the
browser and in isolates (CellB in a browser and on Node, CellD, Cloudflare Workers/workerd)? The
human asked to look at lifo.sh as a Node simulation to integrate. Alternatives: just-bash (used
today), Pyodide (used for Python), Wasmer/WASIX (used on cellb), WebContainers, QuickJS and other
JS-in-WASM, Deno/Node in WASM, and similar projects (almostnode, Nodebox).

For each: file system hooks onto a custom VFS/`FilesApi`, npm packages, child processes, network
(and whether it can be blocked), isolation, runtimes, licence, maturity.

## Short answer

- **Yes in the browser and on cellb's Node host; on workerd and CellD not with an in-process
  emulator.** Everything that gives real Node or CPython semantics needs either code generation
  from strings (`new Function`, used by every JS-level Node emulator, lifo included) or threads
  and `SharedArrayBuffer` (Wasmer, WebContainers, just-bash's `python3`). Workers forbid
  `eval()`, `new Function` and compiling WebAssembly from bytes
  (https://developers.cloudflare.com/workers/runtime-apis/web-standards/). On Cloudflare the
  sanctioned route is a **Dynamic Worker** (Worker Loader): run the script as its own isolate,
  JS or Python, with `globalOutbound: null` to block the network
  (https://developers.cloudflare.com/dynamic-workers/).
- **lifo.sh is a credible browser/Node Node-simulator, but not a sandbox and not for workerd.**
  It is an MIT, alpha (0.10.x, first npm release 2026-02-23) TypeScript re-implementation of a
  Linux-like OS: shell, 60+ commands, `node`, real `npm`/`npx`. Its `node` loads modules with
  `new Function` in the host realm, its own docs call its isolation "JS-level, not a security
  boundary", its outbound `fetch` passes straight to the host's, and its mount providers are
  **synchronous**, so our async `FilesApi` needs either a copy-in/write-back (as our Python engine
  does) or a `SharedArrayBuffer`+`Atomics` bridge in a Worker.
- **The cheapest real `node` and `python` on the paths we already have: Wasmer.** The prototype
  already mounts the capability as the Wasmer sandbox's `/workspace` (cellb on Node and in a
  browser). Wasmer's SDK docs compose a sandbox from `python/python` (CPython for WASIX) and
  `wasmer/edgejs` (Edge.js, Wasmer's MIT Node-compatible runtime), which export the `python` and
  `node` commands (https://docs.wasmer.io/runtime/js). Network is off unless granted.
- **just-bash already has opt-in `python3`/`python` (CPython/Emscripten in a worker thread over
  the shell's own file system) and `js-exec` (QuickJS), but only on Node, not in browsers.** It
  has a clean extension point (`defineCommand`, `customCommands`) to add `node` and `python`
  commands that delegate to any engine.
- **Not recommended:** WebContainers (browser only, one instance per page, cross-origin
  isolation required, commercial licence needed for for-profit production use); Nodebox
  (Sustainable Use License, non-commercial/internal only, last npm release April 2025).

## Findings

### lifo.sh (`@lifo-sh/core`)

- **What it is.** "A tiny Linux-like OS in TypeScript. For browsers, Node and serverless
  functions. Not a Linux distro. No WASM, no emulator, no native dependencies." It is "a
  clean-room reimplementation of the OS and Node.js APIs in TypeScript", "doesn't run native
  Linux binaries and its isolation is JS-level, not a security boundary" (https://lifo.sh/).
  Version shown on the site: "v 0.10.0 alpha"; npm `@lifo-sh/core` 0.10.31, first published
  2026-02-23, last 2026-11-11, licence MIT (npm registry; `packages/core/package.json` and the
  README's License section in https://github.com/lifo-sh/lifo at commit `330c814`, 2026-11-11).
  Built by the RapidNative team (core: Sanket Sahu).
- **How `node` runs.** "It's not an emulator — it loads your script as JavaScript in the host
  engine": each module is wrapped and "executed via `new Function`"; ESM is transformed to
  CommonJS on the fly; resolution walks `node_modules` and honours `exports`; a "completion
  model" approximates the event loop, ending the run once nothing has moved for a grace window;
  `process.exit()` throws while synchronous and silences output afterwards
  (https://lifo.sh/docs/node-runtime). Source: `packages/core/src/commands/system/node.ts`
  (`new Function('return ' + wrapped + …)`). Modules run with a global made by
  `Object.create` over the real `globalThis` (same page).
- **Node API surface.** `fs`/`fs/promises` over the VFS, `http`/`https`/`net`/`tls`/`dns`,
  `child_process` (`exec`/`execFile`/`spawn` bridged to VM commands), streams, `zlib`, `crypto`
  (hashes, `randomBytes`), `events`, `readline`, `tty`, `os` (`cpus()` returns 1 so worker-forking tools run in-band), and more
  (https://lifo.sh/docs/node-compat-modules). `child_process.execSync()` throws "not supported in
  Lifo (use exec/spawn)" (`packages/core/src/node-compat/child_process.ts`). Python and other
  native binaries are roadmap items ("Pluggable WASM runtimes so more binaries (ffmpeg, Python,
  native CLIs) run inside the VM", `ROADMAP.md` §8).
- **npm.** `npm`/`npx` fetch real packages from the registry, with a hoisting installer and
  `bin` registration (https://lifo.sh/docs/npm). The site shows Vite, Expo and a
  Supabase-compatible backend running unmodified (https://lifo.sh/).
- **File system and our `FilesApi`.** The VFS is an in-memory tree, "synchronously at the core
  level", with providers mounted at a path prefix; `NativeFsProvider` backs a subtree with a host
  directory "and can also take a custom `NativeFsModule`"
  (https://lifo.sh/docs/filesystem, https://lifo.sh/docs/browser-vs-node). The provider
  interfaces are synchronous: `VirtualProvider.readFile(subpath): Uint8Array`, `stat`,
  `readdir`, and `MountProvider.writeFile/unlink/mkdir/rmdir/rename/copyFile` all return values,
  not promises (`packages/core/src/kernel/vfs/types.ts`); `NativeFsModule` is `readFileSync`,
  `writeFileSync`, `statSync`, … (`packages/core/src/kernel/vfs/providers/NativeFsProvider.ts`).
  The VFS also emits watch events and offers `dumpChanges`/`applyChanges`/`watchChanges` for
  syncing (https://lifo.sh/docs/filesystem).
  **(inference)** A `FilesApi` is async (and ours goes over RPC with a capability check per
  call), so it cannot be a lifo provider directly. Two ways: (a) copy the readable tree in, run,
  then write back the VFS changes through the capability (what our Pyodide engine does,
  `apps/flue-capfs-do` README, "Python"); (b) run lifo in a Worker and implement
  `MountProvider` with a blocking `SharedArrayBuffer`+`Atomics.wait` call to the thread that
  holds the capability (what our Wasmer engine does in browsers). (b) needs cross-origin
  isolation in a browser and is impossible on workerd.
- **Commands and integration with just-bash.** A lifo command is `(ctx) => Promise<number>`
  over `args`, `env`, `cwd`, `vfs`, `stdout`, `stderr`, `stdin`, `signal`; `sandbox.commands.register`
  adds one; `sandbox.commands.run(cmd, {cwd, env, signal, timeout, stdin, onStdout})` returns
  `{stdout, stderr, exitCode}` (https://lifo.sh/docs/commands, https://lifo.sh/docs/sandbox-api).
  **(inference)** So `node` in just-bash is a just-bash `defineCommand("node", …)` that hands
  `args`, `cwd`, `env` and stdin to a lifo box (per session, in a Worker), and returns its
  result. A `child_process.spawn("ls")` inside the script then runs lifo's own coreutils, not
  just-bash's; to keep one shell, register lifo commands that forward back to just-bash's
  `ctx.exec`. Precedent in the other direction: almostnode uses just-bash as its shell (below).
- **Network.** Outbound HTTP inside the VM goes through `makeProxyingFetch(realFetch, env)`,
  which rewrites only a list of non-CORS hosts to a CORS proxy and passes every other request to
  the host's `fetch` (`packages/core/src/node-compat/proxy-fetch.ts`); there is no allow-list
  option in `SandboxOptions` (`packages/core/src/sandbox/types.ts`). In-VM servers listen on a
  per-box virtual port registry (https://lifo.sh/docs/networking).
  **(inference)** Blocking the network means running lifo where `fetch`, `WebSocket` and
  friends are removed from the global scope (a Worker, as our Python engine does), since guest
  code shares the host realm.
- **Isolation.** "Not a security boundary against the JS engine itself — untrusted code runs in
  your JS runtime … for hard multi-tenant isolation run each box in its own process
  (server-side) or tab (client-side)"; boxes share no files, ports or processes
  (https://lifo.sh/docs/untrusted-code). An isolating binary and an off-main-thread (Web Worker)
  VM are roadmap items (`ROADMAP.md` §§ on the binary and §10).
- **Where it runs.** Browser tab and Node today; the "edge-first bash" guide says the shell and
  coreutils run in "Cloudflare Workers, Vercel Edge, Deno", with "no host filesystem, no child
  processes" there (https://lifo.sh/docs/edge-bash). **(inference)** Its `node` command does not
  run on workerd, which rejects `new Function`
  (https://developers.cloudflare.com/workers/runtime-apis/web-standards/); in a browser it needs
  `'unsafe-eval'` in the CSP of whatever realm runs it, which our Python engine's CSP forbids
  (`apps/flue-capfs-do` README, "Python").
- **Maturity.** Alpha label, nine months of npm history, frequent releases; single shallow
  clone shows a monorepo with `core`, `cli`, `ui` and command packages. Benchmarks are the
  vendor's own (https://lifo.sh/, `bench/COMPARISON.md`).

### just-bash (used today)

- Apache-2.0, 3.6.0 in our lockfile and on npm (`vercel-labs/just-bash`).
- **Extension point.** `defineCommand(name, async (args, ctx) => ({stdout, stderr, exitCode}))`
  passed as `customCommands` or added with `bash.registerCommand()`; the context has `fs`,
  `cwd`, `env`, `stdin`, `limits` and `exec` for subcommands; `trusted: false` selects a
  restricted boundary (`README.md` "Custom Commands").
- **Built-in runtimes, opt-in.** `python3`/`python` ("CPython compiled to WASM", `python: true`),
  `js-exec` (JavaScript/TypeScript on QuickJS through the `run` package, `javascript: true`, 64
  MB memory limit, `require` of `fs`, `path`, `child_process.execSync/spawnSync`, …), and
  `sqlite3`; all three "require Node.js and are unavailable in browsers" (`README.md`
  "Optional Capabilities", "Browser Support"). The Python worker runs a fresh CPython/Emscripten
  instance per run, gets a `SharedArrayBuffer` and reaches the shell's files as `HOSTFS`; "`import
  js` fails … `os.system()` is patched to no-op" (`dist/commands/python3/worker.d.ts`). There is
  no `node` command: `js-exec script.js` is the nearest.
- **Network.** Off by default; when enabled, URL-prefix and method allow-lists, with header
  injection so secrets never enter the sandbox (`README.md` "Network Access").
- **Isolation.** "All execution happens without VM isolation"; `js-exec` guest code runs inside
  QuickJS/WASM, not the Node realm; Node worker `resourceLimits` do not cap CPython's WASM memory
  (`README.md` "Security Model").
- **(inference)** On cellb's Node host, turning on `python: true` gives `python3 script.py` over
  the same `CapFs` the shell uses, with no copy-in; whether `CapFs`'s RPC-backed calls hold up
  under the worker's blocking bridge needs a test.

### Pyodide (used for Python)

- MPL-2.0; npm `pyodide` 314.0.8 (2026-11-13); the prototype pins 314.0.7.
- **File system.** Emscripten's FS; mount IDBFS, NODEFS, PROXYFS, WORKERFS, or a
  `FileSystemDirectoryHandle` with `pyodide.mountNativeFS()`
  (https://pyodide.org/en/stable/usage/file-system.html). Custom Emscripten FS types are
  synchronous, as in lifo. The prototype copies the readable tree into `/workspace`, offers live
  `capfs` calls, and writes changes back through the capability (`apps/flue-capfs-do` README,
  "Python").
- **CLI semantics.** The JS API exposes `runPython`/`runPythonAsync`, `setStdin`/`setStdout`,
  `loadPackage` and micropip (https://pyodide.org/en/stable/usage/api/js-api.html).
  **(inference)** `python script.py` is a small wrapper: set `sys.argv`, run the file with
  `runpy.run_path`, map `SystemExit` to the exit code.
- **Constraints.** `multiprocessing`, `threading` and `sockets` import but do not work; HTTP goes
  through the browser's `fetch` with CORS (https://pyodide.org/en/stable/usage/wasm-constraints.html).
  No `subprocess`.
- **Runtimes.** Browser Worker and Node (the prototype); on workerd the prototype reports
  `ENOSYS` because workerd does not compile fetched WebAssembly. Cloudflare's own Python Workers
  run Pyodide inside a V8 isolate (https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/),
  and Dynamic Workers accept Python modules with the `python_workers` flag
  (https://developers.cloudflare.com/dynamic-workers/llms-full.txt, "Supported languages").

### Wasmer / WASIX, Edge.js and `python/python` (used on cellb)

- `@wasmer/sdk` 0.19.1 (npm latest; the prototype pins it), "Modified MIT": MIT plus a duty to
  display "Wasmer" in products above 1M MAU or $1M monthly revenue (`LICENSE` in the package).
- **Commands.** The SDK composes a sandbox from registry packages; the docs' example combines
  `python/python@=3.13.18` and `wasmer/edgejs@0.2.0` and runs `python -c …` and `node -e …`;
  `sandbox.fs` reads and writes `/workspace`; network "is disabled unless the sandbox is given a
  network capability" (`mode: 'host'` on Node, a WISP WebSocket proxy in browsers); browsers need
  Web Workers, `SharedArrayBuffer` and COOP/COEP (https://docs.wasmer.io/runtime/js). Registry
  latest: `wasmer/edgejs` 0.2.5 (2026-09-30), `python/python` 3.13.20 (2026-09-11) (Wasmer
  registry GraphQL). WASIX wheels exist at https://python-registry.wasix.org/.
- **Edge.js.** Open-sourced 2026-03-17, MIT: a Node-compatible runtime on N-API with WASIX
  sandboxing system calls in `--safe` mode; pluggable engine (V8, JavaScriptCore, QuickJS);
  "~5–30% of Node.js native speed" when sandboxed; it targets Node v24 and publishes per-module
  Node test pass rates against Bun and Deno (e.g. `node:fs` 342/342, `node:child_process`
  148/148, with legacy V8-internals tests skipped); startup is slower than Node for lack of
  snapshots (https://wasmer.io/posts/edgejs-safe-nodejs-using-wasm-sandbox,
  https://github.com/wasmerio/edgejs `README.md`, `LICENSE`). The WASIX package imports N-API
  from the host or embeds QuickJS (`quickjs-wasm/`) (same README).
- **File system.** The prototype mounts the capability as `/workspace` through the SDK's
  experimental `storageHost(mount)`, a synchronous bridge (Node: pipes from a file thread;
  browser: `SharedArrayBuffer`); runs have no network and no package fetch after start; workerd
  and CellD: `ENOSYS`, "Wasmer needs threads and shared memory" (`apps/flue-capfs-do` README,
  "Wasmer").
- **(inference)** Adding `python/python` and `wasmer/edgejs` to `WASMER_PACKAGES` is the
  shortest path to real `node script.js` and `python script.py` over the capability on cellb
  (Node and browser). npm installs inside it write thousands of files, each a round trip to the
  Agent cell, which the prototype already calls slow.

### WebContainers (StackBlitz)

- A WASM build of Node in the browser tab; `mount(tree)`, an `fs.promises`-like `fs`,
  `spawn(command, args)`; "Only a single instance of WebContainer can be booted concurrently"
  (https://webcontainers.io/api). Needs `SharedArrayBuffer` and COOP/COEP
  (https://webcontainers.io/guides/quickstart). Browser only.
- **Licence.** `@webcontainer/api` is MIT on npm (1.6.4), but "Licensing is required for
  production usage of the API in a commercial, for-profit setting (Prototypes or POCs do not
  require a commercial license)" (https://webcontainers.io/enterprise); "always free for Open
  Source" (https://webcontainers.io/guides/introduction).
- No custom file system backend: files are mounted as a tree or snapshot
  (https://webcontainers.io/api). **(inference)** Ruled out for our harness: browser only, one
  per page, no `FilesApi` hook, licence terms.

### QuickJS in WASM (`quickjs-emscripten`, and just-bash's `run`)

- MIT, 0.32.0; "Supports browsers, NodeJS, Deno, Bun, Cloudflare Workers"; memory limits and
  interrupt handlers; a custom module loader; the **asyncify** build lets "a synchronous call in
  C … wait for an asynchronous operation in [host] JS", one suspension at a time, at 2x size
  (https://github.com/justjake/quickjs-emscripten `README.md`). On Workers the WASM module must
  be imported, not compiled from bytes (same README, "Cloudflare Workers").
- It is a JS engine, not Node: `fs`, `process`, `require` and `child_process` are what the
  embedder provides. just-bash's `js-exec` is such an embedding (via `run`, Apache-2.0).
- **(inference)** Asyncify is the one mechanism that gives a guest synchronous
  `fs.readFileSync` over our async `FilesApi` **without** threads or `SharedArrayBuffer`, so it
  is the only in-process `node`-like option for workerd and CellD; Node compatibility would be a
  small shim set, far below lifo's.

### Node or Deno compiled to WASM

- Wasmer reports that Node-WASIX "succeeded in compiling and running V8 inside Wasm" but with
  "significant performance cost because V8 is running in interpreter mode", which is why Edge.js
  runs the engine natively and sandboxes only system calls
  (https://wasmer.io/posts/edgejs-safe-nodejs-using-wasm-sandbox). No source read here offers a
  Deno build for the browser or workerd; Deno and LLRT are listed there as other runtimes, not
  embeddable sandboxes.

### Similar projects

- **almostnode** (`macaly/almostnode`, MIT, npm 0.2.14, last publish 2026-02-14): "Node.js in
  your browser", emulating Node 20 APIs, npm installs, `bin` stubs, Vite/Next dev servers,
  optional Web Worker, a cross-origin sandbox recommended for untrusted code; its shell is
  just-bash; "experimental and may contain bugs" (`README.md`; npm dependencies list
  `just-bash ^2.7.0`).
- **Nodebox** (CodeSandbox): a Node-compatible browser runtime; no N-API, no synchronous
  `exec`/`spawn`, no external sockets; uses a runtime hosted on CodeSandbox servers by default;
  "Sustainable Use License" limits use to "internal business purposes or … non-commercial or
  personal use"; npm `@codesandbox/nodebox` 0.1.9, last modified 2025-04-29
  (https://github.com/codesandbox/nodebox-runtime `README.md`, `LICENSE`).
- **Cloudflare Dynamic Workers** (Worker Loader): run code given at runtime as its own Worker,
  JS (ESM/CJS), Python or Wasm modules; npm dependencies are bundled first with
  `@cloudflare/worker-bundler`; `globalOutbound: null` blocks the network or a gateway
  intercepts it; bindings decide what it can reach ("capability-based sandboxing"); custom CPU
  limits; Workers Paid plan only, priced per Worker created daily, requests and CPU
  (https://developers.cloudflare.com/dynamic-workers/, `llms-full.txt`: "Supported languages",
  "Egress control", "Bindings", "Pricing").

### Comparison

| Option | FS onto our `FilesApi` | npm | child processes | network, blockable | isolation | browser | Node (cellb) | workerd / CellD | licence | maturity |
|---|---|---|---|---|---|---|---|---|---|---|
| lifo | sync providers: copy-in/out, or SAB bridge in a Worker | real registry | async only, to lifo commands | host `fetch`; block by removing globals | JS-level, host realm, `new Function` | yes | yes | shell only; `node` no | MIT | alpha, 2026 |
| just-bash `python3` / `js-exec` | the shell's own fs (`CapFs`) | no | `js-exec`: sync, to the shell | allow-lists | CPython/QuickJS WASM in a worker | no | yes | no | Apache-2.0 | stable lib, 3.x |
| Pyodide | Emscripten FS (sync): copy-in/out today | micropip (pure Python, Pyodide wheels) | no | `fetch`; block by removing globals | WASM, in our Worker/child | yes | yes | Dynamic Worker (Python) only | MPL-2.0 | mature |
| Wasmer + `python/python` + Edge.js | `storageHost` (sync bridge), working | real npm in Edge.js | in WASIX | off unless granted | WASIX sandbox | yes (COOP/COEP) | yes | no | Modified MIT / MIT | SDK mature; Edge.js 0.2, 2026 |
| WebContainers | mount tree only | yes | yes | yes | browser tab | yes | no | no | commercial for production | mature |
| quickjs-emscripten | embedder-defined; asyncify allows sync-over-async | no (bundle first) | embedder | embedder | WASM | yes | yes | yes | MIT | mature |
| Dynamic Workers | bindings (a FilesApi binding) | bundled | no | `globalOutbound` | separate V8 isolate | no | no | workerd on Cloudflare (Paid) | proprietary service | GA docs |
| almostnode | own sync VFS | yes | via just-bash | not documented | cross-origin iframe | yes | no | no | MIT | experimental |
| Nodebox | own | yes | async only | limited | hosted iframe | yes | no | no | Sustainable Use | stale |

## Recommendation (inference)

In priority order of runtimes:

1. **cellb on Node and in a browser: Wasmer first.** Add `python/python` and `wasmer/edgejs` to
   the allowed Wasmer packages so `python script.py` and `node script.js` run on `/workspace` =
   the capability, with no network and the per-run sandbox we already have. Expose them to the
   just-bash shell as `defineCommand("node"|"python", …)` that run one Wasmer command and return
   its result, so agents keep one shell. Spike: does Edge.js 0.2 under `@wasmer/sdk` 0.19 run
   common tool scripts (`fs`, `path`, `child_process.spawn`), and how slow is an `npm install`
   over the bridge (consider a per-session package cache outside the capability).
2. **Python where Wasmer is not wanted: keep Pyodide**, add a `python` command wrapper
   (`sys.argv`, `runpy`, exit code) over the existing engine; on Node, try just-bash's own
   `python: true` over `CapFs` as the lighter option.
3. **Browser without cross-origin isolation, or a light `node`: lifo as an option, in a
   Worker.** Run one lifo box per session in a module Worker with network and storage globals
   removed, files synced in and changes written back through the capability (like Pyodide), and
   `node`/`npm`/`npx` forwarded from just-bash. Watch the roadmap items that would change this:
   the Worker-hosted VM, async or pluggable backends, and Python. Do not treat it as an isolation
   boundary, and do not run it in a realm whose CSP forbids eval.
4. **workerd and CellD: Dynamic Workers for real code; QuickJS (asyncify) for an in-process
   `node`-lite.** On Cloudflare, run `node script.js` / `python script.py` as a Dynamic Worker
   whose only binding is a capability-scoped `FilesApi` RPC and `globalOutbound: null`; this
   gives no synchronous `fs` and no `child_process`, so it fits tools written against an async
   API rather than arbitrary CLIs. For CellD (no Worker Loader), a QuickJS-asyncify `node` with a
   small `fs`/`path`/`process` shim over the `FilesApi` is the only in-process route; otherwise
   report `ENOSYS` as Python and Wasmer do today.

## Open questions

- Does CellD (or cellb's workerd-compatible mode) offer anything like the Worker Loader, so
  Dynamic-Worker style tool runs work off Cloudflare?
- Edge.js under the browser SDK: is a host N-API engine available there, or only the embedded
  QuickJS package, and how compatible is that build?
- Can lifo's `VFS` take an async-backed provider in its planned "choose the backing store"
  work (roadmap), which would remove the copy-in step?
- npm installs inside the sandbox: where does `node_modules` live (capability, per-session
  scratch, shared cache), and who allows registry access when the run itself has no network?
- Is `'unsafe-eval'` acceptable in a dedicated, network-less Worker for lifo, given the
  prototype's rule that engines run without code generation from strings?

## Sources

- lifo: https://lifo.sh/, https://lifo.sh/docs, https://lifo.sh/docs/filesystem,
  https://lifo.sh/docs/node-runtime, https://lifo.sh/docs/node-compat-modules,
  https://lifo.sh/docs/npm, https://lifo.sh/docs/networking, https://lifo.sh/docs/commands,
  https://lifo.sh/docs/sandbox-api, https://lifo.sh/docs/untrusted-code,
  https://lifo.sh/docs/agent-sandbox, https://lifo.sh/docs/edge-bash,
  https://lifo.sh/docs/browser-vs-node; source https://github.com/lifo-sh/lifo at `330c814`
  (`README.md`, `ROADMAP.md`, `packages/core/package.json`,
  `packages/core/src/kernel/vfs/types.ts`,
  `packages/core/src/kernel/vfs/providers/NativeFsProvider.ts`,
  `packages/core/src/commands/system/node.ts`, `packages/core/src/node-compat/child_process.ts`,
  `packages/core/src/node-compat/proxy-fetch.ts`, `packages/core/src/sandbox/types.ts`); npm
  `@lifo-sh/core`
- just-bash 3.6.0 package (`README.md`, `dist/commands/python3/worker.d.ts`, `package.json`):
  https://github.com/vercel-labs/just-bash; npm `run` (https://github.com/vercel-labs/run)
- Pyodide: https://pyodide.org/en/stable/usage/file-system.html,
  https://pyodide.org/en/stable/usage/wasm-constraints.html,
  https://pyodide.org/en/stable/usage/api/js-api.html; npm `pyodide`
- Wasmer: https://docs.wasmer.io/runtime/js,
  https://wasmer.io/posts/edgejs-safe-nodejs-using-wasm-sandbox,
  https://github.com/wasmerio/edgejs (`README.md`, `LICENSE`), https://python-registry.wasix.org/,
  Wasmer registry (`registry.wasmer.io/graphql`), `@wasmer/sdk` 0.19.1 `LICENSE`
- WebContainers: https://webcontainers.io/guides/introduction,
  https://webcontainers.io/guides/quickstart, https://webcontainers.io/guides/browser-support,
  https://webcontainers.io/api, https://webcontainers.io/enterprise
- quickjs-emscripten: https://github.com/justjake/quickjs-emscripten (`README.md`)
- almostnode: https://github.com/macaly/almostnode (`README.md`); npm `almostnode`
- Nodebox: https://github.com/codesandbox/nodebox-runtime (`README.md`, `LICENSE`); npm
  `@codesandbox/nodebox`
- Cloudflare: https://developers.cloudflare.com/workers/runtime-apis/web-standards/,
  https://developers.cloudflare.com/dynamic-workers/,
  https://developers.cloudflare.com/dynamic-workers/llms-full.txt,
  https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/
- Our prototype: `statewalker-sandbox/apps/flue-capfs-do/README.md` (sections "Python",
  "Wasmer") and `package.json`
