# A2UI 1.0 is the only declarative UI layer; catalog components are defined once and may be complex

**Status**: accepted, 2026-11-20. Decided in
[Client spec layer: A2UI, json-render, or both?](https://github.com/statewalker/statewalker-root/issues/115)
and amended after
[Prototype: an agent's A2UI surface rendered from a fragment catalog](https://github.com/statewalker/statewalker-root/issues/153),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).

## Context

Fragments and agents need a declarative way to put UI in the shell. json-render was published in `render.core`/`render.view.react`, and A2UI existed only in prototypes. A2UI 1.0 shipped on 2026-11-11, with `@a2ui/web_core` handling the protocol state.

A test-first prototype (statewalker-kernel, branch `claude/great-faraday-igm9os`, `protos/a2ui-surface/`, 39 tests) checked the design end to end. It included complex components: a CodeMirror 6 editor and a Leaflet map.

## Decision

1. **A2UI 1.0 is the platform's only declarative UI layer**, for UI that comes from an agent or a server half. Specs come from three sources, all rendered by one renderer: an agent (A2UI messages in harness session items and events), a fragment's server half (over its HTTP/WebSocket boundary), and rarely a static surface declared by a client half. Hand-written views are plain React. `render.core`/json-render is deprecated until its users move, and a one-time adapter imports its catalogs as A2UI entries.
2. **Catalog components are defined once**, in the fragment's `catalog/`, with `defineComponent({ name, props: <Zod>, events: <Zod>, render })`. They are privileged code, reviewed like any fragment code. The definition generates the A2UI catalog entry, types the React props, and maps events to commands or server calls.
   - Each component is a light, static definition plus a view that loads lazily on first use.
   - Props are data-bindable by default (A2UI dynamic types). `literalOnly` marks props whose change means placing a new component.
   - Unions in props are refused; nullable is handled by a rewrite, because `@a2ui/web_core` does not check `anyOf`. Bound values are re-checked against the Zod schema.
3. **Trust.** Specs are untrusted. They render only registered catalog components, with no script and no raw HTML. `@a2ui/web_core` runs with strict validation, so unknown components are rejected on input. Arbitrary code runs only as iframe apps or in sandboxes ([code-kinds-and-trust](2026-11-19-code-kinds-and-trust.md)).
4. **Events and state.** User actions become platform commands, or calls to the server half that sent the surface, and agent-originated actions pass Allow/Ask/Block.
   - Component events are a client-side extension of A2UI, routed by the component type read from the surface model, never from the payload.
   - Editable state uses two-way binding: a view writes back to its bound data path, and events carry intent.
5. **The renderer** is our own thin one: `@a2ui/web_core` for the protocol, with our React catalog on shadcn. `@a2ui/react` is not used. The base catalog holds at least Text, Column and Button; Row and Card are cheap additions.
6. **Versions.** A2UI 1.0 is pinned. 0.9.1 input is accepted through an upgrade shim, which drops theme and heading variants. Newer versions are adopted deliberately, by ticket.

## Considered options

- **json-render as the definition or wire layer.** Rejected: it brings an unused spec runtime, and needs a mapping kept in step with two libraries. Guideline K also limited it to generated UI.
- **`@a2ui/react`.** Rejected: its own components and styling clash with shadcn.
- **Events only, no write-back.** Rejected: in the prototype, an agent update built from a stale copy of the data overwrote the user's unsaved typing.

## Consequences

- Complex components (editors, maps, viewers) are ordinary catalog components. Their views keep internal state across agent updates and apply only real changes.
- Until upstream exports Lit-free definitions, the A2UI basic catalog pulls in Lit web components (about 840 kB in the prototype). Asking the A2UI project to export Lit-free v1 basic definitions is still to do, left for the human or a session with access to that repository.
- Not solved yet: patching large documents instead of resending them, and conflicts between an agent's update and a pending write-back.
