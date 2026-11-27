# How do agent harnesses keep memory across sessions?

Research for `statewalker/statewalker-root#156` (map: `statewalker/statewalker-root#70`). Sources
read on 2026-11-18. Statements marked **(inference)** are this note's own reasoning, not a source's
claim.

Network limits shaped the sources. `developers.openai.com`, `help.openai.com` and `docs.letta.com`
did not resolve from the research session. So:

- OpenAI's API guides were read from copies saved on 2026-11-15 for
  `subjects/ai-harness/research/harness-session-apis.md`.
- ChatGPT memory comes only from search-result summaries of OpenAI's Help Center. It is marked
  **(unverified)** and should be checked against the live article.
- Letta was read from its source repositories.

Repositories were cloned at these commits:

| Short name | Repository | Commit |
|---|---|---|
| `LC` | `github.com/letta-ai/letta-code` (current Letta) | `7cd55dc` (2026-11-18) |
| `LV1` | `github.com/letta-ai/letta`, branch `archive` (retired V1 server) | `56ba9c2` (2026-08-13) |
| `OAS` | `github.com/openai/openai-agents-python` | `e7ce15a` (2026-11-18) |
| `LGD` | `github.com/langchain-ai/docs` | `3f6f633` (2026-11-18) |
| `LG` | `github.com/langchain-ai/langgraph` | `84ced60` (2026-11-18) |
| `M0` | `github.com/mem0ai/mem0` | `fff8a64` (2026-11-18) |
| `VAI` | `github.com/vercel/ai` | `486e08f` (2026-11-17) |
| `HR` | `github.com/HarnessRouter/harnessrouter` | `8c186e2` (2026-11-17) |

In `HR`, `UHPM` is the memories chapter, `HR/protocol/versions/2026-10-19/memories.md`.

## Question

How do agent harnesses and standards give an agent memory that outlives one session? For each
system:

- **scope**: user, project, agent or workspace;
- **shape**: files, key/value, vectors or summaries;
- **writer**: the agent through a tool, the harness after a turn, or the user;
- **read-back**: how the memory gets back into context;
- **edit and forget**: how it is changed or removed.

Then: which of these models fit a file-view-first harness, with memory as files behind the
capability, and which need a database or an index (`statewalker/statewalker-root#81`)?

## Short answer

- **The field converged on "memory is a folder of Markdown files with an index".** Six of the
  surveyed systems work this way, five of them shipped in the last year:
  - Claude Code's auto memory: `MEMORY.md` plus topic files;
  - Claude Code's subagent memory;
  - Anthropic's memory tool, a `/memories` directory;
  - current Letta's MemFS, a git repository of Markdown files projected onto disk;
  - OpenAI's Agents SDK sandbox memory: `memories/MEMORY.md`, `memory_summary.md` and rollout
    summaries;
  - LangChain Deep Agents: `/memories/AGENTS.md`, served from a backend.

  Each one reads a **small, size-capped index or summary into the prompt at session start**.
  The agent then opens the details **on demand with ordinary file tools** (read, grep, edit).
- **Instructions written by people stay separate from what the agent learns.** `CLAUDE.md` and
  `AGENTS.md` are written by the user and loaded whole, by directory. Auto memory, MemFS core
  files and Deep Agents memory files are written by the agent. Letta and Deep Agents also treat
  **skills as procedural memory** in the same tree.
- **Two writing styles, often combined.** In the *hot path*, the agent writes during the turn
  through a tool. In the *background*, a harness job or reflection subagent reads transcripts
  after a session and consolidates them into the files. The background writers are:
  - Letta's reflection subagent;
  - the OpenAI sandbox's two-phase generation when the sandbox session closes;
  - the Deep Agents consolidation agent on a cron schedule;
  - Mem0's extraction on `add`;
  - UHP's `observe` and `consolidate`.
- **Search over past conversations (episodic recall) is the part that needs an index.** Letta's
  recall memory uses hybrid vector and full-text search. Mem0 keeps SQL plus vectors plus
  entities. LangGraph's Store has semantic search. UHP's `recall` searches a whole subtree, adds
  a graph and `as_of` history. ChatGPT's "reference chat history" works the same way
  **(inference)**. None of these is a file model.
- **OpenAI has no memory primitive in its API.** The Conversations API is durable *history*, not
  memory: items persist with no 30-day TTL. ChatGPT's memory is a product feature with no API.
