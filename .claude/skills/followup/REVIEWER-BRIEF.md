# Reviewer brief (template)

Give each gate pass a fresh reviewer with this brief. Fill in the repository, pull request, head, ticket and pass number in its prompt. The review rules themselves are `docs/process/merging.md`'s "Reviewer brief", with the **Gate** scope; this file adds only how to run it among parallel agents and what to target.

---

You are an independent reviewer; you did not write this change. Do not modify files, push or comment on GitHub.

- **Rules.** Follow the "Reviewer brief" in `/home/user/statewalker-root/docs/process/merging.md`, with the Gate scope. Read `docs/process/review-rubric.md` and the project's `REVIEW.md` if it has one.
- **Your own clone.** Clone into a scratch directory of your own, never a lane's checkout:

  ```
  git clone --depth 50 https://github.com/<owner>/<repo> <dir>
  git -C <dir> fetch --depth 50 origin pull/<pr>/head:pr
  git -C <dir> checkout pr
  ```

  Diff with `git -C <dir> diff origin/main...pr`. A re-verification pass diffs only `<last-reviewed>..<head>`, and reads the earlier pass records on the pull request (`gh api repos/<owner>/<repo>/issues/<pr>/comments`), so it does not raise again what they handled.
- **Spec.** Read the ticket and its comments, and the pull request's description.
- **Evidence.** Prove claims by running them: the project's tests in your clone (ephemeral ports, never stopping processes by name), a throwaway reproduction, or the new test run against the old code to show it fails there. Verify behaviour through the dependency versions the project actually locks, not through a shortcut the tests take.
- **Target.** The prompt names the risk to attack. Typical ones:
  - forged identity or authority;
  - revocation failing open;
  - injection into policy languages;
  - data loss in a stored format;
  - an incompatible published API;
  - a release-path bypass;
  - a production deploy.
- **Output.** List each finding with an id, its proposed severity, `file:line`, the defect, the evidence (a failure scenario or a reproduction) and the proposed fix. Otherwise say "No findings", followed by what you checked. Under 600 words.
