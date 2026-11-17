# How stable is the Unified Harness Protocol, and how does it map onto the session API?

Research for `statewalker/statewalker-root#107` (map: `statewalker/statewalker-root#70`). Sources
read on 2026-11-17. Statements marked **(inference)** are this note's own reasoning, not a source's
claim.

`HR` is the HarnessRouter repository, `github.com/HarnessRouter/harnessrouter`, cloned at commit
`188c888` (2026-11-16). `SPEC` is `HR/protocol/versions/2026-10-19/`, the Markdown the site at
`https://unifiedharnessprotocol.org/spec/2026-10-19/<chapter>` is built from
(`HR/protocol/site/build.py:33-72`, `HR/protocol/vercel.json`). The site answered the first request
and then refused every later one with a Vercel firewall `403` (`x-vercel-mitigated: deny`), so the
chapters were read from the repository. `NATIVE` is the session API decided in
`statewalker/statewalker-root#83` (last comment), with modes and approvals from #79, executors from
#94 and definitions from #82.

## Question

How stable and how widely adopted is the Unified Harness Protocol (UHP, current version
`2026-10-19`, Apache-2.0, maintained in HarnessRouter)? How does its model map onto the native
session API, in both directions? What would a UHP client inside a Durable Object need, and what
can an external harness behind UHP be told? What are the gaps and risks of making UHP the native
API, versus keeping it a projection like the OpenAI one?

## Short answer

- **It is young, single-vendor and moving quickly.** Five date versions in 69 days (2026-08-11,
  09-12, 09-28, 10-04, 10-19). Features keep landing inside a version that is called published
  (`input_requests`, `session_branching`, `ETag`/`If-Match`, all after 2026-10-19). The project
  says a published schema is immutable (`SPEC/schema.md`), yet the `2026-10-19` schema and chapters
  were edited on 11-08 and 11-13 (`git log` on `HR/protocol/schema/uhp-2026-10-19.openapi.yaml`).
  It has broken its own versioning rules twice and says so: refusals tightened inside `2026-10-04`,
  and a non-additive change in `2026-10-19` (`HR/protocol/VERSIONING.md`, "known compromises").
  HarnessRouter owns the name and the trademark, chooses the maintainers and runs the
  conformance suite (`HR/protocol/GOVERNANCE.md`).
- **Adoption beyond HarnessRouter is thin.** The listed implementations are HarnessRouter CE,
  hosted HarnessRouter and SuperQode (`HR/protocol/IMPLEMENTATIONS.md`). The only measured
  non-HarnessRouter report fails: SuperQode passed 42 of 74 checks, failed 9 and skipped 23, on
  `2026-09-12`. No measured report exists for `2026-10-19` at all. An "independent Go
  implementation" is cited but is private. There is no client SDK: clients are told to generate
  one from the OpenAPI file. The repository has 4.4k stars, 488 forks and 880 commits. Of the last
  60 commits, 43 are by `github-actions[bot]`.
- **The task surface maps cleanly onto ours. The rest of the model does not.** A UHP response is
  our turn, a UHP session is our agent session, the streaming vocabulary is the OpenAI Responses
  subset we already emit, and plugins are Agent Plugins 1.0.0 as in #82. UHP has no equivalent
  for most of what #83 and #79 decided:
  - no user session, modes or approval scopes;
  - no message queueing or steering: a second task in a busy session is `409 session_busy`;
  - one pending question at a time, and no sub-agent sessions;
  - no session-wide numbered event log; streams are per task, and resuming one is optional;
  - no explicit session creation, archive or metadata search;
  - no notion of a workspace or project.

  UHP "environments" are built, read-only dependency images, not our executors. UHP memories are a
  large tree-with-grants sub-protocol, where our side has only "Not yet specified".
- **Recommendation (inference): keep the native API, and add UHP as a second projection** beside
  the OpenAI one, at class Core. It would carry `input_requests` for approvals and Extended files
  if they are cheap. Separately, consider a UHP *client* as a later executor or "external harness"
  adapter. Borrow UHP's good rules into the native API: report ignored fields, report model
  substitution, keep `incomplete` reasons, answer `404` and never `403`, end with a terminal event
  that carries the full result, and send keep-alives every 30 seconds.

## Findings

### Stability: versions, what changed, policy

**Versions.** `VERSIONING.md` says: "`2026-10-19` is the current version; `2026-10-04`,
`2026-09-28`, `2026-09-12` and `2026-08-11` remain published and served." What each one brought
(`HR/protocol/CHANGELOG.md`):

