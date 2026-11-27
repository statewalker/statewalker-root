# What does Flue need from a sandbox, tools and a model, and where is the seam for other cores?

Research for `statewalker/statewalker-root#72` (map `statewalker/statewalker-root#70`). Sources
read on 2026-11-15. Statements marked **(inference)** are this note's own reasoning, not a
source's claim.

Path abbreviations used below:

- `FLUE/` = `@flue/runtime@2.3.0` as installed in statewalker-sandbox
  (`node_modules/.pnpm/@flue+runtime@2.3.0_…/node_modules/@flue/runtime/`); its `docs/` are the
  same pages as https://flueframework.com/docs/.
- `PIAC/` = `@earendil-works/pi-agent-core@1.4.0` (same tree, `…/@earendil-works/pi-agent-core/`).
- `PROTO/` = `statewalker-sandbox/apps/flue-capfs-do/`.
- `AISDK/` = `ai@7.0.127` (same tree, `…/node_modules/ai/`), whose `docs/` mirror https://ai-sdk.dev/docs.
- npm tarballs read at their published versions (not installed in the sandbox):
  `@earendil-works/pi-coding-agent@1.5.2`, `deepagents@1.16.5`, `@ai-sdk/harness@1.0.184`,
  `@ai-sdk/harness-pi@1.0.187`. Paths for these are inside the package.

## Question

What does Flue (`@flue/runtime`) need from its environment: the sandbox (`useSandbox`, `bash(...)`),
the file tools (read/write/edit/grep/glob/bash), tool registration, the model and provider, sessions
and history, sub-agents; and what are its extension points? How would pi (pi-ai, pi-agent-core,
pi-coding-agent), the Vercel AI SDK and DeepAgents consume the same capability environment? What
narrow interface could the environment offer without knowing which core uses it?

## Short answer

- **Flue's environment seam is one interface, `Sandbox`**: eight file verbs (`readFile`,
  `readFileBuffer`, `writeFile`, `stat`, `readdir`, `exists`, `mkdir`, `rm`), `exec`, `cwd` and
  `resolvePath`, produced by a `SandboxFactory.createSandbox({ id })`. The factory gets only the
  instance id; everything else comes from its closure. `bash(factory)` builds one from a just-bash
  instance, `sandboxFromDriver(driver, cwd)` from a smaller driver. This is exactly what the
  prototype implements over a capability (`CapFs` under just-bash, or `flueSandboxOnWasmer`).
- **Flue's six file tools are thin wrappers over that interface.** `read`/`write`/`edit` need only
  file verbs; `bash`/`grep`/`glob` need `exec` (grep shells out to `rg` or `grep -rnH`, glob to
  `find`). `SandboxFactory.tools` may **replace** the six with any pi-agent-core `AgentTool[]`;
  that is Flue's extension point for environment-native tools.
- **The model layer is pi-ai's, unwrapped.** Providers are pi-ai `Provider` objects registered with
  `setProvider()`; credentials resolve per request in the provider's own `auth.resolve()`. The loop
  is pi-agent-core's `Agent`, whose `getApiKey`, `beforeToolCall`/`afterToolCall` and `streamFn`
  hooks are where the prototype checks the model right and meters the budget.
- **Sessions, history, sub-agents and skills belong to Flue's full runtime, not to the sandbox.**
  The full runtime is hook-based (`useModel`, `useSandbox`, `useTool`, `useSkill`, `useSubagent`);
  on Cloudflare it generates its own Durable Object per agent and persists in that object's SQLite.
  Custom persistence adapters apply only on the Node target. Sub-agents share the parent's
  sandbox and **cannot be given a narrower one**. The prototype therefore uses Flue's tool
  factories plus pi-agent-core directly, and keeps sessions and delegation itself.
