# Can unkernel be a container for cellb, celld and workerd, with FilesApi mounts?

Research for `statewalker/statewalker-root#437`. Sources read and experiments run on 2026-11-27. Every claim is marked **(verified)** (an experiment
in this session), **(sourced)** (unkernel's own code or docs, cited) or **(inference)** (this
note's reasoning). Builds on `docs/research/lightweight-containers-on-do-runtimes.md` (what workerd
allows in a DO and a Worker Loader isolate), whose findings are cited, not repeated.

Versions: unkernel `0.2.0-261126-fd204d3` (npm, the source at `pithings/unkernel@fd204d3`),
`@statewalker/cellb` 0.15.0, wrangler with workerd `2026-11-25`, Node 24.22, Chromium 158,
`@statewalker/webrun-files` 0.12.0 with `-mem` and `-composite`.

## Question

Can [unkernel](https://github.com/pithings/unkernel) (Linux 7.3 compiled to one wasm module, with
unmodified aarch64 user space run by an emulator linked into the kernel) launch isolated
applications from a Durable Object on cellb (Node and browsers), celld and workerd/Wrangler, and in
workers? Can our capability-based FilesApi be mounted in the guest so that every file call goes
through a filtered, guarded FilesApi, with no copy of the files when a session starts? And how do
JavaScript/TypeScript (Node, Bun, Deno) and Python run in these containers?

## Short answer

