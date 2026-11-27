# unkernel for JS and Python: Docker images, resources, and Wasmer or QuickJS?

Research for `statewalker/statewalker-root#437`, continuing
`docs/research/unkernel-on-cellb-and-workerd.md` (hosts, FilesApi mounts, runtimes from npm).
Sources read and experiments run on 2026-11-27. Every claim is marked **(verified)** (an experiment
in this session), **(sourced)** (code or docs, cited) or **(inference)**.

Versions: unkernel `0.2.0-261126-fd204d3`, tabc at `fzakaria/tabc@9c38eb7`, Node 24.22, workerd
`2026-11-25` (`wrangler dev`). One 4-vCPU, 16 GB Linux VM.

**Decision:** unkernel is not integrated now ([unkernel-not-integrated-now](../adr/2026-11-27-unkernel-not-integrated-now.md)); the procedure and conclusion are in `docs/research/unkernel-evaluation-procedure.md`.

## Questions

1. What does each case cost: memory (guest and host), CPU, start, I/O?
2. Can we get ready-to-use images, from unkernel's releases or elsewhere on GitHub?
3. [tabc](https://github.com/fzakaria/tabc) runs Docker images on unkernel. Can its ideas let a DO
   run containerd- or Docker-style images?
4. Is unkernel a good execution environment for JS and Python? Where is it better or worse than
   Wasmer (WASIX) and QuickJS?

## Short answer

- **Official Docker Hub images run unchanged** in an unkernel guest, inside a cellb or workerd DO,
  with no Docker daemon and no unpacking (verified). The images were `alpine:3.22`,
  `python:3.13-alpine`, `node:24-alpine`, `oven/bun:1-alpine` and `denoland/deno:alpine`, arm64
  builds.
  - Pull: a 60-line puller using only `fetch`, `DecompressionStream` and a FilesApi stores each
    layer uncompressed (1.4 to 3 s per image).
  - Index: tabc's idea, read every layer tar's headers once into a JSON index (under 0.5 MB, 0.2 to
    0.7 s per image).
  - Serve: a small unkernel `Fs` serves the merged tree (modes, owners, symlinks, hard links,
    whiteouts), each file read a ranged FilesApi read of a layer tar.
  - Run: as tabc's init does, the guest puts a tmpfs overlay on top, then mounts, chroots and runs.
- **Ready-made images.** unkernel's releases ship only `alpine.erofs` (4 MB) and `debian.erofs`
  (74 MB) and their `distros.json` (sourced, verified). Neither carries Node or Python. They carry a
  shim that downloads `node`, `bun` or `uv` on first use, which needs the guest's network (sourced).
  tabc ships no images either: it uses the registry's. So the registry is the image source. The
  OCI route above uses images as published, and building a new erofs distro is not needed.
- **Costs (Node host, verified).**
  - Host, kernel only: an idle kernel costs about 60 to 67 MiB of host memory, whatever its guest
    memory size (64 to 512 MiB, committed lazily), and starts in about 0.2 s. One process kept 8 of
    them answering, one per worker thread.
  - Guest, per runtime: Python's peak RSS is about 13.5 MiB, Bun's about 23, Deno's about 29 and
    Node's about 64 to 70.
  - Speed: warm runs take 0.15 to 0.4 s (Bun, Deno), 0.7 s (Python) and 1.8 s (Node). Cold runs add
    the first reads of the image: 8 MB (Python) to 54 MB (Node).
  - Compute is 30 to 45 times slower than native.
  - Every image also ran with 64 MiB of guest memory, though Node then thrashes its page cache.
  - The tables are in section 3.
- **Snapshots cut the cold start.** A warmed kernel snapshots in 31 to 39 ms into 18 to 21 MiB
  (3.8 MiB gzipped) and restores in 70 to 82 ms. The first Python run after a restore took 0.9 s,
  against 3.0 s cold (verified). That suits a DO that hibernates (inference).
- **Pre-installed images, data on the FilesApi (section 8).** This is how containers are meant to
  be used here. The runtime, its packages and the scripts are in the image, and the FilesApi
  mounted at `/data` carries only the job's input and output.
  - **Build without Docker (verified):** the guest runs the install steps over the base image,
    and its overlay's upper directory is exported as one more layer tar into the image store.
    That took 108 s for numpy (all of it `pip`) and 37 s for lodash.
  - **Run:** each run touched the data FilesApi only for its own files (7 to 12 calls), and the
    image never through it.
  - **Workers beat processes:** with a long-lived worker process in the guest (numpy imported
    once, 2.5 s), each job took **14 to 19 ms**, against 2.9 s for a fresh `python3` per job.
- **Real package managers work, offline.** Inside the official images, `pip` installed `numpy` (a
  musl wheel with C extensions) and `requests`, and numpy then ran its native code. `npm` installed
  esbuild with its native arm64 binary, which Node then spawned. The packages came from a read-only
  FilesApi (verified). Installs are slow under emulation: 124 s for numpy, 53 s for esbuild. They
  belong in an image build step, not in each run.
- **Against Wasmer and QuickJS (section 7).** unkernel trades speed and memory for compatibility.
  - It runs any arm64 Linux program, the official images, and native wheels and modules: real
    Node, Bun, Deno and CPython. Wasmer runs only WASIX builds (no Node, no C-extension wheels
    unless rebuilt), and QuickJS is not Node.
  - It runs inside a workerd DO, where Wasmer cannot (no threads). QuickJS and CPython-on-WASI
    can too, and cost less there.
  - It costs more: 60+ MiB per kernel against 17 to 28 MiB per QuickJS sandbox. Python starts in
    0.7 s warm against about 0.1 to 0.2 s for CPython on WASI.
  - It is new and unaudited, and its kernel is GPL-2.0 (the SDK is MIT).
  - Recommendation at the time of the experiment (inference), superseded by [unkernel-not-integrated-now](../adr/2026-11-27-unkernel-not-integrated-now.md): unkernel is not integrated now:
    use unkernel where compatibility matters (real `npm`/`pip` packages, CLIs, native modules,
    Docker images), and keep QuickJS or WASI CPython for short, pure scripts.
- **workerd caveat, still open.** Kernels in a workerd DO stall intermittently: the same request
  succeeds, then hangs on the next try (section 6). alpine, Python and Bun images did run there.
  Fetch counts, concurrency limits, kernels per isolate and the image do not explain it, and
  plain Node never stalled with the same code. It worked on cellb; it is not usable on workerd yet.

## Findings

### 1. Ready-to-use images

- **unkernel's releases (sourced, verified).** Each release carries the npm tarball,
  `unkernel.wasm`, the two distro images and `distros.json`
  (`.github/workflows/release.yml`, lines 6-13 and 285-310, which checks that exactly `alpine` and
  `debian` are listed). This release's index: `alpine.erofs` (4,046,848 bytes,
  `alpine-3.24.4-ec18c6bbda42c6ed`) and `debian.erofs` (77,819,904 bytes, `debian-13.7-19d99edab284a175`),
  each with its SHA-256, `fetchDistro()` downloading and checking them.
  - `createKernel({ distro })` also takes any erofs or ext4 image file, URL, disk spec or
    `BlockDevice`.
  - A new distro is a `guest/distro/NAME/` with pins to an upstream rootfs tarball, a build script
    and an init that runs `kwbox tty serve` (`guest/README.md`, "Adding a distro").
  - Building one needs unkernel's toolchain (Zig 0.16, clang 21, erofs-utils; `./setup.sh`).