- **UHP is the only standard that specifies memory.** It defines:
  - a tree of memories holding versioned records;
  - grants (`read`, `write`, `create`, `delete`) that inherit down the tree, with a
    `restricted` cutoff;
  - four session moments: **Prime, Tools, Observe, Consolidate**;
  - `forget` (keeps a trace) versus `erase` (a person's act, never a tool);
  - recalled content always `untrusted`.

  It allows "a folder of files" as a provider, but most of its operations assume an index.
- **Recommendation (inference):** follow the file model for the core: per-project and per-user
  memory folders, an index file primed into the prompt with a byte budget, and edits through the
  normal file tools behind the capability. Add **transcript search as a separate, index-backed
  tool**, built on a tool-private database (#81) and statewalker-search. Keep UHP Memories as a
  later projection. Details are in the last section.

## Findings

### Claude Code: `CLAUDE.md` and auto memory

Source: https://code.claude.com/docs/en/memory, read 2026-11-18, unless noted.

**Two systems.** "CLAUDE.md files: instructions you write … Auto memory: notes Claude writes
itself." The documentation's comparison table:

| | CLAUDE.md | Auto memory |
|---|---|---|
| Written by | "You" | "Claude" |
| Scope | "Project, user, or org" | "Per repository, shared across worktrees" |
| Loaded | "Every session" | "Every session (first 200 lines or 25KB)" |

Both "are loaded at the start of every conversation. Claude treats them as context, not enforced
configuration".

**CLAUDE.md scopes and loading.**
- Locations:
  - managed policy: `/etc/claude-code/CLAUDE.md` on Linux, which cannot be excluded;
  - user: `~/.claude/CLAUDE.md`;
  - project: `./CLAUDE.md` or `./.claude/CLAUDE.md`;
  - local: `./CLAUDE.local.md`, gitignored;
  - rules: `.claude/rules/*.md`, optionally scoped by `paths:` globs.
- Files in the directories above the working directory "are loaded at launch". Files in
  subdirectories "load on demand", once Claude reads or edits a file there.
- "All discovered files are concatenated into context rather than overriding each other," ordered
  from the filesystem root down.
- `@path` imports are expanded up to four hops deep. An import that points outside the project
  needs one-time approval.
- `AGENTS.md` is read when no `CLAUDE.md` is present.
- Files over 4 MiB are skipped. The documentation advises staying under 200 lines.

**Auto memory: shape and place.**
- Notes have four `type`s in their frontmatter: `user`, `feedback`, `project` and `reference`.
  Claude "skips anything it can derive from the codebase".
- They are stored in `~/.claude/projects/<project>/memory/`. The project is derived from the git
  repository, so worktrees share one directory. `autoMemoryDirectory` moves it.
- The directory holds "a `MEMORY.md` index and one topic file per memory". `MEMORY.md` has one
  line per memory and is "loaded into every session".
- "Auto memory is machine-local … Files are not shared across machines or cloud environments."

**Auto memory: read and write.**
- "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded."
- Topic files are not loaded at startup: "Claude reads them on demand using its standard file
  tools."
- When `MEMORY.md` nears a limit, the harness reminds Claude to shorten it. Over a limit, it
  returns an error telling Claude to rewrite the index.
- The harness stamps a `modified` ISO 8601 timestamp into the frontmatter on every write.
- The writer is Claude, during the session. Asking it to "remember …" goes to auto memory, and
  asking it to "add this to CLAUDE.md" goes to CLAUDE.md.

**Edit and forget.**
- "Plain markdown you can edit or delete at any time"; `/memory` opens the files.
- The memory files are excluded from the transcript-retention sweep. They "stay until you or
  Claude edits or deletes them".
- Auto memory is turned off with `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.

**Subagent memory** (https://code.claude.com/docs/en/sub-agents).
- The `memory` frontmatter field takes `user`, `project` or `local`. The directories are
  `~/.claude/agent-memory/<agent>/`, `.claude/agent-memory/<agent>/` (shareable through version
  control) and `.claude/agent-memory-local/<agent>/`.
- The subagent's prompt includes the first 200 lines or 25 KB of that directory's `MEMORY.md`.
  "Read, Write, and Edit tools are automatically enabled."
- The main conversation's auto memory "isn't loaded into subagents"
  (https://code.claude.com/docs/en/memory).

### Anthropic memory tool (Messages API)

Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool.

- **Client-side file operations.** The tool is configured as
  `{"type": "memory_20250818", "name": "memory"}`. "Claude requests file operations, and your
  application runs them." `/memories` "is a prefix that your handler maps onto real storage, such
  as a per-user directory or keys in a database."
- **Commands:** `view` (a directory two levels deep, or a file with line numbers and an optional
  `view_range`), `create`, `str_replace`, `insert`, `delete` and `rename`. The memory root itself
  cannot be deleted or renamed.
- **Read-back is a prompt the API adds itself:** "IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY
  BEFORE DOING ANYTHING ELSE … ASSUME INTERRUPTION: Your context window might be reset at any
  moment." Nothing is primed automatically; the agent lists and reads the directory.
- **Forgetting is the application's job:** "Periodically delete memory files that haven't been
  accessed in a long time". The documentation also recommends capping file sizes.
- **Security:** the handler "must validate every path in every command to prevent directory
  traversal attacks". The tool "pairs with" compaction and context editing.
- The Vercel AI SDK exposes it as `anthropic.tools.memory_20250818({ execute })`
  (`VAI/content/docs/03-agents/06-memory.mdx`).

### OpenAI: ChatGPT memory, the Conversations API and the Agents SDK

**ChatGPT memory (unverified, from search-result summaries of help.openai.com article 8590148).**
- There are two kinds:
  - "saved memories": details the user asked ChatGPT to remember, as a list the user can delete
    item by item or turn off;
  - "reference chat history": relevant information from past chats, used to personalize answers.
- Newer versions of the article describe a continually updated summary.
- Deleting a chat does not delete a saved memory taken from it.
- "Project-only memory" stops chats inside and outside a project from referencing each other.
- Temporary chats neither use nor create memories.
- LangChain's memory guide says "ChatGPT uses a save_memories tool to upsert memories as content
  strings" (`LGD/src/oss/concepts/memory.mdx`).
- None of this is exposed in the API **(inference: OpenAI's API documentation index, saved
  2026-11-15, has no memory resource)**.

**Conversations API: durable history, not memory.**
- It persists "conversation state as a long-running object with its own durable identifier. …
  you can keep using it across sessions, devices, or jobs".
- "Conversation objects and items in them are not subject to the 30 day TTL." Response objects
  are kept 30 days by default.
- Compaction is a separate feature: `context_management` / `compact_threshold`, or
  `/responses/compact`.
- Source: `developers.openai.com/api/docs/guides/conversation-state.md`, saved 2026-11-15. It
  also appears in `subjects/ai-harness/research/harness-session-apis.md`.

**Agents SDK sessions** (`OAS/docs/sessions/index.md`, `OAS/src/agents/memory/session.py`).
- "Built-in session memory to automatically maintain conversation history across multiple agent
  runs."
- `Session` is a protocol with four methods: `get_items`, `add_items`, `pop_item` and
  `clear_session`.
- "Before each run" the runner prepends the stored history. "After each run" it stores all new
  items.
- The backends are `SQLiteSession`, `SQLAlchemySession`, `OpenAIConversationsSession`,
  `AdvancedSQLiteSession`, `EncryptedSession` (TTL) and `OpenAIResponsesCompactionSession`.
- This is thread-scoped history.

**Agents SDK sandbox memory** (`OAS/docs/sandbox/memory.md`). This is the SDK's real long-term
memory, and it is file-based.
- It "distills lessons from prior runs into files in the sandbox workspace", separately from
  `Session`.
- It is enabled with the `Memory()` capability. Reading needs `Shell()`; live update needs
  `Filesystem()`.
- **Layout:** `sessions/<rollout-id>.jsonl` and `memories/`, which holds `memory_summary.md`,
  `MEMORY.md`, `rollout_summaries/<rollout-id>_<slug>.md`, `skills/` and intermediate
  `raw_memories/`.
- **Read:** "progressive disclosure". `memory_summary.md` is injected "into the agent's developer
  prompt". The agent "searches the configured memory index (`MEMORY.md`) for keywords" and opens
  rollout summaries "only when the task needs more detail". With `live_update` on, it may fix
  stale entries in `MEMORY.md` during the run.
- **Write, in the background:** after each run the segment is appended to a conversation file,
  processed "when the sandbox session closes":
  - phase 1, extraction: a summary and raw memories per conversation;
  - phase 2, consolidation: an agent merges them into `MEMORY.md` and `memory_summary.md`.
- **Forget:** above `max_raw_memories_for_consolidation` (default 256), "Phase 2 keeps only
  memories from the newest conversations and removes older ones".
- **Scope:** isolation "is based on `MemoryLayoutConfig`, not on agent name". Separate
  `memories_dir`s keep agents apart in one workspace. The memory lives as long as the sandbox
  workspace or its snapshot does.

### Letta (formerly MemGPT)

**The V1 server is retired.**
- `letta-ai/letta` `main` is now a landing page. Its `AGENTS.md` says: "Do not infer current
  Letta behavior from this repository."
- "The current source code lives in `letta-ai/letta-code`" (`LV1` main `README.md`).

**The classic MemGPT model**, for history only (`LV1/letta/functions/function_sets/base.py`):
- core memory *blocks* (labelled strings in the prompt), edited by `core_memory_append` /
  `core_memory_replace` and later `memory_replace`, `memory_insert`, `memory_rethink` and
  `memory_apply_patch`;
- *archival memory*, a vector store, through `archival_memory_insert` / `archival_memory_search`;
- *recall*, the message log, through `conversation_search`.

The Vercel AI SDK's Letta provider still exposes `core_memory_append`, `memory_insert` and
`memory_replace` as tools (`VAI/content/docs/03-agents/06-memory.mdx`).

**Current Letta Code: MemFS** (`LC/src/agent/prompts/letta_root_memfs.md`).
- **Scope:** "All of this memory belongs to a single agent identity, identified by a unique
  `agent_id`", across many concurrent conversations.
- **Recall memory:** "All of your experience (message history) is stored in *recall memory*
  automatically by the Letta Code harness (cannot be mutated)". It is searched by a recall
  subagent with `letta messages search --mode vector|fts|hybrid`, where hybrid "combines vector
  similarity + full-text search with RRF scoring" (`LC/src/agent/prompts/recall_subagent.md`).
- **Memory files** are "projected to a local memory filesystem (MemFS) at `$MEMORY_DIR`". The
  agent manages them "via standard filesystem/bash operations" and tracks their history "via git
  operations".
- **Core memory:** "Root Markdown files are editable segments of the system prompt."
  - Root `MEMORY.md` is "a frontmatter-free overview and index".
  - Other root files carry `name` and `description` frontmatter; `persona.md` defines identity.
  - A child directory counts as memory only when it holds its own `MEMORY.md`. These are
    *deferred* memory, read on demand.
  - `skills/` holds procedural memory.
- **Read-back is compiled:** "Editing memory does NOT change your behavior in the current turn …
  a memory edit is applied on a later recompile (a new conversation, an explicit recompile, or a
  changed committed revision)."
- **Write:**
  - The agent writes in the hot path and commits.
  - A background `reflection` subagent reads recent transcripts and updates memory files and
    skills (`LC/src/agent/subagents/builtin/reflection-v2.md`). It prioritizes "Mistakes and
    corrections", "Preferences", "New facts" and "Contradictions", and skips ephemeral state.
- **Sync and sharing** (`LC/src/skills/builtin/syncing-memory-filesystem/SKILL.md`,
  `managing-shared-memory/SKILL.md`):
  - Cloud agents have a hosted git remote, and the harness pushes clean commits after each turn.
    Local agents keep a local-only repository.
  - "Shared memory" repositories are owned by the organization. They are attached to several
    agents and mounted next to `$MEMORY_DIR`. Push conflicts are resolved by rebase, with one
    retry.
- **Edit and forget:** ordinary file edits and deletes, with git history as the record. The prompt
  says: "Never store secrets … Memory is git-tracked and may be synced off this machine."

### LangGraph long-term store, and LangChain Deep Agents

**The concepts** (`LGD/src/oss/concepts/memory.mdx`).
- *Short-term* memory is thread-scoped state, persisted by a checkpointer. *Long-term* memory is
  "saved within custom namespaces" and "can be recalled at any time and in any thread".
- The guide sorts memories into semantic (facts, kept as a profile or a collection), episodic
  (experiences, often few-shot examples) and procedural (rules, often the agent's own prompt
  rewritten by reflection).
- It names two ways to write: "in the hot path" and "in the background".

**The Store API** (`LG/libs/checkpoint/langgraph/store/base/__init__.py`).
- An `Item` has `value` (a JSON dict), `key`, `namespace` (a tuple of strings), `created_at` and
  `updated_at`.
- `BaseStore` offers `get`, `put` (with an optional `index` of JSON paths to embed and an optional
  `ttl`), `search` ("semantic search" plus `filter`), `delete` and `list_namespaces`.
- `TTLConfig` has `default_ttl` and `refresh_ttl` on read.
- Namespace and key are described as "similar to a folder" and "like a file name"
  (`concepts/memory.mdx`).
- Backends are in-memory, Postgres and SQLite (`LG/libs/`: `checkpoint-postgres`,
  `checkpoint-sqlite`).
- Who writes, and when the memory is read back, is up to the application code.

**Deep Agents memory** (`LGD/src/oss/deepagents/memory.mdx`). This is LangChain's own agent
harness, and it is file-based on top of the Store.
- "The agent reads and writes memory as files, and you control where those files are stored using
  backends."
- The agent is configured with `memory=["/memories/AGENTS.md"]`. A `CompositeBackend` routes
  `/memories/` to a `StoreBackend` whose namespace is, for example, `(assistant_id,)` for
  agent-scoped memory, or the user id for user-scoped memory.
- **Read:** files are loaded "into the system prompt at startup, or read … on demand". Skills use
  on-demand loading.
- **Write:** the built-in `edit_file` tool, in the hot path, or "background consolidation" ("sleep
  time compute"), where a consolidation agent runs on a cron schedule.
- **Read-only memory:** "Organization memory is typically read-only to prevent prompt injection
  via shared state". This is enforced with path permissions or backend policy hooks.

### Mem0

Sources: `M0/docs/core-concepts/how-it-works.mdx` and `M0/docs/core-concepts/memory-operations/*.mdx`.

- **Two calls:** "You send conversation turns to `add`, then call `search` before the next model
  request." "Your app decides which returned memories to include in the prompt."
- **Shape:** extracted facts, not transcripts. "I prefer aisle seats" becomes "User prefers
  aisle seats". `infer=False` stores the content raw.
- **Write pipeline:** context lookup, then LLM fact extraction, deduplication and embedding, then
  entity extraction. "The automatic extraction path is additive"; corrections take an explicit
  `update` or `delete`.
- **Storage:** a SQL database for facts and metadata ("the source of truth"), a vector database
  for embeddings, and an entity store. OSS keeps a SQLite history (`history_db_path`,
  `Memory.history(memory_id)` in `M0/mem0/memory/main.py`).
- **Read:** retrieval fuses semantic, keyword, entity and temporal signals.
- **Scope:** "`user_id`, `agent_id`, `run_id`, and metadata", plus `app_id`. The documentation
  says: "Always scope searches with filters."
- **Forget:** `delete`, `batch_delete` and `delete_all` (by `user_id`, `agent_id` or `run_id`;
  now refused without a filter), plus `expiration_date`, after which memories are hidden from
  `search` unless `show_expired` is passed.
- The writer is the application, which calls `add` after a turn. Any extraction is done by Mem0,
  not the agent.

### Vercel AI SDK

Source: `VAI/content/docs/03-agents/06-memory.mdx`. The AI SDK has **no memory model of its own**.
It documents three ways to add one:

1. **Provider-defined tools.** Anthropic's `memory_20250818`, where "your `execute` function maps
   these to your storage backend".
2. **Memory providers.** Letta, Mem0 (`@mem0/vercel-ai-provider`, with `addMemories` /
   `retrieveMemories`), Supermemory (`addMemory`, `searchMemories`), Hindsight, MongoDB and Redis
   Agent Memory. "The provider controls memory behavior, so you have less visibility."
3. **A custom tool.** Either "structured actions" (`view`, `create`, `update`, `search`) or
   "bash-backed" access to a sandboxed filesystem (`cat`, `grep`, `sed`).

Message persistence for chat UIs is a separate concern (`chatbot-message-persistence`; see
`subjects/ai-harness/research/harness-session-apis.md`).

### UHP: the Harness Memories sub-protocol

Source: `UHPM`, 993 lines. Optional: it is advertised by the `memories` capability. The prior
note is `subjects/ai-harness/research/unified-harness-protocol.md`.

- **Layering.**
  - The provider does extraction, ranking, consolidation and storage: "a vendor's memory service,
    a graph database, a folder of files" (§1).
  - UHP defines the object, the access and "the seam".
  - MCP carries the agent's tool calls.
- **A tree, not fixed scopes.** "Memory products each name their own levels (user, agent, run,
  app, team, project) and none of the lists agree. … the protocol carries the tree and the
  inheritance." "A node exists where access differs, and nowhere else" (§1). The memory object has
  `name`, a `description` that the agent reads to decide where to look, `parent_id` and
  `restricted` (§2).
- **Access (§3).**
  - Principals are `member` (a person or an agent: "A person and an agent are the same kind"),
    `group` and `provider`.
  - Grants of `read`, `write`, `create` and `delete` are a union over the node and its ancestors.
    There is no deny.
  - `restricted: true` cuts off inheritance; a person's private memory SHOULD be restricted.
  - "Access is enforced by the server … A filter applied by the agent … is not enforcement."
- **Records (§4).**
  - Types are `episode`, `fact`, `note`, `procedure`, `link` and `entity`.
  - Content is a list of parts, so files can be parts.
  - Every change appends a `version`; `status` is `active`, `superseded` or `forgotten`.
  - Records carry bitemporal `time` and a `written_by` that the server stamps.
  - `references` between records are "the only graph there is".
  - `trust` is always `"untrusted"` on a read.
- **Operations (§5).**
  - Writing: `observe` hands raw episodes to the provider, which decides what to derive.
    `remember` writes one record as stated.
  - Reading: `recall`, `graph`, `history` and `as_of` reads.
  - Changing: `revise`.
  - Removing: `forget` closes a record and keeps its trace. `erase` removes content for good,
    "is never offered to an agent as a tool", and reports an `unreachable` list.
- **Recall (§6).** "Search finds the place, then the agent walks." A search covers a node and its
  readable descendants, "down, never up", and each result names its memory.
- **Session moments (§9.1).**
  - **Prime:** the server puts standing records (`attributes.standing: true`) into the
    instructions "at session start and after the conversation is compacted", newest first, within
    a token `budget`. Priming is not repeated every turn, to keep prompt caching.
  - **Tools:** `memory_recall`, `memory_remember`, `memory_revise`, `memory_forget` and others,
    with write tools only for an agent that holds `write`.
  - **Observe:** each finished turn goes to `default_memory_id` as an episode.
  - **Consolidate:** runs that are visible, budgeted and revertible, with
    `/consolidations/{run}/revert` (§9.2).
- **Providers (§10).** A capability document declares:
  - `isolation` (`container` or `enforced_filter`) and `derivation` (`write_time`, `background`,
    `agent` or `none`);
  - recall signals and history depth;
  - emulation, "never approximated in silence".
- **Security (§13).** A server "MUST present recalled content to the agent as data, fenced from
  instructions". "Erase is a person's act."

## Comparison

| System | Scope | Shape | Who writes | Read back | Edit and forget |
|---|---|---|---|---|---|
| Claude Code `CLAUDE.md` | org, user, project, local, subdirectory, rules by path | Markdown files, concatenated | user (Claude when asked) | whole file at launch; subdirectories on demand | user edits the files |
| Claude Code auto memory | per repository and machine; per subagent (`user`, `project`, `local`) | `MEMORY.md` index plus topic files with frontmatter | agent, hot path | index first 200 lines or 25 KB primed; topics read with file tools | file edits, `/memory`, toggle |
| Anthropic memory tool | whatever the handler maps `/memories` to | files (six commands) | agent | agent `view`s first, told to by an injected prompt | agent deletes; app expires |
| OpenAI Conversations | one conversation | item list | harness, per response | passed as `conversation` | delete conversation or items |
| ChatGPT memory (unverified) | user; project-only option | saved list plus chat-history reference | model tool (`save_memories`) and background | summary in prompt; retrieval | user deletes in settings |
| OpenAI Agents SDK sandbox | memory layout in a workspace | `memory_summary.md`, `MEMORY.md`, rollout summaries | background two-phase job; agent live update | summary primed; index grepped; summaries on demand | newest-N cap; agent fixes stale entries |
| Letta Code MemFS | agent identity; shared repos for the organization | git repo of Markdown files; immutable message log | agent (hot path) plus reflection subagent | root files compiled into system prompt; deferred files on demand; recall by hybrid search | file edits with git history |
| LangGraph Store | any namespace tuple | JSON items, optionally embedded | app code | app code (`get`, `search`) | `delete`, TTL |
| Deep Agents | agent-, user- or org-scoped by backend namespace | files over the Store | agent `edit_file`; cron consolidation agent | at startup or on demand | file edits; read-only by permission |
| Mem0 | `user_id`, `agent_id`, `app_id`, `run_id`, metadata | extracted facts: SQL, vectors, entities | app calls `add`; LLM extracts | app calls `search`, injects results | `update`, `delete`, `delete_all`, `expiration_date` |
| Vercel AI SDK | none of its own | delegates (Anthropic tool, providers, custom) | depends | depends | depends |
| UHP Memories | tree of memories with inherited grants | versioned typed records with references | agent (`remember`), server (`observe`), provider (`consolidate`) | Prime with token budget; `recall` tools | `revise`, `forget` (trace kept), `erase` (people only), revert run |

## Which models fit a file-view-first harness, and which need a database or index

Context for the harness:

- A workspace is one FilesApi, and its first-level folders are projects.
- Each project has a hidden system folder, `.system`. The gate answers `ENOENT` for it to every
  file-view capability, and only harness tools reach it, through an owner-side capability
  (#80, resolution 2–4).
- The definitions mount `.agents/` is generated, read-only and filtered by role (#80, 5–8).
- Per-project SQLite databases sit behind the same gate, named `<workspace>/<project>/<db>` and
  declared in `.system/databases`. Plugins may keep tool-private databases, named
  `<plugin>:<name>`, that agents never see (#81).

**Fits files directly, with no index needed.**
- *`CLAUDE.md` / `AGENTS.md`-style instructions* are project files loaded by directory. The harness
  already exposes the project as the working directory. Flue reads `AGENTS.md` and `CLAUDE.md`
  natively (`subjects/ai-harness/research/plugin-and-tool-layouts.md`).
- *An index file plus topic files written by the agent.* This covers Claude Code auto memory and
  subagent memory, the Anthropic memory tool, OpenAI sandbox memory, Letta MemFS core and deferred
  memory, and Deep Agents. All they need is:
  - read, write, edit, list and grep on a folder;
  - a harness step that primes the first N bytes of the index into the prompt.

  Grep is how these systems search: Claude reads topics "using its standard file tools", and the
  OpenAI agent "searches the configured memory index … for keywords".
- *Skills as procedural memory* (Letta, Deep Agents, OpenAI's `memories/skills/`) fit the existing
  `.system/plugins/` and `.agents/` design.
- *Background consolidation that writes files* (OpenAI phase 2, Letta reflection, Deep Agents
  cron) is a harness job, a subagent with a narrowed file capability, run after a session ends or
  on a schedule. It needs transcripts as input, which the session store already keeps.
- *UHP `prime`, `remember`, `revise` and `forget` on `note`, `fact` or `procedure` records* could
  be served by a files provider: a memory maps to a folder and a record to a file with
  frontmatter. UHP names "a folder of files" as a valid provider **(inference: such a provider
  would declare most search signals absent and answer `degraded`, as §10.2 requires)**.

**Needs a database or an index.**
- *Search over past conversations* (episodic recall): Letta recall's hybrid vector and full-text
  search, ChatGPT's chat-history reference, UHP `observe` with derived records.
- *Extracted-fact stores with semantic retrieval:* Mem0 (SQL, vectors, entities), the LangGraph
  Store with `index` (pgvector or SQLite), and the memory providers in the Vercel AI SDK.
- *UHP beyond notes:* `recall` over a subtree with ranking signals, `graph`, `as_of` reads and
  `history` of every version, consolidation runs with `revert`, and `erase` with its
  `unreachable` report. These need per-record versions and an index **(inference)**.
- *OpenAI Conversations* is session history, not memory. It already belongs to the session store
  (#83), not to the memory design.

**Recommendation (inference).**

1. **Instructions:** honour `AGENTS.md` and `CLAUDE.md` in project folders as they are. Users edit
   them like any other file, within their permissions.
2. **Agent memory as files, primed with a budget.**
   - Keep a memory folder with a `MEMORY.md` index and topic files with `name`, `description` and
     `type` frontmatter. This is the shape Claude Code, Letta and OpenAI converged on.
   - Prime the index into the prompt with a byte cap at session start and after compaction, as
     Claude Code (200 lines / 25 KB) and UHP's Prime do. Do not re-prime every turn.
   - Stamp a `modified` time and the writer on each write (Claude Code; UHP's `written_by`).
3. **Placement follows the access model.** `.system` is invisible to agents, so memory the agent
   edits with its normal file tools cannot sit there as plain files. Two options:
   - **(a) Visible folder.** Keep memory in an ordinary folder of the project, such as
     `<project>/.memory/`, governed by role permissions (`files.write:.memory/**`). This is
     simple, and users see and edit it.
   - **(b) Generated mount.** Store memory in `.system/memory/` and mount it, like `.agents/`, as
     a generated folder with its own narrowed capability. This allows **per-user private memory**
     (`.system/memory/users/<user>/`, mounted only into that user's sessions, like UHP's
     `restricted` node) beside project-shared memory. It also allows read-only org or project
     memory, as Deep Agents advises against injection through shared state.

   Option (b) fits the existing mount design better, and it is the only option that gives
   per-user memory in a shared project.
4. **Writers.** The agent writes in the hot path through the file view. An optional consolidation
   job writes after a session, as a subagent with only the memory capability. Its output should be
   reviewable and revertible (UHP §9.2). FilesApi has no version history, so revert needs either
   snapshots taken before each run or a git-backed folder (Letta MemFS; webrun-vcs is available).
5. **Index only where needed.**
   - Transcript and episodic search should be a separate tool backed by a tool-private database
     (`memory:index`, #81) and statewalker-search's full-text and vector indexers.
   - The index is derived from session transcripts and memory files and can be rebuilt. The files
     stay the source of truth.
6. **Safety.** Treat memory content as untrusted data, fenced from instructions (UHP §13). Never
   write secrets into memory (Letta, Mem0). Validate paths (the Anthropic memory tool's traversal
   warning; the gate already does this). Forgetting is a file delete. Erasing derived copies means
   also dropping the index rows, which is one more reason the index must be rebuildable.
7. **Projections.**
   - The Anthropic `memory_20250818` tool maps one-to-one onto the memory folder, so a Claude
     model can use it with a handler over the file capability.
   - UHP Memories can come later as a projection over folders, with grants mapped from project
     roles. It needs the index for `recall` and will report missing signals as `degraded`.

## Open questions

- Should the memory folder be visible (a) or a generated mount over `.system/memory/` (b)? Is
  per-user memory inside a shared project needed in the first version?
- Who may read another member's private memory? Owners? Nobody, as UHP's `restricted` implies?
- Should consolidation be in the first version? If it is, how are runs reverted without file
  versioning?
- Should memory follow the project (Claude Code, Deep Agents) or the agent identity across
  projects (Letta)? The second needs a workspace-level or user-level folder outside any project.

## Sources

- Claude Code: https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/sub-agents
- Anthropic memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- OpenAI API, saved 2026-11-15: https://developers.openai.com/api/docs/guides/conversation-state.md
- ChatGPT memory (search-result summaries only, unverified):
  https://help.openai.com/en/articles/8590148-memory-faq
- OpenAI Agents SDK: `OAS/docs/sessions/index.md`, `OAS/docs/sandbox/memory.md`,
  `OAS/src/agents/memory/session.py`
- Letta: `LV1` (`README.md`, `AGENTS.md`, `letta/functions/function_sets/base.py`);
  `LC/src/agent/prompts/letta_root_memfs.md`, `LC/src/agent/prompts/recall_subagent.md`,
  `LC/src/agent/subagents/builtin/reflection-v2.md`,
  `LC/src/skills/builtin/syncing-memory-filesystem/SKILL.md`,
  `LC/src/skills/builtin/managing-shared-memory/SKILL.md`
- LangGraph and Deep Agents: `LGD/src/oss/concepts/memory.mdx`, `LGD/src/oss/deepagents/memory.mdx`,
  `LG/libs/checkpoint/langgraph/store/base/__init__.py`
- Mem0: `M0/docs/core-concepts/how-it-works.mdx`, `M0/docs/core-concepts/memory-operations/{add,delete}.mdx`,
  `M0/mem0/memory/main.py`
- Vercel AI SDK: `VAI/content/docs/03-agents/06-memory.mdx`
- UHP: `HR/protocol/versions/2026-10-19/memories.md`, from https://unifiedharnessprotocol.org/spec/2026-10-19/memories
- Harness context: `statewalker/statewalker-root#80` and `#81` (resolutions),
  `subjects/ai-harness/research/harness-session-apis.md`, `subjects/ai-harness/research/unified-harness-protocol.md`,
  `subjects/ai-harness/research/plugin-and-tool-layouts.md`
