# How far can Flue's full runtime run on the capability environment?

Research for `statewalker/statewalker-root#87` (map `statewalker/statewalker-root#70`). Sources
read on 2026-11-15. Statements marked **(inference)** are this note's own reasoning, not a
source's claim. It builds on `docs/research/flue-runtime-surface.md` (statewalker-root#72) and
does not repeat its description of the `Sandbox` contract, the tool factories or the prototype.

Path abbreviations used below:

- `FLUE/` = `@flue/runtime@2.3.0` as installed in statewalker-sandbox
  (`node_modules/.pnpm/@flue+runtime@2.3.0_…/node_modules/@flue/runtime/`); its `docs/` are the
  pages of https://flueframework.com/docs/.
- `VITE/` = `@flue/vite@2.3.0`, the npm tarball (`npm pack`), not installed in the sandbox.
- `CELLB/` = the cellb.dev checkout at `/home/user/cellb.dev` (commit `8c83c0d`, 2026-11-13).
- `PROTO/` = `statewalker-sandbox/apps/flue-capfs-do/`.

## Question

The harness reuses Flue's full configuration as far as possible (statewalker-root#76, decision
2): Flue's sandbox is the capability file view, Flue loads `AGENTS.md`, agents and skills itself,
and Agent Plugins interfaces sit on top of Flue. How far can that go?

1. Can a custom Flue sandbox run over an arbitrary FilesApi-like object, and does Flue's
   discovery of `AGENTS.md`, skills and agents read through the sandbox or at build time?
2. How do Flue's builds and its generated Durable Objects work, can they run on CellB and CellD,
   can they be embedded in our own DO classes, and is there an API that skips the build?
3. Which features need the full runtime, and can sub-agents get a narrower sandbox?
4. What is lost or must change upstream for (a) the full runtime with our sandbox, (b) Flue's
   agent API in our own DOs, (c) the prototype's route (tool factories plus pi-agent-core)?

## Short answer

- **The sandbox fits.** `sandboxFromDriver(driver, cwd)` over any object with nine async methods
  (eight file verbs plus `exec`) is a complete Flue sandbox. A local experiment ran Flue's **full
  runtime** (`start()` on Node) over a plain `MemFilesApi`. Flue read `AGENTS.md`, discovered
  `.agents/skills/greet/SKILL.md`, put both in the system prompt, served the skill body through
  `activate_skill`, and its `write` tool wrote back into the FilesApi. Every read went through the
  driver.
- **Discovery is a runtime read through the sandbox**, not a build step. `AGENTS.md` (and
  `CLAUDE.md`), `.agents/skills/*/SKILL.md` and the cwd listing are read with `exists`,
  `readFile`, `readdir` and `stat` when the agent is initialized
  (`FLUE/dist/conversation-stream-store-CXrgv-b0.mjs:339-405`, `:463-470`). Build-time
  packaging applies only to `import x from './SKILL.md'`. **Flue has no file-based agent
  definitions**: agents and sub-agents are code (`'use agent'` exports, `useSubagent`). Agents
  loaded from `agents/` folders need a small generic agent function of ours (see §1).
