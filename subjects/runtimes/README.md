# Durable Objects runtimes

CellB (isomorphic Durable Objects runtime, in Node and in a browser tab), CellD, and running other engines on them.

Subject id `runtimes`. Root issues carry the label `subject:runtimes`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs runtimes
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- There is no map yet. The open questions are root issues with no plan: #189, #277 and #278. Their next step is triage (`/triage`), or a map (`/wayfinder`) once they form one destination.
- CellB's own bugs and features live in cellb.dev's tracker.

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [cellb.dev](https://github.com/statewalker/cellb.dev) | L3 | cellb: isomorphic Durable Objects runtime; platform packages, examples, site (after statewalker-knowledge) |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

Decisions that span several of this subject's projects. Name each file `adr/YYYY-MM-DD-<slug>.md`, and append its line here, newest last.

- [2026-11-27 unkernel-not-integrated-now](adr/2026-11-27-unkernel-not-integrated-now.md): unkernel (Linux in wasm) is not integrated now (workerd stalls, young upstream, cost); Docker (OCI) images on it, with a data-only FilesApi, are the option to revisit.

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [almostnode-on-do-runtimes](research/almostnode-on-do-runtimes.md): Does almostnode run on CellD and workerd?
- [cellb-frame-nodes](research/cellb-frame-nodes.md): Can CellB spread Durable Objects over more workers, frames and threads, with the host's FilesApi as their store?
- [in-browser-sandboxes](research/in-browser-sandboxes.md): Sandboxes that run in the browser: a survey
- [unkernel-evaluation-procedure](research/unkernel-evaluation-procedure.md): unkernel as a container for cellb, celld and workerd: procedure, results, conclusion
- [unkernel-oci-images-js-python](research/unkernel-oci-images-js-python.md): unkernel for JS and Python: Docker images, resources, and Wasmer or QuickJS?
- [unkernel-on-cellb-and-workerd](research/unkernel-on-cellb-and-workerd.md): Can unkernel be a container for cellb, celld and workerd, with FilesApi mounts?

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