- **The other cores want the same primitives in different shapes.** pi-coding-agent takes
  per-tool `*Operations` objects (read, write, edit, ls, find, bash exec). DeepAgents takes a
  `BackendProtocol` with file verbs, grep and glob as **methods**, plus an optional `execute`. The AI
  SDK takes an `Experimental_SandboxSession` (file I/O, `run`, `spawn`), and its `HarnessAgent`
  already wraps Pi and DeepAgents as "harness adapters" over that session.
- **Proposed seam (inference):** the environment offers capability-scoped **files** (with native
  `grep`/`glob`), an optional **exec**, a **tool catalog** described in JSON Schema, a **model
  gateway** (an OpenAI- or Anthropic-compatible `fetch` with metering), a **per-capability store**,
  and **attenuate** for delegation. One small adapter per core maps these onto `Sandbox` +
  `SandboxToolFactory` + `setProvider` (Flue), `*Operations` (pi), `BackendProtocol` (DeepAgents) and
  `SandboxSession` + `tool()` (AI SDK). The environment never imports a core.

## Findings

### 1. Flue's sandbox contract

- `SandboxFactory { createSandbox(options: { id: string }): Promise<Sandbox>; tools?: SandboxToolFactory }`
  (`FLUE/docs/reference/sandbox-api.md:15-26`). `createSandbox` runs once per initialized harness,
  and every session and task session of that harness shares the result (`:24`). The factory gets
  "the instance id and nothing else — no conversation content, no request data. Anything else an
  adapter needs must be captured in the closure" (`:49`). There is no teardown verb and no rebuild
  per message (`:44-48`).
- `Sandbox` = `exec(command, { cwd, env, timeoutMs, signal }) → { stdout, stderr, exitCode }`,
  `readFile`, `readFileBuffer`, `writeFile(path, string | Uint8Array)`, `stat`, `readdir` (names
  only), `exists` (never throws), `mkdir({ recursive })`, `rm({ recursive, force })`, `cwd`,
  `resolvePath` (`:61-85`). Paths are POSIX; `writeFile` must create missing parents (`:113`);
  `exec` resolves for any completed command and rejects only for transport failures and aborts
  (`:102-107`); unsupported options throw `SandboxOperationUnsupportedError` before any change
  (`:118`, `:403-411`). `FileStat` must not fabricate `size`/`mtime` (`:132-145`).
- Two builders: `bash(factory)` wraps any just-bash-like object (`exec`, `getCwd`, `fs` with the
  file verbs and `resolvePath(base, path)`; structural, so Flue does not import just-bash)
  (`:241-275`). `sandboxFromDriver(driver, cwd)` wraps a `SandboxDriver` (the same verbs, absolute
  paths) and adds path resolution, the parent-creation retry and the abort race (`:157-213`).
- A sandbox may carry extra native properties, but a `useSandbox(factory, { cwd })` override wraps
  it and drops them (`:51-57`, `:147-152`). An exec-less sandbox should throw from `exec` and pair
  itself with a `tools` list that omits the exec-backed tools (`:152`).
- `SandboxToolFactory = (sandbox, { subagents }) => AgentTool[]`; when present it **replaces** the
  default six. It is synchronous, and it is called at every turn boundary. Framework tools
  (`task`, `activate_skill`, `read_skill_resource`) and `useTool` tools are added separately. The
  names `task`, `activate_skill`, `read_skill_resource`, `finish` and `give_up` are reserved
  (`:280-301`). The element type is pi-agent-core's `AgentTool` (`:303-320`).
- The six factories (`createReadTool` … `createGlobTool`) take a `Sandbox` and are exported one by
  one so an adapter can compose them. `read`/`write`/`edit` need only file verbs;
  `bash`/`grep`/`glob` need `exec`. `edit` is read → replace → write under a per-path lock keyed on
  `resolvePath`. `grep` probes `rg --version` once and falls back to `grep -rnH`; `glob` runs
  `find -name` (`:325-338`). The source matches: `FLUE/dist/result-e-IUH4HT.mjs:210-238` (bash →
  `env.exec`), `:335-372` (grep builds an `rg`/`grep` command line), `:378-410` (glob runs `find …
  2>/dev/null | head`). Model-facing limits: read 2000 lines/50 KB, bash tail 2000 lines/50 KB, grep
  100 matches, glob 1000 paths (`FLUE/docs/reference/agent-behavior.md:15-97`, `:167-180`).