| Version | What it brought |
|---|---|
| 2026-08-11 | First version, "extracted from the shipping HarnessRouter implementation rather than designed in the abstract". Added discovery (`GET /v1/uhp`), the `UHP-Version` header and the error envelope |
| 2026-09-12 | Plugins (Agent Plugins 1.0.0 packages), the composition rule, `plugin_*` error codes |
| 2026-09-28 | Environments (`henv_`), patched the next day to move the task-side field into `metadata.environment` |
| 2026-10-04 | Memories. Five same-day or later patches changed record `content` to a part list, made the memory id opaque, changed `recall` from one memory to a subtree, and replaced the principal vocabulary twice |
| 2026-10-19 | Harness retirement may delete sessions (not additive), harness writes refuse unknown fields. Added after publication: `input_history`, `input_requests`, turn times, `harness_idempotency`, `session_branching`, `ETag`/`If-Match`; `fallback` deprecated |

**Policy.** From `VERSIONING.md`:
- Within a version a server MAY add optional request fields, response fields, event types, vendor
  error codes, and MAY relax constraints. It MUST NOT remove or rename a field, change a type,
  add a required field or tighten a constraint.
- Clients MUST ignore unknown fields, events and item types, and treat unknown error codes as
  their `type`.
- Servers MUST echo `UHP-Version`, MUST reject an unsupported version with
  `unsupported_protocol_version`, and "SHOULD support the previous version for at least six
  months".
- Deprecation: "keeping it working for at least two published versions", removal "no earlier
  than the second version after the announcement".
- Dates were chosen because "A date claims nothing it cannot keep."

**Self-declared breaks.** "Harness writes refuse what they cannot store ... Both are tightenings the
rules above reserve for a new version. They were made inside `2026-10-04` ..."; and "`2026-10-19`
is additive to `2026-10-04` except in one rule" (harness retirement; `VERSIONING.md`).

**"Immutable" versions are edited.** `SPEC/schema.md` says: "A published version is immutable:
fixing a schema means publishing a new version, never editing one clients may already have
generated from." `git log` shows `uhp-2026-10-19.openapi.yaml` and `SPEC/` changed in commits
`6c6b6c7` (2026-11-08, branching) and `5258e32` / `ef74f38` (2026-11-13). The CHANGELOG labels
these "2026-10-19, addition".

**Document drift found while reading** (each is a spec/schema/guide disagreement):
- The OpenAPI `info.description` of `uhp-2026-10-19.openapi.yaml` still reads "This version is
  additive to 2026-08-11. It adds plugins ...".
- `DELETE /v1/sessions/{id}` is in the endpoint table (`SPEC/index.md`) and in Sessions §6, but
  the OpenAPI document has no `delete` under `/v1/sessions/{session_id}`.
- Tasks §1.1 says `background` returns at once and you "follow it with the events endpoint", and
  Streaming §5 names `GET /v1/harnesses/{harness_id}/events`. Neither the endpoint table nor the
  OpenAPI file defines that endpoint. The reference has it as a per-harness broadcast for its
  console (`HR/gateway/app.py:12781-12787`).
