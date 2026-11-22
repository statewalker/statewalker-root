# JGit functionality and its coverage in webrun-vcs

Sources: Eclipse JGit master as of 2026-11-22 (`org.eclipse.jgit` and the `lfs`, `http.server`, `http.apache`, `ssh.apache`, `gpg.bc`, `archive`, `pgm`, `junit` bundles and their `*.test` bundles), and webrun-vcs at main plus P4.82 (paths below are relative to its `packages/`). Coverage was judged from code, doc comments and tests; "twin" means a test runs native git on the same scenario and compares (the `*native*`, `*.git.test.ts` and `*real-git*` tests). Test counts in parentheses are `@Test` annotations in the class (inherited and parameterized cases not expanded).

How to read the coverage column:

- **Full**: implemented; "(twin)" when a native-twin test covers it.
- **Partial**: implemented in part; the Notes say what is missing.
- **None**: not found in webrun-vcs.
- **N/A**: Java- or JGit-internal machinery with no meaning for a TypeScript library (servlet glue, JVM caches, Java collections, OSGi).
- **?**: could not be decided from the code read.

Rows whose JGit column says "not in JGit" are webrun-vcs features added for contrast; they are not counted as JGit coverage.

## Summary

### Counts per area (JGit features only)

| Area | Full | of which native-twin | Partial | None | N/A | ? | webrun-only rows (not counted) |
|---|---|---|---|---|---|---|---|
| Repository setup | 4 | 2 | 1 | 0 | 1 | 1 | 0 |
| Clone | 4 | 3 | 0 | 1 | 0 | 0 | 2 |
| Staging | 5 | 3 | 0 | 0 | 0 | 0 | 2 |
| Commit | 6 | 4 | 0 | 2 | 0 | 0 | 0 |
| Status | 3 | 2 | 0 | 0 | 0 | 0 | 2 |
| Clean | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Reset | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| Checkout | 5 | 3 | 1 | 0 | 0 | 0 | 0 |
| Branch | 5 | 1 | 0 | 0 | 0 | 0 | 1 |
| Tag | 2 | 0 | 1 | 2 | 0 | 0 | 0 |
| Log | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| Diff | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| Blame | 3 | 2 | 0 | 3 | 0 | 0 | 0 |
| Describe | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Reflog | 2 | 2 | 0 | 1 | 0 | 0 | 0 |
| Merge | 6 | 3 | 0 | 0 | 0 | 0 | 0 |
| Rebase | 6 | 4 | 0 | 0 | 0 | 0 | 0 |
| Cherry-pick | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| Revert | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Stash | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| Apply | 2 | 1 | 0 | 0 | 0 | 0 | 1 |
| Remote | 18 | 7 | 0 | 2 | 0 | 0 | 0 |
| Notes | 3 | 2 | 0 | 0 | 0 | 0 | 1 |
| Submodules | 3 | 1 | 1 | 3 | 0 | 0 | 1 |
| Archive | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| GC | 6 | 4 | 2 | 2 | 0 | 1 | 1 |
| RevWalk | 13 | 7 | 2 | 1 | 2 | 0 | 1 |
| RevPlot | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| TreeWalk | 7 | 3 | 0 | 0 | 0 | 0 | 0 |
| DirCache | 6 | 2 | 0 | 0 | 0 | 0 | 1 |
| Diff engine | 9 | 6 | 1 | 0 | 0 | 1 | 1 |
| Merge engine | 7 | 4 | 0 | 1 | 0 | 0 | 2 |
| Attributes | 3 | 3 | 0 | 0 | 0 | 0 | 1 |
| Ignore | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| Hooks | 3 | 2 | 0 | 0 | 0 | 0 | 1 |
| Config | 6 | 4 | 0 | 1 | 0 | 0 | 2 |
| Refs | 6 | 3 | 0 | 2 | 0 | 0 | 0 |
| Objects | 8 | 4 | 0 | 0 | 0 | 0 | 0 |
| Packs | 8 | 5 | 1 | 0 | 0 | 0 | 0 |
| Commit-graph | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Fsck | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| DFS | 1 | 0 | 2 | 1 | 2 | 0 | 0 |
| Storage misc | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Transport client | 7 | 5 | 5 | 6 | 0 | 0 | 0 |
| Protocol | 6 | 3 | 0 | 2 | 0 | 0 | 0 |
| Server | 10 | 8 | 2 | 1 | 1 | 0 | 0 |
| LFS | 4 | 3 | 1 | 1 | 0 | 1 | 1 |
| Events | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| Repo tool | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| Util | 5 | 1 | 0 | 0 | 4 | 1 | 0 |
| OSGi/Ant/UI | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Test infra | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| pgm CLI | 3 | 1 | 4 | 1 | 1 | 0 | 0 |
| pgm debug | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| Sparse | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| **Total** | **216** | **122** | **28** | **37** | **13** | **5** | **22** |

Over the 299 JGit features: 216 Full (122 of them checked against native git), 28 Partial, 37 None, 13 N/A, 5 unknown. JGit's library surface is largely covered; what is missing clusters in a few subsystems.

### Largest gaps: JGit has it, webrun-vcs does not

1. **Signing and verification.** Commit and tag signing (GPG through BouncyCastle, X.509, SSH signatures with allowed-signers and KRLs), `VerifySignatureCommand`, `GpgConfig`, and signed pushes (push certificates, nonces, `PushCertificateStore`). webrun parses and preserves `gpgsig` headers but cannot sign or verify; `TagCommand.setSigned` only makes an annotated tag.
2. **Submodule porcelain.** `submodule add/init/sync/deinit/update`, `clone --recurse-submodules`, `fetch`/`pull --recurse-submodules`. webrun reads `.gitmodules`, validates it in fsck, merges gitlinks, shows submodules in status/diff and has `submodule summary`, but cannot populate or update submodules.
3. **Reftable.** JGit reads, writes, compacts and converts reftable ref storage (files and DFS). webrun refuses `extensions.refStorage=reftable` repositories.
4. **Transports beyond the git wire protocol.** Bundles (`TransportBundle`, `BundleWriter`), the dumb HTTP client, Amazon S3 and SFTP transports, a built-in SSH client (Apache MINA: keys, agent, known_hosts, `~/.ssh/config`, proxies), HTTP Digest/Negotiate auth, cookie files, `.netrc`, `http.<url>.*` config. webrun speaks ssh only over a command channel the host supplies, and HTTP only with Basic credentials over the host's `fetch`.
5. **Archive.** `ArchiveCommand` with tar, tgz, tbz2, txz and zip formats.
6. **Smaller items.** `NameRevCommand`; blame `--reverse`, `--ignore-rev` and JGit's blame cache; log `--grep` and composable RevFilters (And/Or/Not/pattern); `--boundary`; `ListTagCommand.setContains`; reflog expiry; pack `.rev` files; protocol v2 `packfile-uris`; the LFS server's S3 backend; external diff/merge tools (`difftool`/`mergetool`); Gerrit `Change-Id` insertion; the `repo` manifest tool; the JGit-only object-size index.

### webrun-vcs has, JGit lacks (briefly)

Sparse checkout (cone and non-cone) and sparse index; split index, untracked cache, resolve-undo and the other index extensions (JGit reads only `TREE`); partial clone as a client with lazy fetch and `backfill`; linked worktree commands (JGit only opens linked worktrees); `bisect`, `am`, `format-patch`, `mailinfo`, `mv`, `add -i/-p`, `restore`, `switch`, `branch --copy`, notes rewriting on amend/rebase; merge rename and directory-rename detection (JGit's merges detect no renames), the `octopus` strategy, `zdiff3`; reset `--keep`/`--merge` (declared but unimplemented in JGit); full interactive rebase (`exec`, `break`, `drop`, label/reset/merge, autosquash, update-refs; JGit has pick/reword/edit/squash/fixup only); patience diff, textconv, custom `xfuncname`; `includeIf` and command-line config; long-running process filters, `ident`, `working-tree-encoding`; most of git's hooks (prepare-commit-msg, post-checkout, post-merge, post-rewrite, reference-transaction, post-index-change, server script hooks, `proc-receive`, configured `hook.*`); `safe.directory` ownership checks; mailmap; split commit-graph chains (JGit uses one file and leaves commit-graph off by default); git's own fsck for file repositories (JGit has fsck only for DFS); LFS file locking; transports over WebSocket, MessagePort, libp2p and httpeers; storage backends on key-value stores and SQL; Xet reads.

### Where JGit itself differs from native git (as seen in this survey)

- Merges never detect renames; no octopus; it offers a `theirs` strategy git does not have.
- Default diff algorithm is JGit's histogram (git's is myers), and JGit's histogram is its own implementation, not xdiff's.
- `ResetCommand` declares `KEEP`/`MERGE` but throws `UnsupportedOperationException`.
- Index: only the `TREE` extension is understood; no split/sparse index, untracked cache or sparse checkout.
- Config: no `includeIf`; no `git -c`/`GIT_CONFIG_COUNT`.
- Hooks: only pre-commit, commit-msg, post-commit, pre-push (and post-receive on the server); server hooks are mainly Java callbacks.
- No partial clone client, no linked-worktree commands, no textconv, no `ident`/`working-tree-encoding`/process filters, no mailmap.
- Extras git does not have: Amazon S3 and encrypted walk transports, DFS storage, the object-size index, Gerrit Change-Id insertion, the `repo` tool.

## Feature table

