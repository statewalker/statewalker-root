# Product

SandClaw's open-source applications, the showcase sites, and the paid offer: managed services and on-premise packages.

Subject id `product`. Root issues carry the label `subject:product`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs product
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Map [statewalker-root#193](https://github.com/statewalker/statewalker-root/issues/193), the showcase sites, promotion criteria and the first offer of managed services and on-premise packages (`/wayfinder statewalker-root#193`). Its first ticket, #194, set the model: ADR [blocks-sandclaw-and-managed-services](../../docs/adr/2026-11-27-blocks-sandclaw-and-managed-services.md).

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [sandclaw](https://github.com/statewalker/sandclaw) | L7 | Chat and wiki apps; wiki.core, file-mounts.core, file-panels.core |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

Cross-subject, in `docs/adr/`:

- [2026-11-27 blocks-sandclaw-and-managed-services](../../docs/adr/2026-11-27-blocks-sandclaw-and-managed-services.md): StateWalker holds the MIT blocks, SandClaw (`sandclaw-ai`) the open-source applications; revenue from managed services and on-premise packages; showcase sites and measured interest decide promotion.

This subject's own decisions go to `adr/YYYY-MM-DD-<slug>.md`, listed here (`docs/agents/domain.md`).

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [monetization-strategy](research/monetization-strategy.md): How can the StateWalker projects make money, and what is the shortest path?

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
