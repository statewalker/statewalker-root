# Does almostnode run on CellD and workerd?

Research for `statewalker/statewalker-root#92`. Sources read on 2026-11-15. Statements marked
**(inference)** are this note's own reasoning, not a source's claim or an experiment's output.
Builds on `subjects/ai-harness/research/node-python-clis-in-sandbox.md`, which lists almostnode as experimental,
untested, with just-bash as its shell. This note covers only what is new.

## Question

Does almostnode (`macaly/almostnode`, npm `almostnode`) run in a Durable Object on workerd
(wrangler), on CellD and on cellb in Node, and could it be an alternative to Wasmer, or sit beside
it, for running `node`-style code in an agent session's sandbox? The ticket asks about its shell,
`node` and npm, file system hooks onto our capability FilesApi, network, isolation, and what it
needs from the host.

## Short answer

- **workerd (wrangler 4.158.0): it loads, but `node` does not run.** The bundle builds (3.1 MiB,
  657 KiB gzip), `createContainer()` works, and just-bash commands (`echo`, `ls`) run. Any
  JavaScript execution fails with `EvalError: Code generation from strings disallowed for this
  context`, because almostnode runs every module through direct `eval`. `npm install` itself
  works, but the installed package cannot be `require`d. This is the same in a Worker and in a
  Durable Object.
- **CellD 0.6.0 and cellb on Node: it runs.** `node /h.js`, `npm install is-odd` followed by
  `require('is-odd')`, and the shell all work inside a Durable Object. This corrects the earlier
  note's "not on CellD with an in-process emulator": CellD (Deno-based) allows `eval`.
- **It is not a security boundary on any of the three.** Guest code shares the host's JavaScript
  realm. In our probes it:
  - imported the real `node:os` on cellb/Node and on a plain Node host;
  - imported `cloudflare:workers` on CellD and read the Durable Object's `env` (its bindings);
  - used the host's `fetch`;
  - set globals the host then saw.

  Two containers in one realm also share one shell file system: container A's `ls /` listed
  container B's files. almostnode's own answer to isolation is a cross-origin iframe or a Web
  Worker, and DO runtimes have neither.
- **The FS is synchronous and in memory only.** `VirtualFS` is a `Map` tree with `*Sync` methods,
  and the `fs` shim and the `require` loader call them synchronously. An async FilesApi can only
  be copied in before a run and synced back afterwards (snapshot plus change events). It cannot
  sit underneath as live storage.
- **Network is the host's.** Guest `fetch` and the `http` shim call `globalThis.fetch`. npm
  packages come from `registry.npmjs.org` at run time. There is no allow-list. Blocking means
  removing the network from the realm, which also blocks npm.
- **Verdict (inference):** almostnode is not a replacement for Wasmer as a sandbox. It is unusable
  on workerd. On CellD and cellb it is only acceptable for trusted code, or inside a separate
  isolate such as a Worker Loader isolate with `globalOutbound: null`. In that set-up, the FS
  snapshot would have to be passed in and out. MIT licence, about three weeks of activity
  (2026-01-27 to 2026-02-14), and no commits since.

## Findings

### What it is, from the source

Repository at `6ab61f3` (2026-02-14), npm 0.2.14. The source points behind each claim are listed
below.

- **Execution is direct `eval` of a CommonJS wrapper.** `Runtime` builds
  `(function($exports, $require, $module, …){ … globalThis.process = $process; … })` and calls
  `eval(wrappedCode)` (`src/runtime.ts` lines 755-776 and 1317). The REPL uses a
  `GeneratorFunction` built from a string (`src/runtime.ts` line 1436). The wrapper assigns
  `globalThis.process`, so the host's `process` is replaced by the shim. In the plain-Node
  experiment, the host's own `process.exit(0)` afterwards threw `Error: Process exited with code 0`
  from the shim.
