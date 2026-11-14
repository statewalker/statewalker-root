# Which deterministic checks does each project run today?

Research for `statewalker/statewalker-root#5`. Sources are the projects' own files on `main` (shallow
clones read on 2026-11-14), so they are primary. Each claim cites `repo/path:line`. `S` is the
shared workflow, `.github/.github/workflows/ci.yml` in `statewalker/.github`.

## Question

What does CI run in each project listed in `repos.json` (format, lint, typecheck, build, unit tests,
browser/e2e tests, package checks, consumer install, docs)? Where are the gaps? Which "critical"
defect classes do these checks already catch before a reviewer runs?

## Short answer

- **18 of 22 projects call the shared workflow** (`S`). One job, on every PR and on every push to
  `main`, runs: frozen install, the dependency-reference convention, `lint:check`, `format:check`,
  `build`, `typecheck`, `test`, then three checks on the packed packages: export targets exist, dist
  imports are declared, and packed manifests contain no `workspace:`/`catalog:` (`S:61-93`). Any root
  script a repository does not define is skipped silently (`--if-present`, `S:68-77`).
- **Two projects run their own CI.** `cellb.dev` adds a pack/install/Vite+Chromium check and a celld
  interop job. `statewalker-sandbox` runs part of the steps, with exclusions. **`umbrella` has no CI
  at all, and `.github` does not check itself**: its workflow is `workflow_call` only, and its
  scripts have no tests.
- **Build breaks, src typecheck breaks and failing Node unit tests are caught almost everywhere.**
  Browser and e2e suites mostly are not: only `webrun-wire`, `httpeers` and `cellb.dev` run browsers
  in CI, and they run some of their suites, not all.
- **No check compares the published API with npm** (no api-extractor, attw or publint). **No check
  looks for leaked secrets** in repository files. **Nothing enforces the `sw.mjs` release path.** In
  fact, 7 projects' `ci.yml` carry OIDC `npm publish` jobs, while the umbrella and `.github` READMEs
  say "CI never publishes".

## Inventory

Legend: **Y** runs in CI on PRs · **P** partial · **N** not run · **–** nothing of the kind exists.
"pkg checks" means the shared conventions + exports + dist-imports + pack scripts (`S:65,87-93`).
Browser/e2e scripts not listed in a cell exist but are not run.

