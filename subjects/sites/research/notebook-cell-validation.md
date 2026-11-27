# What can validate notebook cells at build time, other than the TypeScript 5 compiler API?

Research for `statewalker/cellb.dev#236`, 2026-11-23. Statements marked **(inference)** are this
note's own reasoning, not a source's claim. Every tool ran in a scratch directory, on a copy of the
prototype taken with `git archive` from `proto/notebook-tsx-cells` (`84594eb`); no checkout was
written to. Read at: microsoft/TypeScript `8e8b077` (2026-11-23), oxc `69dd396`, cloudflare-docs
`5f658ea`, webrun-sites `41a6130` (webrun-modules 0.4.0); npm packages on 2026-11-23.

## Question

The prototype (`protos/notebook-tsx-cells`) checks `js`, `ts`, `jsx` and `tsx` notebook cells with
the `typescript@5` compiler API, because the projects use TypeScript 7 (`^7.0.2`). What else can do
this, and how do the options compare? A checker must keep the prototype's six cases:

- **T**: a type error (`const count: number = "three"`);
- **E**: an import of a missing export (`startProcesses` from `@statewalker/fsm`);
- **P**: a wrong JSX prop (`variant="bogus"` on the shadcn `Button`);
- **L**: a name defined further down the page is accepted;
- **M**: a `Mutable` is read as its value in other cells;
- **R**: every error is reported at its Markdown line, also in a reordered cell.

Two cheap cases were added for the validators without types: **U**, a misspelt name (`prise`), and
**S**, a syntax error (an unclosed `<div>`).

It must run in CI on Node, and maybe in cellb.dev's `NotebookSite` Durable Object, where packages
come from webrun-modules rather than `node_modules`.

## Short answer

- **The premise needs a correction.** TypeScript 7.0.2 does ship an API: `typescript/unstable/sync`
  and `typescript/unstable/async` start the native compiler as a child process and accept virtual
  file callbacks. Microsoft calls it unstable and promises a new API in 7.1; its paths and
  `updateSnapshot` have already changed in the 7.1 builds. On the prototype's generated modules it
  gives the same six results at the same Markdown lines, about **ten times faster** than TypeScript
  5 (90 ms to start, a few ms per page), with no temporary files.
- **Running `tsc --noEmit` from TypeScript 7** on generated files also gives the same six results,
  at 100 to 135 ms and about 60 MB per page. It is the stable fallback: only the command line and its
  output format are involved.
- **In the Durable Object, a full type check does not fit today (inference).** A Worker cannot start
  a process. TypeScript 7's wasm build (7.1 nightlies only, marked experimental) passes all six
  cases, but `tsc.wasm` alone is 53 MB of the 64 MiB Worker size limit. TypeScript 6 with
  `@typescript/vfs` passes them too, but one page used 118 to 129 MB of heap, against 128 MB per
  isolate.
- **No validator without types catches T, P or M.** Several catch U, S and E cheaply. The cheapest
  are already in the pipeline: notebook-kit's own cell parser gives each cell's declarations and
  references (U), webrun-modules' `analyze()` gives each module's export names (E), and the
  esbuild step that already strips JSX and types reports syntax errors (S).
- **Recommendation (inference):** two layers. Everywhere, a check without types built from
  notebook-kit and webrun-modules (U, S, E), as warnings in the Durable Object. In CI, the reactive
  type check on TypeScript 7 (all cases), through the unstable API with an exact version pin, or
  `tsc --noEmit` if the API breaks. Drop TypeScript 5.

## Setup

- The prototype's `reactiveChecker` was run unchanged, with one hook added to the scratch copy of
  `typecheck.ts` that saves each generated module and its line map. It passes all six cases on
  TypeScript 5.9.3, at 245 to 680 ms per page (a new program for each page).
- Every typed option below was given **the same generated modules** and mapped back with the
  prototype's segments, so the results compare like with like.
