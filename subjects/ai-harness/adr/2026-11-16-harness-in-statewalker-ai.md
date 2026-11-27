# The AI harness lives in statewalker-ai, which drops to L3

**Status**: accepted, 2026-11-16. Decided in
[Where does the harness live?](https://github.com/statewalker/statewalker-root/issues/84), on the
map [statewalker-root#70](https://github.com/statewalker/statewalker-root/issues/70).

## Context

The prototype `statewalker-sandbox/apps/flue-capfs-do` (Flue agents on Durable Objects over a
Biscuit-checked capability file system) is becoming the main AI harness for CellB, CellD and
Cloudflare Workers. The sandbox-dissolution plan sent it to `cellb.dev/examples/`.
`statewalker-ai` held an older agent stack at L5: an AI SDK agent library and workspace fragments
that depend on the kernel. Its only consumers are sandclaw's private chat-mini app and two
shell-react settings views. The harness needs nothing from the kernel. Its published dependencies
are `webrun-biscuit`, `webrun-wire`, `webrun-files`, `webrun-bundler` and Flue. `webrun-biscuit`
is a generic token and Datalog library that happened to live in httpeers.

The alternatives were a new project (`statewalker-harness`) at L3, or cellb.dev, which would tie a
runtime-agnostic harness to one host.

## Decision

1. **The harness lives in `statewalker-ai`** and replaces its agent stack. The packages are
   `ai-environment`, `ai-access`, `ai-definitions`, `ai-sessions`, `ai-flue`, `ai-host-do` and
   `ai-openai-compat`, named without a `.core` suffix. The other five old packages are removed from
   the repository; their published versions stay on npm.
2. **`statewalker-ai` resets its dependencies and moves from L5 to L3**: no kernel, `fsm`, db or
   search in the harness packages. Advanced tools and specialized agents, built later as Agent
   Plugins in the same repository, may use `statewalker-search` and `statewalker-db` (lower
   layers).
3. **Biscuit moves to its own L0 project, `statewalker-biscuit`**, keeping the npm name
   `@statewalker/webrun-biscuit`
   ([statewalker-root#98](https://github.com/statewalker/statewalker-root/issues/98)).
4. **Flue is the execution core**, with pi reached through it. `flue-capfs-do` is carved into the
   packages; `flue-workbench` becomes `statewalker-ai/apps/workbench`. The harness's glossary and
   ADRs live in `statewalker-ai`.

## Consequences

- `statewalker-ai` releases right after httpeers, webrun-sites and statewalker-biscuit, and before
  the kernel. The `CLAUDE.md` project table and `docs/projects.md` change when the reset lands,
  not before.
- sandclaw's chat-mini moves to the harness's session API, and the two shell-react views are
  removed. Until then they stay on the last published versions.
- httpeers depends on `statewalker-biscuit` instead of holding the library.
- `cellb.dev/examples/flue` remains cellb's own demo; cellb.dev receives nothing from the sandbox.
