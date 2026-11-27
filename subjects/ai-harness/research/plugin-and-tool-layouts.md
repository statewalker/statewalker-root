# Which plugin, agent and tool layouts do coding harnesses share?

Research for `statewalker/statewalker-root#82`. Sources read on 2026-11-17. Statements marked
**(inference)** are this note's own reasoning, not a source's claim. Documentation sites were read
as Markdown (`<page>.md`) with `curl` where they offer it; GitHub repositories the session has no
API access to were read from shallow clones at the commits named under **Sources**.

## Question

The harness loads plugins into a FilesApi with a separate loader, filters them per user role and
mounts the result into each project's file view at `<project>/.agents/`, where Flue discovers
skills natively. Plugins are meant to follow Agent Plugins v1.0.0, with harness extras in an
extension directory (default namespace `dev.cellb.harness`); tools are described by an OpenAPI
document, and when a plugin's tools folder has one, script names must match its operations. So:

1. What plugin or extension layouts do Agent Plugins, Claude Code, OpenAI Codex, Gemini CLI,
   OpenCode, Cursor, GitHub Copilot, pi and Flue use, and where do they converge?
2. How do their sub-agent definition files compare, field by field?
3. How does each define tools as code: location, name derivation, input schema, execute
   signature, runtime, output shape?
4. Does any harness pair code tools with an OpenAPI document, and is there a convention for
   "operationId ↔ script file name"?

## Short answer

- **Agent Plugins v1.0.0 is now the shared floor, and three of the surveyed harnesses load it
  natively:** a directory with a closed root `plugin.json` (`$schema`, `name`, metadata,
  `extensions`), skills in `skills/<name>/SKILL.md`, MCP servers in root `mcp.json`, and anything
  client-specific in a top-level directory named after a reverse-domain namespace. OpenAI
  (`extensions.com.openai`), GitHub Copilot CLI (`com.github.copilot/` directory) and Cursor load
  it; the site also lists VS Code, Kiro and others. Claude Code, Gemini CLI, OpenCode and pi do not
  mention it in the docs read; each keeps its own manifest (`.claude-plugin/plugin.json`,
  `gemini-extension.json`, `package.json`). A 1.1.0 **working draft** adds root `hooks.json`,
  `assets/icon.png` and `displayName`.
- **What converges beyond the spec:** `skills/<name>/SKILL.md` (Agent Skills format) everywhere;
  `.agents/skills/` as the cross-harness project skill path (Codex, Gemini CLI, Cursor, Copilot,
  OpenCode, pi and Flue all scan it; Claude Code scans only `.claude/skills/`); `AGENTS.md` as
  project instructions; an `agents/` directory of Markdown files with YAML front matter (Claude
  Code, Cursor, Gemini CLI, Copilot, OpenCode; Codex alone uses TOML); `hooks/hooks.json`
  (Claude Code, Gemini CLI, Cursor, Codex overlay, Copilot legacy); `commands/` of Markdown (TOML in
  Gemini).
- **Where they differ:** manifest location (root, `.claude-plugin/`, `.cursor-plugin/`,
  `.codex-plugin/`, `.github/plugin/`), MCP file name (`mcp.json` vs `.mcp.json` vs inline in the
  manifest), the root-path placeholder (`${PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_ROOT}`,
  `${CURSOR_PLUGIN_ROOT}`, `${extensionPath}`), and whether a manifest may point components
  elsewhere (Claude Code, Cursor, Copilot legacy: yes; Agent Plugins: no, locations are fixed).
- **Sub-agents agree on `name` + `description` + a Markdown body as the system prompt**, usually
  with `tools` (list) and `model` (`inherit` or an id). Beyond that every harness has its own
  fields: Claude Code `permissionMode`, `maxTurns`, `skills`, `mcpServers`; OpenCode `mode`,
  `permissions`; Gemini `max_turns`, `timeout_mins`, `temperature`; Cursor `readonly`,
  `is_background`; Copilot `target`, `disable-model-invocation`, `user-invocable`.