- The validators without types were given each cell as its own file (`cell-<n>.<mode>`), plus the
  list of names the page defines (its cells' declarations and imports) and the notebook globals,
  since a linter only knows names it is told about.
- Times are wall time on this sandbox; memory is the peak resident size of the largest process.

## Findings

### 1. TypeScript 7 from the command line (`tsc --noEmit`)

`typescript@7.0.2` with a `tsconfig.json` equal to the prototype's compiler options:

| Case | Result | Time | Peak memory |
|---|---|---|---|
| ts-error | `(18,7) TS2322` → Markdown 6:7 | 130 ms | 53 MB |
| removed-api | `(17,10) TS2724 … 'startProcesses'. Did you mean 'startProcess'?` → 4:10 | 109 ms | 54 MB |
| jsx-prop-error | `(26,9) TS2322 '"bogus"' …` → 10:9 | 128 ms | 63 MB |
| later-definition, mutable-value | no errors | 102 to 111 ms | 53 MB |
| reordered-error | `(24,28) TS2339 toUpperCase` → 4:28 | 100 ms | 53 MB |
| demo page | no errors | 133 ms | 66 MB |

TypeScript 5.9.3 and 6.0.3 on the same files: 690 to 830 ms and 171 to 187 MB per run. TypeScript
6.0.3 gives the same messages as 5.

What it costs: the generated module must be written to disk beside the page (so its imports resolve
as the page's do), and the `file(line,col): error TSnnnn: message` lines parsed. The package is
3.6 MB plus a 27 MB native binary per platform (`@typescript/typescript-linux-x64`).

### 2. TypeScript 7's API (`typescript/unstable/sync`)

- `typescript@7.0.2` exports `./unstable/sync`, `./unstable/async`, `./unstable/fs`,
  `./unstable/ast` and others (`package.json`). The sync `API` spawns the bundled `tsc` with
  `--api`, talks to it over stdin and stdout (`dist/api/syncChannel.d.ts`: "Pure JS replacement for
  @typescript/libsyncrpc"), and takes `fs` callbacks (`readFile`, `fileExists`, `directoryExists`,
  `getAccessibleEntries`, `realpath`) that may answer for any path or fall back to the disk
  (`dist/api/options.d.ts`, `dist/api/fs.d.ts`). A `Program` has `getSyntacticDiagnostics` and
  `getSemanticDiagnostics` per file (`dist/api/sync/api.d.ts`).
- A 50-line harness served the seven generated modules and a tsconfig from memory, and read the
  packages from disk:
  - all six cases right, at the same Markdown lines and columns as the prototype;
  - start and project load: 84 to 92 ms; diagnostics of all seven pages: 25 to 29 ms; after an edit
    to one page, a new snapshot and its diagnostics: 3 ms;
  - memory: 52 MB for Node and 63 MB for the `tsc` child.
  - One pitfall: a generated module with no `import` is a script, so several of them in one project
    redeclare the prelude. Appending `export {}` (no new line numbers) fixes it.
- **Status.** The TypeScript 7.0 release post says 7.0 "does not ship with an API" and that 7.1 will
  ship "a new (and different) API" (search excerpt of devblogs.microsoft.com, which this session
  could not open). The staging repository's README lists "API: not ready". The 7.1 builds already
  differ: `typescript@7.1.0-beta` (2026-10-20) exports `./sync` instead of `./unstable/sync`, and
  `createSnapshot` replaces `updateSnapshot`. So pin an exact version and expect to change the
  harness on each minor release (inference).
- **7.1 adds synthetic programs** (`createPrograms: [{ rootFiles, compilerOptions }]`, no tsconfig
  file), which suit generated modules. They take compiler options as numbers: a string such as
  `"es2022"` made the server panic (`interface conversion: interface {} is string, not float64`).

### 3. TypeScript 7 in wasm (for a browser or an isolate)

- The nightly `typescript@7.1.0-dev.20261123.1` exports `./wasm` (`WasmTransport`,
  `instantiateWasm`), with `@typescript/typescript-wasip1-wasm` holding `lib/tsc.wasm`. Both READMEs
  say "experimental … may change without notice". `7.1.0-beta` does not export `./wasm` yet.
- `tsc.wasm` is **53.1 MB** (13.3 MB gzipped). The default libraries are embedded and read at
  `bundled:///libs/…`; the file callbacks must hand those paths back with `serverFS.useOS`.
- Run in Node, every other file served through callbacks (as a Durable Object would serve them):
  - all six cases right, at the right Markdown lines;
  - 36 files (1.4 MB) read through the callbacks for seven pages;
  - wasm compile 100 ms, instantiate plus program 0.7 to 1.0 s, diagnostics of seven pages 280 ms;
  - wasm linear memory 46 to 66 MB; but Node's resident size reached 700 to 940 MB, most likely the
    compiled code of a 53 MB module (inference; not measured in workerd).
- Cloudflare's limits (`workers/platform/limits.mdx`): a Worker may be 64 MiB uncompressed ("There
  is no compressed size limit"), an isolate may use 128 MB "including the JavaScript heap and
  WebAssembly allocations", and startup must finish within 1 second. `tsc.wasm` would take most of
  the size budget, and 66 MB of linear memory half of the memory budget before anything else runs
  **(inference)**.

### 4. TypeScript 6 with `@typescript/vfs` (browser or isolate)

- `@typescript/vfs` 1.6.6 builds a TypeScript `System` over a `Map` of path to text
  (`createSystem`, `createVirtualCompilerHost`); `createDefaultMapFromCDN` fetches the lib files
  from `playgroundcdn.typescriptlang.org`, and package types are the caller's job (the playground
  uses `@typescript/ata`, which fetches `.d.ts` files from jsDelivr) (its README and `dist`).
- Run fully in memory on TypeScript 6.0.3: 140 to 146 files, 5.4 MB (all lib files plus every
  `.d.ts` and `package.json` of the eight packages involved). All six cases right.
  - one page alone: 0.75 to 1.0 s, 118 to 129 MB heap, 224 MB resident;
  - seven pages as separate programs: 2.8 s, 303 MB heap.
  - Loading `typescript` itself: 170 ms, 22 MB heap; `lib/typescript.js` is 9.1 MB (1.6 MB
    gzipped).
- A page's check reads 58 lib files (2.7 MB) and these declaration files: `@types/react` (3 files,
  186 KB), `csstype` (937 KB), `tailwind-merge` (135 KB), `@statewalker/fsm` (`dist/index.d.ts`,
  37 KB), `class-variance-authority`, `clsx`, `@radix-ui/react-slot` (a few KB), plus the page's own
  `button.tsx`.