| Project | CI entry | Format | Lint | Typecheck | Build | Unit | Browser / e2e | Pkg checks | Consumer install | Docs |
|---|---|---|---|---|---|---|---|---|---|---|
| statewalker-shared | `ci.yml:10` → S | Y `package.json:27` | Y `:25` | Y `:23` (src+tests, e.g. `packages/shared-ids/tsconfig.json`) | Y `:21` | Y `:22` | – | Y | N | – |
| statewalker-fsm | `ci.yml:10` → S | Y `:27` | Y `:25` | **N**: no package defines `typecheck`, so `:23` runs nothing; the build is `tsdown` | Y `:21` (also runs tests, `packages/fsm/package.json:44`) | Y `:22` | – | Y | N | – |
| statewalker-db | `ci.yml:10` → S | Y `:29` | Y `:27` | Y `:25` | Y `:21` | P `:22`: `db-api`, `db-sqlite` have no tests | **N**: `test:browser`, `test:do` (`package.json:23-24`) | Y | **Y** `tools/consumer-install/package.json:17` (via root test; `tools/*` in workspace) | – |
| webrun-wire | `ci.yml:15` → S, + `node22` `:20-45`, `browser` `:51-80` | Y `:29` | Y `:26` | P: 9 packages have no `typecheck`, their build runs `tsc --emitDeclarationOnly`; tests typechecked in `ci.yml:45` | Y `:21` | Y `:22`, also on Node 22 `ci.yml:40` | P: http-browser, streams-webrtc (`ci.yml:74,80`); not livekit, peerjs, http-events | Y | **Y** `tools/consumer-install/package.json:16` | – |
| webrun-files | `ci.yml:10` → S | Y `:27` | Y `:24` | P: none of 10 packages has `typecheck`; build runs `tsc --emitDeclarationOnly` | Y `:21` | Y `:22` | **N**: `webrun-files-http` `test:e2e`, `webrun-files-s3` `test:integration` | Y | N | – |
| statewalker-search | `ci.yml:10` → S | Y `:27` | Y `:25` | Y `:23` | Y `:21` | P: `packages/*` only (`:22`) | – | Y | N | – |
| webrun-sites | `ci.yml:10` → S | Y `:27` | Y `:24` | P: 3 public packages build with `tsc --emitDeclarationOnly`, no `typecheck` | Y `:21` | Y `:22` | **N**: `webrun-bundler` `test:browser` | Y | **Y** `tools/consumer-install/package.json:16` | – |
| webrun-sync | `ci.yml:10` → S | Y `:23` | Y `:20` | Y `:18` (src only) | Y `:16` | Y `:17` | – | Y | N | – |
| httpeers | `ci.yml:10` → S, + `forwarded-body` `:17-58` | Y `:30` | Y `:28` | Y `:26` | Y `:24`; Docker images on PRs (`relay.yml`, `sites.yml`, `llm-appliance.yml`) | Y `:25` | P: forwarded body in Chromium+Firefox (`ci.yml:58`); not `test:browser` (conformance `test` is an `echo`), `httpeers-share` `test:e2e`, hub `test:ui`, biscuit `test:cross` | Y | N | – |
| webrun-vcs | `ci.yml:10` → S | Y `:24` | Y `:21` | Y `:18` | P `:16`: 20 examples/demos/benchmarks have no build | Y `:17` | **N**: `vcs-utils` `test:browser`, `test:app` (Playwright, `package.json:19`) | Y | N | Y: `docs` in root build; `deploy-docs.yml:43` on PRs touching `docs/**` |
| statewalker-knowledge | `ci.yml:10` → S | P: no `format:check`, `biome check` (`:12`) covers it | Y `:12` | Y `:10` | Y `:7` | Y `:8` | **N**: `test:browser` (`package.json:9`) | Y | N | – |
| cellb.dev | own `ci.yml:28-83`, `interop.yml` | P: `biome check` (`ci.yml:44,70`) | Y `ci.yml:44,70` | Y `ci.yml:46,74` | Y `ci.yml:50,80-82` | Y `ci.yml:48,75` | P: Vite+Chromium in `pack-check` (`ci.yml:53`); celld interop + Chromium (`interop.yml`); `test:e2e`, platform e2e "by hand" (`ci.yml:55-57`), `examples.yml` is `workflow_dispatch` only | P: own `scripts/pack-check.mjs`, no shared scripts | **Y** pack-check installs the tarball outside the workspace (`ci.yml:3-6`) | Y: `site.yml:45,89-98` (PR build + example/snippet checks) |
| statewalker-kernel | `ci.yml:10` → S | Y `:27` | Y `:25` | Y `:23` (src only, e.g. `workspace.core`) | Y `:21` | P `:22`: `backbone.node`, `inline.core` have no tests | – | Y | N | – |
| statewalker-ai | `ci.yml:10` → S | Y `:27` | Y `:25` | Y `:23` | Y `:21` | Y `:22` | – | Y | N | – |
| statewalker-shell-react | `ci.yml:10` → S | Y `:27` | Y `:25` | Y `:23` | Y `:21` | P `:22`: `ai-local-models.view.react` has no tests | – | Y | N | – |
| sandclaw | `ci.yml:10` → S | Y `:27` | Y `:25` | Y `:23` | Y `:21` (5 apps have no build) | Y `:22` | – | Y | N | peershare sites deploy on `main` push only |
| statewalker-sandbox | own `ci.yml:14-58` | Y `ci.yml:43` | Y `ci.yml:42` | P: all but `httpeers-lib-protos` (`ci.yml:52`) | P `ci.yml:51` (13 packages have no build) | P: excludes `httpeers-lib-protos` and 2 `httpeers-conformance` tests (`ci.yml:53-58`) | P: browsers installed (`ci.yml:41`), suites per comment `ci.yml:38-40` | – (all private) | – | – |
| statewalker-shell-theia | `ci.yml:10` → S | Y `:22` | Y `:20` | **N**: no package defines `typecheck`; packages build with `tsc` | Y `:16` | P `:17`: 11 protos/app have no tests | **N**: `test:e2e` Playwright (`package.json:18`) | Y (all private) | – | – |
| statewalker-sites | `ci.yml:10` → S | Y `:27` | Y `:25` | **N**: 0 of 5 packages define `typecheck` | Y `:21` (`observable build`) | P: 2 of 5 packages have tests | – | Y (all private) | – | Sites deploy on `main` push / dispatch only |
| webrun-devtools | `ci.yml:10-13` → S | Y `:27` | Y `:25` | Y `:23` (`tsc`) | Y `:21` | **N**: `test-command: pnpm run --if-present test`, no tests (`ci.yml:12`) | – | Y | N | – |
| umbrella | **none** (no `.github/workflows`) | N | N | N | – | N (no tests) | – | – | – | – |
| .github | **none for itself** (`ci.yml` is `workflow_call` only, `S:17-18`) | N | N | N | – | N (scripts untested) | – | – | – | – |