- **Shell.** `child_process` creates one just-bash `Bash` with `fs: VirtualFSAdapter`,
  `customCommands: [nodeCommand, npmCommand]`, and no `network` option (`src/shims/child_process.ts`
  lines 363-373). As a result, just-bash's `curl` is absent ("bash: curl: command not found").
- **One shell per realm.** The `Bash`, its adapter and `currentVfs` are module-level variables
  (`src/shims/child_process.ts` lines 34-36). Each `createContainer()` re-initialises them, so the
  last container created owns every container's shell (experiment below).
- **`node` takes only a script path.** `nodeCommand` treats `args[0]` as a file
  (`src/shims/child_process.ts` lines 121-133). `node -e '…'` answers
  `Error: Cannot find module '/-e'`.
- **Async scripts.** If a script prints nothing synchronously, `node` registers
  `globalThis.addEventListener('unhandledrejection', …)` (line 254). It then polls until output is
  idle for 500 ms, with a 60 s cap. A host without `addEventListener` (Node, cellb on Node) gets
  `node: globalThis.addEventListener is not a function`, while the script keeps running in the
  background. **(inference)** There is no real event loop to wait on: a script that is silent for
  more than 500 ms is treated as finished.
- **npm.** `Registry` fetches metadata from `https://registry.npmjs.org`, overridable with
  `registry` (`src/npm/registry.ts` line 40). Tarballs come over plain `fetch`
  (`src/npm/tarball.ts` line 197), and `bin` stubs go in `/node_modules/.bin`. No lifecycle
  scripts run. **(inference)** That is safer, but packages with native or postinstall steps break.
  The ESM-to-CJS step loads esbuild-wasm from `esm.sh`/`unpkg.com` at run time, in browsers only;
  elsewhere it logs "Skipping esbuild init (not in browser)" (`src/transform.ts` lines 20-55,
  `src/config/cdn.ts`).
- **Network.** The `http` client shim calls `fetch(fetchUrl)`, through an optional CORS-proxy
  prefix (`src/shims/http.ts` lines 640-670, `src/cors-proxy.ts`). The README itself warns about
  the sandbox: "Network requests from the sandbox are still possible. Add CSP headers"
  (`README.md`, "What cross-origin sandbox protects").
- **Isolation as designed.** `createRuntime()` refuses to run unless it gets either a cross-origin
  `sandbox` URL (an iframe plus postMessage) or `dangerouslyAllowSameOrigin` (main thread, or
  `useWorker` in a Web Worker via comlink). The README labels `createContainer()`/`execute()`
  "Do not use … with untrusted code" (`README.md`, "Security Modes", "Basic Usage").
- **Host needs** (the earlier note asked about these):

  | Need | Required? | Notes |
  |---|---|---|
  | `eval` / `new Function` | Yes, for everything except the shell | |
  | Web Workers | Optional | `useWorker` |
  | iframes and service workers | Optional | Only for the cross-origin sandbox and the dev servers (`/__virtual__/<port>/`) |
  | `SharedArrayBuffer`/`Atomics` | No | No use in `src/` (grep) |
  | DOM | No | Except `window.__esbuild` in `src/transform.ts` and the dev servers |
  | Synchronous FS | Yes | Its own in-memory one |

### Experiment setup

Everything ran under the scratchpad (`an-exp/`):

- `npm install almostnode@0.2.14 --ignore-scripts`; just-bash resolved to 2.14.5;
- Node v22.23.4;
- one Worker project (`wrangler.jsonc`, `nodejs_compat`, a SQLite-backed Durable Object `Session`)
  whose `fetch` runs one probe step, served unchanged by wrangler, CellD and cellb.

### (a) Plain Node script