- `HR/protocol/CONNECTING.md` (the client guide) gives "`POST /v1/tasks`", "`GET
  /v1/tasks/{id}/events`" and "`GET /v1/files/{id}`", none of which exist in any version.
- The protocol README's "Implementing UHP" still points at `uhp-2026-09-12.openapi.yaml`, and
  every listing in `IMPLEMENTATIONS.md` says "UHP 2026-09-12".

### Governance, conformance, adoption

**Governance** (`GOVERNANCE.md`):
- The model is "maintainer-led, proposal-first". A change starts as a "UHP Enhancement Proposal
  (UEP) as a GitHub issue labelled `uep`". Maintainers answer within 10 working days, and an
  accepted change lands as one pull request with the spec, schema, reference implementation,
  conformance test and changelog together.
- Roles are Maintainers (merge rights), Contributors and Implementers. No body outside
  HarnessRouter is named.
- Three issues carry the `uep` label (#476, #477, #479), all closed by 2026-11-13
  (github.com/HarnessRouter/harnessrouter/issues?q=label:uep).
- On the name: "'Unified Harness Protocol' and 'UHP' are marks of HarnessRouter." "An
  implementation may describe itself as 'UHP-compatible' ... only if it passes the conformance
  suite."

**Conformance classes** (`SPEC/architecture.md` §2):

| Class | A server at this class MUST implement |
|---|---|
| Core | "Capability discovery, harness discovery, non-streaming and streaming task execution, session continuation, cancellation, and the error model." |
| Extended | "Core, plus file input, artifact retrieval, and session listing/inspection." |
| Full | "Extended, plus harness lifecycle management (create, update, delete) and session sharing." |

Plugins, environments, memories, branching, `input_requests` and `input_history` are capability
booleans in `GET /v1/uhp`, "optional at every class".

**Suite** (`HR/protocol/conformance/README.md`):
- It is a Python CLI, `uhp-conformance --base-url … --class core|extended|full`.
- "101 checks across three classes": Core 41, Extended +9, Full +51.
- It "runs real agent tasks ... about seven of them, which costs real model tokens".
- Notable checks: S-04 (gapless `sequence_number`), S-09 (stream is progressive, not buffered),
  C-03 (cancel really stops), X-08 (artifact path traversal), T-08 to T-10 (reserved fields
  reported as ignored).
- "The suite is developed against that implementation" (the reference).

**Measured reports** (`HR/protocol/conformance/reports/`):

| Report | Version | Result |
|---|---|---|
| harnessrouter-ce 0.3.0 … 0.9.0-rc | 2026-08-11 | 52/52 |
| harnessrouter-ce 0.17.2, 0.25.6 | 2026-09-12 | 74/74, 76/76 |
| harnessrouter (hosted) | 2026-09-12 | 76/76 |
| superqode 2.3.1 | 2026-09-12 | `conformant: false`: 42 pass, 9 fail, 23 skip |

Nothing has been measured at 2026-09-28, 10-04 or 10-19. The suite README mentions "an
independent Go implementation (63/63 `full`, zero skipped)". Issue #42 describes it as
"a Go implementation, private repository" (github.com/HarnessRouter/harnessrouter/issues/42).

**Who implements it.**
- `IMPLEMENTATIONS.md` lists three servers: HarnessRouter CE ("26 existing harness bases, among
  them Codex, Claude Code, Hermes, OpenCode and Gemini CLI"), hosted HarnessRouter ("sixteen
  harness bases"), and SuperQode ("`superqode serve uhp`, binding one configured HarnessSpec").
  It lists one client, SuperQode (`superqode connect uhp`).
- A web search found only HarnessRouter announcements and secondary write-ups: fondo.com,
  themenonlab.blog, a press release on marketersmedia.com dated 2026-08-14, and directory
  listings. Their "Qoder support" is HarnessRouter driving Qoder (`HR/runner/qoder_driver.py`,
  commit `4361ed8` "Qoder: tag the environments ... HarnessRouter creates"), not Qoder serving UHP.
- Similar names that are not UHP: "Agent Harness Protocol" (`a3s-ahp` on docs.rs), "Harness
  Protocol" (harnessprotocol.io), and TanStack AI's "harness wire protocol".

**SDKs.** None are published. `SPEC/schema.md` and `CONNECTING.md` say: "Do not hand-write types
... generate a typed client" (`npx openapi-typescript …`). The Responses-compatible task surface is
the stated way to reuse existing OpenAI SDKs (`HR/protocol/README.md`, "Relationship to the OpenAI
Responses API").

**Ecosystem position.** `HR/protocol/ECOSYSTEM.md` (informative) places UHP as "product ↔
complete harness", beside MCP (agent ↔ tools), A2A (agent ↔ agent), ACP (editor ↔ coding agent)
and AG-UI (front end ↔ agent).

### The spec, chapter by chapter (2026-10-19)

**Architecture.**
- The roles are Client, Server and Harness. How the server runs the harness "MUST NOT leak into
  the wire format".
- A configured harness is "a base plus configuration — default model, system prompt, tool
  restrictions, skills, MCP servers, step and time budgets".
- Seven objects: Harness `chrn_`, Response `resp_`, Session `hsess`, File `file_`, Container
  `cntr_`, Environment `henv_`, Memory `hmem_` (or an opaque id). Events carry a `type`.
- The session is implicit: "Requiring `POST /sessions` before any work could be done would add a
  round trip ...".
- Authentication is a bearer token whose issuance is out of scope. Objects are scoped to "the
  principal that created it", and a server MUST answer `404`, not `403`, outside that scope.

**Lifecycle.**
- `UHP-Version` is negotiated per request.
- `GET /v1/uhp` is unauthenticated, lists capabilities, and a missing key means `false`.
- Task states: `in_progress` → `completed | failed | incomplete | cancelled`. `incomplete` carries
  `incomplete_details.reason`: `max_steps`, `timeout`, `input_required`, "or a server's own word
  for another cause, such as `interrupted`".
- Concurrency: "A server MUST NOT run two tasks concurrently in the *same* session ... MUST fail
  with `409` and `code: "session_busy"`."
- A session "MUST NOT be extended by a task that names a different configured harness"
  (`harness_mismatch`).

**Tasks.**
- `POST /v1/responses` takes `input`, `model`, `metadata.harness_id`, `stream`,
  `previous_response_id`, `branch`, `instructions`, `store`, `max_output_tokens`, `max_step`,
  `timeout_seconds`, `metadata.environment`, `metadata.memory` and `background`.
- Unknown fields are ignored, and that "MUST be observable" through `metadata.ignored_fields`.
- Model substitution must be reported (`requested_model`, `model_fallback`,
  `model_fallback_reason`) or refused with `422 model_unavailable`.
- `tools` and `include` are "Reserved and ignored". On `tools`, the reason given is "UHP puts both
  of those in `output` ... There is no input path for a tool result". A per-request MCP server is
  rejected as "an escalation primitive ... narrowing is safe, widening is escalation".
- Output items: `message`, `reasoning`, `function_call`, `function_call_output`, `input_request`.
- `Idempotency-Key` returns the first request's result, and waits if that request is still
  running. Keys are kept 24 hours.

**`input_requests` (Tasks §3.2).**
- The turn ends `incomplete` with reason `input_required`. The question is the last
  `input_request` item `{id: inreq_…, kind: choice|confirm|free_text|secret, prompt, options[],
  expires_at}`, and it is repeated as text in the last `message`.
- The answer is one `input_response {input_request_id, answer}` in the next request, chained with
  `previous_response_id`. Any other input "voids the question" (`metadata.voided_input_requests`).
- Refusals: `409 input_not_pending`, `410 input_request_expired`, `422 input_response_invalid`.
- A `secret` answer "MUST NOT appear in any event, in the stored response". A base without a
  question tool is given one named `ask_user`.
- The reasoning: "a turn held open that long is a sandbox held open that long".

**Streaming.**
- SSE events with `type` and `sequence_number`, which "MUST start at `0` and increase by exactly 1
  per event within a stream".
- The vocabulary is the Responses subset: `response.created/in_progress/completed/incomplete/failed`,
  `output_item.added/done`, `content_part.*`, `output_text.delta/done/annotation.added`,
  `reasoning_summary_*`, `function_call_arguments.*`, `error`.
- The terminal event carries the full response. A cancelled task ends with `response.failed`
  whose `status` is `cancelled`.
- "A dropped connection MUST NOT abort the task." `Last-Event-ID` resumption is a MAY. "A client
  SHOULD treat the stream as an optimisation and the stored response as the source of truth."
- Errors §5 adds that a server SHOULD send `: keep-alive` at least every 30 seconds.

**Sessions.**
- Continue with `previous_response_id`. `model` may change per task.
- Branching (capability `session_branching`): `branch: true` makes a new session "from that
  response's committed user files and the transcript up to and including it". The reference does
  this from Git checkpoints. It is refused with `409 branch_unavailable` when impossible.
- Extended: `GET /v1/sessions?limit&cursor&harness`, `GET /v1/sessions/{id}`, and `…/turns`
  (each turn has `id`, `status`, SHOULD `user`, `assistant`, `tools`, `files`, `created_at`,
  `completed_at`, `imported`).
- Cancel works on two scopes: `POST /v1/responses/{id}/cancel` and `POST /v1/sessions/{id}/cancel`.
  "Cancelling MUST NOT delete the session."
- Full: share (`POST/GET/DELETE /v1/sessions/{id}/share`, a read-only, link-holder view that
  revocation must reach entirely), and `DELETE /v1/sessions/{id}`, which cancels in-flight work
  first. The older path `/v1/traces/{id}` is kept.

**Harnesses.**
- The harness object fields are camelCase: `name`, `base` (opaque), `defaultModel`,
  `systemPrompt`, `mcpServers` (remote only: `http` or `sse`, `headers`, `auth` as "Bearer token,
  or a server-side reference the server resolves"), `skills` (whole folders inline, `content` or
  `content_b64`), `plugins`, `environment`, `disabledTools`, `maxStep`, `timeoutSeconds`.
- Disabled MCP entries MUST NOT be contacted, and an unreachable MCP server MUST NOT fail the task.
- `disabledTools` is a hard block where the base supports one; otherwise it is a standing
  instruction.
- `GET /v1/models` and `GET /v1/harnesses/{id}/models` report a computed `available` flag.
- Full adds create, update (`PUT` replaces everything; optional `ETag`/`If-Match`) and delete,
  plus retirement with a restore window under `harness_retirement`.

**Plugins.**
- "A UHP plugin **is** an Agent Plugins package, version 1.0.0", carried as `files` and installed
  per harness. The server derives `manifest`, `mcpServers`, `skills` and `skipped`.
- stdio MCP servers are allowed only inside a plugin, and run "inside the same sandbox as the
  agent".
- `PLUGIN_DATA` persists for the session. Names are unique across the harness and its plugins
  (`plugin_conflict`).
- `GET /v1/harnesses/{id}/plugin` exports the harness's direct configuration as a package, with
  `auth` and `headers` stripped.
- Discovery adds `plugin_schemas`. Plugins are installed "by whoever manages the harness (class
  Full), never per request".

**Environments.**
- "A project's files and installed dependencies, built once, and read by every session that names
  it", mounted read-only at `/env/<slug>`. The session's working directory stays "writable,
  private, and the only place artifacts come from".
- Files can be edited by path, or imported from a zip, tar or git source. A build installs
  `pip`/`npm`/`apt` packages and runs `setup.sh`. Builds are versioned, with an active pointer.
- A task on an environment that is not ready is refused before it starts.
- The agent's `PATH`, `PYTHONPATH` and `NODE_PATH` are pointed at the environment.

**Memories** (993 lines, the largest chapter).
- A tree of memories holding records. Grants are `read | write | create | delete`, inherited
  downward, with a `restricted` cutoff and no deny.
- "A person and an agent are the same kind": both are members. A harness's agent is a principal
  (`member:chrn_…`).
- A session touches memory at four moments: Prime (standing records put in the instructions "at
  session start and after the conversation is compacted"), Tools (`memory_recall`,
  `memory_remember`, …), Observe (each finished turn is sent as an episode) and Consolidate
  (background runs that can be reverted).
- Storage is pluggable (the reference uses Mem0 and Graphiti). Recalled content MUST be presented
  "as data, fenced from instructions".

**Files** (Extended).
- Input arrives inline as a `file_data` data URL or through `POST /v1/files` (multipart) and
  `file_id`.
- Artifacts appear as `container_file_citation` annotations with a `download_url`, and in
  `GET /v1/sessions/{id}/files` (every task's files). Bulk download is `…/files/archive`.
- Downloads MUST send `X-Content-Type-Options: nosniff`. Preview `…/pdf` answers `501` when the
  server does not offer it.

**Errors.**
- The envelope is `{error: {type, code, message, param, detail}}`. Types are
  `invalid_request_error`, `authentication_error`, `permission_error`, `rate_limit_error`,
  `harness_error` and `server_error`. Vendor codes take a prefix.
- A task's failure is `200` with `status: failed`; a request's failure is non-2xx.
- "Retries of `POST /v1/responses` MUST carry an `Idempotency-Key`."
- Streaming clients should use an inactivity timeout, not a total timeout.

**Security.**
- Credentials are never echoed.
- The provider credential is kept out of the agent's reach, or issued "short-lived,
  single-session".
- Brokered upstream URLs are checked against an allow-list (to prevent SSRF).
- Prompt injection "is in scope for the client". The client-side tools are `disabledTools`,
  budgets, "separate harnesses for separate trust levels" and the event stream.
- Plugins are treated as third-party code, environments are enforced read-only, and memories are
  untrusted content.

### Mapping: UHP → native

| UHP | Native counterpart | Fit |
|---|---|---|
| Configured harness `chrn_` (base + prompt, model, MCP, skills, plugins, disabledTools, budgets, environment) | A visible agent `<plugin>/<name>` in a project: `agents/<name>.md` front matter (`models`, `skills`, `tools`, `agents`, `mode`, `requires`) plus the project's catalog view (#82) | Partial. **(inference)** A projection can list one synthetic harness per (project, agent) the token may use, the way the OpenAI projection picks the agent by base URL. `base` is a constant (the harness's own core) |
| `POST/PUT/DELETE /v1/harnesses` (Full) | Writing agents and plugins at project or workspace level, through harness tools by owners and admins (#82 §15) | Poor. The native model has no per-caller configuration object, and definitions are pinned per session by hash. Stay below Full |
| `GET /v1/models`, `…/harnesses/{id}/models` | `GET …/models` of the OpenAI projection (the models the user may use) | Good |
| `POST /v1/responses` (first task) | `POST /v1/sessions {project, agent, messages}` | Good. The session is created implicitly, and `metadata.session_id` is our session id |
| `POST /v1/responses` with `previous_response_id` | `POST /v1/sessions/{id}/messages {delivery: next}` when idle | Good when idle. When busy, UHP requires `409 session_busy` |
| `previous_response_id` that is not the latest | Native OpenAI projection refuses it with `409` (#83 §4) | Unspecified in UHP without `branch` **(inference: the reference continues the session)**. With `branch: true` it is a fork, which native puts under "Not yet specified" |
| Response `resp_` and `status` | Turn and `GET /v1/turns/{id}` | Good. `queued` has no UHP state. `waiting` → `incomplete` + `input_required`. `interrupted` → `incomplete` + reason `interrupted` (allowed as "a server's own word") |
| `output[]` items | Session items of that turn | Good for messages and tool calls. Approval items need `input_request` |
| `GET /v1/responses/{id}/input_items` | `GET …/items?types[]=message` filtered to the turn's user input | Good |
| `POST /v1/responses/{id}/cancel` | `POST /v1/turns/{id}/cancel` | Good |
| `POST /v1/sessions/{id}/cancel` | Cancel the running turn (no native session-level cancel) | Good **(inference)**: a thin wrapper |
| `DELETE /v1/responses/{id}` | None. Items are immutable until the session is purged | Gap. Answer `2xx` and hide it, or refuse |
| `GET /v1/sessions`, `/{id}`, `/turns` | `GET /v1/sessions?…`, `GET /v1/sessions/{id}`, items grouped by turn | Good. Native is richer (status, parent, metadata search) |
| `DELETE /v1/sessions/{id}` | `DELETE /v1/sessions/{id}` (purge; native refuses while running, UHP cancels first) | Close. Differs on a running session |
| Share (Full) | None | Gap |
| SSE stream on `POST /v1/responses` | `GET /v1/sessions/{id}/events?since=` filtered to one turn and translated to Responses events (the OpenAI projection already does this) | Good. `sequence_number` = offset minus the turn's first offset **(inference)** |
| `background: true` + "events endpoint" | `202 {turn_id, stream_url, offset}` | Native is better specified than UHP here |
| `Idempotency-Key` header | `idempotency_key` in the `POST /v1/sessions` body | Close. Native would need it on messages too |
| `input_request` / `input_response` | Approval item and `POST /v1/approvals/{id}` | See the next table |
| `input_history` (earlier turns in `input`) | `messages?` on `POST /v1/sessions` | Partial |
| Container `cntr_`, artifacts, `GET …/files` | The session's file view over project files (#75, #76). Attachments are project files | Partial. UHP assumes a private per-session working directory. Native sessions write live into shared project files. **(inference)** Artifacts would be "files the session's turns changed", which needs change tracking per turn |
| `POST /v1/files` + `input_file` | Writing an attachment into the project | Partial **(inference)**: where uploads land is a native decision still to be made |
| Plugins (Agent Plugins 1.0.0) | Plugin catalog in Agent Plugins 1.0 layout with the `dev.cellb.harness/` extension directory (#82) | Strong on format. UHP installs per harness by its manager. Native has three catalog levels filtered by role. stdio: UHP runs it in the sandbox, native answers `ENOSYS` (#82 §14) |
| `mcpServers[].auth` "server-side reference" | `{{secret:NAME}}` resolved by the gateway (#82 §14) | Good |
| `disabledTools` (deny list) | Agent `tools` patterns (allow list) and mode deny rules | Partial. Different polarity |
| `maxStep`, `timeoutSeconds`, `max_step`, `timeout_seconds` | Per-run timeouts and output caps per executor (#94 §7). No per-turn step budget | Gap on the native side |
| Environment `henv_` | Nothing equivalent. Executors (#94) are *where* code runs, with network off and no build step. Project files are live, not built | Mismatch. An agent's `requires` failing at session start is the closest rule (≈ `environment_not_ready`) |
| Memories (tree, grants, prime/observe) | "Agent memory and history": not yet specified (#83 §7) | None yet. A source to borrow from |
| Bearer token, principal scope, `404` not `403` | Biscuit access token naming user and workspace. Session ids checked against the user session | Good |
| Errors envelope | Not fixed natively | Adoptable |

### Mapping: native → UHP

| Native feature (#83, #79) | In UHP? | How |
|---|---|---|
| User session `GET /v1/me` (user, mode, pending approvals, agent sessions) | **No** | Nothing above sessions. **(inference)** It would be a vendor extension endpoint outside the spec |
| Mode, `PUT /v1/me/mode`, per-session mode, sub-agents only stricter | **No** | Only the harness-level `disabledTools`, set by its manager. **(inference)** A per-task `metadata.mode` that only narrows fits UHP's "narrowing is safe" rule, but clients would not know it |
| `delivery: next` while a turn runs (FIFO queue) | **No** | MUST be `409 session_busy`. The client waits and retries |
| `delivery: steer` | **No** | Nothing injects into a running task |
| `delivery: interrupt` | **Through two calls** | `POST …/cancel`, then a new task with `previous_response_id`. Not atomic, and the cancelled turn ends `cancelled`, not "interrupted" |
| Approvals: allow / deny with message / allow for this session | **Through `input_requests`, lossy** | `kind: choice`, options `allow`, `allow_session`, `deny`. The answer is one option id, so a deny reason needs a second question or a voiding message **(inference)**. `expires_at` = the 24-hour expiry. Any other input voids the question. Native semantics for that case are not decided |
| Several pending approvals in one turn (`stop_reason.approval_ids[]`) | **No** | "The question is the response's last `input_request` item", and at most one `input_response` per request |
| A child session's approvals posted to the root stream | **No** | No sub-sessions |
| Sub-agents as child sessions (`parent_session_id`) | **No** | They appear only as `function_call` items of the parent turn |
| Numbered, durable event log per session with offsets; many watchers; disconnect never cancels | **Partly** | Per-task `sequence_number` starting at 0. "MUST NOT abort" on disconnect. `Last-Event-ID` optional. No session-wide stream in the spec |
| Items paged and filtered across the session | **Partly** | Per response (`output`, `input_items`) and `/turns` summaries. No item query |
| Compaction, summaries, tail | **Not visible, and need not be** | Internal. Memories mentions priming "after the conversation is compacted" |
| Biscuit bearer tokens; a new token resumes the user session | **Compatible** | Bearer, issuance out of scope. Attenuation is invisible to UHP |
| WebSocket with the token in the first message; RPC over webrun-wire | **No** | HTTP and SSE only |
| Multi-tenant workspaces, projects, members and roles | **No** | One flat "principal" scope. Memories alone has groups and grants |
| Explicit session start with project + agent; metadata; `PATCH`; archive | **Partly** | Implicit start. `harness_id` stands in for agent. No project, metadata search, `PATCH` or archive |
| `DELETE` session refused while running | **Opposite** | UHP cancels first, then deletes |
| Model override only if the capability holds the right, else ignored | **Compatible if reported** | UHP needs `422 model_unavailable` or a reported substitution, never a silent ignore |
| Fork, rewind, edit-and-regenerate (native "Not yet specified") | **Yes, optional** | `session_branching` |
| Long-term memory (native "Not yet specified") | **Yes, optional** | Memories sub-protocol |

### Consuming UHP from a Durable Object

What a UHP client inside an Agent DO needs, to drive an external harness such as HarnessRouter
running Claude Code or Codex:

- **Transport.** `fetch` with `stream: true` and an SSE parser over the response body. Read events
  in `sequence_number` order and detect gaps. Use an inactivity timeout (the server SHOULD send `:
  keep-alive` at least every 30 seconds), never a total one (Errors §5). Proxies must not buffer
  the stream (Streaming §1).
- **Long tasks (inference).** A DO should not hold a `fetch` open for a task that can last minutes
  and survive restarts. Use `background: true`, store `resp_…` in the DO's SQLite, and follow
  either an SSE stream that is allowed to drop or `GET /v1/responses/{id}` polled from an alarm.
  The spec says to do exactly this: "treat the stream as an optimisation and the stored response
  as the source of truth". The terminal event and the stored response carry the full `output`, so
  a lost stream costs only intermediate deltas.
- **Reconnection.** Resuming a stream is not guaranteed (`Last-Event-ID` is a MAY, and the
  reference has none). After a drop, re-read the response. If it is still `in_progress`, keep
  polling or open the events feed again. Items already folded in are matched by `item.id`
  **(inference)**.
- **Retries.** Always send an `Idempotency-Key` on `POST /v1/responses` (Errors §4). The DO
  generates it before the first attempt and stores it.
- **Busy sessions.** Our `next` queue stays in the DO: send the next task only after a terminal
  state, and treat `session_busy` with `retry_after_ms` as back-off.
- **Questions.** Map an `input_request` into a native Approval or question item, and answer it with
  `input_response` chained on that response. Handle `input_not_pending`, `410` and `422`.

What an external harness behind UHP can be told:

- **Files.** It can be given `input_file` (inline or uploaded) and, with `environments`, a
  read-only project imported by archive or git URL. Results come back as artifacts to download.
  **There is no way to mount our FilesApi or a capability into its working directory.** Every
  exchange is a copy, with no live, per-operation authorization as in #94's Wasmer mount.
- **Tools.** Only through MCP servers configured on the *harness* (remote `http`/`sse`, with
  `headers` and `auth`) or inside plugins. They cannot be set per request: `tools` is ignored by
  rule. **(inference)** To hand the external agent our session's harness MCP endpoint (#90) with a
  lease-scoped, attenuated token, the client needs class Full and must create or update a harness
  per session (or per capability), then retire it. That is heavy, and it puts our token into
  another party's harness configuration.
- **Credentials.** MCP `auth` can be a bearer token or "a server-side reference the server
  resolves". A `secret` answer to an `input_request` reaches the harness through the server's
  secret store and never enters the conversation. Provider keys stay on the UHP server.
- **Gating.** The external harness runs every tool in its own sandbox. Our modes, permission
  rules and approvals do not apply there. We see `function_call` items as observability
  only, and can only shrink the surface with `disabledTools`, budgets and the MCP servers we give
  it (Security §4). **(inference)** So an external UHP harness is a separate trust domain, like
  the external pool in `docs/research/external-wasmer-executor-pools.md`, and fits best as an
  executor kind or as a "remote agent" tool, not as an execution core under our capability.

### Gaps and risks

**Making UHP the native API:**
- **Model loss.** Everything in the "native → UHP" table marked **No** would have to become vendor
  extensions or be dropped: the user session, modes, `next`/`steer` delivery, several approvals
  per turn with session scope, sub-agent sessions, session-wide event logs, workspaces and
  projects, archive, metadata search, and RPC. The two decisions closest to the harness's design
  (#79's approvals and #83's delivery modes) are the ones UHP explicitly does differently
  (`session_busy`; one question per turn).
- **The object model assumes a container sandbox.** That means a private POSIX working
  directory per session that is checkpointed (the reference uses Git), environments built with
  `pip`/`npm`/`apt` and `setup.sh`, and stdio MCP servers in the sandbox. On Workers and CellD
  these answer `ENOSYS` (#94). **(inference)** We could never advertise `environments`, and
  stdio-bearing plugins would be refused with `unsupported_transport`.
- **Churn and control.** The spec moves weekly and edits "published" versions. It is governed and
  trademarked by one company and validated by a suite that company writes against its own server.
  A native API tied to it would inherit every change, or freeze at a version that is not really
  frozen.
- **Thin interoperability today.** No conformant implementation outside HarnessRouter has been
  shown, and no SDK exists. The practical gain from being UHP-native, that other UHP clients can
  drive the harness, has very few clients to collect.
- **Mixed casing** (snake_case tasks, camelCase harness), which UHP itself flags for a future
  major version.

**Keeping UHP a projection:**
- **Cheap (inference).** Its task and stream surface is the Responses shape that `ai-openai-compat`
  already serves. What UHP adds is `GET /v1/uhp`, `metadata.harness_id` (or
  `metadata.session_id`) routing, `ignored_fields`, model-substitution fields, `session_busy`,
  `/v1/sessions` listing, `/turns`, and `input_request` for approvals. Core plus `input_requests`
  is a few routers over `UserSessionApi`/`AgentSessionApi`.
- **Lossy in known ways.** Approvals lose session scope and deny reasons (or need conventions),
  `steer` is unavailable, and multiple approvals have to be asked one per turn. The projection
  states these losses where clients can see them (in `ignored_fields`, and with capabilities
  reported `false`).
- **Version tracking.** A projection pinned to one `UHP-Version` that refuses others is allowed by
  the spec (`unsupported_protocol_version`). Following new versions is optional work.
- **Conformance cost.** The suite runs real agent tasks and its Full class requires harness
  management. Claiming "conformant" at all needs the suite to pass, and the name is a HarnessRouter
  mark.

## Open questions

- Is a UHP projection wanted now? Who is the client: a product that already speaks UHP, or
  HarnessRouter's console?
- Should the projection represent approvals as `input_request` (UHP-native) or as Responses
  `mcp_approval_request` (what the OpenAI projection does)? Can one convention serve both?
- What does a native session do with new input while an approval is pending: void it (UHP),
  queue it, or refuse it? #79 does not say.
- Is an external UHP harness (HarnessRouter running Claude Code or Codex) wanted as an executor
  kind or a "remote agent" tool? If so, how is the trust boundary shown in modes, given that its
  tool calls cannot be gated?
- Does #83's long-term memory work want UHP Memories' tree-with-grants model (agents as members,
  prime/observe moments), or something smaller?
- Should the native API add per-turn step and time budgets with `incomplete` reasons, which UHP has
  and #83 lacks?

## Sources

- UHP site: https://unifiedharnessprotocol.org/ and chapters at
  https://unifiedharnessprotocol.org/spec/2026-10-19/{architecture,lifecycle,harnesses,plugins,environments,memories,tasks,streaming,sessions,files,errors,security,schema}
  (the site blocked automated fetches after the first page; content read from the repository
  sources below, from which the site is built)
- Repository at `188c888`: https://github.com/HarnessRouter/harnessrouter
  - `protocol/versions/2026-10-19/*.md`: the normative chapters
  - `protocol/schema/uhp-2026-10-19.openapi.yaml`, `uhp-2026-10-19.schema.json`
  - `protocol/VERSIONING.md`, `GOVERNANCE.md`, `CHANGELOG.md`, `IMPLEMENTATIONS.md`,
    `ECOSYSTEM.md`, `CONNECTING.md`, `SERVING.md`, `README.md`
  - `protocol/conformance/README.md` and `protocol/conformance/reports/*/*.json`
  - `gateway/app.py:12781` (`/v1/harnesses/{harness_id}/events`), `runner/qoder_driver.py`
- GitHub web pages: https://github.com/HarnessRouter/harnessrouter (stars, forks, commits),
  https://github.com/HarnessRouter/harnessrouter/issues/42,
  https://github.com/HarnessRouter/harnessrouter/issues?q=label%3Auep
- Web search, secondary: https://fondo.com/blog/harnessrouter-introduces-unified-harness-protoco-to-simplify-agent-integrations,
  https://themenonlab.blog/blog/harnessrouter-unified-harness-protocol,
  https://news.marketersmedia.com/harnessrouter-open-sources-the-worlds-first-unified-interface-for-agent-harnesses-and-the-unified-harness-protocol/89200657
- Native decisions: `statewalker/statewalker-root#83` (session API), #75 (terms), #79 (modes and
  approvals), #82 (definitions), #94 (executors); `docs/research/harness-session-apis.md`;
  `docs/research/external-wasmer-executor-pools.md`