- **Flue's own Cloudflare build already runs on CellB, in Node and in the browser.**
  `CELLB/examples/flue` builds a Flue app with `@flue/vite` and `@cloudflare/vite-plugin` and
  runs the output unchanged on CellB. The test covers prompts, tools, SSE, recovery on another
  node, Workers AI, 32 concurrent conversations, shards and tabs. Nothing is reported as
  unsupported (`CELLB/examples/flue/README.md:33-81`). CellD is not tested with Flue
  (**inference**: likely, since CellB copies CellD's behaviour and CellD runs Agents SDK apps).
  Workers is Flue's native target.
- **The build is a thin code generator.** `vite build` scans `'use agent'` modules and writes a
  Worker entry of about 100 lines. The entry calls `createFlueAgentClass` once per agent over the
  Agents SDK `Agent` (`VITE/dist/index.mjs:205-405`). Those functions are exported, but from
  `@flue/runtime/cloudflare/internal`, so a hand-written entry inside our own hosting layer is
  possible but uses an unstable API. The supported seam is `extend({ base })`, which puts our
  class *under* Flue's generated DO. `start()` from `@flue/runtime/node` skips the build, but only
  on Node and with one runtime per process.
- **Sub-agents cannot get a narrower sandbox in Flue** (`useSandbox` throws in a sub-agent render).
  A second experiment showed the alternative inside the full runtime: a harness tool calls
  `init(Child, { id }).dispatch({ message, initialData: { root } })` and `read()`. The child is
  a separate registered agent whose sandbox factory narrows the file view from `initialData`.
  The child saw only its own `AGENTS.md`, and reading the parent's file failed with `ENOENT`.
- **Recommendation (inference):** option (a), Flue's Cloudflare-target runtime with our
  `SandboxFactory`, on CellB, CellD and Workers alike. Use `SandboxFactory.tools` for native
  grep and glob, a token capability in `initialData`, delegation as a harness tool to other
  registered agents, and `extend({ base })` for anything our hosting layer must add to the DO.
  The main costs are that Flue's conversation state lives in its own DO SQLite rather than our
  Store, and that sessions are Flue's, so the harness reads items from Flue's stream.

## Findings

### 1. A custom sandbox over a FilesApi, and native discovery

**What must be implemented.** A `SandboxFactory` is `{ createSandbox({ id }), tools? }`
(`FLUE/docs/reference/sandbox-api.md:15-26`). The smallest route is `sandboxFromDriver(driver,
cwd)` with a `SandboxDriver` of `readFile`, `readFileBuffer`, `writeFile`, `stat`, `readdir`
(names), `exists` (never throws), `mkdir`, `rm` and `exec`, all with absolute paths
(`:189-213`). The wrapper adds path resolution, the parent-creating write retry and the abort race
(`:164-168`). `FileStat` must not invent `size` or `mtime` (`:132-145`). An exec-less environment
throws from `exec` and passes a `tools` list without bash, grep and glob (`:152`). Otherwise the
model is offered tools that cannot work: in experiment 1, `bash`, `grep` and `glob` were offered
over an exec-less driver.

A FilesApi (`read`, `write`, `list`, `stats`, `exists`, `remove`, `mkdir`, `move`, `copy`;
`webrun-files@0.10.4 dist/types.d.ts:109-158`) maps onto the driver one to one. The adapter
collects the read chunks for `readFile`, maps `stats` to `FileStat`, maps `list` to names, and
turns `undefined` stats into `ENOENT`. `move` and `copy` have no Flue verb, so Flue's tools never
use them (**inference**: the capability's `mv`/`cp` stay reachable through bash or our own tools).

The factory gets only the instance `id`; everything else comes from its closure
(`sandbox-api.md:49`). It is built once per initialized harness and shared by all its sessions
and task sessions (`:24`, `:47`). In an agent function the closure can read
`useInitialData()` and `env`, so the capability arrives as creation data (§3).

**Experiment 1** (`node` script, Flue 2.3.0 `start()` with a fake OpenAI-compatible endpoint from
`CELLB/examples/fake-openai`; script kept in the session scratchpad only). An agent with
`useSandbox({ createSandbox: () => sandboxFromDriver(memFilesDriver, "/work") })` over a
`MemFilesApi` holding `AGENTS.md`, `.agents/skills/greet/SKILL.md` and `notes.txt`:

- First model request: the system prompt held the agent's instructions, the `AGENTS.md` text, an
  "Available Skills" section with `greet`, the "Available Agents" roster, the date, `Working
  directory: /work` and the directory listing. Tools offered: `read, write, edit, bash, grep,
  glob, task, activate_skill`.
- The scripted model called `activate_skill({ name: "greet" })`; the tool result carried the
  SKILL.md body, read again through the driver. It then called `write({ path: "out/report.md" })`,
  and the file appeared in the `MemFilesApi`.
- Driver calls in order: `createSandbox id=conv-1`, `exists /work/AGENTS.md`, `readFile
  /work/AGENTS.md`, `exists /work/CLAUDE.md`, `exists /work/.agents/skills`, `readdir
  /work/.agents/skills`, `stat …/greet`, `exists …/greet/SKILL.md`, `readFile …/SKILL.md`,
  `readdir /work`, then `readFile …/SKILL.md` (activation) and `writeFile /work/out/report.md`.
  No Node `fs` was touched.

**What is discovered, and when.**

- `readAgentsMd` reads `AGENTS.md` and `CLAUDE.md` from the cwd. `discoverLocalSkills` walks
  `<cwd>/.agents/skills/<name>/SKILL.md`, parses the frontmatter only, and skips malformed skills
  with a warning (`FLUE/dist/conversation-stream-store-CXrgv-b0.mjs:339-405`).
  `discoverSessionContext` also reads the cwd listing (`:463-470`).
- Workspace skills are read again at activation, so edits are picked up
  (`FLUE/docs/guide/skills.md:166-176`). The system prompt itself is frozen at initialization
  until the next compaction rebaselines it (`FLUE/docs/reference/agent-behavior.md:139-153`).
- A `task` call may pass a `cwd`, and the child discovers `AGENTS.md` and skills from there
  (`FLUE/dist/result-e-IUH4HT.mjs:246`; `FLUE/docs/guide/subagents.md:46`, `:59-62`).
- Build-time packaging is only for `SKILL.md` *imports* (`skills.md:64-94`), done by `@flue/vite`'s
  markdown plugin (`VITE/dist/index.mjs:1181`). Packaged files are served read-only at
  `/.flue/packaged-skills/…` through a `readFile` overlay (`sandbox-api.md:293`). Skills that
  arrive as folders in the file view need none of this.
- **Agents are not discovered from files.** Agents are exported functions found by the `'use
  agent'` scan at build time, or passed to `start({ agents })` (`FLUE/docs/reference/agent-api.md:52-57`).
  Sub-agents are `useSubagent({ name, description, agent })` with a code `agent` function
  (`FLUE/docs/guide/subagents.md:9-36`). Agent functions are synchronous (`agent-api.md:30`), so
  a render cannot read a file. **(inference)** File-defined agents (an `agents/` folder resolved by
  the definitions module) therefore need one generic agent function of ours. It reads the
  resolved definition from `useInitialData()`, or from `usePersistentState` filled in a
  `useAgentStart` callback that reads `harness.sandbox` (`FLUE/docs/reference/agent-hooks-api.md:271-291`).
  It then calls `useInstruction`, `useSkill(defineSkill(…))`, `useTool` and `useSubagent`. Tool,
  skill and sub-agent sets may change between renders (`agent-hooks-api.md:40`, `:48`).

### 2. Builds, generated Durable Objects and hosting

**The CLI is not the build tool in 2.3.** `flue` has `init`, `run`, `add`, `update` and `docs`;
there is no `flue build` or `flue dev`. "Dev servers and production builds are owned by Vite: `vite
dev` and `vite build`, with the `flue()` plugin" (`FLUE/docs/cli/overview.md:7-9`, `:25-31`). The
plugin finds `app.ts` (required), `db.ts` and `cloudflare.ts`, scans for `'use agent'` modules,
and stamps each agent's identity into the bundle (`FLUE/docs/guide/deploy.md:34-38`). The target
is `node`, or `cloudflare` when `@cloudflare/vite-plugin` is present (`:44-49`).

- **Node target:** `dist/server.mjs` (self-starting) plus `dist/app.mjs` (importable by a custom
  host). State goes to `db.ts`'s `PersistenceAdapter`, or else in-memory SQLite. One live process
  must own each conversation (`FLUE/docs/guide/node-target.md:110-144`). The generated server
  calls `assembleNodeAgentRuntime` over the scanned agents and the adapter
  (`VITE/dist/bootstrap/node-server.mjs:1-60`).
- **Cloudflare target:** the plugin writes `.flue-vite/` and `.flue-vite.wrangler.jsonc`. The
  generated entry exports one DO class per agent (`FlueSupportChatAgent`, binding
  `FLUE_SUPPORT_CHAT_AGENT`) and merges the bindings; migrations and `nodejs_compat` stay ours
  (`FLUE/docs/guide/cloudflare-target.md:11-48`). Conversation streams, attachments and
  submissions live in the DO's SQLite; `db.ts` is rejected (`:22`). Work runs in the DO's alarm
  invocation as attempt "fibers" (`:98-116`).
- **The generated entry** (`VITE/dist/index.mjs:205-405`) imports `Agent` and `getAgentByName`
  from the `agents` package, then:
  - registers the agents (`registerFlueAgents`);
  - builds `createCloudflareAgentRuntime({ agents, createContext, runWithInstanceContext })`;
  - exports `createFlueAgentClass({ AgentBase: Agent, runtime, className, agentName, extension })`
    once per agent;
  - calls `configureFlueRuntime({ target: 'cloudflare', …createCloudflareWorkerConfig({ env,
    agentIdentities, fetchAgent }) })`;
  - default-exports `app.ts`'s `fetch`.

  The generated class overrides the constructor, `onStart`, `onRequest`, `alarm` and
  `onFiberRecovered`, and adds `__flueWakeAgentSubmissions` (`FLUE/dist/cloudflare/internal.mjs:9-59`).
  What Flue needs from the base is structural: `name`, `env`, `ctx.id`, `ctx.storage.sql`,
  `ctx.storage.transactionSync`, `ctx.waitUntil`, `schedule(delay, callback, undefined,
  { idempotent })` and `runFiber(name, cb)` (`FLUE/dist/agent-coordinator-aVoFZ4h5.d.mts:7-36`).
- **Programmatic, build-free API:** `start({ agents, db?, env?, providers? })` from
  `@flue/runtime/node`, then `init(Agent, { id })` with `.dispatch()`, `.read()` and `.abort()`,
  and the top-level `dispatch()` (`FLUE/docs/reference/agent-api.md:205-255`, `:301-349`;
  `FLUE/dist/node/index.d.mts:46-124`). It is "exactly the wiring the generated Node server entry
  performs, without HTTP" (`FLUE/dist/internal.d.mts:167-173`). It allows one runtime per process
  and throws inside a Flue server (`agent-api.md:347`). `@flue/runtime/node` imports
  `node:sqlite`, `node:child_process` and `node:fs` (`FLUE/dist/node/index.mjs:8-13`), so `start()`
  is Node-only. `flue run` uses the same assembly (`FLUE/docs/cli/run.md:241-245`).

**CellB and CellD.**

- `CELLB/examples/flue` is a Flue 2.3.0 app built with `flue({ providers: ["cloudflare"] })` and
  `cloudflare({ config: flueWorkerConfig() })`, with `agents@0.33.0`
  (`CELLB/examples/flue/vite.config.ts`, `package.json`). It is loaded on Node with
  `loadNodeProject` and driven with `@flue/sdk`. The test covers admission, alarm-driven runs, tool
  calls, history from the agent's SQLite, live SSE, two conversations at once, takeover by a
  second node mid-model-call with Flue's recovery finishing there, and the `cloudflare` provider
  through `env.AI` (`README.md:33-42`).
- The same build runs in Chromium (`bundleWorkerForBrowser`, `browserProjectRuntime`, SQLite on
  OPFS). The browser test covers concurrency, `AsyncLocalStorage` identity across `await`, 8 and
  32 conversations, 4 shards and two tabs sharing the app (`README.md:49-81`).
- The cost in a browser: one thread, 21 SQLite commits per Flue turn, about 0.75 ms per OPFS
  write; 32 conversations take 16 s on one worker and 11 s on four
  (`CELLB/packages/cellb/docs/gaps.md:132-141`). CellB's compatibility table lists Flue as
  working on CellB in Node and in browsers (`CELLB/README.md:42`).
- CellB's browser `node:async_hooks` is a polyfill that needs `await` lowered to generators for
  propagation; `cellb build` does the lowering (`…/cellb/dist/node-compat/async_hooks.js:1-27`).
  The main `@flue/runtime` entry imports `AsyncLocalStorage` (`FLUE/dist/instrumentation-bhqFKBik.mjs:3`).
- CellD runs Agents SDK apps (CellD's `pi` example; `CELLB/examples/agents/README.md:7-21`), but
  no source runs Flue on CellD. **(inference)** The Flue Worker should run there too, because
  CellB answers recorded CellD requests the same way and stores cells in CellD's format
  (`CELLB/packages/cellb/docs/celld-compatibility.md:1-6`). This is untested.

**Embedding in our own DO classes.** There are three levels:

1. **`extend({ base, wrap })`** (public). `base(AgentBase)` returns a subclass that becomes the
   superclass of Flue's generated DO; `wrap` may proxy the final class
   (`cloudflare-target.md:212-250`, `:290-308`). Flue keeps `fetch`, `onRequest`,
   `onFiberRecovered` and `alarm`. **(inference)** This is enough for a hosting layer that adds RPC
   methods, a files-RPC endpoint or capability setup to every agent DO. Our own DOs (Workspace,
   gate, store) sit beside it as named exports of `cloudflare.ts` (`:254-286`).
2. **A hand-written entry** (internal API). The generated code uses only exported functions of
   `@flue/runtime/internal` and `@flue/runtime/cloudflare/internal`. **(inference)** Our hosting
   layer could emit the same ~100 lines without Vite: register agents, build the runtime, create
   the classes, configure the runtime. Agent identity would come from `agentName` statics
   (`agent-api.md:59-82`). It could pass any `AgentBase` that has the structural members listed
   above, not necessarily the Agents SDK's. These modules are internal ("Do not edit",
   `VITE/dist/index.mjs:228`), so the cost is pinning Flue's version.
3. **The Node assembly inside a DO** (`assembleNodeAgentRuntime` with a `PersistenceAdapter`
   over DO SQLite or our Store; `FLUE/dist/internal.d.mts:139-173`). **(inference)** This is not
   advisable: its coordinator is lease-based and process-oriented (`FLUE/docs/guide/durability.md:119-131`),
   and it would duplicate what the Cloudflare runtime does with alarms and fibers.

### 3. Durable submissions, compaction, skills, sub-agents

All of these need the full runtime: an agent function, rendered by Flue's session runner, inside
a configured runtime (`start()`, a generated server, or a generated DO).

- **Durable submissions:** every input is admitted durably; one runs at a time, and late inputs
  join at turn boundaries. There is a retry budget and timeout (`maxAttempts` 10 by default), and
  recovery resumes interrupted attempts (`FLUE/docs/guide/durability.md:9-64`). Durable tools
  get `step.do` (`:65-97`).
- **Compaction:** threshold, overflow and `harness.compact()` (`agent-behavior.md:155-165`).
- **Skills:** the catalog plus `activate_skill` and `read_skill_resource`, framework tools that
  only the runtime adds (`sandbox-api.md:296-301`).
- **`task` sub-agents:** child sessions with durable transcripts, resumed by recovery
  (`durability.md:98-107`).
- None of these is reachable from the tool factories alone. The prototype's route has only the
  six file tools and pi-agent-core's loop (`flue-runtime-surface.md` §2).

**Narrower sub-agents.** Not inside Flue's `task`:

- A delegate "runs as a detached session in the parent's environment", sharing the sandbox and
  workspace context (`subagents.md:38-65`).
- `useSandbox` (with `useModel`, `useMcpConnection` and `usePersistentState`) throws in a sub-agent
  render (`agent-hooks-api.md:50-53`, `:115`).
- `task` may scope a child to a `cwd` but never to another sandbox (`FLUE/docs/guide/sandboxes.md:16`).
- There is no per-sub-agent sandbox factory: `SubagentDefinition` has only `name`, `description`,
  `agent`, `model` and `thinkingLevel` (`agent-api.md:616-640`).

**Experiment 2** (same setup). The test checks delegation as a harness tool in the full runtime:

- `Parent` (file view `/work`) has a `delegate` tool that calls `init(Child, { id:
  "child-<callId>" }).dispatch({ message, initialData: { root: "/work/sub" } })`, then `read()`.
- `Child` is a second registered agent. Its factory narrows the same `MemFilesApi` to
  `initialData.root`, seen as `/work`. Both factories set `tools` to `read`, `write` and `edit`
  only.
- Result: the child's prompt held the child's `AGENTS.md`. Its `read /work/secret.txt` returned
  `ENOENT`, and the parent received the child's reply as the tool output. Tools offered: parent
  `read,write,edit,task,delegate`, child `read,write,edit,task`. `task` stays present but is inert
  with no declared sub-agents (`agent-hooks-api.md:173`).
- Reading a different instance from inside a tool is allowed; reading the tool's own instance
  would deadlock (`agent-api.md:251`).
- On Cloudflare the dispatch goes DO to DO through the generated binding
  (`FLUE/dist/cloudflare/internal.mjs:73-96`). **(inference)** Marking the tool `durable: true`
  and putting the receipt in a `step.do` would make a recovered parent re-attach to the same child
  submission rather than start a new one, since receipts are re-attachable (`agent-api.md:245`).

**Where the capability lives (inference).** Flue's admission boundary is HTTP or `dispatch()`,
and `initialData` is persisted in the instance's storage (`agent-api.md:176`). So the capability
must be serializable: the prototype's `TokenCap` (Biscuit token plus workspace name) fits, and an
RPC stub (`StubCap`, `PROTO/src/caps.ts:28-31`) does not cross it. The sandbox factory rebuilds
the file view from the token and the `WORKSPACE` binding on each initialization. That matches
Flue's "adapters key durable resources on the instance id" model (`agent-hooks-api.md:111-119`),
and attenuation then happens in the harness tool before dispatch, as decision 6 of #76 asks.

**Model right and metering.** Flue's model layer is pi-ai providers registered with
`setProvider()`. A gateway is a provider whose models carry the gateway `baseUrl`
(`flue-runtime-surface.md` §3), and this works in every option. In the full runtime the
prototype's `getApiKey` hook is not available, because Flue builds the pi-agent-core `Agent`
itself. **(inference)** Decision 3 of #76 (metering in the gateway) is therefore required for
option (a), not optional. Flue's `instrument({ interceptor })` also wraps every `model`, `tool`
and `task` operation (`FLUE/dist/observation-CCQRUQQq.d.mts:17-63`), which is a possible extra
check point.

### 4. What each option loses or needs upstream

| | (a) Full runtime, our `SandboxFactory` | (b) Flue's agent API in our DOs | (c) Tool factories + pi-agent-core |
|---|---|---|---|
| Runs on | Workers natively; CellB Node and browser proven (`CELLB/examples/flue`); CellD inferred | same runtimes; we own the entry or the DO base | anywhere the prototype runs today |
| Build | `vite build` with `@flue/vite` (+ `@cloudflare/vite-plugin`) | none (hand-written entry over `…/internal`), or `extend({ base })` with the Vite build | none |
| Sandbox = file view | yes (`sandboxFromDriver`/`bash()`; experiments 1 and 2) | yes | yes (today) |
| `AGENTS.md`, workspace skills | native, through the sandbox | native | lost (reimplement) |
| File-defined agents | generic agent function of ours | same | ours entirely |
| Durable submissions, steering, recovery | yes, DO SQLite + alarms + fibers | yes, if the internal runtime is used | lost |
| Compaction | yes | yes | lost (prototype trims history) |
| Narrower sub-agents | harness tool → `init/dispatch` to another registered agent | same | the prototype's attenuated cell chain |
| Where conversation state lives | Flue's tables in each agent DO | Flue's tables, in DOs we define | our Store |
| Model right / metering | gateway (decision 3) or `instrument` interceptor | same | `getApiKey` hook (today) |
| Upstream risk | low: public APIs plus the build plugin | high: `@flue/runtime/internal` and `cloudflare/internal` are not public | low |

What (a) needs or gives up, beyond our own code:

- **Our Store does not hold Flue's state.** On the Cloudflare target persistence adapters "do not
  apply" (`FLUE/docs/reference/data-persistence-api.md:11`). Decision 5 of #76 ("a core's private
  state lives in the environment's Store under the adapter's key") cannot hold for Flue there. The
  state is in the agent DO's SQLite, which on CellB and CellD is still our runtime and our bucket.
  **Upstream:** a `PersistenceAdapter` option on the Cloudflare target.
- **Sessions are Flue's.** The harness's session service must project Flue's conversation stream
  into turns and items: `read({ onEvent })`, `observe()`, or the streaming protocol over the
  agent route (`agent-api.md:243-249`; `FLUE/docs/reference/streaming-protocol.md`).
  **(inference)** That is an adapter, not an upstream change.
- **Agent identity is code.** Each Flue agent is an exported function with a DO class and a
  migration entry (`cloudflare-target.md:50-90`). Many user-defined agents map onto *one* generic
  Flue agent (definitions passed as `initialData`), not one class per definition (**inference**).
- **Native grep and glob** come through `SandboxFactory.tools` (pi `AgentTool`, TypeBox), which
  removes the prototype's `rg` shim and `/dev/null` sink (`flue-runtime-surface.md` §2). No
  upstream change is needed.
- **Upstream asks, by value:**
  1. a per-sub-agent sandbox (a `sandbox` field on `SubagentDefinition`, or `useSandbox` allowed in
     a sub-agent render), so `task` could carry an attenuated view;
  2. a public hosting API (`createFlueAgentClass` and `createCloudflareAgentRuntime` made public),
     which would make (b) safe;
  3. file-defined agents (`.agents/agents/*.md`) beside workspace skills;
  4. persistence adapters on the Cloudflare target.

What (b) changes: it is (a) with the generated entry replaced by ours. It gains control over class
names, bindings and the DO base, and it loses the stability of public APIs. **(inference)**
Prefer `extend({ base })` under the Vite build unless the build itself becomes the obstacle, for
example when CellB's in-browser builder must compile agent projects without Vite.

What (c) keeps and loses: it keeps everything under our control (sessions in our Store, the
`getApiKey` model check, the attenuated cell chain) and runs today. It loses workspace context,
skills, compaction, durable submissions, steering, `task`, MCP connections, persistent state,
`harness.prompt` structured results, tracing and the `@flue/sdk` client, and it would reimplement
each one (`flue-runtime-surface.md`, Open questions).

## Open questions

- Flue on CellD: not run. A CellD run of `CELLB/examples/flue`'s build would settle it.
- Flue's own DO classes under CellB's in-browser *builder* (sources compiled in a tab, not a
  `vite build` output): the generated entry needs `@flue/vite`'s scan. Option (b)'s hand-written
  entry may be the only route there. Untested.
- One generic Flue agent for all definitions vs one per agent kind: migrations, per-agent
  `durability` statics and DO class names push toward few agents. Belongs to the "user session
  starts agent sessions" prototype ticket.
- Whether to keep a long-lived capability token in `initialData` (persisted in the agent DO) or
  only a reference that the Workspace resolves. A security question for the capability tickets.
- `agents` package versions: `@flue/vite@2.3.0` depends on `agents ^0.20.1` (`VITE/package.json`),
  while CellB's example pins `agents@0.33.0`. The generated entry imports `agents` from the
  application, so the application's version wins.
- Flue's docs disagree on the default sandbox on Cloudflare: "a lightweight in-memory virtual
  sandbox" (`cloudflare-target.md:194`) vs "There is no default sandbox" in the generated entry
  (`VITE/dist/index.mjs:311`). It does not matter once our factory is always attached.

## Sources

- Flue 2.3.0 docs (local, = https://flueframework.com/docs/): `FLUE/docs/cli/overview.md`,
  `FLUE/docs/cli/run.md`, `FLUE/docs/guide/deploy.md`, `FLUE/docs/guide/node-target.md`,
  `FLUE/docs/guide/cloudflare-target.md`, `FLUE/docs/guide/project-layout.md`,
  `FLUE/docs/guide/skills.md`, `FLUE/docs/guide/subagents.md`, `FLUE/docs/guide/sandboxes.md`,
  `FLUE/docs/guide/durability.md`, `FLUE/docs/reference/sandbox-api.md`,
  `FLUE/docs/reference/agent-api.md`, `FLUE/docs/reference/agent-hooks-api.md`,
  `FLUE/docs/reference/agent-behavior.md`, `FLUE/docs/reference/data-persistence-api.md`.
- Flue 2.3.0 source: `FLUE/dist/conversation-stream-store-CXrgv-b0.mjs` (context discovery),
  `FLUE/dist/cloudflare/internal.{mjs,d.mts}` (generated DO class, worker config),
  `FLUE/dist/agent-coordinator-aVoFZ4h5.d.mts` (what the DO base must provide),
  `FLUE/dist/internal.d.mts` (Node assembly, coordinator), `FLUE/dist/node/index.{mjs,d.mts}`
  (`start`, `sqlite`, `local`), `FLUE/dist/observation-CCQRUQQq.d.mts` (interceptors),
  `FLUE/dist/result-e-IUH4HT.mjs` (`task` tool schema), `FLUE/package.json` (exports).
- `@flue/vite@2.3.0` (npm tarball): `dist/index.mjs` (Cloudflare entry generator),
  `dist/bootstrap/node-server.mjs`, `dist/bootstrap/node-entry.mjs`, `package.json`; repository
  https://github.com/withastro/flue (`packages/vite`), not fetched.
- CellB (cellb.dev at `8c83c0d`): `examples/flue/README.md`, `examples/flue/src/app.ts`,
  `examples/flue/src/agents/*.ts`, `examples/flue/vite.config.ts`, `examples/flue/package.json`,
  `examples/flue/wrangler.jsonc`, `examples/agents/README.md`, `README.md`,
  `packages/cellb/docs/gaps.md`, `packages/cellb/docs/celld-compatibility.md`; `@statewalker/cellb@0.8.8`
  `dist/node-compat/async_hooks.js`, `README.md`.
- Prototype: `PROTO/src/agent.ts`, `PROTO/src/agent-loop.ts`, `PROTO/src/capfs.ts`,
  `PROTO/src/caps.ts`, `PROTO/scripts/build-browser.mjs`.
- `@statewalker/webrun-files@0.10.4` `dist/types.d.ts` (FilesApi), `@statewalker/webrun-files-mem@0.10.4`.
- Earlier note: `docs/research/flue-runtime-surface.md`.
- Experiments: two Node 22.23 scripts against `FLUE/dist` with `MemFilesApi` and
  `CELLB/examples/fake-openai/src/index.ts`, run in the session scratchpad (not committed);
  outputs quoted in §1 and §3.
