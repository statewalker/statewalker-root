# Fragment manifest: per-aspect files, extension points and a minimal kernel

**Status**: accepted, 2026-11-18. Decided in
[Fragment manifest: which files declare server services and client contributions?](https://github.com/statewalker/statewalker-root/issues/114),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It builds on [fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md).

## Context

A fragment (`GLOSSARY.md`) needs an on-disk format that carries several things:

- its identity and requirements;
- its server half (a `wrangler.jsonc` project);
- its contributions to the shell;
- any agent plugins it carries.

The harness already loads Agent Plugins directories (`docs/research/plugin-and-tool-layouts.md`), so reusing `plugin.json` as the fragment manifest was the obvious candidate. The existing statewalker fragments (`backbone.*`, `kernel.core`) register everything in code when they are activated. Eclipse and Theia show the other way: static extension points and extensions, with code loaded lazily.

## Decision

1. **A fragment is a distribution unit, not an agent plugin.** It may carry agent plugins, by default in `agent/<plugin>/`, each a complete Agent Plugins directory, but its own manifest is separate. Its id is reverse-domain, globally unique and never changes. The server half's Worker `name` is derived from it, and the installer checks that they match.
2. **One file per aspect, at the root:**
   - `fragment.jsonc` holds the id, version, `requires`, `engines.platform`, required `bindings` and the aspects present;
   - `wrangler.jsonc` is the server aspect, unchanged standard wrangler;
   - `fragment.<aspect>.jsonc` holds every other aspect (`client`, `agent`);
   - the OpenAPI contract of the server half sits beside `wrangler.jsonc`;
   - the default folders are `server/`, `client/` and `agent/<plugin>/`, and a `dir` field per aspect overrides them.

   An optional `fragment.config.ts` generates all of them, and the generated JSON is the contract:
   - every file carries a versioned `$schema`;
   - every schema inside is JSON Schema 2020-12;
   - the namespace is `org.statewalker.fragment` (provisional).
3. **The platform fixes the aspects** (`server`, `client`, `agent`). Fragments cannot add aspects. They open **extension points** instead: an id qualified by the declaring fragment (`<fragment-id>/<name>`) plus a schema, declared inside one aspect file. Other fragments contribute **extensions** in the same aspect.
4. **Extensions are static data plus an optional lazy code reference**: a client module export, a server service-binding entrypoint method, or a command id. Code may add runtime extensions through slots. The owner of an extension point reads one registry per aspect, with change events.
   - Contributing needs no dependency on the owner.
   - Extensions whose owner is missing stay dormant until the owner arrives, and are validated against the owner's schema when it does. Files are validated against their `$schema` at install time.
5. **The kernel is minimal.** It loads fragments, routes extensions and runs the lifecycle. Commands, menus, views, settings, l10n and branding are extension points of core fragments, with short reserved ids.
6. **Commands** are declared statically, handled by the client or server half of any fragment and ranked by priority. Every command is also offered to agents as a tool, under Allow/Ask/Block.
7. **l10n and branding.** Message bundles are namespaced per fragment; language packs may translate other fragments' keys; `Intl` is used, and locale changes need no reload. One brand is active at a time (name, logo, colour tokens, default layout).
8. **Distribution and activation.**
   - The built folder is packed as one archive identified by its content hash; installing needs no build.
   - A fragment is enabled or disabled as a whole, and each aspect activates on its own: the client half on its activation events, the server half on its first request, agent plugins while the fragment is enabled.

## Considered options

- **`plugin.json` with namespaced folders (Agent Plugins).** Rejected: fragments and agent plugins are different kinds of things, and a fragment that carries no agent plugin would still have to look like one.
- **`wrangler.jsonc` as the whole manifest.** Rejected: client-only fragments have no Worker.
- **`wrangler.client.jsonc` style names, or a `.plugin/` config folder.** Rejected:
  - Wrangler users already name extra Worker configs `wrangler.<x>.jsonc`, so the client file would read as a second Worker.
  - A config folder breaks running `wrangler dev` unchanged in the fragment folder.
- **Aspects defined by fragments.** Rejected: aspects are application-wide; extension points give the open-endedness.
- **Everything registered in code at activation.** Rejected: menus, views and agent tools must be known before a fragment's code loads, so that activation can stay lazy.

## Consequences

- Existing kernel and shell-react fragments need static declarations generated for them. Their `init(ctx)` code shrinks to registering handlers.
- Which core fragments ship, and which extension points each one declares, is the next decision: [Which core fragments ship with the empty platform?](https://github.com/statewalker/statewalker-root/issues/150).
- **Conflict with [fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md), resolved** in [kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md): extension references are a third legitimate channel between fragments, wired by the kernel and scoped to the owner of the extension point.
- The lifecycle (states, version resolution, upgrades, removal) is decided in [Fragment lifecycle](https://github.com/statewalker/statewalker-root/issues/151).