- A single page lands at the 128 MB isolate limit, so it is unsafe in the Durable Object
  **(inference)**. Restricting `lib` and sharing one program across pages would help; not tried.

### 5. Keeping TypeScript 5 or 6 as a pinned devDependency

- TypeScript 5.9.3 (2025-09-30) is the last 5.x; 6.0.3 (2026-04-16) is the last 6.x. Microsoft
  intends 6.0 to be "the last release based on the current JavaScript codebase" (TypeScript 6.0
  post, via search excerpt). For tools that still need the old API it published
  `@typescript/typescript6` (6.0.2, a `tsc6` executable, npm).
- Both work today and will keep working for the code they understand, but they will not learn
  TypeScript 7's new syntax or checks, and packages whose `.d.ts` files start using 7-only features
  will break them. The horizon is one or two years, and shrinking **(inference)**.
- Deno 2.9.6 is a variant of this option: `deno check` passes all six cases, but it embeds
  TypeScript 6.0.3 (`deno --version`), takes 0.55 to 1.0 s and 220 to 270 MB per page, and its
  binary is 92 MB.

### 6. Validators without types

| Tool | U unknown name | S syntax | E missing export | T, P, M |
|---|---|---|---|---|
| **notebook-kit's `parseJavaScript`** | yes | yes (JS and TS; JSX via esbuild) | no | no |
| **webrun-modules' `analyze()`** | yes (free globals) | yes | yes, with resolution | no |
| **oxlint** 1.95 | yes (`no-undef` + globals) | yes | only in `.js` (`import/named`) | only with `--type-check` |
| **Biome** 2.6.8 | yes (`noUndeclaredVariables`) | yes | yes (`noUnresolvedImports`) | no |
| **esbuild** 0.28 (bundling) | no | yes | yes (ESM targets) | no |
| **swc** 1.16 (`parse`) | no | yes | no | no |
| **es-module-lexer** 3.0 | no | (JS only) | yes, with resolution | no |

None of them rejects L (a later definition), since nothing about order is checked; M is a type
question. Each reports a line and column per cell file, so mapping to the Markdown is the cell's
start line plus an offset (R).

- **notebook-kit** (already a dependency): `parseJavaScript(input, "ts")` returns a cell's
  `declarations` and `references` (`dist/src/javascript/parse.d.ts`), and `defaultGlobals` lists the
  browser globals it allows. A 30-line check, references minus (declarations of all cells, globals,
  notebook builtins), found `prise` and nothing else. JSX must be stripped first (esbuild here), as
  the prototype's emit step already does; in the `tsx` syntax case it was that esbuild step that
  reported the error, before notebook-kit saw the cell.