- **What the images hold (verified).** Neither has `python3`, `deno` or `gcc`. Alpine has `apk`,
  `curl`, `wget`; Debian has `apt-get`, `perl`, `curl`. Both have `/usr/lib/kw/bin/{node,npm,npx,bun,bunx,uv,uvx,claude,opencode,fx}`,
  links to one shim (`guest/base/rootfs/usr/lib/kw/shim`). On first use the shim downloads:
  - Node from nodejs.org (unofficial-builds' musl build on Alpine);
  - Bun from the npm registry;
  - uv from astral.sh, after which `uv python install` gets Python.

  Everything lands in `~/.local/bin`. Nothing is checked against a published checksum (the shim's
  own comment).
- **GitHub otherwise.** No other ready-made unkernel images were found; tabc ships none (it pulls
  from registries).
- **The registry route is the useful one (verified).** Docker Hub answered from this sandbox (GHCR,
  ECR Public and the GCR mirror too; GitHub's release pages were refused by its proxy, release
  downloads were not). Pulled for `linux/arm64`, sizes compressed → uncompressed:

| Image | Layers, compressed → uncompressed | Files / dirs | Index (JSON) | Pull / index time |
|---|---|---|---|---|
| `alpine:3.22` | 4.1 → 8.8 MB | 422 / 98 | 0.06 MB | 1.9 s / 0.05 s |
| `python:3.13-alpine` | 17.4 → 51.6 MB | 2,723 / 372 | 0.44 MB | 1.4 s / 0.22 s |
| `node:24-alpine` | 62.3 → 169.5 MB | 2,890 / 605 | 0.49 MB | 2.7 s / 0.69 s |
| `oven/bun:1-alpine` | 58.2 → 114.8 MB | 432 / 100 | 0.06 MB | 2.7 s / 0.47 s |
| `denoland/deno:alpine` | 47.8 → 99.3 MB | 449 / 102 | 0.06 MB | 3.0 s / 0.41 s |

### 2. tabc: what it does, and what we took (sourced unless marked)

tabc is an OCI runtime like runc. Docker or Podman call `tabc create`/`start`, and tabc starts a
supervisor that runs headless Chromium on a loopback page that boots unkernel
(`README.md`, `docs/design.md`). Its parts:

- **Images.** `tabc run` pulls with go-containerregistry for `linux/arm64` (the guest is always
  aarch64) and keeps every layer as an **uncompressed tar** in a cache, never unpacked
  (`internal/image/image.go`). `LayerTree` reads each layer's headers once, applies whiteouts
  (`.wh.<name>`, `.wh..wh..opq`) and serves each read as a range of the tar
  (`internal/rootfs/layers.go`). The page mounts that tree read-only at `/tabc/lower`, and
  `tabc-init` (a static Go program) builds a tmpfs-over-overlayfs root, mounts, becomes the
  user and execs (`cmd/tabc-init/main.go`).
- **Network.** unkernel's `net` backend sends each TCP connection and each DNS lookup over a
  WebSocket to the supervisor, which dials from inside the container's network namespace. Inbound
  connections come through the page (`docs/design.md`, Network). No UDP.
- **Engines.** It plugs into Docker and Podman as a runtime (`/etc/docker/daemon.json`). Without
  one, `tocker` runs a minimal Docker API daemon, enough for `docker run`, `ps`, `logs` and
  Compose (`internal/dockerapi`, `internal/engine`).
- **CPUs.** Two by default, each extra CPU a Web Worker on shared memory. Kernel and network
  therefore live in a worker of the page (`page/guest.js`).
- **Walls.** The emulator and kernel, then WebAssembly in V8, then Chromium's renderer sandbox,
  then a `nobody` user. The first wall "is new code, and nobody has audited it" (`docs/design.md`).

What we took, in JavaScript and on our own interfaces (verified, the lab code is listed in the
appendix):

| tabc | Here |
|---|---|
| go-containerregistry pull into a cache directory | `pullImage(ref, files)`: `fetch` + `DecompressionStream`, layers as tars in any FilesApi (R2 in production) |
| `LayerTree` built at each start from the tar headers | `indexImage` once, stored as JSON beside the layers; `layersFs(files, index)` serves the merged tree (one FilesApi read to load) |
| supervisor answers file requests over HTTP | the `Fs` runs in the DO, reading through the FilesApi |
| `tabc-init`: overlay, mounts, user, exec | a busybox script run as root through `vm.exec` (`SETUP`, `runInImage`) |
| Docker/Podman/containerd call the runtime | Cloudflare's `ctx.container` API is the interface (`start`, `exec`, `getTcpPort().fetch()`), the DO the runtime |

**Can a DO simulate containerd and use Docker images? (inference)** Partly, and the part that
matters works. containerd's own job splits into three pieces:

- **Image service:** the puller.
- **Snapshotter:** the layer index and the merged `Fs`, read-only, with a tmpfs upper layer in the
  guest.
- **Runtime shim:** the kernel and the chroot.

All three run in a DO with no daemon. What is missing against Docker:

- networks between containers (tabc's directory registry, `internal/netreg`, is a model);
- inbound ports (unkernel's `vm.connect()`/`vm.fetch()` reach guest servers over vsock, which
  cellb-containers' `getTcpPort()` would map onto);
- CPU and memory limits enforced per container (the guest kernel has only the `pids` cgroup
  controller, verified);
- image builds (the guest can run a Dockerfile's `RUN` steps, slowly; see section 4).

Running containerd itself, or acting as its shim, is what tabc does on a Linux host with Docker.
That is not a DO's job.

### 3. Resources per case (verified)

Each case is a fresh Node 24 process, so host memory is not inherited. The kernel boots unkernel's
base shell, the image is mounted from its layers on local disk (`NodeFilesApi`), and the guest has
256 MiB.

- **Host:** the process's peak RSS and its CPU time.
- **Guest:** the program's peak RSS (`VmHWM`, sampled every 50 ms), the guest's `MemAvailable`
  drop at its lowest, and the program's CPU time (its cgroup's `cpu.stat`).
- **FilesApi:** the bytes read from the layers.
- **Programs:** Python runs `fib(22)` and writes a JSON file to `/work`. The JS runtimes run a
  `hello.ts` (a typed `const`, `fib(25)`).

| Case (JIT on) | Boot + setup | Cold run | Warm run | Guest CPU warm | Program peak RSS | Guest used | FilesApi read, cold / warm | Host peak RSS |
|---|---|---|---|---|---|---|---|---|
| alpine `sh -c echo` | 0.27 s | 0.16 s | 0.09 s | 10 ms | 0.8 MiB | 1 MiB | 1.4 / 0 MB | 166 MB |
| python 3.13 | 0.25 s | 3.5 s | 0.77 s | 606 ms | 13.5 MiB | 11 MiB | 7.6 / 0 MB | 262 MB |
| node 24 (`.ts`) | 0.26 s | 2.7 s | 1.78 s | 1,445 ms | 64 to 70 MiB | 24 MiB | 53.7 / 5.0 MB | 369 MB |
| bun 1.4.5 | 0.26 s | 1.5 s | 0.23 s | 126 ms | 24 MiB | 5 MiB | 32.7 / 0.1 MB | 239 MB |
| deno 2.9.8 | 0.24 s | 0.96 s | 0.31 s | 227 ms | 29 MiB | 12 MiB | 31.8 / 0.6 MB | 266 MB |

- **Without the JIT** (as on workerd): warm runs take 1.0× (Python 0.74 s), 1.2× (Deno 0.37 s,
  Bun 0.28 s) and 1.4× (Node 2.47 s) as long. Compute slows by 1.5 to 2.2× (`fib(25)` in Node 70
  against 44 ms, in Bun 119 against 66 ms). Host RSS falls by 35 to 80 MB (Python 197, Node 282,
  Bun 204, Deno 215 MB): the JIT's compiled blocks.
- **Guest memory floor.** All five passed at 256, 128, 96 and 64 MiB. Times stayed flat down to
  96 MiB. At 64 MiB Node's warm run re-read 56 MB from the layers and took 3.1 s (its page cache
  no longer fits); the others did not change.
- **Against native** (same VM): `fib(22)` in CPython 1.4 ms native, 57 to 65 ms in the guest
  (about 45×). Python starts in 11 ms native, 0.66 to 0.77 s warm in the guest. Node 24 starts in
  21 ms native.
- **Lazy loading.** No image is read whole. A cold Node run read 54 of 170 MB, and Bun 33 of
  115 MB.
- **Density** (`worker: true`, one kernel per worker thread, each answering an `exec`, 8 alive in
  one process): process RSS grew from 168 MiB (one kernel) to 542 MiB (eight), 60.6 MiB per kernel
  at 64 MiB of guest memory. That was 65.1 MiB at 256 MiB and 67.2 MiB at 512 MiB. Each started in
  0.19 to 0.22 s, and all eight answered in 12 ms. Add each program's working set from the table.

### 4. Package managers inside the images (verified)

The packages came from a read-only FilesApi at `/pkgs`, fetched by the host. This sandbox's
network rules allow the npm registry and PyPI but not a guest's own connections; the guest ran
with no network.

| Step | Wall | Guest CPU | Peak RSS | Result |
|---|---|---|---|---|
| `pip install --no-index numpy requests` (into the overlay) | 124 s | 100 s | 92.5 MiB | installed |
| `python3 -c 'numpy.linalg.inv(200×200)'` | 3.5 s | 2.9 s | 36 MiB | correct (`allclose` True), the inverse 0.86 s |
| `pip install --target /work/site requests` (into a `MemFilesApi`) | 18 s | 14.6 s | 60 MiB | 407 FilesApi writes |
| `import requests` from `/work/site` | 8.8 s | 7.2 s | 29 MiB | 122 more writes (`.pyc` files) |
| `npm install --offline` esbuild + `@esbuild/linux-arm64` + lodash (overlay) | 53 s | 42 s | 107 MiB | `added 3 packages` |
| `node -e "require('esbuild').transformSync(ts)"` | 2.8 s | 2.3 s | 68 MiB | the native esbuild binary spawned and transformed TS |
| the same npm install into `/work` (FilesApi) | 50 s | 40 s | 110 MiB | **failed**: `ENOTSUP` on symlinking `.bin/esbuild`; with `--no-bin-links` lodash installed, esbuild did not |

- **Native code works:** numpy's OpenBLAS-backed C extensions and esbuild's Go binary ran as
  shipped. Wasmer and QuickJS cannot do this (section 7).
- **A FilesApi has no modes and no symlinks**, so it suits data and pure-Python or pure-JS
  packages, not trees that need executables or links (`node_modules/.bin`, native packages that
  set the exec bit). Put those in the overlay, on a disk image, or in an image layer. Extending the
  adapter with a sidecar for modes and links would also work (inference).
- **Install once, run many.** At 1 to 2 minutes an install, packages belong in the image, built
  once (section 8 builds app images this way), never in a run.

### 5. Snapshots: cold start versus restore (verified)

Boot, warm the program, `vm.snapshot({ stop: true })` and `encodeSnapshot`, then
`createKernel({ restore, mounts })` with the same FilesApi mounts, and run again (inline, guest
128 MiB):

| Image | Boot + setup | Cold / warm run | Snapshot | Size (gzip -1) | Restore | First run after restore |
|---|---|---|---|---|---|---|
| python 3.13 | 0.25 s | 3.0 / 0.66 s | 39 ms | 20.8 MiB (3.8 MiB) | 82 ms | 0.90 s |
| node 24 | 0.25 s | 3.2 / 1.95 s | 31 ms | 18.0 MiB (3.8 MiB) | 70 ms | 2.4 s |

- **Free pages are left out:** 109 to 110 of 128 MiB. A snapshot taken with `stop` drops the
  kernel's file caches first (sourced: `.agents/js.md`, Snapshots), so the first run after a
  restore re-reads the files it needs.
- **What restores:** the mounts come back with their open files (inline mode only; worker mode
  refuses a snapshot while anything is mounted, sourced).
- **What does not:** connections end, except the 9p mounts. The SDK's terminal sessions do not
  carry over unless detached (sourced).
- **For a DO (inference):** a hibernating cell stores a 4 MiB gzipped snapshot in its storage, and
  wakes in about 0.1 s plus the program's first run. A snapshot taken while a server already runs
  in the guest (a Python worker that has imported its libraries) would skip even that, not tested.

### 6. Inside a workerd DO (verified)

Same images, layers and indexes served to the DO by HTTP range requests (standing in for R2),
`jit: false`, guest 256 MiB, base shell (no distro disk needed):

| Image | Index load | Boot + setup | Cold run | Warm run | Guest CPU warm | FilesApi reads, cold |
|---|---|---|---|---|---|---|
| alpine | 4 ms | 0.16 s | 0.15 s | | 12 ms | 31 (1.4 MB) |
| python 3.13 | 13 ms | 0.18 s | 4.2 s | 0.84 s | 679 ms | 166 (7.6 MB) |
| node, bun, deno | see below | | | | | |

The workerd process grew from 93 to 343 MiB with one Python kernel (local workerd enforces no
128 MB limit; production does). With unlimited concurrent fetches, the Node image (770 reads cold)
stalled as in the first note.

The stall is **intermittent, and not explained by anything varied here**. Later runs in the same
setup:

- `oven/bun:1-alpine` read 465 ranges and finished in 2.1 s, so the number of fetches alone does
  not trigger it.
- At most 4 fetches in flight (`HttpFilesApi` `maxConcurrent: 4`) still stalled the Node image.
- A fresh workerd process per app, one kernel in it, still stalled all three app images. So
  several kernels in one isolate are not the cause either.
- The same request, `bun /app/main.ts` in `app/bun-ts`, finished in 1.2 s and wrote its result,
  then stalled on the next identical request in a new DO. alpine ran right after.
- The identical code, image, `jit: false` and `HttpFilesApi` never stalled in plain Node
  (`node-app-http.mjs`: 1.0 s).

When it stalls, the guest stops entirely: no console output, and `kwtty` no longer answers a
second `exec`. The DO itself stays responsive, and workerd logs nothing. The hung kernels keep
their memory: the local workerd process reached 918 MiB.

**Before unkernel is offered on workerd** (inference): reproduce this with the smallest JSPI
program that awaits fetches (no unkernel), then with unkernel's base shell and a synthetic `Fs`,
and report it to whichever owns it. Until then, unkernel is for cellb (Node, browsers), where it
never stalled, and for celld only after testing there.

### 7. unkernel, Wasmer and QuickJS for JS and Python

From this session (unkernel) and earlier notes: `lightweight-containers-on-do-runtimes.md` (CPython
on WASI, QuickJS, measured on workerd and Node 22), `node-python-clis-in-sandbox.md`, and
cellb-containers' `docs/capacity.md` (Wasmer, measured).

| | unkernel | Wasmer (WASIX) | QuickJS (wasm) / CPython on WASI |
|---|---|---|---|
| What runs | any arm64 Linux program: official Docker images, real Node 24, Bun, Deno, CPython, shells, CLIs (verified) | WASIX builds from Wasmer's registry: CPython, PHP, bash, `wasmer/edgejs` (Node-compatible, not Node) | QuickJS (ES2023, no Node API unless shimmed); CPython 3.12 WASI, stdlib only |
| Packages | `pip` and `npm` as on Linux, native wheels and modules (numpy, esbuild verified) | pure-Python packages; C extensions only if rebuilt for WASIX; npm through edgejs, native modules no | none inside; pure-JS bundles or pure-Python code copied in |
| TypeScript | Node's type stripping, Bun, Deno (verified) | through edgejs or a transpiler | transpile first |
| Runs in a workerd DO | yes, base shell or a distro, no JIT (verified); stalls under many concurrent fetches (open) | no: needs threads (`Atomics.wait`, Workers) | yes, in the DO and in a Worker Loader isolate (verified, earlier note) |
| Runs in cellb (Node, browser) | yes, inline and in workers (verified) | yes (cellb-containers today) | yes |
| Files from a FilesApi | 9p, each operation a FilesApi call, ranged reads, no copy (verified); no modes or links in a FilesApi | per operation through Wasmer's host-fs bridge (cellb-containers) | per operation through JSPI (CPython WASI, verified), or copy in |
| Isolation | a Linux kernel in a wasm instance; guest reaches only the devices given; network off unless `net`; first wall unaudited (tabc) | WASIX sandbox in Wasmer's workers | the wasm sandbox; a runaway QuickJS can be interrupted, a WASI `_start` cannot |
| Memory per instance | ~60 to 67 MiB per idle kernel + the program (13.5 MiB Python, 64 to 70 Node) (verified) | 99 MB per Python container in Node, 73 MB in Chromium; ~280 MB engine (sourced, capacity.md) | 17 to 28 MB per QuickJS sandbox; CPython WASI ~50 MB compiled + 10 to 20 MB per run (sourced, earlier notes) |
| Start | kernel 0.2 s; Python warm 0.7 s, cold 3 to 4 s; Bun/Deno warm 0.2 to 0.4 s; restore from snapshot 0.07 to 0.08 s (verified) | 0.4 to 0.5 s per Python container (sourced) | QuickJS 90 ms incl. load in a DO; CPython WASI 90 to 180 ms per run (sourced) |
| Compute | emulated aarch64: ~45× native for CPython, JIT 1.5 to 2× faster than without (verified) | wasm-compiled: a few times native | wasm-compiled, near Wasmer's |
| Size to ship | 11.3 MB kernel (4.4 MB gzip) + images (registry or R2) | SDK 5.6 MB + packages | 0.5 to 1 MB (QuickJS); 26 MB (CPython WASI) |
| Maturity, licence | weeks old (0.2.0 nightlies), one author; kernel GPL-2.0, SDK MIT | Wasmer SDK alpha (0.19.1, patched by us) | QuickJS mature (MIT); CPython WASI tier-2 |

**Why unkernel is worth it (inference from the above):**

- **Compatibility is the whole point.** Agents' tools are real CLIs, `npm`/`pip` packages with
  native parts, and scripts written for Node or CPython. unkernel runs them unchanged, from
  official images, and nothing else here does inside a DO.
- **It works where Wasmer does not.** It needs JSPI, not threads, so it runs in workerd and in
  cellb's cells.
- **Images are standard.** No WASIX ports, no registry of our own, and Docker images are the unit
  people already build.
- **Snapshots give a hibernating DO a 0.1 s wake.**

**Why it is not the only engine:**

- **Memory:** three to six times a QuickJS sandbox, and an emulated CPU.
- **Speed:** short Python scripts start 4 to 8 times faster on CPython-on-WASI, and pure JS
  snippets far faster on QuickJS.
- **workerd risks:** the concurrent-fetch stall is open, and production's 128 MB per isolate is
  unmeasured (a kernel plus Python measured 262 MB host RSS in Node, though Node's own share is
  large).
- **Risk:** new, unaudited, GPL kernel.

**So, at the time of the experiment (inference), superseded by [unkernel-not-integrated-now](../adr/2026-11-27-unkernel-not-integrated-now.md): unkernel is not integrated now; this is the shape to revisit:**

- unkernel as the **compatibility tier**: full Linux containers from images, `npm`/`pip`, native
  code, long-lived sessions with snapshots.
- QuickJS / WASI CPython as the **fast tier**: one-shot pure scripts, many at once, tight memory.
- Wasmer stays on cellb where it already runs, and is not needed where unkernel is offered.

All three behind cellb-containers' `ContainerEngine` port, with the same FilesApi mounts.

### 8. Pre-installed app images, the FilesApi for data only (verified)

**The model.** The runtime, the packages and the scripts are prepared before a run and ship in
the image. The FilesApi mounted in the guest carries only the data the scripts read and write.
It gets no `node_modules`, no `site-packages` and no executables, so the FilesApi's lack of
modes and symlinks (section 4) never matters.

**Building an app image without Docker** (`oci/build.mjs`):

1. Boot the base image (an official one from the registry) with its layers read-only, a tmpfs
   overlay above, and the package source read-only at `/pkgs`.
2. Write the scripts into the root.
3. Run the install steps in the chroot (Dockerfile `RUN` lines, in effect).
4. Tar the overlay's upper directory to the image store as one more layer. Mount points and
   caches are removed first. Overlayfs whiteouts, character devices 0:0 in the upper directory,
   are read back as deletions.
5. The new image is the base's layers plus that layer, with the app's `Cmd` and `WorkingDir`, and
   its index is written beside it.

| App image | Base | Install steps | Build time | App layer |
|---|---|---|---|---|
| `app/py-stats` (numpy over a CSV) | `python:3.13-alpine` | `pip install --no-index numpy`, `python3 -m compileall /app` | 107.6 s (pip 104 s) | 76.4 MB |
| `app/node-report` (lodash over JSON) | `node:24-alpine` | `npm install --offline lodash.tgz` | 37.5 s (npm 34.5 s) | 2.3 MB |
| `app/bun-ts` (TypeScript word count) | `oven/bun:1-alpine` | none (the script only) | 0.8 s | 6 KB |

The first export took 185 s for 76 MB because the `Fs` adapter grew its write buffer to the
exact new size on every write, which is quadratic. Growing it geometrically brought that to
1.2 s. The fixed adapter is in the appendix of `docs/research/unkernel-evaluation-procedure.md`
(the first note's appendix has the first, quadratic version).

**Running them** with the image read-only from the store and a `MemFilesApi` at `/data` (guest
128 MiB; numpy 256 MiB, below which OpenBLAS fails to load with "Out of memory"):

| App | Cold run | Warm run | After snapshot + restore | Peak RSS | Calls to the data FilesApi per run |
|---|---|---|---|---|---|
| py-stats | 3.2 s | 2.9 s | 3.7 s (restore 92 ms) | 27.6 MiB | 8 to 12: `stats`, `read(/input.csv)`, `write(/result.json)` |
| node-report | 2.7 s | 1.4 s | 2.7 s (restore 100 ms) | 56 MiB | 8 to 12: `read(/input.json)`, `write(/report.json)` |
| bun-ts | 0.95 s | 0.23 s | 0.91 s (restore 138 ms) | 26 MiB | 7 to 12: `read(/input.txt)`, `write(/top.json)` |

The data FilesApi saw nothing but the job's own files. Every image byte came from the image
store. A restored kernel's first run is about as slow as a cold one, because a snapshot taken
with `stop` drops the file caches. A snapshot only saves the boot, which is already about 0.2 s.

**A long-lived worker instead of a process per job** (`oci/worker-jobs.mjs`). The image's
`python3` runs a small loop that imports numpy once and then handles job names on its stdin, each
job reading `/data/<job>.csv` and writing `/data/<job>.json`:

| | Time |
|---|---|
| Worker start, numpy import included | 2,535 ms (once) |
| First job | 159 ms |
| Next jobs | 19, 16, 14, 14 ms |

Each job's FilesApi calls were its own two files, about 11 calls. **For a DO this is the shape
to use (inference):**

- one kernel per DO;
- the app's worker processes started from the image when the DO wakes;
- jobs sent to them over stdin (or vsock), data through the FilesApi;
- the kernel snapshotted with the worker idle, so that a hibernated DO wakes with numpy already
  imported. That would need a snapshot without `stop`'s cache drop, and a worker the restore
  keeps (the SDK keeps only detachable terminal sessions and 9p mounts). Not tested.

## Not checked

celld; Cloudflare production limits (memory, CPU per request, the size of an 11 MB wasm module in
a deployed Worker); the guest's own network (blocked here by the sandbox's network policy);
`docker compose`-style networks between kernels; a snapshot taken with a server running;
CPU and memory limits per container; Firefox and Safari.

## Appendix: the lab code (not committed)

- `oci/pull.mjs`: `pullImage(ref, files)`. A registry token (`WWW-Authenticate`), the index's
  `linux/arm64` manifest, the config, then each layer gunzipped into `/layers/<diffid>.tar`.
- `oci/layers-fs.mjs`:
  - `indexTar` / `indexImage`: tar headers, including PAX, GNU long names and base-256 sizes, into
    `{ p, t, m, u, g, s, mt, o, l }` entries.
  - `layersFs(files, index)`: the merged tree (whiteouts, opaque directories, hard links) as an
    unkernel `Fs` (`getattr`, `readdir`, `readlink`, `open().read`, ranged FilesApi reads).
- `oci/run.mjs`:
  - `SETUP`: tmpfs, overlay, proc, sys, dev, tmp, and binds of `/work` and `/pkgs`.
  - `runInImage(vm, image, argv)`: a run script under the image's `Env`, run through `chroot` in a
    cgroup, while `VmHWM`, `MemAvailable` and `cpu.stat` are sampled.
- `oci/bench-node.mjs`, `oci/pkgs.mjs`, `oci/snapshot.mjs`, `density.mjs`: the measurements above.
  `wd3/worker.mjs` is the workerd DO, its layers over `HttpFilesApi` (with `maxConcurrent`).

The FilesApi adapters (`filesApiFs` with the geometric write buffer, `filesApiDisk`) and the modules
above are in the appendix of `docs/research/unkernel-evaluation-procedure.md`.
