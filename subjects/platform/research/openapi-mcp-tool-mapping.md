# How are OpenAPI tool definitions generated and projected to MCP and Flue tools?

Research for `statewalker/statewalker-root#90`. Sources read on 2026-11-16. Statements marked
**(inference)** are this note's own reasoning, not a source's claim. `modelcontextprotocol.io`
did not resolve for the fetch tool from the research session but did for `curl`, so the MCP
pages were read as Markdown (`<page>.md`) with `curl`; the MCP schema was read from
`raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/<version>/schema.ts`.
The GitHub API was not reachable, so files read from GitHub are cited at `main` on the read date,
without a commit hash. Stainless's documentation pages now redirect to a "Stainless has joined
Anthropic" page; Stainless's generator could not be read from a primary source.

## Question

The harness describes every tool as one OpenAPI 3.1 document and derives from it (a) MCP
`tools/list` entries (name, title, description, inputSchema, outputSchema, annotations) and (b)
pi-agent-core / Flue `AgentTool` objects (name, label, description, parameters, outputSchema,
executionMode). It also ingests MCP servers' `tools/list` and must turn those into OpenAPI
documents. Which converters exist in each direction and how do they map operations, parameters,
bodies, responses and auth? Where do OpenAPI and MCP tool schemas not map one to one? What JSON
Schema subset do LLM providers accept for tool parameters? What is pi-agent-core's tool shape?

## Short answer

- **Every OpenAPI→MCP converter makes the same core move:** one operation becomes one tool; path,
  query, header (and sometimes cookie) parameters and the request body are **flattened into one
  `type: "object"` inputSchema**; the converter keeps a side table (`executionParameters`,
  `HTTPRoute`, `{ path, method, params, body, headers }`) to route each argument back to its HTTP
  location. They differ in where the body goes (merged flat in FastMCP, one `requestBody` property
  in openapi-mcp-generator, one `body` property in Cloudflare's connector), how name collisions
  are resolved, and whether `outputSchema` and annotations are derived (FastMCP and
  openapi-mcp-generator do; Cloudflare's connector does not).
- **Annotations come from the HTTP method** where they are derived at all (openapi-mcp-generator:
  GET/HEAD/OPTIONS read-only, PUT/DELETE idempotent, all open-world), overridable with a vendor
  extension (`x-mcp-annotations`, `x-speakeasy-mcp`). There is **no standard OpenAPI extension**
  for MCP annotations.
- **Large APIs are moving away from one-tool-per-operation:** Cloudflare (`openApiMcpServer`:
  `search` + `execute`), Speakeasy (`--mode dynamic`), ivo-toby's server (`--tools dynamic`) and
  mcp-openapi-proxy (simple mode) all offer a few meta-tools over the whole spec; FastMCP's own
  docs warn that curated servers beat auto-converted ones.
- **MCP→OpenAPI exists essentially as mcpo** (Open WebUI): every tool becomes `POST /{tool}` with
  the inputSchema rebuilt as a Pydantic model. It is lossy: composition, enums, formats and bounds
  are dropped, `structuredContent` and annotations are ignored, `isError` becomes HTTP 500.
- **The mismatches that matter:** HTTP locations vs one object; non-object, multipart and binary
  bodies; many responses and media types vs one `CallToolResult`; the OAS 3.1 dialect (2020-12
  plus `discriminator`, `xml`, `example`, `externalDocs`) vs MCP's plain 2020-12 default; MCP
  2026-07-28 loosened `inputSchema` (any 2020-12 keyword, root still `type: "object"`) and
  `outputSchema` / `structuredContent` (any JSON value), where 2025-11-25 restricted
  `outputSchema` to an object root; tool names (MCP: 1–128 of `[A-Za-z0-9_.-]`, SHOULD; OpenAI:
  `[A-Za-z0-9_-]{1,64}`; Anthropic: `^[a-zA-Z0-9_-]{1,128}$`); tasks moved out of the MCP core
  into an extension in 2026-07-28.
- **Provider strict modes are the tightest constraint:** OpenAI and Anthropic strict mode both
  require `additionalProperties: false` everywhere and (OpenAI) every property `required`; OpenAI
  rejects `allOf`/`not`/`if`, and Anthropic rejects recursion, `allOf` with `$ref`, and
  numeric/length bounds. pi-ai 1.4.0
  already rewrites schemas to that subset and falls back to non-strict when it cannot.
- **pi-agent-core's `AgentTool`** = pi-ai `Tool` (`name`, `description`, `parameters: TSchema`,
  `constrainedSampling?`) + `label`, `prepareArguments?`, `outputSchema?`, `execute`, `replay?`,
  `executionMode?`. A plain JSON Schema object works as `parameters` at runtime; validation is
  TypeBox `Compile` plus primitive coercion.
- **Recommendation (inference):** make the per-tool OpenAPI document a **constrained profile**:
  one operation, `POST`, one `application/json` object request body that *is* the tool's input
  schema, one `200` `application/json` response that *is* the output schema, plus `x-mcp-*`
  extensions for title, annotations and execution hints. Projection to MCP and `AgentTool` is
  then nearly lossless, and the general "any REST API" import becomes a separate, lossy adapter.

## Findings

### The two target shapes

**MCP `Tool` (2026-07-28).** `Tool extends BaseMetadata, Icons` with `description?`,
`inputSchema: { $schema?: string; type: "object"; [key: string]: unknown }`, `outputSchema?:
{ $schema?: string; [key: string]: unknown }`, `annotations?: ToolAnnotations`, `_meta?`. The
inputSchema comment: "Tool arguments are always JSON objects, so `type: "object"` is required at
the root. Beyond that, any JSON Schema 2020-12 keyword may appear alongside `type` — including
composition keywords (`oneOf`, `anyOf`, `allOf`, `not`), conditional keywords
(`if`/`then`/`else`), reference keywords (`$ref`, `$defs`, `$anchor`)…". It advises declaring
`properties` at the root and keeping composition branches to presence assertions. "Display name
precedence order is: `title`, `annotations.title`, then `name`." (`schema/2026-07-28/schema.ts`,
lines 1982–2036.)

