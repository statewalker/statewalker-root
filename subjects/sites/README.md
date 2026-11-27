# Sites and notebooks

Observable notebooks built to static sites, the site kit, and every statewalker project site.

Subject id `sites`. Root issues carry the label `subject:sites`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs sites
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Map [statewalker-root#232](https://github.com/statewalker/statewalker-root/issues/232), one standard for every project site (`/wayfinder statewalker-root#232`).
- The notebook work runs in cellb.dev's tracker (cellb.dev#236 next). Its handoff note is in `runtimes`, cellb.dev's subject.

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [statewalker-knowledge](https://github.com/statewalker/statewalker-knowledge) | L3 | Observable notebooks on a FilesApi, built to static sites |
| [webrun-sites](https://github.com/statewalker/webrun-sites) | L2 | Incremental build engine, module resolution and serving, site builder |
| [statewalker-sites](https://github.com/statewalker/statewalker-sites) | app | Private: documentation sites and blog (Cloudflare Workers) |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

Decisions that span several of this subject's projects. Name each file `adr/YYYY-MM-DD-<slug>.md`, and append its line here, newest last.

- [2026-11-25 site-kit-and-site-placement](adr/2026-11-25-site-kit-and-site-placement.md): the site kit is six published packages in statewalker-knowledge (notebook-build, notebook-pages, notebook-typecheck, site-kit, site-checks, site-api-reference); site content stays in each project's `site/`, checked in project CI; one site build, hub and deploy in statewalker-sites; cellb.dev keeps only the `NotebookSite` host.

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [api-reference-generation](research/api-reference-generation.md): Which tool generates API reference pages from TypeScript exports?
- [notebook-cell-transpile-and-source-maps](research/notebook-cell-transpile-and-source-maps.md): Can webrun-modules compile notebook cells, and how do source maps reach the Markdown?
- [notebook-cell-validation](research/notebook-cell-validation.md): What can validate notebook cells at build time, other than the TypeScript 5 compiler API?
- [notebook-site-pipeline](research/notebook-site-pipeline.md): How far are notebook-build and cellb.dev's notebooks theme from a static site build in CI?
- [project-site-hosting](research/project-site-hosting.md): What are the hosting options for every project site and its demos?
- [project-sites-inventory](research/project-sites-inventory.md): What do the statewalker sites look like today?

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
