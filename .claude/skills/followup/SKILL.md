---
name: followup
description: "Resolve a set of follow-up issues across projects, one by one: claim, fix, gate, merge, release, hand off."
disable-model-invocation: true
---

# Follow-up

You resolve a set of **follow-up issues**: the per-project issues a research ticket, a spec or a review filed, usually spread over several repositories. Each one ends **merged and closed**, or **waiting on human** with the exact steps the human must take. The procedure is the standard one; this skill is how one session drives many issues through it at once:

- the session claims each issue;
- `docs/process/README.md` sets the landing order and the release;
- `docs/process/merging.md` defines the gate;
- `docs/process/prevention.md` requires tests first;
- `docs/agents/issue-tracker.md` defines the claims.

Read those four before step 1. This skill repeats none of them.

Two leading words run through it:

- A **lane** is one subagent working one repository's issues strictly in sequence.
- The **gate** is the merge gate, which **you** run for every pull request, because lanes have no Agent tool to launch a reviewer.

## Steps

### 1. Collect the issues

Start from what the human names: a root ticket whose comments link the follow-ups, or a list of `owner/repo#n` references. For each issue, check three things:

- it is open;
- it has no live claim;
- it is not a duplicate.

Group the issues by repository. Order the repositories by layer, using the project table in `CLAUDE.md`, so lower layers merge and release first. Within a repository, order the issues as follows:

1. bugs before features;
2. an issue that another one builds on before that other one;
3. by issue number.

Done when every issue sits in exactly one ordered lane, or is set aside with a stated reason.

### 2. Prepare the repositories

For each repository:

1. In the cloud, attach it with `add_repo` and `access: "push"`, clone it, and register it.
2. List its deferred bugs.
3. Note its release mechanics from its own `PUBLISHING.md` or `ci.yml`: the version pull request, the publish job, how a first publish works.

Lanes get one branch name per repository (the session branch). After each merge they restart it from `origin/main`. Where the guardrail refuses a force-push, they merge the previous pull request's squashed head instead; that adds nothing to the next diff.

### 3. Start the lanes

1. Write the lane brief from [LANE-BRIEF.md](LANE-BRIEF.md) into the scratchpad.
2. Start one background lane per repository, all at once. Each lane's prompt names its repository, its checkout, its ordered issues and any per-issue notes: the risk to watch, or "first publish needed".
3. Split a lane of more than about seven issues into sequential batches, so one agent's context does not have to hold them all. The last batch owns the release.

Done when every lane is running and none of their issues overlap.

### 4. Run the gate on every handback

A lane hands back with a repository, a pull request, a head SHA and a ticket, once CI on that head is green. For each handback:

1. Launch **one fresh reviewer** in the background with [REVIEWER-BRIEF.md](REVIEWER-BRIEF.md). Name the risk the change carries, and ask the reviewer to try to break it: identity and credentials, revocation, storage formats (rubric class c), published APIs (class b), the release path (class e), production deploys. A re-verification pass reviews only the fix diff since the last reviewed commit, with the earlier records attached.
2. **Judge** every finding yourself, by the rubric:
   - A change that newly grants authority to requests that did not have it is class d. That holds even when no data loss is shown; "the responses are unreadable" does not lower a newly opened hole.
   - A test that exercises the code without the production path (for example, calling a handler directly instead of going through the real transport) is not evidence for the fix. Ask the reviewer to reproduce the fix through the shipped dependencies.
   - A reviewer's "below the gate" note is upgraded to high when it fails open; cheap fail-open fixes ride along in the same pull request.
3. **Send the verdict** to the lane: each finding with its judged severity and reason; for each fix, the exact record row and the `<!-- gate: ... -->` line; and the decision. The decision is merge after a fix, re-verify after a critical fix (at most three passes), or Waiting on human.
4. When the decision is merge, the lane posts the record, merges with `expectedHeadSha`, closes the issue and starts its next issue.

Done for a pull request when it is merged with its record posted, or left open with `Waiting on human` on its issue.

### 5. Release each repository

A lane's last step hands back its repository's version pull request ("version packages"). Run the gate on it like any other pull request. Then:

1. **You** merge it, then wait for the `publish` job on the merge commit, using a background until-loop.
2. Confirm the new versions with `npm view`. A green job is not proof that npm serves the versions.
3. **A brand-new package:** a human must publish its first version and add its npm trusted publisher. Leave the version pull request that would release it open, because its publish would 404. Comment `Waiting on human: first publish of <package>` with the repository's own steps.
4. **A 404 for a package that already exists** means npm has no trusted publisher for this repository. The job holds back that package's dependents too. Comment the `npm trust github …` commands and "re-run the failed publish job". No code change is needed.

### 6. Hand off

Write a handoff note for the root ticket, following `docs/handoffs/README.md`, and commit it in the session's root pull request. The note holds:

- a table of issue → pull request → release;
- the gate findings that were fixed before merging;
- every issue filed along the way;
- the numbered **Waiting on human** list.

Then:

- comment one line on the root ticket linking the note;
- label the ticket `ready-for-human` if the list is not empty;
- report the same to the human, leading with what is blocked on them.

## Along the way

- **CI flakes.** Re-run only the failed jobs, and file the flake in the project's tracker; never retry inside a test or push an empty commit. If the same flake fails on `main` and skips a deploy, raise it on its issue.
- **Problems outside an issue's scope**, found by a lane or a reviewer, become new issues in the project's own tracker, after a duplicate check. They never ride along in an unrelated pull request.
- **Shared container.** Lanes and reviewers run side by side:
  - give each its own ports (port 0);
  - reviewers work in their own scratch clones, never in a lane's checkout;
  - stop only processes you started yourself, never by name;
  - subagents return their findings as text in their final message.
- **Waiting.** Use a background bash until-loop on the check runs, or the publish job, with a long timeout. Pollers in the foreground hit the 10-minute limit.
