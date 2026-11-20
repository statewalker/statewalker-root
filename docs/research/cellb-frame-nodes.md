# Can CellB spread Durable Objects over more workers, frames and threads, with the host's FilesApi as their store?

Research for `statewalker/statewalker-root#177`, 2026-11-20. Statements marked **(inference)** are
this note's own reasoning. The measurements come from the probes in
[statewalker/cellb.dev#183](https://github.com/statewalker/cellb.dev/pull/183)
(`packages/cellb/probes/spread/`, results in `bench/results/spread/`). They were run on one Linux
VM with 4 vCPUs and 16 GB of memory, in headless Chromium 1243 and Node 22.23. CellB was read at
`5fac4fd`, httpeers at `336001a`. `P` = `cellb.dev/packages/cellb/`.

## Question

The idea:
- The main CellB page creates iframes on other domains (for example `*.s.httpeers.net`). Each
  frame has its own resource limits: memory, storage, workers.
- The page runs Durable Objects in workers started in those frames, delegates tasks to them, and
  coordinates them.
- The host works with the local file system through FilesApi adapters (the File System Access API,
  or an S3 connection) and keeps the cells' data or backups there.

Does it raise the limits of one page? Does the same approach work for CellB on Node?

## Answer

1. **Workers share tasks well, and CellB already has the parts.**
   - `startProjectShards` places each object in one worker by `shardOf` and routes the calls of
     the other workers to it. In every run, every object stayed in one worker.
   - Throughput grows up to the core count: CPU-bound tasks go 91 → 178 tasks/s from 1 to 4
     browser workers, and 180 → 386 on Node.
   - A frame node works with what exists: an iframe of another origin starts its own shards and
     serves the project's HTTP to the host over a MessagePort (`serveHandlerOverPort` /
     `linkOverPort`).
