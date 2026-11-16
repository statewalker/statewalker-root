# Which session and thread APIs should the harness align with?

Research for `statewalker/statewalker-root#71`. Sources read on 2026-11-15. Statements marked
**(inference)** are this note's own reasoning, not a source's claim. `platform.openai.com` did not
resolve from the research session; OpenAI's docs were read at their current home,
`developers.openai.com`, through its Markdown pages (`<page>.md`).

## Question

Which existing APIs should the harness's session API align with, so that it is compatible with
OpenAI clients and also lets clients manage sessions and threads, runs, streaming, cancellation
and human-in-the-loop approvals ("ask" mode)? For each surveyed API: how it models sessions or
threads, runs, messages and tool calls; streaming and resumption; approvals; auth. Then: what one
harness API could support at once, and the trade-offs.

## Short answer

- **Everyone converged on the same three nouns:** a durable *thread* (OpenAI Conversation,
  Agent Protocol thread, A2A `contextId`, Flue conversation, Cloudflare agent instance), a *run*
  per turn with a status machine (OpenAI Response in background mode, Agent Protocol run, A2A
  Task, Flue submission, Cloudflare Think submission), and an ordered list of typed *items or
  parts* (messages, tool calls, tool outputs, reasoning). OpenAI's own Assistants API (threads
  and runs) was **sunset on 2026-08-26**; its replacement maps Threads to Conversations, Runs to
  Responses and Run steps to Items.
- **Approval is the same pattern everywhere:** the run stops in a waiting state with a pending
  approval item that has an id (`mcp_approval_request`, AI SDK `tool-approval-request`, LangGraph
  `__interrupt__`, A2A `TASK_STATE_INPUT_REQUIRED`, MCP `input_required` result); the human's
  decision comes back as a **new input on the same thread** that references that id, and starts
  a continuation. Nobody holds an HTTP request open while a human decides.
- **Resumable streaming means a durable, sequenced event log per run or thread**, read over SSE
  from a cursor: OpenAI `starting_after=<sequence_number>`, Agent Protocol and LangGraph `since` /
  `Last-Event-ID`, Cloudflare `Streams` (`Last-Event-ID` or `?from=`), Flue offsets (Durable
  Streams format). Disconnect does not cancel; cancel is an explicit endpoint.
- **Auth is left to the host** in Cloudflare Agents, Flue and the self-hosted Agent Protocol;
  OpenAI uses a bearer API key; A2A declares schemes in its Agent Card; MCP specifies OAuth.
  Cloudflare and Flue both advise **server-issued thread ids** checked against the caller.
- **Recommendation (inference):** build one native layer, thread/run/items with a durable event
  log, shaped after the Agent Protocol's resource names and Flue's offsets, plus direct DO RPC
  with the same methods; then add projections: the **OpenAI Responses + Conversations API** as
  the OpenAI-compatible layer (approvals as `mcp_approval_request` items), **Chat Completions**
  as a stateless, approval-less convenience, and the **AI SDK UI message stream** as the UI
  stream. Do not implement Assistants. Keep A2A and MCP as later adapters.

## Findings

### OpenAI

