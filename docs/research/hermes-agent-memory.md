# How does the Hermes agent harness create, manage and use memory?

Research for `statewalker/statewalker-root#167` (map: `statewalker/statewalker-root#70`). Sources
read on 2026-11-19. Statements marked **(inference)** are this note's own reasoning, not a source's
claim. This note follows on from
[How do agent harnesses keep memory across sessions?](agent-memory-models.md)
(`statewalker/statewalker-root#156`), and its last section feeds
`statewalker/statewalker-root#157`.

The repository was cloned at this commit:

| Short name | Repository | Commit |
|---|---|---|
| `HA` | `github.com/NousResearch/hermes-agent` (MIT) | `8d70b88` (2026-11-19) |

The documentation site, `https://hermes-agent.nousresearch.com/docs/`, is built from `HA/website/docs/`,
so the docs were read from the repository at that commit. In the paths below, `HA/docs/` is short
for `HA/website/docs/`.

**Other harnesses named "Hermes".** A web search found no other well-known agent *harness* called
Hermes. The name is shared with Nous Research's **Hermes model family** (Hermes 3, Hermes 4), whose
tool-call format is what serving stacks call the "hermes" tool parser. That is a model and a prompt
format, not a harness, and it has no memory system. This note therefore covers Hermes Agent only.

## Question

How does Hermes Agent create, store, manage and use memory and history across sessions? For each
kind of memory:

- **where** it is stored;
- **writer**: the agent through a tool, a background job, or the user;
- **read-back**: primed into the prompt, searched, or fetched by a tool;
- **limits**: how big it may get;
- **edit and forget**: how it is changed or removed;
- **safety**: how injection is kept out;
- **access path**: files, or only dedicated tools.

Then: what does this design imply for the direction in `#157`? There, project memory and agent memory
live in the project's `.system` folder. User memory and user preferences live in a separate per-user
profiles file system that agents reach only through tools.

## Short answer

- **Five kinds of memory, all scoped to one "profile" (one Hermes home directory, `HERMES_HOME`):**
  1. `MEMORY.md`: the agent's notes about its environment;
  2. `USER.md`: the user profile;
  3. session history in SQLite with FTS5, searched by `session_search`;
  4. skills, a folder of `SKILL.md` packages, which the docs call the agent's
     "procedural memory";
  5. optionally, **one** external memory provider (Honcho, Mem0, Hindsight and others), which runs
     alongside the built-in files.

  Context files (`SOUL.md`, `AGENTS.md`, `.hermes.md`) are instructions written by people, kept
  apart from what the agent learns.
- **The two Markdown stores are tiny and hard-capped.** `MEMORY.md` holds 2,200 characters and
  `USER.md` 1,375, about 1,300 tokens together. Both are injected **whole** into the system prompt
  as a **frozen snapshot** taken at session start, with a usage percentage in the header. When a
  write would overflow, the tool **returns an error**: there is no auto-compaction. The agent
  must consolidate in the same call.
- **The agent writes through one dedicated tool, `memory`, with no read action.** The tool takes
  `add`, `patch` and `remove`, batched atomically against the final character budget. Entries are
  matched by substring and separated by `§`. A background **review fork** also writes, after every
  N turns (memory) or N tool iterations (skills). It is limited to add-only memory writes; deletions
  and patches it proposes are **staged for human approval**. An optional `write_approval` gate
  stages every write.
- **Memory is not isolated from file tools.** The docs say plainly that the approval gate "is not a
  file-system lock". In a foreground turn, the generic file tools and the terminal can edit
  `MEMORY.md` and `USER.md` directly. Only the background review is kept off them, by a tool
  whitelist. Hermes copes with the drift this causes: when it finds free text without `§`
  delimiters, it backs the file up and refuses to rewrite it.
