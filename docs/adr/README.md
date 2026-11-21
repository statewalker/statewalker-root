# Architecture decision records

Ecosystem-wide decisions. File name: `YYYY-MM-DD-<slug>.md` (`../agents/domain.md`). Append one
line per ADR, newest last.

- [2026-11-14 root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md): this repository is where every session starts; state in issues, knowledge via one PR per session.
- [2026-11-14 ci-publishing-and-umbrella-retired](2026-11-14-ci-publishing-and-umbrella-retired.md): releases only through CI version pull requests; umbrella archived, its tools moved into `tools/`.
- [2026-11-14 two-tier-review](2026-11-14-two-tier-review.md): a short merge gate blocking only critical findings on every pull request, plus a weekly health review per project.
- [2026-11-14 issues-placed-by-subject](2026-11-14-issues-placed-by-subject.md): an issue about one project goes to that project's tracker; root holds plans and the process; deferred bugs are every open `bug` in a project.
- [2026-11-16 harness-in-statewalker-ai](2026-11-16-harness-in-statewalker-ai.md): the AI harness replaces statewalker-ai's agent stack; statewalker-ai drops to L3; Biscuit moves to its own L0 project.
- [2026-11-17 fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md): the fragment is the platform's unit of extension; its optional server half is always a `wrangler.jsonc` project, one Worker per fragment.
- [2026-11-18 fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md): `fragment.jsonc` + `wrangler.jsonc` + `fragment.<aspect>.jsonc`; platform-fixed aspects; extension points and extensions per aspect; a minimal kernel with core fragments.
- [2026-11-18 react-only-shell-with-shared-modules](2026-11-18-react-only-shell-with-shared-modules.md): React only inside the shell (iframes for the rest); one shared React/shadcn/dockview through an import map; prebuilt CSS per fragment.
- [2026-11-19 code-kinds-and-trust](2026-11-19-code-kinds-and-trust.md): runtime, system code, fragments, sandboxed code; fragments trusted at install; only system code issues capabilities; untrusted code only in sandboxes behind a broker.
- [2026-11-19 platform-project-and-fragment-repositories](2026-11-19-platform-project-and-fragment-repositories.md): statewalker-kernel becomes statewalker-platform (L4, shell-react merged in); `packages/`, `packages-react/`, `fragments/`, `apps/`; one `statewalker-fragment-<name>` repository per fragment.
- [2026-11-20 kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md): a minimal kernel with no extension points; eleven reserved `system.*` core fragments, including `system.profile` with the vault; extension references are a third channel between fragments.
- [2026-11-20 fragment-lifecycle](2026-11-20-fragment-lifecycle.md): states as membership in keyed slots; one version per host; consented installs; upgrades migrate forward with rollback only before migrations; data kept on removal; no manifest namespace.
- [2026-11-20 a2ui-client-spec-layer](2026-11-20-a2ui-client-spec-layer.md): A2UI 1.0 the only declarative UI layer; catalog components defined once (light definition, lazy view, bindable props, no unions); strict validation; events as a client-side extension; two-way binding for editable state.
- [2026-11-21 fragment-host-and-routing](2026-11-21-fragment-host-and-routing.md): one multi-project fragment host per host; one fragment DO per fragment; `/fragments/{id}/` and `/peers/{peerId}/fragments/{id}/` routing; cloneable-only contracts; unload and upgrade by graceful restart.
- [2026-11-21 route-table-and-discovery](2026-11-21-route-table-and-discovery.md): route table in the profile with the ServiceWorker forwarding `/fragments/{id}/`; one home per fragment per user; `.well-known` discovery (openapi.json, host.json, fragment index); explicit Move.
- [2026-11-21 commands-exposures-and-agents](2026-11-21-commands-exposures-and-agents.md): one command model declared in OpenAPI, callable on bus or RPC, with opt-in `agent`, `http` and `mcp` exposures; the catalogue at `.well-known/openapi.json`; humans are tools (`ask-user`).
