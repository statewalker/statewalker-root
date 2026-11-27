# Tasks and jobs: implementation plan

How the "Tasks and jobs" part of the fragment platform is built: the order of the work, where each
piece goes, and how each ticket is approached. This file is the readable overview and does not
change as work progresses. The work, its state and its discussion live in issues. The tickets
below are sub-issues of the spec [statewalker-root#215](https://github.com/statewalker/statewalker-root/issues/215),
and a ticket's issue, not this file, says whether it is open, claimed or done.

When a ticket settles something differently from this file (a new blocker, a split, a different
behaviour), the ticket wins. Record the decision on the ticket, or in an ADR when it is lasting,
and update this file in the same pull request.

## Where it comes from

- **Decision:** [Should commands, the task queue and JobManager share one platform model?](https://github.com/statewalker/statewalker-root/issues/204),
  recorded as ADR [`2026-11-23-commands-tasks-and-jobs`](adr/2026-11-23-commands-tasks-and-jobs.md).
- **Spec:** the "Tasks and jobs" section of [#215](https://github.com/statewalker/statewalker-root/issues/215)
  and its acceptance criterion 8.
- **Terms:** `GLOSSARY.md` (task, subscription, lease, processor, job, script, handler, exposure).
- **Code it starts from:**
  - `@statewalker/ai-tasks` in statewalker-ai, the queue as built for #160 (0.1.0 on npm);
  - `@statewalker/shared-commands` in statewalker-shared, the in-process bus;
  - `system.commands` in statewalker-kernel (to be renamed statewalker-platform), the platform's command model;
  - `apps/jobs-manager` in statewalker-sandbox, JobManager.

## The shape of the result

Commands and tasks stay two models that share one execution context:

| | Command call | Task |
|---|---|---|
| Caller | waits for the result | does not wait; may ask for a reply |
| Delivery | at most once, in process or over RPC | at least once, durable |
| Payload | any value, including live objects | JSON, at most 64 KB |
| Handled by | the command's handler | a subscription's processor |
| Context | `callId`, `signal`, `progress` | the same |

A command joins the queue only when it opts in to the `task` exposure. The platform then serves
its subscription by calling its handler. JobManager becomes one more processor, for scripts on
Node hosts.

## Order of work

The layers go bottom-up (`docs/process/README.md` §3): statewalker-shared publishes before
statewalker-ai and statewalker-kernel move to its new versions.

| Wave | Ticket | Issue | Project | Blocked by |
|---|---|---|---|---|
| 1 | T1 shared-tasks: the queue contract at L0 | [#403](https://github.com/statewalker/statewalker-root/issues/403) | statewalker-shared | none |
| 1 | T3 shared-commands: optional signal to listeners | [#405](https://github.com/statewalker/statewalker-root/issues/405) | statewalker-shared | none |
| 2 | T2 shared-tasks: resumable job log and cancel | [#404](https://github.com/statewalker/statewalker-root/issues/404) | statewalker-shared | T1 |
| 2 | T4 statewalker-ai: switch to shared-tasks, retire ai-tasks | [#406](https://github.com/statewalker/statewalker-root/issues/406) | statewalker-ai | T1 (published) |
| 2 | T5 Kernel: callId, signal and progress in the command context | [#407](https://github.com/statewalker/statewalker-root/issues/407) | statewalker-kernel | T3 (published) |
| 3 | T6 system.tasks tracer: the task exposure, served headless | [#408](https://github.com/statewalker/statewalker-root/issues/408) | statewalker-kernel | T1, T2, T5 |
| 4 | T7 system.tasks in its fragment DO, shown in apps/notes | [#409](https://github.com/statewalker/statewalker-root/issues/409) | statewalker-kernel, cellb.dev | T6, [#259](https://github.com/statewalker/statewalker-root/issues/259) (server-half tracer) |
| 5 | T8 system.tasks: forward publishes to a fragment's home | [#410](https://github.com/statewalker/statewalker-root/issues/410) | statewalker-kernel, cellb.dev | T7, [#263](https://github.com/statewalker/statewalker-root/issues/263) (Move) |
| 5 | T9 host-jobs.node: fragment scripts as jobs on Node hosts | [#411](https://github.com/statewalker/statewalker-root/issues/411) | statewalker-kernel, then statewalker-sandbox | T2, T7 |

Waves 1 to 3 need nothing from the server-half tracer, and waves 4 and 5 build on the spec's
server-half work. Wave 2's T4 is independent of the platform and can run as soon as T1 is on npm.

Every ticket in the table above is closed. Where the work stands, and what is left (the
follow-ups the merge gates filed, and the human's steps), is in the
[handoff note of 2026-11-27 07:03 on #215](handoffs/2026-11-27.215-spec-empty-fragment-platform-kernel-core-0703.md).

**Human steps on the way:**

1. **First publish of `@statewalker/shared-tasks`.** A package's first version is published once by
   the human (`docs/process/README.md` §4). T1 ends with `Waiting on human` until it is on npm. T2
   and T4 can't use it before then.
2. **Deprecating `@statewalker/ai-tasks`,** after the statewalker-ai release that drops it:
   `npm deprecate @statewalker/ai-tasks "Moved to @statewalker/shared-tasks"`. T4 ends with
   `Waiting on human` for it. No agent runs it.

## How each ticket is approached

Each ticket is one session's work, test-first (`/tdd`), as one pull request in its project that
references `statewalker/statewalker-root#<ticket>` in full, carries a changeset where it changes a
published package, and passes the merge gate (`docs/process/merging.md`). The notes below are the
plan's intent, not acceptance criteria: those are on the issues.

### T1: shared-tasks, the queue contract at L0 (#403)

- **Approach.** Copy, don't redesign, and keep ai-tasks 0.1.0's table layout unchanged, so
  stores it created open as they are (T4 relies on this). Bring ai-tasks' `types`, `subjects`, `queue`, `local` and
  `runner` modules and their tests into a new `packages/shared-tasks` in statewalker-shared. Then
  rename `Executor` to `Processor` and `ExecutorContext` to `ProcessorContext`. Keep the defaults:
  64 KB payloads, 7-day expiry, 5-minute leases, 3 attempts, 14 days of dead letters.
- **Keep it L0.** The package has no runtime dependencies. `SqlLike` stays the storage seam, and
  tests use `node:sqlite` in memory, as ai-tasks does.
- **Don't** change ai-tasks in this ticket. statewalker-ai moves in T4, after the publish.
- **Risk.** Behaviour drifting during the copy. Carrying the tests over unchanged, apart from the
  rename, is the guard.

### T2: resumable job log and cancel (#404)

- **Stamps.** `at` becomes a strictly increasing stamp per job: epoch milliseconds plus a
  fraction when two entries land in the same millisecond, JobManager's scheme. `job(…, { after,
  wait_ms })` reuses the queue's existing long-poll mechanism (the one behind `changes`).
- **Final entry.** The runner writes `done`, `error` or `cancelled` before it replies, so a viewer
  that follows the log sees the end without reading the reply.
- **Cancel.** The task row gets a cancelled flag. `renew` checks it and answers "cancelled". The
  runner aborts the processor's `signal`, then replies with the error kind `cancelled` and acks
  without a retry. A waiting task is deleted. Rights: the sender's principal, or an admin, as the
  other operations decide it.
- **Storage.** This adds columns to tables that ai-tasks 0.1.0 and shared-tasks' first release
  (T1) create. The queue's schema setup upgrades an existing store in place: it adds the missing
  columns with defaults, records a schema version, and never drops data. A store opened by an
  older version after the upgrade is not supported. Tests open a store created with T1's layout
  and check that its tasks survive the upgrade. This is the migration and rollback note the
  issue needs.

### T3: shared-commands, an optional signal for listeners (#405)

- **Approach.** `call(decl, payload, options?)` with `options.signal`, stored on the `Command` that
  listeners receive. When it aborts, the command settles as rejected with the signal's reason, and
  later `resolve`/`reject` calls are ignored, as for any settled command.
- **Scope.** No ids, progress or persistence here. They belong to the kernel (T5), which keeps the
  substrate thin.

### T4: statewalker-ai switches to shared-tasks (#406)

- **Approach.** Change imports in ai-host-do (`tasks-host`, `tasks-tool`, `triggers-host`),
  ai-sessions (`api`) and ai-conformance from `@statewalker/ai-tasks` to `@statewalker/shared-tasks`,
  rename `Executor` to `Processor`, then remove `packages/ai-tasks` and its entries in pending
  changesets.
- **Data.** ai-host-do's queue tables were created by ai-tasks 0.1.0. shared-tasks' first release
  (T1) keeps that layout unchanged, so the stores open as they are and the switch needs no
  migration code in statewalker-ai. A test opens a store with ai-tasks' layout through
  shared-tasks. When statewalker-ai later moves to the shared-tasks version with T2, T2's in-place
  upgrade covers these stores, and from then on rollback to ai-tasks is not supported. The pull
  request says so.
- **Glossary.** statewalker-ai's `GLOSSARY.md` keeps "Executor" for where session code runs, and
  uses "Processor" for the queue.

### T5: callId, signal and progress in the command context (#407)

- **Approach.** In `system.commands`, extend `CallOptions` with `signal` and `onProgress`, and
  `CommandContext` with `callId`, `signal` and `progress`. The bus passes `signal` to the
  substrate (T3), and `progress` calls `onProgress` in order. `callId` is a fresh id for every
  call. Only system code can supply one, through an option honoured for the user and system
  callers and refused for any caller that goes through the gate (agents, peers, sandboxes). The
  projections never set it. The task runner (T6) uses it to pass the task id. Handlers
  deduplicate by `callId`, so an outside caller choosing one could make a handler skip someone
  else's work.
- **Projections.** Agent tools and MCP pass the harness's or the request's cancellation through
  as `signal`. Nothing else in the projections changes.
- **Compatibility.** Existing handlers ignore the new fields, and existing tests must pass
  untouched. This is what keeps spec #215's command model intact.

### T6: system.tasks tracer, headless (#408)

- **The fragment.** It becomes a new `fragments/system.tasks` beside the other core fragments. It
  holds a `shared-tasks` queue over in-memory SQLite in the headless tracer, and declares the
  commands `publish`, `cancel` and `job` (the log), with `publish` exposed to agents.
- **The exposure.** Add `task` to the exposures in `system.commands`' catalogue. Manifest
  validation refuses it unless the input and output schemas are pure JSON Schema and the
  operation's extension declares `idempotent: true`.
- **Activation.** When a fragment's client aspect activates, `system.tasks` subscribes
  `<fragment-id>/<command-id>` on `fragments.<fragment-id>.<command-id>` for each `task`-exposed
  command. It runs `serveSubscription` with a processor that calls the command on the bus, passing
  the task id as `callId`, the lease's signal and a progress callback. On deactivation it stops the
  runner and keeps the subscription, so tasks wait for the fragment's return: the queue's
  `unsubscribe` drops waiting deliveries and dead letters. Removing the fragment removes the
  subscription. #408's criteria say the same.
- **Core list.** The kernel's core-fragment list and the tests of the reserved prefix count
  twelve, and disabling `system.tasks` is refused.
- **Tests.** Seam 1 only, as the spec says. This is the tracer every later ticket builds on.

### T7: system.tasks in its fragment DO (#409)

- **Approach.** Move the queue behind `system.tasks`'s fragment DO, using its SQL storage as
  `SqlLike`, on the three hosts of the server-half tracer (#259). The client keeps calling the
  same commands, now served from the DO.
- **Demo.** `apps/notes` gets one `task`-exposed command whose run takes long enough to watch,
  such as a notes export with progress per note. The UI shows the job log and a cancel button.
  Playwright covers start, progress, reload and resume, cancel, and a restart with a waiting
  task.

### T8: forward publishes to a fragment's home (#410)

- **Approach.** `system.tasks/publish` reads the route table. When the subject's fragment is
  routed elsewhere, it forwards the publish to `/fragments/system.tasks/` on that home, and the
  remote reply is delivered to the publisher's local inbox. Wildcard subjects never leave the
  receiving host.
- **Tests.** The two-host CellB Node setup that Move (#263) builds. The unreachable-home error is
  defined on the issue.

### T9: host-jobs.node (#411)

- **Approach.** Port JobManager's process manager (process groups, the SIGTERM then SIGKILL grace
  period, line-by-line stdout and stderr, cleaning up orphans after a restart) into
  `packages/host-jobs.node` as a `Processor`. Its `messages.jsonl` becomes the job log of T2.
  Drop its REST, SSE, MCP and CLI surfaces.
- **Binding.** The CellB Node host offers `host-jobs` as a binding (listed in `host.json`). A
  fragment declares it as a required binding and ships its scripts in its archive. The processor
  resolves a script path only inside that fragment's installed archive. Browser and Cloudflare
  hosts lack the binding, so the install is refused there with the reason.
- **Trust.** Only scripts shipped in installed fragments run (ADR `2026-11-19-code-kinds-and-trust`).
  User and agent scripts never reach this processor: they go through the sandbox broker.
- **Afterwards.** A pull request in statewalker-sandbox removes `apps/jobs-manager`. A separate
  pull request here, in statewalker-root, records in `docs/refactoring/README.md` where it went.

## Not in this plan

- Exactly-once delivery, and deduplication by the platform: handlers deduplicate by `callId`.
- Joining the harness's per-project queues with the platform's: they stay separate instances of
  one contract.
- Wildcard fan-out across hosts.
- Cloudflare-specific queue features (Cloudflare Queues). On Cloudflare, `system.tasks` is a
  deployed fragment like any other.
