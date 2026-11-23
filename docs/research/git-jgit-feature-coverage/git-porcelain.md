# git porcelain vs webrun-vcs

Native git's user-facing commands (`command-list.txt` categories mainporcelain, ancillarymanipulators, ancillaryinterrogators, foreignscminterface and the user-facing side of synchingrepositories), one row per command plus rows for its option groups and modes, with how far webrun-vcs covers each. Sources: git master of 2026-11-19 (`Documentation/git-*.adoc`, `t/`), webrun-vcs at the P4.82 PR branch (`packages/`). Plumbing, file formats, protocols, server internals, hooks and config/attributes as subsystems are another table's subject; the servers and a few helpers appear here briefly.

**Coverage values.** **Full**: implemented and compared with native git by a native-twin test (a command row is Full when its core behaviour is; its missing options get their own rows). **Partial**: implemented with options or modes missing, or implemented without a native twin (Notes say which). **None**: not found. **N/A**: not meaningful for a library (external UIs, the git program's own CLI features). **?**: could not be decided from code and tests.

**Evidence paths** are relative to `packages/`: `C/` = `vcs-commands/src/commands/`, `T/` = `vcs-commands/tests/`, `SF/` = `vcs-store-files/src/`, `SFT/` = `vcs-store-files/tests/`; `results/` = `vcs-commands/src/results/`. Every command class is reached from the `Git` facade (`vcs-commands/src/git.ts`) unless a row says it is a library function. webrun-vcs is an API, not a CLI: options are setters, editors and prompts are callbacks, and output text comes from `callText`/`callBytes` or formatter functions.

**Method.** Each option was checked by grepping the command class for its setter and the 142 `*native*.test.ts` files (plus the `*.git.test.ts` files in vcs-store-files) for the option; the doc comment of every native test file was read, and a sample of Full claims was checked against the test bodies (notes, stash, sparse-checkout, bisect, cherry-pick/revert, am, apply, rebase -i, switch -m, remote, mv, rm, reset, merge `-s ours`/`-X theirs`, `--pathspec-from-file`). Options that appear in a twin only as fixture setup (native git building the repository) were not counted as covered.

## Summary

| Area | Full | Partial | None | N/A | ? | Rows |
|---|---:|---:|---:|---:|---:|---:|
| Setup | 9 | 7 | 4 | 0 | 2 | 22 |
| Snapshot | 65 | 8 | 17 | 0 | 2 | 92 |
| Branching | 46 | 12 | 12 | 0 | 0 | 70 |
| Rewriting | 37 | 8 | 19 | 0 | 1 | 65 |
| Inspection | 34 | 9 | 25 | 2 | 5 | 75 |
| Sharing | 25 | 10 | 19 | 0 | 0 | 54 |
| Maintenance | 7 | 7 | 7 | 1 | 0 | 22 |
| Foreign | 0 | 0 | 6 | 0 | 0 | 6 |
| Tools | 0 | 0 | 0 | 3 | 0 | 3 |
| Servers | 1 | 2 | 0 | 0 | 0 | 3 |
| Helpers (outside scope) | 2 | 5 | 2 | 0 | 0 | 9 |
| **All** | 226 | 68 | 111 | 6 | 10 | 421 |

Rows are not weighted: a Full row for a whole command (`git merge`) and a None row for one flag group count the same.

### Largest gaps (None)

- **Whole commands missing:** `grep`, `shortlog`, `range-diff`, `show-branch`, `annotate`, `rerere`, `archive`, `bundle` (and bundle URIs), `submodule` management (add, init/deinit, update, status, sync, foreach, absorbgitdirs, set-url/set-branch: only `submodule summary` exists), `maintenance`, `count-objects`, `refs`, `replace` (refs are honoured, not created), `filter-branch`, `fast-export`/`fast-import`, `git history`, `stash show`/`stash branch`, `request-pull`, `send-email`, every foreign-SCM bridge, credential helpers.
- **Signing everywhere:** `commit -S`, `tag -s/-v`, `verify-commit/-tag`, `merge --verify-signatures`, `rebase/cherry-pick -S`, `push --signed`, `log --show-signature` (only `%G?` placeholders).
- **History search:** `log --grep`, pickaxe `-S/-G`, `-L` line log, `--left-right/--cherry-mark/--cherry-pick`, `--ancestry-path`, `--simplify-by-decoration`, `log -g`, `--remerge-diff`.
- **Diff presentation:** `--word-diff`/`--color-words`, colour and `--color-moved`, `--check`, `-I<regex>`, `--relative`, `--diff-filter`, external diff.
- **Commit conveniences:** `--fixup/--squash`, `-C/-c`, `-s/--signoff`, `--trailer`, `-p`, `--pathspec-from-file` (also missing for `add`, `rm`, `stash push`).
- **Submodule recursion:** `--recurse-submodules` on clone, fetch, pull, push, checkout, switch, restore, reset.
- **Remote/branch management output:** `branch -v/--format/--sort/--merged/-u`, `tag -l` filters and sorting, `remote show/prune/update`, `push -u`, `fetch --all/--multiple`, `push --follow-tags`.
- **Rewriting options:** `rebase --onto <newbase> <upstream>` (only `--root --onto` found: marked ?), `--fork-point/--keep-base`, `--quit`, `--apply` backend; `cherry-pick -x/--ff/--allow-empty/--quit`; `merge -s subtree` and the `-X` diff options; `blame -M/-C/--reverse/--ignore-rev`.

### Unsure (?)

`init --separate-git-dir` (a gitfile?), writable config scopes, `add --sparse`, `worktree add --relative-paths`, `rebase --onto` with a distinct upstream, `log --branches/--tags/--glob/--exclude/--stdin`, `diff --dirstat`, `--anchored`, `--quiet/--exit-code`, `diff --merge-base`/`A...B`.

## Table

| Area | Feature | git (command / options) | git tests (t/) | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Setup | Create a repository | `git init` | t0001-init | Partial | C/init-command.ts; T/init-command.test.ts; SFT/repository-format.git.test.ts | Works (files, mem, KV, SQL backends); no native twin of `init` itself, though every twin reads repositories native `git init` made and native git reads ours. |
| Setup | Bare repository | `init --bare` | t0001-init | Partial | C/init-command.ts (`setBare`) | Unit-tested only. |
| Setup | Initial branch name | `init -b/--initial-branch`, `init.defaultBranch` | t0001-init | Partial | C/init-command.ts (`setInitialBranch`) | Unit-tested only. |
| Setup | Separate git dir | `init --separate-git-dir` | t0001-init | ? | C/init-command.ts (`setGitDir`) | `setGitDir` places the git directory; whether a gitfile is written as git does was not verified. |
| Setup | Templates, shared repo | `init --template`, `--shared[=perm]` | t0001-init, t1301-shared-repo | None | - | No setters. `core.sharedRepository` is honoured on index writes (CLAUDE.md, split index). |
| Setup | Object/ref format | `init --object-format=sha256`, `--ref-format=reftable` | t1016-compatObjectFormat, t0610-reftable-basics | None | SF/repository-format.ts | sha256 and reftable repositories are recognised and refused. |
| Setup | Clone (all transports) | `git clone <url>` | t5601-clone, t5603-clone-dirname | Full | C/clone-command.ts; T/clone-fetch-native-git.test.ts, T/git-native-protocol.test.ts, T/http-served-native.test.ts | Smart HTTP, git://, ssh (over a host-supplied command), file; no dumb-HTTP client (native git cloning from our dumb-HTTP server is tested). Config, `origin/HEAD`, FETCH_HEAD compared byte for byte. |
| Setup | Clone into existing destination | `clone` into a non-empty dir, of an empty or corrupt repo | t5600-clone-fail-cleanup, t5601-clone | Full | T/clone-destination-native.test.ts | |
| Setup | Bare / mirror clone | `clone --bare`, `--mirror` | t5601-clone, t5612-clone-refspec | Full | T/clone-initial-transaction-native.test.ts, T/clone-fetch-native-git.test.ts | Initial ref transaction straight into packed-refs as git. |
| Setup | Branch selection | `clone -b`, `--single-branch`, `--no-tags` | t5609-clone-branch, t5612-clone-refspec | Full | T/clone-initial-transaction-native.test.ts (followed tags of single-branch) | |
| Setup | No checkout | `clone --no-checkout`, `-n` | t5601-clone | Full | T/clone-fetch-native-git.test.ts, T/initial-checkout-native.test.ts | Unborn index as git (`is_index_unborn`). |
| Setup | Shallow clone | `clone --depth`, `--shallow-since`, `--shallow-exclude` | t5500-fetch-pack, t5537-fetch-shallow | Full | C/clone-command.ts; T/serve-shallow-native.test.ts, T/fetch-connectivity-native.test.ts | Local clones ignore `--depth` with git's warning (T/clone-local-native.test.ts). |
| Setup | Partial clone | `clone --filter=<spec>` | t5616-partial-clone, t0410-partial-clone | Full | T/partial-clone-lazy-native.test.ts, T/serve-filter-native.test.ts | Lazy fetch batches counted against native git. |
| Setup | Local clone, alternates | `clone --local/--no-local/--no-hardlinks/--shared/--reference[-if-able]/--dissociate` | t5605-clone-local, t5604-clone-reference | Full | T/clone-local-native.test.ts, T/alternates-native.test.ts | Always copies objects (no hard links through the FilesApi). |
| Setup | Sparse clone | `clone --sparse` | t1091-sparse-checkout-builtin | Partial | C/clone-command.ts (`setSparse`) | No twin of `clone --sparse` found (the `--no-sparse` hit is backfill's). |
| Setup | Remote name / upload-pack | `clone -o/--origin`, `-u/--upload-pack` | t5601-clone | Partial | C/clone-command.ts (`setRemote`, `setUploadPack`) | No twin found. |
| Setup | Clone with submodules | `clone --recurse-submodules`, `--shallow-submodules`, `--also-filter-submodules` | t5614-clone-submodules-shallow, t5617-clone-submodules-remote | None | - | Submodule directories are left empty, as without the option. |
| Setup | Other clone options | `clone --separate-git-dir`, `--template`, `-c/--config`, `--bundle-uri`, `--revision`, `--server-option`, `--reject-shallow` | t5601-clone, t5611-clone-config, t5621-clone-revision, t5558-clone-bundle-uri | None | - | No setters found. |
| Setup | Read configuration | `git config get/--get/--get-all/--list --show-origin`, includes, `includeIf`, `config.worktree`, `git -c` | t1300-config, t1305-config-include, t1308-config-set, t1309-early-config | Full | SF/workspace/working-copy/working-copy-config.files.ts; T/config-chain-native.test.ts, T/config-parse-native.test.ts, T/command-line-config-native.test.ts | Library API (`GitWorkingCopyConfig.get/getAll/listWithOrigin`), not a CLI; parse errors and line numbers as git. |
| Setup | Write configuration | `git config set/unset/--add/--replace-all/rename-section/remove-section` | t1300-config | Partial | SF/workspace/working-copy/working-copy-config.files.ts (`set/add/unset/unsetSection/renameSection/copySection`) | Byte-preserving rewrite is twin-checked (T/config-parse-native.test.ts); no twin per subcommand. |
| Setup | Typed config queries | `config --type=bool/int/path/color/expiry-date`, `--default`, `--get-urlmatch`, `--get-color`, `--edit` | t1300-config, t1310-config-default | Partial | vcs-utils `parseGitBool`; SF/.../working-copy-config.files.ts | Typed parsing exists per consumer; no general `--type` canonicaliser, `--get-urlmatch`, `--get-color`; `--edit` is N/A. |
| Setup | Config scopes for writes | `config --global/--system/--local/--worktree/--file/--blob` | t1300-config, t1307-config-blob | ? | SF/.../working-copy-config.files.ts | Reads cover every scope; which scopes the API can write was not verified. |
| Snapshot | Stage files | `git add <pathspec>` | t3700-add, t2200-add-update | Full | C/add-command.ts; T/add-native.test.ts | Index, resolve-undo, cache-tree, messages compared. |
| Snapshot | Update / all | `add -u`, `-A`, `--no-all/--ignore-removal` | t2200-add-update, t2202-add-addremove | Full | T/add-native.test.ts | |
| Snapshot | Intent to add | `add -N` | t2203-add-intent | Full | T/add-native.test.ts | |
| Snapshot | Force / ignored | `add -f`, ignored-path refusal | t2204-add-ignored | Full | T/add-native.test.ts, T/ignore-fuzz-native.test.ts | |
| Snapshot | Dry run | `add -n`, `--ignore-missing`, `-v` | t3700-add | Full | T/add-native.test.ts | |
| Snapshot | Mode and stat | `add --chmod=±x`, `--refresh` | t3700-add | Full | T/add-chmod-refresh-native.test.ts | |
| Snapshot | Renormalize | `add --renormalize` | t0025-crlf-renormalize | Full | T/add-native.test.ts, T/attributes-checkout-native.test.ts | |
| Snapshot | Line endings / filters on add | autocrlf, eol, `filter=` (LFS) | t0020-crlf, t0021-conversion, t0027-auto-crlf | Full | T/attributes-eol-native.test.ts, T/attributes-fuzz-native.test.ts, T/lfs-filter-native.test.ts | |
| Snapshot | Patch add | `add -p` | t3701-add-interactive | Full | C/add-patch/; T/add-patch-native.test.ts | Prompts through a `PatchSelector` callback; 2.43 and 2.5x transcripts. |
| Snapshot | Interactive add | `add -i` | t3701-add-interactive | Full | C/add-patch/add-interactive.ts; T/add-interactive-native.test.ts | |
| Snapshot | Edit patch | `add -e/--edit` | t3702-add-edit | None | - | (`e` inside `add -p` is supported.) |
| Snapshot | Pathspec from file | `add --pathspec-from-file`, `--pathspec-file-nul` | t3704-add-pathspec-file | None | C/add-command.ts | No setter. |
| Snapshot | Sparse add | `add --sparse` | t3705-add-sparse-checkout | ? | C/add-command.ts | No setter named so; behaviour outside the cone not checked. |
| Snapshot | Ignore errors | `add --ignore-errors`, `add.ignoreErrors` | t3700-add | Partial | C/add-command.ts (`setIgnoreErrors`) | No twin found. |
| Snapshot | Embedded repositories | gitlink staging, `advice.addEmbeddedRepo` | t3700-add | Full | T/add-native.test.ts | |
| Snapshot | Pathspec magic | `:(glob)`, `:(icase)`, `:(exclude)`, `:(attr:...)`, `:/` | t3703-add-magic-pathspec, t6130..t6137 | Full | C/pathspec.ts; T/pathspec-attr-native.test.ts, T/status-pathspec-native.test.ts | |
| Snapshot | Move / rename | `git mv` | t7001-mv | Full | C/mv-command.ts; T/mv-native.test.ts | |
| Snapshot | mv options | `mv -f`, `-k`, `-n`, `-v` | t7001-mv | Full | T/mv-native.test.ts | |
| Snapshot | mv in sparse checkout | `mv --sparse` | t7002-mv-sparse-checkout | Full | T/mv-native.test.ts | |
| Snapshot | mv of submodules | gitfile, `core.worktree`, `.gitmodules` updated | t7001-mv | Full | T/mv-native.test.ts | |
| Snapshot | Remove | `git rm` | t3600-rm | Full | C/rm-command.ts; T/rm-pathspec-native.test.ts | |
| Snapshot | rm options | `rm --cached`, `-r`, `-f`, `--ignore-unmatch` | t3600-rm | Full | T/rm-pathspec-native.test.ts | |
| Snapshot | rm of submodules | `rm sub`, `rm --cached sub` | t3600-rm | Full | T/rm-pathspec-native.test.ts | |
| Snapshot | rm sparse | `rm --sparse` | t3602-rm-sparse-checkout | Partial | C/rm-command.ts (`setSparse`) | Skip-worktree entries without a sparse checkout are twin-tested; `--sparse` itself not found in a twin. |
| Snapshot | rm dry run / quiet | `rm -n`, `-q` | t3600-rm | None | C/rm-command.ts | No setter. |
| Snapshot | rm pathspec from file | `rm --pathspec-from-file` | t3601-rm-pathspec-file | None | - | |
| Snapshot | Restore paths | `git restore` | t2070-restore | Full | C/restore-command.ts, C/checkout-paths.ts; T/checkout-paths-native.test.ts | |
| Snapshot | restore source/targets | `restore --source`, `--staged`, `--worktree` | t2070-restore | Full | T/checkout-paths-native.test.ts | |
| Snapshot | restore conflicts | `restore --ours/--theirs`, `-m`, `--conflict=merge/diff3/zdiff3` | t2070-restore | Full | T/checkout-paths-native.test.ts | |
| Snapshot | restore overlay & flags | `restore --overlay/--no-overlay`, `--ignore-unmerged`, `--ignore-skip-worktree-bits` | t2070-restore | Full | T/checkout-paths-native.test.ts | |
| Snapshot | restore patch | `restore -p` | t2071-restore-patch | Full | T/add-patch-native.test.ts | |
| Snapshot | restore pathspec from file | `restore --pathspec-from-file` | t2072-restore-pathspec-file | Partial | C/restore-command.ts (`setPathspecFromFile`) | Twin covers reset's form only (T/checkout-paths-native.test.ts). |
| Snapshot | restore submodules | `restore --recurse-submodules` | t2070-restore | None | - | |
| Snapshot | Reset modes | `reset --soft/--mixed/--hard` | t7102-reset, t7104-reset-hard | Full | C/reset-command.ts; T/branch-state-native.test.ts, T/reset-refresh-native.test.ts, T/index-flags-native.test.ts | Our `--hard` rewrites every file (git keeps clean ones). |
| Snapshot | Reset merge/keep | `reset --merge`, `--keep` | t7110-reset-merge, t7111-reset-table | Full | T/branch-state-native.test.ts | |
| Snapshot | Reset paths | `reset [<tree-ish>] -- <paths>` | t7102-reset | Full | T/checkout-paths-native.test.ts | |
| Snapshot | Reset patch | `reset -p` | t7105-reset-patch | Full | T/add-patch-native.test.ts | |
| Snapshot | Reset refresh output | `reset -N`, `-q`, `--no-refresh`, "Unstaged changes after reset" | t7102-reset | Full | T/reset-refresh-native.test.ts | |
| Snapshot | Reset pathspec file | `reset --pathspec-from-file` | t7107-reset-pathspec-file | Full | T/checkout-paths-native.test.ts | |
| Snapshot | Reset submodules | `reset --recurse-submodules` | t7112-reset-submodule | None | - | |
| Snapshot | Status (long) | `git status` | t7508-status, t7060-wtstatus, t7512-status-help | Full | C/status-command.ts, C/status-format.ts; T/status-long-native.test.ts | Branch line, tracking, in-progress states, hints. |
| Snapshot | Status short/porcelain | `status -s`, `--porcelain[=v2]`, `-b`, `-z` | t7064-wtstatus-pv2, t7508-status | Full | T/status-long-native.test.ts, T/status-stash-native.test.ts | |
| Snapshot | Untracked / ignored modes | `status -u<mode>`, `--ignored[=mode]`, `status.showUntrackedFiles` | t7061-wtstatus-ignore, t7521-ignored-mode | Full | T/status-untracked-modes-native.test.ts | |
| Snapshot | Status pathspec | `status -- <pathspec>` | t7508-status | Full | T/status-pathspec-native.test.ts | |
| Snapshot | Status renames | `status.renames`, rename display | t7525-status-rename | Full | T/status-gaps-native.test.ts | |
| Snapshot | Status rename tuning | `status --find-renames=<n>`, `--no-renames` | t7525-status-rename | Partial | C/status-command.ts (`setRenames`, `setRenameLimit`) | No twin of the threshold. |
| Snapshot | Stash count | `status --show-stash` | t7508-status | Full | T/status-long-native.test.ts | |
| Snapshot | Submodules in status | dirty submodules, `--ignore-submodules`, `status.submoduleSummary` | t7506-status-submodule, t7401-submodule-summary | Full | T/status-gaps-native.test.ts, T/submodule-summary-native.test.ts | |
| Snapshot | Tracking info | ahead/behind lines, `--[no-]ahead-behind` | t6040-tracking-info | Full | C/tracking-info.ts; T/status-long-native.test.ts | |
| Snapshot | Verbose status | `status -v/-vv` | t7508-status | Partial | C/status-command.ts | The commit template's `-v/-vv` diff is twin-tested (T/commit-status-native.test.ts); `status -v` itself not found. |
| Snapshot | Columns | `status --column`, `column.status` | t9002-column | None | - | |
| Snapshot | Untracked cache | `core.untrackedCache`, `UNTR` | t7063-status-untracked-cache | Full | T/status-untracked-cache-native.test.ts | |
| Snapshot | fsmonitor | `core.fsmonitor`, builtin fsmonitor | t7519-status-fsmonitor, t7527-builtin-fsmonitor | None | - | |
| Snapshot | Commit | `git commit -m/-F`, editor | t7501-commit-basic-functionality, t7502-commit-porcelain | Full | C/commit-command.ts; T/commit-editmsg-native.test.ts, T/message-cleanup-native.test.ts | Editor is a callback (`setEditor`). |
| Snapshot | Commit all | `commit -a` | t7501-commit-basic-functionality | Full | T/add-native.test.ts, T/hooks-index-change-native.test.ts | Holds `index.lock` as git. |
| Snapshot | Partial commits | `commit -i/--include`, `-o/--only <paths>` | t7501-commit-basic-functionality | Full | T/commit-editmsg-native.test.ts, T/pathspec-attr-native.test.ts | |
| Snapshot | Amend | `commit --amend [--no-edit]` | t7501-commit-basic-functionality | Full | T/commit-editmsg-native.test.ts, T/notes-native.test.ts, T/reflog-native.test.ts | |
| Snapshot | Empty commits/messages | `--allow-empty`, `--allow-empty-message` | t7501-commit-basic-functionality | Partial | C/commit-command.ts | Refusal order twin-tested (T/commit-editmsg-native.test.ts); the options mostly appear in fixtures. |
| Snapshot | Cleanup modes | `--cleanup=strip/whitespace/verbatim/scissors/default` | t7502-commit-porcelain | Full | T/message-cleanup-native.test.ts, T/commit-status-native.test.ts | |
| Snapshot | Template & verbose | `-t/--template`, `-v/-vv`, `commit.status`, `core.commentChar` | t7500-commit-template-squash-signoff, t7507-commit-verbose | Full | T/commit-status-native.test.ts | |
| Snapshot | Dry run | `commit --dry-run --short/--porcelain/--long/-z/--branch/-u` | t7501-commit-basic-functionality | Full | T/commit-status-native.test.ts | |
| Snapshot | Authorship | `--author`, `--date`, `--reset-author` | t7509-commit-authorship | Partial | C/commit-command.ts (`setAuthor`, `setResetAuthor`) | Identity resolution from env/config is twin-tested (T/ident-native.test.ts); the options take a `PersonIdent`, no string parsing of `--author`/`--date`. |
| Snapshot | Commit hooks | pre-commit, prepare-commit-msg, commit-msg, post-commit, `-n/--no-verify` | t7503-pre-commit-and-pre-merge-commit-hooks, t7504-commit-msg-hook, t7505-prepare-commit-msg-hook | Full | T/hooks-commit-native.test.ts | |
| Snapshot | No post-rewrite | `commit --no-post-rewrite` | t5407-post-rewrite-hook | Partial | C/commit-command.ts (`setNoPostRewrite`) | |
| Snapshot | Reuse message | `commit -C/-c <commit>` | t7501-commit-basic-functionality | None | - | |
| Snapshot | Fixup/squash commits | `commit --fixup[=amend:/reword:]`, `--squash` | t7500-commit-template-squash-signoff | None | - | (rebase `--autosquash` consumes them.) |
| Snapshot | Sign-off & trailers | `commit -s/--signoff`, `--trailer` | t7500-commit-template-squash-signoff, t7513-interpret-trailers | None | - | |
| Snapshot | Signing | `commit -S/--gpg-sign` | t7510-signed-commit, t7528-signed-commit-ssh | None | - | No signing anywhere. |
| Snapshot | Patch commit | `commit -p` | t7514-commit-patch | None | - | |
| Snapshot | Pathspec from file | `commit --pathspec-from-file` | t7526-commit-pathspec-file | None | - | |
| Snapshot | Identity resolution | `user.name/email`, `GIT_AUTHOR_*`, `author.*`/`committer.*` | t7517-per-repo-email, t7518-ident-corner-cases | Full | C/git-ident.ts; T/ident-native.test.ts | |
| Snapshot | Clean | `git clean -n/-f` | t7300-clean | Full | C/clean-command.ts; T/clean-fuzz-native.test.ts | Differential fuzz (data-loss class must match). |
| Snapshot | clean dirs/ignored | `clean -d`, `-x`, `-X` | t7300-clean | Full | T/clean-fuzz-native.test.ts, T/clean-fuzz-extended-native.test.ts, T/status-gaps-native.test.ts | |
| Snapshot | clean nested repos | `clean -ff` | t7300-clean | Full | T/clean-fuzz-native.test.ts | |
| Snapshot | clean exclude | `clean -e <pattern>` | t7300-clean | None | - | |
| Snapshot | clean interactive | `clean -i` | t7301-clean-interactive | None | - | Could be a callback like `add -i`; not implemented. |
| Snapshot | Sparse checkout (cone) | `sparse-checkout init/set/add/list/reapply/disable` | t1091-sparse-checkout-builtin | Full | C/sparse-checkout-command.ts; T/sparse-checkout-native.test.ts | |
| Snapshot | Non-cone patterns | `sparse-checkout --no-cone`, `set --stdin` | t1091-sparse-checkout-builtin | Full | T/sparse-checkout-native.test.ts | |
| Snapshot | Sparse index | `--sparse-index/--no-sparse-index`, `index.sparse` | t1092-sparse-checkout-compatibility | Full | T/sparse-index-native.test.ts | |
| Snapshot | Check rules | `sparse-checkout check-rules [-z] [--rules-file]` | t1091-sparse-checkout-builtin | Full | T/sparse-checkout-native.test.ts | |
| Snapshot | Sparse clean | `sparse-checkout clean` (2.5x) | t1091-sparse-checkout-builtin | Full | T/sparse-checkout-native.test.ts | 2.5x-only twins. |
| Snapshot | Sparse-aware commands | checkout, merge, reset, read-tree honouring patterns | t1092-sparse-checkout-compatibility, t6428-merge-conflicts-sparse, t6435-merge-sparse | Full | C/sparse-checkout-support.ts; T/sparse-checkout-native.test.ts, T/read-tree-native.test.ts | |
| Snapshot | Worktree add | `worktree add [-b/-B/--detach/--orphan/--lock/--reason/--no-checkout/-f]` | t2400-worktree-add | Full | C/worktree-add-command.ts; T/worktree-native.test.ts | |
| Snapshot | Worktree add tracking | `worktree add --track/--no-track/--guess-remote` | t2400-worktree-add | None | C/worktree-add-command.ts | No setters. |
| Snapshot | Relative worktree paths | `worktree add --relative-paths`, `worktree.useRelativePaths` | t2400-worktree-add | ? | - | Not found. |
| Snapshot | Worktree list | `worktree list [--porcelain/-v/-z/--expire]` | t2402-worktree-list | Full | C/worktree-list-command.ts; T/worktree-native.test.ts | |
| Snapshot | Worktree prune | `worktree prune [-n/-v/--expire]` | t2401-worktree-prune | Full | C/worktree-prune-command.ts; T/worktree-native.test.ts | |
| Snapshot | Worktree lock/unlock | `worktree lock [--reason]`, `unlock` | t2400-worktree-add | Full | C/worktree-lock-command.ts; T/worktree-native.test.ts | |
| Snapshot | Worktree remove/move | `worktree remove [-f]`, `worktree move` | t2403-worktree-move | Full | C/worktree-remove-command.ts; T/worktree-native.test.ts | |
| Snapshot | Worktree repair | `worktree repair [<path>...]` | t2406-worktree-repair | Full | C/worktree-repair-command.ts; T/worktree-native.test.ts | |
| Snapshot | Per-worktree config & refs | `extensions.worktreeConfig`, `config.worktree`, per-worktree refs | t2404-worktree-config, t1415-worktree-refs | Full | T/config-chain-native.test.ts, T/hooks-worktree-ref-transaction-native.test.ts | |
| Snapshot | Worktree-aware branch checks | branch checked out elsewhere refused (checkout, branch -d/-m) | t2407-worktree-heads | Full | T/worktree-native.test.ts | |
| Branching | Create branch | `git branch <name> [<start>]`, `-f` | t3200-branch | Full | C/branch-command.ts; T/reflog-native.test.ts, T/worktree-native.test.ts | |
| Branching | Delete branch | `branch -d/-D` | t3200-branch | Full | T/branch-copy-native.test.ts, T/worktree-native.test.ts | |
| Branching | Rename branch | `branch -m/-M` | t3200-branch | Full | T/branch-copy-native.test.ts, T/reflog-native.test.ts | Config and reflog carried as git. |
| Branching | Copy branch | `branch -c/-C` | t3200-branch | Full | T/branch-copy-native.test.ts | |
| Branching | List branches | `branch [-r/-a/--list <pattern>]` | t3203-branch-output | Partial | C/branch-command.ts (`ListBranchCommand.setListMode`) | Returns refs; no text output, patterns, `-v/-vv`, `--format`, `--sort`, `--column`, color. |
| Branching | Filter by reachability | `branch --contains/--no-contains/--merged/--no-merged/--points-at` | t3201-branch-contains | Partial | C/branch-command.ts (`setContains`) | Only `--contains`, unit-tested. |
| Branching | Upstream config | `branch -t/--track`, `--no-track`, `-u/--set-upstream-to`, `--unset-upstream` | t3200-branch, t2027-checkout-track | Partial | C/branch-tracking.ts | Tracking set up on create through checkout/switch `--track` (checked against 2.43/2.56); `branch` lacks `-u`/`--unset-upstream`/`--track`. |
| Branching | Misc branch | `branch --edit-description`, `--show-current`, `--create-reflog` | t3200-branch | None | - | |
| Branching | Switch | `git switch <branch>` | t2060-switch | Full | C/switch-command.ts; T/switch-native.test.ts | Refs, reflogs, config, index, worktree compared. |
| Branching | switch create/orphan/detach | `switch -c/-C`, `--orphan`, `--detach`, `-t/--no-track`, `--[no-]guess` | t2060-switch | Full | T/switch-native.test.ts, T/switch-merge-native.test.ts, T/initial-checkout-native.test.ts | |
| Branching | switch with local changes | `switch -m`, `--discard-changes`, `-f` | t2060-switch | Full | T/switch-merge-native.test.ts | `-m` follows 2.55+'s autostash. |
| Branching | switch other worktrees | `switch --ignore-other-worktrees` | t2060-switch | Full | T/worktree-native.test.ts | |
| Branching | switch submodules | `switch --recurse-submodules` | t2013-checkout-submodule | None | - | |
| Branching | Checkout branch | `checkout <branch>`, `-b/-B`, `--orphan`, `--detach`, `checkout -`, `@{-N}` | t2012-checkout-last, t2017-checkout-orphan, t2018-checkout-branch, t2020-checkout-detach | Full | C/checkout-command.ts; T/switch-native.test.ts, T/switch-merge-native.test.ts | |
| Branching | Checkout paths | `checkout [<tree-ish>] -- <pathspec>` | t2022-checkout-paths | Full | C/checkout-paths.ts; T/checkout-paths-native.test.ts | |
| Branching | Checkout conflicts | `checkout --ours/--theirs`, `-m`, `--conflict=<style>` | t2023-checkout-m | Full | T/checkout-paths-native.test.ts | |
| Branching | Checkout overlay | `checkout --no-overlay` | t2025-checkout-no-overlay | Full | T/checkout-paths-native.test.ts | |
| Branching | Checkout patch | `checkout -p` | t2016-checkout-patch | Full | T/add-patch-native.test.ts | |
| Branching | Checkout force | `checkout -f` | t2021-checkout-overwrite | Full | T/index-flags-native.test.ts | |
| Branching | Checkout pathspec file | `checkout --pathspec-from-file` | t2026-checkout-pathspec-file | Partial | C/checkout-command.ts (`setPathspecFromFile`) | Twin covers reset's form and `-p`'s refusal only. |
| Branching | Checkout DWIM | remote branch guess, `checkout.defaultRemote` | t2024-checkout-dwim | Partial | C/branch-tracking.ts | Implemented per checkout.c; no dedicated twin found. |
| Branching | Checkout submodules | `checkout --recurse-submodules` | t2013-checkout-submodule | None | - | |
| Branching | Merge | `git merge <commit>` (merge-ort) | t7600-merge, t6402-merge-rename, t6400-merge-df | Full | C/merge-command.ts, C/ort-merge.ts; T/merge-worktree-native.test.ts, T/merge-fuzz-native.test.ts | Differential fuzz of output, index, worktree, state files. |
| Branching | Fast-forward control | `merge --ff/--no-ff/--ff-only`, `merge.ff` | t7600-merge | Full | T/merge-octopus-native.test.ts, T/hooks-checkout-merge-native.test.ts | |
| Branching | Squash merge | `merge --squash` | t7600-merge | Full | T/commit-editmsg-native.test.ts, T/branch-state-native.test.ts | |
| Branching | Merge message | `merge --no-commit`, `-m`, `-F`, `--[no-]edit`, `--cleanup` | t7604-merge-custom-message | Full | T/switch-merge-native.test.ts, T/commit-editmsg-native.test.ts, T/message-cleanup-native.test.ts | |
| Branching | Merge abort/continue/quit | `merge --abort/--continue/--quit` | t7611-merge-abort | Full | T/merge-worktree-native.test.ts, T/branch-state-native.test.ts | |
| Branching | Rename handling | renames, rename/rename, rename/delete, directory renames (`merge.directoryRenames`) | t6423-merge-rename-directories, t6422-merge-rename-corner-cases | Full | T/merge-dir-renames-native.test.ts, T/merge-ort-rename-fuzz-native.test.ts | |
| Branching | Criss-cross merges | virtual merge base | t6416-recursive-corner-cases, t6404-recursive-merge | Full | C/ort-recursive.ts; T/merge-virtual-base-native.test.ts | |
| Branching | Octopus | `merge a b c` | t7602-merge-octopus-many | Full | C/octopus-merge.ts; T/merge-octopus-native.test.ts | |
| Branching | Strategy ours | `merge -s ours` | t6417-merge-ours-theirs | Full | T/merge-octopus-native.test.ts | |
| Branching | Strategy resolve | `merge -s resolve` | t7605-merge-resolve | Partial | results/merge-result.ts (`MergeStrategy.RESOLVE`) | No twin found. |
| Branching | Strategy subtree | `merge -s subtree`, `-X subtree=<path>` | t6409-merge-subtree | None | - | Listed in an error message only. |
| Branching | Favouring sides | `merge -X ours/theirs` | t6417-merge-ours-theirs | Full | T/merge-octopus-native.test.ts (`-X theirs`) | |
| Branching | Merge attributes | `-X renormalize`, `merge` attribute drivers (text, binary, union, custom), `conflict-marker-size` | t6406-merge-attr, t6418-merge-text-auto | Full | C/merge-drivers.ts; T/merge-attributes-native.test.ts | Custom drivers are callbacks. |
| Branching | Merge diff options | `-X ignore-space-change/ignore-all-space/ignore-cr-at-eol/patience/diff-algorithm/find-renames/rename-threshold/no-renames` | t6432-merge-recursive-space-options, t6434-merge-recursive-rename-options, t7615-diff-algo-with-mergy-operations | None | - | |
| Branching | Conflict style | `merge.conflictStyle=diff3/zdiff3` | t6427-diff3-conflict-markers | Full | T/merge-dataloss-native.test.ts, T/checkout-paths-native.test.ts | |
| Branching | Autostash | `merge --autostash` | t7600-merge | Full | T/merge-dirty-fuzz-native.test.ts | |
| Branching | Unrelated histories | `merge --allow-unrelated-histories` | t7600-merge | Partial | C/merge-command.ts (`setAllowUnrelatedHistories`) | Used in fixtures; no twin of the refusal found. |
| Branching | Merge hooks | pre-merge-commit, prepare-commit-msg, commit-msg, post-merge, `--no-verify` | t7503-pre-commit-and-pre-merge-commit-hooks, t5402-post-merge-hook | Full | T/hooks-checkout-merge-native.test.ts | |
| Branching | Merge log/sign | `merge --log`/`merge.log`, `--signoff`, `--verify-signatures`, `-S` | t7608-merge-messages, t7614-merge-signoff, t7612-merge-verify-signatures | None | - | |
| Branching | Dirty-tree safety | refusals over local changes, untracked files | t6436-merge-overwrite, t7607-merge-state | Full | T/merge-dirty-fuzz-native.test.ts, T/merge-dataloss-native.test.ts | |
| Branching | Tag create | `git tag <name>`, `-a`, `-m`, `-F` | t7004-tag | Full | C/tag-command.ts; T/message-cleanup-native.test.ts, T/switch-merge-native.test.ts | |
| Branching | Tag cleanup | `tag --cleanup`, several `-m` | t7004-tag | Full | T/message-cleanup-native.test.ts, T/switch-merge-native.test.ts | |
| Branching | Tag force / delete | `tag -f`, `tag -d` | t7004-tag | Partial | C/tag-command.ts (`setForce`, `DeleteTagCommand`) | Unit-tested only. |
| Branching | Tag listing | `tag -l <pattern>`, `--sort`, `-n<num>`, `--contains/--no-contains`, `--points-at`, `--merged`, `--format`, `--column` | t7004-tag | Partial | C/tag-command.ts (`ListTagCommand`) | Returns all tag refs; no filters, sorting or output. |
| Branching | Signed tags | `tag -s/-u`, `tag -v` | t7004-tag, t7030-verify-tag | None | C/tag-command.ts | `setSigned` only makes the tag annotated ("Signing is not implemented yet"). |
| Branching | Tag misc | `tag -e`, `--create-reflog`, `--trailer` | t7004-tag | None | - | |
| Branching | Stash push | `git stash [push]` | t3903-stash | Full | C/stash-create-command.ts; T/status-stash-native.test.ts | |
| Branching | Stash pathspec | `stash push -- <pathspec>` | t3903-stash | Full | T/stash-pathspec-native.test.ts | |
| Branching | Stash untracked/all | `stash push -u/-a` | t3905-stash-include-untracked | Full | T/status-stash-native.test.ts | |
| Branching | Stash staged | `stash push --staged` | t3903-stash | Full | T/stash-pathspec-native.test.ts | |
| Branching | Keep index | `stash push -k/--keep-index` | t3903-stash | Full | T/stash-pathspec-native.test.ts | |
| Branching | Stash patch | `stash push -p` | t3904-stash-patch | Full | T/add-patch-native.test.ts | |
| Branching | Stash message | `stash push -m` | t3903-stash | Full | T/message-cleanup-native.test.ts | |
| Branching | Stash pathspec file | `stash push --pathspec-from-file` | t3909-stash-pathspec-file | None | - | |
| Branching | Stash apply | `stash apply [--index] [stash@{n}]` | t3903-stash | Full | C/stash-apply-command.ts; T/stash-apply-native.test.ts | Conflicts, untracked restore. |
| Branching | Stash pop | `stash pop` | t3903-stash | Partial | C/stash-apply-command.ts, C/stash-drop-command.ts | No pop command; apply then drop composes it (T/stash-missing-native.test.ts covers the shared error paths). |
| Branching | Stash drop/clear | `stash drop`, `stash clear` | t3903-stash | Full | C/stash-drop-command.ts; T/stash-missing-native.test.ts | |
| Branching | Stash list | `stash list [<log-options>]` | t3903-stash | Partial | C/stash-list-command.ts | Entries only; no log formatting. |
| Branching | Stash show | `stash show [-p/--stat/-u]` | t3907-stash-show-config | None | - | |
| Branching | Stash branch | `stash branch <name>` | t3903-stash | None | - | |
| Branching | Stash create/store | `stash create`, `stash store` | t3903-stash | Partial | C/stash-create-command.ts (`setRef`) | Create-and-store as one call; separate store not found. |
| Branching | Stash export/import | `stash export/import` (2.51+) | t3903-stash | None | - | |
| Branching | Notes basics | `notes add/append/show/list/edit/copy/remove/get-ref` | t3301-notes | Full | C/notes-command.ts, C/notes-commands.ts; T/notes-native.test.ts | |
| Branching | Notes prune | `notes prune` | t3306-notes-prune | Full | T/notes-native.test.ts | |
| Branching | Notes merge | `notes merge -s manual/ours/theirs/union/cat_sort_uniq`, `--commit/--abort` | t3308-notes-merge, t3309-notes-merge-auto-resolve, t3310-notes-merge-manual-resolve | Full | C/notes-merge-command.ts; T/notes-native.test.ts | |
| Branching | Notes fanout | fanout growth/shrink | t3305-notes-fanout, t3311-notes-merge-fanout | Full | C/notes-tree.ts; T/notes-native.test.ts | |
| Branching | Notes rewrite | `notes.rewriteRef`, `notes.rewrite.<cmd>`, `--for-rewrite` | t3301-notes | Full | T/notes-native.test.ts | |
| Branching | Notes stripspace/separator | `--[no-]stripspace`, `--[no-]separator`, `-C/-c` | t3321-notes-stripspace | Full | T/notes-native.test.ts | |
| Rewriting | Rebase | `git rebase <upstream>` (merge backend) | t3400-rebase, t3421-rebase-topology-linear | Full | C/rebase-command.ts; T/rebase-worktree-native.test.ts, T/rebase-upstream-native.test.ts | |
| Rewriting | Rebase control | `rebase --continue/--skip/--abort` | t3403-rebase-skip, t3407-rebase-abort, t3418-rebase-continue | Full | T/rebase-worktree-native.test.ts | Each side resumes the other's rebase. |
| Rewriting | Rebase quit | `rebase --quit` | t3407-rebase-abort | None | - | |
| Rewriting | Rebase show patch | `rebase --show-current-patch` | t3400-rebase | None | - | |
| Rewriting | Edit todo | `rebase --edit-todo` | t3404-rebase-interactive | Full | T/rebase-interactive-native.test.ts | |
| Rewriting | Interactive rebase | `rebase -i` (pick, reword, edit, squash, fixup [-C/-c], drop, exec, break) | t3404-rebase-interactive, t3437-rebase-fixup-options | Full | C/rebase-todo.ts; T/rebase-interactive-native.test.ts | Editor and sequence editor are callbacks. |
| Rewriting | Autosquash | `rebase --autosquash`, `rebase.autoSquash` | t3415-rebase-autosquash | Full | T/rebase-interactive-native.test.ts | |
| Rewriting | Exec | `rebase --exec`, `--reschedule-failed-exec` | t3404-rebase-interactive | Full | T/rebase-interactive-native.test.ts | Commands run through a handler. |
| Rewriting | Update refs | `rebase --update-refs`, `update-ref` todo | t3404-rebase-interactive | Full | T/rebase-interactive-native.test.ts | |
| Rewriting | Rebase merges | `rebase --rebase-merges[=rebase-cousins]` (label, reset, merge) | t3430-rebase-merges | Full | T/rebase-merges-native.test.ts | |
| Rewriting | Root rebase | `rebase --root [--onto]` | t3412-rebase-root | Full | T/rebase-interactive-native.test.ts | |
| Rewriting | Onto | `rebase --onto <newbase> <upstream>` | t3416-rebase-onto-threedots | ? | C/rebase-command.ts | Only `--root --onto` found; no setter separating onto from upstream. |
| Rewriting | Fork point / keep base | `rebase --fork-point`, `--keep-base` | t3431-rebase-fork-point, t3416-rebase-onto-threedots | None | - | |
| Rewriting | Rebase autostash | `rebase --autostash` | t3420-rebase-autostash | Full | T/merge-dirty-fuzz-native.test.ts | |
| Rewriting | Empty / cherry-picked commits | `--empty=drop/keep/stop`, `--[no-]keep-empty`, `--reapply-cherry-picks` | t3424-rebase-empty, t3419-rebase-patch-id | Full | T/rebase-interactive-native.test.ts, T/rebase-patch-id-native.test.ts | |
| Rewriting | Dates and sign-off | `--committer-date-is-author-date`, `--ignore-date`, `--signoff` | t3436-rebase-more-options, t3428-rebase-signoff | Partial | C/rebase-command.ts | `--signoff` twin-tested (T/rebase-interactive-native.test.ts, T/rebase-merges-native.test.ts); date options not found in rebase twins. |
| Rewriting | Rebase strategies | `rebase -s`, `-X` | t3402-rebase-merge | Partial | C/rebase-command.ts (`setStrategy`, `setContentMergeStrategy`) | |
| Rewriting | Apply backend | `rebase --apply`, `--whitespace`, `-C<n>`, `--ignore-whitespace` | t3417-rebase-whitespace-fix, t3436-rebase-more-options | None | - | Merge backend only. |
| Rewriting | Signed rebase | `rebase -S` | t3435-rebase-gpg-sign | None | - | |
| Rewriting | Rebase trailers | `rebase --trailer` | t3440-rebase-trailer | None | - | |
| Rewriting | Todo formatting | `rebase.instructionFormat`, `rebase.abbreviateCommands`, `rebase.missingCommitsCheck` | t3404-rebase-interactive | Full | T/rebase-instruction-format-native.test.ts, T/rebase-interactive-native.test.ts | |
| Rewriting | Rebase hooks | pre-rebase, post-rewrite, `--no-verify` | t3413-rebase-hook, t5407-post-rewrite-hook | Full | T/hooks-rebase-native.test.ts | |
| Rewriting | Cherry-pick | `git cherry-pick <commit>...`, ranges | t3501-revert-cherry-pick, t3508-cherry-pick-many-commits, t3510-cherry-pick-sequence | Full | C/cherry-pick-command.ts, C/sequencer-pick.ts; T/cherry-pick-revert-native.test.ts | |
| Rewriting | Pick sequence control | `cherry-pick --continue/--skip/--abort` | t3510-cherry-pick-sequence | Full | T/cherry-pick-revert-native.test.ts | |
| Rewriting | Pick quit | `cherry-pick --quit`, `revert --quit` | t3510-cherry-pick-sequence | None | C/sequencer-pick.ts | Operations are start/continue/skip/abort. |
| Rewriting | No commit | `cherry-pick -n` | t3501-revert-cherry-pick | Full | T/cherry-pick-revert-native.test.ts, T/merge-index-native.test.ts | |
| Rewriting | Edit | `cherry-pick -e`, `revert -e` | t3501-revert-cherry-pick | Full | T/hooks-pick-edit-native.test.ts | |
| Rewriting | Mainline | `cherry-pick -m <n>`, `revert -m <n>` | t3502-cherry-pick-merge | Partial | C/cherry-pick-command.ts (`setMainlineParentNumber`); T/cherry-pick-command.test.ts | Unit-tested only. |
| Rewriting | Pick strategies | `cherry-pick -s/-X` | t3501-revert-cherry-pick | Partial | C/cherry-pick-command.ts (`setStrategy`, `setContentMergeStrategy`) | Merge fuzz covers cherry-pick with default strategy. |
| Rewriting | Pick provenance | `cherry-pick -x`, `-s/--signoff` | t3511-cherry-pick-x | None | - | |
| Rewriting | Pick empties / ff | `--allow-empty`, `--allow-empty-message`, `--keep-redundant-commits`, `--empty=`, `--ff` | t3505-cherry-pick-empty, t3506-cherry-pick-ff | None | - | |
| Rewriting | Signed picks | `cherry-pick -S`, `revert -S` | t3514-cherry-pick-revert-gpg | None | - | |
| Rewriting | Revert | `git revert <commit>...`, `-n`, `--continue/--skip/--abort` | t3501-revert-cherry-pick | Full | C/revert-command.ts; T/cherry-pick-revert-native.test.ts | |
| Rewriting | Revert extras | `revert --reference`, `-s/--signoff` | t3501-revert-cherry-pick | None | - | (`revert -m` is in the Mainline row.) |
| Rewriting | Apply mailbox | `git am <mbox>` | t4150-am | Full | C/am/am-command.ts; T/am-native.test.ts | |
| Rewriting | am control | `am --continue/--skip/--abort/--quit/--allow-empty/--resolved` | t4151-am-abort | Full | T/am-native.test.ts | |
| Rewriting | am three-way | `am -3` | t4150-am | Full | T/am-native.test.ts | |
| Rewriting | am message options | `am -s`, `-k`, `--keep-non-patch`, `-q`, `-m/--message-id`, `-c/--scissors`, `--keep-cr` | t4150-am, t4253-am-keep-cr-dos, t4252-am-options | Partial | C/am/am-command.ts | `-s -k` and `-q -m` appear in twins; `--scissors`/`--keep-cr` covered at mailinfo level (T/mailinfo-native.test.ts). |
| Rewriting | am dates | `am --committer-date-is-author-date`, `--ignore-date` | t4150-am | Full | T/am-native.test.ts | |
| Rewriting | Patch formats | `am --patch-format=mbox/mboxrd/stgit/hg`, `--mboxrd` | t4150-am | Full | T/am-native.test.ts | StGit series refused as git refuses them. |
| Rewriting | am hooks | applypatch-msg, pre-applypatch, post-applypatch, `--no-verify` | t4150-am | Full | T/hooks-am-native.test.ts | |
| Rewriting | am apply options | `am --whitespace/-C/-p/--directory/--exclude/--include/--reject/--ignore-whitespace` | t4252-am-options | Partial | C/am/am-command.ts (`setApplyOptions`) | Passed to ApplyCommand; not twin-tested through am. |
| Rewriting | am interactive | `am -i` | t4257-am-interactive | None | - | |
| Rewriting | am show patch | `am --show-current-patch[=diff/raw]` | t4150-am | None | - | Hint text only. |
| Rewriting | am misc | `am -S`, `--quoted-cr`, `--empty=` | t4258-am-quoted-cr | Partial | C/am/am-command.ts (`setEmpty`) | `--empty=` setter; quoted-cr and signing not found. |
| Rewriting | Apply patch | `git apply` | t4102-apply-rename, t4117-apply-reject, t4105-apply-fuzz | Full | C/apply/; T/apply-native.test.ts | Random drifted-tree differential tests. |
| Rewriting | apply reports | `apply --check/--stat/--numstat/--summary/-z` | t4100-apply-stat, t4136-apply-check | Full | T/apply-native.test.ts | |
| Rewriting | apply targets | `apply --index/--cached/--3way/-N` | t4108-apply-threeway, t4140-apply-ita | Full | T/apply-native.test.ts | |
| Rewriting | apply path options | `-R`, `--reject`, `-p<n>`, `--directory`, `--include/--exclude`, `-C<n>`, `--unidiff-zero`, `--recount`, `--inaccurate-eof`, `--allow-overlap`, `--unsafe-paths` | t4116-apply-reverse, t4117-apply-reject, t4111-apply-subdir | Full | T/apply-native.test.ts | |
| Rewriting | apply whitespace | `apply --whitespace=nowarn/warn/fix/error[-all]`, `--ignore-whitespace` | t4124-apply-ws-rule, t4107-apply-ignore-whitespace | Full | C/apply/whitespace.ts; T/apply-native.test.ts | |
| Rewriting | apply binary & submodules | binary patches, symlinks, gitlinks | t4103-apply-binary, t4137-apply-submodule | Full | T/apply-native.test.ts | |
| Rewriting | Format patches | `git format-patch <range>` | t4014-format-patch | Full | C/format-patch-command.ts; T/format-patch-native.test.ts | Mails compared byte for byte. |
| Rewriting | Numbering & subjects | `-n/-N`, `--start-number`, `--subject-prefix`, `--rfc`, `-v<n>`, `-k` | t4021-format-patch-numbered, t4014-format-patch | Full | T/format-patch-native.test.ts | |
| Rewriting | Cover letter | `--cover-letter` (shortlog + diffstat) | t4014-format-patch | Full | T/format-patch-native.test.ts | |
| Rewriting | Threading & headers | `--thread`, `--in-reply-to`, `--to/--cc/--add-header/--from`, `--signature`, `format.*` | t4014-format-patch | Full | T/format-patch-native.test.ts | |
| Rewriting | Output files | `-o`, `--stdout`, `--suffix`, `--numbered-files`, `--filename-max-length`, `--zero-commit`, `--base`, `--no-binary`, `--root` | t4014-format-patch | Full | T/format-patch-native.test.ts | |
| Rewriting | Email header encoding | `--encode-email-headers`, `format.encodeEmailHeaders` | t4014-format-patch | Full | T/format-patch-native.test.ts | Via configuration. |
| Rewriting | format-patch sign-off | `format-patch -s` | t4014-format-patch | Partial | C/format-patch-command.ts (`setSignoff`) | |
| Rewriting | MIME attachments | `--attach`, `--inline` | t4014-format-patch, t4028-format-patch-mime-headers | None | - | |
| Rewriting | Range/inter diff | `--range-diff`, `--interdiff` | t4014-format-patch | None | - | |
| Rewriting | Other format-patch | `--notes`, `--cover-from-description`, `--ignore-if-in-upstream`, `--progress` | t4014-format-patch | None | - | |
| Rewriting | History command | `git history reword/split/fixup/drop/squash` (new) | t3450-history, t3451-history-reword, t3452-history-split | None | - | |
| Rewriting | Filter branch | `git filter-branch` | t7003-filter-branch | None | - | |
| Rewriting | Replace objects (honoured) | replace refs and grafts in walks, `--no-replace-objects` | t6050-replace, t6001-rev-list-graft | Full | T/replace-grafts-native.test.ts | Read side only. |
| Rewriting | Replace command | `git replace [-f] <obj> <repl>`, `-d`, `-l`, `--edit`, `--graft`, `--convert-graft-file` | t6050-replace | None | - | No command to create replace refs. |
| Inspection | Log | `git log` default output | t4202-log | Full | C/log-command.ts, C/log-output.ts; T/log-output-native.test.ts | `callBytes`/`callText`. |
| Inspection | Pretty formats | `--pretty=oneline/short/medium/full/fuller/reference/email/mboxrd/raw`, `--oneline` | t4205-log-pretty-formats | Full | C/pretty-format.ts; T/log-output-native.test.ts | |
| Inspection | User formats | `--format=` placeholders, padding, `%(trailers)`, `%(describe)`, `%G?` | t4205-log-pretty-formats, t6006-rev-list-format | Full | T/pretty-format-native.test.ts, T/pretty-format-trailers-native.test.ts | |
| Inspection | Dates | `--date=relative/iso/iso-strict/rfc/short/raw/unix/human/local/format:` | t0006-date, t4202-log | Full | C/date-format.ts; T/log-output-native.test.ts | |
| Inspection | Decorations | `--decorate[=short/full]`, `--decorate-refs[-exclude]`, `--clear-decorations` | t4202-log, t4207-log-decoration-colors | Full | T/log-output-native.test.ts, T/pretty-format-native.test.ts | |
| Inspection | Graph | `log --graph` | t4214-log-graph-octopus, t4215-log-skewed-merges, t4218-log-graph-indentation | Full | C/log-graph.ts; T/log-output-native.test.ts | |
| Inspection | Patches in log | `-p`, `--stat`, `--numstat`, `--shortstat`, `--name-only`, `--name-status` | t4013-diff-various | Full | T/log-output-native.test.ts, T/log-diff-trees-native.test.ts | |
| Inspection | Merge diffs | `-m`, `-c`, `--cc`, `--diff-merges=`, `--first-parent` | t4013-diff-various | Full | T/log-output-native.test.ts | |
| Inspection | Remerge diff | `--remerge-diff` | t4069-remerge-diff | None | - | |
| Inspection | Limiting | `-n`, `--skip`, `--reverse`, `--no-merges`, `--merges`, `--min/max-parents` | t4202-log, t6009-rev-list-parent | Full | T/log-output-native.test.ts, T/revision-syntax-native.test.ts | `--merges` via `RevFilter.ONLY_MERGES`. |
| Inspection | Path limiting | `log -- <path>`, history simplification, `--full-history` | t6012-rev-list-simplify, t6111-rev-list-treesame | Full | T/log-path-native.test.ts, T/log-range-fuzz-native.test.ts | |
| Inspection | Follow renames | `log --follow` | t4206-log-follow-harder-copies, t4219-log-follow-merge | Full | T/log-output-native.test.ts | |
| Inspection | Ranges | `A..B`, `A...B`, `^A`, `--not`, `--all` | t6000-rev-list-misc, t6018-rev-list-glob | Full | T/log-range-fuzz-native.test.ts, T/revision-args-native.test.ts | |
| Inspection | Ref globs | `--branches`, `--tags`, `--remotes`, `--glob`, `--exclude`, `--stdin` | t6018-rev-list-glob | ? | C/revision-range.ts | Not found in twins. |
| Inspection | Date limits | `--since`, `--until` | t4217-log-limit | Full | T/log-range-fuzz-native.test.ts | |
| Inspection | Author/committer filter | `--author`, `--committer` | t4202-log | Partial | C/log-command.ts (`setAuthorFilter`, `setCommitterFilter`) | No twin. |
| Inspection | Message grep | `--grep`, `--invert-grep`, `--all-match`, `-i`, `-E/-F/-P` | t4202-log, t7810-grep | None | - | |
| Inspection | Pickaxe | `-S`, `-G`, `--pickaxe-regex`, `--pickaxe-all`, `--find-object` | t4209-log-pickaxe, t4062-diff-pickaxe, t4064-diff-oidfind | None | - | |
| Inspection | Line log | `log -L <range>:<file>`, `-L :func:file` | t4211-line-log | None | - | |
| Inspection | Symmetric-difference marks | `--left-right`, `--cherry-pick`, `--cherry-mark`, `--cherry`, `--boundary` | t6007-rev-list-cherry-pick-file | None | - | Patch-ids exist (C/patch-id.ts) for rebase only. |
| Inspection | Advanced simplification | `--ancestry-path`, `--simplify-by-decoration`, `--simplify-merges`, `--dense/--sparse` | t6019-rev-list-ancestry-path, t6016-rev-list-graph-simplify-history | None | - | |
| Inspection | Reflog walk | `log -g/--walk-reflogs` | t1411-reflog-show, t1414-reflog-walk | None | - | |
| Inspection | Ordering | `--topo-order`, `--date-order`, `--author-date-order` | t6003-rev-list-topo-order | Partial | C/log-command.ts | `--topo-order` twin-tested; the others not found. |
| Inspection | Notes & mailmap in log | `--notes[=ref]`, `--no-notes`, `--[no-]mailmap`, `log.mailmap` | t4203-mailmap, t3301-notes | Full | C/mailmap.ts; T/log-output-native.test.ts, T/notes-native.test.ts | |
| Inspection | Abbreviation | `--abbrev-commit`, `--abbrev=`, `--no-abbrev`, `core.abbrev` | t4202-log | Full | T/log-output-native.test.ts, T/abbrev-native.test.ts | |
| Inspection | Source / signatures / color | `--source`, `--show-signature`, `--color` | t4202-log | None | - | `%C` colour placeholders are supported in formats. |
| Inspection | Bloom filters | changed-path filters in path-limited log | t4216-log-bloom | Full | T/log-path-native.test.ts | |
| Inspection | whatchanged | `git whatchanged` | t4013-diff-various | None | - | Deprecated in git. |
| Inspection | Show commit | `git show <commit>` | t7007-show | Partial | C/log-command.ts; C/bisect/bisect-command.ts | No ShowCommand; `log -1 -p` gives it; bisect's `git show --stat --summary` is twin-tested (T/bisect-native.test.ts). |
| Inspection | Show objects | `git show <blob>`, `<tree>`, `<tag>`, `<rev>:<path>` | t7007-show | None | - | Objects are readable through the History API. |
| Inspection | Diff | `git diff` (worktree, `--cached`, `A`, `A B`) | t4013-diff-various, t4000-diff-format | Full | C/diff-command.ts, results/diff-output.ts; T/diff-output-native.test.ts | Byte-for-byte random repositories. |
| Inspection | Diff formats | patch, `--stat[=w,n,c]`, `--numstat`, `--shortstat`, `--name-only`, `--name-status`, `--summary`, `--raw` | t4052-stat-output, t4049-diff-stat-count, t4073-diff-stat-name-width | Full | T/diff-output-native.test.ts, T/diff-stat-width-native.test.ts | |
| Inspection | Dirstat | `--dirstat` | t4047-diff-dirstat | ? | C/diff-command.ts | Mentioned in the class docs; no twin found. |
| Inspection | Context | `-U<n>`, `--inter-hunk-context`, `-W/--function-context` | t4055-diff-context, t4032-diff-inter-hunk-context, t4051-diff-function-context | Full | T/diff-output-native.test.ts | |
| Inspection | Whitespace | `-w`, `-b`, `--ignore-space-at-eol`, `--ignore-cr-at-eol`, `--ignore-blank-lines` | t4015-diff-whitespace | Full | vcs-utils xdiff; T/diff-output-native.test.ts | |
| Inspection | Ignore matching lines | `-I<regex>` | t4013-diff-various | None | - | |
| Inspection | Algorithms | `--diff-algorithm=myers/minimal/patience/histogram`, `--[no-]indent-heuristic` | t4033-diff-patience, t4050-diff-histogram, t4061-diff-indent, t4071-diff-minimal | Full | T/diff-output-native.test.ts, vcs-utils/tests/diff/text-diff/unified-diff-fuzz-native.test.ts | |
| Inspection | Anchored | `--anchored=<text>` | t4065-diff-anchored | ? | vcs-utils xdiff-patience.ts | Not found as an option. |
| Inspection | Renames | `-M[<n>]`, `--no-renames`, `diff.renames`, `-l` | t4001-diff-rename, t4005-diff-rename-2 | Full | vcs-commands/src/rename/; T/diff-output-native.test.ts, T/git-similarity-native.test.ts | |
| Inspection | Copies / breaks | `-C`, `--find-copies-harder`, `-B` | t4008-diff-break-rewrite, t4009-diff-rename-4 | Partial | C/diff-command.ts | Copies via `diff.renames=copies`; no twin found for `-C`/`-B`. |
| Inspection | Word diff | `--word-diff[=mode]`, `--color-words`, `--word-diff-regex` | t4034-diff-words | None | - | |
| Inspection | Colour | `--color`, `--color-moved[-ws]`, `color.diff.*` | t4015-diff-whitespace, t4026-color | None | - | |
| Inspection | Whitespace check | `--check`, `--ws-error-highlight` | t4019-diff-wserror | None | - | (`apply --whitespace` is Full.) |
| Inspection | Filters | `--diff-filter=`, `-R`, `--relative`, `-O<orderfile>`, `--skip-to/--rotate-to` | t4045-diff-relative, t4056-diff-order | Partial | C/diff-command.ts | `-O`/`diff.orderFile` Full (T/diff-config-native.test.ts); `-R` option exists; `--diff-filter`, `--relative`, `--skip-to` not found. |
| Inspection | Prefixes | `--no-prefix`, `--src/dst-prefix`, `--default-prefix`, `diff.mnemonicPrefix` | t4013-diff-various | Full | T/diff-config-native.test.ts | |
| Inspection | Drivers | textconv, `diff=<driver>`, `-diff`, funcname/xfuncname hunk headers | t4030-diff-textconv, t4018-diff-funcname | Full | C/diff-textconv.ts; T/diff-config-native.test.ts, T/diff-output-native.test.ts | |
| Inspection | Binary / index lines | `--binary`, `--full-index`, `--abbrev` | t4012-diff-binary, t4044-diff-index-unique-abbrev | Full | results/binary-patch.ts; T/abbrev-native.test.ts, T/diff-output-native.test.ts | |
| Inspection | Submodule diffs | `--submodule=short/log/diff`, `--ignore-submodules` | t4041-diff-submodule-option, t4060-diff-submodule-option-diff-format | Full | C/submodule-summary.ts; T/submodule-summary-native.test.ts | |
| Inspection | Combined diff | conflicted paths, `--cc` | t4038-diff-combined | Full | results/combined-diff.ts; T/diff-config-native.test.ts | |
| Inspection | No-index diff | `diff --no-index a b` | t4053-diff-no-index | Full | results/diff-output.ts (`formatNoIndexDiff`); T/diff-output-native.test.ts | |
| Inspection | Exit status | `--quiet`, `--exit-code` | t4017-diff-retval, t4035-diff-quiet | ? | - | Not found. |
| Inspection | Merge base | `diff --merge-base`, `diff A...B` | t4068-diff-symmetric-merge-base | ? | - | Not verified. |
| Inspection | External diff | `GIT_EXTERNAL_DIFF`, `diff.external`, `--ext-diff` | t4020-diff-external | None | - | |
| Inspection | Difftool | `git difftool` | t7800-difftool | N/A | - | Launches external tools. |
| Inspection | Range diff | `git range-diff` | t3206-range-diff | None | - | |
| Inspection | Shortlog | `git shortlog [-s/-n/-e/-c/--group]` | t4201-shortlog | None | C/format-patch-command.ts | Only the cover letter's internal shortlog. |
| Inspection | Describe | `git describe` | t6120-describe | Partial | C/describe-command.ts; T/describe-command.test.ts | No twin of `git describe`; `%(describe)` is twin-tested (T/pretty-format-trailers-native.test.ts). |
| Inspection | Describe options | `--tags`, `--all`, `--long`, `--abbrev`, `--match`, `--exclude`, `--always`, `--candidates` | t6120-describe | Partial | C/describe-command.ts | Setters with unit tests. |
| Inspection | Describe extras | `--dirty`, `--broken`, `--contains`, `--first-parent`, `--exact-match` | t6120-describe | None | - | |
| Inspection | Blame | `git blame <file>` | t8002-blame, t8003-blame-corner-cases | Full | C/blame-command.ts; T/blame-native.test.ts | Random-history differential. |
| Inspection | Blame formats | `--porcelain`, `--line-porcelain`, default output | t8008-blame-formats | Full | results/blame-format.ts; T/blame-native.test.ts | |
| Inspection | Blame output flags | `-s`, `-e`, `-l`, `-t`, `-n`, `-f`, `-b`, `--abbrev` | t8008-blame-formats | Partial | results/blame-format.ts (`BlameFormatOptions`) | Options exist; no twin found. |
| Inspection | Blame range & options | `-L`, `-w`, `--root`, `--diff-algorithm` | t8002-blame, t8015-blame-diff-algorithm | Full | T/blame-native.test.ts | |
| Inspection | Blame moves/copies | `-M`, `-C`, `--reverse`, `--ignore-rev(s-file)`, mailmap | t8013-blame-ignore-revs, t8014-blame-ignore-fuzzy | None | C/blame-command.ts | Documented as unsupported. |
| Inspection | Blame misc | `--incremental`, `--contents`, `--since`, `--first-parent`, `--date`, colour | t8012-blame-colors | None | - | |
| Inspection | Annotate | `git annotate` | t8001-annotate | None | - | |
| Inspection | Grep | `git grep` | t7810-grep, t7814-grep-recurse-submodules | None | - | |
| Inspection | Bisect | `bisect start/good/bad/new/old/skip/next/reset/terms/log/replay` | t6030-bisect-porcelain | Full | C/bisect/; T/bisect-native.test.ts | Step-by-step twins over random histories. |
| Inspection | Bisect run | `bisect run <cmd>` | t6030-bisect-porcelain | Full | C/bisect/bisect-command.ts; T/bisect-native.test.ts | Command through a handler. |
| Inspection | Bisect options | custom terms, `--no-checkout`, `--first-parent`, paths | t6030-bisect-porcelain | Full | T/bisect-native.test.ts | |
| Inspection | Bisect visualize | `bisect visualize/view` | t6030-bisect-porcelain | N/A | C/bisect/bisect-command.ts | Starts gitk or `git log`. |
| Inspection | Show branch | `git show-branch` | t3202-show-branch | None | - | |
| Inspection | Merge tree | `git merge-tree --write-tree [--messages]` | t4301-merge-tree-write-tree | Partial | C/ort-merge.ts | Engine compared with native `merge-tree --write-tree --messages` (T/merge-ort-rename-fuzz-native.test.ts); no command. |
| Inspection | Trivial merge-tree | `git merge-tree <base> <a> <b>` (old mode) | t4300-merge-tree | None | - | |
| Inspection | Rerere | `git rerere`, `rerere.enabled` | t4200-rerere, t3504-cherry-pick-rerere | None | - | |
| Sharing | Fetch | `git fetch [<remote>] [<refspec>]` | t5510-fetch | Full | C/fetch-command.ts; T/clone-fetch-native-git.test.ts, T/fetch-local-native.test.ts, T/remote-fetch-native-git.test.ts | |
| Sharing | Refspecs | configured/explicit refspecs, opportunistic update, `--refmap`, negative refspecs | t5510-fetch, t5582-fetch-negative-refspec | Full | T/remote-fetch-native-git.test.ts | Negative refspecs not verified separately. |
| Sharing | Prune | `fetch --prune`, `--prune-tags`, `fetch.prune` | t5510-fetch | Full | T/remote-fetch-native-git.test.ts | |
| Sharing | Tags | `fetch --tags/--no-tags`, auto-following | t5503-tagfollow, t5525-fetch-tagopt | Full | T/fetch-reflog-flags-native.test.ts, T/clone-initial-transaction-native.test.ts | |
| Sharing | Shallow fetch | `--depth`, `--deepen`, `--shallow-since/exclude`, `--unshallow`, `--update-shallow` | t5537-fetch-shallow, t5500-fetch-pack | Full | T/serve-shallow-native.test.ts, T/fetch-connectivity-native.test.ts | |
| Sharing | Partial fetch | `fetch --filter`, `--refetch`, lazy fetch | t5616-partial-clone, t0410-partial-clone | Full | C/promisor-remote.ts; T/partial-clone-lazy-native.test.ts | |
| Sharing | Fetch flags | `-f`, `--update-head-ok`, `--append`, `--dry-run`, `--atomic`, `--porcelain`, `--[no-]write-fetch-head` | t5510-fetch, t5574-fetch-output | Partial | C/fetch-command.ts | Setters exist; FETCH_HEAD and `--prune --force` reflogs twin-tested, the rest not found. |
| Sharing | Fetch output | ref lines, summary width, abbreviation | t5574-fetch-output | Full | T/transport-summary-abbrev-native.test.ts | |
| Sharing | Commit-graph after fetch | `--write-commit-graph`, `fetch.writeCommitGraph` | t5510-fetch | Full | T/fetch-commit-graph-native.test.ts | |
| Sharing | Fetch checks | connectivity, `fetch.fsckObjects`, `fetch.fsck.*` | t5504-fetch-receive-strict | Full | C/fsck/fetch-fsck.ts; T/fetch-connectivity-native.test.ts | |
| Sharing | Remote HEAD | `fetch.followRemoteHEAD`, `remote.<n>.followRemoteHEAD` | t5510-fetch | Full | T/remote-fetch-native-git.test.ts | 2.48+ behaviour. |
| Sharing | Reflog messages | fetch/pull reflog action strings | t5510-fetch | Full | T/fetch-reflog-flags-native.test.ts | |
| Sharing | Multiple remotes | `fetch --all`, `--multiple`, remote groups, `-j/--jobs`, `fetch.parallel` | t5514-fetch-multiple, t5506-remote-groups | None | - | |
| Sharing | Fetch submodules | `fetch --recurse-submodules` | t5526-fetch-submodules | None | - | |
| Sharing | Negotiation | `--negotiation-tip`, `fetch.negotiationAlgorithm=skipping/noop` | t5552-skipping-fetch-negotiator, t5554-noop-fetch-negotiator | None | - | Default negotiation only. |
| Sharing | Set upstream on fetch | `fetch --set-upstream` | t5553-set-upstream | None | - | |
| Sharing | Pull | `git pull` (merge) | t5520-pull | Full | C/pull-command.ts; T/pull-worktree-native.test.ts, T/clone-fetch-native-git.test.ts | |
| Sharing | Pull rebase | `pull --rebase`, `pull.rebase` | t5520-pull | Full | T/pull-worktree-native.test.ts | |
| Sharing | Pull ff modes | `pull --ff-only/--no-ff`, `pull.ff` | t5520-pull, t7601-merge-pull-config | Full | T/fetch-reflog-flags-native.test.ts | |
| Sharing | Pull autostash / strategy | `pull --autostash`, `-s`, `-X` | t5520-pull | Partial | C/pull-command.ts (`setAutoStash`, `setStrategy`) | |
| Sharing | Pull into unborn | pull on an unborn branch | t5520-pull | Partial | C/merge-command.ts (`callIntoVoid`) | Implemented per CLAUDE.md; no twin found. |
| Sharing | Pull extras | `pull --squash/--no-commit/--edit/--log/--signoff/--verify-signatures/--recurse-submodules/--depth/--all` | t5521-pull-options, t5573-pull-verify-signatures, t5572-pull-submodule | None | - | |
| Sharing | Push | `git push [<remote>] [<refspec>]` | t5516-fetch-push | Full | C/push-command.ts; T/push-local-receive-native.test.ts, T/hooks-push-native.test.ts, T/git-native-protocol.test.ts | |
| Sharing | push.default | `simple/current/upstream/matching/nothing` | t5528-push-default | Partial | C/push-command.ts | Implemented; no twin found. |
| Sharing | Force push | `--force`, `+refspec`, `--force-with-lease` | t5533-push-cas | Partial | C/push-command.ts (`setForce`, `setForceWithLease`) | |
| Sharing | Atomic push | `push --atomic` | t5543-atomic-push | Full | T/proc-receive-native.test.ts | |
| Sharing | Delete / prune / all / tags / mirror | `--delete`, `:ref`, `--prune`, `--all/--branches`, `--tags`, `--mirror` | t5516-fetch-push, t5517-push-mirror | Partial | C/push-command.ts | Setters for prune/all/tags; deletion by refspec; `--mirror` via refspec only. |
| Sharing | Push output | `--porcelain`, `--dry-run`, ref status lines | t5548-push-porcelain, t5529-push-errors | Full | T/proc-receive-native.test.ts, T/transport-summary-abbrev-native.test.ts | |
| Sharing | Push options | `-o/--push-option` | t5545-push-options | Partial | C/push-command.ts (`setPushOptions`) | |
| Sharing | Pre-push | pre-push hook, `--no-verify` | t5571-pre-push-hook | Full | T/hooks-push-native.test.ts | |
| Sharing | Push to checked-out branch | `receive.denyCurrentBranch`, `updateInstead`, push-to-checkout | t5516-fetch-push | Full | T/push-local-receive-native.test.ts, T/hooks-push-native.test.ts | |
| Sharing | Push URL rewriting | `pushInsteadOf`, `protocol.allow` | t5516-fetch-push | Full | T/remote-url-rewrite-native.test.ts | |
| Sharing | Default push remote | `branch.<name>.pushRemote`, `remote.pushDefault`, `branch.<name>.remote` | t5516-fetch-push | None | C/push-command.ts | `push()` without `setRemote` always pushes to `origin`; `remote.pushDefault` is read only by `@{push}` and remote rename/remove (statewalker/webrun-vcs#219). |
| Sharing | Set upstream on push | `push -u/--set-upstream` | t5523-push-upstream | None | - | |
| Sharing | Push misc | `--follow-tags`, `--signed`, `--recurse-submodules`, `--force-if-includes` | t5516-fetch-push, t5534-push-signed, t5531-deep-submodule-push | None | - | |
| Sharing | Remote add | `git remote add <name> <url>` | t5505-remote | Partial | C/remote-command.ts; T/remote-command.test.ts | No twin; no `-f`, `-t`, `-m`, `--mirror`, `--tags`. |
| Sharing | Remote remove/rename | `remote remove`, `remote rename` | t5505-remote | Full | T/remote-fetch-native-git.test.ts | |
| Sharing | Remote set-head | `remote set-head [-a/-d/<branch>]` | t5505-remote | Full | T/remote-fetch-native-git.test.ts | |
| Sharing | Remote URLs | `remote get-url [--push/--all]`, `set-url [--push/--add/--delete]` | t5505-remote | Partial | C/remote-command.ts | `get-url` Full (T/remote-url-rewrite-native.test.ts); `set-url` unit-tested. |
| Sharing | Remote list | `git remote [-v]` | t5505-remote | Partial | C/remote-command.ts (`RemoteListCommand`) | Data only. |
| Sharing | Remote show/prune/update | `remote show`, `remote prune`, `remote update`, `remote set-branches` | t5505-remote | None | - | |
| Sharing | List remote refs | `git ls-remote [--heads/--tags/--get-url/--symref]` (plumbing, listed for context) | t5512-ls-remote | Full | C/ls-remote-command.ts; T/fetch-local-native.test.ts, T/bare-local-remote-native.test.ts | |
| Sharing | Submodule add | `git submodule add` | t7400-submodule-basic | None | - | |
| Sharing | Submodule init/deinit | `submodule init`, `deinit` | t7400-submodule-basic | None | - | |
| Sharing | Submodule update | `submodule update [--init/--recursive/--remote/--checkout/--rebase/--merge]` | t7406-submodule-update | None | - | |
| Sharing | Submodule status | `git submodule status` | t7400-submodule-basic | None | - | Submodule state shows in `status`/`diff`. |
| Sharing | Submodule summary | `git submodule summary` | t7401-submodule-summary, t7421-submodule-summary-add | Full | C/submodule-summary-command.ts; T/submodule-summary-native.test.ts | |
| Sharing | Submodule sync/foreach | `submodule sync`, `submodule foreach` | t7403-submodule-sync, t7407-submodule-foreach | None | - | |
| Sharing | Absorb git dirs | `submodule absorbgitdirs` | t7412-submodule-absorbgitdirs | None | - | |
| Sharing | Submodule config | `submodule set-url`, `set-branch` | t7419-submodule-set-branch, t7420-submodule-set-url | None | - | |
| Sharing | Gitlink awareness | submodules in add/mv/rm/status/diff/merge/apply | t7506-status-submodule, t6437-submodule-merge | Full | T/add-native.test.ts, T/mv-native.test.ts, T/rm-pathspec-native.test.ts, T/status-gaps-native.test.ts, T/apply-native.test.ts | |
| Sharing | Bundles | `git bundle create/verify/list-heads/unbundle` | t6020-bundle-misc, t5607-clone-bundle | None | - | |
| Sharing | Bundle URIs | `clone --bundle-uri`, `bundle-uri` capability | t5558-clone-bundle-uri, t5730-protocol-v2-bundle-uri-file | None | - | |
| Sharing | Archive | `git archive --format=tar/zip/tgz`, `--prefix`, `--add-file`, `export-ignore`/`export-subst`, `--remote` | t5000-tar-tree, t5003-archive-zip, t5001-archive-attr | None | - | |
| Maintenance | Garbage collection | `git gc` | t6500-gc | Partial | C/gc-command.ts; SFT/repack-gc.git.test.ts, SFT/gc-orchestrator-roots.git.test.ts | Result validated by native fsck/count-objects/verify-pack and native gc, not compared byte for byte. |
| Maintenance | Auto gc | `gc --auto`, `gc.auto`, `gc.autoPackLimit`, pre-auto-gc | t6500-gc | Full | T/hooks-auto-gc-native.test.ts | |
| Maintenance | gc options | `gc --aggressive`, `--prune=<date>/--no-prune` | t6500-gc | Partial | C/gc-command.ts (`setAggressive`, `setExpire`) | |
| Maintenance | gc extras | `gc --cruft`, `--keep-largest-pack`, `--detach`, `--max-cruft-size` | t6500-gc | None | - | |
| Maintenance | gc reachability | keeps index/reflog/alternates/promisor objects | t6500-gc, t6501-freshen-objects | Full | T/alternates-native.test.ts, T/partial-clone-lazy-native.test.ts | |
| Maintenance | Maintenance | `git maintenance run/start/stop/register`, tasks | t7900-maintenance | None | - | |
| Maintenance | Repack | `git repack -a -d -l -f -F --window --depth -b --write-midx --filter` | t7700-repack, t7706-repack-drop-filtered | Partial | SF/repack.ts; SFT/repack-gc.git.test.ts, SFT/pack-bitmap.git.test.ts, T/alternates-native.test.ts | Library function, validated by native git; no CLI command class. |
| Maintenance | Repack modes | `repack --geometric`, `--cruft`, `-k`, `-A/--unpack-unreachable`, incremental midx | t7703-repack-geometric, t7704-repack-cruft, t7705-repack-incremental-midx | Partial | SF/repack.ts | `unpackUnreachable` only; geometric, cruft and incremental midx not found. |
| Maintenance | Prune | `git prune [--expire]` | t5304-prune | Partial | C/gc-command.ts | Through gc only; no standalone command. |
| Maintenance | Pack refs | `git pack-refs [--all/--auto/--no-prune]` | t0601-reffiles-pack-refs, t1409-avoid-packing-refs | Full | C/pack-refs-command.ts; T/packed-refs-native.test.ts, T/hooks-ref-transaction-native.test.ts | |
| Maintenance | Reflog show | `git reflog [show] <ref>` | t1411-reflog-show | Partial | C/reflog-command.ts | Entries as data; no `log -g` output. |
| Maintenance | Reflog written | reflog lines of every porcelain | t1410-reflog | Full | T/reflog-native.test.ts | |
| Maintenance | Reflog expire | `reflog expire [--expire/--all/--stale-fix]` | t1410-reflog | None | - | |
| Maintenance | Reflog delete | `reflog delete [--rewrite/--updateref]` | t1410-reflog | Partial | vcs-core history/refs/refs.ts (`deleteReflogEntry`) | Library only (stash drop uses it). |
| Maintenance | Reflog exists/write/drop | `reflog exists`, `write`, `drop` (2.5x) | t1418-reflog-exists, t1421-reflog-write | None | - | |
| Maintenance | Refs command | `git refs migrate/verify/list/exists/optimize/...` | t1460-refs-migrate, t1461-refs-list | None | - | Reftable unsupported. |
| Maintenance | Count objects | `git count-objects [-v/-H]` | t5301-sliding-window, t2200-add-update | None | - | |
| Maintenance | Check repository | `git fsck` | t1450-fsck | Full | C/fsck/fsck-command.ts; T/fsck-native.test.ts | Output in git's hash-table order. |
| Maintenance | fsck options | `--unreachable`, `--dangling`, `--root`, `--tags`, `--lost-found`, `--name-objects`, `--connectivity-only`, `--strict`, `--no-reflogs`, `fsck.<msg-id>` | t1450-fsck, t1420-lost-found | Full | T/fsck-native.test.ts, T/fsck-work-native.test.ts | |
| Maintenance | Backfill | `git backfill [--min-batch-size] [--sparse] [<rev>] [-- <path>]` | t5620-backfill | Full | C/backfill-command.ts; T/partial-clone-lazy-native.test.ts | |
| Maintenance | Fast export/import | `git fast-export`, `git fast-import` | t9350-fast-export, t9300-fast-import | None | - | |
| Maintenance | Mergetool | `git mergetool` | t7610-mergetool | N/A | - | Launches external tools. |
| Foreign | Subversion | `git svn` | t9100-git-svn-basic | None | - | |
| Foreign | Perforce | `git p4` | t9800-git-p4-basic | None | - | |
| Foreign | CVS | `git cvsimport`, `cvsexportcommit`, `cvsserver` | t9600-cvsimport, t9200-git-cvsexportcommit, t9400-git-cvsserver-server | None | - | |
| Foreign | Arch / quilt | `git archimport`, `git quiltimport` | - | None | - | |
| Foreign | Email | `git send-email`, `git imap-send` | t9001-send-email | None | - | `format-patch` output is Full. |
| Foreign | Pull request summary | `git request-pull` | t5150-request-pull | None | - | |
| Tools | GUIs | `git gui`, `git citool`, `gitk` | - | N/A | - | Tcl/Tk applications. |
| Tools | Help & diagnostics | `git help`, `git version`, `git bugreport`, `git diagnose` | t0012-help, t0091-bugreport, t0092-diagnose | N/A | - | CLI features of the git program, not of a library. |
| Tools | Instaweb | `git instaweb` | - | N/A | - | Starts gitweb behind a web server. |
| Servers | git daemon | `git daemon` (git://) | t5570-git-daemon | Partial | vcs-transport `serveGitConnection`; T/git-native-protocol.test.ts | Protocol server compared with the real daemon's answers and refusals; no daemon program (`--base-path`, `--export-all`, access hook). |
| Servers | Smart/dumb HTTP | `git http-backend` | t5560-http-backend-noserver, t5561-http-backend | Full | vcs-transport `createServedFetchHandler`; T/http-served-native.test.ts, T/http-dumb-native.test.ts | |
| Servers | Dumb-server info | `git update-server-info` | t5200-update-server-info | Partial | vcs-transport served handler | `info/refs` and `objects/info/packs` generated on request; no command writing the files. |
| Helpers (outside scope) | Hooks | `git hook run/list` | t1800-hook | Full | C/hook-command.ts; T/hooks-run-native.test.ts | purehelpers. |
| Helpers (outside scope) | Mail parsing | `git mailinfo`, `git mailsplit` | t5100-mailinfo | Full | C/am/mailinfo.ts; T/mailinfo-native.test.ts | purehelpers. |
| Helpers (outside scope) | Ignore/attribute queries | `git check-ignore`, `git check-attr` | t0008-ignores, t0003-attributes | Partial | vcs-working-tree ignore/attributes; T/ignore-fuzz-native.test.ts, T/attributes-fuzz-native.test.ts | Decisions twin-tested against these commands; no commands of ours. |
| Helpers (outside scope) | Trailers | `git interpret-trailers` | t7513-interpret-trailers | Partial | C/trailers.ts | Parsing (for `%(trailers)`) only; no adding or editing. |
| Helpers (outside scope) | Message cleanup | `git stripspace` | t0030-stripspace | Partial | C/message-cleanup.ts; T/message-cleanup-native.test.ts | Through commit/tag/merge cleanup. |
| Helpers (outside scope) | Patch ids | `git patch-id [--stable]` | t4204-patch-id | Partial | C/patch-id.ts; T/rebase-patch-id-native.test.ts | |
| Helpers (outside scope) | Mailmap query | `git check-mailmap` | t4203-mailmap | Partial | C/mailmap.ts | |
| Helpers (outside scope) | Credentials | `git credential`, `credential-cache`, `credential-store`, helpers | t0300-credentials, t0301-credential-cache, t0302-credential-store | None | vcs-commands/src/transport-command.ts | Credentials are passed programmatically; no helper protocol. |
| Helpers (outside scope) | Columns | `git column` | t9002-column | None | - | |
