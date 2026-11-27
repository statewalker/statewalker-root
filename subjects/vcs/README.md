# Version control

webrun-vcs: a git-compatible VCS in TypeScript on web APIs only, with parity against native git.

Subject id `vcs`. Root issues carry the label `subject:vcs`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs vcs
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Plan [statewalker-root#282](https://github.com/statewalker/statewalker-root/issues/282) is closed. The follow-up batches continue from its latest handoff note, under the human's standing rules (portability, MessagePorts, real git compatibility).
- [`roadmap.md`](roadmap.md) holds the plan's waves. The open design questions are #217 and #414.

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [webrun-vcs](https://github.com/statewalker/webrun-vcs) | L3 | Git-compatible VCS in TypeScript; examples, demos, benchmarks |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

None yet. Write the first one as `adr/YYYY-MM-DD-<slug>.md` and list it here (`docs/agents/domain.md`).

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [git-jgit-feature-coverage](research/git-jgit-feature-coverage.md): What do native git and JGit do, and how much of it does webrun-vcs cover?
- [webrun-vcs-agent-cost-and-throughput](research/webrun-vcs-agent-cost-and-throughput.md): What did two weeks of agent work on webrun-vcs produce, and what did it cost?

## Other knowledge

- [`roadmap.md`](roadmap.md): the plan in prose. The tickets stay the source of truth.

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
