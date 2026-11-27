# unkernel as a container for cellb, celld and workerd: procedure, results, conclusion

The full record of the evaluation for `statewalker/statewalker-root#437`: what was set up, how each
experiment was run, what came out, and what was decided. The detailed measurements and sources are
in the two research notes; this file is the procedure and the summary.

- `docs/research/unkernel-on-cellb-and-workerd.md`: hosts, FilesApi mounts, runtimes from npm.
- `docs/research/unkernel-oci-images-js-python.md`: Docker images, resources per case, packages,
  snapshots, app images, and the comparison with Wasmer and QuickJS.
- **Decision:** [unkernel-not-integrated-now](../adr/2026-11-27-unkernel-not-integrated-now.md).

All experiments ran on 2026-11-27 in one cloud session, on a 4-vCPU, 16 GB Linux VM.

## Conclusion

**unkernel is not integrated now.**

- **What works:**
  - on cellb, in Node and in Chrome, inline and in workers;
  - real runtimes: Node 24, Bun 1.4, Deno 2.9 and CPython 3.13;
  - official Docker images, run unchanged from their layers;
  - every guest file operation goes through the mounted, filtered FilesApi, with nothing copied
    when a session starts.
- **Why not now:**
  - kernels in a workerd Durable Object stall at random, for no cause we could find;
  - a kernel costs 60 to 67 MiB of host memory, and the emulated CPU runs about 45 times slower
    than native;
  - the project is weeks old, its emulator is unaudited, and our use of it needs three
    workarounds.
- **To explore later:** Docker images on this base, with pre-installed app images and the FilesApi
  for data only, is the shape to come back to. See "The option to revisit" at the end.

## 1. Environment

| Piece | Version or source |
|---|---|
| unkernel | npm `unkernel@0.2.0-261126-fd204d3` (`npm pack`, unpacked; kernel `dist/unkernel.wasm`, 11.3 MB); source `pithings/unkernel@fd204d3` (read for the SDK, guest and release workflow) |
| Distro images | `fetchDistro("alpine")`, `fetchDistro("debian")` from the release (`alpine.erofs` 4 MB, `debian.erofs` 74 MB) |
| tabc | `fzakaria/tabc@9c38eb7` (read, not run: it needs Docker or headless Chromium per container and a Go build) |
| Node | 24.22.3 (npm `node@24`), for JSPI; the VM's own Node 22 has no `WebAssembly.Suspending` |
| workerd | `2026-11-25`, through `wrangler dev` (npm `wrangler`), compatibility date `2026-11-01` |
| Chrome | Chromium 158 through Playwright (preinstalled) |
| cellb | npm `@statewalker/cellb@0.15.0` (`loadProject` in Node; `cellb build` plus `@statewalker/cellb/browser` in Chromium) |
| FilesApi | npm `@statewalker/webrun-files` 0.12, `-mem`, `-node`, `-composite` |
| Images | Docker Hub, `linux/arm64`: `alpine:3.22`, `python:3.13-alpine`, `node:24-alpine`, `oven/bun:1-alpine`, `denoland/deno:alpine` |
| Runtimes from npm | `node-linux-arm64@24.22.3`, `@oven/bun-linux-aarch64[-musl]@1.4.5`, `@deno/linux-arm64-glibc@2.9.6`, CPython 3.13.18 (python-build-standalone, through `@rowstile/cli-linux-arm64[-musl]`, a third-party package used for the probe only) |
| Packages | `pip download` (musllinux aarch64, cp313): numpy 2.5.5, requests and its dependencies; `npm pack`: esbuild 0.25.12 with `@esbuild/linux-arm64`, lodash 4.17.21 |

**Network constraints.**

- The session's proxy allowed the npm registry, PyPI, Docker Hub and GitHub release downloads.
- It refused the Alpine and Debian package mirrors and GitHub's release pages. The human declined
  to add the mirrors.
- A probe connecting straight to hosts, bypassing the proxy, was refused by the session's
  permission classifier.

So no guest had a network of its own. Everything a guest needed came in through a read-only
FilesApi or an image.

Everything ran from a scratch lab directory: `npm i node@24 workerd wrangler esbuild <unkernel
tarball> @statewalker/webrun-files{,-mem,-node,-composite} @statewalker/cellb`. The lab code is
not committed. Its core modules are in the appendix, verbatim as they ran.

## 2. Procedure

### 2.1 Read unkernel

The npm package was unpacked, and the source cloned for `README.md`, `AGENTS.md`,
`.agents/js.md`, `js/core/{fs,kernel,jit,block,net,distro,snapshot}.ts`, `guest/README.md`,
`guest/base/rootfs/usr/lib/kw/shim` and `.github/workflows/release.yml`. These established:

- **Host needs:** JSPI; a kernel given as a `WebAssembly.Module`; a JIT that compiles wasm at run
  time and falls back on failure; threads only for worker mode and SMP.
- **The host file system interface:** `Fs`, path-based and async-capable (`getattr`, `readdir`,
  `open`, …). Its handlers run on the owner's thread in every mode.
- **The network:** a backend is any object with `connect` and `lookup`.
- **Snapshots:** `vm.snapshot()`, `encodeSnapshot`, `createKernel({ restore })`.

### 2.2 FilesApi in the guest (`files-api-fs.mjs`, `scenario.mjs`)

1. **The adapter.** `filesApiFs(files, { readOnly, direct, fileMode })` turns a FilesApi into
   unkernel's `Fs`.
   - Reads are ranged FilesApi reads.
   - A file opened for writing is buffered and written back whole on `fsync` and `close`, since a
     FilesApi writes whole files.
   - Refusals without an errno become EACCES for changes and EIO for reads.
2. **The view.** A `CompositeFilesApi` combining:
   - a read-only `FilteredFilesApi` input that hides `/.private`;
   - a `GuardedFilesApi` output that allows only `.txt` writes.

   A logging proxy records every call at the view and at both backing stores.
3. **The scenario.** After boot, a first `exec` (which waits for the mounts) marks the session
   start. Then guest commands run: `cat`, `ls -a`, `cat` of the hidden file, `head -c 100` of an
   8 MiB file, a second `cat` after 2 s, `echo >` and `>>`, a refused `.bin` write and a refused
   `rm`. Each step records the calls that reached the stores.
4. **Run on each host:**
   - Node, inline and `worker: true`;
   - Chrome, a page bundled with esbuild, served with and without COOP/COEP, driven by Playwright,
     inline and in a Web Worker;
   - cellb Node, through `loadProject` of a wrangler project whose DO runs the scenario;
   - cellb in Chromium, the same project through `cellb build` and `@statewalker/cellb/browser` in
     a Dedicated Worker;
   - workerd, the same project through `wrangler dev`.

   workerd and cellb's browser cells need two workarounds: unkernel's web entry pre-bundled with
   `--define:import.meta.url='"https://unkernel.invalid/web.mjs"'`, and the kernel passed as a
   bundled `.wasm` import.

