# P2P and capabilities

Byte channels and RPC (webrun-wire), the HTTPeers mesh, Biscuit capabilities, and the webrun-devtools extension.

Subject id `p2p`. Root issues carry the label `subject:p2p`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs p2p
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- [statewalker-root#430](https://github.com/statewalker/statewalker-root/issues/430), per-app Biscuit capabilities: the research is done. The redesign waits on the human's answers to §9 of [the analysis](research/webrun-devtools-capabilities.md), and then becomes a spec.
- [#98](https://github.com/statewalker/statewalker-root/issues/98) moves webrun-biscuit into its own project, `webrun-capabilities` (L0). The new project joins this subject: it holds capabilities. Its light container package serves `ai-harness`, whose tickets #417 to #432 wait on it.

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [webrun-wire](https://github.com/statewalker/webrun-wire) | L0 | Request/Response and RPC over byte channels (streams, msgpack, WebRTC, libp2p, ws) |
| [httpeers](https://github.com/statewalker/httpeers) | L2 | P2P HTTP mesh libraries + deployables (relay, hub, sites, session shell) |
| [webrun-devtools](https://github.com/statewalker/webrun-devtools) | app | Chrome extension for browser automation; publishes `@statewalker/webrun-devtools` |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

None yet. Write the first one as `adr/YYYY-MM-DD-<slug>.md` and list it here (`docs/agents/domain.md`).

## Research

One cited note per question, `research/<slug>.md`, linked from the ticket that asked it.

- [webrun-devtools-capabilities](research/webrun-devtools-capabilities.md): webrun-devtools on webrun-wire and Biscuit capabilities, and as an HTTPeers peer
- [webrun-devtools-debugging](research/webrun-devtools-debugging.md): Debugging and testing the extension; Obscura
- [webrun-devtools-multi-mesh](research/webrun-devtools-multi-mesh.md): Prototype: several meshes in one runtime, and the app ⇄ mesh cases
- [webrun-devtools-offscreen-hub](research/webrun-devtools-offscreen-hub.md): Prototype: httpeers hub and member inside the extension
- [webrun-devtools-pairing-biscuit](research/webrun-devtools-pairing-biscuit.md): Prototype: pairing, proof of possession and Biscuit capabilities in an MV3 service worker
- [webrun-devtools-port-pipe](research/webrun-devtools-port-pipe.md): Prototype: webrun-rpc over `chrome.runtime.Port`

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