- Attaching a sandbox also turns on **workspace context**: the cwd, a directory listing and
  `AGENTS.md` go into the system prompt, and `<cwd>/.agents/skills/*/SKILL.md` are discovered as
  skills (`FLUE/docs/guide/sandboxes.md:9-21`; `FLUE/docs/guide/skills.md:166-178`). Packaged
  skills' files are served by a `readFile` overlay at `/.flue/packaged-skills/…`, never written
  into the sandbox (`FLUE/docs/reference/sandbox-api.md:340-348`).

### 2. How the prototype meets that contract

- `PROTO/src/agent.ts:242-272` builds a Flue sandbox with `flueBash(() => new Bash({ fs: new
  CapFs(cap), cwd, customCommands: [rgForFlue] }))` and calls Flue's tool factories directly
  (`FLUE_TOOLS`, `:106-113`). `CapFs` is a just-bash `IFileSystem` made only of capability calls
  (`PROTO/src/capfs.ts:1-7`); `Cap` is `call/readdir/move/rpc/attenuate/revocationId/model/handoff`
  (`PROTO/src/caps.ts:15-26`).
- `PROTO/src/wasmer/flue-sandbox.ts:24-75` is a hand-written `Sandbox`: `exec` runs in a Wasmer
  session whose `/workspace` is the capability, and the file verbs call the capability directly.
  That is the `sandboxFromDriver` shape, written by hand (README `PROTO/README.md:509-526`).
- Two frictions with Flue: (a) Flue's `grep` falls back to `grep -rnH`, which just-bash 3.6 rejects,
  so the prototype ships an `rg` shim (`PROTO/src/flue-compat.ts:1-6`; `PROTO/README.md:892-895`);
  (b) `glob`/`grep` redirect to `/dev/null`, which `CapFs` must treat as a sink (`PROTO/README.md:890-891`).
  Both come from Flue's grep/glob being shell commands rather than sandbox verbs. **(inference)** A
  `SandboxFactory.tools` that replaces `grep`/`glob` with capability-native search would remove the
  shim, and would make grep/glob work on an exec-less environment.
- The `agent` task does **not** use Flue's agent runtime. It runs pi-agent-core's `Agent` with
  Flue's six tools over the same sandbox (`PROTO/src/agent-loop.ts:244-257`, `:268-298`;
  `PROTO/README.md:393-401`). The model is a pi-ai `Model` object built from the deployment's
  `LLM` var, with only three APIs registered through `registerApiProvider` so that no Node-only
  provider is bundled (`PROTO/src/agent-loop.ts:104-133`). The model right and budget sit in
  pi-agent-core's `getApiKey` hook, which pi-agent-core awaits before every request: the hook
  reserves a turn through `cap.model("reserve")`, and the `turn_end` event charges usage
  (`PROTO/src/agent-loop.ts:268-298`, `:322-336`; `PROTO/README.md:418-430`). Sessions are message
  arrays the prototype stores in the Agent cell, keyed by capability and chain
  (`PROTO/src/agent-loop.ts:266-267`, `:438-444`; `PROTO/README.md:472-486`). Delegation is the
  prototype's own `chain` of attenuated cells (`PROTO/src/agent.ts:149-168`), not Flue's `task`.

### 3. Flue's other needs and extension points

- **Agent definition is code, rendered by hooks.** An agent is a synchronous function. Hooks
  attach the model (`useModel`, required), the environment (`useSandbox`), tools (`useTool`), MCP
  (`useMcpConnection`), skills (`useSkill`), delegates (`useSubagent`), instructions
  (`useInstruction`), state (`usePersistentState`) and four lifecycle seams. The runtime re-renders
  the function before every model call (`FLUE/docs/reference/agent-hooks-api.md:11-53`;
  `FLUE/docs/reference/agent-api.md:18-35`). **(inference)** Definitions loaded as data from
  mounted folders need a small generic agent function that reads the definition and calls the
  hooks. That is possible because tool, skill and subagent sets may change from render to render.