- **Injection defence is pattern scanning on every write and at load.** A shared threat-pattern
  library blocks prompt-injection, exfiltration and invisible-Unicode content in memory writes, at
  its strictest scope. At load, a poisoned entry is replaced by a `[BLOCKED: …]` marker. The
  guidance tells the agent to write **declarative facts, not instructions** ("imperative phrasing
  gets re-read as a directive in later sessions"). Recall from external providers is fenced in
  `<memory-context>` tags, but labelled "authoritative reference data", not untrusted.
- **Skills carry most of the learning.** The memory tool's own description says task knowledge,
  including "the user's preferences and corrections for that kind of work", belongs in a skill.
  Memory is "the narrow exception for facts that apply to EVERY session". Skills are loaded on
  demand: an index is in the prompt, and the full text comes from `skill_view`. A curator archives
  unused skills, and can optionally merge overlapping ones.
- **There is no per-user separation inside a profile.** One `USER.md` and one session store serve
  every person who talks to the profile's bots. The docs tell operators who need privacy between
  people to run separate instances. Per-person modelling exists only through an external provider
  (Honcho's user "peers").
- **Implication (inference):** Hermes supports `#157` on bounded, primed stores, on skills as
  procedural memory, and on scanning. It also shows the cost of putting memory where file tools can
  reach it. The `#157` choice, user memory reachable only through tools, closes exactly the gap
  Hermes documents. Details are in the last section.

## Findings

### Where everything lives: the profile

Source: `HA/docs/user-guide/profiles.md`.

- "A profile is a separate Hermes home directory. Each profile gets its own directory containing
  its own `config.yaml`, `.env`, `SOUL.md`, memories, sessions, skills, cron jobs, and state
  database." The default profile is `~/.hermes`; named ones are `~/.hermes/profiles/<name>/`.
- Scoping is by `HERMES_HOME`: "119+ files in the codebase resolve paths via `get_hermes_home()`".
- **One writer per home.** "Never point two agent processes at the same profile … each loads the
  other's writes into its system prompt at session start — so two writers on one home compound
  each other's state." Agents that need shared memory should use an external provider
  (also `HA/docs/user-guide/features/memory.md`).
- A profile is the unit of "agent" in Hermes. A profile is *not* a user, and not a project. The
  working directory, and so the project, is separate from `HERMES_HOME`.

### Built-in memory: `MEMORY.md` and `USER.md`

Sources: `HA/docs/user-guide/features/memory.md`; `HA/tools/memory_tool.py`;
`HA/tools/memory_tool_store.py`; `HA/agent/prompt_builder.py`; `HA/hermes_cli/config_defaults.py`.

**Shape and place.**

| File | Purpose | Default limit |
|---|---|---|
| `MEMORY.md` | "Agent's personal notes — environment facts, conventions, things learned" | 2,200 chars (~800 tokens) |
| `USER.md` | "User profile — your preferences, communication style, expectations" | 1,375 chars (~500 tokens) |

- Both files sit in `<HERMES_HOME>/memories/`. Entries are separated by `ENTRY_DELIMITER = "\n§\n"`
  (`memory_tool_store.py`).
- The limits are in characters, "model-independent". The config keys are `memory_char_limit` and
  `user_char_limit` (`config_defaults.py`). Each store can be switched off: `memory_enabled`,
  `user_profile_enabled`.

**Read-back: frozen snapshot, whole, every session.**
- "At the start of every session, memory entries are loaded from disk and rendered into the system
  prompt as a frozen block." The header shows the store and its usage, for example
  `MEMORY (your personal notes) [67% — 1,474/2,200 chars]`.
- "The system prompt injection is captured once at session start and never changes mid-session …
  it preserves the LLM's prefix cache." Writes reach disk at once but are seen only by the next
  session. "Tool responses always show the live state."
- "There is no `read` action — memory content is automatically injected into the system prompt."
- The docs build the design around session boundaries. Messaging chats are "one continuous
  session", so the learning loop of "forget → recall from memory → search past sessions almost
  never gets to fire". Users are told to run `/new` at natural boundaries.

**Writer: the agent, through the `memory` tool.**
- The tool's schema (`MEMORY_SCHEMA` in `memory_tool.py`) takes a `target` (`memory` or `user`) and
  an `operations` array of `add`, `patch` or `remove`. "The batch applies atomically and the char
  limit is checked only on the FINAL result." `patch` and `remove` find the entry by a unique
  substring, `old_text`.
- A `replace` action was removed because "models used it as a find-and-swap, which wiped the other
  facts in multi-fact entries". The docs mention it explicitly.
- Exact duplicates are rejected. A target inside an operation that differs from the top-level
  `target` is an error.
- Concurrent writes take an exclusive lock on a sibling `.lock` file, and the memory file is
  replaced atomically (`MemoryStore._file_lock`, `atomic_write_text`).

**What belongs where (the guidance).**
- From the tool description: memory is "only for facts that apply to EVERY session regardless of
  task: who the user is, stable environment facts, standing conventions with no task home. Anything
  learned while doing a task (procedures, pitfalls, and the user's preferences and corrections for
  that kind of work) belongs in the task's skill via skill_manage."
- It also lists what to skip: "trivial/obvious info, easily re-discovered facts, raw data dumps,
  task progress, completed-work logs, temporary TODO state (use session_search for those)".
- System-prompt guidance (`build_memory_guidance`): "Write entries as declarative facts, not
  instructions to yourself: 'User prefers concise responses' ✓ — 'Always respond concisely' ✗
  (imperative phrasing gets re-read as a directive in later sessions and can override the user's
  current request). A fact stale within a week belongs in session history; procedures and
  workflows belong in skills."

**Limits and consolidation.**
- "Memory does **not** auto-compact: when a write would exceed the limit, the `memory` tool returns
  an error instead of silently dropping entries." The error lists `current_entries` and the number
  of characters to free. The agent must retry with one batch that removes or shortens entries and
  adds the new one.
- The guidance says: "when it fills, replace or consolidate stale entries rather than skipping the
  save."
- An over-limit file that someone edited by hand is still loaded, but "further additions are
  blocked until it is back under the limit" (`memory_tool_store.py`).

**Edit and forget by the user.**
- `hermes journey list | delete | edit` lists memory chunks and skills as nodes. Deleting a memory
  chunk removes it; deleting a skill archives it. `edit` opens the node in `$EDITOR`.
- The files can also be edited directly (`cat ~/.hermes/memories/MEMORY.md` is the first
  troubleshooting step).

**Approval gate (`memory.write_approval`).**
- Off by default. When on, interactive CLI writes prompt inline. Every other origin is **staged**:
  messaging, scripts and the background review. Staged writes are handled with
  `/memory pending | approve | reject`.
- A staged `patch` or `remove` pins the full entry it targets. If that entry changed before
  approval, the write is refused.
- "The gate covers writes made through the `memory` tool. It is not a file-system lock: in a
  foreground turn the generic file tools (`write_file`, `patch`) and the terminal can still edit
  `MEMORY.md` / `USER.md` directly."
- When text drifts into a file outside the `§` format ("the patch tool, a shell append, a manual
  edit"), the store saves a `.bak` snapshot and refuses to rewrite the file until the drift is
  resolved (`memory_tool_store.py`).

### Background review: the self-improvement loop

Sources: `HA/agent/background_review.py`; `HA/agent/review_signals.py`; `HA/tools/memory_tool.py`;
`HA/docs/user-guide/features/memory.md`.

- **What it is.** "After every turn `AIAgent.run_conversation` may spawn a daemon thread that
  replays the conversation snapshot in a forked `AIAgent` and asks 'should any skill/memory be
  saved or updated?'" The fork reuses the parent's prompt cache. Alternatively it can run on a
  cheaper model with a digest of the conversation.
- **When.** Two counters drive it: user turns since the last memory review
  (`memory.nudge_interval`, default 10) and tool-calling iterations since the last skill review
  (`skills.creation_nudge_interval`, default 10). It can be turned off with
  `auxiliary.background_review.enabled: false`, and its cost capped with `max_input_tokens`.
  `/refine` runs it by hand.
- **Prompts.** `_MEMORY_REVIEW_PROMPT`, `_SKILL_REVIEW_PROMPT` and `_COMBINED_REVIEW_PROMPT`. The
  routing block tells the fork that one fact goes to one store. It also sets a grounding rule:
  "Save only facts GROUNDED in this conversation … Never infer the user's traits, skill level,
  role, mood or preferences from topic, tone or tools used, and never turn a one-off request into a
  standing preference … unless the user marked it general ('always', 'from now on', 'remember')."
  The skill prompt is the opposite in spirit: "Be ACTIVE — most sessions produce at least one skill
  update."
- **What it may touch.** A dispatch-side tool whitelist allows the memory toolset (only when a
  memory review fired), the skills toolset and the read-only `read_file` and `search_files`. "Write
  tools (write_file/patch/terminal) stay denied — autonomous maintenance must go through
  skill_manage's validation."
- **Fail-closed deletes.** `_background_delete_gate` (`memory_tool.py`) lets an unattended review
  `add`. Its `patch` and `remove` operations "are never applied unattended": they are staged for
  approval even when `write_approval` is off.
- **Visibility.** Gateways show a short `💾 Memory updated` line in chat
  (`display.memory_notifications`).
- **Session end.** "Before reset, the agent saves memories and skills from the expiring session"
  (`HA/docs/user-guide/sessions.md`).

### Session history: `state.db` and `session_search`

Sources: `HA/docs/user-guide/sessions.md`; `HA/tools/session_search_tool.py`.

- **Storage.** Every CLI, TUI and gateway session is stored in `<HERMES_HOME>/state.db`, a SQLite
  database in WAL mode. Its tables are `sessions`, `messages` and the FTS5 table `messages_fts`.
- **Read-back.** `session_search` has four shapes, chosen by which arguments are given:
  - discovery: `query`, FTS5 search with optional `newest` or `oldest` bias;
  - scroll: `session_id` plus `around_message_id`;
  - read: `session_id` alone;
  - browse: no arguments.

  "No LLM calls — every shape returns actual DB messages." Subagent, kanban and tool-sourced
  sessions are hidden from it.
- The system prompt adds: "When the user references something from a past conversation or you
  suspect relevant cross-session context exists, use session_search to recall it before asking them
  to repeat themselves" (`SESSION_SEARCH_GUIDANCE`).
- **Who can search what.** "`session_search` reads the whole session store of the profile it runs
  in: every chat, from every platform and every user in that profile's allowlist … Hermes does not
  separate users inside one profile." Private history needs "their own instance, under a separate
  OS user or container".
- **Forget.** `hermes sessions delete | prune | archive`. Auto-pruning after `retention_days`
  (default 90) is opt-in.

### Skills: procedural memory

Sources: `HA/docs/user-guide/features/skills.md`; `HA/docs/user-guide/features/curator.md`;
`HA/agent/background_review.py`; `HA/hermes_cli/config_defaults.py`.

- **Place and shape.** `<HERMES_HOME>/skills/<category>/<name>/SKILL.md`, with `references/`,
  `templates/`, `scripts/`, `examples/` and `assets/`. They follow the agentskills.io format.
  Project-local skills are in `<repo>/.hermes/skills/` and `<repo>/.agents/skills/`. They load
  only after `hermes skills trust`, take precedence over the user's own skills, and are scanned on
  every content change; a "dangerous" verdict quarantines them.
- **Read-back is progressive.** `skills_list()` gives names and descriptions, an index of about 3k
  tokens. `skill_view(name)` loads the full skill and `skill_view(name, path)` one reference file.
  The index in the system prompt is frozen too. Skills added mid-session are announced in a note on
  the next message.
- **Writer.** The agent writes through `skill_manage`: `create`, `patch`, `delete`, `write_file`,
  `remove_file`. "This is the agent's **procedural memory**." Writers are the foreground turn, the
  background review and the curator.
  - A read-before-write guard is enforced: "skill_manage refuses otherwise". The model must call
    `skill_view` for the target during the same review.
  - An advisory linter flags incident-log-shaped bodies, more than 60 reference files, and a
    `SKILL.md` over about 24k characters.
  - `skills.write_approval` stages skill writes; diffs are read out-of-band.
- **What a skill should be.** "Lessons, not logs: a pitfall is a generalizable rule plus one clause
  of *why* … Incident narration, PR or issue numbers, dates, and quoted chat are not skill
  content." User style corrections are "FIRST-CLASS skill signals, not just memory signals"
  (`_SKILL_REVIEW_PROMPT`).
- **Consolidation: the curator.**
  - It runs when 7 days have passed and the agent has been idle for 2 hours.
  - Deterministic pass: skills unused for 14 days become `stale`; after 30 days they are archived
    to `skills/.archive/`. It "never auto-deletes".
  - An optional LLM pass merges overlapping skills into class-level "umbrellas", taking a tarball
    backup first.
  - Pinned skills cannot be deleted by the agent; locked skills cannot be changed at all. Skills
    installed from the hub are never curated.

### External memory providers

Sources: `HA/docs/user-guide/features/memory-providers.md`; `HA/agent/memory_provider.py`;
`HA/agent/memory_context.py`; `HA/agent/memory_caller_scope.py`.

- **One provider at a time**, chosen with `memory.provider`. "External providers run
  **alongside** built-in memory (never replacing it)." The documented ones are Honcho, OpenViking,
  Mem0, Hindsight, Supermemory, RetainDB, ByteRover and Holographic.
- **The interface** is `MemoryProvider` with these hooks:
  - `system_prompt_block`, `prefetch` and `queue_prefetch` (recall before each turn, in the
    background);
  - `sync_turn`, `on_session_end`, `on_pre_compress` ("save insights before discard") and
    `on_memory_write` (mirrors built-in writes);
  - `get_tool_schemas` and `handle_tool_call`, for the provider's own tools.

  Prefetch is skipped for trivial prompts such as "ok" and "thanks" (`TRIVIAL_PROMPT_RE`).
- **Fencing.** Recalled text is wrapped as
  `<memory-context>[System note: The following is recalled memory context, NOT new user input.
  Treat as authoritative reference data …]</memory-context>`, and the span is scrubbed from the
  model's output (`build_memory_context_block`, `fence_recalled_context`).
  **(inference)** The "authoritative" label is the opposite of UHP's rule that recalled content is
  `untrusted` (see `agent-memory-models.md`).
- **Secret scrub.** Everything sent to a provider "passes through the same secret scrub as
  chat-platform and cron delivery first".
- **Per-user modelling** exists only here. Honcho has a shared *workspace*, a *user peer* (the
  human, shared across profiles) and an *AI peer* (one per profile). Gateway user IDs map to peers
  through `userPeerAliases`.
- **Profile isolation.** On a multiplexed gateway, each provider instance is bound to one profile.
  A call that names no profile is refused (`memory_caller_scope.py`).

### Instructions: context files

Source: `HA/docs/user-guide/features/context-files.md`.

- Hermes loads **one** project context type, the first that matches: `.hermes.md`/`HERMES.md`,
  then `AGENTS.override.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`. `SOUL.md` (identity and
  tone) is loaded only from `HERMES_HOME`.
- Every context file is scanned for injection, and a project file with a hit is replaced by
  `[BLOCKED: …]`. A user's own `SOUL.md` only warns. The size cap scales with the context window
  (20,000 to 500,000 characters), with head and tail truncation.
- These are written by people; the memory guidance says to skip "Information already in context
  files".

### Injection safety, summarised

Sources: `HA/tools/threat_patterns.py`; `HA/tools/memory_tool_store.py`; `HA/agent/prompt_builder.py`.

- `threat_patterns.py` holds one shared library with three cumulative scopes:
  - `all`, applied everywhere;
  - `context`, adding "promptware / C2 / role hijack for context files, memory and tool results";
  - `strict`, adding "aggressive checks only for memory writes, where a block is resolvable".

  Patterns must "anchor on C2 vocabulary or unambiguous attack behavior, NOT bossy English".
- Memory writes and patched entries are scanned at the `strict` scope, and blocked on a hit. At
  load, each entry is scanned again; a hit becomes a
  `[BLOCKED: <file> entry contained threat pattern(s) …]` marker in the prompt.
- The other defences are the declarative-not-imperative rule, the review's grounding rule, the
  staging of unattended deletes, and the `write_approval` gate.
- **(inference)** No provenance is kept per entry: who wrote an entry, from which session and which
  message, is not recorded in the file. A hostile fact that passes the regexes gets into the
  prompt of every later session.

## Implications for the harness (`#157`)

All of this section is **(inference)**: the note's reading of Hermes against the direction in
`statewalker/statewalker-root#157`.

| Concern | Hermes | What it suggests for `#157` |
|---|---|---|
| Scope | Everything is per profile, meaning per agent install. No project scope for memory (only for skills and context files). No per-user scope. | `#157` splits along both axes Hermes lacks: project and agent memory in `.system`, user memory per user per project. Hermes's shared-bot warnings ("anyone allowed to talk to it can … read anyone else's conversations") are the case for that split. |
| Tools vs files | A dedicated `memory` tool with no read action, but the files stay writable by file tools; the gate "is not a file-system lock". | Keeping user memory and preferences reachable **only through tools** removes the drift and bypass Hermes has to detect after the fact. For `.system` memory, which file tools *can* reach, either deny writes to the memory files from file tools, or accept direct edits and validate the format at load. Hermes does the latter, with a backup and a refusal. |
| Bounded size | Hard character caps (2,200 and 1,375), usage shown in the prompt, an error on overflow, consolidation in the same atomic batch. | Give every primed store a byte budget, show its usage in the injected header, and reject an overflowing write with the current entries so the model consolidates. Never truncate silently. |
| Read-back | Whole store primed as a frozen snapshot; no read action; history only through search. | Prime the small stores at session start and keep the snapshot fixed for the prompt cache. Make the tool's result show the live state. Keep transcript search a separate, index-backed tool, as `agent-memory-models.md` already recommends. |
| Who writes | The agent in the hot path, plus a background review fork on a turn or iteration cadence, plus the user (CLI, `$EDITOR`, `/journey`). | A post-turn or session-end review fits the harness. Copy Hermes's guards: a tool whitelist, add-only for unattended writers, deletes and patches staged for a human, grounding rules against inferred traits. |
| User preferences | Inferred into `USER.md` unless the user said "always" or "remember"; optional approval gate. | `#157`'s "explicit only" preferences are stricter than Hermes, and Hermes's grounding rule exists *because* its reviewer saved trait guesses. Keep preferences explicit, and keep inferred observations, if any, in user memory with a clear label. |
| Consolidation | Agent consolidates on overflow; curator archives unused skills and can merge them; never deletes automatically. | Consolidate on overflow in the hot path. Run a periodic, idle-time curator over skills, with archive in place of delete and a backup before rewrites. |
| Injection | Regex scan on write and on load; declarative phrasing; recalled provider context fenced but called "authoritative". | Scan on write and on load. Store facts, not imperatives. Record provenance (session, writer) per entry, which Hermes lacks. Mark recalled content as untrusted, as UHP does. |
| Skills | The main home for learned task knowledge, including per-task user preferences; loaded on demand; project skills need explicit trust. | Treat skills as procedural memory beside `.system` memory: agent-written skills per project or per agent, project-supplied skills gated by trust and scanning. Route task-specific lessons to skills and keep primed memory for every-session facts. |
| Concurrency | One writer per home; a lock file plus atomic replace; shared memory only through an external provider. | Several agents and users share `.system` memory in `#157`, so the store needs atomic batch writes with locking or compare-and-set. Hermes's pinned-entry check for staged deletes is a cheap model to copy. |

## Sources

- Hermes Agent repository, commit `8d70b88`: https://github.com/NousResearch/hermes-agent
  - Docs, rendered at `https://hermes-agent.nousresearch.com/docs/`:
    `website/docs/user-guide/features/memory.md`, `…/features/memory-providers.md`,
    `…/features/skills.md`, `…/features/curator.md`, `…/features/context-files.md`,
    `website/docs/user-guide/profiles.md`, `website/docs/user-guide/sessions.md`,
    `website/docs/developer-guide/memory-provider-plugin.md`, `SECURITY.md` §2.2, §2.6
  - Code: `tools/memory_tool.py`, `tools/memory_tool_store.py`, `tools/threat_patterns.py`,
    `tools/session_search_tool.py`, `agent/prompt_builder.py`, `agent/background_review.py`,
    `agent/review_signals.py`, `agent/memory_provider.py`, `agent/memory_context.py`,
    `agent/memory_caller_scope.py`, `hermes_cli/config_defaults.py`
- Other "Hermes" harnesses: web search, 2026-11-19. It returned only Hermes Agent coverage, for
  example https://runtimewire.com/article/nous-research-hermes-agent-open-harness-sovereignty
- Prior survey: [`agent-memory-models.md`](agent-memory-models.md) (`statewalker/statewalker-root#156`)
