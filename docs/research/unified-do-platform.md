# What already exists for a unified fragment platform on CellB, CellD and Workers?

Research for `statewalker/statewalker-root#112`, the map "Unified fragment platform on CellB, CellD and Workers". Sources read on 2026-11-17. This is a digest of the user's own material, not of external documentation. Statements marked **(inference)** are this note's own reasoning.

## Question

What has already been designed, prototyped, built or decided for a published, isomorphic, AI-agent-oriented application platform in the spirit of Eclipse Theia? What is still missing? The platform covers:

- fragments with a `wrangler.jsonc`-style server half and a client half declaring components;
- slots, commands, dynamic loading, lifecycle and versioning, branding, i18n/l10n;
- a DockView, shadcn, Tailwind and React shell;
- integrations: HTTPeers, builders, VCS, search, notebooks, editors, viewers, EmDash, AI chat.

## Sources

- **Google Drive:** session notes, about 25 read in full out of more than 150 hits. Folder and file names are given in the text.
- **Claude Code sessions:** about 250 listed (June to November 2026), about 20 read, mostly their latest events only. They are named by title and date.
- **Code:** shallow clones of statewalker-shared, cellb.dev, statewalker-kernel, statewalker-shell-react, statewalker-ai, httpeers, sandclaw, statewalker-shell-theia, statewalker-knowledge, webrun-sites and statewalker-sandbox (default branches, 2026-11-17).
- **This repository:** issues, ADRs and `docs/research/`.
- **Not read:**
  - the user's local notes archive (`notes/2026/…`, including `2026-10-21/sandclaw-platform-inventory.md`);
  - the projects' own issue trackers (no API access from the session);
  - webrun-vcs, statewalker-search and statewalker-sites.


## 1. Headline

