# Can webrun-modules compile notebook cells, and how do source maps reach the Markdown?

Research for `statewalker/cellb.dev#235`, 2026-11-23. Statements marked **(inference)** are this
note's own reasoning, not a source's. Read at: statewalker-knowledge `3095ebc` (notebook-build after
statewalker-knowledge#37), cellb.dev `027b9b0` (`origin/main`), webrun-sites `41a6130`
(webrun-modules 0.4.0); npm packages `sucrase` 3.35.1 (the latest release), `@observablehq/notebook-kit`
2.11.0 (cellb.dev) and 2.6.6 (statewalker-knowledge; same `transpile` code), `magic-string` 1.4.5,
`@jridgewell/remapping` 2.3.5, `@jridgewell/trace-mapping` 0.3.31. Short names: `KB` =
`statewalker-knowledge/packages/notebook-build/src/`, `NB` = `cellb.dev/packages/notebooks/src/`,
`WM` = `webrun-sites/packages/webrun-modules/src/`, `KIT` = notebook-kit's `dist/src/javascript/`.

## Questions

- (a) Could webrun-modules' existing transform generate the JavaScript of `ts`/`jsx`/`tsx` cells,
  instead of the separate sucrase call in notebook-build?
- (b) How should source maps be produced through the whole cell pipeline (Markdown → cell source →
  sucrase → notebook-kit `transpile` → the `define()` calls of the page script), so that runtime
  errors map back to the notebook's Markdown? What does magic-string add?

## Answer

**(a) Not as it stands, and the gain is small.** webrun-modules' `toJs` is the same library
(sucrase, same `^3.35.1` catalog range) called with options that are wrong for cells: it compiles
optional chaining and `??` into helper functions declared at the top of the output, it lets the
TypeScript transform drop imports the cell does not use itself, and it returns no source map. Its
module transforms (`newEsmTransform`, `newCjsTransform`) work on whole ES modules and are
asynchronous, while a cell is a fragment and notebook-build's `transpileNotebook` is synchronous.
What could be shared is one small function: "sucrase with these options, returning code and map".
If it lives in webrun-modules, notebook-build gains one dependency for one call; keeping the call in
notebook-build costs nothing, since pnpm already resolves both to the same sucrase. **(inference)**
Keep sucrase in notebook-build; align the options and the `production` flag by a test, not by a
shared call.

**(b) One composed v3 map per page script, built stage by stage, with the Markdown as its only
source.** Each stage either gives a map (sucrase does) or is an edit made with magic-string, which
gives one. notebook-kit's `transpile` is the gap: it tracks its edits internally but returns only the
body string. Its edits can be replayed onto a magic-string from a line diff, checked to rebuild the
same body (proven below), until notebook-kit returns a map itself. `@jridgewell/remapping` composes
the chain, and the page script carries the map inline with a `sourceURL`. A cell's error display
maps stack positions itself with `@jridgewell/trace-mapping`, since `error.stack` is never mapped.
A proof maps a thrown error in a `tsx` cell back to `plots.md:12:45`, the exact token.

## (a) webrun-modules' transform

### What it does

- **`toJs(source, format, path?, production = false)`** (`WM/transform/to-js.ts`): for `ts`/`tsx`
  it calls `sucrase.transform` with `transforms: ["typescript"]` or `["typescript", "jsx"]`,
  `jsxRuntime: "automatic"`, `production`, `filePath`; any other format is returned untouched. It
  returns `.code` only. There is no `jsx` format: `detectFormat` maps `.jsx` to `tsx`
  (`WM/transform/index.ts:51`).
- **`newEsmTransform`** (`WM/transform/transform-esm.ts`): `toJs`, then acorn parses the result as
  a module and every static import/export source and every `import("literal")` is rewritten in
  place through a `rewrite(specifier)` callback (spliced from the end). Its `transform` is `async`,
  takes a `SourceFile` and returns `TransformResult { code, map? }`, where `map` is documented
  "populated by spec #3; unset here" (`WM/types.ts:104`).
- **`newCjsTransform`** (`WM/transform/transform-cjs.ts`): wraps CommonJS in an ES module, finds
  `require` calls on the AST, re-exports named exports found by `cjs-module-lexer` (a wasm module,
  `await init()`, line 76), and folds `process.env.NODE_ENV` tests.
- **`parseSource`** (`WM/transform/parse-source.ts`): `toJs` plus an acorn tree, for static
  analysis; its comment states that "sucrase keeps line numbers".
- `preprocessModule` / `jsTransform` (`WM/preprocess/module.ts`) run these per module id, through
  the module server's cache; they are the server's path, not a string API.

Everything is plain JavaScript and runs in browsers; `toJs` is synchronous, the module transforms
are not (`Promise<TransformResult>`, and the CJS one waits for the lexer's wasm).

### Can it take a cell and return JavaScript and a map?

`toJs` takes a string, but its fixed options break cells. Checked with sucrase 3.35.1:

- **Without `disableESTransforms`**, `data?.rows ?? []` becomes
  `_nullishCoalesce(_optionalChain([...]))`, with both helpers declared as functions at the top of
  the output. In a cell those are declarations: two cells using `?.` would both declare
  `_optionalChain`, the same clash notebook-build's `jsx.ts` avoids for `_jsx` by cutting the import
  prefix.
- **Without `keepUnusedImports`**, the TypeScript transform elides imports whose names the cell does
  not use: `import {scaleLinear} from "d3"` in a cell that only exports the name to other cells
  disappears from the output. notebook-build sets the option for exactly this (`KB/jsx.ts:58`).
- **`production` defaults to `false`**, which compiles JSX to `jsxDEV` from `react/jsx-dev-runtime`;
  notebook-build uses `production: true` (`react/jsx-runtime`). The module server itself uses the
  production runtime in browsers (`WM/server/new-module-server.ts:64`), so the two agree only if
  the caller passes `true`.
- **No map**: `toJs` drops sucrase's `sourceMap`; `TransformResult.map` is still unset.

The module transforms cannot take a cell at all: a cell is not a module (notebook-kit parses it with
its own rules: top-level `await`, an expression cell, imports turned into inputs), and specifier
rewriting is notebook-kit's job there (`resolveImport`).

### Gain and loss for notebook-build

- **One transform path**: only in name. Both call sucrase; the shared part would be one
  `transform(...)` call with five options. **(inference)**
- **Version alignment**: already there. Both catalogs pin `sucrase: ^3.35.1`
  (statewalker-knowledge and webrun-sites `pnpm-workspace.yaml`), and in cellb.dev, where both
  packages are installed, pnpm resolves one copy within the range. **(inference)**
- **React import source**: both use sucrase's default `jsxImportSource` (`react`); notebook-build
  sets it explicitly. Same result.
- **Line preservation**: identical, it is sucrase's property (see (b)).
- **Loss**: notebook-build (published, also runs in browsers) would depend on webrun-modules (L2,
  so the layer order allows it) for one call, and `toJs` would need new options (a cell mode or an
  options object) and a map in its result, which is a webrun-modules change and release first
  ("lower layers first"). **(inference)**

Recommendation **(inference)**: keep sucrase in notebook-build. If webrun-modules later fills
`TransformResult.map` (its "spec #3"), the same `sourceMapOptions` call shape can be copied. A
notebook-build test that a `tsx` cell compiles to `react/jsx-runtime` (not `jsx-dev-runtime`) keeps
the `production` choice aligned with the module server.

## (b) Source maps through the cell pipeline

### The stages and what each changes

| Stage | Where | Lines kept? | Map today |
|---|---|---|---|
| 1. Markdown → cell source | `NB/portable-text.ts` (`markdownToDocument`) | slice of the file | none; positions not recorded (#235 step 2) |
| 2. sucrase (`jsx`/`tsx`) | `KB/jsx.ts` | yes | available: `sourceMapOptions` |
| 3. cut sucrase's import prefix line | `KB/jsx.ts` | one line removed | none |
| 4. notebook-kit `transpile` | `KIT/transpile.js` | no (header, hoisted imports) | tracked inside, not returned |
| 5. React wrapper around the body | `KB/jsx.ts` | lines added before | none |
| 6. `define()` calls joined into the page script | `NB/page-models.ts` (`defineCall`, `buildPageModels`) | body starts mid-line | none |

### sucrase

- `transform(code, { ..., filePath, sourceMapOptions: { compiledFilename } })` returns
  `sourceMap` (v3) beside `code` (`sucrase/dist/types/Options.d.ts`: `SourceMapOptions`,
  `sourceMapOptions?`).
- The map is built by `computeSourceMap` (`sucrase/dist/computeSourceMap.js`): "each line maps
  directly to the original line, with the tokens in their new positions". Output line N is input
  line N; each token gets a segment at its original column. Sucrase puts its helper imports on line
  1 without adding a line, which is why notebook-build feeds it `"\n" + source` and cuts line 1.
- **A gap found here (sucrase 3.35.1, the latest)**: after a JSX element with a `key` prop, the map
  keeps only one segment per line (column 0) to the end of the output. The automatic runtime moves
  `key` to the end of the `_jsx(...)` call, so tokens come out of order, and `computeSourceMap`
  walks them in order (`if (i === currentMapping)`), never meeting the skipped one again.
  Reproduced: `<li key={1}>{x}</li>` leaves the next line with 1 segment, `<li id={1}>` with 13.
  Lines stay right. **(inference)** Worth an upstream issue; until then columns after a keyed
  element point at column 1 of the right Markdown line.

### notebook-kit's `transpile`

- `transpileJavaScript` and `transpileTypeScript` build the body on a `Sourcemap` object
  (`KIT/sourcemap.js`), an ordered list of edits `{start, end, value}` over the input, applied in
  `toString()`. It has `translate(position)` (output position → input position), used for its own
  syntax errors. It is not a v3 map, is not exported (`package.json#exports` has `.`, `./runtime`,
  `./databases`, `./vite`), and `transpileCell` returns only `{ body, inputs, outputs,
  autodisplay, files, databases, secrets, imports }` (`KIT/transpile.js:46-73`).
- The cell's text is kept verbatim apart from these edits (`KIT/transpile.js`, `KIT/imports.js`):
  - `trim()` drops one leading and one trailing newline;
  - each static `import` declaration is deleted with its newline, and all of them are re-inserted as
    one line at the top: `const {a} = await import("…").then(…)` (the `.then` check spans several
    lines) or `const [a, b] = await Promise.all([...])`;
  - `import("x")` specifiers and `import.meta.url` (→ `document.baseURI`) are replaced in place;
    `FileAttachment` calls too when `resolveFiles` is set;
  - `ts` mode deletes type annotations in place (`KIT/typescript.js`, `stripTypes`);
  - the wrapper: `async (inputs) => {` + newline before, `return (` + newline for an expression
    cell, and `return {outputs};`, `)`, `}` after, each on new lines.
- So notebook-kit does not keep lines, but it never reorders kept text. **(inference)** That makes
  its edits recoverable from a diff of input and output, and a small upstream change (a
  `toSourceMap()` on `Sourcemap`, ~40 lines, returned as `map` from `transpile`) would remove the
  need.

### magic-string

`MagicString` holds the original string and edits by original character index (`overwrite`/
`update`, `remove`, `prependLeft`/`appendLeft`, `prepend`/`append`), and `generateMap({ source,
file, includeContent, hires })` writes a v3 map from the result to the original. `hires: true`
maps every character, `"boundary"` every word, the default one segment per line (README, "Hi-res
mappings"). `Bundle` joins several `MagicString`s, each with its own `filename`, into one output
with one map (`addSource`, `generateMap`). In this pipeline it gives:

- **Stage 1**: a `MagicString` over the whole Markdown with everything outside the fence
  `remove`d is exactly the cell source, and its map points into `plots.md` with true line and
  column numbers. No offset arithmetic, and the map carries the Markdown as `sourcesContent`.
- **Stages 3 and 5** in notebook-build: cutting the prefix line (`remove`) and wrapping the body
  (`prepend`/`append`) instead of string concatenation, each giving a map.
- **Stage 4** until notebook-kit returns a map: replay its edits on a `MagicString` of its input,
  from a line-level diff (deleted lines `remove`d, inserted lines `prependLeft`, changed lines
  `overwrite`n between their common prefix and suffix), and check that `toString()` equals the body
  notebook-kit returned. If the check fails, fall back to a line-only map. **(inference)**
- **Stage 6** in cellb.dev: the page script as a `Bundle`: the runtime import line, then one
  `MagicString(body, { filename: "cell-<id>.js" })` per cell with the `define({...}, {"id":…,
  "body":` text `prepend`ed and the `"inputs":…});` text `append`ed. `registerFile` lines join as
  plain sources.

### Composing the maps

`@jridgewell/remapping` (the package `@ampproject/remapping` continues as; latest 2.3.5) takes
either an array of maps, newest first, each with one source, or one map plus a `loader(file)` that
returns the map of each of its sources, recursively. Both are used:

- per cell: `remapping([kitMap, cutMap, sucraseMap, markdownMap], () => null)` gives one map from
  the compiled body to `plots.md`;
- per page: `remapping(pageBundleMap, (file) => cellMaps.get(file) ?? null)` replaces each
  `cell-<id>.js` source with the Markdown file. The result has `sources: ["plots.md"]` and the
  Markdown in `sourcesContent`.

A composed map is only as fine as its coarsest stage: with sucrase in the chain it maps per token,
and `hires: true` versus `"boundary"` on the page bundle made no difference to its size in the proof
(442 mapping characters for a 652-character script). The `sourcesContent` adds the whole Markdown
file to each page. **(inference)**

### Inlining in the page

The page script ends with two comments:

```js
//# sourceURL=/notebooks/plots.page.js
//# sourceMappingURL=data:application/json;base64,<composed map>
```

The `sourceMappingURL` comment and `sourceURL` (for code with no URL of its own: eval, inline
scripts) are described in ECMA-426 (Source Map Format). **(inference)** `sourceURL` matters twice:
devtools lists the inline script under that name, and V8 names the script by it in `error.stack`
(seen in Node, which is V8: frames read `plots.page.js:12:34`), with lines counted from the start
of the script, not of the HTML document. That gives the error display a stable name and position to
look up. Firefox's handling of `sourceURL` in inline `<script type="module">` is not verified here;
the #235 browser test should check it. Node with `--enable-source-maps` applies the inline map to
the stack by itself (`plots.md:12:1`), which a build-time test can use. `page-models.ts` already
escapes `</script`; a base64 map has no `<`.

### Mapping a stack in the cell's error display

Browsers apply source maps in devtools only; `error.stack` keeps generated positions. So the
display maps them itself **(inference)**:

1. The build also gives the page (or the page model) the composed map, or a smaller table derived
   from it: for each cell, per generated line, the Markdown line and the column segments.
2. On a cell error, the display finds stack frames whose file is the page's `sourceURL`
   (`/plots\.page\.js:(\d+):(\d+)/`), takes the first one, and calls `originalPositionFor` from
   `@jridgewell/trace-mapping` (line 1-based, column 0-based: the frame's column minus one).
3. It shows `plots.md:12:45` beside the message. `trace-mapping` is small, plain JavaScript and
   can be imported lazily on the first error, through the module server like any cell import.

A frame outside the page script (in a package) is left as is; the first page-script frame is the
cell's own line. **(inference)**

## The proof

In `/tmp/claude-0/-home-user/f95dd6db-94c5-5bbb-8667-eaab2ceee121/scratchpad/sourcemaps/` (a
scratchpad, not kept): `npm i sucrase@3.35.1 @observablehq/notebook-kit@2.11.0 magic-string
@jridgewell/remapping @jridgewell/trace-mapping`, then `node prove.mjs`. The script:

1. takes a Markdown page whose `tsx` fence (lines 6-14) has an import, a type, a component with
   JSX, `display(<Chart …/>)` and a function that throws on line 12:
   `const boom = (r: Row) => (r as any).missing.value;`;
2. slices the cell with a `MagicString` over the Markdown (stage 1), runs sucrase with notebook-
   build's options plus `sourceMapOptions` (stage 2), cuts the prefix line with a `MagicString`
   (stage 3), runs notebook-kit's `transpile(code, "js", { resolveImport })` and replays its edits
   onto a `MagicString` from a line diff, asserting the replay rebuilds the body (stage 4);
3. composes the cell map with `remapping([...])`, builds the page script as a magic-string `Bundle`
   of a runtime import and one `define()` call, composes the page map through a `loader`;
4. writes the script with an inline map and `sourceURL`, imports it with a stub `define` that calls
   the body, catches the error, parses `plots.page.js:L:C` from `error.stack` and maps it with
   `trace-mapping`.

Results:

- Generated frame `plots.page.js:12:34` → **`plots.md:12:45`**, the `value` token of the
  Markdown line, when the cell has no keyed JSX (`NOKEY=1 node prove.mjs`).
- With `<li key={r.x}>` on line 10, the same frame → `plots.md:12:1`: the right line, column lost
  in sucrase's map (above).
- `node --enable-source-maps` on the written script prints `at boom (…/plots.md:12:1)`.

## Recommended design for #235 step 3

1. **notebook-build** (statewalker-knowledge) returns a `map` beside each cell's `body`: v3, its
   source the cell source, built from sucrase's `sourceMap`, magic-string for its own edits
   (prefix cut, React wrapper), and the replayed notebook-kit edits (checked, with a line-only
   fallback). It depends on `magic-string` and `@jridgewell/remapping`; both are plain JavaScript
   and keep `transpileNotebook` synchronous. **(inference)**
2. **cellb.dev** records each fence's start offset (step 2), maps cell source → Markdown with a
   `MagicString` over the notebook text (or by line/column offset), builds the page script as a
   `Bundle`, composes through a `loader`, and appends the inline map and a `sourceURL` naming the
   page. The theme's cell error display maps the first page-script frame with `trace-mapping`.
3. **Upstream**: an issue on sucrase for the `key` ordering gap, and a request to notebook-kit to
   return its `Sourcemap` as a v3 map from `transpile`, after which stage 4's replay is deleted.
   **(inference)**
4. **Tests**: a build test that runs a page script under `--enable-source-maps` (or maps it with
   `trace-mapping`) and expects the Markdown line, and the #235 browser test for the error display
   and the devtools mapping, run in Chromium and, if the suite allows, Firefox.

## Sources

- `KB/jsx.ts`, `KB/transpile.ts`, `KB/../package.json` (statewalker-knowledge `3095ebc`).
- `NB/page-models.ts` (`defineCall`, `buildPageModels`), `NB/../package.json` (cellb.dev `027b9b0`).
- `WM/transform/to-js.ts`, `transform-esm.ts`, `transform-cjs.ts`, `parse-source.ts`, `index.ts`,
  `WM/types.ts`, `WM/preprocess/module.ts`, `WM/server/new-module-server.ts`; webrun-bundler
  `src/bundle.ts` (`transpile`: esbuild-wasm, asynchronous, returns a map) (webrun-sites `41a6130`).
- notebook-kit 2.11.0 `KIT/transpile.js`, `KIT/sourcemap.js`, `KIT/imports.js`,
  `KIT/typescript.js`, `dist/src/index.js`, `package.json#exports`.
- sucrase 3.35.1 `dist/types/Options.d.ts`, `dist/computeSourceMap.js`.
- magic-string 1.4.5 README (`generateMap`, "Hi-res mappings", `Bundle`),
  <https://github.com/Rich-Harris/magic-string>.
- `@jridgewell/remapping` 2.3.5, `@jridgewell/trace-mapping` 0.3.31 (npm).
- ECMA-426, Source Map Format (`sourceMappingURL`, `sourceURL`), <https://tc39.es/ecma426/>.