2. **One page's ceiling is its renderer process.**
   - One page started 96 shard workers. At 128 one failed with
     `WebAssembly.Memory(): could not allocate memory` while 10.5 GB of RAM was free.
   - Each SQLite WASM memory is reserved in the process's address space (V8's sandbox, see
     [The V8 Sandbox](https://v8.dev/blog/sandbox)). CellB's earlier probe stopped at 125
     (`P/docs/browser-capacity.md`).
3. **Frames raise that ceiling only when they are cross-site.**
   - With 4 frames × 40 workers, same-site frames (`f<i>.spread.test` under `app.spread.test`)
     shared the host's process and failed at 160 workers, like one page.
   - Cross-site frames (`f<i>.node<i>.test`) each got a renderer process (4 → 8 renderers), and
     all 160 workers started, the largest renderer staying at 1.3 GB.
   - Chrome isolates processes by *site* (registrable domain), not by origin
     ([web.dev](https://web.dev/articles/origin-agent-cluster)).
   - So `*.s.httpeers.net` frames, same-site with an app on `httpeers.net`, would not help. The
     frames need separate registrable domains, or a zone on the
     [Public Suffix List](https://publicsuffix.org/submit/).
4. **Storage is not what one page runs out of first.**
   - A Chromium profile on disk stored 6 GiB from one page at about 190 MB/s, under a reported
     quota of 19.7 GB. The 3 GB limit CellB saw before was the off-the-record test context.
   - Per-origin quota in other browsers works against frames:
     - Safari gives a cross-origin frame about a tenth of the main frame's quota
       ([WebKit](https://webkit.org/?p=14403));
     - Firefox caps all origins of one registrable domain together
       ([MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
   - **Open:** the renderer's memory grew with the volume written, to 8.3 GB after 6 GiB. Its
     cause, and whether it is released, are not known yet.
5. **The host's FilesApi works as the cells' store, and it lets cells move.**
   - In the browser, 4 shard workers kept their cells as LTX files in a folder the host opened
     (`bucket: { ltx, files: { module, args: { dir } } }`, `dir` a `FileSystemDirectoryHandle`).
     8 other workers, with nothing of their own, then opened all 2,048 rows from it.
   - On Node, the same happened with `filesApiLtxLog` over a FilesApi served from the main thread
     (`serveFilesApi` / `rpcFilesClient`).
   - The cost is throughput: 6.1 MB/s in the browser and 28.9 MB/s on Node, against 190 and
     250 MB/s into the workers' own storage.
   - A folder picked with `showDirectoryPicker` lives on the user's disk, not in the origin's
     quota. **(inference)** That makes the host's folder, or S3, the place where the cells can
     outgrow the page.
6. **Frames cannot use the host's folder directly.** A directory handle the host posts to a frame
   of another origin arrives as a `messageerror`. The host has to serve its FilesApi to frame
   workers over a port, as `filesApiPort` does. That way is not yet wired for shards (§3).
7. **Node: the same design works, and the limit is memory.**
   - 256 worker threads ran in one process (8.0 GB RSS, about 31 MB per thread). An earlier run
     reached 384 threads (11.2 GB).
   - At 512 threads the container's memory limit killed the process. There is no address-space
     ceiling as in the browser, so threads need no frames.
   - Separate processes or machines are celld's fleet model, which CellB on Node already joins
     (`peers`, `celldBucket`).

## 1. The design the measurements support

```
host page (app origin) — coordinator
  ├─ the host's FilesApi: a folder (File System Access) or S3
  │    cells' LTX files; the host is their single writer
  ├─ local shard workers (startProjectShards), up to the process ceiling (~100)
  └─ cross-site frames  <name>.<other registrable domain>/cell-frame.html
       └─ shard workers (startProjectShards), up to ~100 per frame
  placement: object → node (hash or table) → worker (shardOf)
```

- **Placement.** CellB's `route(cellKey, id)` hook is synchronous (`P/src/core/runtime.ts:58-62`).
  - Inside a node, `shardOf` places objects.
  - Across nodes the probe placed objects by a hash at ingress. **(inference)** For DO-to-DO
    calls across frames, `route` needs a placement table that every worker holds (virtual shards
    → node), pushed by the host.
- **Moving cells.** With the cells in the host's FilesApi, moving an object to another worker or
  frame only means opening it there. The probe re-sharded 4 → 8 workers this way. Without the
  host's store, a cell in a frame's OPFS can only move by copying it across origins.
- **The frame page.** httpeers' `apps/session-shell` already connects a parent page with a
  cross-origin iframe over a MessagePort, with origin checks (`src/client.ts`, `src/relay.ts`,
  `src/policy.ts`). Its relay hands the port to a ServiceWorker, which cannot start workers, so a
  cell frame needs its own page. The handshake and policy code can be reused.
- **Durability.**
  - The probes measured cells living in the host's store: every commit an LTX file, RPO 0.
  - A cheaper variant is periodic backups: `filesApiBackup` keeps one image per interval.
    **(inference)** It would write faster but lose up to one interval of writes, and the cells
    would still live in the workers' OPFS.

## 2. What CellB needs for frames that write to the host's FilesApi

- **`startProjectShards` with a FilesApi port per shard.** Today `bucket` is copied to every
  shard. A `files: { port }` in it is not transferred, so only `{ module, args }` (a cloneable
  handle) works, and a handle cannot reach a frame of another origin. Two fixes are possible:
  transfer one `filesApiPort` per shard, or let `spawn` hand each shard its own bucket.
- **`spawn` that returns a port, not only a `Worker`.** A frame node then becomes a shard source
  like a worker.
- **A cross-node placement table behind `route`**, for DO-to-DO calls across frames.
- **Liveness of frames.** Web Locks are per origin, so the host cannot watch a frame's locks. A
  heartbeat per frame is needed.
- **Cross-origin isolation.** `bucket: { ltx }` needs it (SharedArrayBuffer). Every worker the
  shard starts must be served with COOP/COEP, which is why the probe's isolated page has its own
  shard worker. A cross-site frame also needs the host's `allow="cross-origin-isolated"`, and COEP
  plus CORP on its own documents. That is not tested yet.

## 3. Node

| Browser piece | Node equivalent | State |
|---|---|---|
| shard worker | `worker_threads` Worker running `createProjectRuntime` | built in the probe (`probes/spread/node-shard.ts`); no public loader yet |
| port mesh + `shardOf` | worker_threads `MessageChannel`s, `linkOverPort` / `serveRuntime` | works unchanged |
| host's FilesApi | `NodeFilesApi` (a folder) or an S3 FilesApi, served by the main thread with `serveFilesApi` | works; 28.9 MB/s for 512 MiB, restored into 8 threads |
| frame (another process) | a child process or another machine | celld's fleet (`celldBucket`, `peers`) covers machines |

**(inference)** A public `startProjectShards` for Node would make this reusable. It would take the
probe's wiring, with an optional host FilesApi per thread.

## 4. Next steps

1. Find why renderer memory grows with the volume written to OPFS pools (cellb.dev).
2. `startProjectShards`: per-shard FilesApi ports; `spawn` returning a port (cellb.dev).
3. Pick the frames' domains: separate registrable domains, or a Public Suffix List entry for an
   httpeers zone. Build a cell-frame page there (httpeers).
4. A Node shard loader in CellB's public API (cellb.dev).
5. Measure in Firefox, and in Safari once WebKit runs here.

## Sources

- Probes and results: [statewalker/cellb.dev#183](https://github.com/statewalker/cellb.dev/pull/183),
  `packages/cellb/probes/spread/README.md`.
- CellB: `P/docs/browser-host.md`, `P/docs/browser-capacity.md`,
  `P/docs/ownership-and-durability.md`, `P/src/core/runtime.ts`, `P/src/project/browser-shards.ts`,
  `P/src/transport/port.ts`.
- httpeers: `deploy/Caddyfile`, `apps/session-shell/{src/client.ts,src/relay.ts,src/policy.ts,README.md}`.
- [Origin-Agent-Cluster (web.dev)](https://web.dev/articles/origin-agent-cluster);
  [The V8 Sandbox](https://v8.dev/blog/sandbox);
  [Storage quotas (MDN)](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria);
  [WebKit storage policy](https://webkit.org/?p=14403);
  [Public Suffix List](https://publicsuffix.org/submit/).