- **webrun-modules** (already used for serving): `analyze()` strips TS/JSX with sucrase, parses with
  acorn, and returns each module's own export names plus its free globals, found with
  `acorn-globals`, under the `""` key (`src/transform/analyze.ts`, `ModuleDescriptor` in
  `src/types.ts`). `export * from` is recorded only as an import edge, so a missing-export check
  must follow it; CommonJS exports come from `cjs-module-lexer`, best effort.
- **oxlint**: about 50 ms and 80 to 90 MB per page. `import/named` found `startProcesses` in a
  `.js` cell but is switched off for TypeScript files: "This rule is disabled in the typescript
  config. `if ctx.source_type().is_typescript()`" (`crates/oxc_linter/src/rules/import/named.rs`
  lines 121 and 122). Linting the type-stripped JavaScript would avoid that **(inference)**.
  - `oxlint --type-aware --type-check` runs `oxlint-tsgolint` (typescript-go) and reported the
    four type errors of the generated modules in 232 ms and 85 MB. That is TypeScript 7 again, from
    a third party, with no virtual files.
  - No wasm build of oxlint is published; `oxc-parser` has one (1.8 MB, 0.6 MB gzipped), which
    gives syntax errors and the module's imports and exports, not scopes.
- **Biome**: about 50 ms and 39 MB per page. `noUnresolvedImports` reported "The module
  @statewalker/fsm has no export named startProcesses" in a `.tsx` cell, accepted the correct
  `startProcess`, and caught a missing export of the page's local `button.tsx`. It needs a
  `package.json` at the project root; without one, it said "cannot be resolved: module not found"
  for every bare import, correct or not. The browser build `@biomejs/wasm-web` is 70 MB (18 MB
  gzipped), over the Worker size limit.
- **esbuild**: a bundle of the cell fails with `No matching export in ".../fsm/dist/index.js" for
  import "startProcesses"`, and on the syntax error. It does not check undeclared names. The
  prototype already runs esbuild (`esbuild.transform`) and webrun-bundler for every cell.
- **swc**: `parse` gives syntax errors only; no linter for scopes or imports.
- **es-module-lexer**: lists the export names of the resolved ESM entry of `@statewalker/fsm` (44
  names, 0.24 ms for 47 KB) and so flags `startProcesses`. It needs the resolution done by someone
  else, cannot see through `export *` on its own, and does not read CommonJS. Note that 3.x renamed
  the fields (`specifier`, `importStart`, `name`).

### 7. Can webrun-modules serve `.d.ts` files at the pinned versions?

Yes for the files themselves, with gaps around them:

- **The files are there.** `cacheRaw` writes every file of a package's tarball to
  `/raw/<name>@<version>/…` (`src/preprocess/resolve.ts` lines 92 to 111), so `.d.ts` files are
  cached. `listPackageFiles` lists them, package-relative and sorted
  (`src/server/new-module-server.ts` lines 198 to 212).
- **Pinned.** The lockfile is name to version (`Lockfile` in `src/types.ts`), and `ensurePackage`
  loads the locked version even on a cold cache (`resolve.ts` lines 141 to 148). So the types read
  are those of the code served.
- **Raw only with `?raw`.** `MODULE_EXT` (`/\.(?:m|c)?[jt]sx?$/`) matches `index.d.ts`, so a plain
  request sends it through `toJs` (sucrase strips the types: `src/transform/to-js.ts`) and serves
  a near-empty module. `?raw` goes through `serveRaw` and `rawBytes`, which read the cached bytes
  as they are (`resolve.ts` lines 714 to 733).
- **Gaps (inference):**
  - entry resolution uses only the `browser` or `node` conditions (`src/resolution/resolve-entry.ts`
    line 54), not `types`; a checker would read the raw layout through its own file system adapter
    (`node_modules/<name>/` mapped to `/raw/<name>@<locked version>/`) and let TypeScript resolve;
  - `@types/react` is a separate package that the runtime graph never reaches; the checker must ask
    for it, with a version matched to `react`'s;
  - TypeScript's hosts are synchronous (the TypeScript 5 `CompilerHost`, the 7.0 sync API
    callbacks) while a `FilesApi` is asynchronous, so the declaration files must be fetched into
    memory first. The 7.1 wasm transport says its callbacks "may return promises"
    (`src/wasm/transport.ts`), which would avoid that, through the async API.

