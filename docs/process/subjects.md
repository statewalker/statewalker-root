# Working by subject

The ecosystem is developed as **subjects**: groups of projects with one direction, one set of plans
and one body of knowledge.
- [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md) lists the subjects.
- [`subjects/subjects.json`](../../subjects/subjects.json) assigns every project to one.
- [ADR subjects-layout](../adr/2026-11-27-subjects-layout.md) records why.

This page answers five questions: where does everything stand, what comes next, how do I continue
a piece of work, how do I add a subject or a project, and how do I keep it all current.

## 1. Where does everything stand?

```bash
node tools/status.mjs                  # every subject
node tools/status.mjs vcs platform     # some subjects
node tools/status.mjs --no-projects    # root issues and notes only (faster)
```

The command reads GitHub live (`gh` must be authenticated) and the handoff indexes on disk. It
prints a summary table, then one section per subject:

| Section | Meaning | What to do with it |
|---|---|---|
| **Plans** | open Wayfinder maps (`wayfinder:map`) and specs (title `Spec: …`), with how many of their tickets are done | the subject's entry points: read the plan before choosing a ticket. "All tickets done" means close the plan or add the next tickets |
| **Status unknown** | tickets whose comments could not be read (the command also warns on stderr) | check them by hand before claiming; run again |
| **Next for an agent** | free tickets with no open blocker: `ready-for-agent`, or `wayfinder:research` / `prototype` / `task` | claim one and start (`docs/agents/issue-tracker.md`, "Claiming a ticket") |
| **Waiting on the human** | `ready-for-human`, a latest `Waiting on human:` comment, a ticket assigned with no claim, or an unblocked `wayfinder:grilling` (even while a session holds it: the grilling needs the human's answers) | the human answers, decides, or comments `Resumed:` |
| **Taken** | the latest status line is `Claimed …`, with activity in the last 48 hours | leave it |
| **Stale claims** | claimed, then no comment for over 48 hours: an interrupted session | check that the session, its branch and its pull request are idle too. Only then release it with `Released: stale claim …` and take it; otherwise ask the human (`docs/agents/issue-tracker.md`, "Stale claims") |
| **Blocked** | an open blocking issue | work the blocker first |
| **To triage** | `needs-triage`, `needs-info`, or no triage label | `/triage` gives it acceptance criteria and a label |
| **Live handoff notes** | the current note per ticket in the subject's `handoffs/` | read it before continuing that ticket. "Ticket closed" means archive it if the work is finished |
| **Projects** | each project's open pull requests and open bugs | only for projects this session can read: in the cloud, the selected or attached ones |

Each subject's `README.md` adds what doesn't change daily: scope, projects, dated entry points, and
indexes of its decisions and research.

**What the report can't see.** A project's own issues and pull requests are visible only when the
session can read that project (`docs/process/sessions.md`, "A project that is not selected"). For a
project the report marks unreadable, say its state is unchecked rather than guessing.

## 2. What comes next?

Choose in this order (`docs/process/prevention.md`, "Picking your own work"):

1. **Escalated bugs** in the projects (`escalated` label), oldest first. When the report can't
   read a project, its bugs are unchecked: say so, and ask the human to attach the project before
   starting on that subject.
2. **The frontier** of the subject the human named, or of the subject with the most plans in
   flight. Take the first free ticket of a plan, in map order.
3. **Tickets to triage**, when the frontier is empty.
4. **Waiting on the human:** never work these. List them for the human at the end of the session,
   and at its start when they asked for the state.

## 3. Continue a piece of work

1. Find its ticket in the report, or in the subject's `README.md` under "Entry points".
2. Read the ticket and its comments, and claim it (`docs/agents/issue-tracker.md`). A stale claim
   is released first ("Stale claims" there).
3. Read the ticket's current handoff note: the last line for the ticket in
   `subjects/<s>/handoffs/README.md`, or in `docs/handoffs/README.md` for `process`. Follow its
   "Replaces" link when it says earlier rules still apply.
4. Read the subject's ADRs and the research the ticket links.
5. Work it through the route in `docs/process/README.md`. **While working, checkpoint** at each
   milestone with a `Progress:` comment on the ticket, so an interruption loses nothing
   (`docs/agents/issue-tracker.md`, "Checkpoints"). At the end:
   - write a handoff note in the same subject, only if the issues can't hold what is left
     (`docs/process/handoffs.md`, "When to write a note");
   - archive the notes it replaces;
   - when the ticket closes, archive the ticket's notes.

## 4. Add a subject

A subject is worth adding when work spans several projects, or keeps coming back, and fits no
existing subject. One root pull request:

1. **`subjects/subjects.json`**: add `"<id>": { "title", "folder": "subjects/<id>", "summary",
   "projects": [...] }`. Moving projects from another subject is allowed: a project is in
   exactly one subject.
2. **`subjects/<id>/README.md`**: copy the shape of an existing subject's README, with the
   sections Where it stands, Entry points (dated), Projects, Decisions, Research and Handoffs.
3. **`subjects/README.md`**: a row in its table.
4. **`subjects/<id>/handoffs/README.md`** and **`subjects/<id>/handoffs.archive/README.md`**,
   each with a heading, a pointer to `docs/process/handoffs.md` and an empty `## Notes` list.
5. **`GLOSSARY-MAP.md`**: a row in the table (`` | `<id>` | ... | ``) and its relationships.
6. **The label:** put `subject:<id>` on the subject's plans and standalone root issues. Their
   tickets inherit the parent's subject. GitHub creates the label on first use.
7. Run `node tools/check-docs.mjs` and `node tools/status.mjs <id>`.

## 5. Add a project

1. **Create the repository** in the `statewalker` organization: public, MIT, `main`. Only the
   human can do this.
2. **`repos.json`**: add `"<name>": "https://github.com/statewalker/<name>.git"`.
3. **`subjects/subjects.json`**: add the name to exactly one subject's `projects`.
4. **`CLAUDE.md`'s project table** and **`docs/projects.md`**: add its layer and what it holds.
   The layer comes from its published `@statewalker/*` dependencies.
5. **The subject's `README.md`**: add a row to its Projects table.
6. **Bring it to the conventions:** `node tools/adopt.mjs <dir>` sets up the shared CI,
   Dependabot, changesets and lockfile updates.
   - The human adds the npm trusted publisher for the project's first package and publishes its
     first version once (`docs/process/README.md` §4).
7. Run `node tools/check-docs.mjs`. It fails when a project in `repos.json` has no subject.

Removing or archiving a project reverses these steps. Archived projects are listed in `CLAUDE.md`
as "do not change" and leave `repos.json` and `subjects.json`.

## 6. Keep it current

**The rule: the root reflects a subject's progress only where a new session needs it to continue
on its own.** Advancing a subject (updating tickets, merging features, a grilling session, a
research answer) changes the root only in these cases:

| What happened | What changes in the root |
|---|---|
| A ticket moved, a feature merged, a grilling answer was given | Nothing beyond a `Progress:` comment on the ticket (and a handoff note only when the issues can't hold what is left). `status.mjs` reads the rest |
| A project was renamed, added or archived | `repos.json`, `subjects.json`, `CLAUDE.md`'s table, `docs/projects.md`, `GLOSSARY-MAP.md`, the subject README (§5) |
| A plan opened, closed or changed direction | The subject README's dated "Entry points" |
| A hard-to-reverse decision was made | An ADR in `subjects/<s>/adr/`, with its line in the README |
| A root ticket's question was answered by research | A note in `subjects/<s>/research/`, with its line in the README |
| A session stopped with work left | A handoff note, which also archives the notes it replaces |
| A project or subject was added, moved or removed | `subjects.json`, `GLOSSARY-MAP.md`, the README's Projects table (§4, §5) |

Never copy into the root what is already in the code, a project's docs, an ADR or a ticket. Link
to it.

Placement and upkeep:

- **Placement:** a decision, research note or handoff goes to the folder of its subject, as in the
  `GLOSSARY-MAP.md` table "Where terms and decisions go". The process and cross-subject ones go to
  `docs/`.
- **Indexes:** when you add an ADR or research note, append its line to the subject README's
  Decisions or Research list. The cross-subject ones go to `docs/adr/README.md` and
  `docs/research/README.md`.
- **Entry points:** when a plan opens or closes, update the subject README's "Entry points" and its
  date.
- **Labels:** a new plan or standalone root issue gets its `subject:` label at creation.
  `status.mjs` lists issues without a subject under **unsorted**, where they wait for a label.
- **Moving a file between subjects:** use `git mv`, then repoint every relative link to it.
  `node tools/check-docs.mjs` fails on any link you miss. Inside a merged handoff note, only link
  targets may change.
