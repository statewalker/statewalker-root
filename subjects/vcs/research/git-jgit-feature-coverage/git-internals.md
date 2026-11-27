# git lower-level functionality vs webrun-vcs

Sources: git master of 2026-11-19 (`command-list.txt`, `Documentation/gitformat-*`, `gitprotocol-*`,
`technical/*`, `githooks.adoc`, `gitattributes.adoc`, `gitignore.adoc`, `git.adoc`, `config/*.adoc`,
`t/`), and webrun-vcs `main` at `6e40444` (2026-11-27; `packages/*/src`, `packages/*/tests`, its
`CLAUDE.md`), re-surveyed 2026-11-27.

How to read the `webrun-vcs` column:

- **Full**: implemented and checked against native git by a native-twin or byte-comparison test
  (`*-native.test.ts`, `*.git.test.ts`, `*-real-git.test.ts`, `*oracle*`), spot-read.
- **Partial**: some of it exists; Notes say what is missing (or that only unit tests cover it).
- **None**: not found in the sources.
- **N/A**: does not apply to a library that runs in browsers and on servers (reason in Notes).
- **?**: could not tell from code and tests.

webrun-vcs is a library, not a `git` binary: plumbing is judged by **capability** (the function the
command performs, reachable through an API or inside a porcelain command), not by argv or CLI
output parity. Where only the porcelain exposes it, Notes say so. Evidence paths are relative to
`webrun-vcs/packages/`; `cmd/` stands for `vcs-commands/src/commands/`, `cmdt/` for
`vcs-commands/tests/`.

## Summary

341 rows. Counts per coverage value (section 6 splits into the sub-areas below it):

| Area | Rows | Full | Partial | None | N/A | ? |
|---|---|---|---|---|---|---|
| 1. Plumbing and helper commands | 86 | 73 | 5 | 4 | 4 | 0 |
| 2. Object and repository formats | 62 | 59 | 3 | 0 | 0 | 0 |
| 3. Protocols and transports | 49 | 45 | 2 | 1 | 1 | 0 |
| 4. Server side | 26 | 24 | 1 | 0 | 1 | 0 |
| 5. Hooks | 28 | 26 | 0 | 0 | 2 | 0 |
| 6. Subsystems (all) | 90 | 76 | 6 | 3 | 5 | 0 |
| — Config | 11 | 11 | 0 | 0 | 0 | 0 |
| — Attributes | 18 | 16 | 0 | 1 | 1 | 0 |
| — Ignore | 4 | 4 | 0 | 0 | 0 | 0 |
| — Environment variables | 21 | 16 | 2 | 1 | 2 | 0 |
| — Pathspec, revisions, sparse, untracked | 12 | 12 | 0 | 0 | 0 | 0 |
| — Safety | 6 | 5 | 0 | 0 | 1 | 0 |
| — Signing | 4 | 2 | 2 | 0 | 0 | 0 |
| — Fsmonitor, maintenance, misc | 14 | 10 | 2 | 1 | 1 | 0 |
| **Total** | **341** | **303** | **17** | **8** | **13** | **0** |

What the counts say: almost everything native git reads, writes and speaks is implemented and
twin-tested against native git (2.43 and 2.5x; git master, `$GIT3` in the tests, for what no
release has yet). That covers the storage formats (loose objects, packs, `.idx` v1/v2, `.rev`,
cruft packs with `.mtimes`, bitmaps incl. pseudo-merges, midx incl. incremental chains,
commit-graph incl. Bloom filters and split chains, index v2–v4 with its extensions, packed-refs,
reftable, reflogs, shallow, alternates, promisor packs, SHA-256 and compatObjectFormat), the pack
protocol v0/v1/v2 incl. packfile-uris, sideband-all, object-info, bundle-uri, promisor-remote,
want-ref, session ids and the three negotiators, the dumb-HTTP client and server, bundles,
archive, signed pushes, the receive side (quarantine, fsck, limits, namespaces, auto
maintenance, proc-receive, receive-report), every hook git runs outside git-p4 and send-email,
configuration, attributes, ignore rules, pathspecs, revisions, sparse checkout and index,
fsmonitor and `safe.directory`. Most plumbing commands exist as library commands with git's
options and output, checked against git's own t/ scripts; a few remain APIs only (Notes say so). Programs git would start (filter, textconv and
merge drivers, external diff, the sequence editor, credential helpers, ssh, signing and verification
programs) are host callbacks that receive the configured command; the twins run them as git does.

Remaining gaps (None or Partial):

1. **Signing formats**: x509 (`gpg.format=x509`, `gpgsm`) is configured but never tested;
   `verify-tag --format` is missing.
2. **Credential helpers**: helpers are callbacks with git's fill/approve/reject flow; the helper
   text protocol and the `credential.helper`/`credential.*` configuration are left to the host.
3. **Subprocess protocols**: no `filter.<d>.process` long-running protocol, no `ext::` transport,
   ssh is the host's `exec` (`GIT_SSH`, `GIT_SSH_COMMAND`, `ssh.variant` not read), and the commit
   message editor is a callback rather than `GIT_EDITOR`'s program.
4. **Maintenance scheduling**: `git maintenance run` works; `register`/`start`/`stop`/`--detach`
   (operating-system scheduling) are not implemented.
5. **Large object promisors, server side**: a server that is itself a partial clone does not fetch
   from its own promisor an object no client accepted.
6. **Smaller items**: `extensions.objectStorage` with a `files://<directory>` payload is refused;
   `GIT_REF_STORAGE_FORMAT` is not read; no `rev-list --disk-usage`; `merge-index` as a command
   (merge-one-file runs only inside the octopus strategy); EOIE/IEOT index extensions are never
   written; `core.precomposeUnicode` paths are not precomposed; no `http-push` (WebDAV), `column`,
   `unpack-file`, `pack-redundant`, Scalar, or `GIT_TRACE*`/trace2 output; the http-backend
   handler is a Fetch-API handler, not CGI.

## 1. Plumbing and helper commands

