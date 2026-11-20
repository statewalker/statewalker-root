# Can CellB spread Durable Objects over cross-origin frames (and Node processes)?

Exploration asked for in a session without a ticket (2026-11-20). Statements marked
**(inference)** are this note's own reasoning, not a source's claim. CellB was read from the
shallow clone `repos/cellb.dev` at `5fac4fd` (2026-11-16), httpeers from `repos/httpeers` at
`336001a` (2026-11-20). Paths are relative to those clones. `P` = `packages/cellb/`.

## Question

Can the main CellB page create hidden iframes on random subdomains (for example
`<random>.s.httpeers.net`), each with its own origin and so its own memory, storage and worker
budget? Each frame would run CellB shard workers with their own OPFS, host part of the project's
Durable Objects, and copy their data back to the host from time to time. The host page would act as
coordinator, the role celld's shared S3 bucket plays in a fleet. Does the same approach work for
CellB on Node?

## Short answer

- **The DO wire and the placement hook are already there.**
  - Placement is one synchronous callback, `route(cellKey, id) → Send | undefined`
    (`P/src/core/runtime.ts:58-62`).
  - The wire is HTTP over a MessagePort (`serveRuntime`, `linkOverPort`, `P/src/transport/port.ts:138-170`).
  - Neither assumes same-origin. A MessagePort transferred through `window.postMessage` into a
    cross-origin iframe, and from there into its Dedicated Worker, is still a MessagePort.
  - `startProjectShards` already builds a full mesh of ports between shard workers and routes by
    `shardOf` (`P/src/project/browser-shards.ts:120-140`). A frame node is that mesh with some
    workers living in another origin.
- **The gain is per-process memory, not storage.** It needs the frames to be **cross-site**, not
  just cross-origin (§3).
  - The real per-tab limits are those of one renderer process. All JS heaps of a process share one
    4 GB pointer-compression cage. Wasm memories are reserved inside a 1 TB V8 sandbox, which fits
    with CellB's measured ceiling of about 125 SQLite workers per tab (`P/docs/browser-capacity.md`).
  - Chrome gives a frame its own process only when the frame is a different *site*. `*.s.httpeers.net`
    is same-site with `httpeers.net`, so today those frames most likely share the host's process
    and gain nothing. Either put the zone on the Public Suffix List or use separate registrable domains.
- **Extra storage is mostly not needed, and in some browsers it shrinks.**
  - Chrome on a profile on disk already gives one origin up to about 60% of the disk. The 3 GB
    ceiling CellB measured was Playwright's off-the-record context (`P/docs/browser-capacity.md`).
  - Safari gives a cross-origin frame one tenth of the main frame's quota.
  - Firefox caps all origins of one eTLD+1 together.
- **"Copy data to the host" and "store more than the host can" pull against each other.** Pick
  one of the durability models in §5. The one that fits CellB best makes the host the fleet
  bucket's only writer, over a port. Its storage is then whatever FilesApi the host opens: a disk
  folder through File System Access (not counted against quota), S3, or OPFS.
- **Node: the same design is simpler and mostly exists.** Node has no origins, so a "frame" is a
  worker thread, a child process or another machine. The same `route` and cells-http wire apply
  (`port.ts` accepts worker_threads ports). Separate machines are already covered by celld's fleet
  model and CellB's `peers` (§6).

## 1. What CellB gives us today

