# Applications to port to the platform

Candidates to port or adapt to the statewalker platform, collected 2026-11-23. This is a list of
candidates, not a plan: each port gets its own ticket when it is picked up. Facts were read from
the projects' public pages on 2026-11-23; statements marked **(unverified)** were not checked.

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

## ArtCraft

- Site: [getartcraft.com](https://getartcraft.com/). The site was not reachable from the session
  that wrote this note, so its source repository, license and stack are **(unverified)**.
- Port: reuse its core built to WebAssembly and plug a React-based UI (menus, dialogs and the rest
  of the chrome) from the platform around it.
- To check first: the source repository and its license, whether the core builds to Wasm as a
  separable library, and the API between core and UI.
