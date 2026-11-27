# webrun-vcs roadmap: parity with native git and JGit

The order in which webrun-vcs closes its remaining gaps against native git and JGit, and how that
work is done. This file is the readable overview and does not change as work progresses. The work
itself, its state and its discussion live in issues: the plan is [statewalker-root#282](https://github.com/statewalker/statewalker-root/issues/282), and each ticket below
belongs to it. GitHub allows a parent at most 100 sub-issues, so #283–#383 are sub-issues and
#384–#398 start with `Part of #282`. A ticket's issue, not this file, says whether it is open, claimed or
done.

The handoff notes for #282 in [`docs/handoffs/`](../handoffs/README.md) (names `*.282-*`) say
where the work stands and what comes next; the newest one (last in the index) is current. The
[2026-11-27 01:54 note](../handoffs/2026-11-27.282-plan-webrun-vcs-parity-gaps-git.md) gives
the standing rules for continuing the work in child sessions: the human's rules, the merge gate,
the post-merge check and the release steps. Later notes keep them.

When a ticket settles something differently from this file (a new blocker, a split, a different
behaviour), the ticket wins. Record the decision on the ticket, or in an ADR when it is lasting,
and update this file in the same pull request.

## Where it comes from

The tickets come from the feature-coverage research
[`docs/research/git-jgit-feature-coverage.md`](../research/git-jgit-feature-coverage.md)
(statewalker-root#218). That research compared about 1,060 features of native git's porcelain,
git's internals and JGit with webrun-vcs. Its tables were scored on 2026-11-22 and re-checked
against webrun-vcs `main` on 2026-11-23, after git 3.0 compatibility, reftable, SHA-256,
`git gc` parity and the push default remote fix had merged.

| Open rows (Partial, None, `?`) | 388 |
|---|---:|
| Done by work merged since the tables were scored | 25 |
| Covered by tickets | 316, in 116 tickets |
| Not applicable to a library (host callbacks, terminal layout, JGit-only infrastructure) | 21 |
| Won't do (foreign-SCM bridges, commands git removed, JGit-only formats) | 26 |

The plan issue's comments map every open row to its ticket, or give the reason it has none.

Earlier issues in webrun-vcs keep their scope, and the tickets here are slices of them:
submodules ([#212](https://github.com/statewalker/webrun-vcs/issues/212)), signing ([#213](https://github.com/statewalker/webrun-vcs/issues/213)), bundles and archive
([#215](https://github.com/statewalker/webrun-vcs/issues/215)), history search and diff presentation ([#216](https://github.com/statewalker/webrun-vcs/issues/216)), the receive side
([#217](https://github.com/statewalker/webrun-vcs/issues/217)) and ports of git's and JGit's tests ([#218](https://github.com/statewalker/webrun-vcs/issues/218)).
`compatObjectFormat` ([#245](https://github.com/statewalker/webrun-vcs/issues/245)) is the last ticket as it stands.

## How the order was chosen

Tickets are grouped into waves. A wave depends only on earlier waves, so the tickets within it can
run in parallel. The ranking, from first to last:

1. **Silent wrong behaviour and safety.** A result that looks right but isn't, such as an
   unsigned tag where a signed one was asked for, or a served repository accepting malformed
   objects, comes before anything else.
2. **Foundations other tickets need.** Examples: the trailers engine before sign-offs and
   trailers, the signer before signed commits, tags and pushes, the ref filter before branch and
   tag listings, the revision-walk filter before log search, and the submodule model before the
   submodule commands.
3. **Everyday porcelain** before rare commands.
4. **Parity with JGit**, and the plumbing that git's `t/` suite needs.
5. **Rare, new or server-only features** last.

Within a large wave the tickets are independent. Draw first the ones with the most daily use
behind them: commit, branch and tag listings, stash, push and grep in wave 3.

## How a ticket is implemented

Each ticket is one session's work. That session follows this repository's `CLAUDE.md` and
`docs/process/`, and in short it:

1. **Takes a ticket from the frontier.** The frontier is the plan's open tickets labelled
   `ready-for-agent` whose blockers are all closed and which nobody has claimed
   (`docs/agents/issue-tracker.md`). Unblocked tickets of an earlier wave go first.
2. **Claims it.** It assigns the ticket and comments `Claimed by <session>` before any other
   write.
3. **Builds it test-first in webrun-vcs** (`/tdd`). The acceptance criteria always include
   native-twin tests: our result is compared with native git's, using scenarios from the `t/`
   scripts the ticket names. Twins run against git 2.43 and a current 2.5x. Behaviour that
   changed in git 3.0 also gets a twin against a `WITH_BREAKING_CHANGES` build (`$GIT3`). The
   pitfalls are in webrun-vcs's `CLAUDE.md`, which the session extends with any it finds.
4. **Opens one pull request in webrun-vcs** that references
   `statewalker/statewalker-root#<ticket>` in full and carries a changeset.
5. **Passes the merge gate** (`docs/process/merging.md`): CI green, then an independent reviewer
   reports critical findings and high findings in the changed lines. Critical findings are always
   fixed. High ones are fixed when cheap, otherwise filed in webrun-vcs. The pull request is then
   merged automatically.
6. **Closes the ticket** with a comment naming the merge. Its dependents can then join the
   frontier.

**Parallelism.** Four to six pull requests at a time is the practical limit. They share
webrun-vcs's `CLAUDE.md` and nearby vcs-commands code, so a larger batch costs merge conflicts
and CI reruns. Work in separate worktrees and branches, one per ticket.

**Releases.** They come only through CI. The merged changesets build up in the
"version packages" pull request, which passes the same merge gate and publishes on merge.
Release at least once per wave, and whenever a fix matters to users.

**Decisions taken while planning.**
- **Signing.** When signing is asked for but cannot be done (`tag.setSigned`, `*.gpgSign`),
  webrun-vcs refuses, as native git does. The alternative, warning and continuing unsigned for
  hosts that set `gpgSign` globally, is recorded on that ticket. It changes only on the human's
  word.
- **Host callbacks stay outside the library.** SSH, credentials, filter drivers, textconv and
  merge drivers are supplied by the host, so their command-line features are out of scope.

## The waves

### Wave 1 (4 tickets)

Correctness and safety first: silent wrong results (unsigned objects where signing was asked), served repositories accepting malformed objects, unconfirmed checkout path safety, and gc data loss under concurrency.

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T01 | [#283](https://github.com/statewalker/statewalker-root/issues/283) | Refuse signing requests until signing exists (`tag.setSigned`, `*.gpgSign`) | none | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T02 | [#284](https://github.com/statewalker/statewalker-root/issues/284) | receive-pack checks pushed objects (`receive.fsckObjects`) | none | slice of [webrun-vcs#217](https://github.com/statewalker/webrun-vcs/issues/217) |
| T03 | [#285](https://github.com/statewalker/statewalker-root/issues/285) | Checkout refuses malicious paths (port JGit's malicious-path tests) | none | slice of [webrun-vcs#218](https://github.com/statewalker/webrun-vcs/issues/218) |
| T04 | [#286](https://github.com/statewalker/statewalker-root/issues/286) | gc and repack under concurrent writers | none |  |

### Wave 2 (5 tickets)

Foundations that several later tickets need: the trailers engine (commit/tag/merge/rebase/cherry-pick/am/format-patch sign-offs and trailers), the ref filter (branch and tag listings), the revision-walk filter (log search), the signer (signed commits, tags, rewrites, pushes) and the submodule model (every submodule command).

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T05 | [#287](https://github.com/statewalker/statewalker-root/issues/287) | Trailers engine: `interpret-trailers` with `trailer.*` config | none |  |
| T06 | [#288](https://github.com/statewalker/statewalker-root/issues/288) | Signing foundation: signer callback, `gpg.*` config, `commit -S` | [#283](https://github.com/statewalker/statewalker-root/issues/283) | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T07 | [#289](https://github.com/statewalker/statewalker-root/issues/289) | Ref filter: `for-each-ref --format/--sort/--contains/--merged/--points-at` | none |  |
| T08 | [#290](https://github.com/statewalker/statewalker-root/issues/290) | Revision-walk filter API: `--author/--committer/--grep` and composable filters | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T09 | [#291](https://github.com/statewalker/statewalker-root/issues/291) | Submodule config model plus `submodule init/deinit/sync/set-url/set-branch/foreach` | none | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |

### Wave 3 (39 tickets)

Everyday porcelain gaps, first layer: options used daily on commit, branch, tag, stash, config, remote, fetch, push, merge, rebase, cherry-pick, log, diff and show, plus grep, signed objects and the core submodule commands. Each depends only on waves 1 and 2.

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T10 | [#292](https://github.com/statewalker/statewalker-root/issues/292) | commit `-C/-c` and `--fixup/--squash` (amend:/reword:) | none |  |
| T11 | [#293](https://github.com/statewalker/statewalker-root/issues/293) | commit `-s`, `--trailer`, `--author`/`--date` strings, `--reset-author` | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T12 | [#294](https://github.com/statewalker/statewalker-root/issues/294) | branch listing: `-v/-vv`, `--format`, `--sort`, `--merged/--contains/--points-at`, patterns | [#289](https://github.com/statewalker/statewalker-root/issues/289) |  |
| T13 | [#295](https://github.com/statewalker/statewalker-root/issues/295) | branch `-u/--unset-upstream/--track`, `--edit-description`, `--show-current`, `--create-reflog` | none |  |
| T14 | [#296](https://github.com/statewalker/statewalker-root/issues/296) | tag listing: `-l <pattern>`, `--sort`, `-n<num>`, `--contains/--merged/--points-at`, `--format` | [#289](https://github.com/statewalker/statewalker-root/issues/289) |  |
| T15 | [#297](https://github.com/statewalker/statewalker-root/issues/297) | tag `-f`/`-d` twins, `-e`, `--create-reflog`, `--trailer` | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T16 | [#298](https://github.com/statewalker/statewalker-root/issues/298) | stash `pop`, `show`, `branch`, `store`, `list` with log options | none |  |
| T17 | [#299](https://github.com/statewalker/statewalker-root/issues/299) | `--pathspec-from-file`/`--pathspec-file-nul` for add, rm, restore, commit, checkout, stash push | none |  |
| T18 | [#300](https://github.com/statewalker/statewalker-root/issues/300) | Small add/rm/clean flags: `rm -n/-q`, `clean -e`, `add --ignore-errors`, `add/rm --sparse` | none |  |
| T19 | [#301](https://github.com/statewalker/statewalker-root/issues/301) | Config writes: `set/unset/--add/--replace-all/rename-section/remove-section` per scope | none |  |
| T20 | [#302](https://github.com/statewalker/statewalker-root/issues/302) | Config queries: `--type`, `--default`, `--get-urlmatch`, `--get-color`, `--show-origin/--show-scope`, `--blob` | none |  |
| T21 | [#303](https://github.com/statewalker/statewalker-root/issues/303) | remote add `-f/-t/-m/--mirror/--tags`, `set-url` twins, `remote -v` | none |  |
| T22 | [#304](https://github.com/statewalker/statewalker-root/issues/304) | fetch flags twins and `fetch --set-upstream` | none |  |
| T23 | [#305](https://github.com/statewalker/statewalker-root/issues/305) | push `-u`, `--follow-tags`, `--force-if-includes`, force and lease twins | none |  |
| T24 | [#306](https://github.com/statewalker/statewalker-root/issues/306) | push.default modes, `--delete/--prune/--all/--tags/--mirror`, `-o` twins | none |  |
| T25 | [#307](https://github.com/statewalker/statewalker-root/issues/307) | merge `--log`/`merge.log`, `fmt-merge-msg`, `--signoff`, unrelated-histories twin | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T26 | [#308](https://github.com/statewalker/statewalker-root/issues/308) | `--quit` and `--show-current-patch` for rebase, am, cherry-pick and revert | none |  |
| T27 | [#309](https://github.com/statewalker/statewalker-root/issues/309) | rebase `--onto <newbase> <upstream>`, `--fork-point`, `--keep-base`; `merge-base --fork-point/--independent` | none |  |
| T28 | [#310](https://github.com/statewalker/statewalker-root/issues/310) | rebase `--committer-date-is-author-date`, `--ignore-date`, `--trailer` | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T29 | [#311](https://github.com/statewalker/statewalker-root/issues/311) | cherry-pick/revert `-x`, `-s`, empties (`--allow-empty`, `--keep-redundant-commits`, `--empty=`), `--ff`, `--reference`, `-m` twins | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T30 | [#312](https://github.com/statewalker/statewalker-root/issues/312) | `git show` for commits, blobs, trees, tags and `<rev>:<path>` | none |  |
| T31 | [#313](https://github.com/statewalker/statewalker-root/issues/313) | diff selection: `--diff-filter`, `--relative`, `-R`, `--skip-to/--rotate-to`, `-I<regex>`, `--quiet/--exit-code`, `--merge-base`/`A...B` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T32 | [#314](https://github.com/statewalker/statewalker-root/issues/314) | log revision selection and order: `--branches/--tags/--remotes/--glob/--exclude/--stdin`, `--date-order/--author-date-order`, `--boundary`, `--source` | none |  |
| T33 | [#315](https://github.com/statewalker/statewalker-root/issues/315) | Reflog walks: `log -g/--walk-reflogs` and `reflog show` output | none |  |
| T34 | [#316](https://github.com/statewalker/statewalker-root/issues/316) | reflog `expire`, `delete`, `exists`, `write`, `drop` commands | none |  |
| T35 | [#317](https://github.com/statewalker/statewalker-root/issues/317) | Signed tags: `tag -s/-u` | [#288](https://github.com/statewalker/statewalker-root/issues/288) | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T36 | [#318](https://github.com/statewalker/statewalker-root/issues/318) | Verification: `verify-commit`, `verify-tag`, `%G?` placeholders, `log --show-signature`, `gpg.ssh.allowedSignersFile`, `--verify-signatures` | [#288](https://github.com/statewalker/statewalker-root/issues/288) | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T37 | [#319](https://github.com/statewalker/statewalker-root/issues/319) | Signed rewrites: `rebase -S`, `cherry-pick/revert -S`, `merge -S`, `am -S` | [#288](https://github.com/statewalker/statewalker-root/issues/288) | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T38 | [#320](https://github.com/statewalker/statewalker-root/issues/320) | Worktree add `--track/--no-track/--guess-remote`, relative paths, checkout DWIM twins | none |  |
| T39 | [#321](https://github.com/statewalker/statewalker-root/issues/321) | `git grep` over worktree, index and trees | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T40 | [#322](https://github.com/statewalker/statewalker-root/issues/322) | Pickaxe: `-S`, `-G`, `--pickaxe-regex`, `--pickaxe-all`, `--find-object` | [#290](https://github.com/statewalker/statewalker-root/issues/290) | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T41 | [#323](https://github.com/statewalker/statewalker-root/issues/323) | Diff colour: `--color`, `color.diff.*`, `--color-moved[-ws]` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T42 | [#324](https://github.com/statewalker/statewalker-root/issues/324) | Word diff: `--word-diff[=mode]`, `--color-words`, `--word-diff-regex`, `diff.<driver>.wordRegex` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T43 | [#325](https://github.com/statewalker/statewalker-root/issues/325) | Whitespace checks: `diff --check`, `--ws-error-highlight`, `core.whitespace` in diff | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T44 | [#326](https://github.com/statewalker/statewalker-root/issues/326) | submodule `add` | [#291](https://github.com/statewalker/statewalker-root/issues/291) | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |
| T45 | [#328](https://github.com/statewalker/statewalker-root/issues/328) | submodule `update` (checkout/merge/rebase/none, `--init`, `--recursive`, `--remote`) and `status` | [#291](https://github.com/statewalker/statewalker-root/issues/291) | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |
| T46 | [#329](https://github.com/statewalker/statewalker-root/issues/329) | submodule `absorbgitdirs` and `.git/modules` layout | [#291](https://github.com/statewalker/statewalker-root/issues/291) | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |
| T47 | [#330](https://github.com/statewalker/statewalker-root/issues/330) | am options twins: `-s/-k/--keep-non-patch/-m/--scissors/--keep-cr`, apply options, `--quoted-cr`, `--empty=`, mailsplit | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |
| T48 | [#331](https://github.com/statewalker/statewalker-root/issues/331) | format-patch `-s`, `--attach/--inline`, `--notes`, `--cover-from-description`, `--ignore-if-in-upstream` | [#287](https://github.com/statewalker/statewalker-root/issues/287) |  |

### Wave 4 (19 tickets)

Everyday porcelain, second layer: what builds on wave 3 (submodule recursion, pull, remote update, range-diff) and the rest of history search and presentation (#216: describe/name-rev, shortlog, blame, line log, remerge-diff), plus init and clone options.

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T49 | [#332](https://github.com/statewalker/statewalker-root/issues/332) | `--recurse-submodules` for clone, fetch, pull and push | [#328](https://github.com/statewalker/statewalker-root/issues/328) | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |
| T50 | [#333](https://github.com/statewalker/statewalker-root/issues/333) | `--recurse-submodules` for checkout, switch, restore and reset | [#328](https://github.com/statewalker/statewalker-root/issues/328) | slice of [webrun-vcs#212](https://github.com/statewalker/webrun-vcs/issues/212) |
| T51 | [#334](https://github.com/statewalker/statewalker-root/issues/334) | pull `--autostash/-s/-X` twins, unborn twin, `--squash/--no-commit/--edit/--log/--signoff/--depth/--all` | [#307](https://github.com/statewalker/statewalker-root/issues/307) |  |
| T52 | [#335](https://github.com/statewalker/statewalker-root/issues/335) | remote `show`, `prune`, `update`, `set-branches`; `fetch --all/--multiple`, remote groups | [#303](https://github.com/statewalker/statewalker-root/issues/303) |  |
| T53 | [#336](https://github.com/statewalker/statewalker-root/issues/336) | Merge strategies: `-s resolve` twin, `-s subtree`/`-X subtree`, `-X` whitespace/diff-algorithm/rename options | none |  |
| T54 | [#337](https://github.com/statewalker/statewalker-root/issues/337) | describe twins, `--dirty/--broken/--contains/--first-parent/--exact-match`, and `name-rev` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T55 | [#338](https://github.com/statewalker/statewalker-root/issues/338) | `git shortlog` and mailmap queries (`check-mailmap`, `mailmap.blob`) | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T56 | [#339](https://github.com/statewalker/statewalker-root/issues/339) | Symmetric differences: `--left-right`, `--cherry-pick/--cherry-mark/--cherry`, and `git cherry` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T57 | [#340](https://github.com/statewalker/statewalker-root/issues/340) | History simplification: `--ancestry-path[=<commit>]`, `--simplify-by-decoration`, `--simplify-merges`, `--dense/--sparse` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T58 | [#341](https://github.com/statewalker/statewalker-root/issues/341) | Line log: `log -L <start>,<end>:<file>` and `-L :<funcname>:<file>` | [#290](https://github.com/statewalker/statewalker-root/issues/290) | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T59 | [#342](https://github.com/statewalker/statewalker-root/issues/342) | Rename and copy detection options: `-C`, `--find-copies-harder`, `-B`, `--dirstat`, `--anchored`, status `--find-renames=<n>` and `-v/-vv` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T60 | [#343](https://github.com/statewalker/statewalker-root/issues/343) | Blame `-M`/`-C` (moves and copies) and mailmap | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T61 | [#344](https://github.com/statewalker/statewalker-root/issues/344) | Blame `--ignore-rev`, `--ignore-revs-file`, `blame.ignoreRevsFile`, `--reverse` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T62 | [#345](https://github.com/statewalker/statewalker-root/issues/345) | Blame output flags twins, `--incremental/--porcelain`, `--contents`, `--since`, `--first-parent`, `--date`, colour; `git annotate` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T63 | [#346](https://github.com/statewalker/statewalker-root/issues/346) | `range-diff` and format-patch `--range-diff/--interdiff` | [#331](https://github.com/statewalker/statewalker-root/issues/331) | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T64 | [#347](https://github.com/statewalker/statewalker-root/issues/347) | `--remerge-diff` | none | slice of [webrun-vcs#216](https://github.com/statewalker/webrun-vcs/issues/216) |
| T65 | [#348](https://github.com/statewalker/statewalker-root/issues/348) | init and clone layout: `--bare` twin, `--separate-git-dir`, `--template`, `--shared`, `core.sharedRepository` modes | none |  |
| T66 | [#349](https://github.com/statewalker/statewalker-root/issues/349) | clone `-o`, `-u`, `--sparse`, `-c/--config`, `--revision`, `--server-option`, `--reject-shallow` | none |  |
| T67 | [#350](https://github.com/statewalker/statewalker-root/issues/350) | Interactive extras as callbacks: `commit -p`, `add -e`, `clean -i`, `am -i` | none |  |

### Wave 5 (24 tickets)

Parity with JGit and the plumbing git's t/ suite needs (#218's CLI shim): bundles, archive, plumbing commands, refs migrate, repack and object-store commands, rerere, replace, merge-tree, HTTP client config, the dumb-HTTP client, progress, and the server's config gaps.

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T68 | [#351](https://github.com/statewalker/statewalker-root/issues/351) | Bundles: `bundle create/verify/list-heads/unbundle`, formats v2/v3 | none | slice of [webrun-vcs#215](https://github.com/statewalker/webrun-vcs/issues/215) |
| T69 | [#352](https://github.com/statewalker/statewalker-root/issues/352) | `git archive`: tar, tgz, zip, `--prefix`, `--add-file`, paths | none | slice of [webrun-vcs#215](https://github.com/statewalker/webrun-vcs/issues/215) |
| T70 | [#353](https://github.com/statewalker/statewalker-root/issues/353) | Plumbing reads: `cat-file --batch*`/`-p`, `ls-files` modes, `ls-tree` formats, `show-ref` | none |  |
| T71 | [#354](https://github.com/statewalker/statewalker-root/issues/354) | Plumbing diffs: `diff-files/diff-index/diff-tree --raw`, `--stdin`, `diff-pairs` | none |  |
| T72 | [#355](https://github.com/statewalker/statewalker-root/issues/355) | Plumbing writes: `update-index` modes, `checkout-index`, strict `mktag` | none |  |
| T73 | [#356](https://github.com/statewalker/statewalker-root/issues/356) | Small plumbing helpers: `check-ignore`, `check-attr`, `check-ref-format`, `stripspace`, `patch-id`, `var`, `url-parse` | none |  |
| T74 | [#357](https://github.com/statewalker/statewalker-root/issues/357) | `git refs migrate/verify/list/exists/optimize` | none |  |
| T75 | [#358](https://github.com/statewalker/statewalker-root/issues/358) | Repack as a command: `-k`, `--geometric`, `--cruft` options, delta islands, `delta` attribute | none |  |
| T76 | [#359](https://github.com/statewalker/statewalker-root/issues/359) | Object-store commands: `prune`, `count-objects`, `verify-pack -v`, `show-index`, `.idx` v1 twin | none |  |
| T77 | [#360](https://github.com/statewalker/statewalker-root/issues/360) | rerere: `rerere.enabled` in the merge family, git-compatible `rr-cache`, `rerere status/diff/forget/clear` | none |  |
| T78 | [#361](https://github.com/statewalker/statewalker-root/issues/361) | `git replace` command | none |  |
| T79 | [#362](https://github.com/statewalker/statewalker-root/issues/362) | `merge-tree` command: `--write-tree` with conflict info and messages, and the old mode | none |  |
| T80 | [#363](https://github.com/statewalker/statewalker-root/issues/363) | HTTP client config: `http.<url>.*`, `extraHeader`, `followRedirects`, user agent, `emptyAuth`, 429 retry, auth schemes | [#302](https://github.com/statewalker/statewalker-root/issues/302) |  |
| T81 | [#364](https://github.com/statewalker/statewalker-root/issues/364) | Dumb HTTP client (fetch and clone) | none |  |
| T82 | [#365](https://github.com/statewalker/statewalker-root/issues/365) | Progress callbacks for local commands | none |  |
| T83 | [#366](https://github.com/statewalker/statewalker-root/issues/366) | SHA-1 collision detection (sha1dc) | none |  |
| T84 | [#367](https://github.com/statewalker/statewalker-root/issues/367) | LFS config: `lfs.url`, `.lfsconfig` | none |  |
| T85 | [#368](https://github.com/statewalker/statewalker-root/issues/368) | Environment variables: `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE`/`GIT_OBJECT_DIRECTORY`/`GIT_COMMON_DIR` discovery, `GIT_SEQUENCE_EDITOR`, `GIT_OPTIONAL_LOCKS`, `GIT_REF_PARANOIA` | none |  |
| T86 | [#369](https://github.com/statewalker/statewalker-root/issues/369) | Host-supplied drivers conform to git: filter `required`, textconv `cachetextconv`, merge driver `recursive` | none |  |
| T87 | [#370](https://github.com/statewalker/statewalker-root/issues/370) | Receive limits and policies: `receive.maxInputSize`, `keepAlive`, `autogc`, `advertiseAtomic/PushOptions`, error handlers, `receive-report` hook | none | slice of [webrun-vcs#217](https://github.com/statewalker/webrun-vcs/issues/217) |
| T88 | [#371](https://github.com/statewalker/statewalker-root/issues/371) | unpack-objects and `receive.unpackLimit` keep/explode parity | none |  |
| T89 | [#372](https://github.com/statewalker/statewalker-root/issues/372) | upload-pack config: `allow*SHA1InWant`, `allowRefInWant` advert, want-ref client, `packObjectsHook`, session IDs | none |  |
| T90 | [#373](https://github.com/statewalker/statewalker-root/issues/373) | Fetch negotiation: `skipping`, `noop`, `--negotiation-tip`, `--negotiate-only`, push negotiation | none |  |
| T91 | [#374](https://github.com/statewalker/statewalker-root/issues/374) | `git last-modified` | none |  |

### Wave 6 (25 tickets)

Rare, new in git master, protocol extensions and server-only items (bundle URIs, signed pushes, sideband-all, packfile-uris, promisor-remote, namespaces, daemon options, fast-export/import, history/replay, fsmonitor, #245), plus the follow-ups of wave 5 tickets (bundle transport, archive attributes and remote archives, `maintenance run`, pseudo-merge bitmaps).

| Ticket | Issue | What | Blocked by | Notes |
|---|---|---|---|---|
| T92 | [#375](https://github.com/statewalker/statewalker-root/issues/375) | Fetch and clone from a bundle (bundle transport) | [#351](https://github.com/statewalker/statewalker-root/issues/351) | slice of [webrun-vcs#215](https://github.com/statewalker/webrun-vcs/issues/215) |
| T93 | [#376](https://github.com/statewalker/statewalker-root/issues/376) | Archive attributes and remote archives: `export-ignore`, `export-subst`, `upload-archive` | [#352](https://github.com/statewalker/statewalker-root/issues/352) | slice of [webrun-vcs#215](https://github.com/statewalker/webrun-vcs/issues/215) |
| T94 | [#377](https://github.com/statewalker/statewalker-root/issues/377) | Signed pushes: `push --signed`, `push-cert`, nonces, `receive.certNonceSeed` | [#318](https://github.com/statewalker/statewalker-root/issues/318) | slice of [webrun-vcs#213](https://github.com/statewalker/webrun-vcs/issues/213) |
| T95 | [#378](https://github.com/statewalker/statewalker-root/issues/378) | `git maintenance run` and its tasks | [#358](https://github.com/statewalker/statewalker-root/issues/358) |  |
| T96 | [#379](https://github.com/statewalker/statewalker-root/issues/379) | Bundle URIs: `bundle-uri` v2 command, `clone --bundle-uri`, `bundle.*`, `fetch.bundleURI` | [#351](https://github.com/statewalker/statewalker-root/issues/351) | slice of [webrun-vcs#215](https://github.com/statewalker/webrun-vcs/issues/215) |
| T97 | [#380](https://github.com/statewalker/statewalker-root/issues/380) | Protocol v2 `sideband-all` | none |  |
| T98 | [#381](https://github.com/statewalker/statewalker-root/issues/381) | Protocol v2 `packfile-uris` | none |  |
| T99 | [#382](https://github.com/statewalker/statewalker-root/issues/382) | `promisor-remote` capability and large object promisors | none |  |
| T100 | [#383](https://github.com/statewalker/statewalker-root/issues/383) | `object-info` client and `cat-file --batch-command remote-object-info` | [#353](https://github.com/statewalker/statewalker-root/issues/353) |  |
| T101 | [#384](https://github.com/statewalker/statewalker-root/issues/384) | Namespaces: `GIT_NAMESPACE`, `--namespace` | none | slice of [webrun-vcs#217](https://github.com/statewalker/webrun-vcs/issues/217) |
| T102 | [#385](https://github.com/statewalker/statewalker-root/issues/385) | `git daemon` front end: `--interpolated-path`, `--access-hook`, `--max-connections`, `--timeout` | none |  |
| T103 | [#386](https://github.com/statewalker/statewalker-root/issues/386) | `fast-export` and `fast-import` | none |  |
| T104 | [#387](https://github.com/statewalker/statewalker-root/issues/387) | `git history` (reword, split, fixup, drop, squash) | none |  |
| T105 | [#388](https://github.com/statewalker/statewalker-root/issues/388) | `git replay` | none |  |
| T106 | [#389](https://github.com/statewalker/statewalker-root/issues/389) | `show-branch` | none |  |
| T107 | [#390](https://github.com/statewalker/statewalker-root/issues/390) | `request-pull` | [#338](https://github.com/statewalker/statewalker-root/issues/338) |  |
| T108 | [#391](https://github.com/statewalker/statewalker-root/issues/391) | External diff: `GIT_EXTERNAL_DIFF`, `diff.external`, `--ext-diff`, `diff.<d>.command`, `GIT_DIFF_OPTS` | none |  |
| T109 | [#392](https://github.com/statewalker/statewalker-root/issues/392) | fsmonitor as a host callback: `core.fsmonitor` hook protocol, FSMN extension written | none |  |
| T110 | [#393](https://github.com/statewalker/statewalker-root/issues/393) | Bitmap pseudo-merges | [#358](https://github.com/statewalker/statewalker-root/issues/358) |  |
| T111 | [#394](https://github.com/statewalker/statewalker-root/issues/394) | `extensions.objectStorage` and its default variable | none |  |
| T112 | [#395](https://github.com/statewalker/statewalker-root/issues/395) | New info commands: `git repo info/structure`, `format-rev` | none |  |
| T113 | [#396](https://github.com/statewalker/statewalker-root/issues/396) | stash `export`/`import` (2.51+) | [#298](https://github.com/statewalker/statewalker-root/issues/298) |  |
| T114 | [#397](https://github.com/statewalker/statewalker-root/issues/397) | rebase `--apply` backend and its options | [#330](https://github.com/statewalker/statewalker-root/issues/330) |  |
| T115 | [#398](https://github.com/statewalker/statewalker-root/issues/398) | Repository event listeners (refs, index, config, worktree changed) | none |  |
| T116 | [webrun-vcs#245](https://github.com/statewalker/webrun-vcs/issues/245) | compatObjectFormat (existing issue) | none | is the issue itself |
