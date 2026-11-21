# One command model in OpenAPI with opt-in exposures; humans are tools

**Status**: accepted, 2026-11-21. Decided in
[What does a fragment expose to agents: tools, A2UI surfaces, and the harness session link?](https://github.com/statewalker/statewalker-root/issues/185),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It amends [fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md) and [kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md).

## Context

Fragments offer functionality in several ways: commands on the client bus, typed contracts between server halves, tools for agents, HTTP endpoints for peers, and MCP for external agents. The earlier decisions described them separately, and said every command is also an agent tool.

The AI harness already defines tools as one OpenAPI 3.1 document each, with an `x-dev.cellb.harness` extension carrying permission and action kind (statewalker-root#90). It derives MCP from that document, and asks the user through `input_requests` (#108).

## Decision

1. **One command model.** A command is the single representation of anything a fragment offers: id, input, output and errors, declared as an OpenAPI operation, by hand or generated from Zod. Every command is callable on the internal bus (client) and over RPC (server).
2. **Opt-in exposures per command:**
   - `agent`: a harness tool, with an action kind of read, write or admin;
   - `http`: a REST endpoint;
   - `mcp`: offered through MCP; implies `http`.

   Commands are internal by default, and the consent screen lists each fragment's exposures.
3. **One catalogue.** A fragment's `.well-known/openapi.json` is its complete command catalogue, with exposures in an extension field. Harness tool documents and MCP are derived from it, never stored.
4. **Agent tools are ordinary harness tools.** `system.agents` projects `agent`-exposed commands into the harness format, with identity `<fragment-id>/<command-id>` and permission `tools.use:<fragment-id>/<command-id>`. Names are made provider-safe, with a reverse map, and labels come from l10n.
5. **Paths:**
   - HTTP-exposed commands are served at their operation's path under `/fragments/{id}/`, and under `/peers/{peerId}/fragments/{id}/` across HTTPeers;
   - MCP is at `/fragments/{id}/.well-known/mcp`, aggregated at `/.well-known/mcp`;
   - all of them go through the same capability checks.
6. **Humans are tools.** Agents ask the user through `system.agents/ask-user`, with an A2UI surface or a simple question schema. The answer is the tool result. It maps onto the harness's `input_requests`, shares one UI with approvals, is never blocked by mode, and returns "unavailable" when nobody can answer.

## Considered options

- **Separate models for commands, server operations, tools and endpoints.** Rejected: four declarations of one capability drift apart, and each would need its own permission story.
- **Every command offered to agents by default** (the 2026-11-18 rule). Rejected: UI-only and internal commands would flood tool lists and widen what agents can do without anyone choosing it.
- **A dedicated approval or question API beside tools.** Rejected: treating the human as a tool reuses the harness's input requests, permissions and UI.

## Consequences

- `system.agents` also handles surfaces popped out to docks (`system.workbench/open-surface`), pending approvals and questions from any view, and workbench context on request (`system.workbench/get-context`, fed by the `agent-context` extension point). The chat UI is a separate fragment.
- The `.well-known/openapi.json` of [route-table-and-discovery](2026-11-21-route-table-and-discovery.md) is now the full catalogue, not only the HTTP contract. A peer's index and catalogue still show only what the caller may see.