**MCP `Tool` (2025-11-25)** is narrower: `inputSchema: { $schema?; type: "object"; properties?;
required? }`, `outputSchema` "Currently restricted to type: "object" at the root level", and an
`execution?: { taskSupport?: "forbidden" | "optional" | "required" }` field
(`schema/2025-11-25/schema.ts`, lines 1229–1300). The 2026-07-28 changelog: "Loosen `inputSchema`
and `outputSchema` to allow any JSON Schema 2020-12 keywords, and `structuredContent` to allow any
JSON value. Add `$ref` resolution requirements and composition-keyword resource bounds" (SEP-2106).

**`ToolAnnotations`** (both versions): `title?`, `readOnlyHint?` (default false),
`destructiveHint?` (default true, "meaningful only when `readOnlyHint == false`"),
`idempotentHint?` (default false, same caveat), `openWorldHint?` (default true)
(`schema/2026-07-28/schema.ts`, lines 1915–1958). "Clients **MUST** consider tool annotations to
be untrusted unless they come from trusted servers" (`server/tools.md`, 2026-07-28).

**`CallToolResult`:** `content: ContentBlock[]` (text, image, audio, resource link, embedded
resource), `structuredContent?: unknown` ("any JSON value … that conforms to the tool's
outputSchema if one is defined"), `isError?: boolean`; tool errors "SHOULD be reported inside the
result object, with `isError` set to true, _not_ as an MCP protocol-level error"
(`schema/2026-07-28/schema.ts`, lines 1812–1840, 2319–2320). "For backwards compatibility, a tool
that returns structured content SHOULD also return the serialized JSON in a TextContent block."
With an outputSchema, "Servers **MUST** provide structured results that conform to this schema.
Clients **SHOULD** validate" (`server/tools.md`). Every result now carries `resultType`
(`"complete"`, `"input_required"`; the tasks extension adds `"task"`) (changelog item 8).

**pi-ai `Tool`** (`@earendil-works/pi-ai@1.4.0`, `dist/types.d.ts` lines 528–533):

```ts
export interface Tool<TParameters extends TSchema = TSchema> {
    name: string;
    description: string;
    parameters: TParameters;
    constrainedSampling?: false | ConstrainedSamplingConfig;
}
```

`TSchema` is from `typebox` 1.3.27 (`types.d.ts` line 510; `package.json`).
`ConstrainedSamplingConfig` is `{ type: "json_schema"; strict: "prefer" | "require" }` or
`{ type: "grammar"; variants: GrammarVariants }` (lines 521–527).

**pi-agent-core `AgentTool`** (`@earendil-works/pi-agent-core@1.4.0`, `dist/types.d.ts`):
- `ToolExecutionMode = "sequential" | "parallel"` (line 26); "parallel": "tool calls are prepared
  sequentially, then allowed tools execute concurrently" (lines 20–25).
- `AgentToolResult<T>` (lines 370–393): `content: (TextContent | ImageContent)[]` ("returned to
  the model"), `details: T` (logs/UI), `structuredContent?: JsonValue` ("matching the tool's
  `outputSchema`, for programmatic callers. Not sent to the model"), `usage?`, `isError?` ("Report
  a failure without throwing"), `terminate?`.
- `AgentTool<TParameters, TDetails> extends Tool<TParameters>` (lines 409–437): `label: string`
  ("Human-readable label for UI display"), `prepareArguments?: (args: unknown) =>
  Static<TParameters>` ("compatibility shim for raw tool-call arguments before schema
  validation"), `outputSchema?: TSchema` ("Tools that declare it should always set
  `structuredContent`"), `execute(toolCallId, params, signal?, onUpdate?)`, `replay?: "never" |
  "safe"` ("Recovery policy for an effect whose durable intent exists but whose outcome is
  unknown"), `executionMode?: ToolExecutionMode`.
- Arguments are validated by pi-ai `validateToolArguments` (called from `agent-loop.js` line 498),
  which compiles `tool.parameters` with TypeBox `Compile` and first coerces primitives and
  optional nulls against the schema (`pi-ai/dist/utils/validation.js` lines 1–2, 42–204,
  237–290). The model-facing declaration is `{ name, description, parameters:
  JSON.parse(JSON.stringify(tool.parameters)), constrainedSampling? }`
  (`dist/utils/transcript.js` lines 106–113): plain JSON Schema survives, TypeBox symbols do not.

**Flue's tool shape** (`@flue/runtime@2.3.0`, `dist/types-B1PuLhZt.d.mts` lines 176–217):
`ToolDefinition` has `name`, `description`, `input` / `output` as **Valibot** schemas (converted
with `@valibot/to-json-schema`, `$schema` stripped: `dist/schema-DIDpvZZa.mjs` lines 23–31),
`harness?`, `durable?`, `timeoutMs?`, `annotations?: McpToolAnnotations` ("The runtime ignores the
field"), and `run(context)` returning `{ output, terminate? }` or a string. Flue builds pi
`AgentTool`s from these; `SandboxToolFactory` returns `AgentTool<any>[]` (line 1086).

**How Flue ingests MCP tools today** (`dist/mcp-CYraeuuF.mjs` lines 126–196): skips tools whose
`execution.taskSupport` is `"required"`; names them `mcp__<server>__<tool>` after replacing every
character outside `[A-Za-z0-9_-]` with `_` (dots included); folds `title` into the description;
copies `annotations`; passes `inputSchema` through with `type` defaulted to `"object"` and
`properties` to `{}`; **ignores `outputSchema`**; flattens the result to text (structured content
printed first as JSON, images and audio as placeholders like `[Image: image/png, N base64
chars]`); and throws on `isError`.

### OpenAPI→MCP converters

| Converter | Language | State (read date) | Shape |
|---|---|---|---|
| FastMCP `FastMCP.from_openapi` / `OpenAPIProvider` | Python | `fastmcp` 4.2.0, 2026-11-13 | Runtime proxy, tool per operation |
| openapi-mcp-generator | TypeScript | 5.0.1, 2026-10-24; MCP 2026-07-28 | Code generator + `getToolsFromOpenApi()` library |
| Speakeasy MCP generation | TypeScript | Commercial, docs current | Code generator from SDK |
| Cloudflare `@cloudflare/codemode` | TypeScript | 0.5.6, 2026-10-29 | Code Mode connector / `search`+`execute` MCP server |
| `@ivotoby/openapi-mcp-server` | TypeScript | 1.18.0, 2026-11-11 | Runtime proxy; `all` / `dynamic` / `explicit` |
| mcp-openapi-proxy | Python | 0.4.0, 2026-09-06; MCP 2026-07-28 | Runtime proxy; low-level or simple mode |
| `awslabs.openapi-mcp-server` | Python | 1.1.7, 2026-11-09 | Runtime proxy, tools + prompts |
| Stainless | — | Docs unavailable | Not read |

Versions and dates are from `registry.npmjs.org` and `pypi.org`.

**FastMCP** (https://gofastmcp.com/docs/integrations/openapi.md and the
`fastmcp-utilities-openapi-*` SDK reference pages):
- Every route becomes a Tool by default; ordered `RouteMap`s (methods, path regex, tags) can map
  routes to `RESOURCE`, `RESOURCE_TEMPLATE` or `EXCLUDE`; before 2.8.0 GETs became resources, which
  "was changed solely for client compatibility reasons".
- Names: `operationId` up to the first `__`, else summary, else method and path; slugified,
  **truncated to 56 characters**, de-duplicated with a number; `mcp_names` overrides.
- Inputs: one flat argument set. "A request body becomes a flat set of tool arguments, which is
  the shape LLM tool-calling APIs fill in most reliably." `allOf` is resolved following `$ref`;
  `discriminator` unions are flattened, merging all variant fields as optional, keeping the
  discriminator required, combining conflicting declarations with `anyOf`. A non-object body is
  one argument named after the schema `title` (else `body`); if it collides with a parameter, the
  parameter gets a location suffix (`values__query`). Unknown arguments are dropped with a
  warning, or rejected in strict validation mode.
- Serialisation: query arrays follow `style`/`explode`; path values reject `.`/`..`; multipart
  string arrays become repeated fields, other arrays a Python list string.
- Schemas: `convert_openapi_schema_to_json_schema` removes OpenAPI-specific fields, converts 3.0
  `nullable`, converts `oneOf` to `anyOf` by default, optionally removes `readOnly`/`writeOnly`
  properties.
- Outputs: `extract_output_schema_from_responses` takes "the first successful response (200, 201,
  202, 204) with a JSON-compatible content type"; non-object schemas are wrapped "to comply with
  MCP requirements"; no outputSchema when any success response has no body.
- Errors: non-2xx becomes a tool error with status and reason; 429 keeps a rate-limit message.
- Auth: configured on the `httpx2.AsyncClient`, not from `securitySchemes`; incoming MCP headers
  are forwarded except `Authorization`, `Cookie`, `Host`.
- The docs warn: "LLMs achieve **significantly better performance** with well-designed and curated
  MCP servers than with auto-converted OpenAPI servers."

**openapi-mcp-generator** (https://github.com/harsha-iiiv/openapi-mcp-generator, `README.md` and
`src/parser/extract-tools.ts` at `main`):
- OpenAPI 3.0/3.1 only (Swagger 2.0 refused); targets stdio, SSE, Streamable HTTP, Cloudflare
  Worker; 5.0 moved to MCP TypeScript SDK v2 and stateless HTTP.
- `getToolsFromOpenApi(spec, options)` returns `McpToolDefinition { name, title?, description,
  inputSchema, method, pathTemplate, parameters, executionParameters: { name, in }[],
  requestBodyContentType?, serverUrl?, baseUrl?, securityRequirements, operationId, tags?,
  deprecated?, annotations?, outputSchema? }`: the closest existing model of "MCP tool plus HTTP
  binding".
- Inputs: each parameter becomes `properties[param.name]` and the body becomes **one property
  named `requestBody`**: the JSON schema for `application/json`, otherwise `{ type: "string" }`
  for the first other media type (`extract-tools.ts` lines 440–500). Parameters are keyed by
  `name` only, so a header and a query parameter with the same name land on one key
  **(inference from those lines)**.
- Schemas: JSON Schema 2020-12; `integer`, `format`, `pattern`, enums and `allOf`/`anyOf`/`oneOf`
  kept; `nullable` → `null` type; `example` → `examples`; `readOnly` properties removed from
  inputs; defaults not injected. External `$ref`s are refused unless `--allow-external-refs`
  (SSRF); `dereference: true` resolves local ones.
- Names: `--max-tool-name-length` default 64 ("Claude Desktop caps at 64"), truncated with a hash
  suffix; collisions resolved deterministically with a content hash.
- Annotations: "`GET`/`HEAD`/`OPTIONS` are read-only; `POST` is not destructive and not
  idempotent; `PUT` and `DELETE` are destructive and idempotent; `PATCH` is destructive and not
  idempotent; all are open-world", overridable with `x-mcp-annotations`; title from `x-mcp-title`,
  else `summary`. Operation inclusion via `x-mcp: true|false` at root, path or operation level.
- Outputs: object JSON responses are returned as `structuredContent`; `--output-schema` declares
  the lowest 2xx `application/json` object schema (`writeOnly` removed) and validates responses.
- Auth: API key, bearer, basic, OAuth2 (client credentials) from `securitySchemes`, credentials
  from environment variables, failing closed when missing; optional inbound bearer auth and header
  passthrough.

**Speakeasy** (https://www.speakeasy.com/docs/standalone-mcp/customize-tools.md,
https://www.speakeasy.com/docs/agent-tools/build-server.md): a TypeScript MCP server generated
beside the SDK. The `x-speakeasy-mcp` operation extension carries `disabled`, `name`, `title`,
`scopes`, `description` and all four hint annotations with MCP's defaults; overlays add it in bulk
(for example `scopes: [read]` on `get`, `head`, `query`). Scopes and `--tool` filter mounted tools
at start; `--mode dynamic` exposes meta-tools ending in `execute_tool`. Responses pass through raw
by default (`validateResponse: false`), binary base64-encoded.

**Cloudflare** (https://developers.cloudflare.com/agents/tools/codemode/openapi/index.md, updated
2026-10-27; https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/index.md):
two OpenAPI paths, neither one-tool-per-operation. `OpenApiConnector` derives one sandbox method
per operation for model-written code: "Path, query, and header parameters appear as top-level
fields. A JSON request body appears under `body`. … Local `$ref` values in input schemas are
resolved", the request reaches the host as `{ path, method, params, body, headers }`, and "The
current connector derives input types but does not derive response types". Auth stays in the
host's `request()`. `openApiMcpServer()` publishes a whole spec to MCP clients as two tools,
`search` (code over the spec) and `execute` (code with an authenticated request function); the
Cloudflare API MCP server uses this pattern. Both currently return an SDK v1 server.

**Others.** `@ivotoby/openapi-mcp-server` (README at `main`): `TOOLS_MODE` `all`, `dynamic`
(`list-api-endpoints`, `get-api-endpoint-schema`, `invoke-api-endpoint`) or `explicit`; abbreviates
names over 64 characters unless `DISABLE_ABBREVIATION`; auth by static headers or an
`AuthProvider`. mcp-openapi-proxy (PyPI description): low-level mode registers a tool per endpoint
(`/chat/completions` → `chat_completions`), simple mode exposes `list_functions` /
`call_function`; auth by `API_KEY` with configurable scheme and header, or JMESPath into the
payload (Slack); its changelog records fixing "Array parameters were emitted without `items`,
which the OpenAI API rejects" and name truncation that "silently dropped tools".
`awslabs.openapi-mcp-server` (PyPI description) maps GETs with query parameters to tools,
appends response codes and examples to descriptions, generates prompts, and supports basic,
bearer, API key and Cognito auth.

### MCP→OpenAPI: mcpo

mcpo 0.0.20 (2026-02-27, PyPI; https://github.com/open-webui/mcpo at `main`) is a FastAPI proxy
in front of a stdio, SSE or Streamable HTTP MCP server, auto-generating OpenAPI docs at `/docs`.
- Each tool becomes `app.post(f"/{endpoint_name}", summary=…, description=tool.description)`
  (`src/mcpo/main.py` lines 528–571): one `POST` per tool, path = tool name, no tags, no
  `operationId` choice.
- The inputSchema's `properties`, `required` and `$defs` are rebuilt as a Pydantic model
  (`get_model_fields`); outputSchema, when present, becomes the response model.
- The schema walker (`src/mcpo/utils/main.py` lines 91–245) handles `$ref` into `$defs`, `anyOf`,
  and the basic types; it does not carry `enum`, `format`, `pattern`, numeric bounds, `oneOf`,
  `allOf` or conditionals **(inference from those lines)**. Property names starting with `_` are
  aliased.
- Results: `content` text blocks are JSON-parsed when possible, images become `data:` URIs,
  embedded resources the string "Embedded resource not supported yet."; one item is returned bare,
  several as an array (`utils/main.py` lines 44–62). `structuredContent` and annotations are
  not used; `isError` becomes `HTTPException(500)` with the first text block as message (lines
  354–364).
- Auth: one `--api-key` bearer for the proxy; optional header forwarding into the MCP call.

No other maintained MCP→OpenAPI converter was found in primary sources in this session.

### Where OpenAPI and MCP do not map one to one

**Parameter locations vs one object.** OpenAPI 3.1 parameters live `in` `path`, `query`,
`header` or `cookie`; 3.2 (19 September 2025) adds `querystring` and the `QUERY` method
(https://spec.openapis.org/oas/v3.2.0.html). An MCP inputSchema is one object. Converters flatten
and keep a routing table; names can collide across locations (FastMCP suffixes `__query`,
openapi-mcp-generator overwrites) and against the body. `style`/`explode`/`allowReserved`
serialisation has no MCP equivalent. MCP's only HTTP-ward hint is the 2026-07-28 `x-mcp-header`
property annotation, which mirrors a primitive argument into an `Mcp-Param-{name}` header for
intermediaries; it is not an HTTP binding and "Server developers **SHOULD NOT** mark sensitive
parameters" with it (`server/tools.md`).

**Request bodies.** An OpenAPI body is a map of media types, each with any schema (array, string,
binary); MCP arguments are always an object. Non-object bodies must be wrapped in a named property
(FastMCP: title or `body`; openapi-mcp-generator: `requestBody`; Cloudflare: `body`); several media
types collapse to one (openapi-mcp-generator prefers `application/json`, else the first, as a
string). `multipart/form-data` and binary uploads have no MCP argument form: arguments are JSON, so
files travel as base64 strings or URIs **(inference)**; FastMCP serialises multipart fields but
documents caveats for arrays.

**Responses.** OpenAPI has many status codes, each with headers and media types; MCP has one
`CallToolResult` with `content[]`, optional `structuredContent` and `isError`. Converters pick the
first or lowest 2xx JSON schema as outputSchema (FastMCP, openapi-mcp-generator), map non-2xx to
`isError: true` with the status in text, and lose response headers. Under 2025-11-25 a non-object
2xx schema cannot be an outputSchema and is wrapped (FastMCP); 2026-07-28 allows any JSON value.
Binary and image responses map to `ImageContent` / `AudioContent` / embedded resources only by
converter convention.

**Schema dialect.** MCP: "When a schema does not include a `$schema` field, it defaults to JSON
Schema 2020-12"; implementations "MUST support at least 2020-12"; "MUST NOT automatically
dereference `$ref` values that resolve to a network URI"; and SHOULD bound composition depth and
subschema counts (`basic.md`, 2026-07-28; the dialect rules are identical in 2025-11-25). OpenAPI
3.1 Schema Objects default to the **OAS dialect** (2020-12 plus the OAS base vocabulary:
`discriminator`, `xml`, `externalDocs`, `example`; `description` may be CommonMark); a document can
change the default with `jsonSchemaDialect`, and the OAS vocabulary is declared with `$vocabulary`
false, so plain 2020-12 validators "MAY choose to treat" those keywords as unknown
(https://spec.openapis.org/oas/v3.1.1.html). References in an OpenAPI document point at
`#/components/schemas/…`, which do not resolve inside an extracted tool schema; converters
dereference (openapi-mcp-generator, Cloudflare) or move them under `$defs` (FastMCP, mcpo)
**(inference for the general rule)**. Recursive schemas are legal on both sides but fail
Anthropic strict mode (below).

**Tool names.** MCP: "SHOULD be between 1 and 128 characters", case-sensitive, characters
`A-Z a-z 0-9 _ - .`, unique within a server; aggregators "SHOULD implement a disambiguation
strategy such as prefixing tool names with a server identifier" (`server/tools.md`, 2026-07-28 and
2025-11-25). OpenAPI `operationId` is any case-sensitive string unique in the document. Provider
limits are stricter than MCP: OpenAI "a-z, A-Z, 0-9, or contain underscores and dashes, with a
maximum length of 64"; Anthropic `^[a-zA-Z0-9_-]{1,128}$`; Gemini function declarations allow
underscores, colons, dots and dashes up to 128. A dot, legal in MCP, is illegal for OpenAI and
Anthropic, which is why Flue rewrites dots to `_`.

**Annotations vs methods.** MCP hints are advisory and untrusted. HTTP's own semantics are a
partial source: "the GET, HEAD, OPTIONS, and TRACE methods are defined to be safe" and "PUT,
DELETE, and safe request methods" are idempotent (RFC 9110 §9.2.1–9.2.2,
https://www.rfc-editor.org/rfc/rfc9110). "Destructive" and "open world" have no HTTP equivalent;
openapi-mcp-generator and Speakeasy fill them with defaults or vendor extensions. OpenAPI has no
standard extension for any of the four hints.

**Auth.** OpenAPI declares `securitySchemes` (apiKey, http, mutualTLS, oauth2, openIdConnect) and
per-operation `security` requirements. MCP tools carry no auth metadata: authorization is per
server, OAuth 2.1 with Protected Resource Metadata (RFC 9728) on HTTP transports
(`basic/authorization.md`, 2026-07-28). Every converter therefore keeps upstream credentials on
the host (environment variables, an HTTP client, a `request()` function) and drops them from the
tool description.

**Long-running work and streaming.** MCP 2025-11-25 had per-tool `execution.taskSupport`; in
2026-07-28 tasks moved to the `io.modelcontextprotocol/tasks` extension, where a server may answer
`tools/call` with `CreateTaskResult` (`resultType: "task"`) and the client polls `tasks/get`, with
"No per-tool warmup or per-request flag" (changelog item 6;
https://modelcontextprotocol.io/extensions/tasks/overview.md). Progress is
`notifications/progress` keyed by the request's `progressToken`, on that request's response
stream. OpenAPI expresses asynchrony as `callbacks`, `webhooks`, `202` + polling conventions, and
since 3.2 streaming media types (`text/event-stream`, JSON Lines) with `itemSchema` applied "to
each item in the stream independently". None of these maps directly onto MCP tasks or progress;
pi-agent-core's equivalent is the `onUpdate` partial-result callback.

### What LLM providers accept for tool parameters

**OpenAI** (https://developers.openai.com/api/docs/guides/structured-outputs.md,
https://developers.openai.com/api/docs/guides/function-calling.md):
- Strict mode requires `additionalProperties: false` on every object and every property in
  `required` (optional = union with `null`). Responses requests without `strict` "attempt to
  normalize your schema into strict mode when possible, and will fall back to non-strict";
  Chat Completions stays non-strict by default.
- Supported: string, number, boolean, integer, object, array, enum, `anyOf`; string `pattern` and
  `format` (`date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`);
  number `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`; array
  `minItems`, `maxItems`; definitions and recursion (`#`) supported.
- Not supported: `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`/`then`/`else`;
  fine-tuned models also lose the string, number, object and array keywords above. "The root level
  object of a schema must be an object, and not use `anyOf`."
- Limits: 5000 object properties, 10 levels of nesting, 120,000 characters of names and enum
  values, 1000 enum values.

**Anthropic** (https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md, "JSON
Schema limitations" and "Schema complexity limits"; strict tool use shares them):
- Supported: basic types, `enum` of scalars, `const`, `anyOf`, `allOf` (not with `$ref`), local
  `$ref` / `$defs` / `definitions`, `default`, `required`, `additionalProperties: false` only, ten
  string formats, `minItems` 0 or 1, simple regex.
- Not supported: recursive schemas, external `$ref`, `minimum`/`maximum`/`multipleOf`,
  `minLength`/`maxLength`, other array bounds, regex backreferences and lookaround.
- Per request: at most 20 strict tools, 24 optional parameters and 16 union-typed parameters
  across all strict schemas, plus internal grammar-size limits ("Schema is too complex for
  compilation").
- Non-strict tools take any JSON Schema `input_schema` (`define-tools.md`).

**Gemini** (https://ai.google.dev/api/caching.md.txt, `FunctionDeclaration`;
https://ai.google.dev/gemini-api/docs/structured-output.md.txt;
https://ai.google.dev/gemini-api/docs/function-calling.md.txt): `parameters` is the legacy
"Open API 3.03" Schema subset; `parametersJsonSchema` takes JSON Schema ("must describe an
object"), mutually exclusive with it. The structured-output subset lists object, array, string,
number, integer, boolean, null, `enum`, `format`, `minimum`/`maximum`, `items`, `prefixItems`,
`minItems`/`maxItems`, `additionalProperties`; `minLength`, `maxLength`, `minProperties`,
`maxProperties`, `uniqueItems`, `contains` "are not enforced … and are ignored". Function calling
in `any` mode compiles declarations into a state machine and rejects over-complex schemas with
`400 INVALID_ARGUMENT`; the docs advise flattening, bounding recursion, and fewer optional fields,
enums and unions.

**What pi-ai 1.4.0 does with this** (`dist/api/constrained-sampling.js`): when a tool sets
`constrainedSampling: { type: "json_schema" }`, `makeStrictJsonSchema` rejects `$ref`, `$defs`,
`definitions`, `allOf`, `oneOf`, `patternProperties`, `dependentSchemas`, `unevaluatedProperties`,
`propertyNames`, `contains`, `prefixItems`, `not`, `if`/`then`/`else`, tuples, object/array
unions and non-false `additionalProperties` (lines 3–20, 42–83), then makes every property
required, wraps optional ones as `anyOf [prop, null]`, and sets `additionalProperties: false`
(lines 96–104). `"prefer"` falls back to non-strict; `"require"` throws. The Anthropic adapter
also rejects numeric bounds, `maxItems`, `uniqueItems`, `minItems` other than 0/1 and unlisted
formats (`anthropic-messages.js` lines 1262–1297), and downgrades preferred-strict tools after
"Too many strict tools" or grammar-size 400s (lines 450–471). The Google adapter sends
`parametersJsonSchema` as is, or strips `$schema`, `$id`, `$defs`, `definitions` and similar for
the legacy `parameters` field (`google-shared.js` lines 302–350).

### A mapping profile the harness could use (inference)

- **OpenAPI → MCP / `AgentTool`**, with the per-tool document restricted to one `POST` operation
  whose `application/json` request body is the input object and whose `200` `application/json`
  response is the output:
  - `operationId` → `name`, checked against `[A-Za-z0-9_-]{1,64}`, the intersection of OpenAI,
    Anthropic and MCP;
  - `summary` → `title` / `label`;
  - `description` → `description`;
  - request body schema → `inputSchema` / `parameters`;
  - 200 schema → `outputSchema`;
  - `x-mcp-annotations` (or method-derived defaults) → `annotations`;
  - an extension such as `x-agent-execution: { mode, replay }` → `executionMode` and `replay`.
  - Before projection, set `jsonSchemaDialect` to 2020-12 or strip `discriminator`, `xml` and
    `example`, and inline or move `components` refs into `$defs`.
- **MCP → OpenAPI:** one `POST /{name}` per tool, the inputSchema verbatim as the request body,
  the outputSchema (or a `CallToolResult` schema when absent) as the 200 response, a fixed error
  schema for `isError`, annotations and `_meta` under `x-mcp-*` extensions, `title` → `summary`.
  Keep the schema verbatim instead of rebuilding it (mcpo's Pydantic round trip loses keywords),
  keep `structuredContent`, and decide whether `isError` is an HTTP error or a 200 with a flag.
- **Provider strictness** stays a projection-time concern: keep the canonical schema expressive and
  let pi-ai's `constrainedSampling: "prefer"` downgrade per provider, rather than forcing every
  tool into the strict subset.

## Open questions

- Should canonical tool documents follow MCP 2026-07-28 (any JSON `structuredContent`) while
  connected MCP servers and clients still speak 2025-11-25 (object-only `outputSchema`)? A
  2025-11-25 projection would need FastMCP-style wrapping of non-object outputs.
- Does TypeBox 1.3 `Compile` (pi-ai's validator) support the full 2020-12 keyword set a canonical
  schema may use (`$dynamicRef`, `unevaluatedProperties`, `$anchor`)? Not checked in this session.
- Is there, or will there be, a standard OpenAPI extension for MCP annotations? None was found;
  `x-mcp-annotations` (openapi-mcp-generator) and `x-speakeasy-mcp` are vendor-specific.
- How should MCP tasks (extension) and pi-agent-core's `onUpdate` partial results be expressed in
  the OpenAPI document: an `x-` extension, a `202` + polling convention, or a 3.2
  `text/event-stream` response with `itemSchema`?
- Stainless's MCP generator could not be read (its docs redirect after the Anthropic acquisition);
  its current mapping is unknown.
- Flue's MCP connector drops `outputSchema` and flattens results to text; ingesting MCP tools
  through the harness's own adapter instead would keep `structuredContent` for programmatic
  callers.

## Sources

- MCP specification:
  https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md,
  https://modelcontextprotocol.io/specification/2026-07-28/basic.md,
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization.md,
  https://modelcontextprotocol.io/specification/2026-07-28/changelog.md,
  https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md,
  https://modelcontextprotocol.io/specification/2025-11-25/basic.md,
  https://modelcontextprotocol.io/extensions/tasks/overview.md
- MCP schema: https://github.com/modelcontextprotocol/modelcontextprotocol (`main`:
  `schema/2026-07-28/schema.ts`, `schema/2025-11-25/schema.ts`)
- OpenAPI: https://spec.openapis.org/oas/v3.1.1.html, https://spec.openapis.org/oas/v3.2.0.html
- HTTP semantics: https://www.rfc-editor.org/rfc/rfc9110 (§9.2.1, §9.2.2)
- FastMCP: https://gofastmcp.com/docs/integrations/openapi.md,
  https://gofastmcp.com/docs/python-sdk/fastmcp-utilities-openapi-schemas.md,
  https://gofastmcp.com/docs/python-sdk/fastmcp-utilities-openapi-json_schema_converter.md
- openapi-mcp-generator: https://github.com/harsha-iiiv/openapi-mcp-generator (`main`:
  `README.md`, `src/parser/extract-tools.ts`)
- Speakeasy: https://www.speakeasy.com/docs/standalone-mcp/customize-tools.md,
  https://www.speakeasy.com/docs/agent-tools/build-server.md
- Cloudflare: https://developers.cloudflare.com/agents/tools/codemode/openapi/index.md,
  https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/index.md
- ivo-toby: https://github.com/ivo-toby/mcp-openapi-server (`main`: `README.md`)
- mcp-openapi-proxy, awslabs.openapi-mcp-server, mcpo: project descriptions at
  https://pypi.org/pypi/mcp-openapi-proxy/json, https://pypi.org/pypi/awslabs.openapi-mcp-server/json,
  https://pypi.org/pypi/mcpo/json
- mcpo source: https://github.com/open-webui/mcpo (`main`: `src/mcpo/main.py`,
  `src/mcpo/utils/main.py`)
- OpenAI: https://developers.openai.com/api/docs/guides/structured-outputs.md,
  https://developers.openai.com/api/docs/guides/function-calling.md,
  https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create.md
- Anthropic: https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md,
  https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools.md
- Gemini: https://ai.google.dev/api/caching.md.txt,
  https://ai.google.dev/gemini-api/docs/structured-output.md.txt,
  https://ai.google.dev/gemini-api/docs/function-calling.md.txt
- Package versions: registry.npmjs.org (`openapi-mcp-generator`, `@ivotoby/openapi-mcp-server`,
  `@cloudflare/codemode`, `@modelcontextprotocol/sdk`), pypi.org (`fastmcp`, `mcpo`,
  `mcp-openapi-proxy`, `awslabs.openapi-mcp-server`)
- Installed packages in `statewalker-sandbox/node_modules/.pnpm`:
  `@earendil-works/pi-agent-core@1.4.0` (`dist/types.d.ts`, `dist/agent-loop.js`),
  `@earendil-works/pi-ai@1.4.0` (`dist/types.d.ts`, `dist/utils/validation.js`,
  `dist/utils/transcript.js`, `dist/api/constrained-sampling.js`,
  `dist/api/anthropic-messages.js`, `dist/api/google-shared.js`), `@flue/runtime@2.3.0`
  (`dist/types-B1PuLhZt.d.mts`, `dist/mcp-CYraeuuF.mjs`, `dist/schema-DIDpvZZa.mjs`)