```
execute exports = hi function                       # container.execute(fs + path) works
node /hello.js a b => {"stdout":"hello v20.0.0 linux a,b\n","exitCode":0}
node hello.js && echo done && ls / => {"stdout":"hello v20.0.0 linux \ndone\nhello.js\n",...}
cat /hello.js | wc -c => {"stdout":"96\n",...}
curl -s https://example.com => {"stderr":"bash: curl: command not found\n",...}
node -e 'console.log(1+1)' => {"stderr":"Error: Cannot find module '/-e'\n","exitCode":1}
npm.install left-pad 88 ms; node /lp.js => "....x"
npm install is-odd (via shell) => "Installed 2 packages"; node /odd.js => "is-odd(3)= true"
host sees guest global __leak = set-by-guest ; host globalThis.process is real? false
guest: new Function('s','return import(s)')('node:os') => "ESCAPED: real host hostname = vm"
two containers: A.run("ls /") => "only-in-B.txt"   # A's shell sees B's file system
nanoid@5 (ESM-only): require => TypeError: Cannot read properties of undefined (reading 'getRandomValues')
.mjs with top-level import => SyntaxError: Unexpected identifier 'console'
```

### (b) workerd via `wrangler dev` (4.158.0)

`wrangler deploy --dry-run`: `Total Upload: 3133.56 KiB / gzip: 656.99 KiB`, with no build errors.
The Worker and the Durable Object answer identically:

```
exec   => EvalError: Code generation from strings disallowed for this context
            at Runtime.execute (.../index.js:75665:27)
eval   => EvalError: Code generation from strings disallowed for this context
fn     => EvalError: … at new Function (<anonymous>)
run    => {"stdout":"hi\n","stderr":"","exitCode":0}        # just-bash alone works
node   => {"stderr":"Error: Code generation from strings disallowed for this context\nEvalError: …
            at Runtime.runFile …","exitCode":1}
npm    => added ["is-odd","is-number"] in 205 ms; node /o.js => same EvalError
```

**(inference)** No configuration fixes this: workerd forbids code generation in Workers and Durable
Objects. The only route is to precompile guest code ahead of time into a module, which is what a
Worker Loader does, and then almostnode's runtime is no longer needed.

### (c) CellD 0.6.0 (`celld dev <dir> --port 8792 --clean --no-watch`)

```
exec   => {"exports":"a/b"}
eval   => {"v":2}
fn     => {"v":2}
run    => {"stdout":"hi\n","exitCode":0}
node   => {"stdout":"1\n","exitCode":0}                     # Worker and Durable Object alike
host   => process:object, WebSocket/fetch:function, SharedArrayBuffer:function,
          addEventListener:function, Worker:undefined, window/document:undefined,
          ua:"Cloudflare-Workers"
escape => {"stdout":"node:os import ok; hostname= localhost\n
           cloudflare:workers ok; env keys= SESSION\n
           guest fetch status 200\n","exitCode":0}, hostSeesLeak:"guest-1794776075823"
npm    => added ["is-odd","is-number"] in 117 ms; node /o.js => "is-odd(3)= true"
```

The next request still saw `leakBefore: "guest-1794776075823"`, so guest globals outlive the run.
On CellD the guest reached `cloudflare:workers`'s `env` with an indirect `import()`. In the
harness, that is the session DO's bindings, including the FilesApi capability store.
**(inference)** That bypasses the capability filter entirely.

### (d) cellb on Node (`loadProject(<worker dir>)` from `packages/cellb/dist/node.js`)

```
unsupported: []
exec   => {"exports":"a/b"}
node   => {"stdout":"1\n","exitCode":0}
host   => addEventListener:undefined, caches:undefined, ua:"Node.js/22"
escape => {"stderr":"node: globalThis.addEventListener is not a function\n","exitCode":1}
          host console: "cf import blocked: Only URLs with a scheme in: file, data, and node are
          supported by the default ESM loader. Received protocol 'cloudflare:'"
          host console: "node:os import ok; hostname= vm"     # the real machine
          host console: "guest fetch status 200"
npm    => added ["is-odd","is-number"] in 132 ms; node /o.js => "is-odd(3)= true"
```

