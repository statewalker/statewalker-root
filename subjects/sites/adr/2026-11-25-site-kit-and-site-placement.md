# Site kit in statewalker-knowledge; site content in each project, one site build in statewalker-sites

**Status**: accepted, 2026-11-25. Decided in
[Where does the site kit live, and which packages does it split into?](https://github.com/statewalker/statewalker-root/issues/237),
on the map [Project sites: one standard for every statewalker site](https://github.com/statewalker/statewalker-root/issues/232).
Supersedes the map's earlier note that each project's site, build included, lives in its own `site/`.

## Context

Three Astro sites (cellb.dev, webrun-vcs, httpeers) copied one scaffold and drifted; the FSM,
webrun and hub sites are Observable Framework packages in the private statewalker-sites
(`subjects/sites/research/project-sites-inventory.md`). The pipeline that builds notebook pages is split
between statewalker-knowledge (`notebook-build`, `notebook-site`: published, lower-layer
dependencies only) and cellb.dev's private `cellb-notebooks` (page models, Astro theme and the
`NotebookSite` Durable Object, tied to cellb platform packages)
(`subjects/sites/research/notebook-site-pipeline.md`). The standard wants cells type-checked against a
project's real packages, examples run against current source and snippets cut from tested files,
while keeping heavy site tooling out of every project's CI and running the hub, theme, search and
deploys from one place.

## Decision

1. **The site kit lives in statewalker-knowledge** (L3) and splits into published packages:
   - `@statewalker/notebook-build` (exists): parse, resolve, transpile (jsx/tsx included); only
     `js`/`ts`/`jsx`/`tsx`/`sql` fences run;
   - `@statewalker/notebook-pages` (new): page models, Portable Text, search, built-ins, data-loader
     and SQL helpers with their Node runners; the portable half of today's `cellb-notebooks`;
   - `@statewalker/notebook-typecheck` (new): the reactive cell type checker, pinned to TypeScript
     5/6, kept out of `notebook-build`;
   - `@statewalker/site-kit` (new): the Astro integration and static theme (layout, nested
     navigation, table of contents, search, cell output styles), the shadcn components, the
     site-config and theme-preset hooks;
   - `@statewalker/site-checks` (new): CLI checks (links, live cells in Chromium, snippets,
     glossary lint, demo smoke tests);
   - `@statewalker/site-api-reference` (new): TypeDoc JSON to page models, pinned to TypeScript
     6.0.3.

   They release through statewalker-knowledge's changesets and the merge gate; each new package's
   first version is published once by a human.
2. **cellb.dev keeps only the `NotebookSite` Durable Object host**, which depends on
   `notebook-pages` and keeps its own server theme for now.
3. **The kit owns the shadcn components.** Sites import them and never copy them; a site's
   identity is its shadcn/create preset and its pages.
4. **Site content stays in each project's `site/`**: notebook pages, examples, the project glossary
   and site config, as Markdown and TypeScript. Project CI runs `site-checks` and
   `notebook-typecheck` on it (cells type-checked and run against the workspace source), without the
   Astro build, so a code change fixes its docs in the same pull request.
5. **statewalker-sites holds the one site build**: it depends on `site-kit` from npm, checks out
   each project's `site/` content (and the repository Markdown the pages render) at a pinned
   commit, builds every project site and the hub, and deploys them. A merge in a project triggers a
   rebuild by a cross-repository dispatch.
6. Every dependency on the kit is an ordinary npm semver dependency through the pnpm catalog;
   only statewalker-knowledge uses `workspace:^`.

## Considered options

- **Kit in cellb.dev**: it owns the theme today, but the kit would carry cellb platform packages
  and sit after statewalker-knowledge. **A new project**: one more repository, CI and release path.
  **statewalker-sites**: private, so no npm provenance from trusted publishing.
- **The whole site in each project's `site/`** (the earlier note): simplest, but every project's CI
  and lockfile carry Astro, Playwright and the kit, and the hub, theme, search and deploys stay
  scattered.
- **A separate site repository per project**: about six more repositories, and docs checked only
  against published packages.
- **Every site, content included, in statewalker-sites**: docs would trail code by a release, a
  breaking change could not fix its docs in the same pull request, and repository Markdown would
  be read across repositories.

## Consequences

- A session changing a site's look, build or deploy needs statewalker-sites selected (it is
  private); one changing only content works in the project.
- A project's `site/` is a content folder, not an Astro app; the existing Astro apps in cellb.dev,
  webrun-vcs and httpeers move their build into statewalker-sites during the rollout.
- The light checks in project CI and the full build in statewalker-sites run the same
  `site-checks`, so a page that passes in its project fails later only on build or cross-site
  problems (links between sites, the hub).