| Area | JGit feature | JGit API / class | JGit tests (main test classes) | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Repository setup | Open/discover a repository (`Git.open`, `FileRepositoryBuilder.findGitDir`, `GIT_DIR`/`GIT_WORK_TREE`/ceilings) | `Git`, `FileRepositoryBuilder`, `BaseRepositoryBuilder` | FileRepositoryBuilderTest, RepositorySetupWorkDirTest, GitConstructionTest | Full (twin) | vcs-store-files/src/safety/, vcs-store-files/src/workspace/working-copy/working-copy-factory.files.ts; repository-ownership-native, discovery-ceiling.git | webrun adds `safe.directory` ownership checks, `GIT_CEILING_DIRECTORIES`, filesystem boundaries; JGit has no ownership check |
| Repository setup | Repository format extensions (`core.repositoryformatversion`, `extensions.*`) | `FileRepository`, `RefStorageFormat`, `ObjectFormat` | RefStorageFormatTest, ObjectFormatTest | Partial | vcs-store-files/src/repository-format.ts; repository-format.git | webrun validates and refuses reftable and sha256 repositories; JGit opens reftable ones. `ObjectFormat.SHA256` in JGit is a bare enum (no SHA-256 repository support yet) |
| Repository setup | `InitCommand` (bare, gitDir, directory, initial branch) | `api/InitCommand` | InitCommandTest | Full | vcs-commands/src/commands/init-command.ts | webrun also takes custom stores (`setStagingStore`, `setWorktreeStore`) |
| Repository setup | Init with relative gitdir/worktree paths | `InitCommand.setRelativeDirs`, `CloneCommand.setRelativePaths` | InitCommandTest | ? | vcs-commands/src/commands/init-command.ts | not found as an option; linked worktrees write git's relative/absolute paths as git does |
| Repository setup | Linked worktree repositories (`commondir`, `gitdir` files) | `FileRepository`, `BaseRepositoryBuilder` | LinkedWorktreeTest (2) | Full (twin) | vcs-working-tree/src/linked-worktrees/, vcs-commands/src/commands/worktree-*-command.ts; worktree-native | JGit only reads linked worktrees; it has no `worktree add/list/remove` (webrun has all eight subcommands) |
| Repository setup | `RepositoryCache` (shared open repositories, expiry) | `lib/RepositoryCache` | RepositoryCacheTest, RepositoryCacheConfigTest | N/A | | JVM resource-sharing concern; webrun objects are plain values over a FilesApi |
| Repository setup | `.git/description`, repository state (merging, rebasing, cherry-picking, bisecting...) | `Repository.getRepositoryState`, `RepositoryState` | DescriptionTest, (state checks across api tests) | Full | vcs-working-tree/src/working-copy/repository-state.ts, vcs-commands/src/commands/sequencer-support.ts | |
| Clone | `CloneCommand` basic clone (URI, directory, remote name, checkout) | `api/CloneCommand` | CloneCommandTest (40), pgm CloneTest | Full (twin) | vcs-commands/src/commands/clone-command.ts; clone-fetch-native-git, clone-destination-native, clone-real-git | |
| Clone | Bare and mirror clones | `setBare`, `setMirror` | CloneCommandTest | Full | vcs-commands/src/commands/clone-command.ts | |
| Clone | Branch selection (`setBranch`, `setBranchesToClone`, `setCloneAllBranches`), `--no-checkout`, `--no-tags`, tag option | `CloneCommand` setters | CloneCommandTest | Full (twin) | vcs-commands/src/commands/clone-command.ts; clone-initial-transaction-native | webrun also `--single-branch`, `--sparse`, `--reference`, `--shared`, `--dissociate`, `--local` |
| Clone | Shallow clone (`setDepth`, `setShallowSince`, `addShallowExclude`) | `CloneCommand`, `FetchCommand`, `DepthWalk` | CloneCommandTest, RevWalkShallowTest, UploadPackTest | Full (twin) | vcs-commands/src/commands/clone-command.ts, vcs-transport/src/fetch-client/fetch-pack.ts; serve-shallow-native | |
| Clone | Recurse into submodules on clone | `CloneCommand.setCloneSubmodules` | CloneCommandTest, SubmoduleUpdateTest | None | vcs-commands/src/commands/clone-command.ts (submodules left as empty directories) | |
| Clone | Local clone fast path (copy objects) | (JGit always fetches through `TransportLocal`) | — | Full (twin) | vcs-commands/src/commands/local-clone.ts; clone-local-native | webrun-only: git's `clone_local` copy; JGit has no equivalent |
| Clone | Partial clone (`--filter`) as a client | not in JGit (`FetchCommand`/`CloneCommand` have no filter) | — | Full (twin) | vcs-commands/src/commands/clone-command.ts `setFilter`, promisor-remote.ts; partial-clone-lazy-native | JGit lacks client-side partial clone and lazy fetch |
| Staging | `AddCommand` file patterns | `api/AddCommand.addFilepattern` | AddCommandTest (41), pgm AddTest | Full (twin) | vcs-commands/src/commands/add-command.ts, index-adder.ts; add-native | |
| Staging | `add --update` / `--all` (stage deletions) | `AddCommand.setUpdate`, `setAll` | AddCommandTest | Full (twin) | vcs-commands/src/commands/add-command.ts; add-native | |
| Staging | `add --renormalize` | `AddCommand.setRenormalize` | AddCommandTest | Full | vcs-commands/src/commands/add-command.ts, vcs-working-tree/src/convert/eol.ts | |
| Staging | Custom `WorkingTreeIterator` for add/status | `setWorkingTreeIterator`, `StatusCommand.setWorkingTreeIt` | AddCommandTest, FileTreeIteratorTest | Full | vcs-working-tree/src/worktree/worktree.ts (Worktree interface), vcs-commands add `setWorktreeStore` | different seam: a `Worktree`/`FilesApi` instead of an iterator |
| Staging | `RmCommand` (with `--cached`) | `api/RmCommand` | RmCommandTest (2), pgm RmTest | Full (twin) | vcs-commands/src/commands/rm-command.ts; rm-pathspec-native | webrun also `-r`, `--force` checks, sparse handling |
| Staging | `mv` | not in JGit api | — | Full (twin) | vcs-commands/src/commands/mv-command.ts; mv-native | webrun-only |
| Staging | Interactive/patch add (`-i`, `-p`) | not in JGit | — | Full (twin) | vcs-commands/src/commands/add-patch/; add-patch-native, add-interactive-native | webrun-only |
| Commit | `CommitCommand` message, author, committer | `api/CommitCommand` | CommitCommandTest (26), CommitAndLogCommandTest | Full (twin) | vcs-commands/src/commands/commit-command.ts, git-ident.ts; ident-native, commit-status-native | |
| Commit | `--all`, `--only` paths, `--amend`, `--allow-empty` | `setAll`, `setOnly`, `setAmend`, `setAllowEmpty` | CommitOnlyTest (96), CommitCommandTest | Full (twin) | vcs-commands/src/commands/commit-command.ts; commit-status-native | |
| Commit | Message cleanup modes and comment character | `setCleanupMode`, `setCommentCharacter`, `CommitConfig` | CommitConfigTest (26), CommitTemplateConfigTest | Full (twin) | vcs-commands/src/commands/message-cleanup.ts; message-cleanup-native, commit-editmsg-native | |
| Commit | Commit template (`commit.template`) | `CommitConfig.getCommitTemplateContent` | CommitTemplateConfigTest | Full | vcs-commands/src/commands/commit-command.ts `setTemplate` | |
| Commit | Gerrit `Change-Id` insertion | `setInsertChangeId`, `util/ChangeIdUtil` | ChangeIdUtilTest (35) | None | | JGit-specific (Gerrit); native git uses a commit-msg hook |
| Commit | `--no-verify`, hook output streams | `setNoVerify`, `setHookOutputStream` | HookTest | Full (twin) | vcs-commands/src/commands/git-hooks.ts; hooks-commit-native | |
| Commit | GPG/X.509/SSH signing of commits | `setSign`, `setSigner`, `setSigningKey`, `setGpgConfig`, `lib/Signer`, `Signers` | GpgConfigTest, BouncyCastleGpgKeyLocatorTest, SshSignerTest | None | (commit/tag parsers keep `gpgsig` headers: vcs-core/src/history/commits/commit-format.ts) | no signing or verification anywhere in webrun |
| Commit | Reflog comment for commit | `setReflogComment` | CommitCommandTest | Full | vcs-commands/src/commands/reflog-messages.ts | |
| Status | `StatusCommand` (added/changed/removed/missing/modified/untracked/conflicting) | `api/StatusCommand`, `lib/IndexDiff` | StatusCommandTest, IndexDiffTest (17), pgm StatusTest | Full (twin) | vcs-commands/src/commands/status-command.ts, vcs-working-tree/src/status/; status-long-native, status-gaps-native | |
| Status | Ignore submodules modes | `setIgnoreSubmodules` | IndexDiffSubmoduleTest | Full | vcs-commands/src/commands/status-command.ts | |
| Status | Untracked-files modes, ignored files listing | `IndexDiff.getIgnoredNotInIndex` | IndexDiffTest | Full (twin) | vcs-working-tree/src/status/untracked-scan.ts; status-untracked-modes-native | |
| Status | Untracked cache, fsmonitor | not in JGit | — | Partial | vcs-working-tree/src/status/untracked-cache.ts; status-untracked-cache-native | webrun has the untracked cache (JGit none); neither has fsmonitor |
| Status | Rename detection in status | not in JGit StatusCommand | — | Full | vcs-commands/src/commands/status-command.ts `setRenames` | webrun-only |
| Clean | `CleanCommand` (dirs, dry run, force, ignored, paths) | `api/CleanCommand` | CleanCommandTest (13), pgm CleanTest | Full (twin) | vcs-commands/src/commands/clean-command.ts; clean-fuzz-native | |
| Reset | `ResetCommand` soft/mixed/hard | `api/ResetCommand` | ResetCommandTest (22), pgm ResetTest | Full (twin) | vcs-commands/src/commands/reset-command.ts; reset-refresh-native | |
| Reset | Reset `--keep` / `--merge` | `ResetType.KEEP`, `MERGE` | ResetCommandTest | Full | vcs-commands/src/types.ts, reset-command.ts | JGit declares KEEP/MERGE but throws `UnsupportedOperationException` for them (only soft/mixed/hard implemented) |
| Reset | Reset paths (`reset -- <paths>`) | `ResetCommand.addPath` | ResetCommandTest | Full (twin) | vcs-commands/src/commands/checkout-paths.ts | |
| Checkout | Switch branch / detach / create branch | `api/CheckoutCommand` setName, setCreateBranch, setStartPoint | CheckoutCommandTest (36), pgm CheckoutTest | Full (twin) | vcs-commands/src/commands/checkout-command.ts, switch-command.ts; switch-native, switch-merge-native | |
| Checkout | Orphan branch | `setOrphan` | CheckoutCommandTest | Full | vcs-commands/src/commands/checkout-command.ts `setOrphan` | |
| Checkout | Checkout paths, `--ours`/`--theirs` stage | `addPath`, `setAllPaths`, `setStage` | PathCheckoutCommandTest (18) | Full (twin) | vcs-commands/src/commands/checkout-paths.ts, restore-command.ts; checkout-paths-native | |
| Checkout | Force checkout, upstream tracking mode on branch creation | `setForced`, `setForceRefUpdate`, `setUpstreamMode` | CheckoutCommandTest, BranchCommandTest | Full | vcs-commands/src/commands/checkout-command.ts `setTrack`, branch-tracking.ts | |
| Checkout | `DirCacheCheckout` two-way merge with conflict detection | `dircache/DirCacheCheckout` | DirCacheCheckoutTest (78) | Full (twin) | vcs-working-tree/src/checkout/, vcs-commands/src/commands/tree-restore.ts; initial-checkout-native | |
| Checkout | Malicious path protection (`.git`, `..`, NTFS/HFS names) | `DirCacheCheckout.checkValidPath`, `ObjectChecker` | DirCacheCheckoutMaliciousPathTest (42), InvalidPathCheckoutTest | Partial | vcs-commands/src/commands/fsck/fsck-object-checks.ts (hasDotgit/NTFS/HFS checks) | fsck applies git's checks; whether checkout refuses every such path was not confirmed |
| Branch | Create branch (start point, force, upstream mode) | `CreateBranchCommand` | BranchCommandTest (18), pgm BranchTest | Full (twin) | vcs-commands/src/commands/branch-command.ts; branch-state-native | |
| Branch | Delete branches (force, merged check) | `DeleteBranchCommand` | BranchCommandTest | Full | vcs-commands/src/commands/branch-command.ts | |
| Branch | List branches (local/remote/all, `--contains`) | `ListBranchCommand.setListMode`, `setContains` | BranchCommandTest | Full | vcs-commands/src/commands/branch-command.ts | |
| Branch | Rename branch (config section moved) | `RenameBranchCommand` | RenameBranchCommandTest (7) | Full | vcs-commands/src/commands/branch-command.ts | |
| Branch | Copy branch | not in JGit | — | Full (twin) | vcs-commands/src/commands/branch-command.ts `CopyBranchCommand`; branch-copy-native | webrun-only |
| Branch | Tracking status (ahead/behind) | `lib/BranchTrackingStatus`, `BranchConfig` | BranchTrackingStatusTest, BranchConfigTest | Full | vcs-commands/src/commands/tracking-info.ts | |
| Tag | Create lightweight/annotated tags (force, tagger, message) | `TagCommand` | TagCommandTest (16), TagBuilderTest, pgm TagTest | Full | vcs-commands/src/commands/tag-command.ts | |
| Tag | Signed tags | `TagCommand.setSigned`, `setSigner` | TagCommandTest, GpgConfigTest | None | vcs-commands/src/commands/tag-command.ts (`setSigned` only makes the tag annotated) | |
| Tag | Delete tags | `DeleteTagCommand` | TagCommandTest | Full | vcs-commands/src/commands/tag-command.ts | |
| Tag | List tags, `--contains` | `ListTagCommand.setContains` | TagCommandTest | Partial | vcs-commands/src/commands/tag-command.ts `ListTagCommand` | listing yes; no `--contains` filter found |
| Tag | Verify commit/tag signatures | `VerifySignatureCommand`, `SignatureVerifiers` | VerifyGitSignaturesTest, SshSignatureVerifierTest | None | | |
| Log | `LogCommand` (ranges, paths, max count, skip) | `api/LogCommand` | LogCommandTest (10), CommitAndLogCommandTest, pgm LogTest | Full (twin) | vcs-commands/src/commands/log-command.ts, rev-list-command.ts; log-path-native, log-range-fuzz-native | |
| Log | Rev filters on log (author, committer, time, merges) | `LogCommand.setRevFilter` | LogFilterTest (7) | Full | vcs-commands/src/commands/log-command.ts `setAuthorFilter`, `setSince`, `RevFilter.NO_MERGES` | |
| Log | Formatted output (`--pretty`, `--graph`, `--stat`, decorations, notes) | pgm `Log`, `Glog`, `revplot` | pgm LogTest | Full (twin) | vcs-commands/src/commands/log-output.ts, pretty-format.ts, log-graph.ts; log-output-native, pretty-format-native | JGit's porcelain has no formatter beyond pgm |
| Diff | `DiffCommand` (cached, old/new tree, path filter, name-only, name-status, context) | `api/DiffCommand` | DiffCommandTest (6), pgm DiffTest | Full (twin) | vcs-commands/src/commands/diff-command.ts; diff-output-native, diff-config-native | |
| Diff | Source/destination prefixes | `setSourcePrefix`, `setDestinationPrefix` | DiffFormatterTest | Full | vcs-commands/src/commands/diff-command.ts (`srcPrefix`, `dstPrefix`, `noPrefix`) | |
| Blame | `BlameCommand` (file, start commit, follow renames) | `api/BlameCommand` | BlameCommandTest (21), pgm BlameTest | Full (twin) | vcs-commands/src/commands/blame-command.ts; blame-native | |
| Blame | Blame with diff algorithm / whitespace comparator | `setDiffAlgorithm`, `setTextComparator` | BlameCommandTest | Full | blame-command.ts `setAlgorithm`, `setIgnoreWhitespace` | |
| Blame | Ignore revisions (`--ignore-rev`) | `BlameCommand.setIgnoreRevs` | BlameCommandTest | None | blame-command.ts (documented as not supported) | |
| Blame | Reverse blame | `BlameGenerator.reverse`, `ReverseWalk` | BlameGeneratorTest (18) | None | blame-command.ts (documented as not supported) | |
| Blame | Blame region merging and blame cache | `BlameRegionMerger`, `blame/cache/BlameCache` | BlameRegionMergerTest (17), BlameGeneratorCacheTest (14) | None | | JGit-specific optimisation |
| Blame | Line ranges (`-L`), porcelain output | pgm `Blame` | pgm BlameTest | Full (twin) | blame-command.ts `setLineRanges`, `formatBlamePorcelain` | |
| Describe | `DescribeCommand` (tags, all, long, always, match/exclude, abbrev) | `api/DescribeCommand` | DescribeCommandTest (11), pgm DescribeTest (16) | Full | vcs-commands/src/commands/describe-command.ts, git-describe.ts; describe-command.test | |
| Describe | `NameRevCommand` (name commits by refs) | `api/NameRevCommand` | NameRevCommandTest (11) | None | | |
| Reflog | Read reflog (`ReflogCommand`) | `api/ReflogCommand`, `ReflogReader` | ReflogCommandTest, ReflogReaderTest (8), ReflogResolveTest | Full (twin) | vcs-commands/src/commands/reflog-command.ts, vcs-core/src/history/refs/reflog-lines.ts; reflog-native | |
| Reflog | Write reflog entries on ref updates, `core.logAllRefUpdates` | `ReflogWriter`, `RefUpdate` | ReflogWriterTest, ReflogConfigTest | Full (twin) | vcs-store-files/src/refs/; fetch-reflog-flags-native | |
| Reflog | Reflog expiry | `GC` (`gc.reflogExpire`) | GcReflogTest | None | | no `reflog expire` / `gc.reflogExpire` handling found |
| Merge | `MergeCommand` fast-forward modes, squash, no-commit, message | `api/MergeCommand` | MergeCommandTest (57), pgm MergeTest | Full (twin) | vcs-commands/src/commands/merge-command.ts; merge-native-scenarios, merge-worktree-native | |
| Merge | Strategy selection | `MergeCommand.setStrategy` (RECURSIVE, RESOLVE, OURS, THEIRS, SIMPLE_TWO_WAY_IN_CORE) | MergeCommandTest, MergerTest | Full (twin) | vcs-commands/src/commands/merge-command.ts, ort-merge.ts, octopus-merge.ts; merge-octopus-native | webrun: ort/recursive, resolve, ours, octopus, subtree as git; refuses `theirs` as git does. JGit has `theirs` and no octopus |
| Merge | Content merge strategy (`-X ours/theirs`) | `setContentMergeStrategy`, `ContentMergeStrategy` | MergeCommandTest | Full | merge-command.ts `setContentMergeStrategy` | |
| Merge | Conflict style (merge, diff3) | `setConflictStyle` | MergeAlgorithmTest | Full (twin) | vcs-utils/src/diff/text-diff/line-merge.ts; line-merge-fuzz-native | webrun also `zdiff3` |
| Merge | Merge message formatting | `MergeMessageFormatter`, `SquashMessageFormatter` | MergeMessageFormatterTest (16), SquashMessageFormatterTest, MergeHeadMsgTest, SquashCommitMsgTest | Full | vcs-commands/src/commands/merge-command.ts, reflog-messages.ts | |
| Merge | Unrelated histories, autostash | (JGit merges unrelated histories silently) | — | Full | merge-command.ts `setAllowUnrelatedHistories`, `setAutoStash` | |
| Rebase | `RebaseCommand` begin/continue/skip/abort | `api/RebaseCommand`, `setOperation` | RebaseCommandTest (80) | Full (twin) | vcs-commands/src/commands/rebase-command.ts; rebase-upstream-native, rebase-worktree-native | |
| Rebase | Interactive rebase (pick, reword, edit, squash, fixup) | `RebaseCommand.InteractiveHandler`, `RebaseTodoFile`, `RebaseTodoLine` | RebaseCommandTest, RebaseTodoFileTest | Full (twin) | rebase-command.ts, rebase-todo.ts; rebase-interactive-native, rebase-instruction-format-native | webrun also exec, break, drop, label/reset/merge, `--autosquash`, `--update-refs`; JGit only pick/reword/edit/squash/fixup |
| Rebase | Preserve merges / rebase-merges | `setPreserveMerges` | RebaseCommandTest | Full (twin) | rebase-command.ts `setRebaseMerges`; rebase-merges-native | |
| Rebase | Strategy and content merge strategy for rebase | `setStrategy`, `setContentMergeStrategy` | RebaseCommandTest | Full | rebase-command.ts | |
| Rebase | Autostash (`rebase.autostash`) | `RebaseCommand` (config) | RebaseCommandTest | Full | rebase-command.ts `setAutoStash` | |
| Rebase | Skip already-applied commits (patch-id) | `RebaseCommand` (upstream walk) | RebaseCommandTest | Full (twin) | vcs-commands/src/commands/patch-id.ts; rebase-patch-id-native | |
| Cherry-pick | `CherryPickCommand` (mainline, no-commit, strategy, our name, reflog prefix) | `api/CherryPickCommand` | CherryPickCommandTest (24), merge/CherryPickTest | Full (twin) | vcs-commands/src/commands/cherry-pick-command.ts, sequencer-pick.ts; cherry-pick-revert-native | |
| Cherry-pick | Custom commit message provider | `CherryPickCommitMessageProvider` | CherryPickCommandTest | Partial | cherry-pick-command.ts `setEditor` | an editor callback instead of a provider interface |
| Revert | `RevertCommand` | `api/RevertCommand` | RevertCommandTest (12) | Full (twin) | vcs-commands/src/commands/revert-command.ts; cherry-pick-revert-native | |
| Stash | `StashCreateCommand` (untracked, index/worktree messages, person, ref) | `api/StashCreateCommand` | StashCreateCommandTest (16) | Full (twin) | vcs-commands/src/commands/stash-create-command.ts; stash-pathspec-native | webrun also `--keep-index`, `-p`, `--staged`, `--all` |
| Stash | `StashApplyCommand` (restore index, restore untracked, strategy) | `api/StashApplyCommand` | StashApplyCommandTest (32) | Full (twin) | vcs-commands/src/commands/stash-apply-command.ts; stash-apply-native | |
| Stash | `StashDropCommand`, `StashListCommand` | `api/StashDropCommand`, `StashListCommand` | StashDropCommandTest (8), StashListCommandTest (4) | Full | vcs-commands/src/commands/stash-drop-command.ts, stash-list-command.ts | |
| Apply | `ApplyCommand` / `PatchApplier` (text and binary patches, renames, modes) | `api/ApplyCommand`, `patch/PatchApplier` | ApplyCommandTest (13), PatchApplierTest (61) | Full (twin) | vcs-commands/src/commands/apply/; apply-native | webrun also `--cached`/`--index`, whitespace actions |
| Apply | Patch parsing (`Patch`, `FileHeader`, `HunkHeader`, combined diffs, binary hunks) | `patch/Patch`, `FileHeader`, `CombinedFileHeader`, `BinaryHunk` | PatchTest, FileHeaderTest (21), PatchCcTest, PatchErrorTest, GetTextTest | Full | vcs-commands/src/commands/apply/apply-parse.ts, vcs-utils/src/diff/patch/ | combined (`diff --cc`) patch parsing not confirmed |
| Apply | `am`, `format-patch`, mailinfo | not in JGit | — | Full (twin) | vcs-commands/src/commands/am/, format-patch-command.ts; am-native, format-patch-native, mailinfo-native | webrun-only |
| Remote | Fetch (`FetchCommand`: refspecs, remote, dry run, force, prune, tags, thin) | `api/FetchCommand` | FetchCommandTest (19), pgm FetchTest | Full (twin) | vcs-commands/src/commands/fetch-command.ts, vcs-transport/src/fetch-client/; remote-fetch-native-git, fetch-local-native | |
| Remote | Fetch deepen/unshallow | `FetchCommand.setDepth`, `setUnshallow`, `setShallowSince`, `addShallowExclude` | FetchCommandTest, UploadPackTest | Full | fetch-command.ts | |
| Remote | Fetch: check fetched objects (fsck), connectivity | `setCheckFetchedObjects`, `ConnectivityChecker` | IterativeConnectivityCheckerTest (9), TreeWalkConnectivityCheckerTest (33) | Full (twin) | vcs-transport/src/fetch-client/fetch-checks.ts, vcs-commands/src/commands/fsck/fetch-fsck.ts; fetch-connectivity-native | |
| Remote | Fetch recurse into submodules | `setRecurseSubmodules` | FetchAndPullCommandsRecurseSubmodulesTest | None | | |
| Remote | Fetch: FETCH_HEAD records, initial branch | `FetchHeadRecord`, `setInitialBranch` | FetchCommandTest | Full | vcs-transport/src/fetch-client/fetch-head.ts | |
| Remote | Malicious ref names from server refused | `FetchProcess` | FetchMaliciousRefNameTest (6) | Full | vcs-core/src/history/refs/ref-name.ts | |
| Remote | `PullCommand` (merge or rebase, rebase modes, ff mode, tag opt) | `api/PullCommand`, `BranchConfig.BranchRebaseMode` | PullCommandTest (21), PullCommandWithRebaseTest (6) | Full (twin) | vcs-commands/src/commands/pull-command.ts; pull-worktree-native | |
| Remote | Pull recurse submodules | `PullCommand.setRecurseSubmodules` | FetchAndPullCommandsRecurseSubmodulesTest | None | | |
| Remote | `PushCommand` (refspecs, all, tags, force, dry run, thin, atomic, receive-pack path) | `api/PushCommand` | PushCommandTest (25), AtomicPushTest, PushProcessTest (17), PushConnectionTest | Full (twin) | vcs-commands/src/commands/push-command.ts, vcs-transport/src/push-client/; push-real-git, push-local-receive-native | |
| Remote | Force-with-lease | `setRefLeaseSpecs`, `RefLeaseSpec` | PushCommandTest | Full | push-command.ts `setForceWithLease` | |
| Remote | Push options (`--push-option`) | `setPushOptions` | PushOptionsTest (8) | Full (twin) | push-command.ts; proc-receive-native | |
| Remote | `push.default` and push config | `setPushDefault`, `PushConfig` | PushConfigTest (8) | Full | vcs-commands/src/remote-config/remote-config-store.ts | |
| Remote | Push with bitmaps | `setUseBitmaps` | PushCommandTest | Full | push-command.ts `setUseBitmaps` | |
| Remote | `LsRemoteCommand` (heads, tags, upload-pack path) | `api/LsRemoteCommand` | LsRemoteCommandTest (6), pgm LsRemoteTest | Full | vcs-commands/src/commands/ls-remote-command.ts, vcs-transport/src/operations/ls-remote.ts | |
| Remote | Remote add/remove/list/set-url (push URL) | `RemoteAddCommand`, `RemoteRemoveCommand`, `RemoteListCommand`, `RemoteSetUrlCommand` | RemoteAddCommandTest, RemoteDeleteCommandTest, RemoteListCommandTest, RemoteSetUrlCommandTest, pgm RemoteTest | Full | vcs-commands/src/commands/remote-command.ts; remote-command.test | webrun also rename, get-url, set-head |
| Remote | Remote config model (`RemoteConfig`: url, pushurl, fetch/push refspecs, mirror, tagopt, timeout) | `transport/RemoteConfig` | RemoteConfigTest (28) | Full (twin) | vcs-commands/src/remote-config/; remote-url-rewrite-native | |
| Remote | URL rewriting (`url.<base>.insteadOf` / `pushInsteadOf`) | `UrlConfig` | RemoteConfigTest | Full (twin) | vcs-commands/src/remote-config/remote-config-store.ts; remote-url-rewrite-native | |
| Remote | RefSpec parsing, wildcards, negative refspecs | `transport/RefSpec` | RefSpecTest (47) | Full | vcs-transport/src/utils/refspec.ts | |
| Remote | URI parsing (`URIish`: scp-like, file, ssh, git, http) | `transport/URIish` | URIishTest (74) | Full | vcs-transport/src/connect/git-url.ts | follows git's `parse_connect_url` |
| Remote | `TransportCommand` credentials, timeout, config callback | `TransportCommand`, `TransportConfigCallback` | TransportTest | Full | vcs-commands/src/transport-command.ts, vcs-transport/src/api/credentials.ts | |
| Notes | Add/show/remove/list notes | `AddNoteCommand`, `ShowNoteCommand`, `RemoveNoteCommand`, `ListNotesCommand` | NotesCommandTest (2) | Full (twin) | vcs-commands/src/commands/notes-command.ts, notes-tree.ts; notes-native | webrun also append/edit/copy/prune/get-ref |
| Notes | Note map with fanout buckets | `notes/NoteMap`, `FanoutBucket`, `LeafBucket` | NoteMapTest (18), LeafBucketTest (11) | Full | vcs-commands/src/commands/notes-tree.ts | |
| Notes | Notes merge (strategies, conflicts) | `NoteMapMerger`, `DefaultNoteMerger` | NoteMapMergerTest (17), DefaultNoteMergerTest (6) | Full (twin) | vcs-commands/src/commands/notes-merge-command.ts; notes-native | |
| Notes | Notes rewrite on amend/rebase | not in JGit | — | Full | vcs-commands/src/commands/notes-support.ts (`copyNotesForRewrite`) | webrun-only |
| Submodules | `SubmoduleAddCommand` | `api/SubmoduleAddCommand` | SubmoduleAddTest (13) | None | | |
| Submodules | `SubmoduleInitCommand`, `SubmoduleSyncCommand`, `SubmoduleDeinitCommand` | `api/Submodule*Command` | SubmoduleInitTest (7), SubmoduleSyncTest (3), SubmoduleDeinitTest (6) | None | | |
| Submodules | `SubmoduleUpdateCommand` (checkout/merge/rebase strategies, fetch) | `api/SubmoduleUpdateCommand` | SubmoduleUpdateTest (9) | None | | |
| Submodules | `SubmoduleStatusCommand` | `api/SubmoduleStatusCommand`, `SubmoduleStatus` | SubmoduleStatusTest (7) | Partial | vcs-commands/src/commands/status-command.ts, submodule-summary-command.ts | submodule state appears in status/diff/summary; no `submodule status` listing command |
| Submodules | `SubmoduleWalk` (`.gitmodules` parsing, path/name/url lookup) | `submodule/SubmoduleWalk`, `lib/SubmoduleConfig` | SubmoduleWalkTest (11), SubmoduleConfigTest | Full | vcs-commands/src/commands/submodule-config.ts (`parseGitmodules`) | |
| Submodules | `.gitmodules` validation (names, URLs, update settings) | `internal/submodule/SubmoduleValidator` | SubmoduleValidatorTest (3) | Full (twin) | vcs-commands/src/commands/fsck/fsck-object-checks.ts (`checkSubmoduleName`, `checkSubmoduleUrl`); fsck-native | |
| Submodules | Gitlink merges | `ResolveMerger` gitlink handling | GitlinkMergeTest (19) | Full | vcs-commands/src/commands/ort-merge.ts | |
| Submodules | Submodule summary / diff `--submodule=log` | not in JGit | — | Full (twin) | vcs-commands/src/commands/submodule-summary.ts; submodule-summary-native | webrun-only |
| Archive | `ArchiveCommand` (tree, prefix, paths, format options) | `api/ArchiveCommand` | ArchiveCommandTest (13), pgm ArchiveTest (30) | None | | |
| Archive | Formats tar, tgz, tbz2, txz, zip | `org.eclipse.jgit.archive.*Format` | pgm ArchiveTest | None | | the served handlers refuse `git-upload-archive` |
| GC | `GarbageCollectCommand` (aggressive, expire, preserve old packs, pack kept objects) | `api/GarbageCollectCommand`, `internal/storage/file/GC` | GarbageCollectCommandTest, GcBasicPackingTest, GcPruneNonReferencedTest, GcKeepFilesTest | Partial | vcs-commands/src/commands/gc-command.ts, vcs-store-files/src/gc.ts, repack.ts; repack-gc.git | aggressive, expire, `--auto`, `.keep`, cruft packs yes; JGit's preserve/prune-preserved pack directory not present |
| GC | Auto GC (`gc.auto`, `gc.autoPackLimit`, background) | `GC.setAuto`, `AutoGcTest` | AutoGcTest (4) | Full (twin) | gc-command.ts `setAuto`; hooks-auto-gc-native | webrun never triggers it implicitly; JGit runs it after some commands |
| GC | Pack refs during gc | `GC.packRefs` | GcPackRefsTest (7) | Full (twin) | gc-command.ts `setPackRefs`; packed-refs-native | |
| GC | Delete empty ref folders, orphan/temporary files | `GC` | GcDeleteEmptyRefsFoldersTest, GcOrphanFilesTest, GcTemporaryFilesTest | ? | vcs-store-files/src/gc.ts | not verified |
| GC | Write commit-graph during gc | `GC.writeCommitGraph` (`gc.writeCommitGraph`) | GcCommitGraphTest (7) | Full | vcs-store-files/src/commit-graph.ts; commit-graph.git | |
| GC | Write bitmaps during gc, bitmap commit selection | `GC`, `PackWriterBitmapPreparer` | GcCommitSelectionTest (8), GcSinceBitmapStatisticsTest, PackWriterBitmapPreparerTest | Full (twin) | vcs-core/src/pack/pack-bitmap-writer.ts, vcs-store-files/src/repack.ts; pack-bitmap.git | byte-identical to git under the conditions in CLAUDE.md |
| GC | Reverse index (`.rev`) writing | `GC` (`pack.writeReverseIndex`), `PackReverseIndexWriter` | GcReverseIndexTest (5), PackReverseIndexWriterV1Test | None | vcs-core/src/pack/pack-set.ts (removes `.rev` files), multi-pack-index.ts (midx RIDX chunk only) | no pack `.rev` writing; the reverse order is computed in memory |
| GC | Object size index | `PackObjectSizeIndex*` (`pack.minBytesForObjSizeIndex`) | PackObjectSizeIndexV1Test (13), GcObjectSizeIndexTest (7) | None | | JGit-specific file format; native git has none |
| GC | Keep dircache objects / reflog-reachable objects | `GC` | GcDirCacheSavesObjectsTest, GcReflogTest, GcBranchPrunedTest, GcTagTest | Full | vcs-store-files/src/reachable-objects.ts (`collectReachabilityRoots`); gc-orchestrator-roots.git | |
| GC | Concurrent gc / repack safety | `GC` locking | GcConcurrentTest, ConcurrentRepackTest | Partial | vcs-store-files/src/gc.ts | lock files used; concurrency tests not found |
| GC | `PackRefsCommand` (all) | `api/PackRefsCommand` | pgm PackRefsTest | Full (twin) | vcs-commands/src/commands/pack-refs-command.ts; packed-refs-native | |
| GC | Partial-clone-aware gc (promisor packs) | not in JGit | — | Full (twin) | vcs-store-files/src/promisor-objects.ts; partial-clone-lazy-native | webrun-only |
| RevWalk | Commit walk, date order, `markStart`/`markUninteresting` | `revwalk/RevWalk`, `DateRevQueue` | RevWalkTestCase, DateRevQueueTest, RevWalkCullTest, RevWalkCarryFlagsTest | Full (twin) | vcs-commands/src/commands/log-command.ts, revision-range.ts; log-range-fuzz-native | no public RevWalk object; the walk sits behind LogCommand/RevListCommand |
| RevWalk | Sorting: topo, topo-keep-branch-together, reverse, boundary | `RevSort` | RevWalkSortTest (18), RevWalkSortTopoWithCommitGraphTest | Partial | log-output.ts (`topoOrder`, `reverse`) | no `--boundary` output; no TOPO_KEEP_BRANCH_TOGETHER |
| RevWalk | First-parent walk | `RevWalk.setFirstParent` | FirstParentRevWalkTest (26) | Full | log-command.ts `setFirstParent` | |
| RevWalk | Merge base (all bases, criss-cross) | `RevFilter.MERGE_BASE`, `MergeBaseGenerator` | RevWalkMergeBaseTest (7), CrissCrossMergeTest | Full (twin) | vcs-commands/src/commands/merge-bases.ts; merge-virtual-base-native | |
| RevWalk | `isMergedInto`, reachability counts | `RevWalk.isMergedInto`, `RevWalkUtils.count/findBranchesReachableFrom` | RevWalkMergedIntoTest, RevWalkUtilsCountTest, RevWalkUtilsReachableTest | Full | tracking-info.ts, branch-command.ts `setContains` | |
| RevWalk | Path-limited walk with history simplification | `TreeRevFilter`, `RewriteGenerator` | RevWalkPathFilter1Test (14), RevWalkPathFilter6012Test, TreeRevFilterTest (10), RewriteGeneratorTest | Full (twin) | log-command.ts (`try_to_simplify_commit`); log-path-native | |
| RevWalk | Follow renames (`--follow`) | `revwalk/FollowFilter`, `RenameCallback` | RevWalkFollowFilterTest (3) | Full | log-output.ts `follow`, `findFollowSource` | |
| RevWalk | Author/committer/message/time filters | `AuthorRevFilter`, `CommitterRevFilter`, `MessageRevFilter`, `CommitTimeRevFilter` | RevWalkFilterTest (17) | Partial | log-command.ts `setAuthorFilter`, `setCommitterFilter`, `setSince`/`setUntil` | no message (`--grep`) filter |
| RevWalk | Composable filters (And/Or/Not, pattern, substring, RevFlag) | `AndRevFilter`, `OrRevFilter`, `NotRevFilter`, `PatternMatchRevFilter`, `SubStringRevFilter`, `RevFlagFilter` | RevWalkFilterTest, RawSubStringPatternTest | None | | no pluggable filter API |
| RevWalk | Max count / skip filters | `MaxCountRevFilter`, `SkipRevFilter` | MaxCountRevFilterTest, SkipRevFilterTest | Full | log-command.ts `setMaxCount`, `setSkip` | |
| RevWalk | Object walk (commits, trees, blobs) with object filters | `ObjectWalk`, `ObjectFilter` | ObjectWalkTest (9), ObjectWalkFilterTest (6) | Full (twin) | vcs-core/src/pack/list-objects.ts, pack/object-filter/; serve-filter-native | |
| RevWalk | Depth walk (shallow) | `DepthWalk`, `DepthGenerator` | RevWalkShallowTest (7) | Full (twin) | vcs-transport/src/fsm/fetch/upload-pack-graph.ts; serve-shallow-native | |
| RevWalk | Bitmap walk | `BitmapWalker`, `internal/revwalk/AddToBitmapFilter` | BitmapWalkerTest (4), BitmapIndexTest | Full | vcs-core/src/pack/bitmap-walk.ts | |
| RevWalk | Reachability checkers (bitmapped, pedestrian; object reachability) | `ReachabilityChecker`, `ObjectReachabilityChecker` | ReachabilityCheckerTestCase, ObjectReachabilityTestCase, UploadPackReachabilityTest | Full | vcs-transport/src/api/repository-facade.ts (`isReachableFrom`) | |
| RevWalk | Commit-graph-backed walks (generation numbers) | `RevWalk` with `CommitGraph` | RevWalkCommitGraphTest (26), AbstractRevWalkWithCommitGraphTest | Full (twin) | log-command.ts (graph positions), vcs-core/src/history/commit-graph/; commit-graph-trust-native | |
| RevWalk | Commit/tag parsing (`RevCommit`, `RevTag`, encodings, footers) | `RevCommit`, `RevTag`, `FooterLine` | RevCommitParseTest (22), RevTagParseTest (24), FooterLineTest (26) | Full (twin) | vcs-core/src/history/commits/commit-format.ts, vcs-commands/src/commands/trailers.ts; pretty-format-trailers-native | |
| RevWalk | Walk cancellation, reset, RevFlag sets, RevCommitList | `RevWalk.reset`, `RevFlagSet`, `RevCommitList` | RevWalkCancellationTest, RevWalkResetTest, RevFlagSetTest, RevCommitListTest | N/A | | Java object-model API without a webrun counterpart (webrun uses async iterables and AbortSignal-free calls) |
| RevWalk | Replace refs and grafts in walks | not in JGit | — | Full (twin) | vcs-commands/src/git-command.ts (`replacementMessages`); replace-grafts-native | webrun-only |
| RevWalk | Overridden parents | `RevCommit` (rewritten parents) | RevCommitWithOverriddenParentTest | N/A | | Java API detail |
| RevPlot | Plot lanes for GUIs (`PlotWalk`, `PlotCommitList`) | `revplot/*` | PlotCommitListTest (15), AbstractPlotRendererTest | Partial | vcs-commands/src/commands/log-graph.ts | webrun renders git's ASCII `--graph`, no lane model API |
| TreeWalk | Multi-tree walk (`TreeWalk`, recursive, post-order) | `treewalk/TreeWalk` | PostOrderTreeWalkTest, TreeWalkBasicDiffTest, ForPathTest | Full | vcs-commands/src/tree-merge/tree-merge.ts, vcs-core/src/history/trees/ | internal walkers, not a public generic TreeWalk |
| TreeWalk | Tree parsing (`CanonicalTreeParser`) | `CanonicalTreeParser` | CanonicalTreeParserTest (18) | Full (twin) | vcs-core/src/history/trees/; tree-canonical-modes-native, tree-order-native | |
| TreeWalk | Working tree iterator (stat, file modes, symlinks, ignore, EOL) | `FileTreeIterator`, `WorkingTreeIterator`, `WorkingTreeOptions` | FileTreeIteratorTest (26), InstantComparatorTest, SymlinksTest, DirectoryTest | Full | vcs-working-tree/src/worktree/, vcs-store-files/src/workspace/worktree/file-worktree.ts | |
| TreeWalk | Name conflict walk (file vs directory D/F) | `NameConflictTreeWalk` | NameConflictTreeWalkTest (10) | Full | vcs-commands/src/commands/index-adder.ts (`stageZeroClashes`), ort-merge.ts | |
| TreeWalk | Path filters (PathFilter, PathFilterGroup, PathSuffixFilter) | `treewalk/filter/*` | PathFilterGroupTest, PathFilterLogicTest (21), PathSuffixFilterTest | Full (twin) | vcs-commands/src/commands/pathspec.ts; pathspec-attr-native, status-pathspec-native | git pathspec magic (`:(glob)`, `:(attr)`, `:(exclude)`, icase) exceeds JGit's path filters |
| TreeWalk | Index diff filters (IndexDiffFilter, InterIndexDiffFilter, SkipWorkTreeFilter, NotIgnoredFilter) | `treewalk/filter/*` | IndexDiffFilterTest (38), InterIndexDiffFilterTest | Full | vcs-working-tree/src/status/index-diff-calculator.ts | |
| TreeWalk | Changed-path Bloom filter tree filter | `ChangedPathTreeFilter` | ChangedPathTreeFilterTest (8) | Full (twin) | log-command.ts `setUseBloomFilters`, vcs-core/src/history/commit-graph/bloom-filter.ts; log-path-native | |
| DirCache | Read/write index v2/v3/v4 | `dircache/DirCache` | DirCacheBasicTest, DirCacheCGitCompatabilityTest (8), DirCacheLargePathTest | Full (twin) | vcs-working-tree/src/staging/index-format.ts, index-file.ts; index-format.git, index-version-native | |
| DirCache | Cache-tree (`TREE` extension) | `DirCacheTree` | DirCacheTreeTest (6) | Full | vcs-working-tree/src/staging/cache-tree.ts | |
| DirCache | Builder/editor APIs, path edits | `DirCacheBuilder`, `DirCacheEditor` | DirCacheBuilderTest, DirCachePathEditTest, DirCacheBuilderIteratorTest | Full | vcs-working-tree/src/staging/staging-edits.ts | |
| DirCache | Entry flags (assume-valid, skip-worktree, intent-to-add, stages) | `DirCacheEntry` | DirCacheEntryTest (16) | Full (twin) | vcs-working-tree/src/staging/; index-flags-native | |
| DirCache | Split index, sparse index, untracked cache, resolve-undo, other extensions | not in JGit (only `TREE`; other extensions skipped or refused) | — | Full (twin) | vcs-working-tree/src/staging/split-index.ts, sparse-index.ts, index-extensions.ts; split-index-native, sparse-index-native, resolve-undo-native | webrun-only |
| DirCache | Racy-git detection and smudging | `DirCache`, `FileSnapshot` | RacyGitTests, IndexModificationTimesTest, FileSnapshotTest (9) | Full | vcs-working-tree/src/staging/stat-refresh.ts; staging-racy-smudge.test | |
| DirCache | Index lock and `IndexChangedEvent` | `DirCache.lock`, events | DirCacheBasicTest | Full | vcs-commands/src/commands/post-index-change.ts, staging lockIndex | |
| Sparse | Sparse checkout (`core.sparseCheckout`, cone mode, `sparse-checkout` command) | not in JGit (skip-worktree flag only) | — | Full (twin) | vcs-commands/src/commands/sparse-checkout-command.ts; sparse-checkout-native | webrun-only |
| Diff engine | Myers diff | `diff/MyersDiff` | MyersDiffTest (via AbstractDiffTestCase, 23) | Full (twin) | vcs-utils/src/diff/text-diff/xdiff.ts; unified-diff-fuzz-native | webrun ports xdiff (with `minimal`) |
| Diff engine | Histogram diff (JGit's default) | `diff/HistogramDiff` | HistogramDiffTest (7) | Full (twin) | vcs-utils/src/diff/text-diff/xdiff-histogram.ts; unified-diff-fuzz-native | JGit's histogram differs from git's xdiff histogram in output details |
| Diff engine | Patience diff | not in JGit | — | Full (twin) | vcs-utils/src/diff/text-diff/xdiff-patience.ts | webrun-only |
| Diff engine | Whitespace comparators (ignore all, leading, trailing, change) | `RawTextComparator.WS_*` | RawTextIgnoreAllWhitespaceTest, RawTextIgnoreLeadingWhitespaceTest, RawTextIgnoreTrailingWhitespaceTest, RawTextIgnoreWhitespaceChangeTest | Partial | vcs-utils/src/diff/text-diff/xdiff.ts (`-w`, `-b`, `--ignore-space-at-eol`) | no "leading whitespace only" mode (git has none either) |
| Diff engine | Binary detection, RawText loading | `RawText.isBinary`, `RawText` | RawTextTest (18), RawTextLoadTest | Full | vcs-commands/src/commands/diff-command.ts, vcs-working-tree/src/convert/text-stats.ts | |
| Diff engine | Edit lists, `DiffFormatter` (unified patch, context) | `DiffFormatter`, `EditList`, `Edit` | DiffFormatterTest (21), EditListTest, EditTest (16) | Full (twin) | vcs-utils/src/diff/text-diff/xemit.ts, vcs-commands/src/commands/diff-command.ts; diff-output-native | |
| Diff engine | Built-in function-context drivers (`diff=java`, `cpp`, ...) | `diff/DiffDriver`, `DiffConfig` | DiffFormatterBuiltInDriverTest (5) | Full (twin) | vcs-utils/src/diff/text-diff/userdiff.ts, regex/posix-regex.ts; unified-diff-fuzz-native | webrun also custom `xfuncname` and textconv; JGit has no textconv |
| Diff engine | Diff reflow / binary patch output | `DiffFormatter` | DiffFormatterReflowTest (10) | Full | vcs-commands/src/commands/diff-command.ts (`gitBinaryPatch`) | |
| Diff engine | Rename detection (exact + similarity, rename limit, breaking) | `RenameDetector`, `SimilarityIndex`, `SimilarityRenameDetector` | RenameDetectorTest (33), SimilarityIndexTest (8), DiffEntryTest (13) | Full (twin) | vcs-commands/src/rename/; git-similarity-native | |
| Diff engine | Filtered rename detection by path | `internal/diff/FilteredRenameDetector` | FilteredRenameDetectorTest (6) | Full | vcs-commands/src/rename/detect-renames.ts | |
| Diff engine | Patch id | `PatchIdDiffFormatter` | PatchIdDiffFormatterTest (2) | Full (twin) | vcs-commands/src/commands/patch-id.ts; rebase-patch-id-native | |
| Diff engine | Copy detection (`-C`) | `RenameDetector` (copies) | RenameDetectorTest | ? | vcs-commands/src/rename/ | copy entries (`createCopyEntry`) exist; full `-C`/`--find-copies-harder` not verified |
| Merge engine | Three-way content merge (`MergeAlgorithm`, `MergeFormatter`) | `merge/MergeAlgorithm`, `MergeFormatter`, `MergeChunk` | MergeAlgorithmTest (22) | Full (twin) | vcs-utils/src/diff/text-diff/line-merge.ts; line-merge-fuzz-native | |
| Merge engine | Union merge (`merge=union`) and binary (`merge=binary`) attributes | `MergeAlgorithm` union, `MergeAttributes` | MergeAlgorithmUnionTest (24), MergeGitAttributeTest (8) | Full (twin) | vcs-commands/src/commands/merge-drivers.ts; merge-attributes-native | webrun also custom `merge.<driver>.driver` commands |
| Merge engine | `ResolveMerger` (tree merge, dirty checks, failing paths) | `merge/ResolveMerger` | SimpleMergeTest (16), MergerTest | Full (twin) | vcs-commands/src/commands/ort-merge.ts; merge-dirty-fuzz-native, merge-dataloss-native | |
| Merge engine | `RecursiveMerger` (virtual merge base) | `merge/RecursiveMerger` | CrissCrossMergeTest, MergerTest | Full (twin) | vcs-commands/src/commands/ort-recursive.ts; merge-virtual-base-native | |
| Merge engine | Rename detection in merges, directory renames | not in JGit (merges do not detect renames) | — | Full (twin) | ort-merge.ts; merge-ort-rename-fuzz-native, merge-dir-renames-native | webrun-only; a notable JGit gap against native git |
| Merge engine | Symlink and gitlink merges | `ResolveMerger` | SymlinkMergeTest (5), GitlinkMergeTest (19) | Full | ort-merge.ts | |
| Merge engine | In-core merge (no working tree) | `ThreeWayMerger` in-core, `StrategySimpleTwoWayInCore` | MergerTest | Full | vcs-commands/src/commands/ort-merge.ts (`mergeTreesThreeWay`, `mergeStoredTrees`) | |
| Merge engine | EOL-aware merge output, `merge.renormalize` | `EolAwareOutputStream`, `MergeConfig` | MergerTest | Full | merge-command.ts `setRenormalize` | |
| Merge engine | External diff/merge tools (`difftool`, `mergetool`) | `internal/diffmergetool/*`, pgm `DiffTool`, `MergeTool` | ExternalDiffToolTest (18), ExternalMergeToolTest (17), pgm DiffToolTest, MergeToolTest | None | | |
| Merge engine | rerere | not in JGit | — | Partial | vcs-store-files/src/workspace/transformation/resolution-store.impl.ts | an `rr-cache` store exists; not wired into merge commands (am notes rerere is not run) |
| Attributes | `.gitattributes` parsing and matching (macros, `info/attributes`, global) | `attributes/AttributesNode`, `AttributesHandler`, `AttributesRule` | AttributesHandlerTest (30), AttributesMatcherTest, AttributesNodeTest, CGitAttributesTest (26), TreeWalkAttributeTest (18) | Full (twin) | vcs-working-tree/src/attributes/; attributes-fuzz-native, attr-source-native | |
| Attributes | EOL conversion (`core.autocrlf`, `core.eol`, `text`, `eol`, `crlf`) | `util/io/AutoCRLF*Stream`, `EolStreamTypeUtil` | EolRepositoryTest (28), EolStreamTypeUtilTest, CrLfNativeTest, AutoCRLFInputStreamTest, AutoLFInputStreamTest | Full (twin) | vcs-working-tree/src/convert/eol.ts; attributes-eol-native | webrun also `core.safecrlf` |
| Attributes | Clean/smudge filters (external commands, built-in registry) | `FilterCommandRegistry`, `FilterCommandFactory` | FilterCommandsTest (8) | Full (twin) | vcs-working-tree/src/convert/filter-driver.ts, git-content-filter.ts; lfs-filter-native | |
| Attributes | Long-running process filters, `ident`, `working-tree-encoding` | not in JGit | — | Full | vcs-working-tree/src/convert/git-content-filter.ts, ident.ts, encoding.ts | webrun-only |
| Ignore | `.gitignore` rules, negation, `info/exclude`, `core.excludesFile` | `ignore/IgnoreNode`, `FastIgnoreRule` | IgnoreNodeTest (36), FastIgnoreRuleTest (19), CGitIgnoreTest (39), IgnoreRuleSpecialCasesTest (169), IgnoreMatcherParametrizedTest, BasicRuleTest | Full (twin) | vcs-working-tree/src/ignore/; ignore-fuzz-native, non-utf8-patterns-native | |
| Ignore | Wildmatch / fnmatch | `fnmatch/FileNameMatcher`, `ignore/internal/*Matcher` | FileNameMatcherTest (155), StringsTest | Full | vcs-working-tree/src/ignore/git-wildmatch.ts | |
| Hooks | Client hooks: pre-commit, commit-msg, post-commit, pre-push | `hooks/Hooks`, `PreCommitHook`, `CommitMsgHook`, `PostCommitHook`, `PrePushHook` | HookTest (14), RunExternalScriptTest | Full (twin) | vcs-commands/src/commands/git-hooks.ts, vcs-utils-node/src/files/node-hook-runner.ts; hooks-commit-native, hooks-push-native | webrun also prepare-commit-msg, post-checkout, post-merge, post-rewrite, pre-rebase, reference-transaction, post-index-change, pre-auto-gc, am hooks, configured hooks (`hook.*`), `git hook run/list` |
| Hooks | `core.hooksPath` | `FS.findHook` | HookTest | Full (twin) | git-hooks.ts; hooks-config-native | |
| Hooks | Server-side hooks as Java callbacks (PreReceiveHook, PostReceiveHook, PreUploadHook, PostUploadHook, ProtocolV2Hook, chains) | `transport/*Hook`, `*HookChain` | PreUploadHookChainTest, PostUploadHookChainTest, ProtocolV2HookChainTest | Full | vcs-transport/src/fsm/push/receive-pack-types.ts (`ReceivePackHooks`), fsm/fetch/upload-pack-hooks.ts | webrun also runs git's script hooks on the receive side (pre-receive, update, post-receive, post-update, proc-receive, push-to-checkout) |
| Hooks | `proc-receive`, `report-status-v2` | not in JGit | — | Full (twin) | vcs-transport/src/fsm/push/proc-receive.ts; proc-receive-native | webrun-only |
| Config | Config parsing/writing (sections, subsections, multivalues, escapes) | `lib/Config`, `StoredConfig`, `FileBasedConfig` | ConfigTest (99), FileBasedConfigTest (11) | Full (twin) | vcs-store-files/src/workspace/working-copy/working-copy-config.files.ts; config-parse-native | |
| Config | Includes (`include.path`) | `Config` include handling | ConfigTest | Full (twin) | working-copy-config.files.ts; config-chain-native | |
| Config | Conditional includes (`includeIf`) | not in JGit | — | Full (twin) | working-copy-config.files.ts; config-chain-native | webrun-only |
| Config | System/user/XDG config chain | `SystemReader`, `UserConfigFile` | UserConfigFileTest (12), SystemReaderTest | Full (twin) | vcs-utils-node/src/files/git-host-environment.ts; config-chain-native | |
| Config | Command-line config (`-c`, `GIT_CONFIG_COUNT`) | not in JGit | — | Full (twin) | working-copy-config.files.ts; command-line-config-native | webrun-only |
| Config | Typed getters (enums, booleans, time units, sizes) | `TypedConfigGetter`, `DefaultTypedConfigGetter` | ConfigTest | Full | vcs-utils/src/encoding (`parseGitBool`), vcs-commands/src/commands/core-config.ts | |
| Config | Blob-based config (`.gitmodules` from a blob) | `BlobBasedConfig` | SubmoduleWalkTest | Full | vcs-commands/src/commands/submodule-config.ts | |
| Config | Abbreviation config (`core.abbrev`) | `AbbrevConfig` | AbbrevConfigTest (16), AbbreviationTest | Full (twin) | vcs-commands/src/commands (createIdAbbreviator); abbrev-native | |
| Config | GPG config (`gpg.format`, `user.signingKey`, `commit.gpgSign`) | `GpgConfig` | GpgConfigTest (10) | None | | |
| Refs | Loose refs, packed-refs (peeled, sorted traits) | `RefDirectory`, `PackedRefsWriter`, `PackedRefsTrait` | RefDirectoryTest (72), RefTest (21), SnapshottingRefDirectoryTest | Full (twin) | vcs-store-files/src/refs/, vcs-core/src/history/refs/; packed-refs-native, packed-refs-lock-git | |
| Refs | `RefUpdate` (expected old value, force, delete, symbolic) | `RefUpdate`, `RefRename`, `SymbolicRef` | RefUpdateTest (52), SymbolicRefTest | Full | vcs-core/src/history/refs/refs.impl.ts | |
| Refs | Atomic batch ref updates | `BatchRefUpdate`, `PackedBatchRefUpdate` | BatchRefUpdateTest (43) | Full (twin) | vcs-core/src/history/refs/ref-batch.ts (`planRefBatch`); hooks-ref-transaction-native | webrun runs the reference-transaction hook as git does |
| Refs | Ref name validation | `Repository.isValidRefName` | ValidRefNameTest (22), RefDatabaseConflictingNamesTest | Full | vcs-core/src/history/refs/ref-name.ts | |
| Refs | Revision expressions (`HEAD~2`, `^{tree}`, `@{u}`, `:/msg`, abbreviated ids) | `Repository.resolve` | RepositoryResolveTest (22), ReflogResolveTest, AbbreviatedObjectIdTest | Full (twin) | vcs-commands/src/commands/revision-resolver.ts, rev-parse-command.ts; revision-syntax-native, revision-args-native | |
| Refs | Reftable ref storage (read, write, compaction, merged stack, reflogs) | `internal/storage/reftable/*`, `FileReftableDatabase`, `FileReftableStack` | ReftableTest (45), MergedReftableTest (25), ReftableCompactorTest (9), FileReftableTest (37), FileReftableStackTest | None | vcs-store-files/src/repository-format.ts (refuses `extensions.refStorage=reftable`) | |
| Refs | Convert ref storage (files to reftable and back) | `FileRepository.convertRefStorage`, pgm `ConvertRefStorage` | ReftableConversionTest (8), ReftableCreationTest (13) | None | | |
| Refs | Ref listing with prefixes, peeled tags | `RefDatabase.getRefsByPrefix`, `peel` | RefDirectoryTest, ObjectIdRefTest | Full | vcs-store-files/src/refs/ (`getRefsByPrefix`, `peelTag`) | |
| Objects | Loose objects read/write (zlib, headers) | `LooseObjects`, `UnpackedObject`, `ObjectDirectoryInserter` | UnpackedObjectTest (15), ObjectDirectoryTest (10), T0003_BasicTest (25) | Full (twin) | vcs-core/src/storage/, vcs-store-files/src/storage/ | |
| Objects | Object id model (ObjectId, abbreviated ids, maps) | `ObjectId`, `AbbreviatedObjectId`, `ObjectIdOwnerMap`, `ObjectIdSubclassMap` | ObjectIdTest (17), AbbreviatedObjectIdTest (26), ObjectIdOwnerMapTest, ObjectIdSubclassMapTest, ObjectIdSerializerTest | Full | vcs-core/src/common/id/ | ids are hex strings in webrun; the Java maps have no direct counterpart |
| Objects | Object checker (fsck rules for commits, trees, tags, blobs) | `lib/ObjectChecker`, `BlobObjectChecker` | ObjectCheckerTest (136) | Full (twin) | vcs-commands/src/commands/fsck/fsck-object-checks.ts, fsck-msg-ids.ts; fsck-native | |
| Objects | Commit/tag builders, tree formatter | `CommitBuilder`, `TagBuilder`, `TreeFormatter` | CommitBuilderTest (11), TagBuilderTest (7) | Full | vcs-core/src/history/commits/, tags/, trees/ | |
| Objects | Person identity parsing/formatting | `PersonIdent`, `RawParseUtils.parsePersonIdent` | PersonIdentTest (11), RawParseUtils_ParsePersonIdentTest | Full (twin) | vcs-core/src/common/person/, vcs-commands/src/commands/git-ident.ts; ident-native | |
| Objects | Large object streaming (`ObjectLoader.openStream`, big file threshold) | `ObjectLoader`, `LargePackedWholeObject` | ObjectLoaderTest, HugeFileTest, HugeCommitMessageTest | Full | vcs-core (streaming blob reads), vcs-utils/src/compression/ | |
| Objects | Alternates (`objects/info/alternates`) | `ObjectDirectory` alternates | AlternatesTest (6) | Full (twin) | vcs-store-files/src/alternates/; alternates-native | |
| Objects | Object inserter / pack inserter | `ObjectInserter`, `PackInserter` | PackInserterTest (14) | Full | vcs-core/src/history/objects/git-objects.impl.ts | |
| Packs | Pack file reading (deltas, ofs/ref delta, delta base cache, windows) | `Pack`, `PackFile`, `WindowCache`, `DeltaBaseCache` | PackTest (7), PackFileTest (10), T0004_PackReaderTest, WindowCacheGetTest, DeltaBaseCacheTest | Full (twin) | vcs-core/src/pack/pack-file.ts, pack-set.ts; pack-set.git | |
| Packs | Pack index v1/v2 read/write | `PackIndexV1`, `PackIndexV2`, `PackIndexWriterV1/V2` | PackIndexV1Test, PackIndexV2Test, PackIndexTestCase (12) | Full | vcs-core/src/pack/pack-index-reader.ts, pack-index-writer.ts | |
| Packs | Reverse index (`.rev`, computed) | `PackReverseIndex*` | PackReverseIndexTest, PackReverseIndexV1Test (17), PackReverseIndexComputedTest | Partial | vcs-core/src/pack/pack-file.ts (`packOrder`), pack-set.ts | pack order is computed from the idx (`packOrder`); `.rev` files are only removed with their pack, not read or written |
| Packs | Pack writing with delta search (window, depth, reuse, threads) | `PackWriter`, `DeltaWindow`, `DeltaEncoder`, `DeltaIndex` | BasePackWriterTest (40), DeltaIndexTest (13) | Full (twin) | vcs-core/src/pack/write-pack.ts, vcs-core/src/storage/delta/; write-pack.git | |
| Packs | Pack parsing / index-pack (thin packs, fsck on receive, keep) | `PackParser`, `ObjectDirectoryPackParser` | PackParserTest (16), ObjectDirectoryPackParserTest, DfsPackParserTest | Full (twin) | vcs-core/src/pack/index-pack.ts, import-pack.ts; index-pack.git, import-pack.git | |
| Packs | Pack bitmaps (EWAH, read/write, name-hash) | `PackBitmapIndex*`, `BitmapIndexImpl`, `PackBitmapIndexBuilder` | PackBitmapIndexBuilderTest (13), BasePackBitmapIndexTest, StoredBitmapTest, InflatingBitSetTest | Full (twin) | vcs-core/src/pack/pack-bitmap.ts, pack-bitmap-writer.ts, vcs-utils/src/ewah/; pack-bitmap.git | |
| Packs | Multi-pack-index read/write, midx bitmaps | `internal/storage/midx/*`, `MidxWriter`, `PackMidx` | MultiPackIndexTest (19), MultiPackIndexWriterTest, MultiPackIndexLoaderTest, PackIndexMergerTest (17), MidxIteratorsTest (23), PackMidxTest (14), MidxWriterTest | Full (twin) | vcs-core/src/pack/multi-pack-index.ts, vcs-store-files/src/multi-pack-index.ts; multi-pack-index.git | |
| Packs | Verify pack | (JGit `PackFile` checks) | — | Full | vcs-commands/src/commands/fsck/verify-pack-command.ts | |
| Packs | Lock files, file snapshots | `LockFile`, `FileSnapshot`, `PackFileSnapshot` | LockFileTest (12), FileSnapshotTest, PackFileSnapshotTest | Full | vcs-utils/src/files/atomic-files.ts | |
| Commit-graph | Commit-graph read/write (generation numbers, chains) | `internal/storage/commitgraph/*`, `FileCommitGraph` | CommitGraphTest (11), CommitGraphWriterTest (11), CommitGraphLoaderTest, GraphCommitsTest, CommitGraphBuilderTest | Full (twin) | vcs-core/src/history/commit-graph/, vcs-store-files/src/commit-graph.ts; commit-graph.git, commit-graph-trust-native | JGit reads and writes a single `objects/info/commit-graph` (no split chains; `core.commitGraph` defaults to false in JGit); webrun reads chains, across alternates too |
| Commit-graph | Changed-path Bloom filters | `ChangedPathFilter`, `GraphChangedPathFilterData` | CommitGraphWriterTest, ChangedPathTreeFilterTest | Full (twin) | vcs-core/src/history/commit-graph/bloom-filter.ts; log-path-native | |
| Fsck | Repository fsck | `DfsFsck`, `internal/fsck/FsckPackParser` | DfsFsckTest (11) | Full (twin) | vcs-commands/src/commands/fsck/; fsck-native, fsck-work-native | JGit has fsck only for DFS repositories; webrun is git's fsck for files repositories |
| DFS | Distributed object storage abstraction (`DfsRepository`, `DfsObjDatabase`, `DfsRefDatabase`) | `internal/storage/dfs/*` | DfsObjDatabaseTest (18), DfsReaderTest (14), DfsInserterTest (11), DfsPackFileTest (21) | Partial | vcs-store-kv/, vcs-store-sql/, vcs-core/src/backend/ | different design: webrun stores objects in KV/SQL rows (with deltas) rather than DFS pack files; same goal (non-filesystem storage) |
| DFS | In-memory repository | `InMemoryRepository` | InMemoryRepositoryTest (5), junit TestRepositoryTest | Full | vcs-store-mem/ | |
| DFS | DFS block cache (clock, per-extension tables, stats) | `DfsBlockCache`, `ClockBlockCacheTable`, `PackExtBlockCacheTable` | DfsBlockCacheTest (11), DfsBlockCacheConfigTest (17), ClockBlockCacheTableTest, PackExtBlockCacheTableTest (26), AggregatedBlockCacheStatsTest | N/A | | JGit server tuning for its DFS pack design |
| DFS | DFS gc, pack compactor, pack descriptions | `DfsGarbageCollector`, `DfsPackCompactor`, `DfsPackDescription` | DfsGarbageCollectorTest (45), DfsPackCompacterTest (7), DfsPackDescriptionTest (12) | Partial | vcs-core/src/gc/gc-orchestrator.ts, vcs-store-sql/src/gc-strategy.ts | webrun gc runs over its own stores via `GcStrategy` |
| DFS | DFS midx (single, N packs) | `DfsPackFileMidx*`, `DfsMidxWriter`, `MidxPackFilter` | DfsPackFileMidxSingleTest (46), DfsPackFileMidxNPacksTest (45), DfsBlockMidxTest, MidxPackFilterTest (18), MidxPackListTest (26), MidxDescListTest | N/A | | DFS-specific |
| DFS | DFS bundle writer, reftable stack | `DfsBundleWriter`, `DfsReftableDatabase` | DfsBundleWriterTest (2) | None | | |
| Storage misc | Ternary search tree, UInt24 arrays, IntSet | `internal/storage/memory/TernarySearchTree`, `UInt24Array`, `IntSet` | TernarySearchTreeTest (28), UInt24ArrayTest, IntSetTest | N/A | | JGit-internal data structures |
| Transport client | Smart HTTP(S) client (v0/v2, chunked, gzip) | `TransportHttp`, `HttpConnection`, `JDKHttpConnection`, Apache `HttpClientConnection` | TransportHttpTest (10), SmartClientSmartServerTest (43), HttpClientTests (21), JDKHttpConnectionTest | Full (twin) | vcs-transport/src/adapters/http/http-duplex.ts; http-real-git, fetch-v2-real-git | over `fetch`; no choice of HTTP stack needed |
| Transport client | HTTP auth (Basic, Digest, Negotiate/SPNEGO) | `HttpAuthMethod` | HttpAuthTest | Partial | vcs-transport/src/operations/http-auth.ts | Basic (and tokens as Basic) only |
| Transport client | HTTP config (`http.<url>.*`, sslVerify, extra headers, followRedirects, user agent, proxy) | `HttpConfig`, `TransportHttp.setAdditionalHeaders`, `UserAgent` | HttpConfigTest (17), HttpConfigUriPathTest (8), SetAdditionalHeadersTest, pgm ProxyConfigTest (10) | Partial | vcs-commands/src/transport-command.ts (headers), vcs-transport/src/api/options.ts | extra headers and timeouts yes; TLS verification, proxies and redirects are the host `fetch`'s; no `http.<url>.*` matching found |
| Transport client | Cookies (`http.cookieFile`, Netscape format) | `NetscapeCookieFile` | NetscapeCookieFileTest (10) | None | | |
| Transport client | `.netrc` credentials | `NetRC`, `NetRCCredentialsProvider` | NetRCTest (2) | None | | |
| Transport client | Credentials providers (chain, username/password, prompts) | `CredentialsProvider`, `ChainingCredentialsProvider`, `UsernamePasswordCredentialsProvider` | TransportTest | Partial | vcs-transport/src/api/credentials.ts | a credentials object/callback; neither JGit nor webrun runs `git credential` helpers |
| Transport client | Dumb HTTP client (walk fetch/push) | `WalkFetchConnection`, `WalkPushConnection`, `WalkRemoteObjectDatabase` | DumbClientDumbServerTest (4), DumbClientSmartServerTest (4) | None | (server side only: vcs-transport/src/operations/served-git-files.ts) | |
| Transport client | SSH transport (Apache MINA sshd: keys, agent, known_hosts, ssh config, proxies, GSSAPI) | `SshTransport`, `TransportGitSsh`, `org.eclipse.jgit.ssh.apache`, `OpenSshConfigFile` | ApacheSshTest (27), OpenSshConfigFileTest (47), OpenSshServerKeyDatabaseTest (22), KnownHostEntryReaderTest, Socks5ProxyConnectorTest, HttpParserTest | Partial | vcs-transport/src/connect/native-connectors.ts | protocol over an ssh command channel the host supplies (`exec`); no built-in ssh client, key or known_hosts handling |
| Transport client | `git://` (daemon) client | `TransportGitAnon` | DaemonTest | Full (twin) | native-connectors.ts `createGitDaemonConnector`; git-native-protocol | needs a host socket (`openSocket`) |
| Transport client | Local transport (file:// and paths, fork of upload/receive-pack) | `TransportLocal` | TransportTest | Full (twin) | vcs-commands/src/commands/local-transport.ts; fetch-local-native, push-local-receive-native | in-process |
| Transport client | Bundle transport (fetch from bundle) and `BundleWriter` | `TransportBundle*`, `BundleWriter` | BundleWriterTest (8) | None | | no `git bundle` support |
| Transport client | Amazon S3 transport (`amazon-s3://`, encryption) | `TransportAmazonS3`, `AmazonS3`, `WalkEncryption`, `AwsRequestSignerV4` | WalkEncryptionTest (8) | None | | JGit-specific; native git has no S3 transport |
| Transport client | SFTP transport | `TransportSftp` | — | None | | |
| Transport client | In-process / test protocol | `TestProtocol`, `InternalFetchConnection` | TestProtocolTest (14) | Full | vcs-transport/src/adapters/messageport/, operations/fetch-over-duplex.ts | webrun also WebSocket, MessagePort, libp2p, httpeers mesh adapters |
| Transport client | Push process (status reporting, tracking ref updates) | `PushProcess`, `RemoteRefUpdate`, `TrackingRefUpdate` | PushProcessTest (17), PushConnectionTest (5), BasePackPushConnectionTest | Full (twin) | vcs-transport/src/push-client/; push-client-real-git, transport-summary-abbrev-native | |
| Transport client | Fetch negotiation (have/ack, multi_ack_detailed, no-done) | `BasePackFetchConnection` | BasePackConnectionTest (8) | Full (twin) | vcs-transport/src/fetch-client/negotiator.ts; upload-pack-negotiation-real-git | |
| Transport client | Timeouts | `TransportCommand.setTimeout`, `TimeoutInputStream` | TimeoutInputStreamTest, TimeoutOutputStreamTest, InterruptTimerTest | Full | vcs-transport/src/fetch-client/idle-timer.ts, utils/idle-timeout.ts | |
| Transport client | Progress monitors | `ProgressMonitor`, `TextProgressMonitor`, `SideBandProgressMonitor` | TextProgressMonitorTest, ThreadSafeProgressMonitorTest | Partial | vcs-commands/src/transport-command.ts (`ProgressCallback`) | transport progress messages only; no general monitor for local commands |
| Protocol | pkt-line reading/writing | `PacketLineIn`, `PacketLineOut` | PacketLineInTest (30), PacketLineOutTest (9) | Full | vcs-transport/src/protocol/pkt-line-codec.ts | |
| Protocol | Side-band / side-band-64k | `SideBandInputStream`, `SideBandOutputStream` | SideBandInputStreamTest (21), SideBandOutputStreamTest (11) | Full | vcs-transport/src/protocol/sideband.ts | |
| Protocol | Protocol v0 request parsing (wants, haves, shallow, deepen, filter, capabilities) | `ProtocolV0Parser`, `FetchV0Request`, `FirstWant`, `FirstCommand` | ProtocolV0ParserTest (9), FirstWantTest (7), FirstCommandTest | Full (twin) | vcs-transport/src/protocol/git-request-parser.ts, fsm/fetch/server-fetch-fsm.ts; server-parity-real-git | |
| Protocol | Protocol v2 (ls-refs, fetch, server options, ref-in-want, sideband-all, wait-for-done) | `ProtocolV2Parser`, `FetchV2Request`, `LsRefsV2Request`, `CapabilitiesV2Request` | ProtocolV2ParserTest (22), UploadPackLsRefsFileRepositoryTest | Full (twin) | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts, fetch-client/fetch-pack.ts; fetch-v2-real-git | |
| Protocol | v2 `object-info` | `ObjectInfoRequest` | UploadPackTest | Full | server-v2-fsm.ts, api/repository-facade.ts | |
| Protocol | v2 `packfile-uris` (CDN offload via cached packs) | `CachedPackUriProvider` | UploadPackTest | None | vcs-transport/src/fetch-client/fetch-pack.ts (refuses unexpected sections) | |
| Protocol | Push certificates (signed push: parse, store, nonce) | `PushCertificate`, `PushCertificateParser`, `PushCertificateStore`, `HMACSHA1NonceGenerator`, `SignedPushConfig` | PushCertificateParserTest (12), PushCertificateStoreTest (16), PushCertificateIdentTest (8), HMACSHA1NonceGeneratorTest (7) | None | vcs-transport/src/protocol/constants.ts (constant only) | |
| Protocol | Transfer config (`transfer.fsckObjects`, `hideRefs`, `uploadpack.allow*`) | `TransferConfig` | TransferConfigTest (8) | Full (twin) | vcs-transport/src/operations/server-config.ts, protocol/hidden-refs.ts; fetch-connectivity-native | |
| Server | `UploadPack` (serve fetch/clone, v0 and v2) | `transport/UploadPack` | UploadPackTest (103), UploadPackHandleDeletedPackFileTest, UploadPackRefSortingForReachabilityTest | Full (twin) | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts, vcs-commands/src/commands/serve-repository.ts; serve-real-git, server-parity-real-git | |
| Server | Upload request policies (ADVERTISED, REACHABLE_COMMIT, TIP, REACHABLE_COMMIT_TIP, ANY) | `UploadPack.RequestPolicy`, `RequestValidator`s | RequestValidatorTestCase (12), UploadPackReachabilityTest (9) | Full | vcs-transport/src/context/process-config.ts (`UploadPackRequestPolicy`), operations/serve-over-duplex.ts | |
| Server | Advertise refs hooks / ref filters | `AdvertiseRefsHook`, `RefFilter`, `RefAdvertiser` | ReceivePackAdvertiseRefsHookTest (9), RefAdvertiserTest | Full (twin) | vcs-transport/src/protocol/hidden-refs.ts; http-served-native | |
| Server | Partial clone filters served (`uploadpack.allowFilter`, blob:none, blob:limit, tree:depth, sparse:oid) | `FilterSpec`, `UploadPack` | UploadPackTest | Full (twin) | vcs-transport/src/fsm/fetch/upload-pack-filter.ts, vcs-core/src/pack/object-filter/; serve-filter-native | webrun also `combine:` |
| Server | Shallow serving (deepen, deepen-since, deepen-not) | `UploadPack`, `DepthWalk` | UploadPackTest | Full (twin) | upload-pack-graph.ts; serve-shallow-native | |
| Server | `ReceivePack` (push: atomic, delete, non-ff checks, quarantine, report-status) | `transport/ReceivePack` | ReceivePackTest (6), AtomicPushTest, PushConnectionTest | Full (twin) | vcs-transport/src/fsm/push/server-push-fsm.ts; receive-pack-real-git, receive-pack-quarantine-real-git | |
| Server | Receive policies (`allowNonFastForwards`, `allowDeletes`, `checkReferencedObjectsAreReachable`, max object size, `receive.denyCurrentBranch`) | `ReceivePack` setters | ReceivePackTest, PushConnectionTest | Partial | vcs-transport/src/fsm/push/receive-pack-types.ts (`denyDeleteCurrent`, `checkedOutBranches`, `updateWorktree`), operations/server-config.ts | denyCurrentBranch/updateInstead/hooks yes; no `receive.maxInputSize`-style object size limit found |
| Server | Receive command error handlers, unpack error handler | `ReceiveCommandErrorHandler`, `UnpackErrorHandler` | ReceivePackTest | Partial | receive-pack-types.ts (`logger`, `authorizeFailure`) | |
| Server | git daemon server (`Daemon`, services) | `transport/Daemon`, `DaemonService` | DaemonTest (2) | Full (twin) | vcs-transport/src/protocol/git-daemon-request.ts, operations/serve-git-connection.ts; git-native-protocol | request parsing and serving; the listening socket is the host's |
| Server | Smart HTTP server (`GitServlet`, upload-pack/receive-pack servlets, info/refs) | `org.eclipse.jgit.http.server.*` | SmartClientSmartServerTest (43), GitServletInitTest, GitServletResponseTests, AdvertiseErrorTest, ProtocolErrorTest, HookMessageTest | Full (twin) | vcs-transport/src/adapters/http/served-http-handler.ts; http-served-native | a `(Request) => Response` handler instead of a servlet |
| Server | Dumb HTTP server (objects, info/packs, alternates) | `InfoPacksServlet`, `ObjectFileServlet`, `TextFileServlet`, `IsLocalFilter`, `AsIsFileFilter` | DumbClientDumbServerTest, AsIsServiceTest | Full (twin) | vcs-transport/src/operations/served-git-files.ts; http-dumb-native | |
| Server | Repository resolvers and service factories | `RepositoryResolver`, `FileResolver`, `UploadPackFactory`, `ReceivePackFactory` | FileResolverTest, DefaultUploadPackFactoryTest, DefaultReceivePackFactoryTest | Full | vcs-transport/src/operations/base-path-resolver.ts, vcs-commands/src/commands/serve-repository.ts | |
| Server | Regex pipelines / servlet filters | `glue/*` (`RegexPipeline`, `MetaFilter`) | RegexPipelineTest | N/A | | Java servlet plumbing |
| Server | Upload-archive service | (not in JGit http.server) | — | None | | both refuse |
| LFS | Pointer files (parse/format, extensions) | `lfs/LfsPointer`, `lfs/lib/*` | LFSPointerTest (26), LfsPointerFilterTest, LongObjectIdTest (32), AbbreviatedLongObjectIdTest (36) | Full (twin) | vcs-transport-lfs/src/pointer.ts; pointer-conformance.test | |
| LFS | Clean/smudge filter (built-in LFS) | `CleanFilter`, `SmudgeFilter`, `BuiltinLFS`, `LfsBlobFilter` | LfsGitTest, lfs CheckoutTest | Full (twin) | vcs-transport-lfs/src/filter-driver.ts; lfs-filter-native, native-git-lfs | |
| LFS | Batch API client, pre-push upload hook | `LfsPrePushHook`, `internal/LfsConnectionFactory` | LfsConnectionFactoryTest (13), lfs PushTest | Full (twin) | vcs-transport-lfs/src/batch.ts, client.ts; native-git-lfs | |
| LFS | LFS config (`lfs.url`, `.lfsconfig`) | `lfs/internal/LfsConfig` | LfsConfigGitTest (3) | ? | | not verified in webrun |
| LFS | LFS server: batch protocol servlet, filesystem store | `LfsProtocolServlet`, `lfs/server/fs/*` | lfs/server/fs DownloadTest, UploadTest, LfsServerTest | Full | vcs-transport-lfs/src/server.ts, files-store.ts; server-conformance.test | |
| LFS | LFS server S3 backend | `lfs/server/s3/*` | — | None | | |
| LFS | LFS file locking API | not in JGit | — | Full (twin) | vcs-transport-lfs/src/locks/; native-git-lfs-locks | webrun-only |
| LFS | Install built-in LFS (`InstallBuiltinLfsCommand`) | `InstallBuiltinLfsCommand` | — | Partial | filter-driver.ts (`required`) | registration by code (`filterDrivers`), no install command |
| Events | Repository listeners (refs changed, index changed, config changed, working tree modified) | `events/*`, `ListenerList` | ConfigChangeEventTest | Partial | vcs-core (FileRefStore.setTransactionHook), vcs-working-tree staging `setWriteHook`, alternates `onChange` | hook points, no general listener registry |
| Repo tool | Android `repo` manifest to superproject | `gitrepo/RepoCommand`, `ManifestParser`, `BareSuperprojectWriter` | RepoCommandTest (41), ManifestParserTest (10), BareSuperprojectWriterTest | None | | JGit-specific |
| Util | Date parsing/formatting (git formats, relative dates, approxidate) | `GitDateParser`, `GitDateFormatter`, `RelativeDateFormatter`, `GitTimeParser` | GitDateParserTest (13), GitDateFormatterTest (9), RelativeDateFormatterTest (10), GitTimeParserTest (19) | Full (twin) | vcs-commands/src/commands/git-date.ts, date-format.ts; pretty-format-native | |
| Util | Path quoting (C-style, Bourne) | `QuotedString` | QuotedStringGitPathStyleTest (31), QuotedStringBourneStyleTest, QuotedStringBourneUserPathStyleTest | Full | vcs-commands (cQuote, sqQuote in vcs-transport/src/protocol) | |
| Util | Base85, hex, varint | `Base85`, `Hex`, `NB` | Base85Test, HexTest, NBTest | Full | vcs-utils/src/diff/patch/base85.ts, vcs-utils/src/encoding/ | |
| Util | File system abstraction (`FS`, symlinks, exec bit, external processes) | `util/FS`, `FS_POSIX`, `FileUtils` | FSTest, FS_POSIXTest, FileUtilsTest (31), SymlinksTest | Full | vcs-utils/src/files/ (FilesApi), vcs-utils-node/src/files/ | a portable FilesApi; processes only through host hooks |
| Util | Temporary buffers, stream utilities | `TemporaryBuffer`, `UnionInputStream`, `TeeOutputStream` | TemporaryBufferTest (17), UnionInputStreamTest | N/A | | Java I/O plumbing; webrun uses Web Streams |
| Util | Ref lists/maps, LRU caches, IntList, BlockList | `RefList`, `RefMap`, `LRUMap`, `SimpleLruCache`, `IntList`, `BlockList`, `LongMap` | RefListTest (25), RefMapTest (22), SimpleLruCacheTest, IntListTest, BlockListTest | N/A | (vcs-utils OrderedMap is the webrun analogue) | collection utilities |
| Util | Hook/script execution | `FS.runHookIfPresent`, `ProcessBuilder` | RunExternalScriptTest (12) | Full | vcs-utils-node/src/files/node-hook-runner.ts | |
| Util | SHA-1 with collision detection | `util/sha1/SHA1` | SHA1Test | ? | vcs-utils/src/hash/hasher/ | fast SHA-1 present; collision detection (sha1dc) not confirmed |
| Util | NLS / translation bundles | `nls/*`, `JGitText` | NLSTest, TranslationBundleTest, RootLocaleTest | N/A | | Java localization |
| Util | Performance logging | `logging/PerformanceLogContext` | PerformanceLogContextTest | N/A | | |
| OSGi/Ant/UI | Eclipse integration bundles (`org.eclipse.jgit.ant`, `.ui`, packaging, `.coverage`, `.benchmarks`) | `org.eclipse.jgit.ant`, `org.eclipse.jgit.ui` | ant tests | N/A | | Java/Eclipse-specific |
| Test infra | `TestRepository` fluent builder, `RepositoryTestCase`, `MockSystemReader` | `org.eclipse.jgit.junit.*` | TestRepositoryTest (14) | Full | vcs-testing/, vcs-commands/tests/merge-native-scenarios.ts (`buildHistory`) | native-twin fixtures play this role |
| pgm CLI | `jgit config` | `pgm/Config` | pgm ConfigTest | Partial | GitWorkingCopyConfig get/set/unset API | no CLI; no `config` command object |
| pgm CLI | `jgit ls-files`, `ls-tree`, `show-ref`, `diff-tree`, `show` | `pgm/LsFiles`, `LsTree`, `ShowRef`, `DiffTree`, `Show` | pgm LsFilesTest, ShowTest | Partial | DiffCommand (`diff-tree` modes), Staging/Trees APIs | library APIs cover the data; no dedicated commands or git-identical outputs for ls-files/ls-tree/show-ref/show |
| pgm CLI | `jgit merge-base` | `pgm/MergeBase` | — | Full | vcs-commands/src/commands/merge-bases.ts | library function, no command class |
| pgm CLI | `jgit rev-list`, `rev-parse` | `pgm/RevList`, `RevParse` | pgm RevListTest | Full (twin) | rev-list-command.ts, rev-parse-command.ts; revision-args-native | |
| pgm CLI | `jgit index-pack`, `upload-pack`, `receive-pack` (stdin/stdout services) | `pgm/IndexPack`, `UploadPack`, `ReceivePack` | — | Full | vcs-core/src/pack/index-pack.ts, vcs-transport/src/operations/serve-over-duplex.ts | |
| pgm CLI | `jgit daemon` | `pgm/Daemon` | — | Partial | serve-git-connection.ts | serving logic; no listener process |
| pgm CLI | `jgit multi-pack-index`, `object-size-index` | `pgm/MultiPackIndex`, `ObjectSizeIndex` | — | Partial | vcs-store-files/src/multi-pack-index.ts (`multiPackIndexWrite/Verify/Expire/Repack`) | midx yes, object-size-index none |
| pgm CLI | `jgit repo`, `amazon-s3-client`, `glog` (Swing) | `pgm/Repo`, `AmazonS3Client`, `Glog` | pgm RepoTest | None | | |
| pgm CLI | `jgit version`, command catalog | `pgm/Version`, `CommandCatalog` | CLIGitCommandTest, TextBuiltinTest | N/A | | CLI plumbing |
| pgm debug | Debug tools: show/read/write dircache, cache tree, pack delta, commit-graph rebuild, changed-path filters, reftable read/write/verify/benchmark, diff algorithm benchmarks, text hash functions, LFS store | `pgm/debug/*` | — | Partial | vcs-store-files/src/commit-graph.ts (write), fsck verify-pack | equivalents for commit-graph and index exist as APIs; reftable none; benchmarks in scripts/ |

## Porting JGit tests

The classes below test logic that does not depend on Java-only infrastructure: they parse bytes or strings, run an algorithm, or build small histories that webrun's fixtures (`vcs-testing`, `buildHistory` in `vcs-commands/tests/merge-native-scenarios.ts`, the in-memory stores) can rebuild. Counts are `@Test` methods (parameterized classes run more cases than that). Classes extending `RepositoryTestCase`/`LocalDiskRepositoryTestCase`/`RevWalkTestCase` need only a repository fixture, which webrun has; classes built around servlets, the JVM cache layer, DFS pack files, Java streams or Apache MINA are left out.

### Pure parsing and matching (no repository; port directly)

| Area | Class (tests) |
|---|---|
| Ignore and wildmatch | IgnoreRuleSpecialCasesTest (169), FastIgnoreRuleTest (19), IgnoreMatcherParametrizedTest (10), BasicRuleTest (3), FileNameMatcherTest (155) |
| Attributes | AttributesMatcherTest (9), AttributesNodeTest (7) |
| Config | ConfigTest (99), RemoteConfigTest (28), CommitConfigTest (26), BranchConfigTest (9), PushConfigTest (8), TransferConfigTest (8) |
| Refs and names | ValidRefNameTest (22), RefSpecTest (47), URIishTest (74) |
| Objects | ObjectCheckerTest (136), DirCacheEntryTest (16), ObjectIdTest (17), AbbreviatedObjectIdTest (26), PersonIdentTest (11), RawParseUtils_ParsePersonIdentTest (5) |
| Diff | AbstractDiffTestCase (23, shared by Myers and Histogram), HistogramDiffTest (7), EditTest (16), EditListTest (5), SimilarityIndexTest (8), RawTextTest (18), RawTextIgnore*WhitespaceTest (2+2+2+4) |
| Merge | MergeAlgorithmTest (22), MergeAlgorithmUnionTest (24), MergeMessageFormatterTest (16) |
| Patch | FileHeaderTest (21), PatchTest (7), PatchErrorTest (6), PatchCcTest (3), GetTextTest (4) |
| Protocol | PacketLineInTest (30), PacketLineOutTest (9), SideBandInputStreamTest (21), SideBandOutputStreamTest (11), ProtocolV0ParserTest (9), ProtocolV2ParserTest (22), FirstWantTest (7) |
| Dates and quoting | GitDateParserTest (13), GitTimeParserTest (19), GitDateFormatterTest (9), RelativeDateFormatterTest (10), QuotedStringGitPathStyleTest (31), QuotedStringBourneStyleTest (10), QuotedStringBourneUserPathStyleTest (12), Base85Test (4) |
| LFS | LFSPointerTest (26), LfsPointerFilterTest (5) |
| EOL streams | AutoLFInputStreamTest (9), AutoLFOutputStreamTest (8), AutoCRLFInputStreamTest (2), AutoCRLFOutputStreamTest (2) |
| Commit messages | FooterLineTest (26), RevCommitParseTest (22), RevTagParseTest (24) |

About 1,430 test methods. Native-git-backed classes (CGitIgnoreTest (39), CGitAttributesTest (26), DirCacheCGitCompatabilityTest (8)) map onto webrun's native-twin style directly.

### Repository scenarios (need a history fixture; port as scenario tests)

| Area | Class (tests) |
|---|---|
| Commit and index | CommitOnlyTest (96), AddCommandTest (41), CommitCommandTest (26), IndexDiffTest (17), StatusCommandTest (7) |
| Checkout | DirCacheCheckoutTest (78), DirCacheCheckoutMaliciousPathTest (42), CheckoutCommandTest (36), PathCheckoutCommandTest (18) |
| Merge family | MergeCommandTest (57), RebaseCommandTest (80), CherryPickCommandTest (24), RevertCommandTest (12), StashApplyCommandTest (32), StashCreateCommandTest (16), SimpleMergeTest (16), GitlinkMergeTest (19), SymlinkMergeTest (5), MergeGitAttributeTest (8), PullCommandTest (21) |
| History walks | FirstParentRevWalkTest (26), RevWalkSortTest (18), RevWalkFilterTest (17), RevWalkPathFilter1Test (14), RevWalkPathFilter6012Test (7), TreeRevFilterTest (10), RevWalkMergeBaseTest (7), RevWalkMergedIntoTest (5), RevWalkShallowTest (7), ObjectWalkTest (9), ObjectWalkFilterTest (6), RevWalkCommitGraphTest (26) |
| Diff and blame | RenameDetectorTest (33), DiffFormatterTest (21), DiffEntryTest (13), BlameCommandTest (21), BlameGeneratorTest (18), DescribeCommandTest (11) |
| Notes | NoteMapTest (18), NoteMapMergerTest (17), DefaultNoteMergerTest (6) |
| Patch apply | PatchApplierTest (61, with its resource patches), ApplyCommandTest (13) |
| Attributes and EOL | AttributesHandlerTest (30), TreeWalkAttributeTest (18), EolRepositoryTest (28), IgnoreNodeTest (36) |
| Refs | RefDirectoryTest (72), BatchRefUpdateTest (43), RefUpdateTest (52), RepositoryResolveTest (22), ReflogReaderTest (8) |
| Storage formats | CommitGraphTest (11), CommitGraphWriterTest (11), MultiPackIndexTest (19), PackIndexMergerTest (17), PackIndexTestCase (12), PackBitmapIndexBuilderTest (13), PackReverseIndexV1Test (17), UnpackedObjectTest (15), PackParserTest (16) |
| Server | UploadPackTest (103), TreeWalkConnectivityCheckerTest (33), IterativeConnectivityCheckerTest (9), UploadPackReachabilityTest (9) |
| Tree walks | IndexDiffFilterTest (38), PathFilterLogicTest (21), CanonicalTreeParserTest (18), NameConflictTreeWalkTest (10) |

About 1,700 test methods. Most JGit expectations are JGit's own behaviour rather than native git's; where they disagree with git (rename-free merges, histogram as default diff, reset modes) a port should take native git as the oracle, as webrun's twins do.

### Not worth porting

DFS block cache and DFS midx tests, WindowCache tests, ApacheSshTest and the sshd tests, servlet tests in `http.test`, `gpg.bc` key tests, ReftableTest and friends (until reftable is in scope), ChangeIdUtilTest, gitrepo tests, `util/io` stream tests, NLS tests, ObjectSizeIndex tests.

## Unsure

- Repository setup: relative gitdir paths on init/clone (`setRelativeDirs`) not found as an option.
- GC: removal of empty ref folders, orphan and temporary files not checked.
- Diff: full copy detection (`-C`, `--find-copies-harder`) not checked; copy entries exist.
- LFS: reading `lfs.url` / `.lfsconfig` not checked.
- SHA-1 collision detection (sha1dc) not checked.
- Checkout: whether every malicious path that fsck flags is also refused at checkout was not traced.
