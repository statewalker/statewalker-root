## Summary

The SDK's core can already back a guest directory with an embedder filesystem (`mountHost`, `storageHost`) and reach a guest listener directly (`handleHttpRequest`, `connectTcp`), but the JavaScript API doesn't expose them. This PR exposes them, so an application embedding the SDK can **authorize every guest filesystem call and every request into a guest server itself**:

- **`SandboxOptions.mounts`** (`{ path, mount, readOnly? }[]`) and **`SandboxOptions.storage`** (`{ mount }`, used as `/workspace`): each guest filesystem call under a mount (`stat`, `readDir`, `open`, `read`, `write`, …) reaches the embedder as one request through the existing host-filesystem bridge. The embedder answers it, or refuses it with a code such as `EACCES`, which the guest sees as a permission error.
- **Node SDK workers install the host-filesystem bridge**, as browser workers already do, so mounts work in Node too.
- **`Ports.fetch(port, request)`** and **`Ports.connect(port)`**: send one HTTP request to a guest listener, or open a raw byte stream to it, without a ServiceWorker or a host port. Every request goes through the embedder's own code.
- **`@wasmer/sdk/host-filesystem`** export: `isHostFileSystemRequest` and `respondToHostFileSystem`, so embedders don't have to re-implement the reply encoding.

All of it is marked experimental, as the core's `mountHost` already is.

## Why: access control for untrusted code

We run AI agents for many users, inside Durable Objects (Cloudflare Workers, and compatible runtimes in Node and in browsers). Agents run Python and POSIX programs over a user's files. Those files sit behind a capability: each operation must be checked against the user's current rights (a role can be narrowed or revoked mid-run, a path can be hidden or read-only). Copying files into the sandbox and syncing them back can't do that: a revoked right still lets the run finish on its copy.

With `mounts`, the policy check happens per operation, in the embedder, at the moment of the call. The guest can't see a directory it isn't given, and every `open`, `read`, `write` or `rename` is a request the application can refuse. With `Ports.fetch`/`connect`, requests *into* a guest server go through the application's code too, with no host port opened. Outbound traffic stays under `NetworkPolicy` (`disabled` by default; a WISP endpoint the application controls can authorize each connection).

We have run exactly this change as a local patch on 0.19.1 (in `@statewalker/cellb-containers`, which implements Cloudflare's `ctx.container` API on the SDK). A local patch can't travel with a published package, though, so anyone installing our package from npm gets the unpatched SDK. Hence this PR.

## Tests

`js/tests/embedder-mounts.test.mjs`, registered in `scripts/test-node.mjs`:

- **Per-operation policy:** an embedder serves a read-only `/data` with one readable and one refused file. Python lists it, reads the allowed file, and gets `PermissionError` for the refused file and for a write. Every call reaches the embedder with its mount id.
- **Validation:** relative mount paths and out-of-range mount ids fail with `INVALID_ARGUMENT`.
- **`ports.fetch`:** a GET and a HEAD to Python's `http.server` inside the sandbox (`network: { mode: "http", peers: [] }`).
- **No ingress:** `ports.fetch`/`connect` fail with `CAPABILITY_UNAVAILABLE` on a sandbox without ingress networking.

**How they were run:** I couldn't build the wasm core locally, so I applied the same change to the `wasmer-sdk-js-v0.19.1` tag and ran it there with the published 0.19.1 bindings. All 4 new tests pass, and `host-filesystem` and `validation` still pass (6 and 7). On `main`, the TypeScript typechecks with this change; its only typecheck error against the 0.19.1 bindings is pre-existing (`allowLoopbackEgress`, a newer binding). The full suite on `main` is left to CI.

## Notes for review

- `HostMount.mount` uses the same name as the bridge protocol's `mount` field.
- The new options are validated before they reach the core builder.
- `Ports.fetch` drops the body for `HEAD`, 204, 304 and 1xx responses, as `fetch` does.