### 2.3 Runtimes from a FilesApi (`runtimes.mjs`, `wd2/`)

1. The npm-published aarch64 builds of Node, Bun, Deno and CPython were unpacked on the host (530
   MB).
2. They were mounted read-only at `/opt/rt` with `fileMode: 0o755`, in a Debian guest. The scripts
   came through a writable `MemFilesApi` at `/work`.
3. Each runtime ran a `hello.ts` (or `hello.py`) twice, cold then warm. The bytes read from the
   FilesApi were recorded, and the same runs repeated with `jit: false`.
4. In workerd, a string `distro` failed in two ways: `distroSpec` reads `location`, and the HTTP
   disk uses `fetch` cache modes that workerd refuses, after which the base shell booted silently.
   The root image was therefore given as `filesApiDisk(httpFilesApi, "/debian.erofs")`, a
   `BlockDevice` over a FilesApi file, served by a local range server standing in for R2.

### 2.4 Docker images (`oci/pull.mjs`, `oci/layers-fs.mjs`, `oci/run.mjs`, `oci/bench-node.mjs`)

1. **Pull.** `pullImage(ref, files)`:
   - takes a registry token from `WWW-Authenticate`;
   - reads the `linux/arm64` manifest from the index, then the config;
   - stores each layer gunzipped as `/layers/<diffid>.tar`, and `/images/<ref>.json`.
2. **Index.** `indexImage` reads each layer tar's headers once (including PAX, GNU long names and
   base-256 sizes) into a JSON index beside the image. tabc builds the same tree at each start
   instead.
3. **Serve.** `layersFs(files, index)` merges the layers (whiteouts, opaque directories, hard links,
   and overlayfs 0:0 character devices as deletions) and answers unkernel's `Fs` calls. Each file
   read is a ranged read of the layer tar.
4. **Boot.** unkernel's base shell, with no distro. The image is mounted read-only at
   `/oci/lower`, plus `/work`, `/data`, `/out` or `/pkgs` as each test needs.
5. **Setup** (`SETUP`, as root):
   - a tmpfs at `/oci/up`, and an overlay with lower `/oci/lower` and upper `/oci/up/u` at
     `/oci/root`;
   - `proc`, `sys`, `dev` and `tmp` inside it;
   - bind mounts of the FilesApi mounts.
6. **Run** (`runInImage`):
   1. Write the program as a script into the root: `cd`, the image's `Env` exported, `exec argv`.
   2. Start it with `chroot /oci/root /usr/bin/env -i /bin/sh script`, in a cgroup of its own.
   3. While it runs, sample every 50 ms the program's `VmHWM` (and its children's) and the guest's
      `MemAvailable`.
   4. Read the cgroup's `cpu.stat` for the program's CPU time. The guest enables only the `pids`
      controller, so there is no `memory.peak`.
7. **Measure.** One fresh Node process per case (so host memory is not inherited), each image × {JIT
   on, JIT off} at 256 MiB, plus JIT on at 128, 96 and 64 MiB. Each case boots, sets up, then runs
   cold and warm. Recorded: wall time, host CPU (`process.cpuUsage`), host peak RSS
   (`process.resourceUsage().maxRSS`), guest CPU, program peak RSS, guest memory used, and FilesApi
   reads.

### 2.5 Package managers, density, snapshots

- **Packages (`oci/pkgs.mjs`).** The host-fetched packages were mounted read-only at `/pkgs`. Then:
  - `pip install --no-index --find-links /pkgs/py numpy requests` into the overlay, and
    `--target /work/site` into a FilesApi;
  - a numpy computation;
  - `npm install --offline <tarballs>` into the overlay and into a FilesApi;
  - `require('esbuild').transformSync(...)`, which spawns the native binary.
- **Density (`density.mjs`).** N kernels with `worker: true` in one Node process, each answering an
  `exec`, with RSS and PSS sampled after each start. N = 8 at 64 MiB; N = 4 at 256 and 512 MiB.
- **Snapshots (`oci/snapshot.mjs`).** Boot, warm the program, `vm.snapshot({ stop: true })`, then
  `encodeSnapshot` (also gzipped to gauge storage). Then `createKernel({ restore: decodeSnapshot(bytes),
  mounts })` with the same FilesApi mounts, and run again.

### 2.6 Pre-installed app images, the FilesApi for data only (`oci/build.mjs`, `oci/apps.mjs`, `oci/worker-jobs.mjs`)

