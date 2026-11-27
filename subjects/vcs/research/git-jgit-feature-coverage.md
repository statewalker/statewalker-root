# What do native git and JGit do, and how much of it does webrun-vcs cover?

Research for [webrun-vcs parity: feature coverage against git and JGit, and their test cases
applied](https://github.com/statewalker/statewalker-root/issues/218), first surveyed 2026-11-22,
re-surveyed 2026-11-27 ([statewalker-root#456](https://github.com/statewalker/statewalker-root/issues/456)).

**Sources:**
- git `master` of 2026-11-19 (`command-list.txt`, `Documentation/`, `t/`); git `v2.56.1` for the `t/` citation count.
- Eclipse JGit `master` of 2026-11-22 (`org.eclipse.jgit` and its bundles, `*.test` bundles).
- webrun-vcs `main` at `6e40444` (2026-11-27): `packages/*/src`, the native-twin tests, `CLAUDE.md`.

**How it was built.** Three surveys read the sources; no test suite was run for them. Coverage was judged from code, setters and tests, not from names: every row not Full was checked against webrun-vcs's code and the doc comments and bodies of its native twins. In the two git tables, "Full" needs a test that compares webrun-vcs with native git. The JGit table counts a feature as Full once webrun-vcs implements it, and marks "(twin)" where a native-twin test covers it. Native git's behaviour, not JGit's, is what counts as done.

The full tables, with a row per feature, its git `t/` scripts or JGit test classes, and the webrun-vcs evidence:

- [git porcelain](git-jgit-feature-coverage/git-porcelain.md): user-facing commands and their modes, 421 rows.
- [git internals](git-jgit-feature-coverage/git-internals.md): plumbing, object and repository formats, protocols, the server side, hooks, and the config/attributes/ignore/environment subsystems, 341 rows.
- [JGit](git-jgit-feature-coverage/jgit.md): JGit's `api` commands and subsystems, 299 features, plus 22 rows on what webrun-vcs has and JGit lacks. It also holds the JGit test classes worth porting.

## Coverage values

| Value | Meaning |
|---|---|
| **Full** | Implemented, and compared with native git by a native-twin or byte-comparison test |
| **Partial** | Implemented, but options or modes are missing, or there is no comparison with git (the Notes say which) |
| **None** | Not found |
| **N/A** | Meaningless for a TypeScript library that runs in browsers and on servers (editor UIs, the CLI's own features, Java infrastructure) |
| **?** | Could not be decided from code and tests |

Rows are not weighted. A Full row for the whole of `git merge` counts the same as a None row for one flag group. webrun-vcs is a library, so plumbing is judged by capability (the function is reachable through the API or inside a porcelain command), not by command-line or output parity. Host callbacks (filter, textconv and merge drivers, external diff, signers) count as Full when a twin runs the configured command the way git does.

## Summary

| Table | Rows | Full | Partial | None | N/A | ? |
|---|---:|---:|---:|---:|---:|---:|
| git porcelain | 421 | 399 (95%) | 7 | 9 | 6 | 0 |
| git internals | 341 | 303 (89%) | 17 | 8 | 13 | 0 |
| JGit (its features only) | 299 | 265 (89%), 178 (60%) twin-tested | 10 | 11 | 13 | 0 |

### Per area

| git porcelain area | Full | Partial | None | Rows |
|---|---:|---:|---:|---:|
| Setup (init, clone, config) | 22 | 0 | 0 | 22 |
| Snapshot (add, status, diff, commit, rm, mv, stash, restore, reset) | 90 | 1 | 1 | 92 |
| Branching (branch, checkout, switch, merge, tag, worktree, sparse-checkout) | 69 | 1 | 0 | 70 |
| Rewriting (rebase, cherry-pick, revert, am, apply, notes) | 62 | 2 | 1 | 65 |
| Inspection (log, show, blame, describe, bisect, grep, shortlog) | 72 | 0 | 1 | 75 |
| Sharing (fetch, pull, push, remote, submodule, bundle, archive) | 54 | 0 | 0 | 54 |
| Maintenance (gc, repack, fsck, maintenance) | 19 | 2 | 0 | 22 |
| Foreign SCM, tools, servers, helpers | 11 | 1 | 6 | 21 |

| git internals area | Full | Partial | None | Rows |
|---|---:|---:|---:|---:|
| Plumbing and helper commands | 73 | 5 | 4 | 86 |
| Object and repository formats | 59 | 3 | 0 | 62 |
| Protocols and transports | 45 | 2 | 1 | 49 |
| Server side | 24 | 1 | 0 | 26 |
| Hooks | 26 | 0 | 0 | 28 |
| Subsystems (config, attributes, ignore, environment, pathspec, revisions, sparse, safety, signing, maintenance) | 76 | 6 | 3 | 90 |

**Almost every porcelain command and option group is compared with native git.** That includes submodules, signing, bundles, archive, history search and diff presentation, which were whole missing areas at the first survey (the six issues below).
- **Formats:** loose objects, packs and their `.idx`/`.rev`/`.mtimes`, every index version and extension, commit-graph, bitmaps with pseudo-merges, multi-pack-index, cruft packs, alternates, promisor packs, SHA-256 and `compatObjectFormat`, reftable.
- **Transfer and server side:** protocol v0/v2 with `sideband-all`, `packfile-uris`, `bundle-uri`, `promisor-remote` and `object-info`; smart and dumb HTTP both ways for fetch; push certificates; `receive.fsckObjects`, receive limits, auto gc and namespaces.
- **Hooks:** 26 of git's 28, the other two N/A.

**Against JGit**, webrun-vcs implements 89% of JGit's features, and 60% are also compared with native git in a twin test. JGit lacks much of what webrun-vcs does, such as sparse checkout and split or sparse indexes, partial clone as a client, linked worktrees, `bisect`, `am`, `format-patch`, rename-detecting, octopus and `zdiff3` merges, `reset --keep/--merge`, the full interactive rebase, `includeIf`, most of git's hooks and `safe.directory`. What remains open against JGit is transport plumbing that webrun-vcs leaves to the host (cookies, `.netrc`, Negotiate, S3, SFTP, its own SSH client) and JGit's own machinery (Gerrit Change-Id, DFS storage, blame cache, `repo`).

## The gaps

The first survey filed its largest gaps in webrun-vcs:

| Gap | Issue | State on `6e40444` |
|---|---|---|
| Submodule commands and `--recurse-submodules` | statewalker/webrun-vcs#212 | Done |
| Signing and verification of commits, tags and pushes | statewalker/webrun-vcs#213 | Done for OpenPGP and SSH. Left: x509 (`gpgsm`) has no test, `verify-tag --format`, `%G?` in `rebase.instructionFormat` answers without checking, `for-each-ref %(signature)` is refused |
| SHA-256, `compatObjectFormat`, reftable | statewalker/webrun-vcs#214 | Done. Left: `extensions.objectStorage` payloads, `GIT_REF_STORAGE_FORMAT` |
| Bundles, bundle-uri, `git archive` with `export-ignore`/`export-subst` | statewalker/webrun-vcs#215 | Done |
| History search and diff presentation | statewalker/webrun-vcs#216 | Done |
| Receive side: `receive.fsckObjects`, `receive.maxInputSize`, `GIT_NAMESPACE`, auto gc | statewalker/webrun-vcs#217 | Done |

**What remains** (each is a row in the tables):
- **Commands and modes:** `git history` `fixup`/`drop`/`squash`, `maintenance register/start/stop` (the scheduler), `--column` layouts and `git column`, `filter-branch`, `merge-index` as a command, `rev-list --disk-usage`, `format-patch --progress`, `repack --write-midx=incremental`, the EOIE/IEOT index extensions (read, never written), `core.precomposeUnicode`.
- **Host-side protocols:** the credential helper's text protocol, `git credential` and the store/cache helpers (credentials are a host callback), the `filter.<driver>.process` protocol, `ext::`, WebDAV push over dumb HTTP, `GIT_SSH*` (ssh is a host-supplied command).
- **Out of a library's reach:** the foreign-SCM bridges (`svn`, `p4`, `cvs*`, `archimport`, `quiltimport`) and `send-email`/`imap-send`.

**Divergences kept on purpose.** webrun-vcs's `CLAUDE.md` records them; among them:
- `stash push -u` with a case-variant path;
- `multi-pack-index expire` refuses where git would delete the only copies of objects;
- `sparse-checkout clean` doesn't follow symlinked directories;
- partial-clone tip checks are stricter than git's;
- namespaced serving is stricter than git for symrefs leaving the namespace;
- a served repository's `receive.fsck.skipList` is read only inside its own git directory.

## Applying git's and JGit's tests

### Principle: native git is the oracle

JGit's tests assert JGit's behaviour, which is not always git's. The first port found 16 such cases out of 709 (below), and JGit's merges, default diff algorithm and reset modes differ from git too. So a port takes the **inputs** from JGit or git and lets **native git** decide the expected result, as webrun's native-twin tests already do. JGit's expected value is kept beside each case as information.

### What ports, in order

The [JGit table](git-jgit-feature-coverage/jgit.md#porting-jgit-tests) lists the classes and their test counts.

1. **Tier 1: JGit pure-logic classes, about 1,430 `@Test` methods.** Port as data-driven twins, each with a git command as the oracle:

   | JGit tests | Native git oracle |
   |---|---|
   | ignore: done in the pilot | `check-ignore` |
   | attributes (`AttributesMatcherTest`, `CGitAttributesTest`) | `check-attr` |
   | wildmatch (`FileNameMatcherTest`) | `check-ignore`, or `ls-files` with glob pathspecs |
   | ref names and refspecs (`ValidRefNameTest`, `RefSpecTest`) | `check-ref-format` |
   | config parsing (`ConfigTest`) | `config --get` / `--list` |
   | object checks (`ObjectCheckerTest`) | `hash-object`, `fsck` |
   | date parsing (`GitDateParserTest`) | `rev-parse --since` |
   | patch parsing (`PatchTest`, `FileHeaderTest`) | `apply --check` / `--numstat` |
   | content merge (`MergeAlgorithmTest`) | `merge-file` |
   | footers (`FooterLineTest`) | `interpret-trailers --parse` |

   Packet-line and side-band parsers need no oracle; they port as plain unit tests. The inputs of the ignore, ref-name, refspec, footer, rev-walk sort and filter, rename-detector, blame and malicious-path classes already run in twins ([JGit table](git-jgit-feature-coverage/jgit.md#porting-jgit-tests)).
2. **Tier 2: JGit repository scenarios, about 1,700 methods.** Rebuild each scenario with webrun's `buildHistory` fixture and compare the result with native git.
   - Checkout: `DirCacheCheckoutTest`, `DirCacheCheckoutMaliciousPathTest` (security).
   - Commit: `CommitOnlyTest`.
   - Merge family: `MergeCommandTest`, `RebaseCommandTest`, `StashApplyCommandTest`.
   - Diff and blame: `RenameDetectorTest`, `BlameGeneratorTest`.
   - Refs: `RefDirectoryTest`, `BatchRefUpdateTest`.
   - Server: `UploadPackTest`.
3. **git's own `t/` suite.** On 2026-11-27, `pnpm t-coverage` (git `v2.56.1`) counted 2,889 of git's 18,144 in-scope `t/` tests (15.9%) cited by name in webrun-vcs's tests, from 346 of the 926 in-scope scripts; the cited scripts hold 10,580 tests (58.3%). Its scripts drive the `git` binary and `test-tool` helpers, and build their fixtures with plumbing (`update-index`, `cat-file`, `ls-files`, `hash-object`) that webrun-vcs exposes only as an API.
   - Running them needs a git-compatible CLI shim over the `Git` facade, run with `GIT_TEST_INSTALLED`.
   - Until a decision on that, `t/` scripts serve as a source of scenarios to mine by hand. Each row in the tables names the scripts for its feature.

**Not worth porting:** JGit's DFS, block-cache, window-cache, servlet, Apache MINA, `gpg.bc` key and reftable tests (reftable is covered by twins against native git instead).

The plan, and the decision on the CLI shim, are in statewalker/webrun-vcs#218.

The gaps in these tables became tickets, ordered in waves: the roadmap is
[`subjects/vcs/roadmap.md`](../roadmap.md) and the plan issue is
statewalker/statewalker-root#282.

### First port: JGit's ignore rule cases (statewalker/webrun-vcs#211)

**What was ported.** 709 distinct (pattern, path) cases from `IgnoreRuleSpecialCasesTest`, `FastIgnoreRuleTest` and `IgnoreMatcherParametrizedTest`, extracted by a script into a fixture.

**How each case runs.**
1. A `.gitignore` holding the pattern and the path, as a file or a directory, are written to disk.
2. Native `git check-ignore --no-index -v` decides.
3. webrun-vcs's `isIgnored` and its worktree walk must give the same answer.

**Results.**
- webrun-vcs agrees with git in all 707 usable cases. The existing random differential fuzz (`ignore-fuzz-native.test.ts`) had already made this area sound, so the port adds deterministic coverage and found no defect.
- **JGit's expectations differ from git in 16 cases:**
  - POSIX classes against non-ASCII names: JGit matches `ö` with `[[:alpha:]]`, while git compares bytes.
  - `[[:word:]]`: JGit accepts it, git doesn't know the class.
  - A backslash before `/`: `foo\/bar\/`.
  - A negated `**` rule: `!**/*.zip` against `c/a/b.zip`.
- **Lesson for later ports:** `check-ignore` (like most git commands) reads its arguments as pathspecs. A name starting with `:` is pathspec magic, and git silently answers nothing for it. Oracle queries must pass `./<path>`.

## Unsure points

No row is marked `?` any more. The weakest grades are the Partial ones that only lack a twin: x509 signing, `core.precomposeUnicode`, and the commit message editor (a callback that does not receive `GIT_EDITOR`'s command). The git `t/` names in the tables are the main one to three scripts per feature, picked from file names and greps. They are pointers, not a complete mapping.