| Need | What exists | Where |
|---|---|---|
| Decide where a cell runs | `route(cellKey, id)`, synchronous; `undefined` = here | `P/src/core/runtime.ts:58-62` |
| Fall back to the cell's owner | `peers: { ownerOf, link, endpoint? }`, used on `CellOwnedElsewhereError` | `runtime.ts:81-93`, `324-369` |
| Carry DO fetch/RPC | `cellsHttpHandler` / `remoteRuntime(send)`; V8-serialized args; streamed bodies | `P/src/transport/cells-http.ts:55-164` |
| …over a port | `serveRuntime(port)`, `connectRuntime(port)`, `linkOverPort(port)`; MessagePort or worker_threads port | `P/src/transport/port.ts:121-170` |
| Many workers, one project | `startProjectShards` + `serveProjectShard`: port mesh, `shardOf(id, N)` | `P/src/project/browser-shards.ts:58-306` |
| Move a shard between owners | drain + close + reopen (between tabs of one origin) | `P/docs/browser-host.md` "A tab joins or leaves" |
| Durability off the worker | `CellStorage` (`durability`, `backup`, `ownership: Lease`, `objects`) | `P/src/ports.ts:103-193` |
| A fleet bucket on any store | `celldBucket(store, { node })` over an `ObjectStore` with conditional writes | `P/src/bucket/celld-cells.ts`, `object-store.ts:37-48` |
| Storage hosted elsewhere | `filesApiPort(files)`, `serveLtxStore(files)`: cells' files on a FilesApi in another thread | `P/docs/browser-host.md` "On the app's own FilesApi" |
| Export a worker's cells | `exportCells()` (OPFS pool → `[name, bytes]`, Node-compatible names) | `P/src/project/browser-host.ts:351-353` |

Missing pieces:

- No iframe support. `startProjectShards` expects `spawn` to return a `Worker` (it calls
  `postMessage(data, [ports])` and `terminate()`).
- No placement other than a fixed hash, and no rebalancing.
- No import counterpart to `exportCells()`.
- WebSockets cannot cross a plain `serveRuntime` link ("no control channel", `cells-http.ts:103-104`).
- Functions, `RpcTarget`s and stubs cannot cross any node boundary (`P/docs/gaps.md:35-39`). This
  already applies between shards, so frames add no new restriction.

## 2. The design in the browser

```
host page (app origin; coordinator)
  ├─ placement table: vshard (0..V-1) → node        pushed to every worker on change
  ├─ fleet bucket (optional): ObjectStore over a port, host is its only writer
  ├─ host shard workers h0..hk                       serveProjectShard, own OPFS pool
  └─ <iframe src="https://<name>.<zone>/cell-frame.html">  ×F, hidden, one per frame node
        frame page: accepts one CONNECT port from window.parent (origin-checked)
        └─ frame shard workers f0..fm                serveProjectShard, OPFS of <name>.<zone>
  every worker ⇄ every worker: a MessageChannel the host makes and hands out
  route(cellKey) = table[vshardOf(id)] === me ? undefined : links[table[vshardOf(id)]]
```

- **Ports.** The host creates one `MessageChannel` per pair of workers, as `startProjectShards`
  does today. For a frame worker, it sends the port to the frame page with
  `iframe.contentWindow.postMessage(msg, origin, [port])`, and the frame page passes it on to its
  worker. Traffic between two workers then runs directly. The host's main thread is not on the data
  path, only on the control path.
- **The handshake already exists in httpeers.** `apps/session-shell` does exactly this for
  `*.p.httpeers.net`.
  - Parent side: `openSession` (`src/client.ts:175-264`) with a 20 s handshake timeout.
  - Frame side: `src/relay.ts:68-98` accepts one `CONNECT` port per page, only from
    `window.parent`, only from an allowed origin (`isAllowedParentOrigin`, `src/policy.ts:169-190`).
  - That relay hands its port to a ServiceWorker. A cell frame instead needs a page that starts
    Dedicated Workers, because a ServiceWorker cannot spawn workers (`P/docs/browser-host.md`).
    It is a new page (for example `apps/cell-frame`), not a reuse of `relay.html`. The policy and
    handshake code can be shared.
- **Code.** Post the project as `{ bundle }` (a string, cloneable). `{ site }` resolves URLs
  against the frame's own origin and would need a ServiceWorker in each frame.
- **Placement must be synchronous.** `route` cannot await, so every worker holds a copy of the
  table. Use virtual shards (for example V = 256 by `shardOf(id, V)`) mapped to nodes, so frames can
  be added without rehashing every cell. Moving a vshard means:
  1. drain it (the existing `drainMs` logic);
  2. move its cells' data across origins (§5), since one origin cannot open another's OPFS;
  3. flip the table entry everywhere.
  An in-flight call to the old owner can fail with `ShardOwnerLostError`, as today between tabs.