**Status of the APIs.**
- "The Assistants API was officially sunset on August 26, 2026, and is no longer available."
  The migration table maps `Assistants` → `Prompts` (dashboard-only, versioned), `Threads` →
  `Conversations` ("streams of items instead of just messages"), `Runs` → `Responses` ("tool call
  loops are explicitly managed"), `Run steps` → `Items`
  (https://developers.openai.com/api/docs/assistants/migration.md).
- "While Chat Completions remains supported, Responses is recommended for all new projects." In
  Chat Completions "conversation state must be managed manually"; Responses supports the
  Conversations API or `previous_response_id`. Starting with GPT-5.4, Chat Completions does not
  support tool calling with `reasoning_effort` other than `none`
  (https://developers.openai.com/api/docs/guides/migrate-to-responses.md).

**Sessions and threads.**
- Two server-side state mechanisms: a **Conversation** object, "a long-running object with its
  own durable identifier" that stores items ("messages, tool calls, tool outputs, and other
  data") and is passed as `conversation` on each response; or **`previous_response_id`**, which
  chains responses into a threaded conversation. Response objects are kept 30 days by default
  (`store: false` disables); conversation items have no 30-day TTL
  (https://developers.openai.com/api/docs/guides/conversation-state.md).
- Conversations endpoints: create, retrieve, update, delete (`/v1/conversations/{id}`) and items
  list (https://developers.openai.com/api/reference/resources/conversations.md).

**Runs.** A Response is the unit of execution. With `background: true` it starts asynchronously,
is polled with `GET /v1/responses/{id}` while `queued` or `in_progress`, and is cancelled with
`POST /v1/responses/{id}/cancel` ("Cancelling twice is idempotent"). "To cancel a synchronous
response, terminate the connection." Background responses are kept only briefly unless
`store=true` (https://developers.openai.com/api/docs/guides/background.md).

**Messages and tool calls.** Input and output are arrays of typed Items: `message`,
`function_call` (with `call_id`, `name`, JSON `arguments`), `function_call_output` referencing the
`call_id`; `tool_choice`, `parallel_tool_calls` and `strict` control calling
(https://developers.openai.com/api/docs/guides/function-calling.md).

**Streaming and resumption.**
- `stream: true` gives SSE "semantic events", each typed: `response.created`, `response.queued`,
  `response.in_progress`, `response.output_item.added/done`, `response.output_text.delta`,
  `response.function_call_arguments.delta/done`, `response.mcp_call.*`, `response.completed`,
  `response.failed`, `response.incomplete`, and more
  (https://developers.openai.com/api/docs/guides/streaming-responses.md,
  https://developers.openai.com/api/reference/resources/responses/streaming-events.md).
- Resumption needs `background` and `stream` together: keep the `sequence_number` of each event
  as a cursor and resume with `GET /v1/responses/{id}?stream=true&starting_after=42`
  (https://developers.openai.com/api/docs/guides/background.md).
- A WebSocket mode on `/v1/responses` sends `response.create` events, continues with
  `previous_response_id` and only new input items, and multiplexes lanes with `stream_id`
  (https://developers.openai.com/api/docs/guides/websocket-mode.md). Mid-turn steering
  (`response.steer`, GPT-6 over WebSocket only) queues new user input into a running response;
  an interrupted response ends `incomplete` with reason `"steered"`
  (https://developers.openai.com/api/docs/guides/steering.md).

**Approvals.**
- The only API-native approval is for remote MCP tools: with `require_approval` (default: ask),
  the response output contains an `mcp_approval_request` item; the client answers by creating a
  **new Response** with an `mcp_approval_response` item (`approve`, `approval_request_id`),
  chained with `previous_response_id` (or by replaying outputs). "Each approval applies to one
  tool call." `require_approval` can be `"never"` or list tools to skip
  (https://developers.openai.com/api/docs/guides/tools-connectors-mcp.md).
- For function tools, approval is the application's job; the OpenAI Agents SDK does it client
  side: `needsApproval` on a tool makes the run pause and return `interruptions`; the app calls
  `state.approve()` / `state.reject()` and resumes from the same `RunState`
  (https://openai.github.io/openai-agents-js/guides/human-in-the-loop/).

**Auth.** `Authorization: Bearer $OPENAI_API_KEY` on every request (examples throughout the pages
above).

**Open Responses.** A vendor-neutral specification "based on the OpenAI Responses API" (items,
semantic events, state machines), with `POST /v1/responses` and `POST /v1/responses/compact`, an
OpenAPI schema and a compliance test suite (https://www.openresponses.org/llms.txt). It covers
the model call, not conversations or runs **(inference: from its endpoint list)**.

### Vercel AI SDK (`ai` 7.0.173)

**Sessions.** A chat has an `id` the client sends with each request; the server loads and stores
`UIMessage[]` itself (the SDK provides no store). Once persisted, the client can send "only the
last message" (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence.md). There is no run
resource: one POST is one turn.

**Messages and stream protocol.** The UI message stream is SSE with header
`x-vercel-ai-ui-message-stream: v1`, JSON parts and a final `data: [DONE]`. Part types: `start`,
`start-step`, `finish-step`, `finish`, `abort`, `error`, `text-start/delta/end`,
`reasoning-start/delta/end`, `source-url`, `source-document`, `file`, `custom`, `data-*`,
`tool-input-start/delta/available`, `tool-output-available`, `tool-output-denied`,
`tool-approval-request`, `tool-approval-response`. Text and reasoning use start/delta/end with
ids (https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol.md). Transports: `DefaultChatTransport`
(HTTP) and `WebSocketChatTransport`, which multiplexes turns by `requestId` and forwards aborts
(https://ai-sdk.dev/docs/ai-sdk-ui/transport.md).

**Resumable streams.** `useChat({ resume: true })` issues `GET /api/chat/[id]/stream` on mount;
the server returns 204 when no stream is active, or replays the stream it buffered (Redis via the
`resumable-stream` package, tracked by an `activeStreamId` on the chat). Closing a tab or calling
`stop()` "only closes the current HTTP connection and should not cancel the underlying
generation"; a dedicated stop endpoint cancels
(https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams.md).

**Approvals.** `toolApproval` on `streamText` (per tool: `'not-applicable' | 'approved' |
'denied' | 'user-approval'`, or a function; `needsApproval` on tools is deprecated). On manual
approval the call "don't pause execution. Instead, they complete and return
`tool-approval-request` parts", so approval "requires two calls to the model"
(https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling.md). In the UI the part's state is
`approval-requested`; the client calls `addToolApprovalResponse({ id, approved })`
(https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage.md).

**Auth.** Not specified; the app's route handles it (the WebSocket example passes a short-lived
token as a parameter) (https://ai-sdk.dev/docs/ai-sdk-ui/transport.md).

### Cloudflare Agents SDK (`agents` 0.33.0, `@cloudflare/ai-chat` 0.12.2)

**Agents as DOs.** "Each agent is a named Durable Object." `routeAgentRequest()` maps
`/agents/:binding/:name` to `idFromName(name)`; the object's capabilities, then `onRequest()`,
handle the request (https://developers.cloudflare.com/agents/runtime/routing/index.md). The
runtime is now a DO "with the Lifecycle installed" plus capabilities added with
`lifecycle.use()`: WebSockets, State, Scheduler, MCP client, and experimental Sessions and
Streams (https://developers.cloudflare.com/agents/llms.txt).

**Sessions and messages.** `Sessions` stores conversation history in the DO's SQLite; "messages
form a tree, so a conversation can branch"; a `SessionMessage` has `id`, `role`, `parts`, the same
shape as the AI SDK's `UIMessage`; appends are idempotent by id
(https://developers.cloudflare.com/agents/runtime/capabilities/sessions/index.md).

**AIChatAgent.** Server class on the AI SDK; messages persisted to SQLite; the client sends over
WebSocket; `onChatMessage` returns a stream; chunks go back over the WebSocket and the final
message is broadcast to all connections. `messageConcurrency` handles overlapping sends
(`latest`, `merge`, `drop`, plus queueing). Cancel: the client sends
`CF_AGENT_CHAT_REQUEST_CANCEL`, propagated to `abortSignal`. Resumable streaming: chunks are
buffered in SQLite, the server keeps streaming after a disconnect, and a reconnecting client gets
the buffered chunks then live ones. Durable recovery wraps each turn in a fiber that survives
eviction. A turn waiting on a client tool or an `approval-requested` part "is waiting on the
human, not stuck": recovery parks it, and the approval resumes it. Tool patterns: server, client
(no `execute`), and approval (`needsApproval`, answered by `addToolApprovalResponse`)
(https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/index.md).

**Runs.** Think's `submitMessages()` durably accepts a turn and returns before inference, with
statuses `pending`, `running`, `completed`, `aborted`, `skipped`, `error`, an `idempotencyKey`,
and `cancelSubmission(id)` that works across Worker and DO RPC boundaries; submissions run first
in, first out
(https://developers.cloudflare.com/agents/harnesses/think/programmatic-submissions/index.md).

**Streaming.** `Streams` stores each stream as an ordered chunk log in SQLite; `sseResponse()`
replays "after `Last-Event-ID`, or at the sequence number in `?from=`", sends `up-to-date`, then
follows live; each chunk's sequence number is its SSE `id`
(https://developers.cloudflare.com/agents/runtime/capabilities/streams/index.md).

**State sync and RPC.** `State` holds one validated JSON value synced to `useAgent` clients over
WebSockets (https://developers.cloudflare.com/agents/runtime/capabilities/state/index.md). The
`WebSockets` capability speaks the Agents protocol, hibernates idle connections, and serves
`callables`, an `RpcTarget` whose methods clients call, for example a Stop button that cancels a
run (https://developers.cloudflare.com/agents/runtime/capabilities/websockets/index.md).

**Other HITL.** Workflow approvals (`waitForApproval()`, can wait for months), MCP elicitation,
and durable Code Mode approvals (`requiresApproval: true` on a connector method)
(https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/index.md).

**Auth.** "Anyone who knows an agent's URL can send it requests." Check in the Worker with
`onBeforeConnect` / `onBeforeRequest`; browsers cannot set `Authorization` on a WebSocket upgrade,
so read a cookie or query token; or "pick the name on the server" from the session; readonly
connections limit what a connection may do
(https://developers.cloudflare.com/agents/runtime/routing/authentication/index.md).

### LangGraph Platform (LangSmith Agent Server), Agent Protocol, DeepAgents

**Agent Protocol** (repository `langchain-ai/agent-protocol`, commit `820bd30`, 2026-11-05):
"framework-agnostic APIs that are needed to serve LLM agents in production"; LangGraph Platform
"implements a superset". Three concepts: Runs, Threads, Store
(`README.md` in https://github.com/langchain-ai/agent-protocol).
- Threads: `POST /threads`, `POST /threads/search`, `GET|PATCH|DELETE /threads/{id}`,
  `GET /threads/{id}/history` (state revisions), `POST /threads/{id}/copy`; one active run per
  thread; thread status `idle | busy | interrupted | error`.
- Runs: `POST /runs` (background), `/runs/wait`, `/runs/stream` (stateless if no `thread_id`),
  `GET /runs/{id}`, `/runs/{id}/wait`, `/runs/{id}/stream` (join), `POST /runs/{id}/cancel`,
  `DELETE /runs/{id}`; `RunCreate` has `thread_id`, `agent_id`, `input`, `messages`, `config`,
  `webhook`, `on_completion`, `on_disconnect` (`cancel` default, or `continue`),
  `if_not_exists`; run status `pending | error | success | timeout | interrupted` (`openapi.json`).
- Agents (introspection): `/agents/search`, `/agents/{id}`, `/agents/{id}/schemas`.
- Messages: "a subset of the message formats supported by major LLM providers".
- **Streaming protocol** (`streaming/protocol.cddl`, the source of truth): thread-centric; SSE via
  `POST /threads/{id}/stream` with `channels`, `namespaces`, `depth`, `since` (replay), plus
  `POST /threads/{id}/commands`; or a WebSocket at `GET /threads/{id}/stream` with in-band
  commands. Channels: `values`, `updates`, `messages`, `tools`, `lifecycle`, `input`,
  `checkpoints`, `tasks`, `custom`. `run.start` "is the single entry point for all input": no
  run → new run; interrupted → resume with the input; active → inject. HITL commands:
  `input.requested` (with `interruptId`), `input.respond` (single or batch), `input.answered`,
  `input.inject`.
- No security scheme in the OpenAPI document; the README's journeys run "no auth required".

**Agent Server specifics** (https://docs.langchain.com):
- A run "combines an assistant with a thread"; assistants are configurations of a graph
  (https://docs.langchain.com/langsmith/runs.md).
- Double texting: `enqueue` (default), `reject`, `interrupt`, `rollback`
  (https://docs.langchain.com/langsmith/double-texting.md). Cancel with `interrupt` (keeps the
  run, status `interrupted`) or `rollback`
  (https://docs.langchain.com/langsmith/cancel-run.md).
- HITL: the graph calls `interrupt(...)`; `runs.wait` returns `__interrupt__`; resume with
  `POST /threads/{id}/runs/wait` and `{"command": {"resume": ...}}`
  (https://docs.langchain.com/langsmith/add-human-in-the-loop.md).
- Streaming: `stream_mode` values; `join_stream` on a run is not buffered; thread streams resume
  with `Last-Event-ID` (`"-"` replays from the start)
  (https://docs.langchain.com/langsmith/streaming.md).
- Auth: LangSmith API key in `x-api-key` by default; custom `@auth.authenticate` and per-resource
  `@auth.on` handlers; self-hosted has no default auth
  (https://docs.langchain.com/langsmith/auth.md).

**DeepAgents** (`deepagents` 1.16.5): `interrupt_on` maps tool names to configs;
`HumanInTheLoopMiddleware` pauses; decisions `approve`, `edit` (change arguments), `reject`,
`respond` (synthetic tool result); resume with `Command(resume=...)`; `PatchToolCallsMiddleware`
repairs history after a cancelled tool call
(https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop.md). Async subagents run
"on any server that implements the Agent Protocol"
(https://docs.langchain.com/oss/javascript/deepagents/async-subagents.md).

### Flue (`@flue/runtime` and `@flue/sdk` 2.3.0, repository `withastro/flue` at `deee93b`)

Flue has its own HTTP surface: `createAgentRouter(agent)` serves, per caller-chosen conversation
id, the same protocol on Node and Cloudflare
(`apps/docs/src/content/docs/reference/streaming-protocol.md`, reviewed 2026-07-21):
- `POST /:id` delivers one message (`{kind:'user', body, attachments?}` or `{kind:'signal', type,
  body, ...}`) and answers **202** once durably admitted, with `streamUrl`, `offset`,
  `submissionId`, `uid`. "There is no synchronous 'wait for the reply' mode."
- `GET /:id` (`view=history`) returns a snapshot: `messages` (one assistant message per response,
  parts `text`, `reasoning`, `data-*`, `file`, `dynamic-tool` with states `input-available`,
  `output-available`, `output-error`) and `settlements` (`completed | failed | aborted` per
  submission).
- `GET /:id?view=updates&offset=...` returns chunk deltas; `live=long-poll` or `live=sse`; offsets
  use the Durable Streams format, `-1` replays all; headers `Stream-Next-Offset`,
  `Stream-Up-To-Date`; SSE is at-least-once, deduped by `position`. Chunks: `conversation-reset`,
  `message-appended`, `message-started`, `message-delta`, `tool-input`, `tool-output`,
  `tool-output-error`, `message-completed`, `submission-settled`, `data-part`.
- `POST /:id/abort` aborts the running submission and the queue behind it, asynchronously.
- Child conversations (subagents) are not exposed on this surface.
- No approval primitive appears in the wire protocol, and Flue has "no built-in approval API",
  but its docs give a supported **approval-gate pattern** (`docs/guide/tools.md`, "Approval
  gates"): the tool's `run` stores the arguments in persistent state keyed by `toolCallId` and
  returns a `pending_approval` result with `terminate: true`, so the response ends and nothing
  waits; a trusted route delivers the decision as a signal; a `useAgentStart` callback runs the
  stored call on approval (also referenced from `docs/guide/mcp.md` and
  `reference/agent-api.md`). Tools also carry MCP-style `annotations` such as `destructiveHint`
  that "trusted application code can inspect" (`reference/agent-api.md`).
- Auth: "A mounted agent has no built-in authentication"; the docs advise server-issued ids
  derived from the principal (`guide/routing.md`). On Cloudflare, each agent is one DO class
  built on the Agents SDK base class, with a SQLite-backed submission queue
  (`ecosystem/deploy/cloudflare.md`).

### MCP (specification 2026-07-28) and A2A (v1.0.0)

- **MCP** became stateless in 2026-07-28: protocol sessions and `Mcp-Session-Id` are removed;
  "servers that need cross-call state use explicit, server-minted handles passed as ordinary tool
  arguments"; SSE resumability (`Last-Event-ID`) is removed; server-initiated requests
  (elicitation, sampling) are replaced by Multi Round-Trip Requests, where a result with
  `resultType: "input_required"` carries `inputRequests` and the client retries with
  `inputResponses`; tasks moved into an extension (`io.modelcontextprotocol/tasks`) with
  `tasks/get` polling and `tasks/update`
  (https://modelcontextprotocol.io/specification/2026-07-28/changelog.md).
- **A2A**: a `contextId` "logically groups multiple related Task and Message objects" as one
  conversational session; a `taskId` is server-generated per unit of work; task states include
  `SUBMITTED`, `WORKING`, `INPUT_REQUIRED`, `AUTH_REQUIRED`, `COMPLETED`, `FAILED`, `CANCELED`,
  `REJECTED`; for input-required "the client continues the interaction by sending a new message
  with the same taskId and contextId". REST binding: `POST /message:send`, `POST
  /message:stream` (SSE), `GET /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}:cancel`, `POST
  /tasks/{id}:subscribe` (first event is the current Task); auth per `AgentCard.securitySchemes`
  (https://a2a-protocol.org/latest/specification/).

### The concepts side by side

| Concept | OpenAI Responses | AI SDK UI | Cloudflare | Agent Protocol | Flue | A2A |
|---|---|---|---|---|---|---|
| Thread | Conversation / response chain | chat `id` (app stores) | agent DO name; `Sessions` session | thread | conversation `:id` | `contextId` |
| Run | Response (`background`) | one POST | turn; Think submission | run | submission | Task |
| Content | Items | `UIMessage` parts | `UIMessage` parts | Message + state values | messages + parts | Message, Part, Artifact |
| Resume stream | `starting_after` | GET `/stream` replay | `Last-Event-ID`, `?from=` | `since`, `Last-Event-ID` | `offset` | `:subscribe` |
| Cancel | `POST .../cancel` | app stop endpoint | cancel message, `cancelSubmission` | `POST /runs/{id}/cancel` | `POST /:id/abort` | `:cancel` |
| Approval | `mcp_approval_request` → new Response | `tool-approval-request` → next call | `approval-requested` part | `input.requested` → `input.respond` | pattern: pending result + signal | `INPUT_REQUIRED` → new message |
| Concurrency | caller's job | caller's job | `messageConcurrency`, FIFO | `enqueue`/`reject`/`interrupt`/`rollback` | FIFO queue | per task |
| Auth | bearer API key | app | app (Worker hooks) | app | app | Agent Card schemes |

### What one harness API could support at once (inference)

All of this section is **(inference)** built on the findings above.

**One native model, several projections.** The thread/run/item shape is common enough that one
internal model can serve every surface:
- *Thread* = one Agent DO conversation, server-issued id, owned by a principal (Biscuit).
- *Run* = one submission: `queued → in_progress → (requires_action) → completed | failed |
  cancelled`, with `requires_action` carrying pending approval items.
- *Items* = messages, tool calls, tool outputs, reasoning, approval requests and responses, in
  the OpenAI Items / AI SDK parts vocabulary (Flue's parts already follow the AI SDK names).
- *Event log* = per thread, durable, sequenced (Flue's Durable Streams offsets, or Cloudflare's
  `Streams` chunk log); every stream is a cursor read of it, so resumption and multi-client
  watching come free, and disconnect never cancels.

**Layer 1, native REST (Agent-Protocol-shaped).** `POST /threads`, `GET /threads/{id}`,
`POST /threads/{id}/runs` (202 + run id + offset, or `stream=true`), `GET /runs/{id}`,
`POST /runs/{id}/cancel`, `GET /threads/{id}/events?since=` (SSE, `Last-Event-ID`),
`POST /runs/{id}/approvals/{approvalId}` `{decision: approve|reject|edit|respond, ...}`. The
decision set follows DeepAgents; double-texting follows LangGraph with `enqueue` default (which
is Flue's FIFO). Matching Agent Protocol names gives DeepAgents async subagents a server to talk
to, but full conformance also asks for `values` state, checkpoints and the Store, which fit a
graph runtime better than Flue: claim a subset, not the protocol.

**Layer 1b, direct capability access.** The same operations as methods on a DO `RpcTarget`
(Cloudflare `callables` style), so in-process callers (cellb in the browser, other DOs) skip
HTTP. The REST layer is then a thin router onto these methods, and a Biscuit token narrows what
each stub may call.

**Layer 2, OpenAI-compatible.**
- `POST /v1/responses` with `conversation` (= thread) or `previous_response_id`; `background`,
  `stream`; `GET /v1/responses/{id}?stream=true&starting_after=`; `POST /v1/responses/{id}/cancel`;
  `/v1/conversations` and its items. One Response = one run.
- "Ask" mode maps onto the only OpenAI-native approval shape: emit `mcp_approval_request` items
  and accept `mcp_approval_response` in the next Response's input. Clients that already handle
  remote-MCP approvals then work unchanged. Cost: every gated harness tool must look like an MCP
  tool call (`server_label`, `name`, `arguments`) to those clients.
- `POST /v1/chat/completions`: stateless convenience; the client sends history; tools gated by
  "ask" cannot be expressed natively, so either return them as `tool_calls` for the client to
  answer (client-side tool pattern) or refuse "ask" mode on this endpoint.
- Do not implement Assistants (sunset); clients still on it have no server to talk to anyway.
- Trade-offs: OpenAI's model is per-turn Response ids with branching via
  `previous_response_id`; a linear thread must decide what a branch from an old response means
  (fork the thread, as Cloudflare's tree-shaped `Sessions` allows, or refuse). `store`, retention
  and hosted-tool event types (`web_search_call`, `code_interpreter_call`) have no harness
  equivalent and are left out. `model` is meaningless if the agent definition picks the model:
  treat it as the agent name, as many OpenAI-compatible gateways do.

**Layer 3, UI stream.** Serve the AI SDK UI message stream (`x-vercel-ai-ui-message-stream: v1`)
for `useChat` and Cloudflare's `useAgentChat`, including `tool-approval-request` and the
`GET .../stream` resume endpoint. Flue's chunks are close to these parts already, so this is a
projection of the same event log.

**Later adapters.** A2A (`contextId` = thread, Task = run, `INPUT_REQUIRED` = approval, and
`AUTH_REQUIRED` for a missing Biscuit right) for agent-to-agent calls; MCP's stateless
`input_required` round trip if the harness exposes agents as MCP tools.

**Auth across layers.** Bearer token (Biscuit) in `Authorization` for REST and OpenAI clients
(they already send `Bearer <key>`); cookie or query token for WebSocket upgrades; thread ids
issued by the server and checked against the token, as Cloudflare and Flue both advise.

**Main trade-off.** Aligning the native layer with the Agent Protocol buys a published spec and
DeepAgents interop but drags in graph concepts; aligning it with Flue's conversation protocol
fits the execution core but is one vendor's surface with no approvals and no run resource.
The layering above takes resource names from the Agent Protocol, the wire details (offsets,
202 admission, settlements) from Flue, and keeps OpenAI and AI SDK as projections, so no single
external API constrains the core.

## Addendum (2026-11-16): resource shapes, and how Flue and ai-agent.core store messages

Gathered while resolving "What is the session API?" (`statewalker/statewalker-root#83`). Statements
marked **(inference)** are this note's own reasoning.

### Endpoint shapes compared

Two more APIs: **Anthropic Managed Agents** (beta `managed-agents-2026-04-01`) and the **Google ADK
`api_server`**. Abbreviations: LG = LangSmith Agent Server, MA = Managed Agents, CF = Cloudflare.

| Operation | LG / Agent Protocol | OpenAI | CF Agents / Think | Flue 2.3.0 | Anthropic MA | Google ADK |
|---|---|---|---|---|---|---|
| Create session | `POST /threads {thread_id?, metadata, if_exists, ttl}` | `POST /v1/conversations` | implicit by name | implicit on first `POST /:id` (`uid`) | `POST /v1/sessions {agent, initial_events}` | `POST .../sessions` |
| List / delete | `POST /threads/search`, `DELETE`, `/threads/prune` | no list; `DELETE` | in-process only | none | list (paged), `archive`, `DELETE` (refused while running) | list, `DELETE` |
| User input while busy | `multitask_strategy: enqueue\|reject\|interrupt\|rollback` | `response.steer` (WebSocket); old response ends `incomplete`/`steered` | `messageConcurrency: queue\|latest\|merge\|drop\|debounce` | FIFO; `POST /:id/abort` drops the queue | `[user.interrupt, user.message]` in one batch | none |
| Start-turn reply | Run object, `/runs/stream`, `/runs/wait` | Response (`background`) | submission id | `202 {streamUrl, offset, submissionId}` + `Location`, `Stream-Next-Offset` | events queued, no turn id | events or SSE |
| Items | `/threads/{id}/state`, `/history` | `GET /v1/conversations/{id}/items?after&limit&order&include` | message list | `GET /:id?limit&before&from` | `GET /v1/sessions/{id}/events?types[]=` | inline |
| Stream resume | `Last-Event-ID` | `starting_after=<sequence_number>` | `Last-Event-ID`, `?from=` | `offset`, `live=sse\|long-poll` | live only (list, then dedupe) | none |
| Approval answer | new run with `{command:{resume}}` | `mcp_approval_response` item | tool-approval message | signal pattern | `user.tool_confirmation {tool_use_id, result: allow\|deny, deny_message}` | `/run` with `function_call_event_id` |
| Permission mode | `interrupt_before/after` per run | `require_approval` per request | none | none | `permission_policy: always_allow\|always_ask\|auto`, changeable while idle | none |
| Sub-agents | subgraph streams; DeepAgents async subagents are separate threads | none | `/agents/{cls}/{name}/sub/...` | not exposed | session threads: `/sessions/{id}/threads`, child approvals cross-posted to the primary stream | `author` field only |

Things the draft lacked, by API:
- metadata and search (OpenAI, LG);
- fork, rewind, edit and regenerate (LG `copy` and checkpoints, ADK `rewind`, CF regenerate);
- long-term memory (LG `/store`, MA memory stores);
- usage and budgets (MA `session.usage`, `budget_reached`);
- webhooks and scheduled turns (LG, CF, MA);
- trace context (Flue `traceparent`).

Sources:
- https://docs.langchain.com/langsmith/agent-server-openapi.json
- https://docs.langchain.com/langsmith/double-texting.md
- https://docs.langchain.com/oss/python/deepagents/async-subagents.md
- https://developers.openai.com/api/reference/resources/conversations.md
- https://developers.openai.com/api/docs/guides/steering.md
- https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/index.md
- https://raw.githubusercontent.com/withastro/flue/main/apps/docs/src/content/docs/reference/streaming-protocol.md
- https://platform.claude.com/docs/en/managed-agents/sessions.md
- https://platform.claude.com/docs/en/managed-agents/permission-policies.md
- https://platform.claude.com/docs/en/managed-agents/session-threads.md
- https://raw.githubusercontent.com/google/adk-docs/main/docs/runtime/api-server.md

### How Flue stores conversations and compacts them (`@flue/runtime` 2.3.0, built JS)

- **Storage.** Flue uses Durable Object SQLite only; a class must be in `new_sqlite_classes`. Each agent instance has one stream, `agents/<agent>/<instanceId>`.
  - `flue_conversation_streams`: the head offset and producer epoch/sequence, which make appends idempotent.
  - `flue_conversation_stream_batches`: one JSON array of records per append; data over 1 MB spills into chunk rows, and an append is capped at 12 MB.
  - `flue_conversation_fold_checkpoints`: a cache of the folded state, safe to discard.
  - `flue_agent_submissions`: the queue (`queued`, `running`, `joining`, `settled`, …), drained on an alarm.
- **Records, not messages.** The records are `user_message`, `assistant_text_delta`, `assistant_tool_call`, `tool_outcome`, `compaction`, `submission_settled` and others. They fold into entries with `id`/`parentId` and an active leaf, and appends stay linear.
- **Context per turn.** Flue walks from the leaf to the root. After a `compaction` entry, the context is that summary, the entries from its `firstKeptEntryId`, then everything after it. This is written into pi's `agentLoop.state.messages`.
- **Compaction is Flue's, not pi's.** pi-agent-core offers only a `prepareNextTurn` hook.
  - Flue triggers compaction after an assistant message when context exceeds the window minus `reserveTokens` (20k), on an overflow error, or through `compact()`.
  - It keeps the most recent 8k tokens, estimated as characters/4.
  - It makes one or two model calls and updates an existing summary incrementally.
  - The result is **one rolling summary**, appended as a record. The originals stay in the log.
  - `compaction: false` turns it off.
- **Steering.** pi-agent-core has `steer()`, `followUp()` and `abort()`. Flue adds a durable "join at the turn boundary", which moves queued submissions of the same session into the running one. Abort marks every active submission, with a 60 s grace period.

### How statewalker-ai's `ai-agent.core` compacts (0.4.3)

- **Tree.** The tree is `session` → `turn` → messages, tool calls and reasoning. A `turn_group` holds a summary and `sections[{title, body, refs}]` over a contiguous run of turns, or over lower groups at the next depth.
- **When it runs.** Compaction runs before each model call, but only if a token budget and a summarizer are configured. The runtime configures neither, so it is off by default. The steps:
  1. Try trimming long tool results, which changes only what is sent to the model.
  2. Wrap up to 6 old turns outside the last 4, none of them pinned, into a depth-1 group.
  3. Otherwise promote 4 or more same-depth groups one level up.
  4. Otherwise report thrashing.
- **What is kept.** Originals are kept, re-parented under the group. The pins are the latest user message, the latest call of each stateful tool, and anything marked pinned.
- **Building the context.** Turns become messages and groups become one summary message each. A group holding a pin is expanded. If the result is over budget, the deepest expansions are collapsed. The default selector reads only direct turn children, so grouped turns would be dropped.
- **Persistence.** One Markdown file per session, rewritten whole, because compaction re-parents earlier blocks.
- **(inference)** The same model fits two append-only tables:
  - `items(seq, id, turn_id, kind, body)`;
  - `summaries(id, depth, from_seq, to_seq, parent_id, content, sections, tokens)`, whose rows point at ranges of items.

  The context is the top-level summaries plus the items no summary covers. The summarizer, tool-result trimming, token estimator, compaction decisions and hierarchical selector port directly; only the code that walks the tree becomes range queries.

## Open questions

- Whether the harness's approval decisions (`edit`, `respond`) survive projection to OpenAI,
  whose `mcp_approval_response` carries only `approve` and an optional reason.
- Whether the harness adopts Flue's approval-gate pattern (pending result, `terminate: true`,
  a signal, `useAgentStart`) for "ask", or wraps tools in the capability environment so the
  pause works the same for every execution core.
- Whether runs inside a thread may overlap (subagents, scheduled work) or stay strictly FIFO.

## Sources

- OpenAI: https://developers.openai.com/api/docs/assistants/migration.md,
  https://developers.openai.com/api/docs/guides/migrate-to-responses.md,
  https://developers.openai.com/api/docs/guides/conversation-state.md,
  https://developers.openai.com/api/docs/guides/background.md,
  https://developers.openai.com/api/docs/guides/streaming-responses.md,
  https://developers.openai.com/api/docs/guides/websocket-mode.md,
  https://developers.openai.com/api/docs/guides/steering.md,
  https://developers.openai.com/api/docs/guides/function-calling.md,
  https://developers.openai.com/api/docs/guides/tools-connectors-mcp.md,
  https://developers.openai.com/api/reference/resources/conversations.md,
  https://developers.openai.com/api/reference/resources/responses/streaming-events.md
- OpenAI Agents SDK: https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- Open Responses: https://www.openresponses.org/llms.txt
- Vercel AI SDK: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol.md,
  https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams.md,
  https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage.md,
  https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence.md,
  https://ai-sdk.dev/docs/ai-sdk-ui/transport.md,
  https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling.md
- Cloudflare Agents: https://developers.cloudflare.com/agents/llms.txt,
  https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/index.md,
  https://developers.cloudflare.com/agents/runtime/routing/index.md,
  https://developers.cloudflare.com/agents/runtime/routing/authentication/index.md,
  https://developers.cloudflare.com/agents/runtime/capabilities/sessions/index.md,
  https://developers.cloudflare.com/agents/runtime/capabilities/streams/index.md,
  https://developers.cloudflare.com/agents/runtime/capabilities/state/index.md,
  https://developers.cloudflare.com/agents/runtime/capabilities/websockets/index.md,
  https://developers.cloudflare.com/agents/harnesses/think/programmatic-submissions/index.md,
  https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/index.md
- Agent Protocol: https://github.com/langchain-ai/agent-protocol (commit `820bd30`: `README.md`,
  `openapi.json`, `streaming/README.md`, `streaming/protocol.cddl`)
- LangSmith Agent Server: https://docs.langchain.com/langsmith/runs.md,
  https://docs.langchain.com/langsmith/double-texting.md,
  https://docs.langchain.com/langsmith/cancel-run.md,
  https://docs.langchain.com/langsmith/add-human-in-the-loop.md,
  https://docs.langchain.com/langsmith/streaming.md,
  https://docs.langchain.com/langsmith/auth.md
- DeepAgents: https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop.md,
  https://docs.langchain.com/oss/javascript/deepagents/async-subagents.md
- Flue: https://github.com/withastro/flue (commit `deee93b`, matching npm 2.3.0):
  `README.md`, `apps/docs/src/content/docs/reference/streaming-protocol.md`,
  `reference/agent-api.md`, `guide/routing.md`, `ecosystem/deploy/cloudflare.md`
- MCP: https://modelcontextprotocol.io/specification/2026-07-28/changelog.md
- A2A: https://a2a-protocol.org/llms.txt, https://a2a-protocol.org/latest/specification/
- Package versions: registry.npmjs.org (`ai`, `agents`, `@cloudflare/ai-chat`,
  `@langchain/langgraph-sdk`, `deepagents`, `@flue/runtime`, `@flue/sdk`, `@openai/agents`)
- Starting point: `statewalker-sandbox/apps/flue-capfs-do/README.md` (HTTP surface: admin session
  routes and `POST /api/agents/:name/run`; no streaming or approval endpoint yet)