1. **Build** (`buildImage`):
   1. Boot the base image, with the image store writable at `/out` and the packages at `/pkgs`.
   2. Write the app's scripts into `/oci/root/app`.
   3. Run its install steps in the chroot (`pip install numpy`, `python3 -m compileall`;
      `npm install lodash`).
   4. Remove the mount points and caches from the overlay's upper directory, and `tar` it to
      `/out/layers/app-<name>.tar`.
   5. Write the new image (the base's layers plus that one, `Cmd`, `WorkingDir`) and its index.

   The apps built:
   - `app/py-stats`: numpy statistics over a CSV;
   - `app/node-report`: a lodash report over JSON;
   - `app/bun-ts`: a TypeScript word count.
2. **Run.** The app image read-only, a logged `MemFilesApi` at `/data` holding only the job's
   input. Cold, warm, then after snapshot and restore. The calls that reached `/data` were listed.
3. **Worker.** A long-lived `python3` in the app image imports numpy once, then handles job names on
   its stdin (`vm.spawn(..., { pty: false })`). Each job reads `/data/<job>.csv` and writes
   `/data/<job>.json`. Per-job latency was recorded.

### 2.7 workerd runs and the stall investigation (`wd3/`)

The same images and app images ran in a DO under `wrangler dev`:

- **Setup:** `jit: false`, guest 256 MiB, the image store served by HTTP range requests through
  `HttpFilesApi`, and a `MemFilesApi` for `/work` or `/data`.
- **Plain images:** cold then warm in one DO.
- **Investigation** of a stall that appeared earlier:
  - `HttpFilesApi` fully serialised, then capped at 4 requests in flight;
  - a fresh workerd process per app;
  - stage tracking and a second `exec` into the stuck kernel;
  - the app's steps one at a time;
  - the same request repeated;
  - the identical code in plain Node with `HttpFilesApi` and `jit: false`.

## 3. Results

Full tables are in the notes. In short:

| Question | Result |
|---|---|
| Hosts | Node, Chrome and cellb (Node, Chrome) run it inline. Workers: Node, Chrome, and inside a cellb browser cell; not in a cellb Node cell or workerd (no global `Worker`). workerd needs `jit: false` (compiles are refused) and stalls intermittently |
| FilesApi | Mount plus first `exec`: 2 `stats("/")`, 0 reads, on every host. Ranged reads (a 100-byte `head` of 8 MiB read 8 KiB, 1 KiB with `direct`). The hidden file never reached the store. Refused writes and removes came back as EACCES |
| Runtimes | Node 24, Bun 1.4, Deno 2.9 and CPython 3.13 ran, from npm builds on a FilesApi (Debian) and from official images, in Node and in a workerd DO (with stalls there) |
| Images | Five official Docker Hub images ran unchanged. Pull 1.4 to 3 s, index 0.05 to 0.7 s, indexes under 0.5 MB |
| Resources | Idle kernel: 60 to 67 MiB of host memory, 0.2 s to start. Program peak RSS: Python 13.5 MiB, Bun 23, Deno 29, Node 64 to 70. Warm runs: Bun 0.23 s, Deno 0.31, Python 0.77, Node 1.78. Compute about 45× native; JIT off 1.5 to 2.2× slower. Guest memory down to 64 to 96 MiB (numpy: 256) |
| Packages | Offline `pip` (numpy, with C extensions) and `npm` (esbuild's native binary) worked, in 1 to 2 min each. A FilesApi cannot hold `node_modules/.bin` links or executables |
| Snapshots | 20 to 50 ms, 17 to 21 MiB (3.8 MiB gzipped); restore in 70 to 140 ms. The first run after a restore is about as slow as a cold one (file caches are dropped) |
| App images | Built in the guest without Docker: numpy 108 s, lodash 37 s, a TS script 0.8 s. Each run touched `/data` only for its own files (7 to 12 calls) |
| Workers | One numpy worker: 2.5 s to start, then 14 to 19 ms per job, against 2.9 s per process per job |
| workerd | Plain alpine, Python and Bun images ran. App images and Node stalled. The same request succeeded, then stalled on retry, with no log. It is not explained by fetch counts, concurrency limits, kernels per isolate or the image, and it never happened in Node |

## 4. Findings

1. **The FilesApi integration is sound.** unkernel's `Fs` maps onto a FilesApi with about 150
   lines. The handlers stay on the owner's thread in every mode, so capabilities never move.
   FilesApi has no modes and no symlinks, which is right for data and wrong for software trees.
2. **Docker images are the right unit for software.** They need no images of our own. Layers stay
   tars in a FilesApi (R2), read in place, and app images can be built in the guest. This is
   tabc's design, re-done in JavaScript on our interfaces.
3. **Runtime, packages and scripts belong in the image, and data on the FilesApi.** Installs are
   minutes under emulation, so never in a run.
4. **Processes are expensive, workers are cheap.** A runtime's start costs 0.2 to 2.5 s. A worker
   kept in the guest answers in tens of milliseconds.
5. **Memory and speed** put unkernel in a different class from QuickJS and CPython on WASI: about
   3 to 6 times the memory, and slower starts. Wasmer cannot run on workerd at all.
6. **workerd is the blocker.** It stalls without a reproducible cause, and production limits (128
   MB per isolate, CPU per request) are untested. Three workarounds were needed:
   `import.meta.url`, fetch cache modes, and `location`.
7. **Upstream maturity.** unkernel is weeks old with one author, its emulator is unaudited (as
   tabc's design notes say), and its kernel is GPL-2.0, though its SDK is MIT.

## 5. The option to revisit: Docker images on unkernel

**What it would be** (inference from the experiments): a cellb-containers engine whose image is an
OCI reference, built from these pieces.

- **Image service:** a puller into a FilesApi-backed store (R2 per account), plus a layer index
  stored beside it.
- **Root file system:** the read-only merged tree, with a tmpfs overlay in the guest. App images
  are built by running install steps in the guest and exporting the overlay as a layer, or are
  pulled ready-made.
- **Runtime:** one kernel per DO, with the app's long-lived worker processes started when the DO
  wakes. Jobs reach them over stdin or vsock; `getTcpPort().fetch()` maps onto unkernel's
  `vm.fetch()`.
- **Data:** the job's data on FilesApi mounts only.
- **Hibernation:** a snapshot of the kernel with its workers idle, once the SDK keeps such
  processes across a restore.

**What must be solved first:**

- the workerd stall, with a minimal JSPI-plus-fetch reproduction, then reported to whichever
  project owns it;
- production memory and CPU limits;
- upstream fixes for the workarounds;
- per-container CPU and memory limits (the guest has only the `pids` controller);
- guest networking behind our gateway (unkernel's `{ connect, lookup }` backend, which tabc carries
  over WebSockets);
- registry credentials for private images.

## Appendix: the lab code, as run

The FilesApi adapter, the FilesApi disk, the HTTP FilesApi, the image puller, the layer index and
`Fs`, the runner and the image builder. The benchmark drivers named above call these. They live in
a scratch directory and are not committed.

### `files-api-fs.mjs`: The FilesApi adapter: unkernel `Fs` over any FilesApi

```js
// A FilesApi served to an unkernel guest as its `Fs` (9p over vsock).
// FilesApi writes whole files, so a file opened for writing is buffered and
// written back on fsync and on close (as cellb-containers' FilesVolume does).
// unkernel answers the guest with the errno an error's `code` names (as Node's
// fs errors carry), so the adapter needs nothing from the unkernel package.
class FsError extends Error {
	constructor(code, message) { super(message ? `${code}: ${message}` : code); this.code = code; }
}

const join = (p) => (p === "/" ? "/" : p);

async function readAll(files, path) {
	const chunks = [];
	let n = 0;
	for await (const c of files.read(path)) { chunks.push(c); n += c.length; }
	const out = new Uint8Array(n);
	let o = 0;
	for (const c of chunks) { out.set(c, o); o += c.length; }
	return out;
}

// direct: answer version 0, so the guest opens every file uncached and each
// read(2) reaches the FilesApi (no guest page cache).
// fileMode: the permission bits files report (FilesApi stores none); 0o755 lets the
// guest run programs served from the FilesApi.
export function filesApiFs(files, { readOnly = false, direct = false, fileMode = 0o644 } = {}) {
	const attrOf = (s) =>
		s.kind === "directory"
			? { type: "dir", mode: 0o755 }
			: { type: "file", mode: fileMode, size: s.size, mtimeMs: s.lastModified, ...(direct ? { version: 0 } : {}) };

	async function stat(path) {
		const s = await files.stats(join(path));
		if (!s) {
			if (path === "/") return { kind: "directory" };
			throw new FsError("ENOENT");
		}
		return s;
	}

	function openFile(path, initial) {
		// initial: Uint8Array when opened for writing (buffered), undefined for reads.
		// The buffer grows geometrically (len: the file's size), so appends stay linear.
		let buf = initial, len = initial?.length ?? 0;
		let dirty = false;
		const view = () => buf.subarray(0, len);
		const flush = async () => {
			if (!dirty) return;
			dirty = false;
			try { await files.write(path, [view()]); }
			catch (e) { throw e?.code ? e : new FsError("EACCES", String(e?.message ?? e)); }
		};
		const grow = (size) => {
			if (size <= buf.length) return;
			const nb = new Uint8Array(Math.max(size, buf.length * 2, 64 * 1024));
			nb.set(view()); buf = nb;
		};
		return {
			async read(offset, length) {
				if (buf) return buf.slice(offset, Math.min(offset + length, len));
				const out = [];
				for await (const c of files.read(path, { start: offset, length })) out.push(c);
				if (out.length === 1) return out[0];
				const total = out.reduce((a, c) => a + c.length, 0);
				const r = new Uint8Array(total);
				let o = 0;
				for (const c of out) { r.set(c, o); o += c.length; }
				return r;
			},
			write: buf === undefined ? undefined : (offset, data) => {
				const end = offset + data.length;
				grow(end);
				if (offset > len) buf.fill(0, len, offset);
				buf.set(data, offset);
				if (end > len) len = end;
				dirty = true;
				return data.length;
			},
			async getattr() {
				if (buf) return { type: "file", mode: fileMode, size: len, mtimeMs: Date.now(), ...(direct ? { version: 0 } : {}) };
				return attrOf(await stat(path));
			},
			setattr(attr) {
				if (attr.size !== undefined && buf) {
					grow(attr.size);
					if (attr.size > len) buf.fill(0, len, attr.size);
					len = attr.size;
					dirty = true;
				}
			},
			fsync: flush,
			close: flush,
		};
	}

	const fs = {
		async getattr(path) { return attrOf(await stat(path)); },
		async readdir(path) {
			const out = [];
			for await (const e of files.list(join(path))) out.push({ name: e.name, type: e.kind === "directory" ? "dir" : "file" });
			return out;
		},
		async open(path, flags) {
			const s = await stat(path);
			if (s.kind === "directory") throw new FsError("EISDIR");
			if (!flags.write) return openFile(path, undefined);
			if (readOnly) throw new FsError("EROFS");
			const initial = flags.truncate ? new Uint8Array(0) : await readAll(files, path);
			const f = openFile(path, initial);
			if (flags.truncate) { await files.write(path, [initial]); }
			return f;
		},
	};
	if (!readOnly) Object.assign(fs, {
		async create(path) {
			if (await files.exists(path)) throw new FsError("EEXIST");
			await files.write(path, [new Uint8Array(0)]);
			return openFile(path, new Uint8Array(0));
		},
		async mkdir(path) {
			if (await files.exists(path)) throw new FsError("EEXIST");
			await files.mkdir(path);
		},
		async remove(path, dir) {
			const s = await stat(path);
			if (dir) {
				if (s.kind !== "directory") throw new FsError("ENOTDIR");
				for await (const _ of files.list(path)) throw new FsError("ENOTEMPTY");
			} else if (s.kind === "directory") throw new FsError("EISDIR");
			await files.remove(path);
		},
		async rename(from, to) {
			if (!(await files.move(from, to))) throw new FsError("EIO");
		},
		async setattr(path, attr) {
			if (attr.size === undefined) return; // modes and times are not stored
			const data = await readAll(files, path);
			const nb = new Uint8Array(attr.size);
			nb.set(data.subarray(0, attr.size));
			await files.write(path, [nb]);
		},
	});
	// A refusal from a guard or readOnly() carries no errno: answer EACCES for
	// changes (fail closed, as cellb-containers' FilesVolume), EIO for reads.
	const MUTATING = new Set(["create", "mkdir", "remove", "rename", "setattr"]);
	const wrap = (name, fn) => async (...a) => {
		try { return await fn(...a); }
		catch (e) {
			if (e?.code) throw e;
			throw new FsError(MUTATING.has(name) || (name === "open" && a[1]?.write) ? "EACCES" : "EIO", String(e?.message ?? e));
		}
	};
	for (const k of Object.keys(fs)) fs[k] = wrap(k, fs[k]);
	return fs;
}
```

### `files-api-disk.mjs`: A read-only `BlockDevice` over one FilesApi file (the distro disk on workerd)

```js
// A read-only unkernel BlockDevice over one file of a FilesApi: each guest block
// read is one ranged FilesApi read (an R2-, S3- or HTTP-backed FilesApi in a DO).
export async function filesApiDisk(files, path) {
	const s = await files.stats(path);
	if (s?.kind !== "file") throw new Error(`no disk image at ${path}`);
	return {
		size: s.size,
		readOnly: true,
		async read(off, views) {
			const len = views.reduce((a, v) => a + v.length, 0);
			const buf = new Uint8Array(len);
			let o = 0;
			for await (const c of files.read(path, { start: off, length: len })) { buf.set(c.subarray(0, len - o), o); o += c.length; if (o >= len) break; }
			let p = 0;
			for (const v of views) { v.set(buf.subarray(p, p + v.length)); p += v.length; }
		},
		write() { throw Object.assign(new Error("read-only disk"), { code: "EROFS" }); },
	};
}
```

### `http-files-api.mjs`: A read-only FilesApi over HTTP range requests (R2 stand-in), with `maxConcurrent`

```js
// A read-only FilesApi over HTTP: a manifest ({ path: size }) for stats and
// listings, ranged GETs for reads (what an R2- or S3-backed FilesApi does).
export class HttpFilesApi {
	#base; #files = new Map(); #dirs = new Map(); #ready;
	constructor(base, fetchFn = (...a) => fetch(...a), { serial = false, maxConcurrent = serial ? 1 : Infinity } = {}) {
		this.#base = base;
		// maxConcurrent: at most this many requests in flight, each body read whole
		// before the slot is freed (a probe of workerd's limits on open subrequests).
		if (maxConcurrent === Infinity) this.fetch = fetchFn;
		else {
			let active = 0; const waiting = [];
			const acquire = () => active < maxConcurrent ? (active++, Promise.resolve()) : new Promise((r) => waiting.push(r));
			const release = () => { const next = waiting.shift(); if (next) next(); else active--; };
			this.fetch = async (...a) => { await acquire(); try { const r = await fetchFn(...a); return new Response(await r.arrayBuffer(), r); } finally { release(); } };
		}
		this.#ready = this.#load();
	}
	async #load() {
		const m = await (await this.fetch(new URL("manifest.json", this.#base))).json();
		this.#dirs.set("/", new Set());
		for (const [p, size] of Object.entries(m)) {
			this.#files.set(p, size);
			let child = p;
			for (let d = p.slice(0, p.lastIndexOf("/")) || "/"; ; d = d.slice(0, d.lastIndexOf("/")) || "/") {
				if (!this.#dirs.has(d)) this.#dirs.set(d, new Set());
				this.#dirs.get(d).add(child.slice(child.lastIndexOf("/") + 1));
				if (d === "/") break;
				child = d;
			}
		}
	}
	async stats(path) {
		await this.#ready;
		if (this.#files.has(path)) return { kind: "file", size: this.#files.get(path), lastModified: 0 };
		return this.#dirs.has(path) ? { kind: "directory" } : undefined;
	}
	async exists(path) { return (await this.stats(path)) !== undefined; }
	async *list(path) {
		await this.#ready;
		for (const name of [...(this.#dirs.get(path) ?? [])].sort()) {
			const p = path === "/" ? `/${name}` : `${path}/${name}`;
			yield { name, path: p, ...(await this.stats(p)) };
		}
	}
	async *read(path, { start = 0, length } = {}) {
		await this.#ready;
		const size = this.#files.get(path);
		if (size === undefined) return;
		const end = Math.min(size, length === undefined ? size : start + length);
		if (end <= start) return;
		const r = await this.fetch(new URL("." + path, this.#base), { headers: { range: `bytes=${start}-${end - 1}` } });
		yield new Uint8Array(await r.arrayBuffer());
	}
	async write() { throw new Error("read-only"); }
	async mkdir() { throw new Error("read-only"); }
	async remove() { return false; }
	async move() { return false; }
	async copy() { return false; }
}
```

### `scenario.mjs`: The logging proxy and the filtered-view scenario

```js
// One scenario for every host: a filtered, guarded FilesApi mounted in the
// guest; every call that reaches the view and the backing stores is logged.
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { writeText, readText } from "@statewalker/webrun-files";
import { CompositeFilesApi, FilteredFilesApi, GuardedFilesApi, newPathFilter, readOnly } from "@statewalker/webrun-files-composite";
import { filesApiFs } from "./files-api-fs.mjs";

export function logged(files, name, log) {
	return new Proxy(files, { get(t, k) {
		const v = t[k];
		if (typeof v !== "function") return v;
		return (...a) => {
			const entry = { at: name, op: k, path: a[0], bytes: 0 };
			if (k === "read") entry.range = a[1] ? [a[1].start ?? 0, a[1].length ?? null] : null;
			log.push(entry);
			const r = v.apply(t, a);
			if (k === "read") return (async function* () { for await (const c of r) { entry.bytes += c.length; yield c; } })();
			return r;
		};
	} });
}

export async function makeView({ direct = false } = {}) {
	const log = [];
	const input = new MemFilesApi(), output = new MemFilesApi();
	await writeText(input, "/data.csv", "a,b\n1,2\n");
	await writeText(input, "/.private/secret.txt", "TOP SECRET\n");
	const big = new Uint8Array(8 << 20).fill(65);
	await input.write("/big.bin", [big]);
	await output.mkdir("/");
	const view = new CompositeFilesApi(new MemFilesApi())
		.mount("/input", readOnly(new FilteredFilesApi(logged(input, "input-store", log), newPathFilter("/.private"))))
		.mount("/output", new GuardedFilesApi(logged(output, "output-store", log), [{ operations: ["write"], check: (p) => p.endsWith(".txt") }]));
	const fs = filesApiFs(logged(view, "view", log), { direct });
	return { fs, log, input, output };
}

const STEPS = [
	["read a visible file", "cat /mnt/f/input/data.csv"],
	["list: hidden dir absent", "ls -a /mnt/f/input"],
	["read hidden file (expect fail)", "cat /mnt/f/input/.private/secret.txt; echo rc=$?"],
	["read 100 bytes of an 8 MiB file", "head -c 100 /mnt/f/input/big.bin | wc -c"],
	["read the same file again (guest page cache?)", "cat /mnt/f/input/data.csv >/dev/null; sleep 2; cat /mnt/f/input/data.csv >/dev/null; echo ok"],
	["write allowed .txt", "echo guest > /mnt/f/output/a.txt && echo more >> /mnt/f/output/a.txt; echo rc=$?"],
	["write refused .bin (expect fail)", "echo x > /mnt/f/output/a.bin; echo rc=$?"],
	["delete in read-only input (expect fail)", "rm /mnt/f/input/data.csv; echo rc=$?"],
];

export async function runScenario(vm, ctx) {
	const { log, output, input } = ctx;
	const report = { steps: [] };
	await vm.exec("true", []); // waits for the mounts
	report.atSessionStart = { calls: log.length, storeReads: log.filter((e) => e.op === "read").map((e) => `${e.at}:${e.path}`), ops: log.map((e) => `${e.at}.${e.op}(${e.path})`) };
	for (const [name, cmd] of STEPS) {
		const from = log.length;
		const r = await vm.exec("sh", ["-c", cmd]);
		const calls = log.slice(from);
		report.steps.push({ name, out: (r.stdout + r.stderr).trim().slice(0, 200),
			viewCalls: calls.filter((e) => e.at === "view").map((e) => `${e.op}(${e.path}${e.range ? " " + JSON.stringify(e.range) : ""})`).join(" "),
			storeCalls: calls.filter((e) => e.at !== "view").map((e) => `${e.at}.${e.op}(${e.path})${e.op === "read" ? `=${e.bytes}B` : ""}`).join(" "),
		});
	}
	report.hostSees = { "a.txt": await readText(output, "/a.txt"), "a.bin exists": await output.exists("/a.bin"), "data.csv still": await input.exists("/data.csv") };
	report.secretReadFromStore = log.some((e) => e.at === "input-store" && e.op === "read" && String(e.path).includes(".private"));
	report.bigBytesRead = log.filter((e) => e.op === "read" && String(e.path).endsWith("big.bin")).reduce((a, e) => Math.max(a, e.bytes), 0);
	return report;
}
```

### `oci/pull.mjs`: The registry puller

```js
// Pulls an OCI/Docker image for linux/arm64 from a registry into a FilesApi:
// /images/<name>/image.json (config + layer list) and /layers/<diffid>.tar, the
// layers uncompressed (a tar can then be read by range, as tabc does).
// Portable: fetch, DecompressionStream, Web Crypto, FilesApi.
const ACCEPT = [
	"application/vnd.oci.image.index.v1+json", "application/vnd.docker.distribution.manifest.list.v2+json",
	"application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

function parseRef(ref) {
	let [name, tag = "latest"] = ref.split(":");
	let registry = "registry-1.docker.io";
	if (name.includes(".") && name.split("/")[0].includes(".")) { [registry, ...name] = name.split("/"); name = name.join("/"); }
	else if (!name.includes("/")) name = `library/${name}`;
	return { registry, name, tag };
}

async function token(registry, name, fetchFn) {
	const probe = await fetchFn(`https://${registry}/v2/`);
	const h = probe.headers.get("www-authenticate");
	if (!h) return undefined;
	const p = Object.fromEntries([...h.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
	const u = new URL(p.realm);
	if (p.service) u.searchParams.set("service", p.service);
	u.searchParams.set("scope", `repository:${name}:pull`);
	return (await (await fetchFn(u)).json()).token;
}

export async function pullImage(ref, files, { fetchFn = (...a) => fetch(...a), platform = { os: "linux", architecture: "arm64" }, log = () => {} } = {}) {
	const { registry, name, tag } = parseRef(ref);
	const tok = await token(registry, name, fetchFn);
	const get = (path, accept) => fetchFn(`https://${registry}/v2/${name}/${path}`, { headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(accept ? { accept } : {}) } });
	let m = await (await get(`manifests/${tag}`, ACCEPT)).json();
	if (m.manifests) {
		const pick = m.manifests.find((d) => d.platform?.os === platform.os && d.platform?.architecture === platform.architecture);
		if (!pick) throw new Error(`${ref}: no ${platform.os}/${platform.architecture} image`);
		m = await (await get(`manifests/${pick.digest}`, ACCEPT)).json();
	}
	const config = await (await get(`blobs/${m.config.digest}`)).json();
	const layers = [];
	for (const [i, l] of m.layers.entries()) {
		const diffId = config.rootfs.diff_ids[i];
		const path = `/layers/${diffId.replace(":", "-")}.tar`;
		if (!(await files.exists(path))) {
			const res = await get(`blobs/${l.digest}`);
			if (!res.ok) throw new Error(`${l.digest}: HTTP ${res.status}`);
			let body = res.body;
			if (/gzip/.test(l.mediaType)) body = body.pipeThrough(new DecompressionStream("gzip"));
			else if (/zstd/.test(l.mediaType)) throw new Error(`${l.digest}: zstd layers are not handled here`);
			await files.write(path, body);
		}
		const s = await files.stats(path);
		layers.push({ path, size: s.size, compressed: l.size, digest: l.digest });
		log(`${ref}: layer ${i + 1}/${m.layers.length} ${(l.size / 1e6).toFixed(1)} MB -> ${(s.size / 1e6).toFixed(1)} MB`);
	}
	const image = { ref, registry, name, tag, config: config.config ?? {}, architecture: config.architecture, layers };
	await files.write(`/images/${ref.replace(/[/:]/g, "_")}.json`, [new TextEncoder().encode(JSON.stringify(image, null, 1))]);
	return image;
}
```

### `oci/layers-fs.mjs`: The layer index and the merged tree as an `Fs`

```js
// An OCI image's root file system served to unkernel as an `Fs`, read straight
// out of its uncompressed layer tars in a FilesApi (as tabc's LayerTree does):
// nothing is unpacked. indexLayers() reads every layer's headers once and
// records each entry (mode, owner, times, link target, where its bytes are);
// the index is JSON, kept beside the layers, so a host loads it with one read.
// layersFs() merges the layers (whiteouts, opaque directories, hard links) and
// answers getattr/readdir/open/readlink; each file read is a ranged FilesApi read.

const dec = new TextDecoder();
const str = (b, o, n) => { const s = b.subarray(o, o + n); const z = s.indexOf(0); return dec.decode(z < 0 ? s : s.subarray(0, z)); };
const oct = (b, o, n) => {
	if (b[o] & 0x80) { let v = 0; for (let i = o + 1; i < o + n; i++) v = v * 256 + b[i]; return v; } // base-256
	const s = str(b, o, n).trim(); return s ? parseInt(s, 8) : 0;
};

function parsePax(text) {
	const out = {};
	let i = 0;
	const bytes = new TextEncoder().encode(text);
	while (i < bytes.length) {
		const sp = bytes.indexOf(0x20, i); const len = parseInt(dec.decode(bytes.subarray(i, sp)), 10);
		if (!(len > 0)) break;
		const rec = dec.decode(bytes.subarray(sp + 1, i + len - 1)); const eq = rec.indexOf("=");
		out[rec.slice(0, eq)] = rec.slice(eq + 1); i += len;
	}
	return out;
}

/** Index one uncompressed tar of a FilesApi: [{ p, t, m, u, g, s, mt, o, l }]. */
export async function indexTar(files, path) {
	const entries = [];
	// buf holds tar bytes [base, base + buf.length); chunks arrive in order from `next`.
	let buf = new Uint8Array(0), base = 0, next = 0;
	let pos = 0, skipTo = 0, pax = {}, longName = null, longLink = null;
	const it = files.read(path)[Symbol.asyncIterator]();
	let done = false;
	const need = async (n) => { // make [pos, pos + n) available in buf
		if (pos > base) { const drop = Math.min(pos - base, buf.length); buf = buf.subarray(drop); base += drop; }
		while (!done && pos + n > base + buf.length) {
			const r = await it.next();
			if (r.done) { done = true; break; }
			let c = r.value; const cStart = next; next += c.length;
			if (next <= pos) { base = next; buf = new Uint8Array(0); continue; } // all before pos: skip
			if (cStart < pos) c = c.subarray(pos - cStart);
			if (buf.length === 0) { base = Math.max(cStart, pos); buf = c; }
			else { const nb = new Uint8Array(buf.length + c.length); nb.set(buf); nb.set(c, buf.length); buf = nb; }
		}
		return pos + n <= base + buf.length;
	};
	for (;;) {
		pos = skipTo;
		if (!(await need(512))) break;
		const h = buf.subarray(pos - base, pos - base + 512);
		if (h.every((x) => x === 0)) break;
		const size = oct(h, 124, 12), type = String.fromCharCode(h[156] || 48);
		const dataOff = pos + 512;
		skipTo = dataOff + Math.ceil(size / 512) * 512;
		if (type === "x" || type === "g" || type === "L" || type === "K") {
			pos = dataOff;
			await need(size);
			const text = dec.decode(buf.subarray(pos - base, pos - base + size));
			if (type === "x") pax = parsePax(text);
			else if (type === "L") longName = text.replace(/\0+$/, "");
			else if (type === "K") longLink = text.replace(/\0+$/, "");
			continue;
		}
		const prefix = str(h, 345, 155);
		let name = pax.path ?? longName ?? (prefix ? `${prefix}/${str(h, 0, 100)}` : str(h, 0, 100));
		const link = pax.linkpath ?? longLink ?? str(h, 157, 100);
		const realSize = pax.size !== undefined ? Number(pax.size) : size;
		name = "/" + name.replace(/^\.?\/+/, "").replace(/\/+$/, "");
		const t = { "0": "f", "7": "f", "1": "h", "2": "l", "5": "d", "3": "c", "4": "b", "6": "p" }[type] ?? "f";
		entries.push({ p: name === "/" ? "/" : name, t, m: oct(h, 100, 8) & 0o7777, u: Number(pax.uid ?? oct(h, 108, 8)), g: Number(pax.gid ?? oct(h, 116, 8)),
			s: t === "f" ? realSize : 0, ...(t === "c" && oct(h, 329, 8) === 0 && oct(h, 337, 8) === 0 ? { wh: 1 } : {}), mt: Math.round(Number(pax.mtime ?? oct(h, 136, 12)) * 1000), o: dataOff, ...(t === "l" || t === "h" ? { l: link } : {}) });
		pax = {}; longName = null; longLink = null;
	}
	return entries;
}

export async function indexImage(files, image) {
	const index = [];
	for (const l of image.layers) index.push({ path: l.path, entries: await indexTar(files, l.path) });
	return index;
}

const err = (code) => Object.assign(new Error(code), { code });

/** The merged tree of an index (lowest layer first) as an unkernel Fs. */
export function layersFs(files, index) {
	let nextIno = 2;
	const mkdir = () => ({ t: "d", m: 0o755, u: 0, g: 0, mt: 0, kids: new Map(), ino: nextIno++ });
	const root = mkdir(); root.ino = 1;
	const walk = (p, create) => {
		let n = root;
		for (const part of p.split("/").filter(Boolean)) {
			if (n.t !== "d") return undefined;
			let k = n.kids.get(part);
			if (!k) { if (!create) return undefined; k = mkdir(); n.kids.set(part, k); }
			n = k;
		}
		return n;
	};
	for (const layer of index) {
		for (const e of layer.entries) {
			const slash = e.p.lastIndexOf("/");
			const dir = e.p.slice(0, slash) || "/", base = e.p.slice(slash + 1);
			if (e.p === "/") { Object.assign(root, { m: e.m, u: e.u, g: e.g, mt: e.mt }); continue; }
			const parent = walk(dir, true);
			if (base === ".wh..wh..opq") { parent.kids.clear(); continue; }
			if (base.startsWith(".wh.")) { parent.kids.delete(base.slice(4)); continue; }
			if (e.wh) { parent.kids.delete(base); continue; } // overlayfs whiteout (char 0:0) in a layer exported from an upper dir
			if (e.p.startsWith("/.wh.")) continue;
			if (e.t === "h") { // hard link: same data as its target (within this image)
				const target = walk("/" + e.l.replace(/^\.?\/+/, ""), false);
				if (target) parent.kids.set(base, target);
				continue;
			}
			const prev = parent.kids.get(base);
			if (e.t === "d") {
				const d = prev?.t === "d" ? prev : mkdir();
				Object.assign(d, { m: e.m, u: e.u, g: e.g, mt: e.mt });
				parent.kids.set(base, d);
			} else parent.kids.set(base, { t: e.t, m: e.m, u: e.u, g: e.g, mt: e.mt, s: e.s, o: e.o, l: e.l, file: layer.path, ino: nextIno++ });
		}
	}
	const node = (p) => { const n = walk(p, false); if (!n) throw err("ENOENT"); return n; };
	const TYPE = { d: "dir", f: "file", l: "symlink" };
	const attr = (n) => ({ type: TYPE[n.t] ?? "file", mode: n.m, uid: n.u, gid: n.g, size: n.t === "f" ? n.s : n.t === "l" ? n.l.length : 4096, mtimeMs: n.mt, ctimeMs: n.mt, atimeMs: n.mt, ino: n.ino });
	return {
		getattr: (p) => attr(node(p)),
		readdir: (p) => { const n = node(p); if (n.t !== "d") throw err("ENOTDIR"); return [...n.kids].filter(([, k]) => TYPE[k.t]).map(([name, k]) => ({ name, type: TYPE[k.t], ino: k.ino })); },
		readlink: (p) => { const n = node(p); if (n.t !== "l") throw err("EINVAL"); return n.l; },
		open(p) {
			const n = node(p);
			if (n.t === "d") throw err("EISDIR");
			return {
				async read(offset, length) {
					const len = Math.max(0, Math.min(length, n.s - offset));
					if (!len) return new Uint8Array(0);
					const out = new Uint8Array(len); let o = 0;
					for await (const c of files.read(n.file, { start: n.o + offset, length: len })) { out.set(c.subarray(0, len - o), o); o += c.length; if (o >= len) break; }
					return out;
				},
				getattr: () => attr(n),
			};
		},
		statfs: () => ({ bsize: 4096 }),
		stats: () => { let f = 0, d = 0, bytes = 0; const seen = new Set(); const rec = (n) => { if (seen.has(n)) return; seen.add(n); if (n.t === "d") { d++; for (const k of n.kids.values()) rec(k); } else { f++; bytes += n.t === "f" ? n.s : 0; } }; rec(root); return { files: f, dirs: d, bytes }; },
	};
}
```

### `oci/run.mjs`: Guest setup (overlay, chroot) and the measured run

```js
// Runs a program of an OCI image in an unkernel guest, as tabc does: the base
// shell boots (no distro), the image is mounted read-only over 9p from its layer
// tars (layersFs, a FilesApi underneath), and the guest builds an overlay root
// (tmpfs upper) and chroots into it. Each program runs in a cgroup of its own,
// so the guest kernel reports its peak memory and CPU time.
import { readText } from "@statewalker/webrun-files";
import { layersFs } from "./layers-fs.mjs";

export const imageKey = (ref) => ref.replace(/[/:]/g, "_");

export async function loadImage(files, ref) {
	const image = JSON.parse(await readText(files, `/images/${imageKey(ref)}.json`));
	const index = JSON.parse(await readText(files, `/images/${imageKey(ref)}.index.json`));
	return { image, fs: layersFs(files, index) };
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** The guest commands that build /oci/root over /oci/lower (once per kernel). */
export const SETUP = [
	"set -e",
	"mkdir -p /oci/up /oci/root",
	"mount -t tmpfs -o size=256m tmpfs /oci/up",
	"mkdir -p /oci/up/u /oci/up/w",
	"mount -t overlay overlay -o lowerdir=/oci/lower,upperdir=/oci/up/u,workdir=/oci/up/w /oci/root",
	"for d in proc sys dev tmp work; do mkdir -p /oci/root/$d; done",
	"mount -t proc proc /oci/root/proc",
	"mount --bind /sys /oci/root/sys",
	"mount --bind /dev /oci/root/dev",
	"mount -t tmpfs tmpfs /oci/root/tmp",
	"if [ -d /work ]; then mount --bind /work /oci/root/work; fi",
	"if [ -d /data ]; then mkdir -p /oci/root/data && mount --bind /data /oci/root/data; fi",
	"if [ -d /out ]; then mkdir -p /oci/root/out && mount --bind /out /oci/root/out; fi",
	"if [ -d /pkgs ]; then mkdir -p /oci/root/pkgs && mount --bind /pkgs /oci/root/pkgs; fi",
	"echo +memory +cpu > /sys/fs/cgroup/cgroup.subtree_control || true",
].join("\n");

let runNo = 0;
/**
 * One program in the image's root: { exitCode, out, peakMiB (the program's VmHWM),
 * guestUsedMiB (the guest's MemAvailable drop at its lowest), cpuMs (its cgroup's CPU) }.
 */
export async function runInImage(vm, image, argv, { cwd = "/work", env = {} } = {}) {
	const n = ++runNo, cg = `/sys/fs/cgroup/run${n}`;
	const envs = [...(image.config.Env ?? []), "HOME=/root", ...Object.entries(env).map(([k, v]) => `${k}=${v}`)];
	// The program, as a script inside the image's root: no quoting through layers of sh -c.
	const inner = [`cd ${q(cwd)}`, ...envs.map((e) => `export ${q(e)}`), `exec ${argv.map(q).join(" ")}`].join("\n") + "\n";
	const w = await vm.exec("sh", ["-c", `cat > /oci/root/tmp/run${n}.sh`], { user: "root", input: inner });
	if (w.exitCode) throw new Error("writing the run script: " + w.stderr);
	const outer = [
		`mkdir ${cg}`,
		"base=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)",
		`sh -c 'echo $$ > ${cg}/cgroup.procs; exec chroot /oci/root /usr/bin/env -i /bin/sh /tmp/run${n}.sh' > /tmp/out${n} 2>&1 &`,
		"pid=$!; hwm=0; low=$base",
		"while kill -0 $pid 2>/dev/null; do",
		"  h=$(awk '/VmHWM/ {print $2}' /proc/$pid/status 2>/dev/null); [ -n \"$h\" ] && [ \"$h\" -gt \"$hwm\" ] && hwm=$h",
		"  for c in $(cat /proc/$pid/task/*/children 2>/dev/null); do h=$(awk '/VmHWM/ {print $2}' /proc/$c/status 2>/dev/null); [ -n \"$h\" ] && [ \"$h\" -gt \"$hwm\" ] && hwm=$h; done",
		"  a=$(awk '/MemAvailable/ {print $2}' /proc/meminfo); [ \"$a\" -lt \"$low\" ] && low=$a",
		"  sleep 0.05",
		"done",
		"wait $pid; rc=$?",
		`cat /tmp/out${n}; echo "@@rc=$rc hwm=$hwm used=$((base - low)) cpu=$(grep usage_usec ${cg}/cpu.stat | cut -d' ' -f2)"`,
	].join("\n");
	const r = await vm.exec("sh", ["-c", outer], { user: "root" });
	const m = /@@rc=(\d+) hwm=(\d*) used=(-?\d*) cpu=(\d*)/.exec(r.stdout);
	return { exitCode: m ? Number(m[1]) : r.exitCode, out: r.stdout.replace(/@@rc=.*\n?$/, "").trim(), err: r.stderr.trim(),
		peakMiB: m ? +(Number(m[2]) / 1024).toFixed(1) : null, guestUsedMiB: m ? +(Number(m[3]) / 1024).toFixed(1) : null,
		cpuMs: m?.[4] ? Math.round(Number(m[4]) / 1000) : null };
}
```

### `oci/build.mjs`: App images built in the guest

```js
// Builds an app image without Docker: boot the base image, add scripts, run its
// install steps in the chroot (packages from a read-only /pkgs), then export the
// overlay's upper directory as one more layer tar into the image store. The new
// image is the base's layers plus that layer, with the app's command.
import { createKernel } from "unkernel";
import { readText } from "@statewalker/webrun-files";
import { filesApiFs } from "../files-api-fs.mjs";
import { imageKey, loadImage, runInImage, SETUP } from "./run.mjs";
import { indexImage } from "./layers-fs.mjs";

export async function buildImage(store, pkgs, { from, name, files = {}, steps = [], cmd, workdir = "/app", env = [], memoryMiB = 512 }) {
	const { image, fs } = await loadImage(store, from);
	const t0 = performance.now();
	const vm = await createKernel({ memoryMiB, mounts: { "/oci/lower": { fs, readOnly: true }, "/out": filesApiFs(store), ...(pkgs ? { "/pkgs": filesApiFs(pkgs, { readOnly: true }) } : {}) } });
	const log = [];
	try {
		const s = await vm.exec("sh", ["-c", SETUP], { user: "root" });
		if (s.exitCode) throw new Error("setup: " + s.stdout + s.stderr);
		for (const [path, text] of Object.entries(files)) {
			const w = await vm.exec("sh", ["-c", `mkdir -p "$(dirname /oci/root${path})" && cat > /oci/root${path}`], { user: "root", input: text });
			if (w.exitCode) throw new Error(`writing ${path}: ${w.stderr}`);
		}
		for (const step of steps) {
			const t = performance.now();
			const r = await runInImage(vm, { config: { ...image.config, Env: [...(image.config.Env ?? []), ...env] } }, ["sh", "-c", step], { cwd: workdir });
			log.push(`  RUN ${step.slice(0, 90)}: ${((performance.now() - t) / 1000).toFixed(1)} s, exit ${r.exitCode}`);
			if (r.exitCode) throw new Error(`step failed: ${step}\n${r.out.slice(-800)}`);
		}
		// The mount points SETUP made in the upper dir and caches are not part of the layer.
		const layerPath = `/layers/app-${imageKey(name)}.tar`;
		const t = performance.now();
		const x = await vm.exec("sh", ["-c", [
			"cd /oci/up/u",
			"rm -rf root/.cache root/.npm tmp/* 2>/dev/null; for d in proc sys dev tmp work data out pkgs; do rmdir $d 2>/dev/null; done",
			`tar -cf /out${layerPath} .`, `ls -la /out${layerPath}`].join(" && ")], { user: "root" });
		if (x.exitCode) throw new Error("export: " + x.stdout + x.stderr);
		log.push(`  export layer: ${((performance.now() - t) / 1000).toFixed(1)} s`);
		const s2 = await store.stats(layerPath);
		const built = { ref: name, config: { ...image.config, Env: [...(image.config.Env ?? []), ...env], Cmd: cmd, WorkingDir: workdir }, architecture: image.architecture,
			layers: [...image.layers, { path: layerPath, size: s2.size, compressed: null, digest: null }] };
		await store.write(`/images/${imageKey(name)}.json`, [new TextEncoder().encode(JSON.stringify(built, null, 1))]);
		const index = await indexImage(store, built);
		await store.write(`/images/${imageKey(name)}.index.json`, [new TextEncoder().encode(JSON.stringify(index))]);
		return { image: built, log, ms: performance.now() - t0, layerBytes: s2.size };
	} finally { vm.write("poweroff\n"); await vm.exited; }
}
```
