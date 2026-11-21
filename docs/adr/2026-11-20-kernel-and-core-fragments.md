# A minimal kernel, eleven `system.*` core fragments, and extension references as a third channel

**Status**: accepted, 2026-11-20; amended by [commands-exposures-and-agents](2026-11-21-commands-exposures-and-agents.md) (`tools` holds only commands exposed to agents). Decided in
[Which core fragments ship with the empty platform, and which extension points does each declare?](https://github.com/statewalker/statewalker-root/issues/150),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It amends [fragments-with-wrangler-server-halves](2026-11-17-fragments-with-wrangler-server-halves.md).

## Context

[fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md) made the kernel minimal and moved commands, menus, views, settings, l10n and branding into core fragments. Two questions remained open:

- **Which core fragments ship.** The 2026-11-18 ADR left this open.
- **A conflict over extension code references.** They let an extension point's owner call into a contributing fragment that neither side declares. The 2026-11-17 ADR allowed only commands on the client and declared dependencies on the server.

The packages in statewalker-kernel and statewalker-shell-react, and the vaults built before (statewalker-shell-theia's `theia-secret-vault`, and sandclaw's `file-mounts.core` with passkeys), are the material.

## Decision

1. **The kernel** holds:
   - the fragment registry and loader;
   - the extension registry per aspect;
   - the lifecycle engine;
   - the route table;
   - the `shared-slots`/`shared-commands` substrate.

   It declares no extension points.
2. **Extension references are a third channel** between fragments, beside commands and declared dependencies.
   - By contributing, a fragment exposes the referenced code only to the owner of that extension point.
   - The kernel wires it: it imports the module export on the client, and adds the service binding on the server, with no `requires`.
3. **Eleven core fragments, under the reserved prefix `system.`.** The kernel refuses that prefix from any fragment not shipped with the platform. Core fragment ids are the one exception to the reverse-domain ids of [fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md) (decision 1).

   | Core fragment | Extension points it declares |
   |---|---|
   | `system.commands` | `commands`, `keybindings` |
   | `system.workbench` | `views`, `menus`, `notifications`, `dialogs`, `statusbar`, `activitybar`, layouts per device mode |
   | `system.settings` | `settings` (schemas), plus the settings UI |
   | `system.appearance` | `branding`, `themes` |
   | `system.l10n` | `l10n` |
   | `system.a2ui` | `catalog`, plus the surface renderer |
   | `system.security` | `capabilities` (identity, grants, Allow/Ask/Block) |
   | `system.agents` | `agent-plugins`, `tools` (commands exposed to agents), plus the harness session API |
   | `system.fragments` | none; it is the fragment manager and consent screen |
   | `system.host` | `host-services` (clipboard, file pickers, URL state) |
   | `system.profile` | `secrets`; it stores settings values, saved layouts and the vault |

   Only `system.agents` can be disabled.
4. **Files, explorer, mime renderers and web apps are not core.** They move to fragment repositories. The empty platform has no file UI.
5. **The vault**, in `system.profile`, reuses sandclaw's design:
   - a random AES-GCM data key, wrapped by a PBKDF2 password key and by each passkey (WebAuthn PRF);
   - a non-extractable remembered key;
   - Web Locks across tabs;
   - a corrupt vault stays locked.

   Secrets are declared per fragment in `secrets` and namespaced by fragment id, and each fragment reads only its own, through `system.security`. Server halves get them as env bindings: from Cloudflare secrets on Cloudflare, injected from the vault by the host on CellB and CellD. Agents and sandboxes never receive secret values.

## Considered options

- **Extension references limited to command ids.** Rejected: views must reference React components, and server extensions such as data sources must reference entrypoint methods.
- **`org.statewalker.platform.*` ids.** Rejected: ids never change, and they surface in settings exports, logs, URLs and agent tool names. A brand-neutral prefix keeps white-labelled applications and forks clean.
- **The prefixes `core.*` or `platform.*`.** Rejected: the glossary marks "core" alone as ambiguous, and `platform.*` clashes with the existing kernel packages `platform.core`, `.browser` and `.node`.
- **The vault from the Theia app.** Rejected: sandclaw's version is newer, seals the whole profile and adds passkeys.

## Consequences

- statewalker-platform's `fragments/` holds these eleven fragments. Their packages come from statewalker-kernel, statewalker-shell-react, statewalker-ai, sandclaw, statewalker-shared (`shared-commands`, `shared-slots`) and httpeers (`webrun-biscuit`).
- Syncing a profile across devices is not designed yet.
- The lifecycle ([Fragment lifecycle](https://github.com/statewalker/statewalker-root/issues/151)) must keep extension references valid while fragments are enabled, disabled and removed.
