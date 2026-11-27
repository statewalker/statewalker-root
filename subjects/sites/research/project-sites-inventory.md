# What do the statewalker sites look like today?

Research for the map [Project sites: one standard for every statewalker site](https://github.com/statewalker/statewalker-root/issues/232),
2026-11-22. Read from shallow clones of `main`: cellb.dev `2251670`, webrun-vcs `479fa64`, httpeers
`9e4d350`, statewalker-sites `HEAD` of 2026-11-15. Statements marked **(inference)** are this note's
own reasoning. Earlier site work: root tickets #170, #171, #175.

## The sites

| Site | Code | Stack | Host and domain |
|---|---|---|---|
| cellb.dev | `cellb.dev/site` (`@statewalker/cellb-site`) | Astro, Tailwind v4, shadcn/ui tokens | httpeers static-site host (`rclone sync site/dist httpeers:sites/<domain>`), `cellb.dev`; demo subdomains `examples.`, `emdash.`, `astro.`, `containers.cellb.dev` (`examples-publish.yml`) |
| vcs.statewalker.com | `webrun-vcs/site` (`@statewalker/vcs-site`) | the same, copied from cellb.dev | httpeers host, `vcs.statewalker.com` (`.org` redirects) |
| webrun-vcs docs | `webrun-vcs/docs` (`@statewalker/vcs-docs`) | Observable Framework | GitHub Pages, `statewalker.github.io/webrun-vcs` (`deploy-docs.yml`) |
| httpeers.com | `httpeers/site` (`@statewalker/httpeers-site`) | the same as cellb.dev | httpeers host, `httpeers.com` (`.org`, `www.` redirect) |
| statewalker.com (**inference**) | `statewalker-sites/packages/site` | Observable Framework | Cloudflare Workers, assets only (`deploy-*.yml` → `_deploy.yml`, opt-in by `DEPLOY_ENABLED`); routes not in the repository |
| FSM | `statewalker-sites/packages/site-fsm` | Observable Framework | Cloudflare Workers; `fsm.statewalker.com` named in content |
| WebRun | `statewalker-sites/packages/site-webrun` | Observable Framework | Cloudflare Workers; `webrun.statewalker.com` named in content |
| Dots | `statewalker-sites/packages/site-dots` | Observable Framework | Cloudflare Workers |
| Blog | `statewalker-sites/packages/blog` | Observable Framework | Cloudflare Workers; 2021 posts and drafts |

webrun-vcs also has `notes/` (`@statewalker/vcs-notes`), an Observable Framework scaffold with no
workflow and no notes in it.

## Content

- **The three Astro sites** follow one pattern: hand-written guides (home, getting started,
  architecture, concepts), repository Markdown rendered in place (package and example READMEs,
  `docs/*.md`), and live examples.
  - cellb.dev renders about 40 repository files (`src/lib/docs.ts`), its glossary `CONTEXT.md`
    as `/docs/glossary`, and 70 example pages generated from `packages/cellb/conformance`
    (`scripts/build-examples.ts`). Builders pages show answers recorded by hand
    (`src/builders/recorded/*.json`).
  - webrun-vcs renders 15 package READMEs as its package reference; its 11 `apps/examples` and
    11 `apps/demos` are listed with links to GitHub, none deployed.
  - httpeers renders package and app READMEs, `docs/security-model.md`, and links deployed demos
    on `*.httpeers.net`.
- **statewalker-sites:**
  - `site` is one page linking FSM and WebRun, not the other project sites.
  - `site-fsm` has concepts, a hand-written `api.md`, examples, a demo and slides.
  - `site-webrun` has six short pages.
  - `site-dots` has pattern pages.
  - `site-fsm` and `blog` run live statecharts from the published `@statewalker/fsm*` packages
    inside Observable cells.
- **No site generates an API reference** (no TypeDoc or similar). The reference is the package
  READMEs, plus `site-fsm`'s hand-written `api.md`.

## Code on the pages

- **Live examples:** the source the page shows is the module that runs (`?raw` import beside a
  dynamic import).
  - cellb.dev runs its examples in a Dedicated Worker on CellB.
  - webrun-vcs (5 examples and a playground) and httpeers (5 examples) run theirs in the tab.
    httpeers' examples throw through `expect` when what they show did not happen, so their check
    is a test.
- **Typed-in snippets:** getting-started and architecture code is typed into the pages as template
  literals and never run: about 33 on cellb.dev, 21 on webrun-vcs and 16 on httpeers. The webrun-vcs
  Observable docs quick start is also typed in, though it still matches the API today.

## Checks

| Check | cellb.dev | webrun-vcs | httpeers | statewalker-sites |
|---|---|---|---|---|
| Build in CI | yes | yes | yes | yes (shared CI) |
| Live examples in Chromium (Playwright) | `check:examples` | `check:examples` | `check:examples` | none |
| Typed-in snippets run | `check:snippets` (home page only) | none | none | none |
| Links | none | `check:links` | `check:links` (different code) | none |
| Typecheck, lint | root scripts | root scripts | root scripts | root scripts |
| Terms, plain language | none | none | none | none |

## What is shared and what has drifted

The three Astro sites copied one scaffold instead of sharing a package:

| Lines that differ | Files |
|---|---|
| 0 | `src/lib/utils.ts`, `src/content.config.ts`, `components.json`, `ui/Badge`, `ui/Button` (and `ui/Card`, `ui/Tabs` between cellb.dev and webrun-vcs) |
| 0–2 | `CodeBlock`, `ThemeToggle`; `rehype-repo-links.ts` and `tsconfig.json` between webrun-vcs and httpeers |
| 3–21 | `compress.mjs`, `setup-publish-secrets.sh`, the `Base` layout, `astro.config.mjs` |
| 21–52 | `Header`, `Footer`, the `Docs` layout |
| about 115 | `global.css`: same structure; palette violet (cellb.dev), orange (webrun-vcs), teal (httpeers) |
| rewritten per site | `docs.ts`, `examples.ts`, `check-examples.mjs`, `check-links.mjs` |

Because nothing is shared, fixes must be copied by hand. `compressHTML: false` (the fix for words
glued to links, #175) is on webrun-vcs but not on cellb.dev (**inference**: cellb.dev has the same
bug). File names are PascalCase on cellb.dev and httpeers, kebab-case on webrun-vcs. statewalker-sites
shares nothing with the Astro sites; inside it, `blog` and `site-fsm` copy six files byte for byte.

## Problems found

- **Glossaries clash.** Only cellb.dev has one (`packages/cellb/CONTEXT.md`, about 63 terms). It
  contradicts the root `GLOSSARY.md`:
  - in the root glossary, **Host** is where server halves run and **Platform** is the fragment
    core and shell;
  - in `CONTEXT.md`, **Platform** is the place (Node or browser) and **Host** is the
    platform-specific code;
  - **Runtime** is defined differently too.
  No site links the root glossary.
- **Stale pages:**
  - cellb.dev's site README says Astro 5, while its `package.json` has `astro ^7.4.11`.
  - `site-webrun` documents `@statewalker/webrun-ports` (last published 2023) and links demos of
    `webrun-http-browser@0.3.3` (npm is at 0.18.0). It has nothing on webrun-wire, webrun-sites or
    webrun-vcs.
  - `site-fsm`'s own notes (`notes/2026-07-10/01-[core-only-cleanup]-plan.md`) record that it
    documented an API that no longer exists. They flag the rest of its pages for an accuracy check
    that has not been done (**inference**).
- **Demos:** webrun-vcs lists `apps/demos/git-cli-sandbox` with no caveat, though the project's
  `CLAUDE.md` calls it stale.
- **Two docs sites for one project:** webrun-vcs runs the new site and the Observable docs site in
  parallel, and the new one links to the old one (`OBSERVABLE_DOCS` in `site/src/lib/site.ts`).
- **Docs in two places:** `docs/refactoring/README.md` item 0.5 and `docs/projects.md` P9. The map
  settles them: each project's site lives in its own `site/`.