- **Tools as code have no shared file format.** The only file-per-tool convention is OpenCode V1
  (`.opencode/tools/<name>.ts`, default export `tool({ description, args, execute })`, file name =
  tool name, named exports become `<file>_<export>`); OpenCode V2 dropped it for plugin
  registration with JSON Schema. Pi (`pi.registerTool`, TypeBox), Flue (`defineTool`, Valibot), the
  AI SDK (`tool`, Zod or JSON Schema), Mastra (`createTool`, Standard JSON Schema) and the Claude
  Agent SDK (`tool`, Zod, inside an in-process MCP server) all register objects in code. Claude
  Code, Codex and Cursor take custom tools only through MCP (Claude Code plugins can also put
  executables on the Bash tool's `PATH` via `bin/`). Gemini CLI alone shells out: a
  `tools.discoveryCommand` prints function declarations and `tools.callCommand <name>` reads JSON
  arguments on stdin.
- **Every code-tool shape boils down to `{ name, description, input JSON Schema, execute(input,
  context) → content }`**, with input converted to JSON Schema for the model, an abort signal in
  the context, and either a string, a JSON value or MCP-style `content` blocks as output.
- **No coding harness pairs code tools with an OpenAPI document.** The binding convention exists
  elsewhere: Microsoft 365 Copilot API plugins require each function `name` to equal an
  `operationId`; openapi-backend registers handlers keyed by `operationId`; Connexion resolves
  `operationId` to a module function (with `x-openapi-router-controller` naming the module).
  OpenAPI itself says operationIds are unique, case-sensitive and should follow programming naming
  conventions.
- **Recommended plugin layout (inference)**, using the most widely shared conventions:

  ```text
  my-plugin/
  ├── plugin.json                 # Agent Plugins 1.0.0; harness data under extensions["dev.cellb.harness"]
  ├── skills/<skill>/SKILL.md     # Agent Skills; portable to every surveyed harness
  ├── mcp.json                    # Agent Plugins MCP config ($schema, mcpServers)
  ├── assets/icon.png             # optional; reserved by the 1.1.0 draft
  └── dev.cellb.harness/          # extension directory, as Copilot does with com.github.copilot/
      ├── agents/<agent>.md       # front matter: name, description, tools, model (+ harness fields)
      ├── commands/<command>.md   # optional, Markdown prompt templates
      ├── hooks/hooks.json        # optional, Claude Code / Gemini shape
      └── tools/
          ├── openapi.yaml        # one OpenAPI 3.1 document for the plugin's tools
          └── <operationId>.ts    # one module per operation; default export execute(input, ctx)
  ```

  Without an OpenAPI file, `tools/<name>.ts` follows OpenCode V1: the file name is the tool name and
  the module default-exports `{ description, input, execute }`. In both cases operationIds and file
  names use `^[a-z0-9_]{1,64}$` (snake_case, as Flue and pi name tools), which fits every LLM
  provider's tool-name rule and Microsoft's `^[A-Za-z0-9_]+$`.

## Findings

### Agent Plugins v1.0.0

The spec (status *Published*) defines a plugin as a directory "rooted at a single filesystem
location" with "a manifest at `plugin.json` in the plugin root". Its standard layout:

```text
my-plugin/
├── plugin.json
├── skills/summarize/SKILL.md   (+ scripts/, references/)
├── mcp.json
├── com.example.client/hooks/
├── LICENSE
└── CHANGELOG.md
```

- **Manifest.** JSON object with a **closed** schema: `$schema` (required, exactly
  `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`), `name` (required), `version`,
  `description`, `author` (`name`, `email`, `url` only), `homepage`, `repository`, `license`,
  `keywords`, `extensions`. Unknown top-level fields are reported and ignored; any other violation
  rejects the plugin. `name`: 1–64 chars of `a-z 0-9 - .`, alphanumeric first and last, no `--` or
  `..`. Clients must not fetch the schema while loading (§5).
- **Fixed locations.** Skills: immediate children of `skills/` holding a `SKILL.md`, no deeper
  search. MCP servers: `mcp.json`. "`plugin.json` cannot override these locations or contain
  inline component configuration." A missing location is not an error (§6). v1 has exactly two
  component types; commands, hooks, agents, rules and LSP servers "remain too client-specific" and
  are out of scope (Design Decisions).
- **`mcp.json`.** `{ "$schema": ".../1.0.0/mcp.schema.json", "mcpServers": { <name>: server } }`.
  A server is `stdio` (`command` as one token, bare or `./`-relative; `args`, `env`, `cwd`) or
  `streamable-http` / `sse` (`url`, literal `headers`). No OAuth or credential fields; secrets must
  not be put in `env` or `headers` (§7.2).
- **Extensions.** Client-specific manifest data goes under `extensions["<reverse-domain>"]` (an
  object); client-specific files go in "a top-level directory named for that namespace". Clients
  ignore namespaces they do not implement, without validating them (§8).
- **Placeholders.** For stdio subprocesses the client sets `PLUGIN_ROOT` and `PLUGIN_DATA` (a
  persistent writable directory kept across updates) and expands `${PLUGIN_ROOT}` /
  `${PLUGIN_DATA}` in `args`, `env` values and `cwd` only (§9). The spec's example installs plugins
  under `~/.agents/plugins/<name>`.
- **Paths** in configuration start with `./`, and every resolved path must stay inside the plugin
  root (symlinks included) (§4.1).
- **1.1.0 working draft** (spec repository `spec/1.1.0.md`): adds `displayName` to the manifest,
  a third component type, hooks, at root `hooks.json`, and an `assets/` directory reserved for
  portable assets (`assets/icon.png`). Copilot CLI already recognises the 1.1.0 `$schema`, though
  the site does not publish that schema yet (it returns 404).
- **Compatible clients** listed on the site: VS Code, Cursor, GitHub Copilot, ChatGPT & Codex,
  Kiro, Hermes Agent, OpenClaw, Grok Bot, NanoClaw (all: Agent Skills plus MCP). Claude Code is not
  listed. The steering committee has maintainers from Amazon, Cursor, Microsoft, OpenAI and Vercel.

### Plugin and extension layouts compared

| Harness | Manifest | Skills | Agents | Commands | Hooks | MCP | Other |
|---|---|---|---|---|---|---|---|
| **Agent Plugins 1.0** | `plugin.json` (root, closed) | `skills/` | (extension dir) | (extension dir) | (extension dir; root `hooks.json` in 1.1 draft) | `mcp.json` | `<namespace>/` |
| **Claude Code** | `.claude-plugin/plugin.json` (optional) | `skills/` | `agents/` | `commands/` | `hooks/hooks.json` | `.mcp.json` | `.lsp.json`, `bin/`, `output-styles/`, `workflows/`, `themes/`, `monitors/` |
| **OpenAI Codex / ChatGPT** | `plugin.json` (Agent Plugins) + `extensions.com.openai`; fallback `.codex-plugin/plugin.json` | `skills/` | none in plugins (`.codex/agents/*.toml`) | none (skills replace prompts) | `./hooks/hooks.json` via `extensions.com.openai.hooks` | `mcp.json` (legacy `.mcp.json`) | `.app.json`, `assets/` |
| **Gemini CLI** | `gemini-extension.json` | `skills/` | `agents/*.md` (preview) | `commands/*.toml` | `hooks/hooks.json` | inline `mcpServers` | `GEMINI.md` context file, `settings` |
| **OpenCode V2** | `package.json` `exports` (`.`, `./tui`, `./gui-experimental`, `./rpc`) | `.opencode/skills/` (not plugin files) | `.opencode/agents/*.md` | `.opencode/commands/*.md` | registered in code | `opencode.json` `mcp` | plugin `setup(ctx)` registers tools, agents, commands |
| **Cursor** | `plugin.json` (Agent Plugins) or `.cursor-plugin/plugin.json` | `skills/` | `agents/` | `commands/` | `hooks/hooks.json` | `mcp.json` | `rules/*.mdc`, `variables` |
| **GitHub Copilot CLI** | `plugin.json` (Agent Plugins) or legacy `.plugin/`, `.github/plugin/`, `.claude-plugin/` | `skills/` | `com.github.copilot/agents/` (legacy `agents/`) | `com.github.copilot/commands/` | `com.github.copilot/hooks/hooks.json` | `mcp.json` (legacy `.mcp.json`) | `com.github.copilot/rules/`, `com.github.copilot/lsp.json` |
| **pi** | `package.json` `pi` key (optional) | `skills/` | none (subagents via extension example) | `prompts/*.md` | event handlers in extensions | `.pi/mcp.json` (not in packages) | `extensions/*.ts`, `themes/` |
| **Flue** | none (application code) | declared `useSkill` + workspace `.agents/skills/` | `useSubagent` in code | none | agent hooks in code | `useMcpConnection` in code | `src/agents/`, `src/tools/` |

Details and sources per harness:

- **Claude Code.** "The manifest is optional"; save it at `.claude-plugin/plugin.json` and "put
  every other plugin file at the plugin root". `name` is the only required field; components are
  namespaced under it (`deploy-tools:reviewer`). Manifest keys may point components elsewhere:
  `commands`, `agents`, `outputStyles`, `workflows` replace the default directory, `skills` adds to
  it, `hooks`, `mcpServers`, `lspServers` merge. Variables: `${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`), `${CLAUDE_PROJECT_DIR}`. `bin/` puts
  executables on the Bash tool's `PATH`. A `CLAUDE.md` in a plugin is not loaded. Marketplaces are
  `.claude-plugin/marketplace.json` with `name`, `owner`, `plugins[]` (each `name` + `source`).
  Skills follow Agent Skills; project skills live in `.claude/skills/`, and a skill folder with a
  `.claude-plugin/plugin.json` loads as a plugin `<name>@skills-dir`.