- **Liveness.** Web Locks are per origin, and partitioned by top-level site, so the host cannot
  hold or watch a frame's locks. **(inference)** All frames live in the host's tab, so a tab close
  takes everything down at once. That makes the failure model simpler than between tabs. A crashed
  frame process still reports nothing on its ports. The host needs a heartbeat per frame, like the
  WebSocket heartbeat CellB already has, to fail calls to it and reassign its vshards.
- **Storage driver in frames.** Use `sahpoolOpener` (OPFS pool, no COOP/COEP needed) or
  `bucket: { idb }`. `bucket: { ltx }` needs `crossOriginIsolated`. An iframe gets that only if the
  host is COOP+COEP, the frame sends COEP and CORP, and the iframe has `allow="cross-origin-isolated"`.
  That is possible, but it is one more thing to break.
- **Ingress stays on the host.** Requests and navigations enter through the host's ServiceWorker
  router and are forwarded to the owner's port. Frames serve no navigations. **(inference)** This
  keeps httpeers' frame-ancestors and referrer checks simple: a frame page that is opened top-level
  refuses to run.

## 3. What a frame actually buys, per browser

Each origin does get its own OPFS, IndexedDB, Web Locks and ServiceWorker (httpeers verified
this for `*.p` sessions in Chromium and Firefox: `apps/demos/scripts/session-smoke.mjs:300-326`).
Memory and quota, which motivate this idea, are not origin-scoped.