Most of the platform has already been designed, prototyped or built in pieces, but in five or six different places. No ticket, map or ADR covers the platform as a whole. The AI-harness plan (root #70, spec #111) explicitly puts UI clients out of scope.

The gaps are the **joining parts**:

- a fragment manifest that ties UI contributions to DO services;
- a runtime plug-in lifecycle (install, activate, deactivate, remove, versions);
- i18n, branding and a mobile shell.

There is one **decision conflict** to settle first. In the Sandclaw grilling session (2026-10-20, Q2) you decided: *"Durable Objects are one more way to package apps, not the base. Fragments stay the base"*, because the DO design was "still a spike". Today's request makes `wrangler.jsonc` per fragment the base. Since then cellb has matured (0.11.1, 70 conformance scenarios, the platform composed of `wrangler.jsonc` apps, the sandbox). So the reason behind Q2 may no longer hold, but the decision should be reopened explicitly.

---

## 2. Area by area

### 2.1 Runtime (CellB, CellD, workerd), the server half of a fragment

**Exists:**

- `@statewalker/cellb` 0.11.1 (cellb.dev) is a celld/Cloudflare-compatible runtime for the browser (ServiceWorker, shard Dedicated Worker, SQLite WASM on OPFS) and for Node.
  - Bindings: Workers, DOs, facets, KV, Queues, D1, R2, Workflows, cron, assets, Worker Loader (dynamic workers), WebSockets, and the `ai` binding.
  - `loadProject(source)` takes a `wrangler.json(c)` folder or a FilesApi. `loadProjectBindings` loads only the bindings the project declares (the demo dropped from 2.18 MB to 0.52 MB, cellb#90).
  - Extension seams in `src/ports.ts`: `OpenCellSql`, `CellDurability`, `ObjectStore`, `Clock`/`Lease`, Worker Loader, `CellRouter`/`shardOf`.
  - Drive: "Cellb as an Extension Platform", 2026-11-09.
- `cellb.dev/packages/platform` (private) holds five DO apps, **each with its own `wrangler.jsonc`, composed into one Worker**: the package store, the ESM CDN, user projects, the bundler (producing a `loader.json` Worker Loader payload) and notebooks. They run on Wrangler, celld, CellB Node and CellB in the browser. This is the closest existing thing to "fragment = wrangler.jsonc", but the composition happens **at build time**.
- `cellb.dev/apps/sandbox` (private) is a CodeSandbox-like tool and the most complete precedent:
  - project = `wrangler.jsonc` + `client/index.html` + `AGENTS.md`;
  - a Flue agent in a DO;
  - agent entry points: WebMCP, MCP served by the ServiceWorker, and an HTTPeers mount;
  - git on webrun-vcs, notebooks and Astro builds;
  - templates `agent-ui` (json-render) and `a2ui-stream`;
  - Ship/Publish to `apps/sandbox-hub` (cellb.dev#145).
- Drive "02 – Durable Objects as the Basis for Plug-ins" (2026-10-23) is **the core design document**:
  - the plug-in boundary is the DO's native interface (Request→Response, WebSocket); webrun-wire RPC stays an internal transport;
  - "isomorphic = one source tree, one transform, two binding tables" (`~deps`);
  - a Zod-first API projected to OpenAPI, then to MCP for agents;
  - a route table maps each plug-in to a base URL, so moving it between browser and server is a one-line change;
  - each plug-in builds into two artifacts: a hash-identified cell bundle and browser ESM.

**Open:**

- The Worker Loader cannot terminate an isolate.
- Browser build vars are public, so LLM keys need a proxy.
- A per-host capability declaration.
- Whether third-party plug-ins are in scope (they would need iframe isolation).
- Wasmer containers are designed only (L0–L2).

### 2.2 Extension points, slots, commands, dynamic loading

**Exists (published, mature):**

- `@statewalker/shared-slots`: `defineSlot`, `defineKeyedSlot`, and a bus with `provide`, `register` and `observe`.
- `@statewalker/shared-commands`: `Command.….input(schema).output(schema).label().icon()` with Standard Schema validation and derived JSON Schema; `Commands.call/listen` with priority; `CommandsRegistry.compose/filter/namespace`. The README states the goal "one declaration → menu + invocation + AI tool".
- `@statewalker/shared-adapters`: `newAdapter`, for typed context lookup.
- Kernel `backbone.core/browser/node`:
  - `AppManifest {roots, modules}`, `FragmentInit = ctx => teardown`, `topoSort`;
  - activation that isolates failures per module;
  - browser boot through import maps.
- sandclaw branch `claude/statewalker-shell-consolidation-youwvj` (session 2026-10-18, **no PR**) adds `kernel.core`:
  - fragments declare an `id` and what they `require`;
  - hot load and unload;
  - "fragments call each other only through commands";
  - menu entries are actions naming a command;
  - spec `docs/superpowers/specs/2026-10-18-shell-consolidation-design.md` maps Theia's extension points onto it.
- sandbox `apps/httpeers-shell-protos`, a 12-rung ladder:
  - a manifest generated by static analysis of TypeScript;
  - **VS Code-style activation events**: menus and the palette render from the manifest before the module is imported;
  - the same module runs standalone or hosted;
  - Biscuit-based enablement;
  - apps loaded from peers.

**Lost:** the runtime fragment host `createFragmentHost` with `load({ref})` through webrun-modules (M0, 30 Jul) is in no current repository.

**Noted in the 2026-10-20 inventory:**

- Three boot paths, and "no app uses backbone".
- 3 UI registries, 2 docks, 2 copies of shadcn, 3 chat runtimes.

### 2.3 Fragment manifest (server services + client components)

**Exists in pieces:**

- cellb reads `wrangler.jsonc`.
- The kernel's `AppManifest` lists module names only.
- Drive's `plugin.json` plus an extension folder declares cells, routes, views, commands and catalog components (design only).
- The harness plugin loader (root #82, closed, `docs/research/plugin-and-tool-layouts.md`):
  - reads `plugin.json` + `skills/` + `mcp.json` + `dev.cellb.harness/{agents,tools}`;
  - plugins at deployment, workspace or project level;
  - bundles addressed by hash and pinned per session.

**Gap:** no merged format "fragment = UI contributions + wrangler services". Harness #82 already chose `plugin.json` with namespaced extension folders, so the natural move is to add a `dev.statewalker.ui/` (or similar) folder beside `wrangler.jsonc`.

### 2.4 Lifecycle, versioning, install/remove

- Theia's lifecycle is documented on Drive ("02 Plug-in lifecycle"): resolve → classify → scan → contribute (Disposables) → start host → activate (activationEvents) → deactivate → uninstall.
- Activation events exist only in protos rung 05.
- A UI prototype (sandclaw `ui-protos.app/workspace-layout`) covers "layout repair when a plugin is uninstalled".
- The only versioning rule found: "bundles addressed by hash, one active version, pinned per session" (harness).
- A plugin-manager view is on the to-do list of the consolidation branch.
- **Gap:** no design for runtime install, activate, deactivate or remove, nor for semver or engine compatibility.

### 2.5 UI shell (DockView, shadcn, Tailwind, React)

**Exists (published):**

- `statewalker-shell-react`: React 19, `dockview-react` 8.4, `@json-render/*` 0.22, Tailwind v4.
  - `shell.view.react` (dock host, `MainShell`);
  - `ui.view.shadcn` (15 primitives, but **no menu, dropdown or toast**);
  - `render.view.react` (`<SpecRenderer>`);
  - `settings`, `explorer`, `mime.view.{image,markdown,pdf,video}`, `webapp.view.react` (`<SiteFrame>`).
- Kernel `shell.core`:
  - the commands `dock:show-panel/close-panel/focus-panel`;
  - the slots `dock:side-panels`, `dock:header-items` and `dock:overlays` (dialogs, toasts);
  - `render.core` `LayoutStore`, which saves `dock-layout.json`.
- sandclaw `app-shell` (private) has `bootShell` and the `app-shell:menubar-items` slot.

**Designed or prototyped:**

- Drive "01 Common Foundation" (2026-10-02): a headless kernel of CommandRegistry, MenuRegistry, ContextKeyService, KeybindingService, WidgetRegistry, MessageService (`t()`) and LayoutService; shadcn tokens drive Tailwind `@theme` and Dockview's `--dv-*` variables.
- Drive "06 Recommended Shell Direction": dockview-core + Basecoat chrome + headless kernel; a React + shadcn adapter; iframe islands for untrusted content; an "AI view" panel.
- sandclaw `ui-protos.app` (about 35 topics, design only):
  - `contracts.ts` defines `AppView{zone, activityOrder, mobile:"tab"|"more"}` and `AppMenuItem{menu, submenu, shortcut, command}`;
  - desktop, compact and mobile modes;
  - notifications (bell + toasts), task strip, installer mock, agent tools (Allow/Ask/Block per command).
- Decision D7: "one dockview with zones; side bars fixed but each can be unlocked".
- Drive "02 Mobile" (Theia-Httpeers): Theia is unusable on phones, and Dockview cannot drag panels by touch.

**Gaps:** command palette, keybindings, a general menu model and notifications in published code; a shipped mobile mode.

### 2.6 Client components, JsonRender, A2UI, RPC

- json-render is published (`render.core` `SpecStore` with `spec:create/patch`, `json:catalogs`).
- A2UI v0.9.x exists only in the sandbox protos (rungs 02, 03, 07) and in the cellb sandbox `a2ui-stream` template.
- Drive design: three trust tiers:
  - spec (A2UI or json-render), untrusted;
  - catalog components, privileged;
  - iframe apps (`webrun-site-host`).

  Components are defined once in Zod and generate both catalogs. A2UI is the wire format; json-render's patch helpers are used for agent edits.
- Guideline K (19 Sep): JsonRender only for generated UI, not for hand-written views ("1.7× the code, +47 KB gzipped").
- **Open, and recurring:** json-render, A2UI, or both.

### 2.7 i18n, l10n, branding

- **i18n is absent from the statewalker stack.** The only implementation is Theia `nls.localize` in shell-theia.
- Designed on Drive:
  - `t(key, default, args)`, namespaced keys, `Intl`, RTL through logical utilities (Drive 06);
  - errors written as i18n keys with params (file-manager notes);
  - Theia's `package.nls.<lang>.json` documented for reference.
- Branding: only shadcn theme tokens and a `.dark` variant. Market positioning is covered on Drive ("SandClaw two-door brand"; the name collides with the live `sandclaw.ai`).
- **Gap:** a white-label and theme contribution point; a locale contribution point per fragment.

### 2.8 AI-agent orientation

- **Most developed area:**
  - Wayfinder map root #70 and spec #111 ("AI harness on CellB, CellD and Workers", 76+ stories, `ready-for-agent`);
  - ADR `2026-11-16-harness-in-statewalker-ai`;
  - packages `ai-environment`, `ai-access`, `ai-definitions`, `ai-sessions`, `ai-flue`, `ai-host-do`, `ai-openai-compat`, `ai-uhp`, `ai-conformance`;
  - tools as OpenAPI 3.1 projected to MCP and Flue (#90);
  - modes and approvals (#79, #96);
  - research notes in `docs/research/`.
- Commands as agent tools: a filtered `CommandsRegistry`, with Allow/Ask/Block per command (ui-protos).
- Biscuit/Datalog capability filesystem (`flue-capfs-do`).
- The harness has no code on `main` yet.

### 2.9 Integrations

| Area | What exists |
|---|---|
| HTTPeers | **httpeers:** core, access (Biscuit), member, hub (`llm` service), share, ghost, libp2p; deployables relay, hub, session-shell, llm-chat.<br>**Theia:** extensions `theia-httpeers`, `-proxy`, `-llm-chat`.<br>**Drive:** `mesh.core` designed as a kernel service. |
| Builders | **webrun-sites:** `webrun-builder`, `webrun-bundler` (esbuild-wasm), `webrun-modules`, `webrun-site-builder/-host`, `webrun-tailwind`, `webrun-build-service` (`/cdn`, `/transpile`, `/bundle`, `/build`).<br>**cellb:** `bundler`, `astro-builder`. |
| VCS | **webrun-vcs:** the VCS itself.<br>**kernel:** `workspace-vcs.core`, with git as a project nature (190 tests, no consumer).<br>**cellb sandbox:** history and GitHub push/pull. |
| Extraction and search | **statewalker-search:** indexers.<br>**Drive:** design for `indexer-api` with `ModalityProvider`s fused by RRF.<br>**kernel:** `mime.core` `files:indexers` slot.<br>**sandclaw:** `wiki.core` hybrid search (FlexSearch + vector). |
| Notebooks | **statewalker-knowledge:** `notebook-build/-db/-site` (Observable notebook-kit).<br>**cellb:** `notebooks` (Astro theme, precomputed SQL, cellb.dev#140, 27/27 on Wrangler, celld and CellB). |
| Editors | **Gap** in the kernel and shell-react (Markdown is view-only). Editors exist in Theia and the cellb sandbox. |
| Document viewers | `mime.view.{image,markdown,pdf,video}`; Theia (EmbedPDF); read-only PDF, DOCX and XLSX in ui-protos.<br>Drive "07 Application landscape": Univer, SheetJS, Excalidraw/tldraw.<br>**Gap:** Docx and Excel editing, diagrams. |
| EmDash | `cellb.dev/examples/emdash` (deployed on cellb.httpeers.net); celld-emdash session.<br>Portable Text + HTML chosen as the "universal content model". |
| AI chat | sandclaw `chat-mini.chat(-react)`; httpeers `llm-chat`; `theia-llm-chat`. Three runtimes to converge. |
| NotebookLM-like | Drive "03 LLM Wikis: NotebookLM × DeepWiki": grounded chat with citations first, then automatic TOC and summaries; sandclaw `wiki.core`. |
| Theia parity | shell-theia: browser-only Theia 1.76. `p6-vscode-extension` runs VS Code web extensions in the browser.<br>Decided: keep Theia as a reference, not as a dependency (DI, 24–37 MB bundle). |

---

## 3. Decisions to make before building

Each is now a grilling ticket on the map (#113 to #118).

1. **Base unit**: is the fragment the base, with DOs as one packaging (Q2, 2026-10-20), or is "`wrangler.jsonc` per fragment" the base (today's request)?
2. **Manifest format**: `plugin.json` + namespaced folders, aligned with harness #82, beside `wrangler.jsonc`, versus a single file.
3. **Client spec layer**: A2UI, json-render or both. The Drive proposal: Zod-defined components generate both catalogs.
4. **Repository**: the 2026-10-20 Q3 is still open: one monorepo, two repositories, or merge only kernel + shell-react. Where do the consolidation branch and `kernel.core` land? Does this become a new project?
5. **Third-party plug-ins**: in scope or not (iframe isolation, capability manifest per host).
6. **Shell chrome**: dockview-react + shadcn (shipped) or dockview-core + Basecoat (Drive recommendation).

---

## 4. A possible shape for the empty platform

**(inference)** Sketch only. Everything here reuses packages that already exist.

```
my-fragment/
  plugin.json             # id, version, engines.platform, requires[], activationEvents[]
  wrangler.jsonc          # server half: DOs, services, bindings (cellb / celld / workerd)
  dev.statewalker.ui/
    contributes.json      # commands, menus (→ command ids), views/docks, settings schema, themes
    catalog/*.ts          # client components (Zod-defined → json-render / A2UI catalog)
    l10n/<lang>.json      # namespaced message bundles
  skills/, mcp.json, dev.cellb.harness/   # agent half, as in harness #82
```

**Core** (headless, isomorphic):

- shared-slots and shared-commands;
- a `kernel.core` fragment host (id/require, hot load and unload) extended with activation events, install/remove and hash-pinned versions;
- a route table mapping fragment → base URL;
- `t()` + `Intl`;
- a theme/brand slot.

**Shell**: shell-react (dockview zones, desktop, compact and mobile modes) plus the missing menu, dropdown, toast, palette and keybinding primitives.

**Demo plug-ins (2–3) that together show every feature:**

1. **Files & viewers**:
   - a FilesApi DO, the explorer dock, mime viewers, an editor;
   - commands, menus and context menus;
   - an l10n bundle in two languages.
2. **Notes & notebook**:
   - an incremental build through webrun-builder, a notebook preview dock, full-text and vector search;
   - VCS history;
   - shows server services running in the browser and on Workers.
3. **Assistant**:
   - AI chat over the harness session API;
   - fragment commands exposed as agent tools (Allow/Ask/Block);
   - an A2UI or json-render surface the agent generates;
   - an LLM through an httpeers hub proxy.

---

## 5. Key references

**Drive:**

- "2026-10-23.Durable-Objects" folder (files 01–05, especially 02);
- "2026-11-09.Cellb-Extension-Platform";
- 2026-10-02 Shell (01, 04, 06, 07) and the Theia comparison (01, 02, 06);
- "06 – Thematic Reorganization" (2026-09-30);
- 2026-09-02 Httpeers-Shell (02, 03, 38);
- file-manager notes 06 and 12;
- "03 – LLM Wikis".

**Sessions:**

- Sandclaw apps grilling (2026-10-20/21);
- Statewalker shell consolidation (2026-10-18);
- Theia Platform (2026-09-25);
- Local-first coding platform with CellB (2026-11-11);
- CellB ESM builders (2026-11-09);
- Notebook runtime (2026-10-31);
- celld-emdash (2026-10-07).

**Code:**

- cellb.dev `packages/cellb`, `packages/platform`, `apps/sandbox`;
- kernel `backbone.*`, `shell.core`, `render.core`, `mime.core`;
- shell-react;
- sandclaw `app-shell`, `apps/ui-protos.app`;
- sandbox `apps/httpeers-shell-protos`, `apps/mvc-blueprint-03`;
- shell-theia `protos/p5`, `p6`.

**Root:** #70, #82, #111; ADR `2026-11-16-harness-in-statewalker-ai`; `docs/refactoring/README.md`.
