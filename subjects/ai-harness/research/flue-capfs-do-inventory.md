# What in flue-capfs-do maps to which harness module?

Research for `statewalker/statewalker-root#74` (Wayfinder map `statewalker/statewalker-root#70`).
Sources read on 2026-11-15 (statewalker-sandbox main at `6ea17d4`; the checkout was at `1815475`,
and `git diff origin/main HEAD -- apps/flue-capfs-do` shows no change in the app). All paths are
relative to `statewalker-sandbox/apps/flue-capfs-do/`. Statements marked **(inference)** are this
note's own reasoning, not something the code says.

## Question

The prototype is to grow into an AI harness with three layers: (1) **definitions**: agents, skills
and tools as data loaded from mounted folders; (2) **execution core**: Flue behind an adapter, with
other cores later; (3) **capability environment**: files, databases and tools behind Biscuit
capabilities, knowing nothing about Flue. A **session API** (REST, plus direct capability access to
the Durable Objects) sits on top. For each file under `src/` and `tests/`: which layer, whether it
is reusable as is, needs splitting or belongs to the app alone, and what it depends on. Also: the
HTTP surface, the Datalog policy and modes, the DO classes, the test matrix, the entanglements to
cut, and a package split.

## Short answer

- **Most of the code is layer 3, and it is already almost Flue-free.** The store (`sql-fs.ts`), the
  authorization core (`authority.ts`, `policy.ts`, `path.ts`), streaming (`files-rpc*.ts`,
  `guarded-files-api.ts`, `cap-bytes.ts`, `bytes.ts`), the holder-side capability (`caps.ts`), the
  tool isolates (`tools/*`, `tool-files-entrypoint.ts`, `bundler/*`) and the Python and Wasmer
  engines import nothing from `@flue/*` or `@earendil-works/*`. That is about 5,000 of the 7,100
  source lines.