| Resource | Scope | Does `<rand>.s.httpeers.net` help? |
|---|---|---|
| JS heap (pointer-compression cage, 4 GB) | **one renderer process**, shared by its isolates ([V8 pointer compression](https://chromium.googlesource.com/v8/v8.git/+/main/docs/heap/pointer-compression.md), [V8 sandbox](https://v8.dev/blog/sandbox)) | Only with its own process |
| Wasm memories (SQLite heaps, ≤2 GiB each) | reserved inside the process's 1 TB sandbox; CellB hit the limit at about 125 workers per tab | Only with its own process |
| Renderer process | Chrome desktop isolates by **site** (eTLD+1). `Origin-Agent-Cluster: ?1` is only a hint for a separate process ([web.dev](https://web.dev/articles/origin-agent-cluster)). Android Chrome isolates only some sites | Same-site subdomain: **probably not** |
| Storage quota, Chrome | per storage key (origin + top-level site), about 60% of disk each on a profile on disk ([Chrome storage partitioning](https://developer.chrome.com/docs/privacy-sandbox/storage-partitioning)) | Rarely needed: the host already has it |
| Storage quota, Safari | a cross-origin frame gets **about 1/10** of the main frame's quota ([WebKit](https://webkit.org/?p=14403), [MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)) | **Shrinks** per frame. Many frames add up, and each is evicted on its own |
| Storage quota, Firefox | **group limit per eTLD+1**, shared by all its origins ([MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [bug 1305665](https://bugzilla.mozilla.org/show_bug.cgi?id=1305665)); persistent origins are exempt | Same-site subdomains: **no** |
| CPU | threads; workers already give parallelism | No extra cores |

**(inference)** So the frames must be **cross-site** for the idea to pay off. There are two ways:

1. **Put the zone on the Public Suffix List** (private section), for example `c.httpeers.net`.
   Then each `<name>.c.httpeers.net` is its own site: its own process in Chrome, its own group in
   Firefox, and no cookie tossing. httpeers' own README already suggests this for `p.httpeers.net`
   because of the cookie-tossing risk (`apps/session-shell/README.md:255-262`). The list is shipped
   inside browsers, so a change takes months to reach users, and it cannot be undone quickly.
2. **A pool of separate registrable domains** (`cellnode-a.net`, …), each with a wildcard
   certificate. This is under our control and immediate, but costs domains and DNS work.

Either way, the first step is a **probe** before building anything. In
`P/e2e-browser/probes`, measure workers and resident cells for one tab alone, then with F
same-site frames, then with F cross-site frames (two local hostnames that differ in eTLD+1, for
example `127.0.0.1` against `localhost`, or `/etc/hosts` names). Also check the process count in
`chrome://process-internals` or `/proc`. If cross-site frames do not lift the 125-worker or cage
ceiling on desktop Chrome, stop there.

Other costs to weigh:

- Storage is partitioned by top-level site, so a frame's OPFS is reachable only while it is
  embedded under the same host site. If the app moves domain, the frames' data is orphaned. Frame
  names must therefore be **stable and recorded by the host**: "random" means unguessable, not new
  each session.
- A Safari cross-origin frame's storage may also be ephemeral or evicted under ITP. Treat frame
  storage as a cache unless §5's bucket backs it.
- Every frame is a separate document with its own SQLite WASM, at about 40 MB per idle worker
  (`P/docs/browser-capacity.md`). Frames add capacity only when the host is actually near a process
  limit.

## 4. Security

- Project code is trusted in CellB (`P/docs/security.md:7-16`). Frames on a shared zone run that
  code under an origin many apps can embed. The frame must refuse any parent but the app, like
  `isAllowedParentOrigin` and the Caddy `frame-ancestors` header (`deploy/Caddyfile:120-133`). Once
  storage is partitioned, another embedder would see a different, empty partition anyway.
- On the shared zone, each frame name must map to one app. The name is not a secret
  (`policy.ts:136-150`), so a frame must also check the parent's origin against what it was
  provisioned for, not just "any `httpeers.net` label".
- Today `*.s.httpeers.net` serves PeerShare's shell (`deploy/Caddyfile:121-124`, `deploy/README.md:194-198`).
  Cell frames need their own zone (for example `*.c.<cross-site domain>`) and their own static page.

## 5. Where the data lives: three durability models

| Model | Frame storage | Host storage | RPO | Grows total storage? |
|---|---|---|---|---|
| **A. Host is the bucket** | cache: the OPFS pool, rebuilt from the bucket on take-over | a celld-layout fleet bucket, written only by the host | 0 (LTX per commit) | Only as far as the host's FilesApi does |
| **B. Frame-primary, periodic copy** | primary | `CellBackup` images every `intervalMs` | one interval | No: the host holds a copy of everything |
| **C. Frame-primary, host holds the directory** | primary; data moves only when a vshard moves | placement table, frame names | the frame's eviction risk | Yes, but data dies with the frame partition |

**(inference)** Model A fits CellB best and fixes a known gap:

- CellB already makes each browser shard a fleet node (`<node>-s<i>`) when given a `bucket`
  (`browser-shards.ts:236, 279`).
- An OPFS fleet bucket is documented as unsafe with more than one writer, because its conditional
  writes check and then write (`P/docs/gaps.md:162-163`).
- If the host serves the `ObjectStore` (get, put with `ifMatch`/`ifNoneMatch`, list, delete) over a
  port, it becomes the *single* writer for every frame. Conditional writes are then atomic again,
  so leases, epochs, self-fencing, the wake index and alarms all work across frames unchanged.
- Moving a vshard is then just ownership. The new owner takes each cell and restores it from the
  bucket ("the bucket wins over the local file", `P/docs/ownership-and-durability.md:62-70`).
- The host's FilesApi decides capacity:
  - OPFS: no gain in storage, only in memory and processes.
  - A folder on disk through File System Access: not counted against quota.
  - S3 or a remote celld: unbounded, and celld can serve the cells when no tab is open.
- What A needs: an `ObjectStore`-over-port pair (`serveObjectStore(port, store)` /
  `remoteObjectStore(port)`). `filesApiPort` already does the same for a FilesApi.

Model B is the user's "copy periodically" idea taken literally. It is easy with today's
`CellBackup`, but the host must store everything, so it only buys memory. Model C buys storage but
loses data whenever a frame partition is evicted. **(inference)** It only makes sense with Model A
behind it for cold cells.

## 6. Node

Node has no origins and no per-origin quota. Its limits are a process's heap (V8's old-space
limit, or `resourceLimits` per worker thread), one machine's cores and RAM, and one disk.

| Browser piece | Node equivalent | State today |
|---|---|---|
| frame node | a `worker_threads` Worker, a child process, or another machine | Loaded Workers already run one worker thread each (`P/src/project/node-project.ts:473-480`) |
| port mesh + `route` | worker_threads ports (`port.ts:121-132` accepts them); for child processes, `cellsHttpHandler` over `node:http` or a unix socket | Sharded worker_threads runtimes exist **only in tests** (`P/test/p05-router.test.ts`, `test/shard-worker.entry.ts`); `loadProject` on Node is one in-process runtime |
| frame OPFS | a data directory per node (`nodeSqliteOpener(dir)`) | exists |
| host as bucket | coordinator serves `sqliteObjectStore(file)` or a FilesApi store over the port; or a real S3 or celld bucket | `celldBucket` + `sqliteObjectStore` exist |
| other machines | celld's fleet: shared S3, `own.json`, `peers` / `celldPeers`, HMAC peer server | exists (`P/src/peer/celld-peer.ts`, `test/p10c-peer-routing.test.ts`) |

**(inference)** On Node, the same design is a public `startProjectShards` for Node: a coordinator
spawns worker threads or child processes, hands each a port and a data directory, and routes by
the same vshard table. Child processes are preferable when the goal is memory, since each gets
its own heap limit and address space. Worker threads share one process, though Node by default
does not use a shared 4 GB cage. Across machines, CellB on Node is already a celld-compatible fleet
node. There the "coordinator" is the shared bucket, which is exactly CellD's model. A browser host
can join that fleet as one more node. So one placement layer (vshard table + `route`) and one
storage port (`ObjectStore` over a port) serve browser frames, Node processes and the remote
fleet alike.

## 7. Suggested next steps

1. **Probe** (§3): cross-site against same-site frames, measuring workers, cells and process count
   in Chromium. This decides whether the browser half is worth anything.
2. **CellB, small and useful anyway**:
   - `spawn` returns a port-like node handle instead of a `Worker`;
   - `serveObjectStore` / `remoteObjectStore` over a port (Model A, which also fixes the OPFS
     bucket's single-writer gap);
   - a vshard placement table behind `route`;
   - a public Node shard loader.
3. **httpeers**: a `cell-frame` static page and zone. Decide between a Public Suffix List entry and
   separate registrable domains.
4. **Later**: rebalancing (moving a vshard through the bucket), and heartbeats and reassignment
   when a frame dies.

## Sources

- CellB: `P/docs/browser-host.md`, `P/docs/browser-capacity.md`, `P/docs/ownership-and-durability.md`,
  `P/docs/architecture.md`, `P/docs/gaps.md`, `P/docs/security.md`, and the source files cited inline.
- httpeers: `deploy/Caddyfile`, `deploy/README.md`, `apps/session-shell/{README.md,src/client.ts,src/relay.ts,src/policy.ts}`,
  `apps/demos/scripts/session-smoke.mjs`.
- [Origin-Agent-Cluster header (web.dev)](https://web.dev/articles/origin-agent-cluster);
  [Intent to Ship: origin isolation by default (blink-dev)](https://groups.google.com/a/chromium.org/g/blink-dev/c/nrLl0IxSxSI/m/oHuvwntDAAAJ).
- [The V8 Sandbox](https://v8.dev/blog/sandbox); [Pointer compression in V8](https://chromium.googlesource.com/v8/v8.git/+/main/docs/heap/pointer-compression.md).
- [Storage quotas and eviction criteria (MDN)](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria);
  [WebKit: Updates to storage policy](https://webkit.org/?p=14403);
  [Chrome storage partitioning](https://developer.chrome.com/docs/privacy-sandbox/storage-partitioning);
  [Firefox bug 1305665 (origin groups)](https://bugzilla.mozilla.org/show_bug.cgi?id=1305665).
- [Public Suffix List: submit](https://publicsuffix.org/submit/).
