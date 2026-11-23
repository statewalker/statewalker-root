# How far are notebook-build and cellb.dev's notebooks theme from a static site build in CI?

Research for `statewalker/statewalker-root#233`, 2026-11-23. Statements marked **(inference)** are
this note's own reasoning, not a source's. Read at: cellb.dev `2251670`, statewalker-knowledge
`75f2c32` (notebook-build 0.3.0), statewalker-sites `83ee6aa`, webrun-vcs `479fa64`, httpeers
`9e4d350`; npm packages `@observablehq/notebook-kit` 2.11.0, `@observablehq/framework` 1.13.4,
`@statewalker/webrun-modules` 0.4.0. Short names: `NB` = `cellb.dev/packages/notebooks/`,
`KB` = `statewalker-knowledge/packages/notebook-build/`, `KIT` = notebook-kit's `dist/src/`,
`FW` = Framework's `dist/`. The sites themselves are described in
[`project-sites-inventory.md`](project-sites-inventory.md).

## Question

How far are `@statewalker/notebook-build` (statewalker-knowledge) and cellb.dev's
`packages/notebooks` (page models and the Astro theme) from building a **static project site in
CI**, with live cells, from a folder of Markdown notebook pages?

- What runs today only inside the `NotebookSite` Durable Object, and what already runs in Node at
  build time?
- Which features the current sites use are supported, and which are missing.
- What it takes to convert statewalker-sites' Observable Framework pages to notebook pages.
- How cellb.dev's live examples and the httpeers/webrun-vcs `src/examples/*.ts` pattern map onto
  live cells.

## Answer

Close for the core, far for the edges. The heart of the pipeline is already portable code:
`buildPageModels` (`NB/src/page-models.ts:263-419`) takes a `FilesApi`, a module resolver and a
DOM, and calls only notebook-build stages, markdown-it and acorn. notebook-build itself already
builds a static site under Node (`KB/README.md:48-79`, `apps/demo/serve.mjs`). What ties the
pipeline to the Durable Object is the glue around it: SQLite-backed file stores, data loaders run
as bundled Workers, SQL run in sibling objects, and a theme that is an Astro **server** build fed
through a Worker Loader and then crawled into a ZIP.

