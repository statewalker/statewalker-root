# AI harness

Agent sessions, definitions, access and code execution (light containers, containers) on CellB, CellD and Workers.

Subject id `ai-harness`. Root issues carry the label `subject:ai-harness`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs ai-harness
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Map [statewalker-root#70](https://github.com/statewalker/statewalker-root/issues/70) (`/wayfinder statewalker-root#70`) and spec [statewalker-root#111](https://github.com/statewalker/statewalker-root/issues/111).
- The spec's tickets are #417 to #432, in two tracks, light container and container. Most wait on [#98](https://github.com/statewalker/statewalker-root/issues/98) (create `webrun-capabilities`).

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [statewalker-ai](https://github.com/statewalker/statewalker-ai) | L3 | The AI harness: environment, access, definitions, sessions, Flue adapter, hosting, OpenAI/UHP projections (spec statewalker-root#111) |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

Decisions that span several of this subject's projects. Name each file `adr/YYYY-MM-DD-<slug>.md`, and append its line here, newest last.

- [2026-11-16 harness-in-statewalker-ai](adr/2026-11-16-harness-in-statewalker-ai.md): the AI harness replaces statewalker-ai's agent stack; statewalker-ai drops to L3; Biscuit moves to its own L0 project.

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [agent-memory-models](research/agent-memory-models.md): How do agent harnesses keep memory across sessions?
- [external-wasmer-executor-pools](research/external-wasmer-executor-pools.md): Can a pool of external Wasmer-based executors serve Durable Objects?
- [flue-capfs-do-inventory](research/flue-capfs-do-inventory.md): What in flue-capfs-do maps to which harness module?
- [flue-full-runtime-on-capabilities](research/flue-full-runtime-on-capabilities.md): How far can Flue's full runtime run on the capability environment?
- [flue-runtime-surface](research/flue-runtime-surface.md): What does Flue need from a sandbox, tools and a model, and where is the seam for other cores?
- [harness-session-apis](research/harness-session-apis.md): Which session and thread APIs should the harness align with?
- [hermes-agent-memory](research/hermes-agent-memory.md): How does the Hermes agent harness create, manage and use memory?
- [lightweight-containers-on-do-runtimes](research/lightweight-containers-on-do-runtimes.md): Can lightweight containers run on cellb, celld and workerd alike?
- [mcp-and-skills-on-do](research/mcp-and-skills-on-do.md): How do MCP servers and skill definitions work on Durable Object runtimes?
- [node-python-clis-in-sandbox](research/node-python-clis-in-sandbox.md): Can tools run as node and python CLIs inside the sandbox?
- [plugin-and-tool-layouts](research/plugin-and-tool-layouts.md): Which plugin, agent and tool layouts do coding harnesses share?
- [unified-harness-protocol](research/unified-harness-protocol.md): How stable is the Unified Harness Protocol, and how does it map onto the session API?

## Other knowledge

- [`upstream/`](upstream/wasmer-sdk/): changes prepared for upstream projects.

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