- **OpenAI Codex / ChatGPT.** "For a portable Agent Plugins package, add `plugin.json` at the
  plugin root" with `skills/`, `mcp.json`, optional assets. OpenAI-specific settings (`apps` →
  `./.app.json`, `hooks` → `./hooks/hooks.json`, `onboardingSkill`, `interface` presentation) go
  under `extensions.com.openai`; `.codex-plugin/plugin.json` "remain[s] supported as a
  compatibility fallback" and the two are not merged. Note that OpenAI keeps its referenced files
  (`.app.json`, `hooks/`) at the plugin root, not in a `com.openai/` directory. "OpenAI also accepts
  legacy and Claude-compatible manifests." Marketplaces: `$REPO_ROOT/.agents/plugins/marketplace.json`
  or `~/.agents/plugins/marketplace.json`. Codex scans `.agents/skills` from the working directory
  up to the repository root, plus `$HOME/.agents/skills` and `/etc/codex/skills`. `AGENTS.md`
  (and `AGENTS.override.md`) is read from Codex home and from each directory between the project
  root and the working directory, concatenated root-down, 32 KiB by default.
- **Gemini CLI.** Extensions live in `~/.gemini/extensions/<name>/` with `gemini-extension.json`
  (`name`, `version`, `description`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`,
  `migratedTo`, `plan`); `${extensionPath}` is the root placeholder. Commands are TOML in
  `commands/` (`commands/gcs/sync.toml` → `/gcs:sync`), hooks in `hooks/hooks.json` ("not defined
  in the manifest"), skills in `skills/`, sub-agents as `.md` in `agents/`. Workspace skills:
  `.gemini/skills/` or the `.agents/skills/` alias, which "takes precedence" and "provides an
  interoperable path ... across different AI tools". Context file names are configurable
  (`"fileName": ["AGENTS.md", "CONTEXT.md", "GEMINI.md"]`).
- **OpenCode.** V2 plugins are npm packages or local directories under `.opencode/plugins/`; one
  package has parts as `exports` (`.` server, `./tui`, `./gui-experimental`, `./rpc`) and the server
  part `Plugin.define({ id, setup(ctx) })` "adds tools, hooks, integrations, commands, and agents".
  Agents, commands and skills are separate files: `.opencode/agents/<name>.md` (nested path is the
  ID, `team/reviewer`), `.opencode/commands/<name>.md`, `.opencode/skills/<id>/SKILL.md`. Skill
  discovery also reads `.claude/skills` and `.agents/skills` (project, every ancestor) and
  `~/.claude/skills`, `~/.agents/skills`. Instructions: every `AGENTS.md` from the workspace up.
- **Cursor.** Supports Agent Plugins ("spec-conformant plugins load in Cursor") and its own
  `.cursor-plugin/plugin.json` format, which adds rules, agents, commands, hooks and variables.
  Cursor "does not expand the standard's `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` variables in
  `mcp.json`; use `${CURSOR_PLUGIN_ROOT}`" (a deviation from §9). Cursor Plugin defaults:
  `skills/`, `rules/` (`.md`, `.mdc`), `agents/`, `commands/`, `hooks/hooks.json`, `mcp.json`, and
  a root `SKILL.md` as a single-skill plugin. Project skills: `.agents/skills/` and
  `.cursor/skills/`, plus `.claude/skills/` and `.codex/skills/` for compatibility. Project rules:
  `.cursor/rules/*.mdc` with `description`, `globs`, `alwaysApply`; `AGENTS.md` as the plain
  alternative. MCP: `.cursor/mcp.json` and `~/.cursor/mcp.json`.
- **GitHub Copilot CLI.** "Agent Plugins requires the manifest at the plugin root. A root
  `plugin.json` that targets Agent Plugins takes precedence over `.plugin/plugin.json` and
  `.claude-plugin/plugin.json`." Recognises 1.0.0 and 1.1.0 `$schema` values; an unsupported
  version rejects the plugin rather than falling back to legacy. It expands `${PLUGIN_ROOT}` and
  `${PLUGIN_DATA}` (plus `CLAUDE_PLUGIN_DATA` and `COPILOT_PLUGIN_DATA` aliases). Its extension
  directory is the closest precedent for this harness:

  | Component | Location |
  |---|---|
  | Custom agents | `com.github.copilot/agents/` |
  | Slash commands | `com.github.copilot/commands/` |
  | Rules | `com.github.copilot/rules/` |
  | Hooks | `com.github.copilot/hooks/hooks.json` |
  | LSP servers | `com.github.copilot/lsp.json` |

  Project skills: `.github/skills`, `.agents/skills`, `.claude/skills`; personal `~/.copilot/skills`,
  `~/.agents/skills`. Custom agents: `.github/agents/` and `.claude/agents/` (project and parents),
  `~/.copilot/agents/`. Marketplaces: `marketplace.json`, `.plugin/`, `.github/plugin/` or
  `.claude-plugin/marketplace.json`. VS Code uses `.github/agents/<name>.agent.md`,
  `.github/prompts/*.prompt.md`, and `.github/copilot-instructions.md` or `AGENTS.md`.
- **pi.** A Pi package is "an ordinary directory or npm package" with conventional `extensions/`,
  `skills/`, `prompts/`, `themes/`, or explicit paths under the `pi` key of `package.json`.
  Extensions load from `~/.pi/agent/extensions/` and `.pi/extensions/` (`*.ts`, `*/index.ts`, or a
  `package.json` with `pi.extensions`), via jiti. Skills also come from `~/.agents/skills/` and
  `.agents/skills/` (ancestors up to the repository root). MCP: `~/.pi/agent/mcp.json` and
  `.pi/mcp.json`. Context: `AGENTS.md` (or `CLAUDE.md`). No built-in sub-agent file format; the
  extension examples include a `subagent/` extension.
- **Flue.** Not a plugin host: agents, tools, skills, sub-agents and MCP connections are declared
  in application code (`src/agents/*.ts` with `'use agent'`, hooks `useTool`, `useSkill`,
  `useSubagent`, `useMcpConnection`). The only file-based discovery is in the sandbox's working
  directory: "the runtime scans `.agents/skills/` in the sandbox's working directory, and every
  valid `<name>/SKILL.md` it finds joins the catalog", and the system prompt includes "the
  working directory path, a directory listing, and the contents of `AGENTS.md` when present".
  Workspace skills are read at activation time, so edits are picked up; a name colliding with a
  declared skill is an error. Flue does not discover agents, tools or MCP config from files.

### Sub-agent definition files

| | Claude Code | OpenCode V2 | Codex | Copilot | Gemini CLI | Cursor | Flue |
|---|---|---|---|---|---|---|---|
| Location | `.claude/agents/`, `~/.claude/agents/`, plugin `agents/` | `.opencode/agents/`, `~/.config/opencode/agents/` | `.codex/agents/`, `~/.codex/agents/` | `.github/agents/`, `.claude/agents/`, `~/.copilot/agents/` | `.gemini/agents/`, `~/.gemini/agents/`, extension `agents/` | `.cursor/agents/`, `.claude/agents/`, `.codex/agents/` | code (`useSubagent`) |
| Format | Markdown + YAML | Markdown + YAML (or JSONC) | TOML | Markdown + YAML (`.md` / `.agent.md`) | Markdown + YAML | Markdown + YAML | TS object |
| Identity | `name` (required; file name need not match) | path (`team/reviewer`) | `name` (required) | file name; `name` optional display | `name` (required, slug) | `name` (optional, default file name) | `name` |
| Description | `description` (required) | `description` | `description` (required) | `description` (required) | `description` (required) | `description` | `description` |
| Prompt | body | body (`system` in JSON) | `developer_instructions` | body (≤30,000 chars) | body | body | `agent` function's return |
| Tools | `tools`, `disallowedTools` | via `permissions` rules | `features.*` off switches | `tools` (aliases, `server/*`) | `tools` (wildcards) | `readonly` | hooks inside `agent` |
| Model | `model` (`inherit`, alias, id) | `model` `provider/model#variant` | `model`, `model_reasoning_effort` | `model` | `model` (default `inherit`), `temperature` | `model` (`inherit`) | inherits / `useModel` |
| Limits | `maxTurns`, `effort` | — | — | — | `max_turns` (30), `timeout_mins` (10) | — | depth cap 4 |
| MCP | `mcpServers` (ignored in plugins) | — | inherited only | `mcp-servers` (cloud only) | `mcpServers` | — | hooks |
| Other | `permissionMode`, `skills`, `hooks`, `memory`, `background`, `isolation`, `color` | `mode` (`primary`/`subagent`/`all`) | `skills.config` | `target`, `disable-model-invocation`, `user-invocable` | `kind` (`local`/`remote`) | `is_background` | — |

- Claude Code: "Only `name` and `description` are required"; plugin sub-agents ignore `hooks`,
  `mcpServers` and `permissionMode`; a sub-folder in a plugin's `agents/` becomes part of the
  scoped id (`my-plugin:review:security`). Names cannot contain `:`.
- Codex: custom agents "inherit the parent's permissions, provider, and MCP servers"; `name` is
  "the source of truth", matching the file name is only a convention.
- Copilot: "The configuration file's name (minus `.md` or `.agent.md`) is used for deduplication";
  unrecognised tool names are ignored "which allows product-specific tools to be specified".
- OpenCode V2 renamed V1 fields: `permission` → `permissions`, `prompt` → `system`, and V1
  `name`, `tools`, `temperature` are ignored in files read as V2.
- **Common core (inference):** `name`, `description`, Markdown body, `tools` list, `model` with
  `inherit`. Claude Code's field names are the most widely copied (Cursor and Copilot read
  `.claude/agents/`; Copilot maps `Read`, `Bash`, `Task` etc. as aliases).

### Tools as code

| Harness / library | Location | Name from | Input schema | Execute | Output | Runtime |
|---|---|---|---|---|---|---|
| **OpenCode V1** | `.opencode/tools/*.ts` or `*.js`, `~/.config/opencode/tools/` | file name; named export → `<file>_<export>` | `tool.schema` (Zod) in `args` | `execute(args, context)`; context `agent`, `sessionID`, `messageID`, `directory`, `worktree` | string | Bun (`Bun.$` in the docs' Python example) |
| **OpenCode V2** | plugin `setup(ctx)` | `name` (+ namespace, `acme_greeting`) | JSON Schema or Effect `Schema` in `input` | `execute(input, context)`; `context.signal`, `context.progress` | `{ content }` (text/file content) | OpenCode server |
| **pi** | extension `pi.registerTool(...)` | `name` (+ `label`) | TypeBox `parameters`, validated as JSON Schema | `execute(toolCallId, params, signal, onUpdate, ctx)` | `{ content: [{ type: "text", text }], details }` | Node via jiti |
| **Flue** | `defineTool(...)`, mounted by `useTool` (convention `src/tools/`) | `name` | Valibot `input` (top-level object; converted to JSON Schema); optional `output` | `run({ data, signal, log, toolCallId, harness?, step? })` | `{ output?, terminate? }` or string | Node / Cloudflare |
| **Gemini CLI** | settings `tools.discoveryCommand` / `tools.callCommand` | declared `name`, registered as `discovered_tool_<name>` | `parametersJsonSchema` per function declaration | subprocess `callCommand <name>`, JSON args on stdin | JSON on stdout | any executable |
| **Claude Agent SDK** | `tool(...)` in `createSdkMcpServer` | `name` arg | Zod shape (TS) or JSON Schema (Python) | `handler(args)` | MCP `{ content, structuredContent?, isError? }` | in-process MCP |
| **AI SDK 7** | `tool(...)` | key in the `tools` object | Zod or `jsonSchema()` `inputSchema`; optional `outputSchema` | `execute(input, options)`; may return async iterable | any JSON (or `toModelOutput`) | any JS |
| **Mastra** | `createTool(...)` | `id` | Standard JSON Schema `inputSchema` / `outputSchema` | `execute(input, context)` | any (or `toModelOutput`) | Node |
| **Claude Code, Codex, Cursor** | MCP only (Claude Code plugins: also `bin/` on `PATH`) | MCP tool name | MCP `inputSchema` | MCP `tools/call` | MCP content | server process |

Notes:

- OpenCode V1: "The filename becomes the tool name"; a custom tool with a built-in's name
  replaces it. The V1 docs are still served under `/v1/docs/`; the V2 docs list no tools directory,
  and the V2 migration guide ports V1 `tool()` maps to `ctx.tool.transform(editor => editor.add({
  name, description, input: <JSON Schema>, execute }))`, "Tool schemas use JSON Schema, and
  execution returns structured content."
- Pi validates with its own JSON Schema validator "whatever built the schema; TypeBox schemas are
  JSON Schema and work unchanged", coercing loosely typed arguments first. `promptSnippet` and
  `promptGuidelines` add tool lines to the system prompt.
- Flue: "a duplicate name, or a collision with a framework-reserved name like `task` or
  `activate_skill`, throws". `harness: true` gives the tool the sandbox and model; `durable: true`
  gives `step.do(name, fn)` for exactly-once-recorded effects; `timeoutMs` bounds a call.
- Gemini CLI's discovery output may be an array of function declarations or of objects with
  `functionDeclarations` / `function_declarations`; the tool description tells the model it runs
  `callCommand <name>` "on project root" (`tool-registry.ts`).
- OpenCode V1's own example writes the logic in Python (`.opencode/tools/add.py`) and a TS wrapper
  that shells out to it, which is the shape of "OpenAPI schema + script" without the OpenAPI part.

### OpenAPI and operationId ↔ code conventions

No surveyed coding harness reads an OpenAPI document to define tools. The conventions that bind
operations to code come from API plugin and server frameworks:

- **OpenAPI 3.1.1** `operationId`: "Unique string used to identify the operation. The id MUST be
  unique among all operations described in the API. The operationId value is case-sensitive. Tools
  and libraries MAY use the operationId to uniquely identify an operation, therefore, it is
  RECOMMENDED to follow common programming naming conventions."
- **Microsoft 365 Copilot API plugin manifest 2.4.** A function's `name` "uniquely identifies this
  function ... When the function is bound to an OpenAPI runtime, the value must match an
  operationId value in the OpenAPI description. Value must match the `^[A-Za-z0-9_]+$` regular
  expression." If `functions` is absent "the functions are inferred from the OpenAPI operations";
  a runtime (`OpenApi`, `LocalPlugin`, `RemoteMCPServer`) may restrict itself with
  `run_for_functions` (wildcards allowed). This is the closest precedent for "script names must
  match operations".
- **openapi-backend** (Node): "Handlers are registered for `operationIds`", e.g.
  `api.register({ getPets: handler, getPetById: handler })`; a handler gets a context with the
  parsed request, matched operation and validation result.
- **Connexion** (Python): `operationId: myapp.api.hello_world` resolves to that function;
  `x-openapi-router-controller: myapp.api` makes the operationId relative (module = controller,
  operationId = function); `RestyResolver` infers operationIds from path and method.
- **OpenAI GPT Actions** describe a custom GPT's API calls as an OpenAPI schema whose operations
  (with `operationId`) become function calls.
- The OpenAPI→MCP converters surveyed in `openapi-mcp-tool-mapping.md` derive the MCP tool name
  from `operationId` (see that note for collision handling and provider name limits).

**(inference)** Mapping one operation to one script file named after its `operationId` combines
the M365 rule (name equals operationId, restricted charset) with OpenCode V1's "file name is the
tool name". Connexion's controller-plus-function split suggests an alternative (one module per
tag, one export per operation) if plugins with many operations need it.

### What this means for the `.agents/` mount (inference)

- Flue only discovers `<cwd>/.agents/skills/*/SKILL.md` and `<cwd>/AGENTS.md` (and `<cwd>/CLAUDE.md`
  if present: @flue/runtime 2.3.0 `readAgentsMd` reads both). Mounting the
  merged skills of all enabled plugins at `<project>/.agents/skills/` gives native discovery; an
  `AGENTS.md` placed at `<project>/.agents/AGENTS.md` would **not** be read by Flue, which looks in
  the working directory itself.
- A plugin is a whole directory with its own `plugin.json`, so several plugins cannot each be
  mounted at `.agents/`; the mount has to merge their `skills/` into one tree (skill names are
  unique per directory, so collisions must be resolved or rejected) and keep each plugin's other
  parts under its own root, e.g. `.agents/plugins/<plugin>/…`, the path family Codex already uses
  for `.agents/plugins/marketplace.json`.
- Agents, tools and MCP servers are not discovered from files by Flue; the harness loader has to
  read them from each plugin (`dev.cellb.harness/agents/`, `tools/`, `mcp.json`) and register them
  with `useSubagent`, `useTool` and `useMcpConnection`.
- Keeping portable parts at Agent Plugins' fixed locations means the same plugin directory loads
  unchanged in Codex, Copilot CLI and Cursor (skills + MCP), and the extension directory is
  ignored there.

## Open questions

- Should the harness target `$schema` 1.0.0 only, or also accept the 1.1.0 draft (root
  `hooks.json`, `assets/icon.png`, `displayName`) as Copilot CLI does?
- Should operationIds be restricted to snake_case (`^[a-z0-9_]{1,64}$`) or allow the camelCase
  common in OpenAPI documents (`getPetById`), with the file name equal either way?
- Should a tools folder without an OpenAPI file be allowed (OpenCode V1 style, schema in the
  module), or should the loader always require the document and generate it for authors?
- Where does a plugin-level `AGENTS.md`-like instruction go, given Flue reads only the working
  directory's `AGENTS.md` (and `CLAUDE.md`) and Claude Code ignores a plugin `CLAUDE.md` (it says to use a skill)?
- Should `extensions["dev.cellb.harness"]` hold role filters (which roles may see which
  components), or should role filtering stay outside the plugin, in the loader's configuration?
- Is Claude Code compatibility (reading `.claude-plugin/plugin.json` plugins as OpenAI and Copilot
  do) worth supporting in the loader?

## Sources

- Agent Plugins: https://agent-plugins.org/specification, https://agent-plugins.org/llms.txt,
  https://agent-plugins.org/compatible-clients; spec repository
  https://github.com/agentplugins/agent-plugins-spec (commit `6395e89`: `spec/1.0.0.md`,
  `spec/1.1.0.md`)
- Agent Skills: https://agentskills.io/specification.md
- Claude Code: https://code.claude.com/docs/en/plugins-reference.md,
  https://code.claude.com/docs/en/plugins/marketplace-reference.md,
  https://code.claude.com/docs/en/sub-agents.md, https://code.claude.com/docs/en/skills.md,
  https://code.claude.com/docs/en/agent-sdk/custom-tools.md
- OpenAI: https://developers.openai.com/plugins/build/plugins.md,
  https://learn.chatgpt.com/docs/build-skills.md,
  https://learn.chatgpt.com/docs/agent-configuration/subagents.md,
  https://learn.chatgpt.com/docs/agent-configuration/agents-md.md,
  https://developers.openai.com/api/docs/actions/introduction.md,
  https://developers.openai.com/api/docs/actions/getting-started.md
- Gemini CLI: https://github.com/google-gemini/gemini-cli (commit `4fa64e7`):
  `docs/extensions/reference.md`, `docs/core/subagents.md`, `docs/cli/skills.md`,
  `docs/cli/gemini-md.md`, `docs/reference/configuration.md`, `docs/reference/tools.md`,
  `packages/core/src/tools/tool-registry.ts`, `packages/core/src/tools/tool-names.ts`
- OpenCode: https://opencode.ai/docs/plugins.md, https://opencode.ai/docs/agents.md,
  https://opencode.ai/docs/skills.md, https://opencode.ai/docs/commands.md,
  https://opencode.ai/docs/instructions.md, https://opencode.ai/docs/migrate-v1.md,
  https://opencode.ai/docs/build/plugins.md, https://opencode.ai/docs/build/plugins/server.md,
  https://opencode.ai/docs/build/plugins/migrate-v1.md, https://opencode.ai/v1/docs/custom-tools/;
  https://github.com/anomalyco/opencode (commit `32974e0`: `services/site/src/docs/content/`)
- Cursor: https://cursor.com/docs/plugins.md, https://cursor.com/docs/reference/plugins.md,
  https://cursor.com/docs/skills.md, https://cursor.com/docs/subagents.md,
  https://cursor.com/docs/rules.md, https://cursor.com/docs/mcp.md
- GitHub Copilot: https://docs.github.com/en/copilot/reference/cli-plugin-reference,
  https://docs.github.com/en/copilot/reference/custom-agents-configuration,
  https://docs.github.com/en/copilot/concepts/agents/about-agent-skills (read through
  `docs.github.com/api/article/body`);
  https://code.visualstudio.com/docs/copilot/customization/custom-agents,
  https://code.visualstudio.com/docs/copilot/customization/prompt-files,
  https://code.visualstudio.com/docs/copilot/customization/custom-instructions
- pi: https://github.com/badlogic/pi-mono (commit `1f6f319`): `packages/coding-agent/docs/`
  `extensions.md`, `packages.md`, `skills.md`, `mcp.md`, `configuration.md`, `prompt-templates.md`
- Flue: https://github.com/withastro/flue (commit `deee93b`): `apps/docs/src/content/docs/`
  `guide/tools.md`, `guide/skills.md`, `guide/subagents.md`, `guide/mcp.md`,
  `guide/sandboxes.md`, `guide/project-layout.md`, `reference/agent-behavior.md`,
  `reference/sandbox-api.md`
- AI SDK: https://ai-sdk.dev/docs/reference/ai-sdk-core/tool.md (npm `ai` 7.0.173)
- Mastra: https://mastra.ai/reference/tools/create-tool.md
- OpenAPI: https://spec.openapis.org/oas/v3.1.1.html
- Microsoft 365 Copilot: https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/api-plugin-manifest-2.4
- openapi-backend: https://github.com/openapistack/openapi-backend (`README.md` at `main`)
- Connexion: https://connexion.readthedocs.io/en/latest/routing.html
- Related notes: [`openapi-mcp-tool-mapping.md`](../../platform/research/openapi-mcp-tool-mapping.md),
  [`mcp-and-skills-on-do.md`](mcp-and-skills-on-do.md),
  [`flue-runtime-surface.md`](flue-runtime-surface.md)
