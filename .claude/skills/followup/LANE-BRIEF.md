# Lane brief (template)

Write this into the scratchpad and point each lane's prompt at it. Fill in the bracketed parts in the prompt, not here: `<repo>`, `<checkout>`, `<ordered issues>`, `<session branch>` and `<session URL>`.

---

You resolve the issues of **one repository**, strictly one after another.

## Read first

- `statewalker-root`:
  - `CLAUDE.md`;
  - `docs/process/README.md` (§3 landing, §4 release);
  - `docs/process/merging.md` (the gate, the record format, the `<!-- gate: ... -->` line);
  - `docs/process/review-rubric.md`;
  - `docs/process/prevention.md`;
  - `docs/agents/issue-tracker.md`;
  - `.claude/skills/tdd/SKILL.md` and, for bugs, `.claude/skills/diagnosing-bugs/SKILL.md`.
- The project's own `CLAUDE.md`, `README.md`, `.changeset/README.md` and `PUBLISHING.md`, where they exist.
- Whatever each issue links: research notes, prototypes, earlier pull requests.

## For each issue, in order

1. **Claim it.** Read the issue and its comments, assign the human's login, and comment `Claimed by <session URL> (branch <session branch>)`.
2. **List the deferred bugs** before the repository's first change. Fix one in the same pull request only if it is in code you touch anyway and the fix is cheap.
3. **Restart the branch from fresh main:**

   ```
   git fetch origin main && git checkout -B <session branch> origin/main
   ```

   If a later push of the restarted branch is refused, merge the previous pull request's squashed head instead.
4. **Fix it test-first.** A bug fix carries a regression test that fails before the fix and passes after it. Before pushing, run the repository's own build, typecheck, lint, format and tests, for the touched packages at least.
5. **Add a changeset** for every published package you change: a patch for a fix, a minor for new API.
6. **Commit, push, and open one pull request** for this issue. Use the commit trailers and pull-request footer from the session's attribution rules. The body describes the change, references the issue as `#<n>` (never with a closing keyword), and includes a test plan.
7. **Wait for CI** on the head commit, with a background loop over `gh api repos/<owner>/<repo>/commits/<sha>/check-runs` at 30–60 s intervals. Fix CI until it is green. For a failure in code you did not touch, re-run only the failed job, and name the flake in your handback.
8. **Hand back for the gate.** You cannot launch the reviewer. Send `main` the repository, the pull request, the head SHA and the ticket, plus the last reviewed commit if this is a re-verification. Then end your run with the same information. You will be resumed with the verdict.
9. **Act on the verdict.**
   - Fix what it says, then wait for green CI.
   - Post the pass record exactly as merging.md specifies, using the rows and gate line you were given.
   - When the decision is merge: check the head is green and up to date, squash-merge with `expectedHeadSha`, comment on the issue, and close it as completed.
   - When the decision is re-verify: hand back again with the new head and the last reviewed commit.
10. Go to the next issue.

**When an issue needs a decision only the human can make** (an API with real trade-offs nobody chose, a breaking change):

1. Do the cheap, uncontroversial part.
2. Comment `Waiting on human: <the decision, the options, your recommendation>`.
3. Add `ready-for-human`.
4. Move on to the next issue.

**When a bug does not reproduce:** show what you ran, then hand back.

## After the last issue

If you own the release, wait until CI updates the "version packages" pull request with every merged changeset. Then hand it back for its gate with:

- its head SHA;
- the list of version bumps;
- for each package, whether it is new on npm (`npm view`).

## Environment

- **GitHub in the cloud.** `gh pr` and `gh issue` (GraphQL) do not work there. Use `gh api` (REST) or the GitHub MCP tools.
- **Shared container.** Other agents share it:
  - use ports from port 0;
  - stop only processes you started, never by name;
  - write only inside your repository checkout;
  - return findings as text in your final message.
- **Playwright.** Chromium and Playwright are pre-installed, so use them directly. An extension loads only with `launchPersistentContext(dir, { channel: "chromium", args: ["--disable-extensions-except=<ext>", "--load-extension=<ext>"] })`; the headless shell loads none.
- **No model identifiers** in commits, pull requests or comments.

## Final report

For each issue:

- the pull request;
- its gate passes and outcome;
- the follow-ups filed;
- the release status.

Then the state of your working tree, including any local branches left behind. Keep the report under 500 words.