Line numbers without a file name are in that project's root `package.json`.

## Gaps

1. **Silent skips in the shared workflow.** Lint, format, build and typecheck run with
   `--if-present` (`S:68-77`). A repository that drops a script loses the step and CI stays green.
   This already happens to typecheck: `pnpm -r run typecheck` succeeds when no package defines the
   script (statewalker-fsm, statewalker-shell-theia, statewalker-sites), and partly in webrun-files,
   webrun-wire and webrun-sites. There, `tsc --emitDeclarationOnly` in the build still reports type
   errors in `src`. It is not verified here whether fsm's `tsdown` declaration build fails on type
   errors.
2. **Tests are not typechecked** in most projects. Many tsconfigs include only `src`
   (statewalker-kernel, webrun-sync), and vitest does not typecheck. Exceptions: webrun-wire adds
   `typecheck:tests` for this reason (`webrun-wire/.github/workflows/ci.yml:42-45`), and projects
   whose tsconfig includes tests typecheck them with `tsc --noEmit`, such as statewalker-shared
   (`packages/shared-ids/tsconfig.json:26`).
3. **Browser and e2e suites are mostly outside CI.** The shared CI runs no browser
   (`httpeers/.github/workflows/ci.yml:13-14`), and no caller passes the `setup` input (`S:24-27`).
   Not run: statewalker-db (`test:browser`, `test:do`), statewalker-knowledge (`test:browser`),
   webrun-files (`test:e2e`, S3 integration), webrun-sites (bundler), webrun-vcs (`test:browser`,
   `test:app`), webrun-wire (livekit, peerjs, http-events), httpeers (share e2e, hub UI, biscuit
   cross), statewalker-shell-theia (Playwright `test:e2e`), and cellb.dev (`test:e2e`, platform e2e,
   examples).
4. **Packages and apps without tests.** `--passWithNoTests` is the template default, so a package
   with no test files passes. Public packages with zero test files: `db-api`, `db-sqlite`
   (statewalker-db), `backbone.node`, `inline.core` (statewalker-kernel), `ai-local-models.view.react`
   (statewalker-shell-react). webrun-devtools has no tests at all. 24 webrun-vcs examples, demos and
   benchmarks, 11 shell-theia protos and 3 of the 5 statewalker-sites packages have none.
5. **Apps not built in CI**: 20 webrun-vcs examples, demos and benchmarks; 13 sandbox packages; 5
   sandclaw apps (no `build` script). Sites in sandclaw, statewalker-sites and httpeers are built only
   by deploy workflows on a `main` push. cellb's examples run on `workflow_dispatch` only.
6. **The sandbox's partial CI.** It excludes `httpeers-lib-protos` from typecheck and tests, and two
   `httpeers-conformance` tests, because they need sibling checkouts
   (`statewalker-sandbox/.github/workflows/ci.yml:44-58`). Before a release, `sw.mjs` runs only
   install + build locally for any repository with its own CI (`umbrella/tools/sw.mjs:197-202`). That
   also applies to cellb.dev.
7. **Package checks cover the shape of a package, not its API.** The shared scripts check targets,
   declared imports and packed specifiers (`.github/scripts/check-*.mjs`). Nothing runs publint,
   attw (types resolution) or an API diff against npm. publint shows up only as an optional peer of
   tsdown in lockfiles.
8. **Only 4 projects install the package as a consumer**: statewalker-db, webrun-sites, webrun-wire
   (`tools/consumer-install`, which packs the working tree) and cellb.dev (`pack-check.mjs`). Everyone
   else gets the post-publish `npmverify.sh` only (gap 9 and the next section).
