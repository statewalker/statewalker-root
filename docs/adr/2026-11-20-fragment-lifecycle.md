# Fragment lifecycle: states as slot membership, one version per host, upgrades that migrate forward

**Status**: accepted, 2026-11-20. Decided in
[Fragment lifecycle: install, enable, per-aspect activation, dormant extensions, versions and upgrade](https://github.com/statewalker/statewalker-root/issues/151),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It amends [fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md) (no manifest namespace).

## Context

Fragments are installed while the platform runs ([fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md)), and each aspect activates on its own. Each fragment's server half keeps Durable Object data whose class migrations are declared in `wrangler.jsonc`. On Cloudflare, `deleted_classes` deletes that class's data. CellB today reports `renamed_classes` as unsupported and ignores `deleted_classes` ([cellb.dev#182](https://github.com/statewalker/cellb.dev/issues/182)).

The kernel's existing loader (`backbone.core`) already isolates failures per module and activates in topological order. `shared-slots` keyed slots offer `register`/dispose, `getSnapshot` and `observe`, and refuse a different value under an existing id.

## Decision

1. **States:**
   - installed → enabled or disabled;
   - once enabled, resolved or unresolved, with a reason;
   - once resolved, each aspect inactive, active or failed;
   - removed.

   "Dormant" stays a state of extensions only. Failures are isolated per fragment and aspect: dependents become unresolved, the others carry on, and the user can retry. Activation follows dependency order, and deactivation runs in reverse. Disabling a fragment that others require cascades only after the user confirms; without confirmation nothing changes.
2. **One version per fragment id per host.** Installs are consented, and missing dependencies are proposed on the same consent screen, all or nothing. An incompatible platform, a missing host binding or a version range that can't be met refuses the install.
3. **Upgrades migrate forward:** deactivate → swap the archive → run the DO class migrations and the fragment's data migrations → activate.
   - The previous archive is kept, and rollback works only before any migration has run.
   - `deleted_classes` needs explicit confirmation.
   - Class renames wait for CellB support.
4. **Data survives removal by default:** DO data and profile entries (settings values, secrets). "Remove with data" is a separate choice behind a confirmation.
5. **Where state lives:**
   - installed archives sit in a content-addressed store per host;
   - the enabled set and versions are in the profile;
   - an application's baseline fragments are installed on first run; they can be disabled but not uninstalled.
6. **Lifecycle state is membership in keyed slots:** `system:fragments:installed`, `:enabled`, `:resolved` and `:active:<aspect>`.
   - An ordinary state change (enable, resolve, activate) is a register or dispose in one slot, so the collision rule never applies and no entry briefly disappears.
   - The fragment manager, the extension registry and the workbench observe these slots.
   - An upgrade, which replaces the installed manifest, is dispose plus register. A `replace` operation is added to `shared-slots` only if that gap proves a problem.
7. **Repair while running.** When a fragment is disabled or removed:
   - its extensions leave every registry, with change events;
   - its menus, commands, keybindings, settings pages and agent tools disappear;
   - its views close, and saved layouts drop them;
   - extensions to its extension points go dormant;
   - the rest stays as it is.
8. **Extension references** are handed out only while the contributor is enabled and resolved. Calling one after that raises a defined `ExtensionUnavailable` error, never a hang. This answers the open item in [kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md).
9. **Only the user installs,** through `system.fragments` and its consent screen. Agents may propose an install through a command that is always Ask. Sandboxes never install.
10. **No manifest namespace.** The fragment's files need no namespace key. Their `$schema` URLs are versioned, neutral and configurable per distribution.

## Considered options

- **Side-by-side versions of one fragment.** Rejected: two Worker names, two copies of DO data, duplicate extensions.
- **One keyed slot holding a mutable state record per fragment.** Rejected: keyed slots refuse a new value under an existing id, so every state change would be a dispose plus register, with a moment where the fragment seems absent on every state change, not only on upgrade.
- **Rollback after migrations.** Rejected: DO migrations are not reversible in general, so rolling back would run old code on migrated data.
- **Deleting data on removal by default.** Rejected: reinstalling a fragment, a common mistake fix, would lose the user's data.

## Consequences

- **Upgrade flow.** `system.fragments` owns the consent screen, the cascade confirmation, the upgrade flow and "remove with data".
- **New registry.** The kernel needs a content-addressed archive store per host.
- **CellB parity.** CellB must apply `renamed_classes` and `deleted_classes` (cellb.dev#182) before fragments may rely on them.
