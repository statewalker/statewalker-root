# Which tool generates API reference pages from TypeScript exports?

Research for `statewalker/statewalker-root#234`, 2026-11-23. Statements marked **(inference)** are
this note's own reasoning, not a source's claim. Every tool was run in a scratch directory on copies
of the packages; no project checkout was written to.

## Question

Every project site will be Astro + Tailwind + shadcn/ui, built by a shared site kit from Markdown
notebook pages. The API reference is generated from each published package's exported types and
shown beside the hand-written guides; the package README is the introduction. The kit needs the API
as data (JSON or Markdown it turns into page models), not a finished site.

Which tool should produce that data: TypeDoc (JSON, or Markdown through `typedoc-plugin-markdown`),
API Extractor with API Documenter, or a small generator over the TypeScript compiler API? Criteria:
pnpm monorepos with `workspace:` dependencies, ESM and `exports` maps, re-exports through
`index.js`, TSDoc/JSDoc comments, links between packages and projects, output as data, build time
on large projects (webrun-vcs has 18 packages, 15 of them public), and maintenance.

## Short answer

- **Use TypeDoc's JSON output (`--json`), one file per package, read by the kit.** It was the only
  tool that handled every criterion on real packages: it found all five `exports` subpaths of
  `@statewalker/vcs-core` by itself, followed `export *` chains, read the projects' JSDoc-style
  comments without complaint, included each package's README, and resolved 2,484 `{@link}` tags
  across packages to ids. Its JSON has a typed schema (`JSONOutput`) the kit can import.
- **The catch: no tool on the market runs on TypeScript 7.** The projects use TypeScript 7.0.2,
  whose npm package has no classic compiler API any more (`"."` exports only `lib/version.cjs`; the
  API is under `typescript/unstable/*`). TypeDoc 0.28.20 accepts TypeScript up to 6.0 and crashes on
  7 at import. API Extractor 7.60.1 bundles its own TypeScript 6.0.3. So the kit's doc tool must
  live in its own package, pinned to `typescript@6.0.3`, separate from the projects' TypeScript.
- **API Extractor does not fit.** It reads one entry point per package (vcs-core's
  `./serialization` subpath was simply missing), needs built `.d.ts` files, enforces strict TSDoc
  (603 "missing release tag" and 258 "`@param` without hyphen" warnings on vcs-core), and API
  Documenter writes one file per member (2,013 files, 8.3 MB for two packages).
- **A generator over TypeScript 7's new API works and is fast, but is a project of its own.** A
  47-line prototype listed all exports of the 15 webrun-vcs packages in 11.6 s (TypeDoc: 50 s),
  but gives types as strings, with no links, no `{@link}` parsing and no type structure. Keep it
  as the fallback if TypeDoc does not reach TypeScript 7 in time **(inference)**.

## Findings

### Setup

Tools installed from npm on 2026-11-23: TypeDoc 0.28.20, typedoc-plugin-markdown 4.14.1,
`@microsoft/api-extractor` 7.60.1, `@microsoft/api-documenter` 7.30.20, TypeScript 6.0.3 and
7.0.2. Packages: `@statewalker/vcs-core` 0.5.0 and its dependency `vcs-utils` (webrun-vcs
`479fa64`, 2026-11-22), `@statewalker/httpeers-core` 0.1.4 (httpeers `9e4d350`), and later all 15
public webrun-vcs packages. They were copied into a scratch pnpm workspace with the same
`tsconfig.base.json` and catalog, keeping `workspace:^` links; dev dependencies were cut down to
`typescript` and `@types/node`. Times are wall clock on the session's sandbox VM (Node 22.23.5).

### TypeScript 7 breaks the existing tools

- `typescript@7.0.2`'s `package.json` exports `"."` as `./lib/version.cjs` and the API only as
  `./unstable/sync`, `./unstable/async`, `./unstable/ast` and others. There is no `ts.createProgram`
  or `ts.SyntaxKind` for older tools to use.