Every command of `command-list.txt` in the categories plumbingmanipulators, plumbinginterrogators,
synchelpers, purehelpers, and the server side of synchingrepositories, plus the ancillary commands
that are plumbing in practice (fsck, count-objects, replace, prune, repack, pack-refs, bundle, archive,
verify-commit/tag).

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Plumbing | apply a patch to worktree/index | git-apply | t4108, t4124, t4117 | Full | cmd/apply/apply-command.ts, cmd/apply/apply-engine.ts; cmdt/apply-native.test.ts | `--cached`/`--index`/`--3way`/`--reject`, whitespace rules, `verify_path`; also drives `add -p` and `am` |
| Plumbing | cat-file: read object content/type/size | git-cat-file | t1006, t8007, t8010 | Full | cmd/cat-file/cat-file-command.ts, cmd/cat-file/batch-format.ts; cmdt/cat-file-native.test.ts | t1006: `-t`/`-s`/`-e`/`-p`, `--batch`/`--batch-check`/`--batch-command` formats, `--batch-all-objects`, textconv and filters; `--batch` streams blobs |
| Plumbing | cat-file `--batch-command remote-object-info` | git-cat-file | t1017 | Full | vcs-transport/src/fetch-client/object-info.ts, cmd/remote-object-info-command.ts; cmdt/cat-file-remote-object-info-native.test.ts, cat-file-remote-object-info-git3-native.test.ts | v2 `object-info` client as git 2.56 (t1017, t5701); absent under 2.43 compatibility |
| Plumbing | check-attr | git-check-attr | t0003 | Full | vcs-working-tree/src/attributes/attributes-resolver.ts, cmd/check-attr-command.ts; cmdt/check-attr-native.test.ts, cmdt/attributes-fuzz-native.test.ts, cmdt/attr-source-native.test.ts | Attribute lookup and the command (`--all` in git's interning order) twin-tested |
| Plumbing | check-ignore | git-check-ignore | t0008 | Full | vcs-working-tree/src/ignore/ignore-manager.impl.ts, cmd/check-ignore-command.ts; cmdt/check-ignore-native.test.ts, cmdt/ignore-fuzz-native.test.ts | `isIgnored` API and the command, `-v` (git's `last_matching_pattern`) included |
| Plumbing | check-mailmap | git-check-mailmap | t4203 | Full | cmd/check-mailmap-command.ts, cmd/mailmap.ts; cmdt/mailmap-native.test.ts | t4203: `.mailmap`, `mailmap.file`, `mailmap.blob`, bare addresses (2.47+) |
| Plumbing | check-ref-format | git-check-ref-format | t1402 | Full | vcs-core/src/history/refs/ref-name.ts, cmd/check-ref-format-command.ts; cmdt/check-ref-format-native.test.ts | `check_refname_format` rules on writes and the command (`--normalize`, `--branch`) |
| Plumbing | checkout-index | git-checkout-index | t2006, t2004, t2002 | Full | cmd/checkout-index-command.ts; cmdt/checkout-index-native.test.ts | t2006, t2004, t2002: `--prefix`, `--temp`, `--stage`, `-f`/`-n`/`-q`, skip-worktree, sparse index |
| Plumbing | cherry (upstream patch equivalence) | git-cherry | t3500 | Full | cmd/cherry-command.ts, cmd/patch-id.ts; cmdt/symmetric-difference-native.test.ts | t3500, with rev-list `--cherry-pick`/`--cherry-mark`/`--cherry` |
| Plumbing | column | git-column | t9002 | None | | Terminal layout helper |
| Plumbing | commit-graph write/verify | git-commit-graph | t5318, t5324, t4216 | Full | vcs-store-files/src/commit-graph.ts, vcs-core/src/history/commit-graph/; vcs-store-files/tests/commit-graph.git.test.ts | `--reachable`, `--append`, `--split`, `--changed-paths`; byte-identical files, native verify/fsck accept them |
| Plumbing | commit-tree | git-commit-tree | t1100 | Full | vcs-core/src/history/commits/; cmdt/ident-native.test.ts, cmdt/tree-order-native.test.ts | Commit objects byte-identical to git's (API); signing in the signing rows |
| Plumbing | credential (fill/approve/reject) | git-credential | t0300 | Partial | vcs-transport/src/http-client/http-client-settings.ts (HttpCredentialHelper); cmdt/http-client-config-native.test.ts, cmdt/partial-clone-credential-helper-native.test.ts | `setCredentialHelper` callback with git's fill/approve/reject flow (401, three tries, `authtype`), twin-tested with helper scripts the tests wire; the helper text protocol and `credential.helper`/`credential.*` config are the host's |
| Plumbing | credential-cache / credential-store | git-credential-cache, git-credential-store | t0301, t0302 | N/A | | Host-side helpers (daemon socket, plaintext file); a host may implement a provider |
| Plumbing | daemon (git://) | git-daemon | t5570 | Full | vcs-transport/src/operations/git-daemon.ts, serve-git-connection.ts, base-path-resolver.ts, cmd/daemon-access-hook.ts; cmdt/git-daemon-native.test.ts, cmdt/git-native-protocol.test.ts | t5570: request line, `--base-path`, export-ok, `--user-path`, `--strict-paths`, whitelist, `--interpolated-path`, `--access-hook`, `--max-connections`, `--init-timeout`/`--timeout`, `daemon.<service>`; the listening socket is the host's |
| Plumbing | diff-files | git-diff-files | t4002, t4013 | Full | cmd/diff-plumbing/diff-plumbing-command.ts; cmdt/diff-plumbing-native.test.ts | t4002, t4044: raw format, `ie_match_stat` stat changes, unmerged paths |
| Plumbing | diff-index | git-diff-index | t4013, t4044 | Full | cmd/diff-plumbing/diff-plumbing-command.ts; cmdt/diff-plumbing-native.test.ts | `--cached` and worktree forms, `--raw` |
| Plumbing | diff-tree | git-diff-tree | t4013, t4054 | Full | cmd/diff-plumbing/diff-plumbing-command.ts; cmdt/diff-plumbing-native.test.ts, cmdt/diff-tree-various-native.test.ts | t4013, t4054: `--raw`, `-t`, `-r`, `--stdin`, `-z`, `--cc`, combined diffs |
| Plumbing | diff-pairs | git-diff-pairs | t4070 | Full | cmd/diff-plumbing/diff-pairs-command.ts; cmdt/diff-plumbing-native.test.ts | t4070 (2.50+) |
| Plumbing | fetch-pack (client) | git-fetch-pack | t5500, t5537 | Full | vcs-transport/src/fetch-client/fetch-pack.ts; vcs-transport/tests/interop/fetch-real-git.test.ts, fetch-v2-real-git.test.ts | v0/v1/v2, shallow/deepen, filter, connectivity check, `--keep`, `--check-self-contained-and-connected` |
| Plumbing | fmt-merge-msg | git-fmt-merge-msg | t6200 | Full | cmd/fmt-merge-msg-command.ts; cmdt/merge-log-native.test.ts | Title and shortlog (`--log[=<n>]`, `merge.log`, `merge.summary`, `merge.branchdesc`, `merge.suppressDest`, `--into-name`) |
| Plumbing | for-each-ref | git-for-each-ref | t6300, t6302 | Full | cmd/ref-filter/; cmdt/for-each-ref-native.test.ts | t6300, t6302: atoms, `--format`, sorting, quoting, `--contains`, `--merged`, `--points-at`; `%(objectsize:disk)`, `%(deltabase)`, `%(signature)` refused |
| Plumbing | for-each-repo | git-for-each-repo | t0068 | N/A | | Runs commands over config-listed repositories: a host concern (maintenance scheduler) |
| Plumbing | format-rev (experimental) | git-format-rev | (t4205 family) | Full | cmd/format-rev-command.ts; cmdt/format-rev-native.test.ts | t6120's format-rev tests against git master (none in 2.43) |
| Plumbing | get-tar-commit-id | git-get-tar-commit-id | t5000 | Full | cmd/archive/tar-commit-id.ts; cmdt/archive-native.test.ts | |
| Plumbing | hash-object | git-hash-object | t1007 | Full | vcs-working-tree/src/worktree/hash-worktree-file.ts; cmdt/add-native.test.ts | Blob ids through clean filters, eol, `core.bigFileThreshold`; API only (`--literally`, `-t <type>` not exposed) |
| Plumbing | hook run / hook list | git-hook | t1800 | Full | cmd/hook-command.ts, cmd/git-hooks.ts; cmdt/hooks-run-native.test.ts | Includes configured hooks (`hook.<name>.*`, 2.5x) |
| Plumbing | http-backend | git-http-backend | t5560, t5561, t5562 | Full | vcs-transport/src/adapters/http/served-http-handler.ts; cmdt/http-served-native.test.ts, cmdt/http-dumb-native.test.ts; vcs-transport/tests/interop/http-backend-oracle.test.ts | Smart and dumb routes, `http.getanyfile/uploadpack/receivepack`, `GIT_HTTP_EXPORT_ALL`, status codes and headers |
| Plumbing | http-fetch (dumb walker) | git-http-fetch | t5550 | Full | vcs-transport/src/fetch-client/dumb-http.ts; cmdt/http-dumb-client-native.test.ts | Clone, fetch, ls-remote over dumb HTTP (t5550), alternates under `http.followRedirects` |
| Plumbing | http-push (WebDAV) | git-http-push | t5540 | None | | A push to a dumb HTTP remote is refused |
| Plumbing | index-pack | git-index-pack | t5302, t5300, t5504 | Full | vcs-core/src/pack/index-pack.ts, import-pack.ts; vcs-store-files/tests/pack/index-pack.git.test.ts, import-pack.git.test.ts | `--fix-thin`, `--strict` (fsck msg ids), `--keep`, `--promisor`, quarantine, git's errors |
| Plumbing | interpret-trailers | git-interpret-trailers | t7513 | Full | cmd/interpret-trailers-command.ts, cmd/trailers.ts; cmdt/interpret-trailers-native.test.ts | t7513: `--trailer`, `--where`, `--if-exists`/`--if-missing`, `trailer.*`, `--parse`, `--in-place` |
| Plumbing | last-modified | git-last-modified | t8020 | Full | cmd/last-modified-command.ts; cmdt/last-modified-native.test.ts | t8020 (2.52+; skipped without the native command) |
| Plumbing | ls-files | git-ls-files | t3000, t3004, t3013 | Full | cmd/ls-files-command.ts; cmdt/ls-files-native.test.ts | t3000-t3060: `--stage`, `--format`, `-k`, `-i -o`, `--error-unmatch`, `--with-tree`, `--eol` |
| Plumbing | ls-remote | git-ls-remote | t5512 | Full | cmd/ls-remote-command.ts; cmdt/fetch-local-native.test.ts, cmdt/git-native-protocol.test.ts | `--heads`/`--tags`/symrefs over every transport |
| Plumbing | ls-tree | git-ls-tree | t3100, t3104 | Full | cmd/ls-tree-command.ts; cmdt/ls-tree-native.test.ts | t3100-t3105: `-r`, `-t`, `-l`, `--format`, `-z` |
| Plumbing | mailinfo | git-mailinfo | t5100 | Full | cmd/am/; cmdt/mailinfo-native.test.ts | Inside `am` |
| Plumbing | mailsplit | git-mailsplit | t5100 | Full | cmd/am/mailsplit.ts; cmdt/am-options-native.test.ts | mbox, mboxrd and Maildir, `-b`, `--keep-cr`, `-d`, `-f` |
| Plumbing | merge-base | git-merge-base | t6010, t6099 | Full | cmd/merge-base-command.ts, cmd/merge-bases.ts, cmd/fork-point.ts; cmdt/rebase-onto-fork-point-native.test.ts | t6010, t6099: `--all`, `--octopus`, `--independent`, `--is-ancestor`, `--fork-point` |
| Plumbing | merge-file | git-merge-file | t6403 | Full | vcs-utils/src/diff/text-diff/; vcs-utils/tests/diff/text-diff/line-merge-fuzz-native.test.ts | Three-way line merge, diff3/zdiff3, union, marker size; API only |
| Plumbing | merge-index / merge-one-file | git-merge-index, git-merge-one-file | t6060 | Partial | cmd/octopus-merge.ts; cmdt/merge-octopus-native.test.ts | merge-one-file's per-path merge runs inside the octopus strategy (`merge-index -o git-merge-one-file -a`); no merge-index command |
| Plumbing | merge-tree (`--write-tree`) | git-merge-tree | t4300, t4301 | Full | cmd/merge-tree-command.ts, cmd/ort-merge.ts; cmdt/merge-tree-native.test.ts | t4301, t4300: conflict info, messages, `-z`, `--name-only`, `--stdin`, `--merge-base`, trivial mode |
| Plumbing | mktag | git-mktag | t3800 | Full | cmd/mktag-command.ts; cmdt/mktag-native.test.ts | t3800: fsck-strict input validation, `--no-strict`, `fsck.<msg-id>` |
| Plumbing | mktree | git-mktree | t1010 | Full | vcs-core/src/history/trees/; cmdt/tree-order-native.test.ts, cmdt/tree-canonical-modes-native.test.ts | Tree encoding/ordering byte-identical (API) |
| Plumbing | multi-pack-index write/verify/expire/repack | git-multi-pack-index | t5319, t5334, t5326 | Full | vcs-store-files/src/multi-pack-index.ts, vcs-core/src/pack/multi-pack-index.ts; vcs-store-files/tests/multi-pack-index.git.test.ts | `--stdin-packs`, `--preferred-pack`, `--bitmap`, `--incremental`, `--batch-size`; `compact` (t5335) not found |
| Plumbing | name-rev | git-name-rev | t6120 | Full | cmd/name-rev.ts, cmd/name-rev-command.ts; cmdt/name-rev-native.test.ts | t6120 |
| Plumbing | pack-objects | git-pack-objects | t5300, t5316, t5317 | Full | vcs-core/src/pack/write-pack.ts, list-objects.ts, bitmap-walk.ts; vcs-store-files/tests/pack/write-pack.git.test.ts | Delta search, OFS/REF, thin packs, filters, bitmaps, delta islands, cruft packs, `--stdin-packs` style midx repack; `--sparse` not found |
| Plumbing | pack-redundant | git-pack-redundant | t5323 | None | | Deprecated in git |
| Plumbing | patch-id | git-patch-id | t4204 | Full | cmd/patch-id.ts, cmd/patch-id-command.ts; cmdt/patch-id-native.test.ts | t4204: `--stable`, `--unstable`, `--verbatim`, `patchid.*` |
| Plumbing | prune-packed | git-prune-packed | t5304 | Full | vcs-store-files/src/repack.ts (prunePacked); vcs-store-files/tests/pack/pack-set.git.test.ts, cmdt/fsck-native.test.ts | Counts alternates' packs too |
| Plumbing | read-tree (1/2/3-way, `--prefix`, `-u`, sparse) | git-read-tree | t1000, t1001, t1003 | Full | cmd/read-tree-command.ts; cmdt/read-tree-native.test.ts | `initial_checkout`, `--reset`, `-m`, three trees, `--prefix` |
| Plumbing | receive-pack | git-receive-pack | t5410, t5411, t5547 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts; vcs-transport/tests/interop/receive-pack-real-git.test.ts, cmdt/push-local-receive-native.test.ts | Gaps, if any, are in the server-side section |
| Plumbing | replay | git-replay | t3650 | Full | cmd/replay-command.ts; cmdt/replay-native.test.ts | t3650; options by version (2.44+, `--ref-action`, `--revert`, `--linearize`) |
| Plumbing | repo info / structure | git-repo | t1900, t1901 | Full | cmd/repo-command.ts; cmdt/repo-native.test.ts | Keys per version |
| Plumbing | rev-list | git-rev-list | t6000, t6017, t6112 | Partial | cmd/rev-list-command.ts, vcs-core/src/pack/list-objects.ts; cmdt/revision-args-native.test.ts, cmdt/log-revisions-native.test.ts, cmdt/symmetric-difference-native.test.ts, cmdt/serve-filter-native.test.ts | Ranges, `--objects`, `--filter`, `--missing`, ordering, `--bisect`/`--bisect-vars`, `--cherry-*`, `--count`, `--stdin`; `--disk-usage` not found |
| Plumbing | rev-parse | git-rev-parse | t1500, t1503, t1512 | Full | cmd/rev-parse-command.ts, cmd/revision-resolver.ts; cmdt/revision-syntax-native.test.ts | Revisions, `--verify`, ranges, disambiguation; `--parseopt`/`--sq-quote`/`--git-path` style helpers not verified |
| Plumbing | send-pack (client) | git-send-pack | t5400, t5541 | Full | vcs-transport/src/push-client/send-pack.ts; vcs-transport/tests/interop/push-client-real-git.test.ts | atomic, push-options, report-status(-v2), force-with-lease |
| Plumbing | git-shell | git-shell | t9850 | N/A | | Restricted login shell: an OS-level program |
| Plumbing | git-sh-setup / git-sh-i18n | git-sh-setup | | N/A | | Shell-script libraries |
| Plumbing | show-index | git-show-index | t5302 | Full | cmd/object-store/show-index-command.ts; cmdt/object-store-native.test.ts | t5302, `.idx` v1 and v2 |
| Plumbing | show-ref (`--verify`, `--exists`) | git-show-ref | t1403, t1422 | Full | cmd/show-ref-command.ts; cmdt/show-ref-native.test.ts | t1403, t1422, `--exclude-existing` |
| Plumbing | stripspace | git-stripspace | t0030 | Full | cmd/message-cleanup.ts, cmd/stripspace-command.ts; cmdt/stripspace-native.test.ts, cmdt/message-cleanup-native.test.ts | `cleanup` modes incl. `core.commentChar/commentString`; `-s`/`-c` |
| Plumbing | symbolic-ref | git-symbolic-ref | t1401 | Full | vcs-store-files/src/refs/ref-store.files.ts (`setSymbolic`); vcs-store-files/tests/refs/files-ref-batch-git.test.ts | Symref writes incl. reference-transaction hook (2.5x form) |
| Plumbing | unpack-file | git-unpack-file | | None | | Trivial with the blob API |
| Plumbing | unpack-objects | git-unpack-objects | t5351, t5302 | Full | vcs-core/src/pack/unpack-objects.ts, cmd/unpack-objects-command.ts; cmdt/unpack-objects-native.test.ts | t5300, t5351, t5302: `-n`, `--strict[=<list>]`, thin bases |
| Plumbing | update-index | git-update-index | t2107, t2104, t2106 | Full | cmd/update-index-command.ts, vcs-working-tree/src/staging/; cmdt/update-index-native.test.ts, cmdt/index-flags-native.test.ts, cmdt/split-index-native.test.ts | t2107, t2104, t2106: `--add`/`--remove`/`--force-remove`, `--cacheinfo`, `--index-info`, `--chmod`, `--refresh`, flags, split/sparse indexes; index bytes compared |
| Plumbing | update-ref (incl. `--stdin` transactions) | git-update-ref | t1400, t1404, t1416 | Full | vcs-store-files/src/refs/files-ref-batch.ts; vcs-store-files/tests/refs/files-ref-batch-git.test.ts, files-ref-batch-git-edge.test.ts | Batches with old-value checks, locks, reflog; the `--stdin` text protocol is an API (`planRefBatch`) |
| Plumbing | update-server-info | git-update-server-info | t5200 | Full | vcs-store-files/src/server-info.ts; cmdt/repack-native.test.ts, cmdt/gc-native-twins.test.ts, cmdt/receive-limits-native.test.ts | `info/refs` and `objects/info/packs` written by repack/gc and `receive.updateServerInfo`; also generated per request for dumb HTTP |
| Plumbing | upload-archive / archive | git-upload-archive, git-archive | t5000, t5001, t5003 | Full | cmd/archive/; cmdt/archive-native.test.ts, cmdt/archive-remote-native.test.ts | tar, tgz, zip, `tar.<format>.command`, `--remote` and upload-archive over git:// and local paths (both streaming); smart HTTP has none, as git |
| Plumbing | upload-pack | git-upload-pack | t5530, t5700, t5702 | Full | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts, fsm/protocol-v2/server-v2-fsm.ts; vcs-transport/tests/interop/upload-pack-negotiation-real-git.test.ts, server-parity-real-git.test.ts | v0 and v2; the v2 features are rows of the protocol section |
| Plumbing | url-parse | git-url-parse | t9904 | Full | vcs-transport/src/connect/git-url.ts, cmd/url-parse-command.ts; cmdt/url-parse-native.test.ts | 2.5x only (twins probe for it) |
| Plumbing | var (GIT_AUTHOR_IDENT, GIT_EDITOR, ...) | git-var | t0007 | Full | cmd/var-command.ts, cmd/git-ident.ts; cmdt/var-native.test.ts, cmdt/var-git3-native.test.ts | `var -l`; build facts come from the host environment |
| Plumbing | verify-pack | git-verify-pack | t5302 | Full | cmd/fsck/verify-pack-command.ts; cmdt/object-store-native.test.ts | t5301, t5302: `-v`/`-s` output, `.idx` v1 |
| Plumbing | write-tree (`--prefix`, missing-ok) | git-write-tree | t0090, t1600 | Full | vcs-working-tree/src/staging/cache-tree.ts; vcs-store-files/tests/workspace/staging-write-tree-reuse.test.ts, cmdt/merge-index-native.test.ts | Cache-tree reuse and invalidation as git; `verifyTreePaths` refuses D/F clashes |
| Plumbing | fsck (objects, connectivity, refs, reflogs, index, commit-graph, midx, bitmaps) | git-fsck | t1450, t1451, t0602 | Full | cmd/fsck/; cmdt/fsck-native.test.ts, cmdt/fsck-work-native.test.ts | Msg ids, `fsck.<id>`, skipList, exit bits, `--connectivity-only`, `--no-references`; 2.43 and 2.5x orders |
| Plumbing | count-objects | git-count-objects | t5304 | Full | cmd/object-store/count-objects-command.ts; cmdt/object-store-native.test.ts | t5304, t5301 |
| Plumbing | replace (create/list/delete) | git-replace | t6050 | Full | cmd/replace-command.ts, vcs-core/src/history/objects (object-replacements); cmdt/replace-native.test.ts, cmdt/replace-grafts-native.test.ts | t6050: create, `-d`, `-l`, `--edit`, `--graft`, `--convert-graft-file`; honoured on read |
| Plumbing | prune (unreachable loose objects) | git-prune | t5304, t6501 | Full | vcs-core/src/gc/gc-orchestrator.ts, vcs-store-files/src/gc.ts; vcs-store-files/tests/repack-gc.git.test.ts, gc-orchestrator-roots.git.test.ts | Through gc (`--prune=<date>`), keeps promisor/kept objects |
| Plumbing | repack (`-a -d -l -b -m --filter`) | git-repack | t7700, t7701, t7706 | Full | cmd/repack-command.ts, vcs-store-files/src/repack.ts, repack-geometric.ts; cmdt/repack-native.test.ts, vcs-store-files/tests/repack-gc.git.test.ts | t7700, t7701, t7703, t5320: also `--cruft`, `--geometric`, `-k`, delta islands (`-i`); `--write-midx=incremental` not implemented |
| Plumbing | pack-refs (`--all`, `--prune`, `--auto`) | git-pack-refs | t0601, t3210 | Full | cmd/pack-refs-command.ts; cmdt/packed-refs-native.test.ts | Peeling, `files_optimize` hook transaction, `--auto` (2.5x) |
| Plumbing | gc / gc --auto | git-gc | t6500 | Full | cmd/gc-command.ts; cmdt/gc-native-twins.test.ts, cmdt/hooks-auto-gc-native.test.ts, vcs-store-files/tests/repack-gc.git.test.ts | `gc.auto`, `gc.autoPackLimit`, `gc.pid`, pre-auto-gc, cruft packs (`gc.cruftPacks`, `gc.maxCruftSize`) |
| Plumbing | maintenance (run/register/start, tasks) | git-maintenance | t7900 | Partial | cmd/maintenance-run-command.ts; cmdt/maintenance-native.test.ts | `maintenance run` (tasks, `--auto`, `--schedule`, strategies) twin-tested by trace2 regions (t7900); `register`/`start`/`stop`/`--detach` not implemented (OS scheduling) |
| Plumbing | bundle create/verify/list-heads/unbundle | git-bundle | t5607, t6020 | Full | cmd/bundle/; cmdt/bundle-native.test.ts, cmdt/bundle-transport-native.test.ts | v2/v3 headers byte for byte; bundles as remotes for clone/fetch/ls-remote |
| Plumbing | verify-commit / verify-tag | git-verify-commit, git-verify-tag | t7030, t7510 | Partial | cmd/verify-command.ts, cmd/signature-check.ts; cmdt/verify-signatures-native.test.ts | openpgp and ssh twin-tested (t7510, t7030) through the host's verifier; x509 has no test; no `verify-tag --format` |
| Plumbing | refs migrate / list / exists / optimize (git refs) | git-refs | t1460, t1461, t1463 | Full | cmd/refs-command.ts, vcs-store-files/src/refs/ref-storage-migration.ts; cmdt/refs-native.test.ts, vcs-store-files/tests/refs-migrate-crash.git.test.ts | t1460-t1463, t0602, t0614: migrate both ways, verify, list, exists, optimize (2.46+) |
| Plumbing | reflog expire / delete / exists / write | git-reflog | t1410, t1418, t1421 | Full | cmd/reflog-command.ts, vcs-store-files/src/reflog-expire.ts; cmdt/reflog-expire-native.test.ts, cmdt/reflog-native.test.ts | expire, delete, drop, write (2.5x), files and reftable |

## 2. Object and repository formats

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Formats | Loose objects (zlib, `<type> <size>\0`, fan-out) | gitformat-loose | t1006, t1060 | Full | vcs-store-files/src/storage/loose/; vcs-store-files/tests/storage/loose/object-write-skip.test.ts, cmdt/fsck-native.test.ts | `core.compression`/`core.looseCompression`, write skips existing objects (freshen) |
| Formats | Object types: commit (headers, encoding, mergetag, gpgsig kept) | gitformat-signature, fsck | t1450, t7510 | Full | vcs-core/src/history/commits/, vcs-core/src/history/format/; cmdt/ident-native.test.ts, cmdt/uppercase-object-id-native.test.ts | Unknown headers and signatures preserved byte-for-byte; lenient parsing as git |
| Formats | Object types: tree (ordering, modes, canonical 100664) | gitformat (tree) | t1010, t4054 | Full | vcs-core/src/history/trees/; cmdt/tree-order-native.test.ts, cmdt/tree-canonical-modes-native.test.ts | `canonTreeMode`, raw reads for fsck |
| Formats | Object types: annotated tag | gitformat (tag) | t3800, t7004 | Full | vcs-core/src/history/tags/; vcs-testing/src/suites/tag-store.suite.ts, cmdt/fsck-native.test.ts | gpgsig/gpgsig-sha256 headers skipped as git fsck does |
| Formats | Pack format v2 (read and write) | gitformat-pack | t5300, t5303, t5313 | Full | vcs-core/src/pack/pack-file.ts, write-pack.ts; vcs-store-files/tests/pack/write-pack.git.test.ts | Native index-pack --strict / verify-pack / fsck accept our packs; v3 header read not verified |
| Formats | Delta encoding (copy/insert), OFS_DELTA, REF_DELTA | gitformat-pack | t5300, t5309, t5316 | Full | vcs-utils/src/diff/delta/git-delta-format.ts; vcs-store-files/tests/pack/git-delta-interop.test.ts | Delta chains, cycle detection, `core.deltaBaseCacheLimit` |
| Formats | Thin packs (send and complete) | gitformat-pack | t5306, t5500 | Full | vcs-core/src/pack/index-pack.ts; vcs-store-files/tests/pack/import-pack.git.test.ts | `--fix-thin` equivalent |
| Formats | Pack index `.idx` v2 (incl. 64-bit offsets) | gitformat-pack | t5302 | Full | vcs-core/src/pack/pack-index-writer.ts, pack-index-reader.ts; vcs-store-files/tests/pack/index-pack.git.test.ts | Byte-identical to git's for the same pack |
| Formats | Pack index `.idx` v1 | gitformat-pack | t5302 | Full | vcs-core/src/pack/pack-index-reader.ts (PackIndexV1), pack-index-writer.ts; cmdt/object-store-native.test.ts | t5302: native show-index/verify-pack read ours, ours reads git's |
| Formats | Pack reverse index `.rev` (RIDX) | gitformat-pack | t5325 | Full | vcs-core/src/pack/pack-file.ts (loadReverseIndex), vcs-store-files/src/repack.ts; vcs-store-files/tests/reverse-index.git.test.ts | Written with every pack under `pack.writeReverseIndex` (default true), read under `pack.readReverseIndex`; fsck verifies |
| Formats | `.keep` packs | gitformat-pack | t7700, t6114 | Full | vcs-core/src/pack/pack-set.ts, vcs-store-files/src/repack.ts; vcs-store-files/tests/pack-bitmap.git.test.ts | `repack.packKeptObjects`; clones keep every pack |
| Formats | Cruft packs + `.mtimes` | gitformat-pack | t5329, t7704 | Full | vcs-store-files/src/cruft-pack.ts, vcs-store-files/src/gc.ts; vcs-store-files/tests/cruft-pack.git.test.ts, cmdt/gc-native-twins.test.ts | Written by gc (`gc.cruftPacks`, `gc.maxCruftSize`) and `repack --cruft` |
| Formats | Pack bitmaps `.bitmap` v1 (EWAH, hash cache, lookup table) | technical/bitmap-format | t5310, t5311, t6113 | Full | vcs-core/src/pack/pack-bitmap.ts, pack-bitmap-writer.ts, bitmap-walk.ts; vcs-store-files/tests/pack-bitmap.git.test.ts | Byte-identical bitmaps of git's pack; `pack.preferBitmapTips`, filters on bitmaps |
| Formats | Bitmap pseudo-merges | technical/bitmap-format, config/bitmap-pseudo-merge | t5333 | Full | vcs-core/src/pack/pack-bitmap.ts, vcs-store-files/src/pseudo-merge-config.ts; vcs-store-files/tests/pack-bitmap-pseudo-merge.git.test.ts | t5333 (2.46+): `bitmapPseudoMerge.*`, bitmaps byte-identical, read both ways |
| Formats | Multi-pack-index (OIDF/OIDL/OOFF/LOFF/PNAM/RIDX/BTMP), v1 and v2 | gitformat-pack, technical/multi-pack-index | t5319, t5327 | Full | vcs-core/src/pack/multi-pack-index.ts; vcs-store-files/tests/multi-pack-index.git.test.ts | Byte-identical writes in git's discovery order; crafted-midx hardening |
| Formats | Incremental midx chains (`multi-pack-index.d/`) | technical/multi-pack-index | t5334, t7705 | Full | vcs-store-files/src/multi-pack-index.ts; vcs-store-files/tests/multi-pack-index.git.test.ts | Read and `--incremental` write; chain size capped (`MAX_MIDX_CHAIN_LAYERS`) |
| Formats | Midx bitmaps (`multi-pack-index-*.bitmap`) | technical/bitmap-format | t5326, t5327, t5332 | Full | vcs-core/src/pack/multi-pack-index.ts, pack-bitmap-writer.ts; vcs-store-files/tests/multi-pack-index.git.test.ts | Native `--test-bitmap` accepts ours; multi-pack reuse (t5332) not verified |
| Formats | Commit-graph file (OIDF/OIDL/CDAT/EDGE) | gitformat-commit-graph | t5318 | Full | vcs-core/src/history/commit-graph/; vcs-store-files/tests/commit-graph.git.test.ts | `GIT_COMMIT_GRAPH_PARANOIA`, ignored under replace refs/grafts/shallow |
| Formats | Commit-graph generation data v2 (GDAT/GDO2) | gitformat-commit-graph | t5318, t5328 | Full | vcs-core/src/history/commit-graph/commit-graph-format.ts; vcs-store-files/tests/commit-graph.git.test.ts | `commitGraph.generationVersion` 1 and 2 |
| Formats | Commit-graph changed-path Bloom filters (BIDX/BDAT, v1/v2) | gitformat-commit-graph | t4216, t0095 | Full | vcs-core/src/history/commit-graph/bloom-filter.ts; vcs-store-files/tests/commit-graph.git.test.ts, cmdt/log-path-native.test.ts | `commitGraph.changedPathsVersion`, `maxNewFilters`, `readChangedPaths`; used by `log -- <path>` |
| Formats | Split commit-graph chains | gitformat-commit-graph | t5324 | Full | vcs-store-files/src/commit-graph.ts; vcs-store-files/tests/commit-graph.git.test.ts | Layers looked up across alternates |
| Formats | Index v2 / v3 (extended flags) | gitformat-index | t1600, t2104 | Full | vcs-working-tree/src/staging/index-format.ts; vcs-working-tree/tests/staging/index-format.git.test.ts, cmdt/index-version-native.test.ts | Version kept on rewrite, `index.version`, `GIT_INDEX_VERSION` |
| Formats | Index v4 (path prefix compression) | gitformat-index | t1600 | Full | vcs-working-tree/src/staging/index-format.ts; cmdt/index-version-native.test.ts | `feature.manyFiles` default 4 |
| Formats | Index ext TREE (cache-tree) | gitformat-index | t0090 | Full | vcs-working-tree/src/staging/cache-tree.ts; cmdt/merge-index-native.test.ts | Prime/invalidate as git |
| Formats | Index ext REUC (resolve-undo) | gitformat-index | t2030 | Full | vcs-working-tree/src/staging/index-extensions.ts; cmdt/resolve-undo-native.test.ts | |
| Formats | Index ext `link` (split index, sharedindex.*) | gitformat-index, technical (split-index) | t1700, t1701 | Full | vcs-working-tree/src/staging/split-index.ts; vcs-working-tree/tests/staging/split-index-native.test.ts, cmdt/split-index-native.test.ts | `core.splitIndex`, `splitIndex.maxPercentChange/sharedIndexExpire` |
| Formats | Index ext UNTR (untracked cache) | gitformat-index | t7063 | Full | vcs-working-tree/src/status/untracked-cache.ts; cmdt/status-untracked-cache-native.test.ts | Flags per mode, `core.untrackedCache` applied on read |
| Formats | Index ext FSMN (fsmonitor) | gitformat-index | t7519 | Full | vcs-working-tree/src/staging/index-extensions.ts, cmd/fsmonitor-refresh.ts; cmdt/fsmonitor-native.test.ts | Token and dirty bitmap written as git (t7519), index bytes compared |
| Formats | Index ext EOIE / IEOT | gitformat-index | t1700 (index.threads) | Partial | vcs-working-tree/src/staging/index-extensions.ts | Read and ignored; never written (git writes them only with `index.threads`/recordEndOfIndexEntries) |
| Formats | Index ext `sdir` (sparse index) | gitformat-index, technical/sparse-index | t1092 | Full | vcs-working-tree/src/staging/sparse-index.ts; cmdt/sparse-index-native.test.ts | Expanded on read, re-collapsed on write when it qualifies |
| Formats | Unknown required index extension refused | gitformat-index | t1600 | Full | vcs-working-tree/src/staging/index-extensions.ts | `UnsupportedIndexExtensionError` |
| Formats | `index.skipHash` (null trailer) | config/index | t1600 | Full | vcs-working-tree/src/staging/index-file.ts; cmdt/index-version-native.test.ts | |
| Formats | Corrupt index handling (bounds checks, trailer verify only in fsck) | gitformat-index | t1601, t1450 | Full | vcs-working-tree/src/staging/index-format.ts; cmdt/fsck-native.test.ts | `IndexCorruptError` with git's lines |
| Formats | Loose refs, symrefs, lock files | technical (refs), gitrepository-layout | t1400, t0600 | Full | vcs-store-files/src/refs/; vcs-store-files/tests/refs/loose-ref-locks-git.test.ts, ref-locks-cross-process.test.ts | `core.filesRefLockTimeout`, D/F conflicts, cross-process locks |
| Formats | Pseudo-refs / root refs (HEAD, ORIG_HEAD, FETCH_HEAD, AUTO_MERGE, ...) | gitrepository-layout | t1405, t1423 | Full | vcs-store-files/src/refs/; vcs-store-files/tests/refs/pseudo-ref-locks-git.test.ts, cmdt/fetch-local-native.test.ts | FETCH_HEAD format twin-tested by fetch tests |
| Formats | packed-refs (peeled, fully-peeled, sorted traits) | technical (packed-refs) | t1408, t1409, t3211 | Full | vcs-store-files/src/refs/packed-refs-reader.ts, packed-refs-writer.ts; cmdt/packed-refs-native.test.ts | `core.packedRefsTimeout` |
| Formats | Reflogs (format, `core.logAllRefUpdates`, stash reflog) | gitrepository-layout | t1410, t1411, t1414 | Full | vcs-store-files/src/refs/reflog-reader.ts, ref-writer.ts; vcs-store-files/tests/refs/reflog-config-git.test.ts, cmdt/reflog-native.test.ts | |
| Formats | reftable backend | technical/reftable, config/reftable | t0610, t0612, t0613 | Full | vcs-store-files/src/refs/reftable/; cmdt/reftable-read-git3-native.test.ts, cmdt/reftable-write-git3-native.test.ts, cmdt/sha256-reftable-git3-native.test.ts | Read and write (compaction, reflogs, worktrees) against git 3.0; tables byte-compared where both write the same transactions |
| Formats | Ref transactions (atomic multi-ref batches, D/F checks) | technical (refs) | t1400, t1404, t1416 | Full | vcs-store-files/src/refs/files-ref-batch.ts; vcs-store-files/tests/refs/files-ref-batch-git.test.ts | Name-ordered locking, initial (clone) transactions into packed-refs |
| Formats | Shallow file (`.git/shallow`, `GIT_SHALLOW_FILE`) | technical/shallow | t5537, t5538 | Full | vcs-store-files/tests/shallow-file.test.ts, cmdt/serve-shallow-native.test.ts | Commit-graph disabled when shallow |
| Formats | Alternates (`objects/info/alternates`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`) | gitrepository-layout | t5613, t5615, t5618 | Full | vcs-store-files/src/alternates/; cmdt/alternates-native.test.ts | Depth 5, error lines, alternate refs as tips (`core.alternateRefsCommand/Prefixes`) |
| Formats | `info/grafts` (`GIT_GRAFT_FILE`) and replace refs | gitrepository-layout | t6001, t6050 | Full | vcs-core/src/history/objects (replacements); cmdt/replace-grafts-native.test.ts | Read-side only |
| Formats | Promisor packs (`.promisor`) and promisor objects | technical/partial-clone | t0410, t5616 | Full | vcs-store-files/src/promisor-objects.ts, cmd/promisor-remote.ts; cmdt/partial-clone-lazy-native.test.ts | `repack_local_links` (2.48+) |
| Formats | Large object promisors (`promisor.*` capability, LOP) | technical/large-object-promisors, config/promisor | t5710 | Partial | vcs-transport/src/protocol/promisor-remote.ts, operations/server-config.ts, cmd/promisor-remote-reply.ts; cmdt/promisor-remote-capability-native.test.ts | t5710: `promisor.advertise`/`sendFields`, `acceptFromServer`/`acceptFromServerUrl`/`checkFields`/`storeFields`, `--filter=auto`; a server's own lazy fetch of objects no client accepted is not implemented |
| Formats | `objects/info/packs`, `info/refs` (dumb-HTTP files) | gitrepository-layout | t5200 | Full | vcs-store-files/src/server-info.ts, vcs-transport/src/operations/served-git-files.ts; cmdt/repack-native.test.ts, cmdt/http-dumb-native.test.ts | Written as update-server-info writes them; generated on demand when serving |
| Formats | `objects/info/commit-graphs/` and `objects/pack/multi-pack-index.d/` layouts | gitrepository-layout | t5324, t5334 | Full | vcs-store-files/src/commit-graph.ts, multi-pack-index.ts | |
| Formats | SHA-256 object format (`extensions.objectFormat=sha256`) | technical/hash-function-transition | t0013 (sha1dc), whole suite under `GIT_TEST_DEFAULT_HASH=sha256` | Full | vcs-store-files/src/repository-format.ts, vcs-utils/src/hash/object-format/; cmdt/sha256-objects-native.test.ts, cmdt/sha256-packs-native.test.ts, cmdt/sha256-graph-midx-native.test.ts, cmdt/sha256-transport-native.test.ts | Objects, packs, idx/rev/mtimes, index, commit-graph, midx, bitmaps, `object-format=sha256` over every transport |
| Formats | compatObjectFormat (dual hashing, loose object map) | technical/hash-function-transition | t1016 | Full | vcs-store-files/src/compat/; cmdt/compat-object-format-git3-native.test.ts | `loose-object-idx`, conversion, `--output-object-format`, compat signatures, against git master (Rust build); packs unmapped, as git |
| Formats | Repository format version 0/1, unknown-extension refusal | technical/repository-version, config/extensions | t1302 | Full | vcs-store-files/src/repository-format.ts; vcs-store-files/tests/repository-format.git.test.ts | git's v0/v1 rules and messages |
| Formats | `extensions.noop` / `noop-v1` | config/extensions | t1302 | Full | vcs-store-files/src/repository-format.ts; vcs-store-files/tests/repository-format.git.test.ts | |
| Formats | `extensions.preciousObjects` | config/extensions | t1302, t6500 | Full | vcs-store-files/src/repository-format.ts | gc/repack refuse to delete |
| Formats | `extensions.partialClone` | config/extensions | t0410 | Full | vcs-store-files/src/repository-format.ts; cmdt/partial-clone-lazy-native.test.ts | Also a remote with only `partialclonefilter` |
| Formats | `extensions.worktreeConfig` (`config.worktree`) | config/extensions | t2404 | Full | vcs-store-files/src/workspace/working-copy/working-copy-config.files.ts; cmdt/worktree-native.test.ts | |
| Formats | `extensions.refStorage` | config/extensions | t0610 | Full | vcs-store-files/src/repository-format.ts; cmdt/reftable-read-git3-native.test.ts, cmdt/refs-native.test.ts | `files` and `reftable` |
| Formats | `extensions.objectStorage` (new) | config/extensions | t7427 | Partial | vcs-store-files/src/repository-format.ts; cmdt/object-storage-git3-native.test.ts | Plain `files` opens (and `$GIT_OBJECT_STORAGE_FORMAT`/init defaults are read) as git master; a `files://<directory>` payload is refused |
| Formats | `extensions.relativeWorktrees` | config/extensions | t2400, t2406 | Full | vcs-store-files/src/workspace/linked-worktrees/git-linked-worktrees.ts; cmdt/worktree-dwim-relative-native.test.ts | `--relative-paths`, `worktree.useRelativePaths` through add, move, repair |
| Formats | `extensions.submodulePathConfig` | config/extensions | t7425 | Full | cmd/submodule-model.ts, cmd/submodule-commands.ts; cmdt/submodule-commands-native.test.ts, cmdt/submodule-add-native.test.ts | `submodule.<name>.gitdir` written and used (t7425) |
| Formats | Worktrees layout (`worktrees/<id>/{gitdir,commondir,HEAD,locked}`, per-worktree refs) | git-worktree, gitrepository-layout | t2400, t1415, t1407 | Full | vcs-store-files/src/workspace/linked-worktrees/, refs/worktree-refs.ts; cmdt/worktree-native.test.ts | |
| Formats | gitfile (`.git` file pointing elsewhere) | gitrepository-layout | t0002 | Full | vcs-store-files/src/workspace/git-dir/git-dir-pointers.ts; vcs-store-files/tests/linked-git-dir.test.ts, cmdt/worktree-native.test.ts | |
| Formats | Submodule git dirs (`.git/modules/<name>`, gitlinks) | gitsubmodules | t7400, t7412 | Full | cmd/submodule-commands.ts, cmd/submodule-update-command.ts, cmd/submodule-add-command.ts; cmdt/submodule-update-native.test.ts, cmdt/submodule-absorbgitdirs-native.test.ts, cmdt/submodule-commands-native.test.ts | add, update, absorbgitdirs, status/diff/summary |
| Formats | `core.sharedRepository` file modes | config/core | t1301 | Full | vcs-utils/src/files/shared-perm.ts, vcs-store-files/src/create-git-files-backend.ts; cmdt/shared-repo-native.test.ts, cmdt/init-layout-native.test.ts | git's `adjust_shared_perm` modes; read-only object files |
| Formats | rr-cache (rerere database) | technical/rerere | t4200 | Full | vcs-store-files/src/workspace/transformation/resolution-store.impl.ts, cmd/rerere.ts; cmdt/rerere-native.test.ts, cmdt/resolution-store-rerere-native.test.ts | t4200: `MERGE_RR` and `rr-cache/` files compared, resolutions replayed both ways |

## 3. Protocols and transports

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Protocols | pkt-line framing (flush/delim/response-end) | gitprotocol-common | t0070 | Full | vcs-transport/src/protocol/pkt-line-codec.ts; vcs-transport/tests/pkt-line-codec.test.ts | Interop through every real-git test |
| Protocols | Side-band / side-band-64k (bands 1/2/3) | gitprotocol-pack | t5409 | Full | vcs-transport/src/protocol/sideband.ts; vcs-transport/tests/interop/receive-pack-real-git.test.ts | |
| Protocols | Protocol v0 ref advertisement (capabilities, symref, agent, object-format) | gitprotocol-pack | t5512, t5700 | Full | vcs-transport/src/protocol/advertisement-parser.ts; vcs-transport/tests/interop/server-parity-real-git.test.ts | |
| Protocols | Protocol v1 (`version 1` line) | gitprotocol-pack | t5700 | Full | vcs-transport/src/operations/serve-over-duplex.ts; vcs-transport/tests/interop/serve-real-git.test.ts, cmdt/git-native-protocol.test.ts | |
| Protocols | Protocol v2 handshake and capability advertisement | gitprotocol-v2 | t5701, t5702 | Full | vcs-transport/src/fsm/protocol-v2/; vcs-transport/tests/http/http-server-v2-git-parity.test.ts | agent, object-format, server-option accepted |
| Protocols | v2 `ls-refs` (ref-prefix, symrefs, peel, unborn) | gitprotocol-v2 | t5701, t5702 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts, fetch-client/fetch-remote.ts | Client sends ref-prefix and unborn |
| Protocols | v2 `fetch`: wants/haves/done, acknowledgments, ready | gitprotocol-v2 | t5702 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts; vcs-transport/tests/interop/fetch-v2-real-git.test.ts | |
| Protocols | v2 `fetch`: shallow / deepen / deepen-since / deepen-not / deepen-relative | gitprotocol-v2, technical/shallow | t5537, t5539 | Full | vcs-transport/src/fsm/; cmdt/serve-shallow-native.test.ts | |
| Protocols | v2 `fetch`: filter (partial clone) | gitprotocol-v2, technical/partial-clone | t5616, t5317 | Full | vcs-core/src/pack/object-filter/; cmdt/serve-filter-native.test.ts | blob:none, blob:limit, tree:<n>, sparse:oid, object:type, combine |
| Protocols | v2 `fetch`: want-ref / wanted-refs (ref-in-want) | gitprotocol-v2 | t5703 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts, fetch-client/fetch-pack.ts; cmdt/upload-pack-config-native.test.ts | t5703: `ref-in-want` advertised under `uploadpack.allowRefInWant`; the client sends want-ref when offered |
| Protocols | v2 `fetch`: wait-for-done | gitprotocol-v2 | t5702 | Full | vcs-transport/src/fsm/protocol-v2/types.ts; vcs-transport/tests/upload-pack-v2-policy.test.ts | Advertised by default |
| Protocols | v2 `fetch`: sideband-all | gitprotocol-v2 | t5702 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts; cmdt/sideband-all-native.test.ts | Both ends; `uploadpack.allowSidebandAll` |
| Protocols | v2 `fetch`: packfile-uris | technical/packfile-uri | t5702 | Full | vcs-transport/src/fsm/protocol-v2/packfile-uris.ts, fetch-client/packfile-uris.ts; cmdt/packfile-uris-native.test.ts | Served (`uploadpack.blobPackfileUri`) and fetched (`fetch.uriProtocols`, http/https) |
| Protocols | v2 `object-info` | gitprotocol-v2 | t5701, t1017 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts, fetch-client/object-info.ts; vcs-transport/tests/http/http-server-v2-git-parity.test.ts, cmdt/cat-file-remote-object-info-native.test.ts | Server (`transfer.advertiseObjectInfo`) and client |
| Protocols | v2 `bundle-uri` command | gitprotocol-v2, technical/bundle-uri | t5730, t5731, t5732, t5750 | Full | cmd/bundle/bundle-uri.ts, bundle-list.ts, vcs-transport/src/operations/server-config.ts; cmdt/bundle-uri-native.test.ts | Served under `uploadpack.advertiseBundleURIs`; asked by clone under `transfer.bundleURI` |
| Protocols | v2 `promisor-remote` capability | gitprotocol-v2 | t5710 | Full | vcs-transport/src/protocol/promisor-remote.ts, cmd/promisor-remote-reply.ts; cmdt/promisor-remote-capability-native.test.ts | t5710 (2.49+), both ends |
| Protocols | Session IDs (`session-id`, `transfer.advertiseSID`) | gitprotocol-capabilities | t5705 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts, cmd/session-id.ts; cmdt/upload-pack-config-native.test.ts | t5705: advertised and sent under `transfer.advertiseSID` |
| Protocols | v0 upload-pack: multi_ack, multi_ack_detailed, no-done | gitprotocol-capabilities | t5500, t5530 | Full | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts; vcs-transport/tests/interop/upload-pack-negotiation-real-git.test.ts | |
| Protocols | v0: thin-pack, ofs-delta, include-tag, no-progress | gitprotocol-capabilities | t5305, t5503 | Full | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts; vcs-transport/tests/interop/fetch-real-git.test.ts | |
| Protocols | v0: allow-tip-sha1-in-want / allow-reachable-sha1-in-want / any | gitprotocol-capabilities | t5516, t5551 | Full | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts; vcs-transport/tests/upload-pack-v2-policy.test.ts | Request policies TIP/REACHABLE/ANY |
| Protocols | receive-pack caps: report-status, report-status-v2 | gitprotocol-capabilities | t5411, t5548 | Full | vcs-transport/src/protocol/report-status.ts; cmdt/proc-receive-native.test.ts | |
| Protocols | receive-pack caps: atomic | gitprotocol-capabilities | t5543 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts; vcs-transport/tests/interop/receive-pack-real-git.test.ts | |
| Protocols | receive-pack caps: push-options (`GIT_PUSH_OPTION_*`) | gitprotocol-capabilities | t5545 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts; cmdt/push-options-native.test.ts, cmdt/hooks-push-native.test.ts | Advertised under `receive.advertisePushOptions` |
| Protocols | receive-pack caps: delete-refs, quiet, ofs-delta, side-band-64k, agent | gitprotocol-capabilities | t5400, t5516 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts (RECEIVE_PACK_CAPABILITIES) | |
| Protocols | push-cert (signed pushes, nonces) | gitprotocol-pack, config/receive | t5534 | Full | vcs-transport/src/protocol/push-cert.ts, fsm/push/server-push-fsm.ts; cmdt/push-signed-native.test.ts | Both ends: `push --signed`, `push.gpgSign`, `receive.certNonceSeed`/`certNonceSlop`, `GIT_PUSH_CERT*` for hooks |
| Protocols | Fetch negotiation (consecutive) | gitprotocol-pack | t5500 | Full | vcs-transport/src/fetch-client/negotiator.ts; vcs-transport/tests/interop/upload-pack-negotiation-real-git.test.ts | |
| Protocols | `fetch.negotiationAlgorithm=skipping/noop`, `--negotiate-only`, push negotiation | config/fetch | t5552, t5554 | Full | vcs-transport/src/fetch-client/negotiator.ts; cmdt/fetch-negotiators-native.test.ts, cmdt/upload-pack-acks-native.test.ts | t5552, t5554: consecutive/skipping/noop, `--negotiation-tip`, `--negotiate-only`, `push.negotiate` |
| Protocols | Local transport (path, `file://`) | git-clone (local) | t5605, t5810 | Full | cmd/local-transport.ts, cmd/local-clone.ts; cmdt/clone-local-native.test.ts, cmdt/push-local-receive-native.test.ts | Local clone copies objects; `--no-local` fetches |
| Protocols | git:// (daemon client) | gitprotocol-pack | t5570, t5811 | Full | vcs-transport/src/connect/native-connectors.ts; cmdt/git-native-protocol.test.ts | Socket supplied by the host (`openSocket`) |
| Protocols | ssh (`ssh://`, scp syntax, `GIT_PROTOCOL` via SendEnv) | gitprotocol-pack | t5813, t5601 | Partial | vcs-transport/src/connect/native-connectors.ts; cmdt/git-native-protocol.test.ts | Host supplies `exec`; `GIT_SSH`, `GIT_SSH_COMMAND`, `ssh.variant` are the host's |
| Protocols | Smart HTTP client (info/refs, POST, v2, gzip) | gitprotocol-http | t5551, t5541, t5555 | Full | vcs-transport/src/connect/open-session.ts, adapters/http/; vcs-transport/tests/interop/http-real-git.test.ts, fetch-client-gzip.test.ts | Over any `fetch` |
| Protocols | Dumb HTTP client | gitprotocol-http | t5550 | Full | vcs-transport/src/fetch-client/dumb-http.ts; cmdt/http-dumb-client-native.test.ts | t5550; no quarantine or index-pack checks on walked objects |
| Protocols | Dumb HTTP server | gitprotocol-http | t5550, t5561 | Full | vcs-transport/src/operations/served-git-files.ts; cmdt/http-dumb-native.test.ts | Alternates followed, fails closed with hidden refs |
| Protocols | HTTP auth (Basic, 401 handling) | gitprotocol-http, config/http | t5563 | Full | vcs-transport/src/operations/http-auth.ts, http-client/http-digest.ts; cmdt/http-client-config-native.test.ts | t5563, t5551: Basic, Bearer (`authtype`), Digest, `http.emptyAuth`, `http.proactiveAuth`, POST re-auth; no Negotiate |
| Protocols | HTTP client settings (`http.extraHeader`, proxy, sslVerify, cookies, postBuffer, followRedirects, 429 retry) | config/http | t5564, t5584, t5581 | Full | cmd/http-config.ts, vcs-transport/src/http-client/; cmdt/http-client-config-native.test.ts | `http.<url>.*` matching, extraHeader, userAgent, followRedirects, postBuffer, 429 retry (t5584); TLS, proxy and cookies are the host `fetch`'s |
| Protocols | `ext::` transport | git-remote-ext | t5814 | None | cmdt/duplex-adapters-support.ts | Used only as a test bridge; any byte stream can be registered as a connector instead |
| Protocols | Remote helpers (`git-remote-<name>`, `connect`, `stateless-connect`, fast-import) | gitremote-helpers | t5801, t5802 | N/A | vcs-transport/src/connect/registry.ts | No subprocesses; pluggable connectors play this role (WebSocket, MessagePort, libp2p, httpeers) |
| Protocols | `protocol.<scheme>.allow`, `protocol.allow`, `GIT_ALLOW_PROTOCOL`, `GIT_PROTOCOL_FROM_USER` | config/protocol | t5810, t5811, t5812, t5815 | Full | vcs-transport/src/connect/registry.ts; vcs-commands/tests/transport-connector.test.ts | `fatal: transport 'x' not allowed`; twin coverage partial |
| Protocols | `protocol.version` | config/protocol | t5700, t5702 | Full | vcs-transport/src/connect/; cmdt/remote-url-rewrite-native.test.ts | Push always v0 as git |
| Protocols | `url.<base>.insteadOf` / `pushInsteadOf` | config/url | t5516 | Full | vcs-commands/src/transport-command.ts, vcs-commands/src/remote-config/; cmdt/remote-url-rewrite-native.test.ts | |
| Protocols | Bundle format v2/v3 | gitformat-bundle | t5607, t6020 | Full | cmd/bundle/bundle-format.ts; cmdt/bundle-native.test.ts | Headers byte for byte, `@object-format=`/`@filter=` |
| Protocols | Bundle URIs (clone `--bundle-uri`, `bundle.*` config, `fetch.bundleURI`) | technical/bundle-uri | t5558 | Full | cmd/bundle/bundle-uri.ts, bundle-list.ts; cmdt/bundle-uri-native.test.ts | t5558, t5730, t5732, t5750: lists, `all`/`any`, creation tokens |
| Protocols | Credential helper protocol | gitcredentials, git-credential | t0300, t0303 | Partial | vcs-transport/src/http-client/http-client-settings.ts (HttpCredentialHelper); cmdt/http-client-config-native.test.ts, cmdt/partial-clone-credential-helper-native.test.ts, cmdt/submodule-credential-helper-native.test.ts | fill/approve/reject callback asked as git asks its helpers (twins wire helper scripts); the helper text protocol and `credential.*` config are the host's |
| Protocols | Remote-side keepalive (band-1 empty packets) | config/uploadpack | t5530 | Full | vcs-transport/src/fsm/fetch/send-pack-stream.ts | Default 5s as `uploadpack.keepAlive` |
| Protocols | Connectivity check after fetch (check_connected) | technical/connectivity-check | t5504, t5413 | Full | vcs-transport/src/fetch-client/fetch-checks.ts; cmdt/fetch-connectivity-native.test.ts | git's rev-list error lines |
| Protocols | fetch fsck (`fetch.fsckObjects`, `transfer.fsckObjects`, `fetch.fsck.*`) | config/fetch, config/transfer | t5504 | Full | cmd/fsck/fetch-fsck.ts; cmdt/fetch-connectivity-native.test.ts | |
| Protocols | Lazy fetch from promisor remotes (`GIT_NO_LAZY_FETCH`) | technical/partial-clone | t0410, t5330 | Full | vcs-core/src/history/objects (object-promisor), cmd/promisor-remote.ts; cmdt/partial-clone-lazy-native.test.ts | Batched prefetch in checkout/diff/merge |
| Protocols | Backfill (path-walk) | git-backfill, technical/api-path-walk | t5620, t6601 | Full | cmd/backfill-command.ts; cmdt/partial-clone-lazy-native.test.ts | |
| Protocols | git-lfs (not part of git) | external | | Full | vcs-transport-lfs/src/; vcs-transport-lfs/tests/native-git-lfs.test.ts, native-git-lfs-locks.test.ts | Batch API, locks, filter driver; listed for completeness |

## 4. Server side

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Server | upload-pack hidden refs (`uploadpack.hideRefs`, `transfer.hideRefs`, `^` and `!` patterns) | config/uploadpack, config/transfer | t5512, t6021 | Full | vcs-transport/src/protocol/hidden-refs.ts, operations/server-config.ts; cmdt/http-dumb-native.test.ts | |
| Server | `uploadpack.allowFilter`, `uploadpackfilter.<choice>.allow`, `tree.maxDepth` | config/uploadpack | t5616 | Full | vcs-transport/src/fsm/fetch/upload-pack-filter.ts; cmdt/serve-filter-native.test.ts | |
| Server | `uploadpack.allowTipSHA1InWant` / `allowReachableSHA1InWant` / `allowAnySHA1InWant` | config/uploadpack | t5516 | Full | vcs-transport/src/fsm/fetch/server-fetch-fsm.ts, operations/server-config.ts; cmdt/upload-pack-config-native.test.ts | Read from the served repository's config (t5516) |
| Server | `uploadpack.allowRefInWant` | config/uploadpack | t5703 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts; cmdt/upload-pack-config-native.test.ts | t5703 |
| Server | `uploadpack.packObjectsHook` | config/uploadpack | t5544 | Full | cmd/serve-repository.ts (packObjectsHookOf); cmdt/upload-pack-config-native.test.ts | t5544; protected config only, run by the host's hook runner |
| Server | `uploadpack.blobPackfileUri` | config/uploadpack | t5702 | Full | vcs-transport/src/fsm/protocol-v2/packfile-uris.ts; cmdt/packfile-uris-native.test.ts | |
| Server | `uploadpack.allowSidebandAll` | config/uploadpack | t5702 | Full | vcs-transport/src/fsm/protocol-v2/server-v2-fsm.ts; cmdt/sideband-all-native.test.ts | |
| Server | upload-pack on shallow repositories | technical/shallow | t5537 | Full | vcs-transport/src/fsm/fetch/; cmdt/serve-shallow-native.test.ts | |
| Server | upload-pack bitmaps / `pack.useBitmaps` | config/pack | t5310 | Full | vcs-core/src/pack/bitmap-walk.ts; vcs-store-files/tests/pack-bitmap.git.test.ts | |
| Server | upload-pack authorization/notification hooks (library) | (no git equivalent) | | N/A | vcs-transport/src/fsm/fetch/upload-pack-hooks.ts | webrun-vcs addition |
| Server | receive-pack quarantine (`GIT_QUARANTINE_PATH`, tmp_objdir) | git-receive-pack | t5547 | Full | vcs-store-files/src/quarantine/files-quarantine.ts; vcs-transport/tests/interop/receive-pack-quarantine-real-git.test.ts | Pack copy priority as git |
| Server | receive-pack connectivity check | technical/connectivity-check | t5413 | Full | vcs-transport/src/fsm/push/connectivity.ts; vcs-transport/tests/receive-pack-connectivity-cost.test.ts, interop/receive-pack-real-git.test.ts | |
| Server | `receive.fsckObjects` / `receive.fsck.<msg-id>` | config/receive | t5504 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts, cmd/fsck/fetch-fsck.ts (receiveFsckOf); cmdt/receive-fsck-native.test.ts | t5504, t7416, t7417: `receive.fsckObjects` else `transfer.fsckObjects`, `receive.fsck.<msg-id>`, `receive.fsck.skipList` (no fallback to `fsck.*`, as git); unpack-objects or index-pack `--strict` by `unpackLimit` |
| Server | `receive.denyDeletes`, `denyNonFastForwards` | config/receive | t5400, t5516 | Full | vcs-transport/src/operations/server-config.ts; vcs-transport/tests/interop/receive-pack-real-git.test.ts | |
| Server | `receive.denyCurrentBranch` (refuse/warn/ignore/updateInstead), `denyDeleteCurrent` | config/receive | t5516, t5517 | Full | vcs-transport/src/operations/server-config.ts, cmd/local-transport.ts; cmdt/hooks-push-native.test.ts | updateInstead with push-to-checkout |
| Server | `receive.shallowUpdate` | config/receive | t5538 | Full | vcs-transport/src/operations/server-config.ts; vcs-transport/tests/interop/receive-pack-real-git.test.ts | |
| Server | `receive.hideRefs`, `.have` lines for alternates | config/receive | t5519, t5501 | Full | vcs-transport/src/protocol/hidden-refs.ts; cmdt/alternates-native.test.ts | |
| Server | `receive.procReceiveRefs` / proc-receive protocol | config/receive, githooks | t5411 | Full | vcs-transport/src/fsm/push/proc-receive.ts; cmdt/proc-receive-native.test.ts | |
| Server | `receive.unpackLimit` / `transfer.unpackLimit` | config/receive | t5302 | Full | vcs-transport/src/operations/server-config.ts (unpackLimitOf), vcs-core/src/pack/unpack-objects.ts; cmdt/unpack-limit-native.test.ts | Keep-vs-explode as git (t5510, t5516) |
| Server | `receive.maxInputSize`, `receive.keepAlive`, `receive.autogc`, `receive.updateServerInfo`, `receive.advertiseAtomic/PushOptions` | config/receive | t5546, t5410 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts, cmd/local-transport.ts (afterPushOf); cmdt/receive-limits-native.test.ts, cmdt/push-options-native.test.ts | t5546: maxInputSize; auto maintenance after a push (2.5x `maintenance run --auto`, 2.43 `gc --auto`); updateServerInfo; advertiseAtomic/PushOptions |
| Server | Namespaces (`GIT_NAMESPACE`, `--namespace`) | gitnamespaces | t5509 | Full | vcs-transport/src/context/namespaced-ref-store.ts, protocol/ref-namespace.ts; cmdt/namespaces-native.test.ts | t5509 over git:// and smart HTTP; stricter than git for symrefs leaving the namespace, `.have` lines, upload-archive and dumb `objects/` |
| Server | http-backend dumb/smart selection, `http.getanyfile`, `http.uploadpack`, `http.receivepack` | git-http-backend | t5561, t5560 | Full | vcs-transport/src/adapters/http/served-http-handler.ts; cmdt/http-served-native.test.ts | |
| Server | http-backend CGI env (`REMOTE_USER`, `GIT_PROJECT_ROOT`, `PATH_INFO`, `CONTENT_LENGTH`, gzip bodies) | git-http-backend | t5562 | Partial | vcs-transport/src/adapters/http/ | Fetch-API handler, not CGI; resolver replaces GIT_PROJECT_ROOT; gzip request bodies handled |
| Server | Repository ownership check on serve (`enter_repo`) | git-http-backend, safe.directory | t0033 | Full | vcs-store-files/src/safety/; cmdt/repository-ownership-native.test.ts | HTTP 500 / dropped git:// connection as git |
| Server | Smart HTTP served by our server to native clients (v0 and v2) | gitprotocol-http | t5551 | Full | vcs-transport/src/adapters/http/http-server.ts; vcs-transport/tests/interop/http-backend-oracle.test.ts, http-real-git.test.ts | |
| Server | git-daemon services (`--enable/--disable/--allow-override`, `daemon.*`) | git-daemon | t5570 | Full | vcs-transport/src/operations/serve-git-connection.ts; cmdt/git-native-protocol.test.ts | Refusals compared with the real daemon |

## 5. Hooks (githooks)

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Hooks | applypatch-msg | githooks | t4150 | Full | cmd/am/am-command.ts; cmdt/hooks-am-native.test.ts | (am-command header comment says "not run"; the code runs it) |
| Hooks | pre-applypatch | githooks | t4150 | Full | cmd/am/am-command.ts; cmdt/hooks-am-native.test.ts | |
| Hooks | post-applypatch | githooks | t4150 | Full | cmd/am/am-command.ts; cmdt/hooks-am-native.test.ts | |
| Hooks | pre-commit | githooks | t7503 | Full | cmd/commit-command.ts, cmd/git-hooks.ts; cmdt/hooks-commit-native.test.ts | Index changes by the hook read back |
| Hooks | pre-merge-commit | githooks | t7503 | Full | cmd/merge-command.ts; cmdt/hooks-checkout-merge-native.test.ts | |
| Hooks | prepare-commit-msg | githooks | t7505 | Full | cmd/commit-command.ts, cmd/sequencer-support.ts; cmdt/hooks-commit-native.test.ts | |
| Hooks | commit-msg | githooks | t7504 | Full | cmd/commit-command.ts; cmdt/hooks-commit-native.test.ts | |
| Hooks | post-commit | githooks | t7501 | Full | cmd/commit-command.ts; cmdt/hooks-commit-native.test.ts | |
| Hooks | pre-rebase | githooks | t3413 | Full | cmd/rebase-command.ts; cmdt/hooks-rebase-native.test.ts | |
| Hooks | post-checkout | githooks | t5403 | Full | cmd/checkout-command.ts etc.; cmdt/hooks-checkout-merge-native.test.ts | checkout/switch/restore/clone/worktree add |
| Hooks | post-merge | githooks | t5402 | Full | cmd/merge-command.ts; cmdt/hooks-checkout-merge-native.test.ts | |
| Hooks | pre-push | githooks | t5571 | Full | cmd/push-command.ts; cmdt/hooks-push-native.test.ts | |
| Hooks | pre-receive | githooks | t5401 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts, cmd/local-transport.ts; cmdt/hooks-push-native.test.ts | Quarantine env |
| Hooks | update | githooks | t5401 | Full | as above; cmdt/hooks-push-native.test.ts | |
| Hooks | proc-receive | githooks | t5411 | Full | vcs-transport/src/fsm/push/proc-receive.ts; cmdt/proc-receive-native.test.ts | |
| Hooks | post-receive | githooks | t5401 | Full | cmdt/hooks-push-native.test.ts | |
| Hooks | post-update | githooks | t5401 | Full | cmdt/hooks-push-native.test.ts | |
| Hooks | receive-report (new: rewrites the status report) | githooks | t5412 | Full | vcs-transport/src/fsm/push/server-push-fsm.ts (receiveReport); cmdt/receive-report-git3-native.test.ts | t5412 against git master (no release has it) |
| Hooks | reference-transaction | githooks | t1416 | Full | vcs-store-files/src/refs/files-ref-batch.ts; cmdt/hooks-ref-transaction-native.test.ts, hooks-worktree-ref-transaction-native.test.ts | 2.43 and 2.5x shapes |
| Hooks | push-to-checkout | githooks | t5516 | Full | cmd/local-transport.ts; cmdt/hooks-push-native.test.ts | |
| Hooks | pre-auto-gc | githooks | t6500 | Full | cmd/gc-command.ts; cmdt/hooks-auto-gc-native.test.ts | |
| Hooks | post-rewrite | githooks | t5407 | Full | cmd/commit-command.ts, cmd/rebase-command.ts; cmdt/hooks-rebase-native.test.ts | |
| Hooks | post-index-change | githooks | t7113 | Full | cmd/post-index-change.ts; cmdt/hooks-index-change-native.test.ts | |
| Hooks | sendemail-validate | githooks | t9001 | N/A | cmd/git-hooks.ts (name only) | No send-email |
| Hooks | fsmonitor-watchman | githooks | t7519 | Full | cmd/fsmonitor-refresh.ts; cmdt/fsmonitor-native.test.ts | `core.fsmonitor` hook programs, protocol v1 and v2 (t7519) |
| Hooks | p4-changelist / p4-prepare-changelist / p4-post-changelist / p4-pre-submit | githooks | t9800 family | N/A | | git-p4 only |
| Hooks | Hook discovery: `core.hooksPath`, `advice.ignoredHook`, `GIT_PREFIX`, GIT_DIR in gitfile worktrees | githooks, config/core | t1350, t7520 | Full | cmd/git-hooks.ts; cmdt/hooks-config-native.test.ts | Host runs hooks (`GitHostEnvironment.hookRunner`) |
| Hooks | Configured hooks (`hook.<name>.event/command/enabled`, 2.5x) | config/hook | t1800 | Full | cmd/git-hooks.ts (configuredHooks); cmdt/hooks-run-native.test.ts | Receive side too |

## 6. Subsystems

| Area | Feature | git (command / file / doc) | git tests | webrun-vcs | Evidence | Notes |
|---|---|---|---|---|---|---|
| Config | Syntax (sections, subsections, quoting, escapes, continuation, bools, ints with k/m/g) | git-config | t1300, t1303 | Full | vcs-store-files/src/workspace/working-copy/working-copy-config.files.ts; cmdt/config-parse-native.test.ts | |
| Config | Scopes and order (system, global, XDG, local, worktree, command) | git-config | t1306, t1308 | Full | vcs-store-files/tests/workspace/working-copy/working-copy-config.chain.test.ts; cmdt/config-chain-native.test.ts | `GIT_CONFIG_GLOBAL/SYSTEM/NOSYSTEM` |
| Config | `include.path` | git-config | t1305 | Full | vcs-store-files/src/workspace/working-copy/working-copy-config.files.ts; cmdt/config-chain-native.test.ts | Confinement option for served repositories |
| Config | `includeIf` gitdir: / gitdir/i: | config/includeif | t1305 | Full | as above; cmdt/command-line-config-native.test.ts | |
| Config | `includeIf` onbranch: | config/includeif | t1305 | Full | as above | |
| Config | `includeIf` hasconfig:remote.*.url: | config/includeif | t1305 | Full | as above | |
| Config | `git -c`, `GIT_CONFIG_COUNT/KEY/VALUE`, `GIT_CONFIG_PARAMETERS` | git | t1300 | Full | vcs-working-tree/src/convert/host-environment.ts; cmdt/command-line-config-native.test.ts | Not passed to local transport's remote side, as git |
| Config | `--show-origin`/`--show-scope` metadata | git-config | t1300 | Full | cmd/config-command.ts; cmdt/config-query-native.test.ts | |
| Config | Config from blobs (`--blob`) | git-config | t1307 | Full | cmd/config-command.ts; cmdt/config-query-native.test.ts | |
| Config | `git config` command (get/set/unset/list, `--type`, regex) | git-config | t1300 | Full | cmd/config-command.ts, cmd/config-value-types.ts, vcs-store-files/src/workspace/working-copy/config-file-edit.ts; cmdt/config-write-native.test.ts, cmdt/config-query-native.test.ts | Legacy syntax and 2.46 subcommands; value patterns, `--type`, urlmatch, colors |
| Config | Early config / `core.repositoryformatversion` reading before setup | config | t1309 | Full | vcs-store-files/src/repository-format.ts | |
| Attributes | `.gitattributes`, `info/attributes`, `core.attributesFile`, macros (`[attr]`, `binary`) | gitattributes | t0003 | Full | vcs-working-tree/src/attributes/; cmdt/attributes-fuzz-native.test.ts | |
| Attributes | Attribute source tree (`--attr-source`, `GIT_ATTR_SOURCE`, `attr.tree`) | gitattributes | t0003 | Full | cmd/attributes-source.ts; cmdt/attr-source-native.test.ts | |
| Attributes | `text`, `eol`, `crlf` (legacy), `core.autocrlf`, `core.eol`, `core.safecrlf` | gitattributes | t0020, t0025, t0027 | Full | vcs-working-tree/src/convert/eol.ts, text-stats.ts; cmdt/attributes-eol-native.test.ts, cmdt/attributes-checkout-native.test.ts | Renormalize too |
| Attributes | `ident` | gitattributes | t0021 | Full | vcs-working-tree/src/convert/ident.ts; cmdt/attributes-checkout-native.test.ts | |
| Attributes | `filter` clean/smudge | gitattributes | t0021 | Full | vcs-working-tree/src/convert/filter-driver.ts, git-content-filter.ts; cmdt/host-drivers-native.test.ts, cmdt/lfs-filter-native.test.ts | t0021: the configured command is handed to the host's driver (a Node host runs it as git does); `required` semantics, empty commands |
| Attributes | `filter.<d>.process` long-running protocol (delay, capabilities) | technical/long-running-process-protocol | t0021 | None | | `filter.<d>.process` is read and handed to host drivers; the pkt-line protocol is not implemented |
| Attributes | `working-tree-encoding` | gitattributes | t0028 | Full | vcs-working-tree/src/convert/encoding.ts; cmdt/attributes-checkout-native.test.ts | `core.checkRoundtripEncoding` not read |
| Attributes | `diff` attribute, `diff.<d>.textconv`, `cachetextconv`, `binary` | gitattributes | t4030, t4042, t8006 | Full | cmd/diff-textconv.ts, cmd/textconv-cache.ts; cmdt/host-drivers-native.test.ts, cmdt/textconv-grep-blame-native.test.ts | t4042: textconv through the host's runner, `cachetextconv` as notes-cache |
| Attributes | `diff.<d>.xfuncname`/`funcname` hunk headers, builtin drivers | gitattributes | t4018 | Full | vcs-utils/src/regex/posix-regex.ts; cmdt/diff-config-native.test.ts | POSIX regex engine |
| Attributes | `diff.<d>.wordRegex` (word diff) | gitattributes | t4034 | Full | vcs-commands/src/results/diff-words.ts; cmdt/diff-words-native.test.ts | t4034: `--word-diff`, `--word-diff-regex`, `diff.wordRegex`, builtin drivers |
| Attributes | `merge` attribute: builtin text/binary/union drivers | gitattributes | t6406, t6407 | Full | cmd/merge-drivers.ts; cmdt/merge-attributes-native.test.ts | |
| Attributes | Custom merge drivers (`merge.<d>.driver`, `recursive`) | gitattributes | t6406 | Full | cmd/merge-drivers.ts; cmdt/host-drivers-native.test.ts | t6406: the configured command handed to the host's driver, `recursive`, git's errors |
| Attributes | `conflict-marker-size` | gitattributes | t6406 | Full | cmd/merge-drivers.ts; cmdt/merge-attributes-native.test.ts | |
| Attributes | `whitespace` attribute / `core.whitespace` | gitattributes | t4015, t4124 | Full | cmd/apply/apply-engine.ts; cmdt/whitespace-check-native.test.ts | `diff --check`, `--ws-error-highlight`, apply `--whitespace` |
| Attributes | `export-ignore`, `export-subst` | gitattributes | t5001 | Full | cmd/archive/archive-command.ts; cmdt/archive-native.test.ts | |
| Attributes | `delta` | gitattributes | t5300 | Full | vcs-store-files/src/repack.ts (noDelta); cmdt/repack-native.test.ts | `-delta` paths stored whole (t5300 family) |
| Attributes | `encoding` (gui), `linguist-*` | gitattributes | | N/A | | Not used by git core |
| Attributes | Pathspec `:(attr:...)` | gitattributes, gitglossary | t6135 | Full | cmd/pathspec-attributes.ts; cmdt/pathspec-attr-native.test.ts | |
| Ignore | `.gitignore`, `info/exclude`, `core.excludesFile` (XDG default), negation, directory rules | gitignore | t0008, t3001 | Full | vcs-working-tree/src/ignore/; cmdt/ignore-fuzz-native.test.ts | |
| Ignore | wildmatch (`**`, classes, escapes) | gitignore, wildmatch | t3070 | Full | vcs-working-tree/src/ignore/git-wildmatch.ts; cmdt/ignore-fuzz-native.test.ts | |
| Ignore | Non-UTF-8 patterns and paths | gitignore | t3070 | Full | cmdt/non-utf8-patterns-native.test.ts, cmdt/non-utf8-paths-native.test.ts | |
| Ignore | `.gitignore` read from skip-worktree index entry | gitignore | t7012 | Full | cmd/sparse-checkout-support.ts; cmdt/sparse-checkout-native.test.ts | |
| Env | `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_COMMON_DIR` | git | t1510, t1501 | Full | vcs-store-files/src/safety/discover-repository.ts, open-repository-from-environment.ts; cmdt/open-from-environment-native.test.ts | setup.c's `setup_git_directory_gently`; the stores never read the variables themselves |
| Env | `GIT_CEILING_DIRECTORIES`, `GIT_DISCOVERY_ACROSS_FILESYSTEM` | git | t1504 | Full | vcs-store-files/src/safety/discover-repository.ts; vcs-store-files/tests/discovery-ceiling.git.test.ts | |
| Env | `GIT_ALTERNATE_OBJECT_DIRECTORIES` | git | t5615 | Full | vcs-store-files/src/alternates/; cmdt/alternates-native.test.ts | |
| Env | `GIT_INDEX_VERSION` | git | t1600 | Full | cmdt/index-version-native.test.ts | |
| Env | `GIT_AUTHOR_*` / `GIT_COMMITTER_*` (name, email, date) | git | t7509, t7518 | Full | cmd/git-ident.ts; cmdt/ident-native.test.ts | |
| Env | `GIT_EDITOR` / `GIT_SEQUENCE_EDITOR` | git | t7005 | Partial | cmd/rebase-command.ts, cmd/commit-command.ts (setEditor), cmd/var-command.ts; cmdt/sequence-editor-native.test.ts, cmdt/var-native.test.ts | The sequence editor program runs through the hook runner and `var` resolves git's editor order; the commit message editor is a callback, not the program |
| Env | `GIT_REFLOG_ACTION` | git | t1410 | Full | cmd/reflog-messages.ts; cmdt/reflog-native.test.ts | |
| Env | `GIT_NO_REPLACE_OBJECTS`, `GIT_REPLACE_REF_BASE`, `GIT_GRAFT_FILE` | git | t6050 | Full | cmdt/replace-grafts-native.test.ts | |
| Env | `GIT_LITERAL_PATHSPECS`, `GIT_GLOB_PATHSPECS`, `GIT_NOGLOB_PATHSPECS`, `GIT_ICASE_PATHSPECS` | git | t6130, t6131 | Full | cmd/pathspec.ts; cmdt/rm-pathspec-native.test.ts, cmdt/status-pathspec-native.test.ts | |
| Env | `GIT_ATTR_SOURCE`, `GIT_ATTR_NOSYSTEM` | git | t0003 | Full | cmd/attributes-source.ts; cmdt/attr-source-native.test.ts | |
| Env | `GIT_NO_LAZY_FETCH`, `GIT_COMMIT_GRAPH_PARANOIA` | git | t0410, t5318 | Full | cmdt/partial-clone-lazy-native.test.ts, vcs-store-files/tests/commit-graph-trust.git.test.ts | |
| Env | `GIT_PROTOCOL`, `GIT_ALLOW_PROTOCOL`, `GIT_PROTOCOL_FROM_USER` | git | t5700, t5812 | Full | vcs-transport/src/connect/; cmdt/git-native-protocol.test.ts | |
| Env | `GIT_QUARANTINE_PATH`, `GIT_PUSH_OPTION_COUNT/_n` (hook env) | githooks | t5547, t5545 | Full | cmdt/hooks-push-native.test.ts | |
| Env | `GIT_TEST_ASSUME_DIFFERENT_OWNER` | t0033 | t0033 | Full | vcs-store-files/src/safety/repository-ownership.ts; cmdt/repository-ownership-native.test.ts | |
| Env | `GIT_NAMESPACE` | git, gitnamespaces | t5509 | Full | vcs-transport/src/protocol/ref-namespace.ts; cmdt/namespaces-native.test.ts | A serve option (the host maps the variable), as upload-pack/receive-pack/http-backend use it |
| Env | `GIT_DEFAULT_HASH`, `GIT_DEFAULT_REF_FORMAT`, `GIT_REF_STORAGE_FORMAT`, `GIT_DEFAULT_OBJECT_STORAGE_FORMAT` | git | t0001 | Partial | cmd/init-command.ts, vcs-working-tree/src/convert/host-environment.ts; cmdt/sha256-objects-native.test.ts, cmdt/breaking-changes-defaults-git3-native.test.ts, cmdt/object-storage-git3-native.test.ts | `GIT_DEFAULT_HASH`, `GIT_DEFAULT_REF_FORMAT`, `GIT_DEFAULT_OBJECT_STORAGE_FORMAT` read by init; `GIT_REF_STORAGE_FORMAT` not found |
| Env | `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_ASKPASS`, `GIT_TERMINAL_PROMPT`, `GIT_SSL_NO_VERIFY` | git | t5813, t5563 | N/A | | Belong to the host's ssh/HTTP/credential implementation |
| Env | `GIT_PAGER`, `GIT_PROGRESS_DELAY`, `GIT_FLUSH`, `GIT_REDIRECT_*`, `GIT_ADVICE`, `GIT_PRINT_SHA1_ELLIPSIS` | git | t7006, t0018 | N/A | | Terminal/process concerns of the CLI |
| Env | `GIT_TRACE*`, `GIT_TRACE2*`, `GIT_TRACE_PACKET`, `GIT_TRACE_CURL` | git, api-trace2 | t0210, t0211, t0212 | None | | Tests use native git's trace2 as an oracle only |
| Env | `GIT_EXTERNAL_DIFF`, `GIT_DIFF_OPTS`, `GIT_MERGE_VERBOSITY` | git | t4020 | Full | cmd/diff-external.ts; cmdt/diff-external-native.test.ts | t4020; the program runs through the host's runner |
| Env | `GIT_OPTIONAL_LOCKS`, `GIT_REF_PARANOIA` | git | t7508, t5312 | Full | vcs-working-tree/src/convert/host-environment.ts; cmdt/optional-locks-native.test.ts, cmdt/ref-paranoia-native.test.ts | t7508, t5312 |
| Pathspec | Magic `top`, `literal`, `glob`, `icase`, `exclude` (`:!`, `:^`), `attr` | gitglossary (pathspec) | t6130, t6131, t6132, t6135, t3703 | Full | cmd/pathspec.ts; cmdt/pathspec-attr-native.test.ts, cmdt/status-pathspec-native.test.ts | Tree-walk matching for `log -- <pathspec>` too |
| Pathspec | `--pathspec-from-file` / `--pathspec-file-nul` | gitglossary | t3704, t2026 | Full | cmd/pathspec-file.ts; cmdt/pathspec-file-native.test.ts | add, rm, restore, commit, checkout, stash push (t3704, t2026) |
| Revisions | `<sha>`, abbreviations, disambiguation (`core.disambiguate`, `core.abbrev`) | gitrevisions | t1512 | Full | cmd/revision-resolver.ts; cmdt/revision-syntax-native.test.ts, cmdt/abbrev-native.test.ts | |
| Revisions | Refnames, `@`, `~n`, `^n`, `^{type}`, `^{}`, `^{/re}`, `:/re` | gitrevisions | t1500, t1511 | Full | cmd/revision-resolver.ts; cmdt/revision-syntax-native.test.ts | |
| Revisions | `@{n}`, `@{date}`, `@{-n}`, `@{upstream}`, `@{push}` | gitrevisions | t1505, t1507, t1508, t1514 | Full | cmd/revision-resolver.ts; cmdt/revision-syntax-native.test.ts | approxidate |
| Revisions | `<rev>:<path>`, `:<n>:<path>`, `./` relative paths | gitrevisions | t1506, t1513 | Full | cmd/revision-resolver.ts; cmdt/revision-syntax-native.test.ts | |
| Revisions | Ranges `a..b`, `a...b`, `^a`, `^@`, `^!`, `^-n`, `--not` | gitrevisions | t1500, t6009 | Full | cmd/revision-range.ts; cmdt/revision-syntax-native.test.ts, cmdt/log-range-fuzz-native.test.ts | |
| Sparse | Sparse-checkout cone mode | git-sparse-checkout, technical/sparse-checkout | t1091 | Full | cmd/sparse-checkout-command.ts, vcs-working-tree/src/working-copy/sparse-checkout-patterns.ts; cmdt/sparse-checkout-native.test.ts | `clean` (2.5x) too |
| Sparse | Sparse-checkout non-cone patterns | git-sparse-checkout | t1011, t1091 | Full | as above | |
| Sparse | Sparse index | technical/sparse-index | t1092 | Full | vcs-working-tree/src/staging/sparse-index.ts; cmdt/sparse-index-native.test.ts | |
| Sparse | `sparse.expectFilesOutsideOfPatterns`, `core.sparseCheckoutCone` | config/sparse, config/core | t1090 | Full | cmd/sparse-checkout-support.ts; cmdt/sparse-checkout-native.test.ts | |
| Safety | `safe.directory` (incl. `*`, realpath, 2.43 literal mode) | config/safe | t0033, t0034 | Full | vcs-store-files/src/safety/; cmdt/repository-ownership-native.test.ts, vcs-store-files/tests/repository-safety.git.test.ts | Read from protected config only |
| Safety | `safe.bareRepository` (explicit/all, implicit bare dirs) | config/safe | t0035 | Full | vcs-store-files/src/safety/discover-repository.ts; vcs-store-files/tests/repository-safety.git.test.ts | |
| Safety | Path verification (`.git` variants, NTFS/HFS, `.gitmodules` symlink) | t7450, core.protectNTFS/HFS | t7450, t1014 | Full | vcs-core/src/common/worktree-path.ts; cmdt/symlink-security.test.ts | Always on as git's defaults |
| Safety | Symlink safety (no writes through links, beyond-symlink refusals) | t0055 | t0055, t2007 | Full | vcs-utils/src/files/beyond-symlink-error.ts; cmdt/symlink-security.test.ts | |
| Safety | Submodule URL/path checks (`.gitmodules` fsck: dash URLs, paths) | fsck, t7416 | t7416, t7417 | Full | cmd/fsck/fsck-object-checks.ts; cmdt/receive-fsck-native.test.ts | `gitmodules*` msg ids on pushed objects (t7416, t7417) |
| Safety | Config include confinement for served repositories | (webrun-vcs addition) | | N/A | vcs-store-files/tests/workspace/working-copy/config-include-confinement.test.ts | Not a git feature |
| Fsmonitor | fsmonitor hook / builtin daemon (`core.fsmonitor`) | git-fsmonitor--daemon, config/core | t7519, t7527 | Full | cmd/fsmonitor-refresh.ts, cmd/fsmonitor-ipc.ts; cmdt/fsmonitor-native.test.ts | Hook programs and the builtin daemon's IPC (through a host port); never starts the daemon |
| Untracked | Untracked cache (`core.untrackedCache`, `GIT_FORCE/DISABLE_UNTRACKED_CACHE`) | git-update-index | t7063 | Full | vcs-working-tree/src/status/untracked-cache.ts; cmdt/status-untracked-cache-native.test.ts | |
| Signing | Commit signing (`gpg.format` openpgp/x509/ssh, `commit.gpgSign`, `-S`) | gitformat-signature, config/gpg | t7510, t7528 | Partial | cmd/signing.ts, cmd/ssh-signer.ts; cmdt/signing-native.test.ts, cmdt/rebase-gpg-sign-native.test.ts, cmdt/signed-merge-am-native.test.ts, cmdt/signing-refused-native.test.ts | openpgp and ssh twin-tested, commit and the rewrites (rebase, pick, revert, merge, am) through the host's signer; x509 (`gpgsm`) is configured but has no test |
| Signing | Tag signing and verification | config/gpg | t7004, t7030, t7031 | Partial | cmd/tag-command.ts, cmd/verify-command.ts; cmdt/tag-signing-native.test.ts, cmdt/verify-signatures-native.test.ts | openpgp and ssh signing and `verify-tag` twin-tested; x509 has no test; no `verify-tag --format` |
| Signing | Signature display (`%G?`, `--show-signature`) | pretty-formats | t7510 | Full | cmd/signature-check.ts, cmd/pretty-format.ts; cmdt/verify-signatures-native.test.ts | All `%G` placeholders, `log --show-signature`, `log.showSignature`; rebase's instruction format still answers `N`/`E` |
| Signing | `gpg.ssh.allowedSignersFile`, merge/pull `--verify-signatures` | config/gpg | t7612, t5573 | Full | cmd/signature-check.ts, cmd/ssh-verifier.ts; cmdt/verify-signatures-native.test.ts | t7612, t5573; also `revocationFile`, `gpg.minTrustLevel` |
| Maintenance | `gc.*` (auto, autoPackLimit, pid, worktreePruneExpire, writeCommitGraph) | config/gc | t6500 | Full | cmd/gc-command.ts; cmdt/hooks-auto-gc-native.test.ts | |
| Maintenance | `gc.cruftPacks`, `gc.bigPackThreshold`, `gc.reflogExpire*`, `gc.rerereResolved` | config/gc | t6500, t7704 | Full | cmd/gc-command.ts, vcs-store-files/src/gc.ts, rerere-gc.ts; cmdt/gc-native-twins.test.ts, cmdt/gc-native-twins-repos.test.ts, vcs-store-files/tests/cruft-pack.git.test.ts | |
| Maintenance | `pack.*` bitmap settings (writeBitmaps, writeBitmapHashCache, writeBitmapLookupTable, preferBitmapTips, useBitmaps) | config/pack | t5310 | Full | vcs-store-files/src/repack.ts; vcs-store-files/tests/pack-bitmap.git.test.ts | |
| Maintenance | `pack.window/depth/threads/compression/island`, `pack.writeReverseIndex` | config/pack | t5316, t5325 | Full | vcs-store-files/src/pack/pack-write-settings.ts, vcs-core/src/pack/delta-islands.ts; vcs-store-files/tests/pack-write-settings.git.test.ts, vcs-store-files/tests/reverse-index.git.test.ts, cmdt/repack-native.test.ts | `pack.threads` not read (one thread; packs are the same) |
| Maintenance | `fetch.writeCommitGraph`, `gc.writeCommitGraph` | config/fetch, config/gc | t5318 | Full | cmdt/fetch-commit-graph-native.test.ts | |
| Maintenance | `git maintenance` tasks and scheduler | git-maintenance, config/maintenance | t7900 | Partial | cmd/maintenance-run-command.ts; cmdt/maintenance-native.test.ts | Tasks, strategies and `maintenance.*` run (t7900); no scheduler (`register`/`start`/`stop`) |
| Misc | `core.ignoreCase` folding in walks and checkout | config/core | t6419, t7062 | Full | vcs-working-tree/src/; cmdt/untracked-icase-native.test.ts | |
| Misc | `core.precomposeUnicode` | config/core | t3910 | Partial | vcs-store-files/src/workspace/worktree/probe-case-folding.ts, cmd/init-command.ts | init and clone probe the filesystem and write the key; precomposing paths read from the filesystem not found; no native twin (macOS-specific) |
| Misc | `core.filemode`, `core.symlinks`, `core.trustctime`, `core.checkStat` (racy-git) | config/core, technical/racy-git | t0010, t2108 | Full | vcs-working-tree/src/staging/stat-refresh.ts; cmdt/add-chmod-refresh-native.test.ts, cmdt/reset-refresh-native.test.ts | |
| Misc | `core.bigFileThreshold` (streaming, no deltas) | config/core | t1050 | Full | vcs-store-files/tests-bench/large-blob-one-pass.test.ts; cmdt/add-core-blob-size.test.ts | |
| Misc | `core.maxTreeDepth` | config/core | t6700 | Full | vcs-core/src/pack/list-objects.ts | One native mention |
| Misc | Parallel checkout (`checkout.workers`) | technical/parallel-checkout | t2080 | N/A | | Performance feature; results are what matter |
| Misc | Scalar | technical/scalar | t9210 | None | | |