- **Tools:** `defineTool({ name, description, input (Valibot), output, harness, durable, timeoutMs,
  annotations, run(ctx) })`. `ctx` carries `toolCallId`, `signal`, `log`; `harness: true` adds
  `harness.sandbox` and `harness.prompt()`; `durable: true` adds `step.do()` for replay
  (`FLUE/docs/reference/agent-api.md:493-573`). Tools enter either through `useTool` (Valibot
  schemas) or through `SandboxFactory.tools` (pi `AgentTool`, TypeBox, which is JSON Schema)
  (`FLUE/docs/reference/sandbox-api.md:303-320`).
- **Model/provider:** "Flue's model layer is Pi's provider protocol, unwrapped". There is one pi
  `Models` registry; `setProvider(provider)` registers a pi `Provider` by id (each call replaces
  the earlier one); the registry is module-scoped; credentials resolve through the provider's own
  `auth` and per request; "Flue adds no credential layer on top"
  (`FLUE/docs/reference/provider-api.md:7`, `:44-70`). Specifiers are `provider-id/model-id`,
  resolved per call (`:72-82`). A gateway is a custom provider whose models carry the gateway's
  `baseUrl` (`FLUE/docs/guide/models.md:153-219`). Internally Flue builds a pi-agent-core `Agent`
  with its own `streamFn` and parallel tool execution
  (`FLUE/dist/conversation-stream-store-CXrgv-b0.mjs:2206-2220`).
- **pi-agent-core hooks** (all of which the full Flue runtime keeps for itself):
  `StreamFn(model, context, options)` (`PIAC/dist/types.d.ts:17`), `getApiKey(provider)` (`:216`),
  `convertToLlm` and `transformContext` (`:186`, `:207`), `prepareRequest`/`prepareNextTurn`
  (`:231-237`), steering and follow-up queues (`:249-261`), `beforeToolCall` (it can block, with a
  reason) and `afterToolCall` (it can rewrite the result) (`:44-81`, `:279-293`), and the
  `AgentTool` shape (`:409-437`) and event stream (`:452-492`). **(inference)** These are the
  places where a capability check per tool call or per model call can sit without touching the tools.
- **Sessions and history:** every input is a durably recorded *submission*; one runs at a time, and
  late messages join at turn boundaries (`FLUE/docs/reference/agent-behavior.md:117-135`). Storage
  is `PersistenceAdapter → { submissionStore, conversationStreamStore, attachmentStore }`, with an
  append-only, fenced conversation stream (`FLUE/docs/reference/data-persistence-api.md:13-41`,
  `:140-177`). "The adapter surface is Node-only: on the Cloudflare target every agent instance
  persists in its Durable Object's built-in SQLite storage … custom adapters do not apply" (`:11`).
  On Cloudflare, Flue generates one Durable Object class per agent and runs each response inside
  the object's alarm (`FLUE/docs/guide/cloudflare-target.md:7`, `:13-22`, `:110`). Compaction is
  built in (`FLUE/docs/reference/agent-behavior.md:155-165`).