- TypeDoc's `peerDependencies.typescript` is `5.0.x || … || 6.0.x`; its changelog's last TypeScript
  entry is "Support TypeScript 6.0" (v0.28.18, 2026-03-23), and the Unreleased section and repository
  docs say nothing about TypeScript 7 or tsgo. Installed beside TypeScript 7 in the workspace, it
  dies at import: `TypeError: Cannot read properties of undefined (reading 'PropertyDeclaration')`.
- A pnpm `overrides` entry `"typedoc>typescript": "6.0.3"` did not help: overrides do not replace a
  peer dependency, and pnpm still linked TypeDoc to 7.0.2.
- What worked: a separate tools package with `typescript@6.0.3` and TypeDoc, run from there with the
  project directory as the working directory. TypeScript 6.0.3 checked all 15 webrun-vcs packages
  without errors.
- API Extractor 7.60.1 bundles TypeScript 6.0.3 ("Upgrade the bundled compiler engine to TypeScript
  6.0.3", changelog 7.60.0) and printed "Analysis will use the bundled TypeScript version 6.0.3"; it
  has no TypeScript 7 note either.

### TypeDoc, JSON output

| Run | Time | Output | Notes |
|---|---|---|---|
| httpeers-core (`--tsconfig tsconfig.build.json`) | 1.1 s | 344 KB, 241 reflections | 55 exports, 125 commented reflections |
| vcs-core, entry points found by TypeDoc | 2.6 s | 4.5 MB, 4,873 reflections | 5 modules (`.`, `history`, `storage`, `backend`, `serialization`), 7 warnings |
| vcs-utils + vcs-core + httpeers-core, packages mode | 4.7 s | 7.4 MB | merged, 9 warnings |
| vcs-commands alone | 9.9 s | 26.8 MB | the largest package |
| all 15 public webrun-vcs packages, packages mode | 50 s, 1.58 GB peak RSS | 49 MB, 43,087 reflections | 0 errors, 244 warnings |

Against the criteria:

- **`exports` maps.** With no `entryPoints`, TypeDoc read the package's `exports`, used the
  `import` condition and mapped `dist/*.js` back to `src/*.ts` through the tsconfig's
  `rootDir`/`outDir` (it would use a `"typedoc"` condition if one existed, `site/options/input.md`).
  It found all five vcs-core subpaths.
- **`workspace:` dependencies.** A package's imports of its workspace siblings resolve through
  pnpm's links and the sibling's `exports`. Without built `dist/` files that needs
  `compilerOptions.customConditions: ["source"]` (set through TypeDoc's `packageOptions`), since
  every statewalker package exports `"source": "./src/…"`. With it, no build was needed.
- **Re-exports through `index.js`.** `export * from "./history/index.js"` chains were flattened into
  the module's exports.
- **Comments.** The projects write JSDoc style (`@param name text`, no hyphen); TypeDoc took it.
  Summaries arrive as structured parts (`text`, `code`, `inline-tag`), so the kit renders inline
  code and links itself. Warnings were useful: 6 non-exported types referenced by exported ones
  ("referenced … but not included in the documentation"), and `@param` names that do not exist.
- **Links between packages.** Packages mode converts each package to JSON and merges them; in the
  three-package run, references from vcs-core to vcs-utils fell from 17 unresolved to 1. In the full
  run 2,484 `{@link}` tags resolved to reflection ids, 190 pointed at a symbol outside the docs, as
  `{ packageName, packagePath, qualifiedName }`, and 7 failed. That object form is enough for the
  kit to link to another project's API pages by package name **(inference)**; TypeDoc's own way is
  `externalSymbolLinkMappings` (`site/development/third-party-symbols.md`).
- **README.** Each package's README is in the JSON (`readme`, 15 of 15), so the kit can take the
  introduction from the same file or from the package directly.
- **Data, not a site.** `--json` writes only the model; its shape is the exported
  `JSONOutput.ProjectReflection` interface (`site/development/index.md`, "JSON Output"), and
  `entryPointStrategy: "merge"` can combine JSON files from earlier runs (`site/options/input.md`).
- **What broke.** (1) A package whose tsconfig includes tests failed on missing test-only types; the
  build tsconfig fixed it. (2) In packages mode one package with a type error stops the whole merge
  ("Failed to convert one or more packages, result will not be merged together"); a fresh install
  that resolved `@types/sql.js` 1.16.0 instead of the lockfile's 1.4.11 did that. (3) The root
  module of a multi-entry package is named `""`, so the Markdown plugin writes it to a folder `_`
  with an empty breadcrumb; a `@module` tag fixes the name (`site/options/input.md`). (4) One merged
  run over a whole project is large: 49 MB and 1.6 GB of memory for webrun-vcs.

### typedoc-plugin-markdown

On vcs-core: 3.4 s, 659 Markdown files, 3.0 MB, one page per class, interface, function and type,
with "Defined in" lines and relative links. It is readable, but it is a finished layout (headings,
tables, breadcrumbs) that the kit would have to parse back to restyle with its own components
**(inference)**. The plugin's monorepo also has a front-matter plugin and VitePress/Docusaurus
themes; a third-party `starlight-typedoc` 0.23.3 targets Astro Starlight, which the kit does not use.

### API Extractor and API Documenter

| Run | Time | Output |
|---|---|---|
| vcs-core (`dist/index.d.ts`) | 1.3 s, 270 MB peak RSS | 2.7 MB `.api.json`, 603 items, 543 with doc comments |
| httpeers-core | 1.0 s | 55 items |
| API Documenter `markdown` over both | 0.7 s | 2,013 files, 8.3 MB |

- **One entry point.** `mainEntryPointFilePath` is the only required input; the model's
  `ApiEntryPoint` source says "API Extractor does not currently support analysis of multiple entry
  points", and `importPath` is always empty. vcs-core's `./serialization` subpath (not re-exported
  from the root) was missing from the result; covering it means one config and one model per
  subpath.
- **Needs built `.d.ts`.** It analyses `dist/index.d.ts` and maps back to `src` through declaration
  maps, so every package must be built first. The config file must sit in the package (run from a
  config elsewhere: "Unable to find a package.json file for the project being analyzed").
- **Strict TSDoc.** On vcs-core it reported 603 `ae-missing-release-tag`, 258
  `tsdoc-param-tag-missing-hyphen`, 18 `tsdoc-code-span-missing-delimiter` and 12
  `tsdoc-undefined-tag`, among others; API Documenter printed "Unsupported block tag: @yields" and
  "@template". Adopting it means rewriting comments in every project or silencing the checks.
- **Data.** The `.api.json` doc model is data (`excerptTokens` with canonical references such as
  `@statewalker/vcs-core!addKeyToFilter:function(1)`), and canonical references link across
  packages by name. But doc comments stay raw `/** … */` strings, so the kit would need the TSDoc
  parser too **(inference)**.

### A generator over the TypeScript 7 API

`typescript/unstable/sync` starts the native compiler as a child process and exposes a `Checker` with
`getExportsOfModule`, `getAliasedSymbol`, `getDocumentationCommentOfSymbol`, `getJsDocTagsOfSymbol`,
`typeToString`, `getSignaturesOfType` and `getPropertiesOfType` (`dist/api/sync/api.d.ts`). A
47-line prototype opened a package's tsconfig, walked each `exports` subpath's `source` file and
wrote name, kind, summary, tags, signature or type string, and members:

- httpeers-core: 127 ms, 55 exports, 49 KB. vcs-core: 1.0 s, five subpaths, 1.2 MB.
- All 15 public webrun-vcs packages, one process each: 11.6 s, 12 MB, no build needed (with
  `customConditions: ["source"]`).

What it lacks is the part TypeDoc already does: types are strings, so no links from a parameter type
to its page; `{@link}` in comments comes back as flat text; no type parameters, overload grouping,
inherited members, source locations or README. The API is marked unstable, so each TypeScript
release may break it **(inference)**.

### Maintenance

- TypeDoc: 31 releases in the 0.27/0.28 lines; last release 0.28.20 on 2026-07-05; last repository
  commit read 2026-07-12, so no release for over four months. Five npm maintainers are listed.
  typedoc-plugin-markdown: last commit 2026-11-19.
- API Extractor: part of Microsoft's rushstack, released 2026-11-20, steady cadence.
- Own generator: ours to maintain, against an API Microsoft labels unstable.

## Recommendation

Adopt **TypeDoc JSON** as the kit's API source:

1. The site kit carries its own tools package with `typedoc@0.28.x` and `typescript@6.0.x`, never
   sharing the projects' TypeScript 7.
2. Run TypeDoc once per published package (`--json`, entry points from `exports`,
   `customConditions: ["source"]`, the package's build tsconfig) and write one JSON file per
   package. Per-package files keep memory low, let one broken package fail alone, and let the site
   rebuild only what changed **(inference)**. Packages mode is still useful in a project's CI to
   check that links resolve.
3. The kit maps `JSONOutput` reflections to its own page models and renders them with its
   components, resolving `{ packageName, qualifiedName }` targets against the other packages' JSON,
   in the same project or another, by npm package name.
4. Skip typedoc-plugin-markdown: the kit wants structure, not finished pages.

Reasons: it is the only candidate that met every criterion on the real packages without a build
step or comment rewrites, its JSON is typed and stable, and links between packages already resolve.
The risk is TypeScript 7: if TypeDoc has not moved to it when the projects start using syntax that
TypeScript 6 cannot read, the fallback is to grow the TypeScript 7 prototype into a generator that
emits the same page models. Keeping the kit's page models independent of TypeDoc's JSON makes that
swap local to one adapter **(inference)**.

## Open questions

- Will TypeDoc support TypeScript 7, and on which API? Nothing in its repository says so yet.
- How should the kit link to a package of another project: by npm package name and a site URL map,
  or through `externalSymbolLinkMappings` written by the kit?

## Sources

- TypeDoc repository https://github.com/TypeStrong/typedoc at `6d8c856` (2026-07-12), shallow
  clone: `CHANGELOG.md`, `package.json` (peer range), `site/options/input.md` (`entryPoints`,
  `entryPointStrategy` incl. `packages`/`merge`, `packageOptions`), `site/options/output.md`
  (`json`, `emit`), `site/declaration-references.md`, `site/development/third-party-symbols.md`,
  `site/options/comments.md` (`externalSymbolLinkMappings`), `site/development/index.md` ("JSON
  Output"), `src/lib/serialization/schema.ts`. These pages are the source of https://typedoc.org.
- rushstack https://github.com/microsoft/rushstack at `c2acd01` (2026-11-12), sparse clone:
  `apps/api-extractor/CHANGELOG.md`, `apps/api-extractor/package.json`,
  `apps/api-extractor/src/schemas/api-extractor.schema.json` and `api-extractor-template.json`,
  `apps/api-extractor/src/api/CompilerState.ts`, `apps/api-extractor/src/collector/WorkingPackage.ts`,
  `libraries/api-extractor-model/src/model/ApiEntryPoint.ts`, `apps/api-documenter/src/documenters/`.
- typedoc-plugin-markdown https://github.com/typedoc2md/typedoc-plugin-markdown at `153400d`
  (2026-11-19): `packages/` listing.
- TypeScript 7.0.2 npm package: `package.json` (`exports`), `dist/api/sync/api.d.ts`,
  `dist/api/sync/types.d.ts`, `dist/api/options.d.ts`, `dist/api/proto.d.ts`.
- npm registry metadata (`npm view`) for typescript, typedoc, typedoc-plugin-markdown,
  `@microsoft/api-extractor`, `@microsoft/api-documenter`, starlight-typedoc, on 2026-11-23.
- Hands-on runs: webrun-vcs `479fa64` `packages/*` (copied), httpeers `9e4d350`
  `packages/httpeers-core` (copied); the prototype generator and run logs stayed in the session's
  scratch directory.
