# Applications to port to the platform

Candidates to port or adapt to the statewalker platform, collected 2026-11-23. This is a list of
candidates, not a plan: each port gets its own ticket when it is picked up. Facts were read from
the projects' public pages on 2026-11-23, and the storytold section from the repositories
themselves the same day.

## HeyPuter/everything

- Source: [HeyPuter/everything](https://github.com/HeyPuter/everything).
- What it is: "The Everything Project", a monorepo of open-source rebuilds of proprietary
  applications (office, creative, engineering, productivity, finance, business, dev tools, games),
  about 50 apps under `src/<app>/` (e.g. `src/spreadsheet`, `src/cad`), each a Node.js 22.12+
  project served at `<app>.puter.com`.
- License: the root `LICENSE` is MIT (Puter Technologies Inc.), and the README states every
  sub-project is MIT "unless explicitly stated otherwise", with third-party libraries under their
  own licenses.
- **Constraint: take only MIT-licensed code.** Before porting an app, check its folder for a
  license of its own and its dependencies' licenses; skip anything that is not MIT (per-app
  licenses were not checked yet).
- Port: adapt the apps selected one by one to the platform (files through a FilesApi, the
  workbench shell).

## extend-hq/ui

- Source: [extend-hq/ui](https://github.com/extend-hq/ui), registry at
  [extend.ai/ui](https://www.extend.ai/ui). MIT.
- What it is: "Extend UI", 14 React components for document workflows: PDF, DOCX and XLSX viewers,
  bounding-box citations, file upload, thumbnails, e-signature, document splitting, layout blocks,
  Finder-style file browsing. TypeScript, React, Tailwind, distributed through the shadcn CLI
  (`npx shadcn@latest add @extend/pdf-viewer`); the PDF viewer uses react-pdf.
- Port: the viewers and file browser fit the workbench's mime viewers and explorer
  (statewalker-shell-react, which already uses shadcn), reading documents through a FilesApi.

## ArtCraft and the storytold Craft apps

- Sources: the [storytold](https://github.com/storytold) organization (84 public repositories,
  site [getartcraft.com](https://getartcraft.com/)), read at
  [artcraft](https://github.com/storytold/artcraft) `de571bb`,
  [photocraft](https://github.com/storytold/photocraft) `42ade5f`,
  [craft-anything](https://github.com/storytold/craft-anything) `3d5eb25` and
  [craft-libs](https://github.com/storytold/craft-libs) `15cd58b`. Each is dual-licensed MIT or
  Apache-2.0; `NOTICE` covers third-party material and the wordmark and icons (not read).
- **ArtCraft itself has no Wasm core.** It is a Tauri 2 desktop app: a React 18 front end (Nx,
  Vite, Tailwind, three.js, Konva, zustand) over Rust crates that are API clients for an ArtCraft
  server and third-party generation models (images, video, audio, 3D). There is also a native
  egui front end (`artcraft-native`). The only Wasm in the repository comes from front-end build
  tools. Porting it means porting its React UI and talking to its HTTP API, not reusing a Wasm
  core.
- **The Wasm-built cores are the other Craft apps** (photocraft, craft-anything, and by their
  names designcraft, vectorcraft, pdfcraft, texturecraft, wordcraft and others; those were not
  read). Each is a Rust workspace whose engine crates (photocraft: `engine`, `engine-core`, `ops`,
  `raster`, `paint`, ...) are kept free of the UI crate (`ui-egui`), and whose `apps/<app>-web`
  builds the whole app, egui UI included, to wasm32 with Trunk and wasm-bindgen (WebGPU, WebGL2
  fallback) into a static site with no server code. craft-libs holds about 200 shared crates
  (file formats from PSD and PDF to DWG and Figma, codecs, color, fonts, GPU).
- **They already have a host protocol**, which is where the platform plugs in:
  - `craft-web-host` (craft-libs `crates/web-host`): messages between a Craft web build and the
    page hosting it (`ready`, `open`, `save`, `saved`, `dirty`, `failed`, `handoff`), by
    same-origin `postMessage` to a parent frame or as `CustomEvent`s on the canvas. The host
    opens documents and stores saves, so a FilesApi-backed host gives every Craft app our files;
    `handoff` routes a file to the app that edits it (the workbench's mime viewers).
  - `craft-web-api` (`crates/web-api`): "one `window.<app>` shape over the app's JSON control
    channel", the page command API. React menus and dialogs can drive the app through it.
- Port, in order of cost:
  1. Host the Craft web builds unchanged in a workbench panel, through `craft-web-host`, with
     open and save over a FilesApi.
  2. Replace the egui chrome (menus, dialogs, panels) by React components that drive the app
     through `craft-web-api`, keeping the egui canvas.
  3. Build the engine crates to Wasm without `ui-egui`, behind our own bindings: only if 2 falls
     short; the engines expose no wasm-bindgen API of their own today.
- To check first: what `craft-web-api` exposes per app (enough to drive menus and dialogs?), the
  sizes of the web builds (photocraft's app ships in gzipped 20 MiB parts), and the `NOTICE`
  terms for the names and icons.