- **Layer 2 is two files plus three adapters.** `agent-loop.ts` (pi-agent-core loop, pi-ai
  providers, Flue's six tools, conversation storage) and the `flue` task in `agent.ts` are the only
  importers of Flue or pi. `flue-compat.ts` (an `rg` shim for Flue on just-bash),
  `wasmer/flue-sandbox.ts` (a Flue sandbox shape on Wasmer) and `agent-history.ts` belong with them.
- **Layer 1 does not exist yet.** Instructions are a request string with a hard-coded default
  (`agent-loop.ts:291-293`), the tool set is Flue's fixed six (`agent-loop.ts:250-257`), there are
  no skills, and tools arrive inline in the request as module code or sources. The closest thing is
  the tool-bundle pipeline (`tools/`): sources to bundle to a hash a deployment approves.
- **The session API is `worker.ts`** (12 routes), and it is mostly a thin router over the two DOs.
  Its admin "sessions" are **capability sessions** (Biscuit token, mode, revocations, model budget);
  the `agent` task's `session` is a different thing, a **conversation** kept in the Agent DO.
- **The main entanglements** are: `agent.ts` is a god class (delegation, dispatch of nine task
  kinds, tool isolates, both engines, Flue calls); the `model` right and budget live inside the
  file capability (`Cap.model`, `policy.ts` operation `"model"`, `authority.ts:216-280`); the modes
  hard-code `/proj/` and `/plans/` (`policy.ts:52,58`); the capability transport is bound to
  `cloudflare:workers` (`caps.ts:8`, `workspace.ts:9`); and runtime detection lives in
  `python/hosts.ts` and is borrowed by Wasmer (`wasmer/kernel.ts:11,378`).
- **Suggested split (inference):** `capfs-core` (store, authority, policy, files-RPC; portable,
  takes a `SqlLike`), `capfs-do` (Workspace DO, transports, tool entrypoint), `capfs-shell` (CapFs
  for just-bash, the Wasmer host-fs), `tool-isolates` (bundling, check, admission, loader),
  `engines-python` / `engines-wasmer`, `harness-flue` (the execution adapter), and the app
  (gateway routes, Agent DO wiring, scripts, tests).

## Layer by file

Dependency columns: **CF** `cloudflare:workers`; **Flue** `@flue/runtime`; **pi**
`@earendil-works/pi-agent-core` / `pi-ai`; **jb** `just-bash`; **wf** `@statewalker/webrun-files`
or `-files-rpc` or `-files-mem`; **Bisc** `@statewalker/webrun-biscuit`; **Py** Pyodide; **Wa**
`@wasmer/sdk`; **esb** esbuild / esbuild-wasm / `@statewalker/webrun-bundler`. No file under `src/`
imports `@statewalker/cellb`; only `scripts/serve-cellb.mjs`, `scripts/build-browser.mjs` and
`browser/*.ts` do.

### Capability environment (layer 3): files

| File | Lines | What it is | Verdict | Deps |
|---|---|---|---|---|
| `src/sql-fs.ts` | 781 | The store: a file system on `ctx.storage.sql` through a `SqlLike` interface, BLOB blocks of 1 MiB, content ids, read/write/append streams (`:1-14`, `:99-105`, `SqlFs` `:133`) | Reusable as is; knows nothing of rights (`:3-4`). Unit tests run it on `node:sqlite` (`tests/helpers/sql.mjs`) | none |
| `src/authority.ts` | 549 | `Authority`: root key, `cap_sessions`/`cap_revoked` tables, token verification cache, the Datalog `check` (`:51-390`). `FsGate`: authorizes every entry an operation touches, then calls the store (`:423-549`) | Split: the model budget (`modelGrant`/`Reserve`/`Charge`, `:216-280`, and the schema-2 columns `:68-90`) is an LLM concern inside the file core; move it to a separate model capability | Bisc |
| `src/policy.ts` | 119 | Method→operation map (`:17-34`), the four mode policies (`:43-66`), `authorityBlock` (`:74-86`), attenuation blocks (`:88-119`) | Split: the vocabulary and attenuation are reusable; the modes are app data (they hard-code `/proj/` and `/plans/`) and should be loaded as definitions | none |
| `src/path.ts` | 70 | Normalisation (`/..` is `/`), `asResource`, `fsError` codes, `rebuildError` | Reusable as is | none |
| `src/bytes.ts` | 127 | Encodings (utf8, latin1, ascii, base64, hex) ↔ bytes | Reusable as is (could move to a shared utility) | none |
| `src/cap-bytes.ts` | 219 | Whole-file reads/writes/appends in bytes over a capability: one call up to 16 MiB, files-RPC streams above (`:1-8`); `largeFileCalls` for tools (`:172`), `everyCall` lease check (`:208`) | Reusable as is (holder side) | none directly (uses `files-rpc.ts`) |
| `src/files-rpc.ts` | 57 | Holder side of streaming: `capFiles(cap)` is a webrun-files-rpc client over `cap.rpc` (`:14`, `:40`, `:50`) | Reusable as is | wf |
| `src/files-rpc-hub.ts` | 152 | Owner side: one files-RPC server per live token, stream bounds per session and workspace (`:1-14`, `FilesRpcHub` `:41`, `auth.live` `:108`) | Reusable as is | wf |
| `src/guarded-files-api.ts` | 175 | The `AppendableFilesApi` the hub serves: the store through `FsGate`, re-authorized per block (`:1-15`, `:37`) | Reusable as is | wf |
| `src/caps.ts` | 152 | Holder-side `Cap` interface (`:15-27`), `StubCap` (`:42`), `TokenCap` (`:75`), `capFromHandoff` (`:122`), `ToolFiles` RpcTarget for tools (`:132`) | Split: the `Cap` interface (minus `model`) is core; `StubCap`/`TokenCap`/`ToolFiles` are the DO transport (they import `RpcTarget` and `Workspace` types, `:8`, `:13`) | CF, Bisc |
| `src/workspace.ts` | 157 | **Workspace DO** (owner cell) and `FilteredFiles` RpcTarget (the capability by reference) | Split: `FilteredFiles` and `fsCall` are the transport; the admin methods (`seed`, `dump`, session minting) are issuer/app glue | CF, Bisc |
| `src/capfs.ts` | 173 | just-bash `IFileSystem` over a capability, `/dev/null` sink, `safeExec` (`:1-7`, `:48`, `:156`) | Reusable as is: a shell adapter of layer 3; implements just-bash's interface structurally (no import), knows no Flue | none (jb shape) |
| `src/stream-task.ts` | 81 | The `stream` task (observable chunked transfer) and `patternChunks` used by tests | App alone (a diagnostic task) | none |

### Capability environment (layer 3): tools in isolates

| File | Lines | What it is | Verdict | Deps |
|---|---|---|---|---|
| `src/tool-files-entrypoint.ts` | 78 | `ToolFilesEntrypoint`: the capability as a loopback service binding for tool isolates (token transport), checking the run lease with the Agent DO on every call (`:1-11`, `:32-64`) | Reusable with the DO transport package; depends on the Agent DO's `toolRunActive` (`:38-43`), so the lease owner must become an interface | CF |
| `src/tools/config.ts` | 95 | `ToolBundleConfig`: defaults from `tool-bundle.config.json` ← overrides ← `TOOL_BUNDLE` (`:68`, `:81`) | Reusable as is | none |
| `src/tools/check.ts` | 115 | Acceptance check with acorn + eslint-scope, and `bundleHash` (`:44`, `:112`) | Reusable as is | acorn, eslint-scope |
| `src/tools/policy.ts` | 70 | `toolPolicy` (none / isolated / bundled-only / refused) and `admitTool` (`:26-33`, `:48-70`); `isolatesSeeHostFs` sniffs the user agent (`:12-15`) | Reusable as is | none |
| `src/tools/shims.ts` | 252 | Source strings of the `node:fs` shim over `files`, the POSIX `path`, deny modules, and the generated `WorkerEntrypoint` wrapper (`:234-236`) | Reusable as is; the emitted wrapper imports `cloudflare:workers` | CF (in generated code) |
| `src/tools/bundle.ts` | 161 | `bundleTool()`: webrun-bundler with the shims, build side only (`:118`) | Reusable as is (a tool-definition build step) | esb, wf (`-mem`) |
| `src/tools/bundle-request.ts` | 105 | What a caller may send to be bundled: limits, build-side keys (`:23`, `:73`) | Reusable as is | none |
| `src/tools/bundler-client.ts` | 134 | Agent side of in-deployment bundling: fetch and pin `esbuild.wasm`, run the bundler in a Worker Loader isolate (`:1-8`, `:77`, `:80`) | Reusable; needs a `LOADER` binding | (embeds `bundler/program.gen.js`) |
| `src/tools/eslint-scope.d.ts` | 16 | Typings | Goes with `check.ts` | none |
| `src/bundler/program.ts` | 42 | The bundler Worker (a `WorkerEntrypoint` around `bundleTool` with esbuild-wasm) | Reusable with `bundler-client.ts` | CF, esb |
| `src/bundler/program.gen.{js,d.ts}`, `wasm.d.ts` | 17 | Generated by `scripts/build-bundler.mjs`; typings for the `.wasm` import | Build artefacts | — |

### Capability environment (layer 3): engines

| File | Lines | What it is | Verdict | Deps |
|---|---|---|---|---|
| `src/python/kernel.ts` | 379 | `PythonKernel`: copies readable files into `/workspace`, answers live `capfs` calls with the capability, writes changes back through it (`:1-5`, `:90`) | Reusable as is (an engine over a `Cap`) | none (talks to the engine by messages) |
| `src/python/hosts.ts` | 123 | Where the engine runs: Node child with `--permission`, browser Worker, or none (`:53-123`); also **the runtime detection** `pythonRuntime()` (`:36-51`) | Split: runtime detection is shared (Wasmer uses it) and should move to a small runtime module | none (`node:child_process` dynamic) |
| `src/python/engine.mjs` | 389 | The Pyodide engine (Node child or browser Worker), message protocol (`:7-15`) | Reusable as is | Py |
| `src/wasmer/kernel.ts` | 496 | `WasmerKernel`: one engine per Agent, one sandbox per run, `/workspace` = capability (`:1-8`, `:102`, `wasmerHost` `:375`) | Reusable as is | none (imports `pythonRuntime`, `:11`) |
| `src/wasmer/host-fs.ts` | 784 | Wasmer's host-filesystem protocol answered with a capability: buffers, streamed reads, pending appends, metadata cache (`:1-9`) | Reusable as is | wf (`errorCode`) |
| `src/wasmer/engine.mjs` | 201 | The Wasmer engine (Node child or browser Worker), built through the SDK's core builder with `storageHost` (`:1-20`) | Reusable as is | Wa |
| `src/wasmer/node-fs-thread.mjs`, `node-preload.mjs` | 104 | Node engine's blocking file thread, and the preload that installs the SDK's bridge and removes `fetch` | Reusable as is (Node host of the engine) | Wa (bridge) |
| `src/wasmer/flue-sandbox.ts` | 75 | A Flue sandbox shape (`exec`, `readFile`, `stat`, …) over a `WasmerSession` and a `Cap` (`:24-75`); `resolveGuestPath` (`:14`) | Belongs to the Flue adapter (layer 2): it has Flue's interface, no Flue import | none |

### Execution core (layer 2)

| File | Lines | What it is | Verdict | Deps |
|---|---|---|---|---|
| `src/agent-loop.ts` | 458 | The `agent` task: pi-agent-core `Agent` with pi-ai providers (`:23-27`, `modelOf` `:104`), Flue's six tools over a just-bash or Wasmer sandbox (`:244-257`), turn reservation and token charging through `cap.model` (`:219`, `:280`, `:310`), conversation storage in the Agent DO's KV (`withSessionLock` `:154`, LRU index `:175-186`, read `:266`, write `:442-443`) | Split along three seams: model client (pi-ai + `llm-config.ts`), loop driver (pi-agent-core + Flue tools; the adapter proper), conversation store (an interface over DO storage) | Flue, pi, jb |
| `src/agent-history.ts` | 33 | `trimHistory`: what a stored conversation keeps | Reusable as is (conversation store) | none |
| `src/llm-config.ts` | 95 | The `LLM` var, deployment key vs caller token, redaction (`:33`, `:70`, `:89`) | Reusable as is (model client config) | none |
| `src/flue-compat.ts` | 42 | `rg` command so Flue 2.3's grep tool works on just-bash 3.6 (`:1-5`, `:11`) | Flue adapter; remove when fixed upstream | jb |
| `src/node-probe-guard.ts` | 20 | Hides `process.versions.node` while pi-ai loads in a browser | Goes with the pi model client; must stay the entry's first import (`worker.ts:18-19`) | none |

### App and server glue

| File | Lines | What it is | Verdict | Deps |
|---|---|---|---|---|
| `src/worker.ts` | 223 | The gateway: routes, admin guard, stub handoff; re-exports the DO classes and the entrypoint (`:31-33`) | App; the route shapes are a first draft of the session API | (types only) |
| `src/agent.ts` | 341 | **Agent DO**: `Task` union (`:54-67`), `AgentEnv` (`:83-99`), delegation chain (`run`, `:129-170`), dispatch of nine task kinds (`#execute`, `:172-239`), the `flue` task (`:242-272`), lazy Wasmer and Python kernels (`:276-286`), tool isolates and the run lease (`:288-340`) | Split (the main entanglement, see below) | CF, Flue, jb |

`browser/` (`cells-worker.ts`, `page.ts`: cellb in a browser on OPFS SQLite) and
`examples/walkthrough.mjs` are app glue too.

### Tests

| File | What it covers | Runtime | Layer |
|---|---|---|---|
| `tests/unit/authority.test.mjs` (22 tests) | Prefixes, modes read fresh, attenuation, revocation, forged tokens, key durability, recursive cp/mv/rm authorization, model right and budget, schema migration, binary content | Node, `node:sqlite` | 3 |
| `tests/unit/capfs.test.mjs` | CapFs bytes only, streamed large files, errors, `largeFileCalls`, `everyCall` | Node | 3 |
| `tests/unit/files-rpc.test.mjs`, `streams.test.mjs` | files-RPC hub: per-token servers, bounds, revocation mid-stream, expiry, append/ESTALE; store streams and blocks | Node | 3 |
| `tests/unit/wasmer-host-fs.test.mjs` | Host-fs protocol on a fake cap and on the real hub: buffers, appends, metadata cache, streamed reads | Node | 3 |
| `tests/unit/tools.test.mjs`, `bundle-request.test.mjs` | Bundling and shims (needs `esbuild`), acceptance check, its known limit, `admitTool` | Node | 3 |
| `tests/unit/bytes.test.mjs` | Encodings against Node's Buffer; CapFs sends bytes | Node | 3 |
| `tests/unit/llm-config.test.mjs`, `agent-history.test.mjs` | Caller-token policy, redaction; history trimming | Node | 2 |
| `tests/scenario.test.mjs` | The cross-runtime HTTP suite: runtime and admin, bytes and binary, large tool files, then per transport (`:212`): streaming, rights, forged tokens, modes, Flue tools, delegation over three cells, revocation, parallel users, tool isolates and leases, bundled tools, in-deployment bundling, isolate statelessness, Datalog subtree exclusion, case sensitivity, cp/mv | Any runtime via `BASE_URL` | 3 + app (Flue tools at `:356`) |
| `tests/agent.test.mjs` + `agent-scenario.mjs` | The `agent` task with the fake model: reads within rights, model right, budget and turns, timeouts, tool-result pairing, caller tokens, conversation sessions per capability and per chain | Any runtime | 2 |
| `tests/python.test.mjs` + `python-scenario.mjs` | Python on the capability: sync in, write-back, live `capfs`, isolation, fresh engine per capability, no network | Any runtime (ENOSYS on workerd/celld) | 3 |
| `tests/wasmer.test.mjs` + `wasmer-scenario.mjs` | Wasmer on the capability: shell work, package allowlist, large listings, refused writes, binary, `sandbox: "wasmer"` agent (`:202`) | Any runtime (ENOSYS on workerd/celld) | 3 (+2 at `:202`) |
| `tests/durability.test.mjs` | `PHASE=write` / `PHASE=check` around a restart: files, root key, mode, revocations | Any runtime | 3 |
| `tests/browser.test.mjs` | Chromium on cellb (Playwright): capability checks, Python, Wasmer, agent cases, bundler in a browser isolate, no page errors (`:66-141`) | Browser | all |
| `tests/helpers/fake-llm.mjs` | Fake OpenAI-compatible streaming server driven by `READ`/`WRITE`/`BASH`/`LOOP`/`HISTORY` | test infrastructure | — |
| `tests/helpers/sql.mjs` | `ctx.storage.sql`-like `exec` over `node:sqlite` | test infrastructure | — |
| `tests/helpers/wasm-server.mjs` | Serves `esbuild.wasm` as `BUNDLER_WASM_URL` | test infrastructure | — |
| `tests/fixtures/todo-tool.ts`, `bundle-fixture.mjs` | A Node-style tool and its bundle (the approved hash for `cellb-bundled-only`) | test infrastructure | — |

## HTTP surface (`src/worker.ts`)

All answers are `{ok, value}` or `{ok: false, code, error}` with the code mapped to a status
(`:64-79`). Admin routes need `Authorization: Bearer` with `ADMIN_KEY`, or `DEV_ADMIN_KEY` on a
loopback host only, compared in constant time; without a key they fail closed (`:44-62`, `:158-163`).

| Route | Line | Who | Does |
|---|---|---|---|
| `GET /api/runtime` | `:129-155` | any | Worker Loader present, Python host, model summary (never the key), bundler offered, Wasmer host, tool policy, user agent, boot id |
| `POST /api/w/:ws/seed` `{files}` | `:166-167` | admin | `Workspace.seed`: writes files without rights checks |
| `GET /api/w/:ws/files[?encoding=base64]` | `:168-171` | admin | `Workspace.dump`: every file (audit) |
| `GET /api/w/:ws/stats` | `:172` | admin | authorizations and verifications counters |
| `POST /api/w/:ws/sessions` `{user, rights, mode, model?}` | `:173-182` | admin | `Workspace.startSession`: mints the Biscuit token, creates the right directories |
| `GET /api/w/:ws/sessions/:sid` | `:183` | admin | session info: user, mode, revocations, model budget |
| `POST /api/w/:ws/sessions/:sid/mode` `{mode}` | `:184-185` | admin | switch mode at runtime |
| `POST /api/w/:ws/sessions/:sid/revoke` `{rid?}` | `:186-187` | admin | revoke one capability (and descendants) or the whole session |
| `POST /api/w/:ws/sessions/:sid/model` `{turns?, tokens?}` | `:188-189` | admin | set what is left of the model budget |
| `POST /api/agents/:name/run` `{workspace, token, transport, chain?, task}` | `:192-214` | user (token holder) | builds the handoff (token, or `Workspace.open(token)` stub for `stub`), calls `Agent.run`; `x-llm-token` header carries the caller's model credential |

Tasks (`agent.ts:54-67`, dispatched at `:172-239`): `bash`, `flue`, `tool` (code or sources),
`bundle`, `revocationId`, `python`, `agent`, `wasmer`, `stream`. **(inference)** In the harness,
`bash`/`flue`/`stream`/`revocationId` are diagnostics or capability calls a client could make
directly; `agent` is the execution core; `tool`/`bundle`/`python`/`wasmer` are environment tools
that an agent should reach as tools rather than as task kinds.

## Datalog policy and modes

- **Facts per call** (`policy.ts:4-10`, bound in `authority.ts:380-387`): `operation($op)` with
  `read`, `list`, `write` or `model`; `resource($path)` as the normalised path plus `/` (`path.ts`
  `asResource`); `check if session($sid)` restates the authority block.
- **Authority block** (`policy.ts:74-86`): `user`, `session`, `right("/p/")` per right,
  `model_use(true)` when the session may drive the model.
- **Modes** (`policy.ts:43-66`), host-side `allow` rules that only restrict what `right` allows; the
  session's mode is read fresh from `cap_sessions` on every check (`authority.ts:374-389`):
  - `yolo`: read, list, write inside the rights;
  - `prototyping`: read and list inside the rights, write only under `/proj/`;
  - `plan`: read and list inside the rights, write only under `/plans/`;
  - `readonly`: read and list only.
  Every mode also allows `list` on ancestors of a right (`:38`) and `model` when `model_use(true)`
  (`:41`).
- **Attenuation** (`policy.ts:88-119`): `scope` (one or several prefixes, plus `list` on ancestors,
  and `model` passes), `readOnly` (`read`, `list`, `model`), `noModel`, or raw `datalog` checks.
  Delegation appends a block: in the owner for a stub (`workspace.ts:61-65`), locally for a token
  (`caps.ts:102-108`).
- **Revocation** (`authority.ts:158-173`, `:351-371`): whole session (`revoked_all`) or one block's
  revocation id, which cuts its descendants.
- **Per-entry authorization** (`FsGate`, `authority.ts:423-549`): missing parents of a write
  (`:443-445`), every entry of `rm -r` (`:463-465`), every source and destination of `cp`/`mv`
  (`:509-523`), and readdir children filtered one by one (`:491-507`).

## Durable Object classes

| Class | File | Owns |
|---|---|---|
| `Workspace` | `workspace.ts:72-157` | One per workspace (`idFromName(ws)`). Owns the store (`SqlFs` on its SQLite), the `Authority` (root key, sessions, revocations, model budget) and the `FilesRpcHub`. Two ways in: `open(token)` returns a `FilteredFiles` RpcTarget (`:143-146`); `fsCall(token, req)` per request (`:150-153`). Admin: `startSession`, `setMode`, `setModelBudget`, `revoke`, `sessionInfo`, `seed`, `dump`, `stats` |
| `Agent` | `agent.ts:128-341` | One per agent name; sub-agents are `<name>/sub`, `<name>/sub/sub`, … (`:157-158`). Holds no file data. Owns the delegation hop, the task dispatch, the lazy Python and Wasmer kernels (one engine per cell), the set of live tool runs (`:289-292`), and the conversation histories in its KV storage (via `agent-loop.ts`) |
| `ToolFilesEntrypoint` (a `WorkerEntrypoint`, not a DO) | `tool-files-entrypoint.ts:32` | The file binding a tool isolate gets; checks the run lease with the Agent DO on every call |

Bindings (`wrangler.jsonc`): `WORKSPACE`, `AGENT` (SQLite classes, migration `v1`), `LOADER`
(Worker Loader), var `DEV_ADMIN_KEY`.

## Test matrix

`package.json` scripts: `test` = `test:unit` → `test:cellb` → `test:cellb-bundled-only` →
`test:cellb-celld-bucket` → `test:wrangler` → `test:browser`; `test:celld` is separate (Docker or
`CELLD_BIN`).

| Script | Runtime | Suites |
|---|---|---|
| `test:unit` | `node --test tests/unit/*.test.mjs`, no runtime, `node:sqlite` | the 11 unit files above |
| `test:cellb` | `scripts/serve-cellb.mjs` (cellb 0.8.8 `loadProject`, cells in `node:sqlite` files) | via `run-env.mjs` |
| `test:cellb-bundled-only` | cellb with `TOOL_BUNDLE={"hostFsRuntimes":"bundled-only","allowedBundles":[<fixture hash>]}` (`run-env.mjs:84-100`) | via `run-env.mjs` |
| `test:cellb-celld-bucket` | cellb with cells in celld's bucket format (`--celld-bucket`, `run-env.mjs:72-82`) | via `run-env.mjs` |
| `test:wrangler` | `wrangler dev` (workerd), `--persist-to` a temp dir (`run-env.mjs:45-59`) | via `run-env.mjs` |
| `test:celld` | `celld dev` 0.6.0 in Docker or `CELLD_BIN`; forces `TRANSPORTS=token` (`run-env.mjs:104-167`) | via `run-env.mjs` |
| `test:browser` | Chromium on cellb via Playwright (`tests/browser.test.mjs`) | its own cases plus the shared agent, Python and Wasmer cases |

`scripts/run-env.mjs <env>` starts the fake LLM and passes it as `LLM` with `LLM_API_KEY=sk-fake`
(`:33-39`), builds the bundler and serves `esbuild.wasm` as `BUNDLER_WASM_URL` (`:37-39`), starts
the runtime on a free port with fresh state, waits for `/api/runtime` (`:182-215`), then runs in
order `scenario` → `python` → `agent` → `wasmer` → `durability PHASE=write` (`:272-277`), stops
the runtime, **restarts it on the same state**, and runs `durability PHASE=check` (`:278-290`).
`TRANSPORTS` (default `stub,token`) picks the capability transports the suites loop over. The
README's results table (`README.md:832-855`): all green on wrangler and the three cellb variants;
Python and Wasmer answer `ENOSYS` on workerd and celld by design; celld runs the token transport
only.

## Entanglements to cut

1. **`agent.ts` is the god class.** One DO does delegation, the task switch, tool isolate loading
   and leases, both engine kernels, and the `flue` task's direct use of `@flue/runtime`
   (`:12-22`, `:106-113`, `:242-272`). Seams: a delegation service (attenuate and hand off,
   `:129-170`), an environment toolbox (tool isolates, Python, Wasmer: each a tool over a `Cap`),
   and an execution-core port that the Flue adapter implements.
2. **The model right and budget live in the file capability.** `Cap.model` (`caps.ts:23-24`),
   `FsRequest` `op: "model"` (`authority.ts:393`), operation `"model"` in every mode
   (`policy.ts:41`), and turns/tokens columns in `cap_sessions` (`authority.ts:68-90`,
   `:216-280`). The capability env must know nothing about Flue, and today it knows nothing about
   Flue, but it does know about LLM turns and tokens. **(inference)** Keep "model" as one more
   capability resource (`resource("model:<id>")`) and move metering to a model-gateway service.
3. **Where Flue actually touches the environment.** Flue never reaches the store: it sees a
   just-bash `Bash` over `CapFs` (`agent.ts:244-246`, `agent-loop.ts:246-249`) or a
   Flue-shaped object over Wasmer (`wasmer/flue-sandbox.ts`). The leaks are in the other
   direction: `flue-compat.ts` exists only because of Flue's grep, and `flue-sandbox.ts` sits in the
   Wasmer folder; both move into the Flue adapter. `CapFs` and `host-fs.ts` stay in layer 3.
4. **Conversation state is in the execution core and the Agent DO's KV**
   (`agent-loop.ts:154-186`, `:266`, `:442`), keyed by revocation id plus chain digest
   (`agent.ts:116-126`). The session API will need it behind an interface, separate from
   capability sessions.
5. **Modes are code, not definitions.** `/proj/` and `/plans/` are hard-coded (`policy.ts:52`,
   `:58`); the default system prompt and tool list are hard-coded (`agent-loop.ts:250-257`,
   `:291-293`). These are what layer 1 should load from mounted folders.
6. **The transport is tied to `cloudflare:workers`.** `StubCap`, `ToolFiles` and `FilteredFiles`
   extend or use `RpcTarget` (`caps.ts:8`, `workspace.ts:9`), and `TokenCap` reaches the
   `WORKSPACE` namespace (`caps.ts:84-86`). The core (`Authority`, `FsGate`, `SqlFs`, hub) does
   not: it takes a `SqlLike` and is already tested on `node:sqlite`.
7. **Runtime detection is scattered.** `python/hosts.ts:36-51` (used by `wasmer/kernel.ts:11`,
   `:378`, and by `worker.ts:85`), `tools/policy.ts:12-15`, and `node-probe-guard.ts`. One small
   runtime module would serve all.
8. **`ToolFilesEntrypoint` depends on the Agent DO** for the run lease (`:38-43`); the lease
   owner should be an interface so tool isolates can be launched from something other than the
   Agent DO.

## Suggested package split (inference)

| Package | Files | Depends on |
|---|---|---|
| `capfs-core` | `sql-fs`, `authority` (without model metering), `policy` (vocabulary, attenuation; modes as data), `path`, `bytes`, `files-rpc`, `files-rpc-hub`, `guarded-files-api`, `cap-bytes`, the `Cap` interface | webrun-biscuit, webrun-files(-rpc) |
| `capfs-do` | `Workspace` DO, `FilteredFiles`, `StubCap`, `TokenCap`, `ToolFiles`, `ToolFilesEntrypoint` (lease as interface) | capfs-core, `cloudflare:workers` |
| `capfs-shell` | `capfs.ts` (just-bash), `wasmer/host-fs.ts` | capfs-core |
| `tool-isolates` | `tools/*`, `bundler/*` | esbuild-wasm, webrun-bundler, acorn, eslint-scope; Worker Loader |
| `engine-python`, `engine-wasmer` | `python/*`, `wasmer/{kernel,engine,node-*}`, plus a shared runtime-detection module | Pyodide; @wasmer/sdk |
| `model-gateway` | `llm-config`, model metering from `authority.ts`, `node-probe-guard` | pi-ai |
| `harness-flue` (execution adapter) | `agent-loop` (loop + tools), `flue-compat`, `wasmer/flue-sandbox`, `agent-history`, a conversation-store interface | @flue/runtime, pi-agent-core, just-bash, capfs-shell, model-gateway |
| app | `worker.ts` (session API draft), `agent.ts` wiring, `stream-task`, `browser/`, `scripts/`, `examples/`, the HTTP suites | all of the above |

Layer 1 (definitions loaded from folders) would be new; its first inputs are the modes, the
default instructions, the tool list and approved tool bundles (`allowedBundles`).

## Open questions

- Should the model right stay a Biscuit operation (so attenuation and revocation keep working
  mid-run, `README.md:418-422`) once metering moves out?
- Do capability sessions and conversation sessions merge in the session API, or stay two things?
- Do `python`/`wasmer`/`tool` become tools an agent calls, task kinds a client calls, or both?

## Sources

- `statewalker-sandbox/apps/flue-capfs-do` at main `6ea17d4`: `README.md`, `package.json`,
  `wrangler.jsonc`, every file under `src/` (including `tools/`, `python/`, `wasmer/`,
  `bundler/`), `tests/` (including `unit/`, `helpers/`, `fixtures/`), `scripts/run-env.mjs`,
  `scripts/serve-cellb.mjs`, `browser/*.ts`.
