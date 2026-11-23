# Commands and tasks stay two models with one execution context; the queue moves to L0

**Status**: accepted, 2026-11-23. Decided in
[Should commands, the task queue and JobManager share one platform model?](https://github.com/statewalker/statewalker-root/issues/204),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).
It amends [commands-exposures-and-agents](2026-11-21-commands-exposures-and-agents.md) (a fourth exposure, `task`) and [kernel-and-core-fragments](2026-11-20-kernel-and-core-fragments.md) (a twelfth core fragment, `system.tasks`).

## Context

The platform had three ways of asking for work:

- **Commands** (`@statewalker/shared-commands`, L0, and the kernel's `system.commands`). An in-process call-and-wait bus, with one claiming listener per key. It has no call id, no cancellation, no progress, and no rule that payloads be serializable (`pick-file` returns `Blob[]`).
- **The harness's task queue** (`@statewalker/ai-tasks` in statewalker-ai, built for statewalker-root#160; 0.1.0 published on 2026-11-23). A durable per-project queue with subjects, subscriptions, leases, retries, dead letters, replies and a job log. Its envelope carries no harness types.
- **JobManager** (`statewalker-sandbox/apps/jobs-manager`, private). Runs scripts as OS processes on Node, with a durable stamped log and interruption.

Nothing connected the three, and the word "job" meant something different in each, as did "task" and "executor".

## Decision

1. **Two models, one execution context.**
   - A **command** call is synchronous for its caller and may carry live objects.
   - A **task** is a durable message, delivered at least once, whose sender does not wait.
   - Both run code with the same context: `callId`, `signal: AbortSignal` and `progress(entry)`.
     - The kernel's `CommandContext` becomes `{ command, callId, signal, progress }`, and `CommandBus.call` takes an optional `{ signal, onProgress }`.
     - `shared-commands` only passes an optional `signal` through to listeners.
2. **The queue contract moves to L0**, as `@statewalker/shared-tasks` in statewalker-shared. It holds:
   - the envelope, `Subscription`, `Lease` and `Processor`;
   - the subject matcher and the runner `serveSubscription`;
   - the queue over `SqlLike`, with an in-memory SQLite path for tests.

   `@statewalker/ai-tasks` is no longer developed: its published 0.1.0 is deprecated on npm in favour of `@statewalker/shared-tasks`, with no re-export shim. The human runs the deprecation once; no agent does. statewalker-ai keeps the Durable Object hosting, the rights checks and the agent tool, and depends on `shared-tasks` directly. shared-tasks releases first.
3. **`task` is a fourth exposure.**
   - A command exposed this way gets a subscription `<fragment-id>/<command-id>` on the subject `fragments.<fragment-id>.<command-id>`, created when the fragment activates.
   - The runner turns each lease into a bus call: the task id becomes `callId`, the lease's signal becomes `signal`, and `progress` is written through `renew`. The command's output becomes the reply.
   - Only commands with pure-JSON input and output may take it, and only if their OpenAPI extension declares them `idempotent`. Handlers deduplicate by `callId` themselves; the platform does not deduplicate.
   - Callers reach the queue through `system.tasks/publish`, with `reply_to` set to an inbox.
4. **`system.tasks`, a twelfth core fragment.**
   - It holds one queue per host, in its fragment DO.
   - A publish under `fragments.<id>.` is forwarded to that fragment's home through the route table. Wildcard fan-out reaches only the subscriptions on the receiving host.
   - It cannot be disabled.
5. **Job log and cancellation.**
   - Job-log entries keep `{at, progress}`, where `at` is a strictly increasing stamp. `job(lease, {after, wait_ms})` resumes after a stamp, and the final entry records `done`, `error` or `cancelled`.
   - `cancel(taskId)` is allowed to the sender or to an admin. It removes a waiting task. For a leased task, the next `renew` answers "cancelled" and the runner aborts the signal. The reply then carries the error kind `cancelled`.
   - An aborted signal on a command call that was published as a task becomes `cancel`.
6. **JobManager becomes a Node-host processor**, `packages/host-jobs.node` in statewalker-platform.
   - The Node host offers it to fragments as a binding, and it runs only scripts shipped inside an installed fragment.
   - stdout and stderr lines become job-log entries. Cancellation sends SIGTERM, then SIGKILL.
   - Its separate REST/SSE/MCP API is not kept: commands and exposures replace it.
   - User and agent scripts go through the sandbox broker ([code-kinds-and-trust](2026-11-19-code-kinds-and-trust.md)), never through it.
7. **The harness keeps its own per-project queue.** It is another instance of the same contract. Crossing between the harness's queue and the platform's goes through commands: an agent-exposed `system.tasks/publish` in one direction, and the harness session API in the other.
8. **Names** (`GLOSSARY.md`):
   - task, subscription, lease, processor, job (one attempt under a lease), script (JobManager's former "task") and handler;
   - the queue's `Executor` is renamed `Processor` in `shared-tasks`, leaving "executor" to the harness's meaning (where session code runs).

## Considered options

- **One model: every command call is a task.** Rejected: it would force durability, JSON payloads and at-least-once delivery onto UI commands.
- **A re-export shim in `ai-tasks`.** Rejected: it had one release with no consumers outside statewalker-ai, and keeping the `Executor` alias would preserve the name this decision retires.
- **The task as the base, with commands as a fast path over it.** Rejected for the same reason, and because it reverses the command model that spec statewalker-root#215 is built on.
- **A queue per fragment DO**, with no wildcards across fragments. Rejected: fan-out to several subscribers is the point of subjects.
- **One queue per user, on a single "tasks home".** Rejected: every publish would leave the host even when publisher and subscriber sit side by side.
- **Exactly-once delivery.** Rejected: it needs transactions across stores that Durable Objects don't offer.
- **JobManager as its own fragment, or dropped.** Rejected: a Worker cannot spawn processes, so running scripts is a host capability, which is system code.
- **One queue shared by the harness and the platform.** Rejected: it would tie the harness's per-project rights model to the platform's.

## Consequences

- Spec statewalker-root#215 gains a "Tasks and jobs" section. Its build tickets come from `/to-tickets`: the shared-tasks move, the statewalker-ai switch (which ends with the human deprecating `ai-tasks`), `system.tasks`, the `task` exposure with the extended `CommandContext`, and `host-jobs.node`.
- JobManager leaves statewalker-sandbox as part of its dissolution.
- statewalker-ai's glossary must drop the queue sense of "Executor" and use "Processor" for it.
