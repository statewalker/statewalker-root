# How do MCP servers and skill definitions work on Durable Object runtimes?

Research for `statewalker/statewalker-root#73` (Wayfinder map `statewalker/statewalker-root#70`).
Sources read on 2026-11-15. Statements marked **(inference)** are this note's own reasoning, not a
source's claim. `modelcontextprotocol.io` did not resolve from the research container, so the MCP
specification was read from its source in `modelcontextprotocol/modelcontextprotocol` on GitHub
(`docs/specification/2026-07-28/*.mdx`, the revision `docs/docs.json` labels "Version 2026-07-28
(latest)"). The spec pages are cited below under their published URLs.

## Question

An AI harness runs on Durable Object runtimes: Cloudflare Workers/workerd, celld, and cellb in
Node and in the browser. Agents and skills are files in mounted folders (a composite FilesApi).
Tools come either from the FilesApi (bundles run in Worker Loader isolates with no network) or
from MCP server configurations. Biscuit capabilities (user, project role, agent, tool, mode)
filter every resource access.

1. **MCP on DO runtimes.** Which transports work in an isolate? What do the current MCP spec's
   transport and authorization rules say? What does Cloudflare support, how are an MCP server's
   tools listed and called, and how can a capability limit an MCP client's calls?
2. **Definition formats.** Compare Agent Skills (`SKILL.md`), `AGENTS.md`, Claude Code subagents
   and skill folders, Flue, the OpenAI Agents SDK and DeepAgents on name, description,
   instructions, allowed tools, model and resources. Then, as inference: which formats should the
   harness accept so that definitions in mounted folders stay portable?

## Short answer

- **Only Streamable HTTP is a real option in an isolate.** stdio means a subprocess the client
  launches, and Workers ship `node:child_process` only as a non-functional stub. HTTP+SSE is
  Deprecated in the spec. Cloudflare's server handler serves Streamable HTTP only. Clients (Flue,
  Agents SDK, OpenAI SDK) still offer SSE, but only for legacy servers.
- **MCP 2026-07-28 is stateless, which suits Durable Objects.** It drops the `initialize`
  handshake, the `Mcp-Session-Id` header, the GET stream and resumability. Every POST carries its
  version and capabilities in `_meta`. The transport mirrors the method and the tool name into the
  required `Mcp-Method` and `Mcp-Name` headers, so a gateway can route by tool without parsing the
  body. `tools/list` may vary by the authorization on the request.
- **Authorization is OAuth 2.1 at the HTTP layer:**
  - Protected Resource Metadata (RFC 9728) points the client at the authorization server.
  - PKCE is required.
  - Resource Indicators (RFC 8707) bind each token to one server.
  - The server must check the token's audience, and **token passthrough is forbidden**.
  - Client ID Metadata Documents replace Dynamic Client Registration, which is now Deprecated.
- **Cloudflare:**
  - `McpAgent` (a server on a Durable Object) is deprecated and feature-frozen. New servers use the
    stateless `createMcpHandler` from `agents/mcp/server`.
  - The Agent-side client (`addMcpServer`, `MCPClientManager`) persists connections and OAuth state
    in DO SQLite and blocks private-network URLs.
  - Code Mode runs model code in a Dynamic Worker with `globalOutbound: null`. MCP tools reach that
    code as RPC connectors, which the host intercepts for approval and logging.
  - Cloudflare One's MCP portals add a per-portal tool allow-list in front of upstream servers.
- **Limit MCP calls with a host-side MCP gateway, not inside the client (inference).** The gateway
  filters `tools/list` and checks each `tools/call` against the Biscuit token. It attaches the
  user's upstream OAuth token itself, because passthrough is forbidden, and it is the only route
  out of the network-less tool isolates. Every client library examined has a static or callback
  tool filter (Flue `tools`, OpenAI `toolFilter`, Agents SDK `filter`). These only narrow what the
  model sees and do not enforce anything.
- **Skills have one open format, Agent Skills:**
  - A `SKILL.md` file has six frontmatter fields: `name`, `description`, `license`,
    `compatibility`, `metadata` and the experimental `allowed-tools`.
  - Disclosure is progressive in three levels: catalog line, then body, then resources.
  - Flue, DeepAgents, Claude Code and the OpenAI sandbox agents all read it. `.agents/skills/` is
    the cross-client folder.
