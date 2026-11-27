# Fragment platform

The headless kernel, core fragments, the React shell and the hosts that serve fragments (browser, CellB Node, Workers).

Subject id `platform`. Root issues carry the label `subject:platform`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs platform
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Spec [statewalker-root#215](https://github.com/statewalker/statewalker-root/issues/215), the empty fragment platform, is built ticket by ticket (`/implement-spec`). `status.mjs platform` lists its open tickets in map order.
- [`roadmap.md`](roadmap.md) orders the tasks and jobs work. The [handoff index](handoffs/README.md) holds the latest session state.

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [statewalker-shared](https://github.com/statewalker/statewalker-shared) | L0 | Foundation: adapters, baseclass, commands, ids, logger, registry, slots |
| [statewalker-fsm](https://github.com/statewalker/statewalker-fsm) | L0 | Hierarchical state machines, validator, charts, viewer |
| [statewalker-kernel](https://github.com/statewalker/statewalker-kernel) | L4 | Headless workbench kernel: backbone, platform, workspace, explorer, shell |
| [statewalker-shell-react](https://github.com/statewalker/statewalker-shell-react) | L6 | Workbench React views (shell, explorer, settings, mime viewers, shadcn) |
| [statewalker-shell-theia](https://github.com/statewalker/statewalker-shell-theia) | app | Browser-only Eclipse Theia shell over a FilesApi |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

Decisions that span several of this subject's projects. Name each file `adr/YYYY-MM-DD-<slug>.md`, and append its line here, newest last.

- [2026-11-17 fragments-with-wrangler-server-halves](adr/2026-11-17-fragments-with-wrangler-server-halves.md): the fragment is the platform's unit of extension; its optional server half is always a `wrangler.jsonc` project, one Worker per fragment.
- [2026-11-18 fragment-manifest-and-extension-points](adr/2026-11-18-fragment-manifest-and-extension-points.md): `fragment.jsonc` + `wrangler.jsonc` + `fragment.<aspect>.jsonc`; platform-fixed aspects; extension points and extensions per aspect; a minimal kernel with core fragments.
- [2026-11-18 react-only-shell-with-shared-modules](adr/2026-11-18-react-only-shell-with-shared-modules.md): React only inside the shell (iframes for the rest); one shared React/shadcn/dockview through an import map; prebuilt CSS per fragment.
- [2026-11-19 platform-project-and-fragment-repositories](adr/2026-11-19-platform-project-and-fragment-repositories.md): statewalker-kernel becomes statewalker-platform (L4, shell-react merged in); `packages/`, `packages-react/`, `fragments/`, `apps/`; one `statewalker-fragment-<name>` repository per fragment.
- [2026-11-20 kernel-and-core-fragments](adr/2026-11-20-kernel-and-core-fragments.md): a minimal kernel with no extension points; eleven reserved `system.*` core fragments, including `system.profile` with the vault; extension references are a third channel between fragments.
- [2026-11-20 fragment-lifecycle](adr/2026-11-20-fragment-lifecycle.md): states as membership in keyed slots; one version per host; consented installs; upgrades migrate forward with rollback only before migrations; data kept on removal; no manifest namespace.
- [2026-11-20 a2ui-client-spec-layer](adr/2026-11-20-a2ui-client-spec-layer.md): A2UI 1.0 the only declarative UI layer; catalog components defined once (light definition, lazy view, bindable props, no unions); strict validation; events as a client-side extension; two-way binding for editable state.
- [2026-11-21 fragment-host-and-routing](adr/2026-11-21-fragment-host-and-routing.md): one multi-project fragment host per host; one fragment DO per fragment; `/fragments/{id}/` and `/peers/{peerId}/fragments/{id}/` routing; cloneable-only contracts; unload and upgrade by graceful restart.
- [2026-11-21 route-table-and-discovery](adr/2026-11-21-route-table-and-discovery.md): route table in the profile with the ServiceWorker forwarding `/fragments/{id}/`; one home per fragment per user; `.well-known` discovery (openapi.json, host.json, fragment index); explicit Move.
- [2026-11-21 commands-exposures-and-agents](adr/2026-11-21-commands-exposures-and-agents.md): one command model declared in OpenAPI, callable on bus or RPC, with opt-in `agent`, `http` and `mcp` exposures; the catalogue at `.well-known/openapi.json`; humans are tools (`ask-user`).
- [2026-11-23 commands-tasks-and-jobs](adr/2026-11-23-commands-tasks-and-jobs.md): commands and tasks stay two models sharing one execution context (call id, signal, progress); the queue contract moves to L0 `shared-tasks` (`ai-tasks` deprecated); a `task` exposure; `system.tasks` as a twelfth core fragment; JobManager becomes a Node-host processor.

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [fragment-do-rpc](research/fragment-do-rpc.md): Can a fragment's capabilities be a named Durable Object called over RPC by other fragments?
- [openapi-mcp-tool-mapping](research/openapi-mcp-tool-mapping.md): How are OpenAPI tool definitions generated and projected to MCP and Flue tools?
- [unified-do-platform](research/unified-do-platform.md): What already exists for a unified fragment platform on CellB, CellD and Workers?
- [apps-to-port](research/apps-to-port.md): Which applications are candidates to port or adapt to the platform (HeyPuter/everything, extend-hq/ui, the storytold Craft apps)?

## Other knowledge

- [`roadmap.md`](roadmap.md): the plan in prose. The tickets stay the source of truth.

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
