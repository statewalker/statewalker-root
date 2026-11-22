# What do native git and JGit do, and how much of it does webrun-vcs cover?

Research for [webrun-vcs parity: feature coverage against git and JGit, and their test cases
applied](https://github.com/statewalker/statewalker-root/issues/218), 2026-11-22.

**Sources:**
- git `master` of 2026-11-19 (`command-list.txt`, `Documentation/`, `t/`).
- Eclipse JGit `master` of 2026-11-22 (`org.eclipse.jgit` and its bundles, `*.test` bundles).
- webrun-vcs `main` at P4.82 (`5a488ed`, statewalker/webrun-vcs#210): `packages/*/src`, the native-twin tests, `CLAUDE.md`.

**How it was built.** Three surveys read the sources; no test suite was run for them. Coverage was judged from code, setters and tests, not from names. "Full" needs a test that compares webrun-vcs with native git, and a sample of Full claims was checked against the test bodies.

The full tables, with a row per feature, its git `t/` scripts or JGit test classes, and the webrun-vcs evidence:

- [git porcelain](git-jgit-feature-coverage/git-porcelain.md): user-facing commands and their modes, 420 rows.
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

Rows are not weighted. A Full row for the whole of `git merge` counts the same as a None row for one flag group. webrun-vcs is a library, so plumbing is judged by capability (the function is reachable through the API or inside a porcelain command), not by command-line or output parity.

## Summary

| Table | Rows | Full | Partial | None | N/A | ? |
|---|---:|---:|---:|---:|---:|---:|
| git porcelain | 420 | 226 (54%) | 68 | 110 | 6 | 10 |
| git internals | 341 | 199 (58%) | 60 | 64 | 13 | 5 |
| JGit (its features only) | 299 | 216 (72%) | 28 | 37 | 13 | 5 |

### Per area

| git porcelain area | Full | Partial | None | Rows |
|---|---:|---:|---:|---:|
| Setup (init, clone, config) | 9 | 7 | 4 | 22 |
| Snapshot (add, status, diff, commit, rm, mv, stash, restore, reset) | 65 | 8 | 17 | 92 |
| Branching (branch, checkout, switch, merge, tag, worktree, sparse-checkout) | 46 | 12 | 12 | 70 |
| Rewriting (rebase, cherry-pick, revert, am, apply, notes) | 37 | 8 | 19 | 65 |
| Inspection (log, show, blame, describe, bisect, grep, shortlog) | 34 | 9 | 25 | 75 |
| Sharing (fetch, pull, push, remote, submodule, bundle, archive) | 25 | 10 | 18 | 53 |
| Maintenance (gc, repack, fsck, maintenance) | 7 | 7 | 7 | 22 |
| Foreign SCM, tools, servers, helpers | 3 | 7 | 8 | 21 |

| git internals area | Full | Partial | None | Rows |
|---|---:|---:|---:|---:|
| Plumbing and helper commands | 30 | 30 | 22 | 86 |
| Object and repository formats | 44 | 11 | 6 | 62 |
| Protocols and transports | 31 | 6 | 11 | 49 |
| Server side | 15 | 4 | 6 | 26 |
| Hooks | 24 | 0 | 2 | 28 |
| Subsystems (config, attributes, ignore, environment, pathspec, revisions, sparse, safety, signing, maintenance) | 55 | 9 | 17 | 90 |

**The strongest areas** are the object store and its formats, everyday porcelain (add, commit, status, diff, checkout/switch, reset, stash, merge, rebase including interactive and `--rebase-merges`), the transfer protocols and the server side, and hooks.
- **Formats:** loose objects, packs, every index version and extension including split, sparse and the untracked cache, commit-graph, bitmaps, multi-pack-index, alternates, partial-clone promisor packs.
- **Transfer and server side:** protocol v0/v2, smart and dumb HTTP serving, shallow and partial clones with lazy fetch, upload-pack and receive-pack with quarantine.
- **Hooks:** 24 of git's 28.

**Against JGit**, webrun-vcs covers 72% of JGit's features fully, and it does much that JGit does not:
- sparse checkout and split or sparse indexes;
- partial clone as a client;
- linked-worktree commands;
- `bisect`, `am`, `format-patch`, `add -i/-p`;
- merges that detect renames (JGit's merges do not), octopus merges and `zdiff3`;
- `reset --keep/--merge`, which JGit declares but throws on;
- the full interactive rebase;
- `includeIf` and `git -c` in config;
- most of git's hooks, `safe.directory`, and fsck for file repositories.

## The largest gaps

Each group is filed in webrun-vcs, where the work belongs (`docs/agents/issue-tracker.md`):

| Gap | Where it shows | Issue |
|---|---|---|
| Submodule commands: add, init/deinit, update, sync, foreach, absorbgitdirs, and `--recurse-submodules` everywhere | porcelain, JGit | statewalker/webrun-vcs#212 |
| Signing and verification of commits, tags and pushes. `TagCommand.setSigned(true)` silently makes an unsigned annotated tag | porcelain, internals, JGit | statewalker/webrun-vcs#213 |
| SHA-256, `compatObjectFormat` and reftable are refused; git 3.0 plans them as defaults for new repositories | internals, JGit | statewalker/webrun-vcs#214 |
| Bundles, bundle-uri, `git archive` with `export-ignore`/`export-subst` | porcelain, internals, JGit | statewalker/webrun-vcs#215 |
| History search and diff presentation: grep, shortlog, range-diff, name-rev; `log --grep/-S/-G/-L`; word-diff, `--color-moved`, `--check`; blame `-M/-C/--reverse/--ignore-rev` | porcelain, JGit | statewalker/webrun-vcs#216 |
| Receive side: `receive.fsckObjects` (fetch checks objects, push does not), `receive.maxInputSize`, `GIT_NAMESPACE`, auto gc | internals | statewalker/webrun-vcs#217 |

Smaller gaps are in the tables and not filed one by one:
- **Commit options:** `--fixup/--squash`, `-C/-c`, `-s`, `--trailer`.
- **List commands:** `branch -v/--format/--sort/--merged`, tag list filters.
- **Remotes and transfer:** `remote show/prune/update`, `push -u/--follow-tags`, `fetch --all`.
- **Rewriting:** `rebase --fork-point/--keep-base`, `cherry-pick -x/--ff`, `merge -s subtree` and most `-X` options.
- **Commands with no equivalent:** `rerere`, `maintenance`, `replace`.
- **Packs:** `.rev` files (git writes them by default), cruft packs, geometric repack.
- **Protocol v2:** `packfile-uris`, `sideband-all`, `promisor-remote`.
- **Missing transports:** the dumb-HTTP client, WebDAV, `ext::`, an ssh client of its own, credential helpers. SSH, credentials, filter drivers, textconv and merge drivers are callbacks the host supplies.

Each of these is a row in the tables and can be picked up from there.

**Divergences kept on purpose.** webrun-vcs's `CLAUDE.md` records them:
- `stash push -u` with a case-variant path;
- `multi-pack-index expire` refuses where git would delete the only copies of objects;
- `sparse-checkout clean` doesn't follow symlinked directories;
- partial-clone tip checks are stricter than git's.

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

   Packet-line and side-band parsers need no oracle; they port as plain unit tests.
2. **Tier 2: JGit repository scenarios, about 1,700 methods.** Rebuild each scenario with webrun's `buildHistory` fixture and compare the result with native git.
   - Checkout: `DirCacheCheckoutTest`, `DirCacheCheckoutMaliciousPathTest` (security).
   - Commit: `CommitOnlyTest`.
   - Merge family: `MergeCommandTest`, `RebaseCommandTest`, `StashApplyCommandTest`.
   - Diff and blame: `RenameDetectorTest`, `BlameGeneratorTest`.
   - Refs: `RefDirectoryTest`, `BatchRefUpdateTest`.
   - Server: `UploadPackTest`.
3. **git's own `t/` suite.** Its scripts drive the `git` binary and `test-tool` helpers, and build their fixtures with plumbing (`update-index`, `cat-file`, `ls-files`, `hash-object`) that webrun-vcs exposes only as an API.
   - Running them needs a git-compatible CLI shim over the `Git` facade, run with `GIT_TEST_INSTALLED`.
   - Until a decision on that, `t/` scripts serve as a source of scenarios to mine by hand. Each row in the tables names the scripts for its feature.

**Not worth porting:** JGit's DFS, block-cache, window-cache, servlet, Apache MINA, `gpg.bc` key and reftable tests (until reftable is in scope; statewalker/webrun-vcs#214).

The plan, and the decision on the CLI shim, are in statewalker/webrun-vcs#218.

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

The tables mark 20 rows `?`. The main ones:
- **Porcelain:** `init --separate-git-dir`, `rebase --onto <newbase> <upstream>`, the `log --branches/--glob/--exclude` revision options, and `diff --dirstat/--anchored/--quiet/--merge-base`.
- **Internals:** git-compatible `rr-cache` files, the `delta` attribute, `--pathspec-from-file`, the `.gitmodules` fsck checks, `core.precomposeUnicode`.
- **JGit:** relative gitdirs, gc cleanup of empty ref folders, copy detection, `lfs.url`, sha1dc.

Some "Partial" grades only mean that no native twin exists: `init`, `describe`, `gc` and `repack` are implemented, and gc/repack results are accepted by native fsck. The git `t/` names in the tables are the main one to three scripts per feature, picked from file names and greps. They are pointers, not a complete mapping.