- **Agents have no shared file format.** `AGENTS.md` is free-form project instructions with no
  fields. Claude Code's `.claude/agents/*.md` is the only file format for agent definitions used
  at scale. Flue, OpenAI and DeepAgents define agents in code, but all of them use the same core
  fields: name, description, instructions, tools, model and skills.
- **Accept these formats (inference):**
  - `SKILL.md` per the spec.
  - `AGENTS.md` (and `CLAUDE.md`) as instructions.
  - Claude Code-style agent Markdown files.
  - A `.mcp.json`-style `mcpServers` map limited to HTTP entries.
  - Treat every `tools` or `allowed-tools` list as a request that the Biscuit capability narrows,
    never as a grant.

## Findings: MCP

### Transports in an isolate

- The spec defines two standard bindings. **stdio** is "newline-delimited messages over the
  standard streams of a client-launched subprocess". **Streamable HTTP** sends each message as
  "an HTTP POST to a single MCP endpoint; replies arrive as a JSON object or a request-scoped SSE
  stream". Custom transports are allowed if they keep JSON-RPC, the message patterns and the
  per-request metadata
  (https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).
- Workers list `node:child_process` among the "non-functional stub modules": a stub "can be
  imported … but does not provide a working implementation"
  (https://developers.cloudflare.com/workers/runtime-apis/nodejs/). So stdio cannot run there.
  The same holds for a browser **(inference)**.
- The HTTP+SSE transport is in the spec's Deprecated registry, with Streamable HTTP as the
  migration path (https://modelcontextprotocol.io/specification/2026-07-28/deprecated).
  Cloudflare: "`createMcpHandler` serves Streamable HTTP only"
  (https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/).
- Client libraries keep SSE for older servers:
  - Flue: `transport?: 'streamable-http' | 'sse'`, defaulting to Streamable HTTP
    (`@flue/runtime` 2.3.0 `docs/reference/agent-api.md`, `McpConnectionDefinition`). It builds
    `StreamableHTTPClientTransport` or `SSEClientTransport` from `@modelcontextprotocol/client`
    (`dist/mcp-*.mjs`).
  - Agents SDK: `type: "auto" | "streamable-http" | "sse"`
    (https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/).
  - OpenAI Agents SDK: `MCPServerSSE` "for legacy … transports"
    (https://openai.github.io/openai-agents-js/guides/mcp/).
- The Agents SDK also has an **RPC transport** to an `McpAgent` over a Durable Object binding,
  with no HTTP and no OAuth. It "only connects to `McpAgent`, which is deprecated", and there is
  "no RPC transport for servers built with `createMcpHandler`"
  (https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/).

### What MCP 2026-07-28 changed (relevant to DOs)

From the changelog (https://modelcontextprotocol.io/specification/2026-07-28/changelog):

- The revision removes protocol-level sessions and `Mcp-Session-Id`. List endpoints "no longer
  vary per-connection", and cross-call state uses "explicit, server-minted handles passed as
  ordinary tool arguments" (SEP-2567).
- It removes the `initialize` handshake. "Every request now carries its protocol version and
  client capabilities in `_meta`". It adds `server/discover`, which servers MUST implement
  (SEP-2575).
- The GET stream and `resources/subscribe` give way to one long-lived `subscriptions/listen` POST
  stream.
- SSE resumability (`Last-Event-ID`) is gone. A broken stream "loses the in-flight request" and
  the client re-issues it.
- Server-to-client requests (sampling, elicitation, roots) become **Multi Round-Trip Requests**:
  the server returns `resultType: "input_required"` and the client retries the original request
  with `inputResponses` (SEP-2322).
- `Mcp-Method` and `Mcp-Name` headers are now required on POSTs (SEP-2243). List results carry
  `ttlMs` and `cacheScope` (SEP-2549).
- Roots, Sampling, Logging and Dynamic Client Registration are deprecated, with earliest removal
  in the first revision on or after 2027-07-28
  (https://modelcontextprotocol.io/specification/2026-07-28/deprecated).
- Streamable HTTP rules
  (https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http):
  - Every client message is "a new HTTP POST".
  - `MCP-Protocol-Version` is required and must match the body; a mismatch gets `400` with
    `HeaderMismatch` (`-32020`).
  - `Mcp-Name` carries `params.name` for `tools/call`.
  - Servers "MUST validate the `Origin` header".
  - Older clients detect the era by trying a modern request first and falling back to
    `initialize`.
- **(inference)** A stateless request/response protocol needs no pinned connection. A Worker, a DO
  that hibernates, or a short-lived browser tab can each make a call without holding session
  state. Elicitation becomes a retried request instead of a server-held stream.
- Library state, 2026-11-15:
  - The sandbox's `@modelcontextprotocol/core` 2.3.1 still sets
    `LATEST_PROTOCOL_VERSION = "2025-11-25"` and supports back to `2024-10-07`. It already marks
    items "Deprecated as of protocol version 2026-07-28"
    (`node_modules/.pnpm/@modelcontextprotocol+core@2.3.1/.../dist/internal.d.mts`). npm's latest
    is 2.4.0.
  - Cloudflare's client "negotiates stateless or legacy behavior automatically"
    (https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/).
  - Cloudflare's MCP portals support "stateless MCP `2026-07-28` and earlier 2025 Streamable HTTP
    clients and servers"
    (https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/).

### Authorization (OAuth 2.1)

From https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization:

- "Authorization is **OPTIONAL**." HTTP transports SHOULD conform. stdio SHOULD NOT, and should
  "retrieve credentials from the environment".
- An MCP server is an OAuth 2.1 resource server and an MCP client is an OAuth 2.1 client. The
  standards are OAuth 2.1 (draft-ietf-oauth-v2-1-13), RFC 8414 / OIDC discovery, RFC 9728
  Protected Resource Metadata (servers MUST implement it, clients MUST use it to find the
  authorization server) and RFC 8707 Resource Indicators.
- Clients MUST send the `resource` parameter, set to the server's canonical URI, in both the
  authorization and the token requests. They use PKCE and validate `iss` (RFC 9207) when the
  authorization server advertises it.
- Tokens go in `Authorization: Bearer` on every request, never in the query string. Servers "MUST
  validate that access tokens were issued specifically for them as the intended audience" and
  "MUST NOT accept or transit any other tokens".
- Insufficient scope gets a challenge; step-up authorization re-requests with more scopes.
- Security considerations
  (https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations):
  a server calling upstream APIs "MUST NOT pass through the token it received from the MCP
  client"; it obtains its own upstream token.
- Client registration: Client ID Metadata Documents are preferred and Dynamic Client Registration
  (RFC 7591) is Deprecated (changelog, PR #2858).
- Cloudflare implements the server side with `OAuthResourceServer` from
  `@cloudflare/workers-oauth-provider`. It answers a request without a token with a `401` that
  points at the authorization server. `getMcpAuthContext()` exposes the authenticated props inside
  the server factory, "so you can register tools based on who is signed in"
  (https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/,
  https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/).
- Flue's client takes `auth: string | () => string | Promise<string>`, resolved per request and
  retried once on a 401. "Flue never stores or manages your tokens"
  (`@flue/runtime` `docs/guide/mcp.md`).
- The Agents SDK client runs the OAuth flow itself. `addMcpServer` returns `authenticating` with
  an `authUrl`, and the callback exchanges the code. Connections and OAuth state persist in the
  agent's SQL storage
  (https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/).

### Cloudflare's MCP support

- **Servers on Workers.** `createMcpHandler(createServer)` is **stateless**: "it builds a fresh
  server for every request, so you do not need a Durable Object, protocol session, or WebSocket".
  Durable data belongs "behind an authenticated handle in a Durable Object, D1, KV, or R2". It
  takes `legacy: "stateless" | "reject"` for older clients and `responseMode: "auto" | "json" |
  "sse"`. Elicitation returns `input_required` and completes through MRTR
  (https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/).
- **`McpAgent` (deprecated).** It "creates a stateful legacy MCP server backed by a Durable
  Object", "is deprecated and feature-frozen", and needs the v1 `@modelcontextprotocol/sdk`. A
  server that depends on session state, pushed requests or replay "needs a staged migration"
  (https://developers.cloudflare.com/agents/model-context-protocol/apis/agent-api/).
- **Client in an Agent (`this.mcp`, `MCPClientManager`):**
  - Agents SDK v0.20.0+ uses `@modelcontextprotocol/client` (npm `agents` is at 0.33.0).
  - `addMcpServer(name, url, { transport, headers, … })` persists the connection, and once it is
    ready "all tools from that server become available automatically".
  - Server URLs are validated against SSRF: private ranges, link-local and metadata endpoints are
    blocked, and loopback is allowed.
  - `this.mcp.listTools()` returns raw MCP tool records with `serverId`, and `getAITools()`
    converts them to AI SDK tools
    (https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/).
  - `listTools(filter?)` and `getAITools(filter?)` filter only "by `serverId`, `serverName`, or
    connection `state`"
    (https://developers.cloudflare.com/agents/runtime/capabilities/mcp-client-manager/).
- **Code Mode.**
  - `DynamicWorkerExecutor` runs model-written code in a Dynamic Worker (Worker Loader) per pass.
    "External `fetch()` and `connect()` calls are blocked by default … `globalOutbound: null`".
  - "Connector calls cross the sandbox boundary through Workers RPC. The runtime intercepts each
    call before the connector executes it", applying approval, logging, replay and rollback
    (https://developers.cloudflare.com/agents/tools/codemode/how-it-works/).
  - `McpConnector` exposes an existing MCP connection's tools as typed sandbox methods that call
    `connection.client.callTool()`. A `tool()` hook can mark one, for example `create_issue`, as
    `requiresApproval: true` (https://developers.cloudflare.com/agents/tools/codemode/mcp/).
- **MCP server portals (Cloudflare One).** A portal puts several upstream servers behind one
  endpoint. Admins choose "the specific tools and prompt templates that they want to make
  available" and can turn off individual tools. Access policies decide who sees a server, and
  users authenticate separately to each upstream server that needs OAuth. The docs warn: "Blocked
  users can still connect to the server … by using its direct URL" unless Access is the server's
  OAuth provider
  (https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/).

### Listing and calling tools

From https://modelcontextprotocol.io/specification/2026-07-28/server/tools:

- `tools/list` returns `Tool` records: `name`, `title`, `description`, `icons`, `inputSchema`
  (JSON Schema, 2020-12 by default), `outputSchema` and `annotations`. Servers SHOULD return them
  in a deterministic order.
- The set "MUST NOT vary per-connection" but "MAY vary by the authorization presented on the
  request — for example, returning only the tools the caller's granted scopes permit".
- `tools/call` takes `{ name, arguments }`. It returns `content` blocks, optional
  `structuredContent`, and `isError` for execution errors.
- "Clients **MUST** consider tool annotations to be untrusted unless they come from trusted
  servers." Annotations include `readOnlyHint` and `destructiveHint`.
- Tool names are unique only within one server. Aggregating clients "SHOULD implement a
  disambiguation strategy such as prefixing tool names with a server identifier".
- Humans: "there **SHOULD** always be a human in the loop with the ability to deny tool
  invocations". Clients SHOULD prompt for confirmation on sensitive operations and log tool usage.
- Two implementations use the same prefix convention:
  - Flue adapts tools as `mcp__<server>__<tool>`, sanitising characters outside
    `[A-Za-z0-9_-]`, and keeps `annotations` for approval decisions "when you trust the server"
    (`@flue/runtime` `docs/reference/agent-api.md`, `docs/guide/mcp.md`).
  - Claude Code uses the same `mcp__<server>__<tool>` form in permission rules, `allowed-tools`
    and subagent `tools` (https://code.claude.com/docs/en/mcp).

### Holding an MCP client to a capability

Mechanisms the sources provide:

| Mechanism | Where | Source |
|---|---|---|
| Static allow-list of tool names | Flue `tools: [...]` (unknown name rejects the connection) | `@flue/runtime` `docs/guide/mcp.md` |
| Static allow/block or per-run callback | OpenAI `toolFilter: createMCPToolStaticFilter({allowed, blocked})` or `async ({runContext}, tool) => boolean` | https://openai.github.io/openai-agents-js/guides/mcp/ |
| Per-tool approval | OpenAI hosted MCP `requireApproval: {always, never}`; Code Mode `requiresApproval`; DeepAgents `interruptOn` | OpenAI MCP guide; Code Mode MCP page; https://docs.langchain.com/oss/javascript/deepagents/subagents |
| Server-side scope filtering | `tools/list` may vary by authorization; `getMcpAuthContext()` in the server factory | MCP tools spec; Cloudflare handler API |
| Gateway / proxy | Cloudflare MCP portals: curated tools, Access policies, Gateway DLP on outbound calls | MCP portals page |
| Header routing | `Mcp-Method` / `Mcp-Name` required on every POST, "so that intermediaries … can route and inspect requests without parsing the body" | Streamable HTTP spec |
| Network isolation | Dynamic Worker with `globalOutbound: null`; MCP only via host RPC connectors | Code Mode how-it-works |

Flue's own guidance: "A tool's arguments are model-selected inputs, not an authorization
boundary". Trusted code binds the customer, token or destination, and the model picks only values
inside that boundary (`@flue/runtime` `docs/guide/tools.md`, "Protect access").

**Design implied for this harness (inference):**

1. **One host-side MCP gateway per runtime.** It is a module in the capability environment, not
   in the agent core. It is the only component that holds upstream credentials and talks to
   upstream servers. Tool isolates (Worker Loader, `globalOutbound: null`) and the agent core
   reach MCP only through it, as Code Mode reaches connectors through RPC. On cellb in the browser,
   a remote server must also allow CORS for a direct call; the gateway can sit server-side
   instead. That is unverified.
2. **Listing.** The gateway calls upstream `tools/list` and returns only the tools the Biscuit
   token authorizes for (user, project role, agent, mode). It exposes them as
   `mcp__<server>__<tool>`, the name capabilities and definitions already use in Flue and Claude
   Code.
3. **Calling.** On every `tools/call`, the gateway re-checks the token against server, tool and,
   where policy needs it, arguments, using the parsed body. The `Mcp-Name` header is a mirror; the
   body is the source of truth and a mismatch is a `HeaderMismatch`. Modes map to approval:
   "read-only" mode admits only tools a trusted server marks `readOnlyHint`, or an explicit
   allow-list, because annotations from untrusted servers are hints. Destructive tools pause for
   approval the way Code Mode and Flue do: record, end the turn, resume on a signal.
4. **Credentials.** The Biscuit token never leaves the harness. The gateway obtains an
   audience-bound upstream token per user and server (RFC 8707) and stores it keyed by issuer, as
   the spec requires. Sending the Biscuit token or the user's harness token upstream would be the
   forbidden passthrough.
5. **Exposing harness tools as an MCP server.** If FilesApi tool bundles should reach external MCP
   clients, a stateless `createMcpHandler`-style endpoint whose server factory registers only the
   tools the caller's capability allows matches both the spec and Cloudflare's pattern.

## Findings: definition formats

### Agent Skills (`SKILL.md`)

From https://agentskills.io/specification and
https://agentskills.io/client-implementation/adding-skills-support:

- A skill is a directory with `SKILL.md` (YAML frontmatter + Markdown body). The optional
  directories are `scripts/`, `references/` and `assets/`. File references are relative to the
  skill root, kept "one level deep".
- Frontmatter:
  - `name` (required): ≤64 characters, lowercase letters, digits and hyphens, no leading, trailing
    or double hyphens, and it "Must match the parent directory name".
  - `description` (required): ≤1024 characters, what the skill does and when to use it.
  - `license`.
  - `compatibility`: ≤500 characters.
  - `metadata`: a string→string map.
  - `allowed-tools`: a space-separated list of "pre-approved" tools, "Experimental. Support for
    this field may vary".
- Progressive disclosure: (1) metadata, about 100 tokens per skill, at startup; (2) the body, under
  5000 tokens recommended, on activation; (3) resources, as needed.
- Client guide:
  - Scan project and user scopes, including `.agents/skills/`, "a widely-adopted convention for
    cross-client skill sharing". Some clients also scan `.claude/skills/`.
  - Validate leniently: a name that does not match its directory gets a warning but still loads.
  - Activate either by a file read or by a dedicated `activate_skill` tool.
  - Gate project-level skills on trust, since an untrusted repository can "silently inject
    instructions".
- Claude Code follows the standard and extends it with `when_to_use`, `argument-hint`,
  `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`,
  `effort`, `context: fork`, `agent`, `background`, `hooks`, `paths` and `shell`.
  - Unknown fields are ignored in Claude Code.
  - claude.ai uploads, the Skills API and `package_skill.py` accept only the six spec fields:
    "If you include any field the spec doesn't allow, packaging or upload fails with a hard error"
    (https://code.claude.com/docs/en/skills).
  - Skill locations: `~/.claude/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, nested
    `<subdir>/.claude/skills/`.
- Flue:
  - It "validates every `SKILL.md` against the Agent Skills specification". `allowed-tools` is
    "accepted, not enforced … It does not restrict what the skill can call", and unknown fields are
    ignored.
  - Skills come from static imports (`import x from './skills/x/SKILL.md'; useSkill(x)`), from
    `defineSkill({ name, description, instructions, files })`, or by discovery from
    `<cwd>/.agents/skills/`.
  - Activation goes through an `activate_skill` tool. Packaged resources are served read-only at
    virtual paths through `read_skill_resource`, so "an agent can never accidentally edit its own
    skill content" (`@flue/runtime` 2.3.0 `docs/guide/skills.md`).
- DeepAgents:
  - "Deep agent skills follow the Agent Skills specification". Skills load from backend paths
    (`StateBackend`, `StoreBackend`, `FilesystemBackend`).
  - Its own extension, `metadata.include_tools`, attaches tools that appear only after the skill
    is read (https://docs.langchain.com/oss/javascript/deepagents/skills).
- OpenAI Agents SDK: the `SandboxAgent` `skills()` capability provides "skill discovery and
  materialization in the sandbox", sourced locally or from git. It prefers this "over mounting
  `.agents` or `.agents/skills` manually for sandbox-local `SKILL.md` skills"
  (https://openai.github.io/openai-agents-js/guides/sandbox-agents/concepts/).

### AGENTS.md

- "Just standard Markdown"; there are no required fields. "The closest AGENTS.md to the edited file
  wins; explicit user chat prompts override everything." Nested files serve monorepos. It is
  stewarded by the Agentic AI Foundation under the Linux Foundation (https://agents.md/).
- Claude Code reads `AGENTS.md` when there is no `CLAUDE.md` in the working directory or above it,
  or imports it from `CLAUDE.md` (https://code.claude.com/docs/en/memory).
- Flue composes `<cwd>/AGENTS.md` into the system prompt when a sandbox is attached
  (`@flue/runtime` `docs/guide/sandboxes.md`). DeepAgents loads it through `memory:
  ["./AGENTS.md"]` (https://docs.langchain.com/oss/javascript/deepagents/customization).
- AGENTS.md carries instructions only, not an agent definition **(inference)**: it has no name,
  tools or model.

### Claude Code subagents (`.claude/agents/*.md`)

From https://code.claude.com/docs/en/sub-agents:

- A Markdown file whose body is the system prompt. Frontmatter fields (camelCase): `name`
  (required, ≤256 characters, no `:`), `description` (required, "When Claude should delegate"),
  `tools`, `disallowedTools`, `model` (alias, full ID or `inherit`), `permissionMode`, `maxTurns`,
  `skills` (preloaded in full), `mcpServers` (names or inline configs), `hooks`, `memory`,
  `background`, `effort`, `isolation`, `color`, `initialPrompt` and others. Unknown fields are
  ignored.
- Scopes: managed settings, then `--agents`, then `.claude/agents/` (walked up to the repository
  root and scanned recursively), then `~/.claude/agents/`, then plugin `agents/`. Identity comes
  "only from the `name` frontmatter field", not the file path.
- MCP config shape (`.mcp.json` and inline `mcpServers`): `{ "<name>": { "type":
  "http"|"streamable-http"|"sse"|"ws"|"stdio", "url", "headers", "command", "args", "env" } }`. An
  entry "that has a `url` but no `type` is a configuration error", because no `type` means stdio
  (https://code.claude.com/docs/en/mcp).

### Flue agents

- Agents are TypeScript functions in `'use agent'` modules. `useModel()`, `useTool()`,
  `useSkill()`, `useMcpConnection()` and `useSubagent()` compose capabilities, and the return value
  is the instructions.
- Subagents are `{ name, description, agent, model?, thinkingLevel? }`, via `useSubagent` or
  `defineSubagent`. Delegation goes through a `task` tool and an "Available Agents" catalog; the
  child gets a fresh context and inherits the sandbox, `AGENTS.md` and workspace skills, but not
  the parent's tools or skills. Depth is capped at four (`@flue/runtime` `docs/guide/subagents.md`).
- MCP connections: `{ name, url, transport?, auth?, headers?, tools?, optional?, timeoutMs? }`.
  "On Cloudflare, use `useMcpConnection()`", because Workers forbid network I/O at global scope
  (`docs/reference/agent-api.md`).
- The docs show no file-based agent definition. Only skills and `AGENTS.md` are discovered from the
  workspace.

### OpenAI Agents SDK

- `new Agent({ name, instructions, prompt?, handoffDescription?, handoffs?, model?,
  modelSettings?, tools?, mcpServers?, mcpConfig?, inputGuardrails?, outputGuardrails?,
  outputType?, toolUseBehavior?, … })`. Only `name` and `instructions` are required. These are code
  objects with no file format (https://openai.github.io/openai-agents-js/guides/agents/).
- MCP server types: hosted MCP (the Responses API calls the server), `MCPServerStreamableHttp`,
  `MCPServerStdio` and legacy `MCPServerSSE`. Tool filters and per-tool approval are as in the
  table above (https://openai.github.io/openai-agents-js/guides/mcp/).

### DeepAgents subagents

- `SubAgent`: `name` and `description` (required), `systemPrompt` (required for the default
  `mode: "isolated"`), `mode: "isolated" | "fork"`, `tools` (replaces the inherited tools when
  set), `model` (`'provider:model'` string or model object), `middleware`, `interruptOn`
  (per-tool human-in-the-loop), `skills` (source paths, not inherited), `responseFormat` and
  `permissions` (filesystem rules, replacing the parent's).
- `CompiledSubAgent` wraps a LangGraph `runnable` instead.
- Delegation goes through a `task` tool (https://docs.langchain.com/oss/javascript/deepagents/subagents).

### Field comparison

| Concept | Agent Skills | Claude Code subagent | Flue subagent / agent | OpenAI `Agent` | DeepAgents `SubAgent` |
|---|---|---|---|---|---|
| Identity | `name` (= dir name) | `name` | `name` | `name` | `name` |
| When to use | `description` | `description` | `description` | `handoffDescription` | `description` |
| Instructions | Markdown body | Markdown body | return value of `agent` fn | `instructions` | `systemPrompt` |
| Tools allowed | `allowed-tools` (pre-approval, experimental) | `tools`, `disallowedTools` | `useTool` / `useMcpConnection` in fn | `tools`, `mcpServers` + `toolFilter` | `tools` |
| Model | — (Claude Code: `model`) | `model` | `model`, `thinkingLevel` | `model`, `modelSettings` | `model` |
| Skills | — | `skills` | `useSkill` in fn | sandbox `skills()` | `skills` (paths) |
| MCP | — | `mcpServers` | `useMcpConnection` | `mcpServers` | via `@langchain/mcp-adapters` |
| Resources | `scripts/`, `references/`, `assets/` | — | skill `files` | sandbox manifest | backend files |
| Approval / policy | — | `permissionMode`, `hooks` | pattern (pending + signal) | `requireApproval`, guardrails | `interruptOn`, `permissions` |
| File format | yes (`SKILL.md`) | yes (`*.md` + YAML) | no (code) | no (code) | no (code) |

The five agree on a core of name + description + instructions + tools + model (+ skills).
Everything else is specific to one host **(inference)**.

## Recommendation (inference)

To keep definitions in mounted folders portable, the harness's definitions layer should parse
these files into one internal record, `{ name, description, instructions, tools[],
mcpServers[], model?, skills[], resources }`, with code-defined adapters for Flue, OpenAI and
DeepAgents on the other side:

1. **Skills: the Agent Skills spec, unchanged.** Discover `<mount>/.agents/skills/*/SKILL.md`, and
   `<mount>/.claude/skills/*/SKILL.md` for compatibility. Parse leniently (warn on name mismatch,
   ignore unknown fields). Serve resources read-only through the FilesApi, as Flue does with
   virtual paths. Write only the six spec fields when emitting, since claude.ai rejects any other
   field. Put harness extensions under `metadata`, as DeepAgents does with `include_tools`.
2. **Instructions: `AGENTS.md`,** nearest file wins, with `CLAUDE.md` read the same way.
3. **Agents: Claude Code's subagent Markdown** (`.claude/agents/*.md`, and the same shape under
   `.agents/agents/` if a neutral path is wanted; no source defines that path). Honour `name`,
   `description`, body, `tools`, `disallowedTools`, `model`, `skills` and `mcpServers`, and ignore
   the rest. This is the only agent file format in wide use, and its fields map onto every
   code-defined SDK above.
4. **MCP: a `.mcp.json`-style `mcpServers` map.** Accept `type: "http" | "streamable-http"` (and
   `"sse"` for legacy). Report `stdio` entries as unavailable on isolate runtimes instead of failing
   the agent. Files hold no secrets; an `auth` reference resolves in the capability environment.
5. **Permissions: never grant from a definition.** `allowed-tools`, `tools` and `mcpServers` in a
   file are *requests*. The effective tool set is their intersection with what the Biscuit token
   allows for (user, project role, agent, mode). MCP tools are named `mcp__<server>__<tool>`, so
   one name works in definitions, capabilities and logs. Project-level definitions from a mounted
   folder are untrusted input, as the Agent Skills client guide warns.

## Open questions

- Which MCP client library to pin. The sandbox's `@modelcontextprotocol/client` 2.3.1 lists
  2025-11-25 as latest. Does 2.4.0, or Cloudflare's client, fully speak stateless 2026-07-28
  (MRTR, `subscriptions/listen`)? Check before relying on it.
- Browser cellb: do the target remote MCP servers send CORS headers, or must every call go through
  a server-side gateway?
- Should the MCP gateway be a Durable Object per user (holding OAuth tokens in DO SQLite, like the
  Agents SDK) or per project?
- Whether to accept `.agents/agents/` as a neutral agent folder before any spec defines one.

## Sources

- MCP specification 2026-07-28 (read from `modelcontextprotocol/modelcontextprotocol`,
  `docs/specification/2026-07-28/`):
  https://modelcontextprotocol.io/specification/2026-07-28/changelog,
  https://modelcontextprotocol.io/specification/2026-07-28/deprecated,
  https://modelcontextprotocol.io/specification/2026-07-28/basic/transports,
  https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http,
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization,
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations,
  https://modelcontextprotocol.io/specification/2026-07-28/server/tools,
  https://modelcontextprotocol.io/specification/2026-07-28/server/discover
- MCP TypeScript SDK in the sandbox: `@modelcontextprotocol/core` and `@modelcontextprotocol/client`
  2.3.1 (`statewalker-sandbox/node_modules/.pnpm/`); npm registry for current versions
- Cloudflare: https://developers.cloudflare.com/agents/model-context-protocol/,
  https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/,
  https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/,
  https://developers.cloudflare.com/agents/model-context-protocol/apis/agent-api/,
  https://developers.cloudflare.com/agents/model-context-protocol/apis/client-api/,
  https://developers.cloudflare.com/agents/runtime/capabilities/mcp-client-manager/,
  https://developers.cloudflare.com/agents/tools/codemode/how-it-works/,
  https://developers.cloudflare.com/agents/tools/codemode/mcp/,
  https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/,
  https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Agent Skills: https://agentskills.io/specification,
  https://agentskills.io/client-implementation/adding-skills-support
- AGENTS.md: https://agents.md/
- Claude Code: https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/sub-agents,
  https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/mcp
- Flue: `@flue/runtime` 2.3.0 in `statewalker-sandbox/node_modules/.pnpm/` (`README.md`,
  `docs/guide/{skills,subagents,mcp,tools,sandboxes}.md`,
  `docs/reference/{agent-api,agent-behavior}.md`, `dist/mcp-*.mjs`); https://flueframework.com/
- OpenAI Agents SDK (JS): https://openai.github.io/openai-agents-js/guides/agents/,
  https://openai.github.io/openai-agents-js/guides/mcp/,
  https://openai.github.io/openai-agents-js/guides/sandbox-agents/concepts/
- DeepAgents (JS): https://docs.langchain.com/oss/javascript/deepagents/subagents,
  https://docs.langchain.com/oss/javascript/deepagents/skills,
  https://docs.langchain.com/oss/javascript/deepagents/customization
- Related: `docs/research/flue-capfs-do-inventory.md` (`statewalker/statewalker-root#74`)
