# Four kinds of code; fragments are trusted at install; untrusted code runs only in sandboxes

**Status**: accepted, 2026-11-19. Decided in
[Are third-party fragments in scope, and how are they isolated?](https://github.com/statewalker/statewalker-root/issues/117),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).

## Context

The platform runs four kinds of code (`GLOSSARY.md`):

- the **runtime** (CellB, CellD, wrangler/workerd, Cloudflare);
- **system code** (the kernel and core fragments: extensions, commands, agent sessions, the user's security model, l10n, branding, the fragment manager);
- **fragments**, installed by the user;
- **sandboxed code**, written by the user or an agent and built on the fly from files.

Two existing documents bound the choices:

- **cellb `docs/security.md`.** A project's own Worker runs in the host's realm. Loaded Workers get a realm of their own but no CPU, memory or storage limits, and they keep the platform's APIs; untrusted code needs an opaque-origin iframe, a separate origin, a process or a container.
- **httpeers `docs/security-model.md`.** Remote code is acceptable only if it is trusted at install or isolated off-origin behind a broker.

## Decision

1. **One trust class for fragments.** Every fragment, whoever wrote it, is trusted once the user installs it deliberately, after a consent screen showing:
   - its source and publisher;
   - its content hash;
   - its required bindings and fragments;
   - the agent plugins it carries;
   - the extension points it contributes to.

   It runs with its host's authority:
   - its server half gets only its declared bindings and service bindings to its declared dependencies;
   - its client half has the shell origin's full authority.
2. **Only system code holds root authority.** The kernel and the core fragments ship with the platform and cannot be uninstalled. Only they hold root keys and issue capabilities: the user's identity, Biscuit roots, and grants to sandboxes and agent sessions.
3. **Untrusted code runs only in sandboxes**, and becomes a fragment only through an explicit, consented install. This covers user- or agent-written code and apps served by peers.
   - In the browser, a sandbox is an iframe on a random origin, which may hold its own CellB runtime or virtual Node.
   - On servers and in the cloud, a sandbox is a Dynamic Worker on Cloudflare, or a separate process or container (Wasmer pools) on CellD or Node, reusing the AI harness's executor kinds. CellB worker threads, and Dynamic Workers loaded by CellB or CellD, are not a boundary.

   A sandbox reaches the system only through a broker. Its grants are deny-by-default, visible to the user, and expressed in the AI harness's capability model, so agent sessions and sandboxes share one security system.

## Considered options

- **A second, sandboxed class of fragment for untrusted authors.** Rejected:
  - A fragment's client half is React in the shell's origin, sharing modules ([react-only-shell-with-shared-modules](2026-11-18-react-only-shell-with-shared-modules.md)). Sandboxing it would mean an iframe per fragment and a broker for every slot and command.
  - Untrusted UI already has two safe channels: A2UI surfaces rendered from catalog components, and sandboxes.
- **A separate permission system for sandboxes.** Rejected: it would duplicate the harness's capability model, and the user would face two kinds of grants.

## Consequences

- Installing a fragment is a security decision for the user. Signing and publisher verification come later; until then the record is source and hash.
- Code that agent tools or a sandboxing fragment (as in cellb.dev/sandbox) build and run executes on the harness executors under broker grants, never as a fragment.
- A fragment's client half can read anything the shell origin holds. Secrets such as LLM keys belong in server halves or behind proxies, not in client storage.