## Comparison

Checks: T type error, E missing export, P JSX prop, L later name, M `Mutable` value, R Markdown
lines, U unknown name, S syntax. "Isolate" means a Workers isolate (Durable Object).

| Option | Checks | Node | Browser / isolate | Size | Speed per page (measured) | Maintenance |
|---|---|---|---|---|---|---|
| TypeScript 5 API (prototype) | all | yes | browser only in practice (9 MB, heap) | 23 MB | 245 to 680 ms in-process | 5.9.3 is the last 5.x |
| TypeScript 7 `tsc --noEmit` | all | yes (temp files) | no (process) | 3.6 MB + 27 MB binary | 100 to 135 ms, 53 to 66 MB | stable CLI, current |
| TypeScript 7 unstable API | all | yes (virtual files) | no (process) | as above | 90 ms start, ~4 ms per page, 3 ms re-check | unstable; renamed in 7.1 |
| TypeScript 7 wasm (7.1 nightly) | all | yes | isolate: 53 MB wasm vs 64 MiB, 128 MB memory | 53 MB wasm | 0.7 to 1.0 s start, ~40 ms per page | experimental, nightly only |
| TypeScript 6 + `@typescript/vfs` | all | yes | browser yes; isolate at the memory limit | 9.1 MB JS + 5.4 MB files | 0.75 to 1.0 s, 118 to 129 MB heap | 6.0.3 is the last JavaScript TypeScript |
| TypeScript 5/6 tools package | all | yes | no | 23 to 24 MB | 0.7 to 0.8 s CLI | frozen; drifts from 7 |
| Deno `check` | all | yes (Deno binary) | no | 92 MB | 0.55 to 1.0 s, 220 to 270 MB | embeds TypeScript 6.0.3 |
| oxlint `--type-check` | all (tsgo) | yes | no | 2.5 + 16 + 22 MB | 232 ms, 85 MB | active, third party |
| notebook-kit `parseJavaScript` | U, S, R | yes | yes (already bundled) | 0 (dependency) | not timed (one parse per cell) | Observable |
| webrun-modules `analyze()` | U, S, E, R | yes | yes (already used) | 0 (dependency) | not timed | ours |
| oxlint | U, S, E (`.js` only), R | yes | no (no wasm) | 2.5 + 16 MB | ~50 ms, 80 to 90 MB | active (2026-11-23) |
| Biome | U, S, E, R | yes | no (70 MB wasm) | 96 MB binary | ~50 ms, 39 MB | active (2026-11-15) |
| esbuild (bundle) | S, E, R | yes | `esbuild-wasm` 14 MB | 11 MB | not timed | active |
| swc (`parse`) | S, R | yes | `@swc/wasm-web` 18 MB | 11 MB | not timed | active |
| es-module-lexer | E (with resolution), R | yes | yes (254 KB) | 254 KB | 0.24 ms per 47 KB | active |

## Recommendation (inference)

1. **A check without types, everywhere** (CI and the Durable Object, as warnings there). Build it
   from what the pipeline already holds, so it adds no dependency:
   - unknown names (U): notebook-kit's declarations and references across the page's cells, minus
     its `defaultGlobals` and the notebook builtins;
   - syntax (S): notebook-kit's (or esbuild's) parse errors;
   - missing exports (E): resolve each import through webrun-modules and compare the imported names
     with `analyze()`'s `exports` of the target, following `export *`.

   It replaces nothing in CI; it gives the Durable Object a useful answer for nearly no cost.
2. **The full reactive type check in CI only, on TypeScript 7.** Keep the prototype's generated
   module and line map. Run it through `typescript/unstable/sync` with the module served from
   memory and an exact `typescript` pin, behind the `TypeChecker` interface; keep a `tsc --noEmit`
   runner on temporary files as the fallback when an upgrade breaks the API. Move the per-cell
   analysis (outputs, references, import positions) off the TypeScript 5 parser, to notebook-kit's
   `parseJavaScript` or `oxc-parser`, so that TypeScript 5 can be dropped.
3. **No full type check in the Durable Object for now.** Neither TypeScript 7 wasm nor TypeScript 6
   with `@typescript/vfs` fits the 64 MiB and 128 MB limits with room for the site. Look again when
   `typescript/wasm` ships in a stable 7.1 release.
4. **Do not add a TypeScript 5/6 tools package for this.** It is the end of that line, and the CI
   check does not need it.