On cellb/Node, guest code gets real Node built-ins (`node:fs`, `node:child_process` by the same
route), so it controls the host process. cellb in a browser was not tried. **(inference)** It
would load there as almostnode's own demos do, with the same shared-realm caveat, unless
almostnode is run inside cellb's Worker Loader isolate (a Dedicated Worker).

### FS: backing with our FilesApi

- `VirtualFS` holds `FSNode { content?: Uint8Array; children?: Map }`. Its API is `*Sync`, plus a
  few callback wrappers over the same sync calls (`src/virtual-fs.ts` lines 105-860). `require`,
  the `fs` shim and `VirtualFSAdapter` for just-bash all read it synchronously; the adapter wraps
  sync calls in `async` (`src/shims/vfs-adapter.ts`).
- Hooks: `toSnapshot()`/`VirtualFS.fromSnapshot()`, `on('change' | 'delete')` and `watch()`.
  **(inference)** A FilesApi binding is therefore possible only as follows:
  1. copy in the paths the session may read (as a snapshot) before a run;
  2. write back changed paths from the change events, checked against the capability on the
     host side.

  Reads outside the snapshot cannot be served lazily, and large workspaces cost memory.
  just-bash itself takes an async `IFileSystem`, so the shell alone could sit on the FilesApi, but
  `node` inside it could not.

### Licence and maturity

- MIT (`LICENSE`, "Copyright (c) 2026 almostnode contributors").
- 96 commits from 2026-01-27 to 2026-02-14 (94 by one author), and no commits since (9 months as of
  this note).
- No git tags or GitHub releases in the clone. 16 npm versions (0.1.0 published 2026-01-31, 0.2.14
  on 2026-02-14).
- Dependencies include `ai`, `@ai-sdk/*`, xterm and brotli-wasm in the runtime package.
- 15 MB `dist/`.
- The README says "experimental and may contain bugs".
- The GitHub API (stars, issues) was not reachable from this session.

## Open questions

- Would almostnode run inside a Worker Loader isolate on CellD and cellb? This depends on whether
  those isolates allow `eval` (CellD's main isolate does) and whether `globalOutbound: null` then
  blocks guest `fetch`. It is the only set-up found here that could make it a boundary. Not tried.
- Is CellD's `eval` permission intended, or a gap against workerd? Production Cloudflare refuses
  it, so code that relies on it is not portable.
- Can the `addEventListener` and one-shell-per-realm defects be patched locally (a fork or
  wrapper), or is the project abandoned? There has been no activity since 2026-02-14.
- How well does it cover real CLIs (`tsc`, `eslint`, `vitest`) off-browser, where the esbuild-wasm
  ESM transform is skipped? `nanoid@5` already failed on `crypto.getRandomValues`.

## Sources

- almostnode repository, commit `6ab61f3129093ea240a199c34bd69368628aaff9`
  (https://github.com/macaly/almostnode): `README.md`, `LICENSE`, `package.json`,
  `src/runtime.ts`, `src/virtual-fs.ts`, `src/shims/child_process.ts`, `src/shims/vfs-adapter.ts`,
  `src/shims/http.ts`, `src/npm/registry.ts`, `src/npm/tarball.ts`, `src/npm/index.ts`,
  `src/transform.ts`, `src/config/cdn.ts`, `src/cors-proxy.ts`, `git log`
- npm registry: `npm view almostnode time versions` (0.1.0 to 0.2.14)
- cellb: `/home/user/cellb.dev/README.md` (celld is `denoland/celld`),
  `packages/cellb/README.md` (`loadProject`)
- Experiments (scratchpad `an-exp/`): `scripts/full.mjs`, `escape.mjs`, `two.mjs`, `esm.mjs`,
  `cellb.mjs`, `worker/src/index.js`, `worker/wrangler.jsonc`; run with wrangler 4.158.0, celld
  0.6.0, Node v22.23.4
- Earlier note: `subjects/ai-harness/research/node-python-clis-in-sandbox.md`