- **Sub-agents:** declared with `useSubagent({ name, description, agent, model?, thinkingLevel? })`
  and called by the model through the framework `task` tool. The child is a detached session in
  **the parent's environment**; only its final text returns; nesting is capped at four levels
  (`FLUE/docs/guide/subagents.md:38-65`; `FLUE/docs/reference/agent-api.md:616-640`). "A `task`
  call can scope a child to a different working directory, but never to a different sandbox"
  (`FLUE/docs/guide/sandboxes.md:16`); `useSandbox` throws in a subagent render
  (`FLUE/docs/reference/agent-hooks-api.md:53`). **(inference)** Flue's own sub-agents therefore
  cannot carry an attenuated capability. Narrower rights for a delegate need either a separate
  agent instance on a narrower sandbox (the prototype's cell chain), or a tool that calls one.
- **Skills:** a catalog line per skill in the prompt, plus `activate_skill` to load the body; the
  Agent Skills `SKILL.md` format; skills come from imports, `defineSkill`, or `.agents/skills/` in
  the sandbox (`FLUE/docs/guide/skills.md:143-178`; `FLUE/docs/reference/agent-api.md:583-606`).

### 4. pi (pi-ai, pi-agent-core, pi-coding-agent)

- **pi-ai** is the provider layer Flue reuses: `Provider` objects from `createProvider({ id, auth,
  models, api })` with a per-request `auth.apiKey.resolve()` (`FLUE/docs/reference/provider-api.md:44-70`;
  https://pi.dev/docs/latest/providers).
- **pi-agent-core** is the loop alone: it has no files and no shell. The caller supplies `tools`,
  `messages` and the hooks listed in section 3 (`PIAC/dist/types.d.ts:158-293`, `:329-368`).
- **pi-coding-agent** owns the coding tools and puts their I/O behind per-tool operation objects:
  `ReadOperations { readFile, access, detectImageMimeType?, createReadStream? }`
  (`dist/core/tools/read.d.ts:36`), `WriteOperations { writeFile, mkdir }` (`write.d.ts:17-22`),
  `EditOperations { readFile, writeFile, access }` (`edit.d.ts:29-36`), `LsOperations { exists,
  stat, readdir }` (`ls.d.ts:22-33`), `FindOperations { exists, glob(pattern, cwd, { ignore, limit }) }`
  (`find.d.ts:26-34`), `BashOperations { exec(command, cwd, { onData, signal, timeout }) }`
  (`bash.d.ts:35-54`). `grep` "always runs the local ripgrep; to search a remote system, override
  the tool's execute()" (`grep.d.ts:26-38`). Extensions add tools with `pi.registerTool()` at any
  time (`docs/extensions.md:1582-1586`), intercept calls on `tool_call`, and can swap the shell
  backend (`docs/extensions.md:1083-1108`). Sessions are pi's `SessionManager` (JSONL entries;
  `dist/index.d.ts:21`).
- `@ai-sdk/harness-pi` proves the seam: "Pi runs in the host Node.js process and uses the sandbox
  as a remote filesystem + shell" (`README.md:3`), through a `PiRemoteOps` built on an AI SDK
  `SandboxSession` (`src/pi-remote-ops.ts:9-56`, `src/pi-read-operations.ts:24-34`).
  **(inference)** pi-coding-agent imports Node modules (`node:path`, `Buffer` in its operation
  types), so on workerd it would need the same treatment as pi-ai in the prototype's browser build;
  this was not tested.

### 5. Vercel AI SDK

- **Core tools and agents:** `tool({ description, inputSchema (Zod or JSON Schema), execute })`; a
  `ToolLoopAgent` or `generateText`/`streamText` with `stopWhen` runs the loop
  (`AISDK/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx:6-50`). Sub-agents are a tool whose
  `execute` calls another agent; the child's context is isolated unless the tool passes `messages`
  (`AISDK/docs/03-agents/06-subagents.mdx:8-16`, `:341-360`). History is the application's
  `ModelMessage[]`. Models are `LanguageModelV4` objects from providers (`customProvider`,
  OpenAI-compatible providers; `AISDK/docs/03-ai-sdk-core/45-provider-management.mdx:22-80`).
- **Sandbox:** `experimental_sandbox` on `generateText`/`streamText`/`ToolLoopAgent` hands an
  `Experimental_SandboxSession` to tool `execute` and to dynamic descriptions. It "does not sandbox
  the tool itself" (`AISDK/docs/07-reference/01-ai-sdk-core/34-sandbox.mdx:8-19`). The doc shows
  only `description` and `run` (`:30-43`); the installed type also has `readFile`,
  `readBinaryFile`, `readTextFile` (with line ranges), `writeFile`/`writeBinaryFile`/`writeTextFile`
  and `spawn` (`@ai-sdk/provider-utils@5.0.53 dist/index.d.ts:1864-1885`).
- **Harnesses** (experimental): `HarnessAgent` runs a complete agent runtime (Claude Code, Codex,
  Pi, DeepAgents, OpenCode, …) through one AI SDK surface. Its pieces are the agent, a harness
  adapter, a sandbox provider and a session that "owns state"
  (`AISDK/docs/03-ai-sdk-harnesses/01-overview.mdx:8-23`, `:52-61`, `:82-86`; adapter table in
  `05-harness-adapters.mdx:17-47`). Built-in tools use common names
  (`read`/`write`/`edit`/`bash`/`grep`/`glob`); host-defined AI SDK tools run in the host and
  report back (`03-tools.mdx:8-14`, `:35-47`, `:84-85`). Code that "should only touch the
  filesystem and spawn processes receives the reduced view" of the sandbox session
  (`@ai-sdk/harness src/v1/harness-v1-network-sandbox-session.ts:36-47`). **(inference)** This is
  the closest published analogue to our three-layer split: definitions (instructions, skills,
  tools), core (harness adapter) and environment (sandbox session). Its environment interface is
  a good reference for ours, but it assumes a host process plus a remote sandbox, not
  capability-filtered storage.

### 6. DeepAgents (LangChain)

- `createDeepAgent({ model, tools, systemPrompt, middleware, subagents, checkpointer, store,
  backend, memory, skills, permissions, … })` (`deepagents@1.16.5 dist/agent-DiA5yRzO.d.ts:3116-3260`).
  It builds on LangGraph/LangChain: models are LangChain chat models, tools are `StructuredTool`,
  history goes through the checkpointer, and long-term memory through `BaseStore` (`package.json`
  dependencies).
- File access goes through a **backend**. `BackendProtocolV2 { ls, read(path, offset, limit),
  readRaw, write, edit(path, old, new, replaceAll), grep(pattern, path, glob, maxCount),
  glob(pattern, path), delete?, uploadFiles?, downloadFiles? }` (`:32-95`, `:155-229`).
  `SandboxBackendProtocolV2` adds only `execute(command)` and `id` (`:230-233`): no cwd, env,
  timeout or signal. A backend can be a factory of the runtime (`BackendFactory`, `:770`).
  Built-ins are `StateBackend` (in graph state), `StoreBackend`, `FilesystemBackend`,
  `LocalShellBackend`, `CompositeBackend` (routes by path prefix, e.g. `/memories/` to the store)
  and `BaseSandbox`, which derives every file verb from `execute` plus upload/download using POSIX
  tools (`:3888-3897`, `:4355-4385`). The model sees `ls`, `read_file`, `write_file`, `edit_file`,
  `delete`, `glob`, `grep`, `execute` (`:845`).
- Sub-agents: `SubAgent { name, description, systemPrompt, mode: "isolated" | "fork", tools,
  model, middleware, interruptOn }` (`:1551-1560`), called through a `task` tool.
- The package ships a browser build (`package.json:56-73`). **(inference)** That suggests it can
  load outside Node, but LangGraph on workerd was not checked.
- The official docs at docs.langchain.com were not reachable from this session (network
  allowlist); facts here come from the published type declarations.

### 7. Side by side

| Need | Flue 2.3 | pi | AI SDK 7 | DeepAgents 1.16 |
|---|---|---|---|---|
| Files | `Sandbox` file verbs | `*Operations` per tool | `SandboxSession` read/write | `BackendProtocol` |
| Search | via `exec` (rg/grep/find) | `find` via ops; `grep` local rg | none; tools via `run` | `grep`/`glob` **methods** |
| Shell | `exec` with cwd/env/timeout/signal | `BashOperations.exec` (streams `onData`) | `run`/`spawn` | `execute(command)` |
| Tool format | Valibot (`defineTool`) or TypeBox `AgentTool` | TypeBox `AgentTool` | Zod or JSON Schema | LangChain `StructuredTool` |
| Model | pi-ai `Provider` via `setProvider` | pi-ai `Provider` | `LanguageModelV4` | LangChain chat model |
| History | own stores; on Cloudflare its own DO SQLite | `SessionManager` / caller | caller's messages | checkpointer + store |
| Sub-agents | `task`, same sandbox only | extension | tool that calls an agent | `task`, isolated or fork |
| Skills | `SKILL.md`, `.agents/skills/` | skill dirs | `HarnessAgent` skills | `skills` param |

### 8. A narrow core interface for the environment (inference)

Everything in this section is **(inference)**, drawn from the table above.

1. **Files** (required). POSIX paths under a root: `stat`, `readdir` (with stats, as the
   prototype's `readdirStat`), `read(path, { offset?, length? })` returning bytes or a stream,
   `write`, `append`, `mkdir`, `rm`, `mv`/`cp`, `exists`. Errors carry errno codes. This is the
   intersection of Flue's `Sandbox`, pi's operations, DeepAgents' backend and the AI SDK session,
   and it is what `CapFs` already calls.
2. **Search** (required, native). `grep(pattern, { path, glob, literal, maxCount })` and
   `glob(pattern, { path, limit })`. DeepAgents needs them as methods, pi's `find` as an operation,
   and the Flue adapter would serve them through `SandboxFactory.tools`. That removes the `rg` shim
   and the per-entry shell walks, and lets the environment run search next to the data.
3. **Exec** (optional, declared). `exec(command, { cwd, env, timeoutMs, signal, onData? })`.
   Implementations: just-bash over Files (everywhere), Wasmer (cellb only), none (then the adapters
   leave out bash). Exec is a service derived from Files, not a second path to the data.
4. **Tools** (catalog). `list() → [{ name, description, inputSchema: JSON Schema, annotations }]`
   and `call(name, input, { callId, signal }) → { content, isError }`. JSON Schema is the common
   form: TypeBox *is* JSON Schema (pi, Flue's `SandboxToolFactory`), the AI SDK accepts
   `jsonSchema()`, LangChain tools accept JSON Schema. Flue's `useTool` path needs Valibot, so the
   Flue adapter should mount environment tools through `SandboxFactory.tools`.
5. **Model gateway**. An OpenAI-compatible (and optionally Anthropic Messages) endpoint, exposed as
   a `fetch` plus model metadata (`id`, `contextWindow`, `maxTokens`, `input`, `reasoning`). The
   environment checks the model right and meters per request inside that fetch. Every core can
   point at it: a pi-ai `createProvider` whose models carry the gateway `baseUrl` (Flue and pi), an
   OpenAI-compatible AI SDK provider with a custom `fetch`, LangChain `ChatOpenAI` with `baseURL`.
   This moves the prototype's `getApiKey` reserve and `turn_end` charge out of the core-specific
   loop. Usage is then read from the provider response, as the prototype already does.
6. **Store** (per capability). `get/put/append/list` on keys scoped by the capability and chain.
   It backs pi-agent-core message arrays, AI SDK messages, or a LangGraph checkpointer and store.
   Flue's full runtime would need a `PersistenceAdapter` over it, which Flue accepts only on its
   Node target (`FLUE/docs/reference/data-persistence-api.md:11`).
7. **Attenuate**. `attenuate(spec) → Environment`, the only delegation primitive. A core's own
   sub-agent mechanism keeps the parent's rights (Flue explicitly so). A delegate with narrower
   rights is a new core instance on the attenuated environment, which the harness reaches through
   a tool (as the prototype's chain does).
8. **Definitions** are files: agents, skills and tool manifests read from mounted folders through
   Files. Flue already discovers `AGENTS.md` and `.agents/skills/` from the sandbox cwd, so mounting
   definitions there gives Flue skills with no extra code. Other cores get them from the adapter.

What stays in each core: the loop, prompt composition, compaction, the model-facing tool wording
and truncation, the core's own sub-agents, and its session format. What each adapter does: map
items 1-7 onto `Sandbox` + `SandboxToolFactory` + `setProvider` (Flue, or pi-agent-core directly
as today), the `*Operations` objects + `registerTool` (pi), `BackendProtocolV2` (DeepAgents), and
`SandboxSession` + `tool()` (AI SDK).

### Open questions

- Whether to run Flue's full runtime at all. On Cloudflare it owns its Durable Object classes and
  storage, and its sub-agents cannot be narrowed. The prototype's route (Flue tool factories plus
  pi-agent-core) keeps both under our control, but loses Flue's skills, compaction and durable
  submissions. Another option is Flue's Node target `start({ db })` inside cellb, with a
  `PersistenceAdapter` over the store; it is untested.
- Whether pi-coding-agent and LangGraph load on workerd and celld (Node built-ins). Neither was tried.
- The AI SDK's harness interfaces are marked experimental and change between releases.

## Sources

- Flue 2.3.0 docs (local, = https://flueframework.com/docs/): `FLUE/docs/reference/sandbox-api.md`,
  `FLUE/docs/reference/agent-hooks-api.md`, `FLUE/docs/reference/agent-api.md`,
  `FLUE/docs/reference/provider-api.md`, `FLUE/docs/reference/agent-behavior.md`,
  `FLUE/docs/reference/data-persistence-api.md`, `FLUE/docs/guide/sandboxes.md`,
  `FLUE/docs/guide/subagents.md`, `FLUE/docs/guide/skills.md`, `FLUE/docs/guide/models.md`,
  `FLUE/docs/guide/cloudflare-target.md`; repository https://github.com/withastro/flue
  (`packages/runtime`), not fetched.
- Flue 2.3.0 source: `FLUE/dist/result-e-IUH4HT.mjs` (tool factories),
  `FLUE/dist/conversation-stream-store-CXrgv-b0.mjs` (pi-agent-core `Agent` construction),
  `FLUE/package.json` (dependencies on pi-agent-core and pi-ai `^1.1.0`).
- pi: `PIAC/dist/types.d.ts`; `@earendil-works/pi-coding-agent@1.5.2` `dist/core/tools/*.d.ts`,
  `docs/extensions.md`, `dist/index.d.ts`; https://pi.dev/docs/latest/providers (cited by Flue's
  docs); repository https://github.com/earendil-works/pi, not attached to this session.
- Prototype: `PROTO/src/agent.ts`, `PROTO/src/agent-loop.ts`, `PROTO/src/flue-compat.ts`,
  `PROTO/src/capfs.ts`, `PROTO/src/caps.ts`, `PROTO/src/wasmer/flue-sandbox.ts`, `PROTO/README.md`
  ("Agent loop", "Wasmer", "Decisions a reader would otherwise undo").
- Vercel AI SDK 7.0.127 docs (local, = https://ai-sdk.dev/docs):
  `AISDK/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx`, `AISDK/docs/03-agents/06-subagents.mdx`,
  `AISDK/docs/07-reference/01-ai-sdk-core/34-sandbox.mdx`,
  `AISDK/docs/03-ai-sdk-harnesses/{01-overview,03-tools,05-harness-adapters}.mdx`;
  `@ai-sdk/provider-utils@5.0.53` `dist/index.d.ts`; `@ai-sdk/harness@1.0.184`
  `src/v1/harness-v1-network-sandbox-session.ts`; `@ai-sdk/harness-pi@1.0.187` `README.md`,
  `src/pi-remote-ops.ts`, `src/pi-read-operations.ts`.
- DeepAgents: `deepagents@1.16.5` `dist/agent-DiA5yRzO.d.ts`, `package.json`; repository
  https://github.com/langchain-ai/deepagentsjs and docs
  https://docs.langchain.com/oss/javascript/deepagents/backends, neither reachable from this session.