For a CI build the theme must become a static Astro build whose content collection calls
`buildPageModels` at build time, and three features must be added that neither package has:
**JSX/TSX cells** (notebook-kit has no such mode), **imports of the project's own modules and
workspace packages** (relative imports pass through untouched and npm imports come from the public
registry), and **Tailwind/shadcn styling** (the theme is plain CSS). The statewalker-sites pages
convert mostly mechanically, with one trap: notebook pipeline treats a ` ```typescript ` fence as a
live cell, Framework does not, and the FSM and Dots sites have about 50 such fences meant as
static code.

## 1. What runs only in the Durable Object, and what already runs in Node

### Already portable (runs in Node as is, or nearly)

| Piece | Where | Why it is portable |
|---|---|---|
| notebook-build's whole pipeline: parse, resolve, transpile, render, attachments, static dependency closure | `KB/src/*`, `KB/README.md:12-18`, `:48-79` | "no bundler and no DOM global, so a build can run under Node or in a browser against any `FilesApi`"; `mode: "static"` materializes the closure (`KB/src/build.ts:518`) |
| Page models: notebook → document → prose HTML, outline, cell blocks, module script | `NB/src/page-models.ts:263` (`buildPageModels`) | inputs are `FilesApi`, `ModuleResolver`, `DomEnv`; uses only `resolveNotebook`, `transpileNotebook`, `parseNotebookHtml` (`:19-28`) |
| `${…}` extraction, fence attributes, Portable Text | `NB/src/portable-text.ts:102` (`parseInfo`), `:186` (`extractExpressions`), `:248` (`markdownToDocument`), `:395` (`renderProse`) | pure functions, tested in Node (`NB/test/portable-text.test.ts`) |
| Search index | `NB/src/search.ts`, built inside `buildPageModels` (`:415`) | pure |
| Built-ins without a CDN (esm.sh → local module URLs) | `NB/src/builtins.ts:46` (`withLocalBuiltins`), `:140` (`builtinClosure`) | wraps any webrun-modules server |
| Loader naming rules, data-file filters, SQL guard | `NB/src/data-loaders.ts:20-118`, `NB/src/sql-guard.ts` | pure |
| Precomputed SQL writer | `@statewalker/notebook-db` `precomputeQueries` | "runs in the browser and under Node; which one depends on the driver" (notebook-db README) |
| Module server | `@statewalker/webrun-modules` | "The code uses no Node built-ins" (its README, line 47) |

### Only in the Durable Object today

| Piece | Where | What ties it to the object |
|---|---|---|
| Source, output, cache, module, model, data and SQL stores | `NB/src/index.ts:156-162` | `SqlFilesApi` over `ctx.storage.sql` |
| Data loaders | `NB/src/index.ts:323-398` (`runLoaders`), `NB/src/data-loaders.ts:124` (`loaderProject`) | each loader is bundled by the platform bundler (`handleBuilds`) into a Worker project and run once in a Worker Loader isolate |
| Precomputed SQL | `NB/src/index.ts:172-230` (`queryDatabase`), `:232` (`precomputeSql`) | the database script runs in a sibling `NotebookSite` object's SQLite, inside `transactionSync` |
| Themed pages | `NB/src/index.ts:465-492` (`themed`), `NB/theme/src/live.config.ts:7` | theme is `output: "server"` with the Cloudflare adapter (`NB/theme/astro.config.mjs:4-8`); models arrive as `env.NOTEBOOK_MODELS` from `cloudflare:workers`, read by live collections; rendered in a Worker Loader isolate |
| Theme build | `NB/README.md:52-53`, `:233` | built by the platform's bundler (`POST /builds`), not `astro build` |
| Static export | `NB/src/index.ts:562-680` (`exportSite`) | crawls the server-rendered theme page by page, then adds modules, built-ins, data files, SQL results and `search.json` into a ZIP under `/nb/<site>/t/…` paths |
| npm source | `NB/src/index.ts:495-507` (`moduleServer`) | registry reached through the platform's `registryFetch(env)` |

**(inference)** In CI, every row of the second table has a simpler Node replacement: Node
`FilesApi`s for the stores; `import()` of the loader module for data loaders (no bundling, no
isolate: a loader's default export is already the data, `NB/README.md:118-131`); a Node SQLite
driver of `@statewalker/db-api` plus `precomputeQueries` for SQL; `astro build` with
`output: "static"` for the theme; and Astro's own output (plus an integration that copies modules,
data and SQL files) for the export. None of this needs the platform.

## 2. Features: supported and missing

Columns: **KB** = notebook-build's plain pages; **NB** = cellb's themed pages (page models).

| Feature | KB | NB | Notes |
|---|---|---|---|
| Framework-style Markdown, `js`/`ts` fences as cells | yes | yes | `KB/src/md-parse.ts:10-24`, `NB/src/portable-text.ts:76-93` |
| `${…}` inline expressions | no | yes | KB renders prose with markdown-it at build time, so `${x}` stays text (`KB/src/render.ts:93`). NB takes expressions out before parsing (`NB/README.md:66-70`) |
| `display()`, `view()` | yes | yes | notebook-kit's `define()` (`KIT/runtime/define.js:12-34`) |
| `width`, `now`, `Generators`, `Mutable`, `FileAttachment` | yes | yes | `KIT/runtime/stdlib/index.js:13-28` |
| `Inputs`, `Plot`, `d3`, `tex`, `dot`, `htl`, … as built-ins | CDN | yes | notebook-kit loads them from esm.sh (`KIT/runtime/stdlib/tex.js:2`, `inputs.css:1`); NB rewrites to local modules and exports them (`NB/README.md:212-226`) |
| `npm:` imports | yes | yes | resolved through webrun-modules to same-origin URLs (`KB/src/resolve.ts:185-201`) |
| Bare imports of published packages (`@statewalker/fsm`) | latest | latest | `isNpmSpecifier` takes bare names (`KB/src/resolve.ts:164-170`); the server resolves to latest unless a `lock` is seeded (webrun-modules README, "Note" in "Serve a whole site") |
| Imports of the project's **own modules** (`../components/x.js` → `x.ts`) | **no** | **no** | relative and absolute specifiers "pass through unchanged" (`KB/src/transpile.ts:63-70`); nothing compiles or copies them. Framework finds `.ts/.jsx/.tsx` for a `.js` import and transpiles it with esbuild (`FW/javascript/module.js:147-153`) |
| Imports of **workspace packages** (unpublished or newer than npm) | **no** | **no** | only `npmRegistrySource` is wired (`NB/src/index.ts:499`); webrun-modules accepts custom `Source`s and a `project` FilesApi whose TS/TSX it transpiles (README "A custom Source", "Serve a whole site") |
| **`jsx` / `tsx` cells (React)** | **no** | **no** | notebook-kit's `CellMode` has no jsx/tsx (`KIT/lib/notebook.d.ts:2`); its `ts` only erases types (`KIT/javascript/typescript.js`, `stripTypes`). Framework compiles jsx with esbuild (`jsxImportSource: "npm:react"`, `FW/javascript/module.js:192-205`) and renders with `react-dom`'s `createRoot` (`FW/client/main.js:83-94`, `FW/resolvers.js:92-95`) |
| `html`, `tex`, `dot`, `mermaid`, `svg` fences as live cells | inert | inert | both keep them as markup or code (`KB/src/transpile.ts:36-40`, `NB/src/page-models.ts:180-183`); Framework runs them (`FW/markdown.js:35-36`) |
| Data loaders | no | DO only | KB has none; NB's are modules returning data, not Framework's stdout scripts (`NB/README.md:127-131`) |
| `FileAttachment` relative to the page | yes | yes | KB copies them (`KB/src/assets.ts`); NB registers data files at absolute URLs (`NB/src/page-models.ts:224-249`) |
| `FileAttachment("/abs/path")` from the site root | **no** | data files only | KB resolves every name inside the notebook's directory (`KB/src/paths.ts:21-36`): **(inference)** `/documentation/x.json` from `/documentation/concepts/a.md` lands at a doubled path and fails. NB registers root paths only for files in `dataFiles` (`:240-246`) |
| SQL cells, live (`database=var:x`, none) | yes | yes | `KB/README.md:165-183` |
| SQL cells, precomputed (`database=name`) | caller's job | DO only | `KB/README.md:188-193`; NB `NB/src/index.ts:232` |
| Fence attributes `echo`, `run=false`, `hidden` | **no** | yes | "a Markdown fence has no attribute syntax" in KB (`KB/README.md:167-168`); NB parses the info string (`NB/src/portable-text.ts:102-116`, `NB/README.md:75-84`) |
| Search index | no | yes | `NB/src/search.ts`; search box with no library (`NB/README.md:99-114`) |
| Outline / table of contents | no | yes | `PageModel.outline` (`NB/src/page-models.ts:68`), rendered in `NB/theme/src/layouts/Notebook.astro` |
| Front matter | `title`, `theme` | `title`, `theme` | flat `key: value` (`KB/src/md-parse.ts:29-38`); Framework's `toc`, `sidebar`, `layout`, `author`, `date` are ignored |
| Navigation with sections | no | flat list | `SiteModel.pages` is flat, ordered by path (`NB/src/page-models.ts:406-413`); Framework's `pages` config has nested, collapsible sections |
| Tailwind + shadcn/ui | no | no | theme is plain CSS (`NB/theme/package.json`: `astro` and `@astrojs/cloudflare` only) |

One difference in meaning, not in features: NB and KB map ` ```typescript `, ` ```javascript `,
` ```py ` and others to live modes (`NB/src/portable-text.ts:76-90`). Framework runs only
`js`, `ts`, `jsx`, `tsx`, `tex`, `html`, `sql`, `svg`, `dot`, `mermaid`
(`FW/markdown.js:35-36`); ` ```typescript ` is shown as code there.

## 3. Converting statewalker-sites' Framework pages

What the three sites use (counted over `src/**/*.md`):

| | site-fsm | site-dots | blog |
|---|---|---|---|
| pages | 27 | 9 | 8 |
| ` ```ts ` / ` ```js ` live cells | 32 / 3 | 8 (2 `echo`) | 3 / 1 |
| ` ```ts run=false ` | 43 (+2 `typescript run=false`, 1 `html run=false`) | 0 | 0 |
| ` ```typescript ` (static in Framework) | 21 | 30 | 4 |
| `${…}` | 31 | 8 | 23 |
| `view(` / `display(` | 13 / 1 | 1 / 0 | 0 / 3 |
| imports of local `.ts` modules (`../components/renderProcess.js`, `/components/…`, `./lib/…`) | yes, about 15 | yes, 4 | yes, 1 |
| bare `@statewalker/fsm` imports | 20 | 0 | 0 |
| `npm:` imports | 2 (`d3`, `yaml`) | 0 | 1 (`d3`) |
| `FileAttachment` | 4, all root-absolute | 0 | 0 |
| `Inputs`, `htl.html`, `dot`, `tex` | yes | `dot` | `tex` (20) |
| Framework layout classes (`class="grid …"`, `class="card"`) | 10 / 13 | 0 | 2 / 0 |
| data loaders, SQL, `jsx`/`tsx` | none | none | none |

Config: each site's `observablehq.config.js` has a nested `pages` tree with titles and `open`
flags; the blog sets `search: true`, `linkify`, `typographer`, `preserveExtension`,
`preserveIndex`. Each package deploys with `wrangler deploy`.

What a conversion needs, in order of weight **(inference)**:

1. **Local modules.** About 20 imports across the sites reach `src/components/*.ts`,
   `src/lib/*.ts` and `src/shared/**`. Without local-module support (gap 2 below) these pages
   cannot run. This is the blocker.
2. **` ```typescript ` fences.** 55 fences that Framework shows as code would run as cells and
   fail. Either the site kit adopts Framework's rule (only `js`/`ts`/`jsx`/`tsx` run; the long
   names stay code), or the conversion rewrites them to ` ```ts run=false `. The first is cheaper
   and keeps the Markdown readable on GitHub.
3. **Root-absolute `FileAttachment`.** Four uses in site-fsm; supported if the kit treats
   `/path` as site-root data (NB already does for `dataFiles`), else rewrite to relative paths.
4. **Navigation.** The `pages` trees move to a site config (or front matter `order`/`section`)
   that the theme reads; `SiteModel` needs sections.
5. **Layout classes.** `grid`/`card` come from Framework's stylesheet; the Tailwind theme needs
   equivalents, or the pages switch to Tailwind classes.
6. **Pinned versions.** `@statewalker/fsm` should resolve to the version the site was written
   against, through a `lock` on the module server or a workspace source.
7. Everything else (`${…}`, `view`, `display`, `Inputs`, `tex`, `dot`, `npm:d3`) works on NB's
   pipeline already.

## 4. Live examples and live cells

**webrun-vcs and httpeers.** Each example is a TypeScript module with
`export default async function (out: Output)` (`webrun-vcs/site/src/examples/quick-start.ts:11`),
writing through a small `Output` (`output.ts`: `log`, `download`; httpeers adds `html` and an
`expect` helper). The page imports the module's text with `?raw` to show it, and a Run button
imports the same module, so "the code a visitor reads is the code that runs"
(`webrun-vcs/site/README.md`, "Live examples"; `src/examples/runner.ts:8-60`). They import
workspace packages (`@statewalker/vcs-commands`, `@statewalker/httpeers-access`) that Vite bundles
from the workspace.

Mapping **(inference)**: one notebook page per example. The example body becomes one or more
`ts` cells shown with `echo`, and the `Output` becomes ordinary cell output: `display()` per log
line, or a cell that returns an element. A Run button is `const run = view(Inputs.button("Run"))`
with the example cell depending on `run`. The reading-equals-running property then comes from
notebook-kit itself. What blocks it is the same gap as in §3: the cells must import **workspace
packages at their current source**, which the registry-only module server cannot do. A workspace
`Source` for webrun-modules (package directories read through a Node `FilesApi`, versions from
the workspace) closes it. The `check-examples.mjs` scripts would wait for cell output instead of
`data-run-status`.

**cellb.dev's Dedicated Worker runs.** `site/src/examples/page.ts:95` starts
`new Worker(new URL("./run-worker.ts", import.meta.url), { type: "module" })`, a pattern Vite
rewrites at build time. A notebook cell is compiled by notebook-kit, not Vite, so that URL is never
rewritten **(inference)**. The worker entry has to be a prebuilt file of the site: either the site
kit gives local modules a build step that also emits worker entries (Vite or esbuild over a
declared list), or the page keeps an Astro `<script>`/component for the run panel and the cells
only display results. The 70 conformance pages are generated data plus one shared runner, which
fits an Astro page better than 70 notebooks.

**`demo-service-worker`.** It is an Astro integration that bundles `src/demo/counter/sw.ts` with
esbuild into `/cellb-demo-sw.js` at the site root, because a ServiceWorker controls only paths
below its own (`site/integrations/demo-service-worker.mjs:1-43`). Nothing in it is page content
**(inference)**: it stays a site-kit integration (a generic "bundle these entries to these root
paths" option), and a cell may call `navigator.serviceWorker.register("/cellb-demo-sw.js")`.

## 5. Gap list for a CI static build

Sizes: S = a day or less, M = a few days, L = a week or more. All **(inference)**.

| # | Gap | Size | Notes |
|---|---|---|---|
| 1 | **Static Astro theme**: `output: "static"`, a build-time content loader that calls `buildPageModels` over a Node `FilesApi`, `getStaticPaths` from the models; drop `cloudflare:workers` and live collections | M | the route and layout (`NB/theme/src/pages/[...id].astro`, `layouts/Notebook.astro`) carry over; the page shape (`PageModel`) does not change |
| 2 | **Local modules**: cells importing `./x.js`/`../components/x.js` (TS sources) compiled and emitted beside the pages, specifiers rewritten | M | webrun-modules' `project` FilesApi transpiles TS/TSX; or Vite/esbuild over the imported files. Must also cover workers (§4) |
| 3 | **Workspace packages** as a module source, with version pinning | M | a webrun-modules `Source` over the workspace; `lock` for published packages |
| 4 | **`jsx`/`tsx` cells** rendering React | M | pre-transform the cell with esbuild/oxc (`jsx: "automatic"`, React import resolved through the module server) before notebook-kit's transpile; a `display` that renders through `react-dom/client`, as Framework's `displayJsx`; React and react-dom in the export closure |
| 5 | **Export step** as an Astro integration: modules closure (`materializeDeps`), built-ins (`builtinClosure` and the `~esm/` rewrite), `?module` CSS rewrite, data files, SQL results, `search.json` | M | logic exists in `NB/src/index.ts:562-760`; it must be lifted off `this.*` stores and the crawl dropped; paths change from `/nb/<site>/t/…` to the site root |
| 6 | **Tailwind + shadcn theme**: tokens, header/nav/sidebar/TOC, code blocks, cell output styles, Framework-like `grid`/`card` | M | cellb.dev's and webrun-vcs's sites already have the tokens and components (`site/src/styles/global.css`, `src/components/ui/`) |
| 7 | **Site config and navigation sections** (nested, ordered) in `SiteModel` | S | |
| 8 | **Fence rule**: only `js`/`ts`/`jsx`/`tsx`/`sql` (and `ojs`) run; long names stay code | S | a change to `FENCE_MODES` in the kit |
| 9 | **Data loaders in Node**: `import()` the loader, write its output | S | `loaderTarget`, `isLoaderOutput` reusable |
| 10 | **Precomputed SQL in Node**: SQLite node driver + `precomputeQueries` | S | `sqlStrings` and `sql-guard` reusable |
| 11 | Root-absolute `FileAttachment` for any data file | S | |
| 12 | **Extraction**: split `@statewalker/cellb-notebooks` (private, depends on cellb platform packages) into a published site kit (portable parts) and the DO host (the object, which then depends on the kit) | M | the DO keeps working on the same page models |
| 13 | CI: build, `check-links`, `check-examples`, compress and rclone publish | S | copy cellb.dev's / webrun-vcs's `site.yml` and `scripts/` |
| 14 | `html`/`tex`/`dot`/`mermaid` fences as live cells (Framework parity) | S–M | optional; no current site uses the fences, only the tagged templates in `js`/`ts` cells |

Reusable as is: notebook-build's stages (`resolveNotebook`, `transpileNotebook`,
`parseNotebookHtml`, `materializeDeps`), `buildPageModels`, `portable-text.ts`, `search.ts`,
`builtins.ts`, the pure helpers of `data-loaders.ts` and `sql-guard.ts`, `notebook-db`'s
`precomputeQueries`, the theme's route and layout structure, webrun-modules, and cellb.dev's /
webrun-vcs's site infrastructure (tokens, components, compression, link and example checks,
publishing).

The critical path is gaps 1, 2, 3 and 5: with them, site-dots and the blog build; site-fsm also
needs 8 and 11; the React pages of the new sites need 4.

## Sources

- cellb.dev `packages/notebooks`: `README.md`, `src/index.ts`, `src/page-models.ts`,
  `src/portable-text.ts`, `src/data-loaders.ts`, `src/builtins.ts`, `src/search.ts`, `theme/*`,
  `test/*`; `examples/platform-demos/notebooks/*`; `site/README.md`, `site/astro.config.mjs`,
  `site/integrations/demo-service-worker.mjs`, `site/src/examples/*`.
- statewalker-knowledge `packages/notebook-build` (`README.md`, `src/md-parse.ts`,
  `src/resolve.ts`, `src/transpile.ts`, `src/assets.ts`, `src/paths.ts`, `src/render.ts`,
  `src/build.ts`), `packages/notebook-db/README.md`, `packages/notebook-site/README.md`,
  `apps/demo/`.
- statewalker-sites `packages/{site-fsm,site-dots,blog}`: `observablehq.config.js`,
  `package.json`, `src/**/*.md`.
- webrun-vcs `site/README.md`, `site/src/examples/*`; httpeers `site/src/examples/*`.
- `@observablehq/notebook-kit` 2.11.0 (npm): `README.md`, `dist/src/lib/notebook.d.ts`,
  `dist/src/javascript/typescript.js`, `dist/src/runtime/define.js`,
  `dist/src/runtime/stdlib/*`.
- `@observablehq/framework` 1.13.4 (npm): `dist/markdown.js`, `dist/javascript/module.js`,
  `dist/client/main.js`, `dist/resolvers.js`.
- `@statewalker/webrun-modules` 0.4.0 (npm): `README.md`.