| Host | Inline (kernel on the DO's thread) | `worker: true` (kernel in its own worker) | JIT |
|---|---|---|---|
| Node 24, plain | **works** (verified) | **works**, worker_threads, shared transport (verified) | on |
| Chrome 158 page | **works** (verified) | **works**, Web Worker; shared transport when cross-origin isolated, messages when not (verified) | on |
| cellb, Node (cell in its worker-thread realm) | **works** (verified) | fails: `Worker is not defined` in the cell's realm (verified) | on |
| cellb, Chrome (cell in a Dedicated Worker) | **works** (verified) | **works**, a nested Web Worker (verified) | on |
| workerd / `wrangler dev`, in a DO | **works** (verified) | fails: no `Worker` (verified; expected from the earlier note) | off: compile refused, falls back to the interpreter (verified) |
| celld 0.6.3 | not run | not run | (inference) like workerd: no threads |

- **The scenario passed on every host where the kernel started**: a guest `cat`, `ls`, `head`,
  `echo >`, `>>`, `rm` against a `CompositeFilesApi` of a `readOnly(FilteredFilesApi(...))` input
  and a `GuardedFilesApi` output, with every call logged at the view and at the backing stores
  (verified, details below).
- **No copy at session start.** Mounting and the first `exec` cost two `stats("/")` calls and no
  `read` (verified on all hosts). Files are read only when the guest reads them, in ranges: a
  100-byte `head` of an 8 MiB file read 8 KiB (the guest's read-ahead), or exactly 1 KiB with the
  adapter's `direct` option (verified).
- **The FilesApi never leaves the owner's thread.** unkernel's 9p server and every `Fs` handler run
  on the thread that called `createKernel`, also in worker mode, where only the kernel moves
  (sourced: `.agents/js.md`, "Host file systems": "The server and the handlers run on the owner,
  as vsock does"; verified: the same call logs in inline and worker mode). In a DO that thread is the
  DO's, so capabilities stay where the cell's code built them.
- **Filtering and guards hold.** A hidden path (`/.private`) never reached the store and the guest
  got `ENOENT`; a guarded `.bin` write and a `remove` under `readOnly` reached no store method that
  changes anything, and the guest got `EACCES` (verified).
- **Caveats:** (1) unkernel's web entry computes `new URL("./unkernel.wasm", import.meta.url)` at
  module load, which throws in workerd and in cellb's blob-URL cells; pre-bundling the web entry
  with `import.meta.url` defined fixes it (verified). (2) `worker: true` needs a global `Worker`.
  (3) No JIT on workerd: CPU-bound guest code runs on the interpreter, about 2.5 times slower than
  Node with the JIT (verified). (4) unkernel says "Only one kernel can run per thread" (sourced:
  README, SDK limits), and every DO of one class shares an isolate on workerd (inference).
- **Node 24, Bun 1.4, Deno 2.9 and CPython 3.13 all run in the guest, on Debian 13, in Node and in a
  workerd DO** (verified). Each binary was the upstream aarch64 Linux build, served read-only from
  a FilesApi mount and never copied into the guest. TypeScript ran as is: Node strips the types,
  and Bun and Deno run `.ts` themselves. On Alpine, CPython runs, but the musl Bun needs
  `libstdc++`, which would come from `apk` (verified). In the workerd DO, the root image also came
  through a FilesApi, as a read-only disk. Section 6 has the numbers.
- **Getting the runtimes.** The images carry unkernel's shim (`/usr/lib/kw/bin/{node,npm,npx,bun,bunx,uv,uvx}`).
  On first use it downloads Node from nodejs.org (the unofficial-builds musl build on Alpine), Bun
  from the npm registry, and uv from astral.sh (sourced: `guest/base/rootfs/usr/lib/kw/shim`).
  Python comes from `apk add python3`, `apt-get install python3` or `uv python install`. All of
  these need the guest's network. On workerd, and wherever the guest must stay offline, mount the
  runtimes from a FilesApi (an R2 bucket, a prepared volume) instead (verified).
- **Long-lived kernels stall on workerd under many concurrent FilesApi fetches** (verified,
  cause open). One DO stopped answering after 79 to about 1,500 ranged fetches, depending on the
  run. The same commands, with the same FilesApi over HTTP, finished in plain Node (3,922 files in
  13.6 s). With the fetches serialised, one kernel got past 3,294 requests without stalling, so
  concurrent subrequests are the likely cause, but this is not proven. See section 6.
- **Recommendation (inference).** Add unkernel as a third engine behind cellb-containers'
  `ContainerEngine` port, next to Wasmer and Lifo. It is the only one of the three that runs
  unmodified Linux binaries (Alpine and Debian packages) behind a wasm sandbox. Unlike Wasmer it
  also runs inside a workerd DO, because it needs no threads, only JSPI. Mount FilesApis with the
  adapter below. Open the issues listed at the end upstream.

## Findings

### 1. What unkernel needs from its host (sourced)

- **JSPI.** Task switches and every blocking import are `WebAssembly.Suspending`, and the entry
  points are `WebAssembly.promising` (`js/core/kernel.ts` 1083-1286). workerd has JSPI in DOs
  (the earlier note; verified again here: `typeof WebAssembly.Suspending === "function"`).
- **A compiled kernel module.** `createKernel({ kernel })` takes "a URL, bytes, a Response or a
  WebAssembly.Module" (README, Boot options). On workerd a bundled `.wasm` import is a
  `WebAssembly.Module`, which avoids the refused run-time compile. `unkernel.wasm` is 11.3 MB,
  4.4 MB gzipped (verified): under the paid Workers script limit of 10 MB compressed, over the free
  3 MB (inference from Cloudflare's published limits, not checked today).
- **A JIT that compiles wasm at run time** (`js/core/jit.ts` 333: `new WebAssembly.Module(view)`).
  A failed compile is counted and the block stays on the interpreter (`jit.ts`, the `catch`
  around it). On workerd every compile fails with "Wasm code generation disallowed by embedder",
  and the guest runs on (verified: `jit.failed` 2-3, the scenario passes).
- **Threads only for worker mode and SMP.** `SharedArrayBuffer`/`Atomics.wait` appear in the
  console ring and the CPU threads (`console-ring.ts`, `cpu.ts`); the UP kernel inline needs
  neither (verified: it runs where `Atomics.wait` is refused).
- **Memory.** Alpine boots in 48 MiB of guest memory (README). We ran the base shell (busybox) at
  48-64 MiB (verified). Against Workers' 128 MB per isolate, kernel code, guest memory and JS
  together are tight (inference; not measured in production).
- **Distros** are erofs images attached as disks: a URL read with range requests in browsers,
  `fetchDistro()` on Node (README, Disks). Only the base shell was booted today; Alpine on workerd
  would need its image behind HTTP ranges or a `BlockDevice` over R2/DO storage (inference).

### 2. Mounting a FilesApi (verified)

unkernel mounts host file systems over 9P2000.L on vsock. The `Fs` it serves is path-based and
async-capable (`js/core/fs.ts`): `getattr`, `readdir`, `open` returning an `FsFile`
(`read(offset, length)`, `write`, `getattr`, `setattr`, `fsync`, `close`), plus optional `create`,
`mkdir`, `remove`, `rename`, `setattr`. An error with a Node-style `code` becomes that errno. This
maps onto `FilesApi` directly: `stats`, `list`, `read(path, { start, length })`, `write`, `mkdir`,
`remove`, `move`. The adapter in the appendix is 150 lines.

Where they differ:

- **FilesApi writes whole files.** A file opened for writing is buffered and written back on
  `fsync` and `close`, as cellb-containers' `FilesVolume` does. Opening without `O_TRUNC` (`>>`,
  editors) reads that one file first. This is a per-file read-modify-write when the guest opens
  it, not a copy at session start (verified: the `>>` step read the 6-byte file once).
- **No symlinks, modes, owners or times are stored**; files report 0644 and the owner uid 1000.
- **The guest caches.** unkernel mounts with `cache=readahead,metatimeout=1000` (sourced:
  "Cache mode" in `.agents/js.md`). Names and attributes are reused for up to 1 s, and file pages
  until a getattr sees a change. So a second `cat` of an unchanged file costs only `stats`, no
  `read` (verified). With the adapter's `direct: true` it answers `version: 0`, which makes the
  guest open files uncached (sourced), and every `read(2)` reaches the FilesApi (verified).
  Listings always come from the host (sourced).

The scenario, run on each host (store-level calls; the view adds the composite's own `stats`):

| Guest command | Calls that reached the backing stores |
|---|---|
| mount + first `exec` | none (the view saw `stats("/")` twice) |
| `cat input/data.csv` | `stats` ×4, `read(/data.csv)` = 8 B |
| `ls -a input` | `list(/)`, `stats(/big.bin)` ×2; `.private` not listed |
| `cat input/.private/secret.txt` | **none**: hidden by `FilteredFilesApi`, guest gets ENOENT |
| `head -c 100 input/big.bin` (8 MiB) | `read` = 8192 B (`direct`: 1024 B) |
| `cat` the same file again after 2 s | `stats` only (`direct`: `read` again) |
| `echo > output/a.txt; echo >> output/a.txt` | `exists`, `write`, `stats`, `write`, `read(/a.txt)` = 6 B, `write` |
| `echo > output/a.bin` | `stats`, `exists`; the guard refuses the write, guest gets EACCES |
| `rm input/data.csv` | `stats`; `readOnly` refuses, guest gets EACCES |

Afterwards the host saw `a.txt` = `guest\nmore\n`, no `a.bin`, `data.csv` still there.

### 3. Workers (verified)

- `createKernel({ worker: true })` moves the kernel into a `worker_threads` worker (Node) or a
  module Web Worker (browsers). Disks and the network are then given as specs the worker builds,
  but mounts stay objects on the owner's side (sourced: `.agents/js.md`, "Worker mode"). The call
  log was identical to inline mode in Node and in Chrome.
- In Chrome the transport is `shared` on a cross-origin isolated page and `messages` without
  COOP/COEP; both passed.
- Inside a cell: cellb's browser cells are Dedicated Workers, and `worker: true` started a nested
  Web Worker there. cellb's Node cells run in a worker-thread realm without a global `Worker`
  (cellb bundles for the web entry), so only inline mode works there. The kernel is still off the
  host's main thread, but it shares the cell realm's event loop with the cells in it.
- workerd has no `Worker`, so inline mode is the only choice. The kernel yields at every
  suspension, and the DO answered other requests while a kernel lived in it (verified: the same
  DO's kernel answered three later requests with its uptime counting on). A CPU-bound guest
  still uses the request's CPU budget: a 100,000-iteration shell loop took 12.2 s and
  `seq 50000 | sort -r` 2.55 s, against 2.11 s (interpreter) and 0.97 s (JIT) in Node (verified).

### 4. cellb and Wrangler specifics (verified)

- **`import.meta.url` at module load.** `dist/web.mjs` runs `new URL("./unkernel.wasm",
  import.meta.url)` (and the same for `virgl.mjs` and `kwvk-naga.wasm`) at top level. On workerd
  `import.meta.url` is undefined ("Invalid URL string" at startup), and in cellb's browser cells it
  is a `blob:` URL, which cannot be a base. Wrangler's `define` fixes it for Wrangler only, since
  `cellb build` ignores `define`. What works everywhere is to pre-bundle the web entry with esbuild
  `--define:import.meta.url='"https://unkernel.invalid/web.mjs"'`, import that file, and always
  pass `kernel` (a bundled `.wasm` import).
- **One copy of unkernel per bundle.** The adapter must not import from `unkernel`: that pulled a
  second, unpatched copy of the web entry into the cell's bundle. Errors carry a `code` instead.
- `cellb build` inlined the 11 MB wasm into `worker.js` (16.5 MB); `project.unsupported` was empty.
- The same project folder (`wrangler.jsonc`, a DO class, the pre-bundled entry, the wasm import)
  ran unchanged under `wrangler dev`, cellb Node and cellb in Chrome.

### 5. Not checked

celld; Cloudflare production (128 MB, the CPU limit, cold-start compile of an 11 MB module); a
Worker Loader isolate holding the kernel, with the FilesApi left in the DO behind an RPC stub
(the earlier note shows WL isolates take `{wasm}` modules and `globalOutbound: null`; whether 9p
calls survive an RPC hop per request is open); snapshots (`vm.snapshot({ commit })`) as DO
hibernation; several kernels in one workerd isolate under load; network (`net` takes any
`{ connect, lookup }`, so `cloudflare:sockets` or a guarded fetch could back it); `npm install`
or `pip install` in the guest (this sandbox's network policy blocks the guest's package mirrors);
the shim's downloads.

### 6. JavaScript, TypeScript and Python in the guest (verified)

**Where the binaries came from.** This sandbox's network reaches the npm registry and PyPI but
not the Alpine or Debian mirrors, so the runtimes were the upstream aarch64 Linux builds that npm
publishes: `node-linux-arm64@24.22.3` (nodejs.org's glibc build), `@oven/bun-linux-aarch64@1.4.5`
and its `-musl` twin (the packages unkernel's own shim downloads), `@deno/linux-arm64-glibc@2.9.6`,
and CPython 3.13.18 from python-build-standalone. The Python came through
`@rowstile/cli-linux-arm64[-musl]`, a third-party beta package with part of the stdlib removed:
good enough for a probe, not a source to depend on. They were unpacked on the host (530 MB) and
mounted read-only at `/opt/rt` through `NodeFilesApi` (Node) or a FilesApi over HTTP range requests
(workerd, standing in for R2). The adapter reported mode 0755 (`fileMode`), since a FilesApi
stores no modes. The scripts and their output files went through a second, writable
`MemFilesApi` at `/work`.

**What ran.** A `hello.ts` (a typed `const`, `process.version`, `fib(25)`) under each JavaScript
runtime, and a `hello.py` (`fib(22)`, a JSON file written to `/work`) under CPython. All passed,
and the host read the JSON file back from its `MemFilesApi`. Times are the whole `exec`; reads are
what the guest pulled from the runtimes' FilesApi:

| Run (Debian 13, guest 256 MiB) | Node host, JIT | Node host, no JIT | workerd DO (no JIT) |
|---|---|---|---|
| `node hello.ts`, cold / warm | 1.98 s (27.6 MB) / 1.44 s | 2.87 s | 3.31 s (43.2 MB) / 2.29 s |
| `bun hello.ts`, cold / warm | 1.02 s (22.0 MB) / 0.11 s | 1.77 s | 1.30 s (26.4 MB) / 0.18 s |
| `deno run hello.ts`, cold / warm | 1.65 s (17.4 MB) / 0.69 s | 1.96 s | 2.14 s (29.6 MB) / 0.78 s |
| `python3.13 hello.py`, cold | 2.30 s (11.9 MB) | 2.47 s | 3.24 s (15.9 MB), fresh DO |
| `fib(25)` in Node / Bun / Deno, warm | 34 / 56 / 19 ms | | 67 / 121 / 60 ms |

- **Lazy loading works.** Node's binary is 123 MB, yet `node --version` read 14 MB of it and a
  warm run 4.5 MB. Bun's `--version` read 3.2 MB of 103 MB. Nothing is copied ahead.
- **Memory.** Every runtime also passed with 128 MiB of guest memory (Node host). The host process
  of a Node run held 300 to 450 MB RSS, kernel and V8 included. That is far above the 128 MB a
  Workers isolate allows, so production on Cloudflare stays unproven (section 5).
- **Python start-up.** The stripped stdlib ships no `.pyc` files, so each run compiles what it
  imports: `python3.13 -c pass` took 0.5 s warm, 0.26 s with `PYTHONPYCACHEPREFIX` on a writable
  directory. An image made for this should be precompiled (`compileall`).
- **Alpine.** CPython (musl) ran there. The musl Bun failed to relocate `libstdc++` symbols, and the
  shim installs that library with `apk` (sourced). Debian already carries it.
- **Deno** needs a writable `DENO_DIR` (`/tmp/deno` here), since the mount is read-only.

**Booting a distro inside a workerd DO** needed three workarounds:

1. A string `distro` goes through `distroSpec`, which reads `location.href`, absent in workerd. A
   disk spec or a `BlockDevice` avoids it.
2. unkernel's HTTP disk (`HttpBase`, `js/core/block.ts` 1121-1231) fetches with `cache: "no-cache"`,
   `"force-cache"` and `"reload"`. workerd refuses all three ("Unsupported cache mode"), every
   block read then fails, and **the base shell boots instead, with no error reaching the caller**
   (verified: erofs I/O errors in `dmesg`, a busybox userland). Wrapping `fetch` to drop `cache`
   got the reads through, but that kernel then stalled after `Run /init`.
3. What worked is a `BlockDevice` of our own over a FilesApi file (`filesApiDisk` in the
   appendix): Debian booted in the DO in under 0.4 s, reading 4.3 MB of the 74 MB image. The root
   image then goes through the same capability layer as the mounts.

**The stall.** A kernel that keeps running in one DO stopped making progress: no new fetch, no
console output, `kwtty` silent. Every request the server saw had completed, so the DO's `fetch`
promise was what never settled. It happened after 79, 342 and about 1,500 requests in three runs,
and never in plain Node with the same FilesApi over HTTP. Serialising the FilesApi's fetches got
one kernel past 3,294 requests without a stall. Concurrent subrequests are the suspect: the 9p
server runs up to 16 requests at once (sourced: `.agents/js.md`, Connection), and workerd caps
the open connections of one request. Unconfirmed. Before an engine relies on this, reproduce it
with a minimal JSPI-plus-fetch probe and report it to unkernel or workerd.

## How it would plug into cellb-containers (inference)

`ContainerEngine` already has the shape: `start`/`exec`/`spawn` map onto `vm.exec`/`vm.spawn`
(pipes or a pty), `getTcpPort(p).fetch()`/`.connect()` onto `vm.fetch(url)`/`vm.connect(port)`
(vsock relays, no network), host mounts onto `createKernel({ mounts })`/`vm.mount()` with the
adapter, and `destroy` onto `stop()` (or `poweroff`). Isolation is a real kernel inside a wasm
sandbox. The guest reaches the host only through the devices the host configures; network is off
unless `net` is given. A runaway guest still holds its thread on workerd, so per-run Worker Loader
isolates with `limits.cpuMs` are the place for untrusted code there, as for the other wasm engines.

## Follow-up

- statewalker/cellb.dev#256: the unkernel engine for cellb-containers, with these findings as
  acceptance criteria (the workerd stall first).

## Upstream asks

1. Resolve `bundledKernelUrl`/`bundledGlUrl`/`bundledVkShaderUrl` lazily, only when no `kernel`
   (or `gl`/`vk`) is given, so the web entry loads where `import.meta.url` is absent or a blob URL.
2. Let the caller provide the worker factory for `worker: true` (the internal
   `Platform.spawnWorker`), so a host realm without a global `Worker` can still give one.
3. An option to skip the JIT probe on hosts that refuse compiles, instead of a failed compile
   logged as an error per block.
4. `HttpBase` without `fetch` cache modes where the runtime refuses them (workerd), and a distro
   that fails to mount reported to `createKernel`'s caller, not booted around in silence.
5. `distroSpec` resolving a relative URL only where `location` exists.

## Appendix: the FilesApi → unkernel `Fs` adapter (as run)

```js
// A FilesApi served to an unkernel guest as its `Fs` (9p over vsock). FilesApi writes whole
// files, so a file opened for writing is buffered and written back on fsync and close.
// unkernel answers the guest with the errno an error's `code` names, so nothing is imported.
class FsError extends Error {
  constructor(code, message) { super(message ? `${code}: ${message}` : code); this.code = code; }
}

async function readAll(files, path) {
  const chunks = []; let n = 0;
  for await (const c of files.read(path)) { chunks.push(c); n += c.length; }
  const out = new Uint8Array(n); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// direct: answer version 0, so the guest opens every file uncached and each read(2) reaches
// the FilesApi (no guest page cache). fileMode: the permission bits files report (a FilesApi
// stores none); 0o755 lets the guest run programs served from the FilesApi.
export function filesApiFs(files, { readOnly = false, direct = false, fileMode = 0o644 } = {}) {
  const attrOf = (s) => s.kind === "directory"
    ? { type: "dir", mode: 0o755 }
    : { type: "file", mode: fileMode, size: s.size, mtimeMs: s.lastModified, ...(direct ? { version: 0 } : {}) };
  async function stat(path) {
    const s = await files.stats(path);
    if (!s) { if (path === "/") return { kind: "directory" }; throw new FsError("ENOENT"); }
    return s;
  }
  function openFile(path, initial) { // initial: the buffer when opened for writing
    let buf = initial, dirty = false;
    const flush = async () => {
      if (!dirty) return; dirty = false;
      try { await files.write(path, [buf]); } catch (e) { throw e?.code ? e : new FsError("EACCES", String(e?.message ?? e)); }
    };
    return {
      async read(offset, length) {
        if (buf) return buf.slice(offset, offset + length);
        const out = [];
        for await (const c of files.read(path, { start: offset, length })) out.push(c);
        if (out.length === 1) return out[0];
        const r = new Uint8Array(out.reduce((a, c) => a + c.length, 0)); let o = 0;
        for (const c of out) { r.set(c, o); o += c.length; }
        return r;
      },
      write: buf === undefined ? undefined : (offset, data) => {
        const end = offset + data.length;
        if (end > buf.length) { const nb = new Uint8Array(end); nb.set(buf); buf = nb; }
        buf.set(data, offset); dirty = true; return data.length;
      },
      async getattr() {
        if (buf) return { type: "file", mode: 0o644, size: buf.length, mtimeMs: Date.now(), ...(direct ? { version: 0 } : {}) };
        return attrOf(await stat(path));
      },
      setattr(attr) {
        if (attr.size !== undefined && buf) {
          const nb = new Uint8Array(attr.size); nb.set(buf.subarray(0, attr.size)); buf = nb; dirty = true;
        }
      },
      fsync: flush, close: flush,
    };
  }
  const fs = {
    async getattr(path) { return attrOf(await stat(path)); },
    async readdir(path) {
      const out = [];
      for await (const e of files.list(path)) out.push({ name: e.name, type: e.kind === "directory" ? "dir" : "file" });
      return out;
    },
    async open(path, flags) {
      const s = await stat(path);
      if (s.kind === "directory") throw new FsError("EISDIR");
      if (!flags.write) return openFile(path, undefined);
      if (readOnly) throw new FsError("EROFS");
      const initial = flags.truncate ? new Uint8Array(0) : await readAll(files, path);
      if (flags.truncate) await files.write(path, [initial]);
      return openFile(path, initial);
    },
  };
  if (!readOnly) Object.assign(fs, {
    async create(path) {
      if (await files.exists(path)) throw new FsError("EEXIST");
      await files.write(path, [new Uint8Array(0)]);
      return openFile(path, new Uint8Array(0));
    },
    async mkdir(path) { if (await files.exists(path)) throw new FsError("EEXIST"); await files.mkdir(path); },
    async remove(path, dir) {
      const s = await stat(path);
      if (dir) {
        if (s.kind !== "directory") throw new FsError("ENOTDIR");
        for await (const _ of files.list(path)) throw new FsError("ENOTEMPTY");
      } else if (s.kind === "directory") throw new FsError("EISDIR");
      await files.remove(path);
    },
    async rename(from, to) { if (!(await files.move(from, to))) throw new FsError("EIO"); },
    async setattr(path, attr) { // modes and times are not stored
      if (attr.size === undefined) return;
      const data = await readAll(files, path), nb = new Uint8Array(attr.size);
      nb.set(data.subarray(0, attr.size)); await files.write(path, [nb]);
    },
  });
  // A refusal from a guard or readOnly() carries no errno: EACCES for changes (fail closed),
  // EIO for reads.
  const MUTATING = new Set(["create", "mkdir", "remove", "rename", "setattr"]);
  for (const k of Object.keys(fs)) {
    const fn = fs[k];
    fs[k] = async (...a) => {
      try { return await fn(...a); } catch (e) {
        if (e?.code) throw e;
        throw new FsError(MUTATING.has(k) || (k === "open" && a[1]?.write) ? "EACCES" : "EIO", String(e?.message ?? e));
      }
    };
  }
  return fs;
}
```

A distro image as a read-only disk over one FilesApi file, so the root file system goes through
the same capability layer (what booted Debian in the workerd DO):

```js
export async function filesApiDisk(files, path) {
  const s = await files.stats(path);
  if (s?.kind !== "file") throw new Error(`no disk image at ${path}`);
  return {
    size: s.size,
    readOnly: true,
    async read(off, views) { // one ranged FilesApi read per guest block request
      const len = views.reduce((a, v) => a + v.length, 0), buf = new Uint8Array(len);
      let o = 0;
      for await (const c of files.read(path, { start: off, length: len })) {
        buf.set(c.subarray(0, len - o), o); o += c.length; if (o >= len) break;
      }
      let p = 0;
      for (const v of views) { v.set(buf.subarray(p, p + v.length)); p += v.length; }
    },
    write() { throw Object.assign(new Error("read-only disk"), { code: "EROFS" }); },
  };
}
// createKernel({ kernel, distro: await filesApiDisk(images, "/debian.erofs"),
//   mounts: { "/opt/rt": filesApiFs(runtimes, { readOnly: true, fileMode: 0o755 }) } })
```

Use: `createKernel({ kernel, mounts: { "/mnt/f": filesApiFs(view) } })`, where `view` is the
capability-filtered FilesApi (`CompositeFilesApi`, `FilteredFilesApi`, `GuardedFilesApi`,
`readOnly`). In a DO or on workerd, import a pre-bundled `unkernel/web` (section 4) and the kernel
as a bundled `.wasm` module.
