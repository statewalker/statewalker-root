# unkernel is not integrated now; Docker images on it stay the option to revisit

**Status**: accepted, 2026-11-27. Decided by the human after the evaluation in
[statewalker-root#437](https://github.com/statewalker/statewalker-root/issues/437). Its records:

- `docs/research/unkernel-evaluation-procedure.md`: the procedure, results and conclusion;
- `docs/research/unkernel-on-cellb-and-workerd.md`: hosts, FilesApi mounts, runtimes;
- `docs/research/unkernel-oci-images-js-python.md`: Docker images, resources, the comparison.

## Context

[unkernel](https://github.com/pithings/unkernel) is Linux 7.3 compiled to one WebAssembly module.
An emulated aarch64 CPU runs unmodified Linux binaries. We evaluated it as the container behind
`ctx.container` for cellb, celld and workerd/Wrangler, with our capability-based FilesApi mounted
in the guest.

- **It works on cellb**, in Node and in Chrome, inline and in workers.
  - Every guest file operation reaches the mounted FilesApi, filters and guards included, with
    nothing copied when a session starts.
  - Official Docker Hub images (Python, Node, Bun, Deno) run unchanged from their layers.
  - App images with the runtime, packages and scripts pre-installed can be built in the guest
    without Docker, and the FilesApi then carries only the job's data.
- **It costs** 60 to 67 MiB of host memory per kernel, plus the program. Compute is about 45 times
  slower than native, and Python starts in 0.7 s warm.
- **It is not reliable on workerd.** Kernels in a Durable Object stall at random. The same request
  succeeds, then hangs, and the cause is unknown.
- **It is young.** It was weeks old when tested (0.2.0 nightlies), with one author, an unaudited
  emulator, and a GPL-2.0 kernel. Our usage also needs workarounds: a pre-bundled web entry, no
  fetch cache modes on workerd, and our own disk adapter.

## Decision

1. **unkernel is not integrated now.** No engine in cellb-containers, no `ctx.container` backed by
   it, and no dependency on the `unkernel` package in any project. statewalker/cellb.dev#256 is
   deferred.
2. **The option to revisit is Docker (OCI) images on unkernel**, as tested:
   - a puller that stores layers in a FilesApi;
   - a JSON index of the layer tars, served as the guest's read-only root;
   - a tmpfs overlay and a chroot in the guest;
   - app images built in the guest by exporting the overlay;
   - the FilesApi mounted for data only;
   - long-lived workers instead of a process per job.
3. **Revisit when** one of these holds:
   - the workerd stall is understood and fixed (with a minimal reproduction, reported upstream);
   - unkernel has a stable release with the workarounds removed (lazy `import.meta.url`, no fetch
     cache modes in its HTTP disk, a failed distro mount reported, a caller-provided worker
     factory);
   - we need unmodified Linux programs or native packages that WASI or WASIX builds cannot give.
4. **Until then**, the existing engines stay: Wasmer and Lifo behind cellb-containers, and QuickJS
   and CPython on WASI for scripts on runtimes without threads
   (`docs/research/lightweight-containers-on-do-runtimes.md`).

## Considered options

- **Integrate now for cellb only** (Node and browsers, where it never stalled). Rejected for now:
  it would add a third engine with a young upstream and our own workarounds, for a need that Wasmer
  and QuickJS cover today on cellb.
- **Integrate the distro images plus runtimes from a FilesApi mount** (the first note's route).
  Superseded by the Docker-image route, which needs no image of our own and keeps the FilesApi for
  data.
