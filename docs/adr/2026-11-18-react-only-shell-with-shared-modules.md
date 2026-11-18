# The shell is React only, with shared modules and per-fragment CSS

**Status**: accepted, 2026-11-18. Decided in
[Shell chrome: dockview-react with shadcn, or dockview-core with Basecoat?](https://github.com/statewalker/statewalker-root/issues/116),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).

## Context

The Drive note "06 Cross-Cutting Comparison and Recommended Shell Direction" (2026-10-02) recommended a framework-neutral shell: dockview-core, Basecoat-styled DOM chrome and a headless kernel, with React as just one panel adapter. Since then:

- `statewalker-shell-react` has shipped `dockview-react`, shadcn and Tailwind v4.
- [Client spec layer](https://github.com/statewalker/statewalker-root/issues/115) decided that hand-written views are plain React and that the A2UI catalog is built on shadcn.
- dockview 8.9 added a pointer drag backend with long-press touch support, which removes the reason to avoid dockview on touch devices.

Fragments are installed while the platform runs ([fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md)), so their client code and CSS arrive after the shell has been built.

## Decision

1. **React is the only view technology inside the shell:** `dockview-react` + shadcn + Tailwind v4, evolved from `statewalker-shell-react`. Anything not written in React runs as an iframe app (`webrun-site-host`). There is no framework-neutral `mount(el)` adapter.
2. **Shared client modules.** The shell provides one instance each of `react`, `react-dom`, `ui.view.shadcn`, `dockview-react` and the platform client API, through an import map. Fragments' client bundles mark them as external. Their versions are part of `engines.platform`, so a fragment built against an incompatible shell is refused at install.
3. **CSS per fragment.** Each fragment ships prebuilt CSS with only the Tailwind utilities it uses, compiled against the shared shadcn tokens and without preflight. Duplicated utility rules across fragments are accepted.

## Considered options

- **dockview-core + Basecoat + React as one adapter** (the Drive recommendation). Rejected: it keeps two view technologies in step for no current user, while every view and catalog component is now React.
- **One stylesheet recompiled in the browser on each install** (`webrun-tailwind`). Rejected: it is heavier, and it needs every fragment's sources at hand.
- **Fragments bundling their own React.** Rejected: separate React instances break hooks and context across fragments.

## Consequences

- A non-React UI, such as a Theia or VS Code view, enters only as an iframe app.
- Upgrading React, shadcn or dockview in the shell is a platform version change that fragments declare against.
- The shell gains shadcn's Menubar, DropdownMenu, ContextMenu, Command and Sonner pieces. They are rendered from extension points that [the core fragments](https://github.com/statewalker/statewalker-root/issues/150) declare.