9. **No CI for the release tooling.** umbrella has no workflows and no tests. `.github`'s scripts,
   which every project's CI depends on, are consumed at `@main` (`S:32-35`) with no check of their
   own.
10. **Two release paths.** Seven projects publish from CI, in two shapes: cellb.dev, httpeers,
    webrun-files and webrun-wire run version PR → `pack` → `publish`; statewalker-kernel,
    statewalker-knowledge and webrun-sites run `release` → `publish` on every merge to `main`, with
    no version PR (kernel `ci.yml:12`, knowledge `ci.yml:12`). The `publish` job runs `npm publish --provenance` behind the `npm` environment
    (`httpeers/.github/workflows/ci.yml:176-243`; `environment: npm` at
    `statewalker-kernel/.github/workflows/ci.yml:138`, where every merge to `main` releases, `:12`).
    This contradicts `umbrella/README.md:91-94` and `.github/README.md` ("CI never publishes"). From
    files alone it cannot be told whether npm trusted publishers or the environment are configured.

## Critical defect classes caught before review

| Class | Caught? | Evidence |
|---|---|---|
| Build break | **Yes**, for libraries; **partial** for apps | `S:74` on every PR; cellb `ci.yml:50,80-82`; sandbox `ci.yml:51`. Apps without a `build` script and deploy-only sites are not built on PRs (gap 5); umbrella has no CI. |
| Typecheck break | **Partial** | `S:77` covers `src` where a `typecheck` script exists. It is missing in fsm, shell-theia and statewalker-sites; build-time `tsc` covers webrun-files/wire/sites. Tests are typechecked only in webrun-wire (dedicated job) and projects whose tsconfig includes tests, such as statewalker-shared (gaps 1–2). |
| Failing tests | **Partial** | Node unit tests run everywhere except webrun-devtools (`S:84`). Browser/e2e suites are mostly not run (gap 3). The sandbox excludes some suites (gap 6). |
| Published-API break against npm | **No** (packaging defects: partial) | No API or type diff against npm anywhere (gap 7). Shape defects are caught before merge: missing export targets, undeclared dist imports, `workspace:` leaks (`S:87-93`), plus consumer install in 4 projects. `release-changesets.mjs` notices a changed `exports` map only to compute a patch bump. `sw.mjs` installs from npm and imports every entry (`umbrella/tools/npmverify.sh`, `sw.mjs:365-377`), but after publishing under `next`, not before review. |
| Leaked secret | **No** | No gitleaks, trufflehog or secret-scanning step in any workflow or lockfile. GitHub push protection may be on at the organization, but that is not visible in repository files. |
| Release-path bypass | **No** | No check enforces `sw.mjs`. 7 projects carry CI publish jobs, gated only by the `npm` environment approval (gap 10). Nothing in any repository stops a hand `npm publish` beyond npm's 2FA. Workflow-file changes get no special check. |

## Sources

- `statewalker-root/repos.json`
- `.github/.github/workflows/ci.yml`, `publish-site.yml`; `.github/README.md`;
  `.github/scripts/check-conventions.mjs`, `check-exports.mjs`, `check-dist-imports.mjs`,
  `check-pack.mjs`, `release-changesets.mjs`
- `<project>/.github/workflows/*.yml` for every project above (notably `cellb.dev/.../ci.yml`,
  `interop.yml`, `site.yml`, `examples.yml`; `httpeers/.../ci.yml`, `relay.yml`, `sites.yml`,
  `llm-appliance.yml`; `webrun-wire/.../ci.yml`; `statewalker-kernel/.../ci.yml`;
  `statewalker-sandbox/.../ci.yml`; `webrun-devtools/.../ci.yml`; `webrun-vcs/.../deploy-docs.yml`;
  `statewalker-sites/.../_deploy.yml`)
- `<project>/package.json`, `<project>/pnpm-workspace.yaml`, and every workspace package's
  `package.json` (scripts) and `tsconfig.json` (`include`)
- `statewalker-db/tools/consumer-install/` (and the same in webrun-sites, webrun-wire)
- `umbrella/README.md`, `umbrella/tools/ci-local.sh`, `umbrella/tools/sw.mjs`,
  `umbrella/tools/npmverify.sh`, `umbrella/package.json`