## Open questions

- When does TypeScript 7.1 ship its stable API, and does `typescript/wasm` become stable with it?
- Does `tsc.wasm` instantiate inside workerd at all within 128 MB? Only Node was tried.
- Should webrun-modules offer a "types" view (raw `.d.ts` by default, `types` condition, matching
  `@types/*` packages), or should the checker adapt the raw cache itself?
- Which notebook builtins get real types in the prelude (`Plot`, `d3`, `Inputs` are `any` now)?

## Sources

- The prototype, `cellb.dev` branch `proto/notebook-tsx-cells` at `84594eb`: `README.md`,
  `src/checkers.ts`, `src/typecheck.ts`, `src/parse.ts`, `test/build.test.ts`, `test/fixtures/*.md`.
  Ticket statewalker/cellb.dev#236.
- TypeScript 7.0.2 npm package: `package.json` (`exports`), `dist/api/sync/api.d.ts`,
  `dist/api/options.d.ts`, `dist/api/fs.d.ts`, `dist/api/proto.d.ts`, `dist/api/syncChannel.d.ts`,
  `dist/api/sync/client.js`.
- TypeScript 7.1 builds: `typescript@7.1.0-beta` and `typescript@7.1.0-dev.20261123.1`
  (`package.json` exports, `dist/api/sync/api.d.ts`, `dist/api/proto.generated.d.ts`,
  `dist/api/fs.d.ts`, `dist/api/fsCallbacks.d.ts`, `dist/wasm/wasi.d.ts`);
  `@typescript/typescript-wasip1-wasm@7.1.0-dev.20261123.1` (`README.md`, `lib/tsc.wasm`).
- microsoft/TypeScript https://github.com/microsoft/TypeScript at `8e8b077` (2026-11-23):
  `packages/typescript/package.json`, `packages/typescript/src/wasm/transport.ts`,
  `packages/typescript-wasip1-wasm/README.md`, `tsc/internal/bundled/embed.go`, `Herebyfile.mjs`.
- microsoft/typescript-go https://github.com/microsoft/typescript-go at `89d5d5b` (2026-08-20):
  `README.md` ("This Repo Is Closed"; feature table, "API: not ready").
- TypeScript blog posts "Announcing TypeScript 7.0" (2026-07-08) and "Announcing TypeScript 6.0",
  devblogs.microsoft.com, read only as web search excerpts: the host was not reachable from this
  session.
- cloudflare-docs https://github.com/cloudflare/cloudflare-docs at `5f658ea` (2026-11-23):
  `src/content/docs/workers/platform/limits.mdx` (source of developers.cloudflare.com, which was not
  reachable).
- oxc https://github.com/oxc-project/oxc at `69dd396`: `crates/oxc_linter/src/rules/import/named.rs`,
  `apps/oxlint/src/config_loader.rs` (`typeCheck`); `oxlint --help` (1.95.0).
- Biome 2.6.8: `biome explain noUnresolvedImports`.
- `@typescript/vfs` 1.6.6: `README.md`, `dist/vfs.esm.js`. `@typescript/ata` 0.9.8 (npm
  description).
- `@observablehq/notebook-kit` 2.11.0: `dist/src/javascript/parse.d.ts`, `globals.js`,
  `transpile.d.ts`.
- webrun-modules 0.4.0 (webrun-sites `41a6130`): `src/server/new-module-server.ts`,
  `src/preprocess/resolve.ts`, `src/transform/to-js.ts`, `src/transform/analyze.ts`,
  `src/resolution/resolve-entry.ts`, `src/types.ts`.
- npm registry metadata (`npm view`, 2026-11-23) for typescript, `@typescript/typescript6`,
  `@typescript/native-preview`, oxlint, oxlint-tsgolint, oxc-parser, `@biomejs/biome`,
  `@biomejs/wasm-web`, `@swc/core`, `@swc/wasm-web`, esbuild, esbuild-wasm, es-module-lexer, deno.
- Hands-on runs: the harnesses, generated modules and logs stayed in the session's scratch
  directory. Versions: typescript 5.9.3, 6.0.3, 7.0.2, 7.1.0-dev.20261123.1; oxlint 1.95.0;
  oxlint-tsgolint 7.0.2008; Biome 2.6.8; esbuild 0.28.2; `@swc/core` 1.16.22; es-module-lexer 3.0.5;
  Deno 2.9.6; Node 22.23.5.
