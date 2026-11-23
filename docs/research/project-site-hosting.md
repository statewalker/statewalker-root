# What are the hosting options for every project site and its demos?

Research for `statewalker/statewalker-root#235`, 2026-11-23. Statements marked **(inference)** are
this note's own reasoning. It does not choose a host; the choice is a separate grilling ticket.

Sources read:
- the projects, at cellb.dev `2251670`, webrun-vcs `479fa64`, httpeers `9e4d350`,
  statewalker-sites `83ee6aa`;
- Cloudflare's documentation. `developers.cloudflare.com` was not reachable from this session, so
  the pages were read from their source, [cloudflare/cloudflare-docs](https://github.com/cloudflare/cloudflare-docs)
  at `1c6e632` (2026-11-22), `src/content/docs/<path>.mdx`. Links below point at the published
  pages of the same paths;
- RustFS's documentation, [rustfs/rustfs](https://github.com/rustfs/rustfs) at `6cb0e69`;
- the [Public Suffix List](https://github.com/publicsuffix/list/blob/main/public_suffix_list.dat).

## Question

What are the options for hosting every project site and its demos on one host, and what does each
cost and allow? The sites are static Astro builds with live cells that run in the browser. Some
demos run Durable Objects in the browser through CellB, with Workers, service workers and Wasm.

The three options:

- **A. The httpeers static-site host.** S3 (RustFS) at `s3.httpeers.net`, the `sites` app, Caddy
  in front. Used today by cellb.dev (and its demo subdomains), vcs.statewalker.com and
  httpeers.com.
- **B. Cloudflare Workers static assets.** An assets-only Worker (no `main`). Used today by the
  five statewalker-sites packages.
- **C. Cloudflare Pages.**

## Answer

| Criterion | A. httpeers host | B. Workers static assets | C. Cloudflare Pages |
|---|---|---|---|
| Price at our traffic | The server we already run; no per-request price. Server cost and traffic are not recorded in any repository. | $0: static asset requests are free and unlimited on Free and Paid. Paid ($5/month per account) only for higher limits or Worker code. | $0: static asset requests are free and unlimited on both plans. |
| Size limits | None in the app; bounded by the server's disk. Range requests supported. | 20,000 files per version (Free), 100,000 (Paid); 25 MiB per file. No range requests (200 with the whole file). | 20,000 files (Free), 100,000 (Paid); 25 MiB per file. |
| Custom domains | Any domain: an A record to the server, then a Caddyfile block (edited by hand on the server). | Custom Domain per Worker; the zone must be **active on Cloudflare** (nameservers moved). 100 per zone. No wildcard Custom Domains. | Subdomain: a CNAME from any DNS provider. Apex: the zone must be on Cloudflare. 100 domains per project (Free). No wildcards. |
| Domain redirects (`.org` → `.com`, `www.`) | Caddy `redir` blocks; already done for httpeers.org, www.httpeers.com, www.cellb.dev, vcs.statewalker.org. | Not in `_redirects` (no domain-level redirects). Needs Redirect Rules or Bulk Redirects in a Cloudflare zone, or a Worker. | Same as B. |
| TLS | Caddy, Let's Encrypt. HTTP-01 for exact names; DNS-01 wildcards need a Gandi token per zone. | Automatic. Universal SSL covers apex and one level; a Custom Domain gets its own certificate at any depth. | Automatic. |
| Preview per pull request | None today. Possible as a publish to `pr-<n>-<project>.httpeers.net` **(inference)**, with cleanup to write. | Previews: `wrangler preview` per branch, own URL on `workers.dev` and/or a custom domain, 100 per Worker (Free), 500 (Paid). | Built in: one preview per branch and PR, `<branch>.<project>.pages.dev`; kept 30 days or among the last 100. |
| Subdomain per demo | Free: wildcard DNS and certificate for `*.cellb.dev` and `*.httpeers.net`; a demo is a new prefix. Needs the publishing key's policy extended. | One Worker per demo, each with a Custom Domain. 100 Workers per account (Free), 500 (Paid). | One project per demo, 100 projects per account. |
| COOP/COEP, CSP, `Service-Worker-Allowed` | Not per site: the app sets only CORS and `Cache-Control`. Caddy can add headers per host, by hand. Demos use a service-worker shim for isolation today. | `_headers` file in the build: 100 rules, 2,000 characters per line, per path. | `_headers`, same limits. |
| Separate registrable domains (cross-site frames) | Any domain we own, each needing DNS and a Caddy block. | Any zone on Cloudflare. `*.workers.dev` hosts share the account's `<sub>.workers.dev` site. | Any domain. `*.pages.dev` hosts share the project's `<project>.pages.dev` site. |
| Deploys from CI without long-lived secrets | No: an S3 key pair per project in GitHub secrets. RustFS main supports OIDC web-identity STS, untested here. | No OIDC for the API: an API token in secrets (scope, expiry, IP filter possible). Or Workers Builds (Cloudflare's GitHub App): no secret in the repository. | Same: API token for Direct Upload, or the Git integration. |
| Who operates what | We run everything: one server, Caddy, RustFS, the sites app, DNS at Gandi, certificate tokens, backups. Caddyfile changes are manual. | Cloudflare runs serving, TLS, DNS. We keep `wrangler.jsonc`, the token and zones. | Cloudflare. Cloudflare tells new projects to start on Workers, not Pages. |

## 1. Price

- **A.** The host serves the files itself; no published price applies. Neither the server's cost
  nor visitor numbers appear in the repositories or root docs, so "price at our traffic" for A is
  the share of one existing server **(inference)**. The same server also runs the relay, STUN and
  the LLM appliance (`httpeers/deploy/README.md`), so a traffic spike on a site competes with them
  **(inference)**.
- **B.** "Requests to static assets are free and unlimited… There is no additional cost for
  storing Assets"
  ([billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)).
  Workers Paid is "a minimum charge of $5 USD per month for an account", with no egress charges
  ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)). The Free plan's
  100,000 requests a day count Worker invocations, not asset requests
  ([limits](https://developers.cloudflare.com/workers/platform/limits/)).
- **C.** "On both free and paid plans, requests to static assets are free and unlimited"
  ([Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)).
- For B and C, the price of a static site is $0 whatever the traffic; Paid is needed only above
  the Free file count (20,000) or Workers count (100) **(inference)**.

## 2. Size, files and serving

- **A.** The `sites` app supports byte ranges, `ETag`, per-site `cacheControl` and `cacheRules`,
  precompressed `.br`/`.gz` and SPA fallback (`httpeers/apps/sites/README.md`). Caddy does not
  compress. A re-published file can take up to 60 s to appear (resolution cache).
- **B.** 20,000 files per version (Free), 100,000 (Paid), 25 MiB per file
  ([limits, Static Assets](https://developers.cloudflare.com/workers/platform/limits/#static-assets)).
  A request with `Range` gets "`200 OK` with the full file instead of `206 Partial Content`"
  unless a Worker serves it
  ([billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)).
  Default `Cache-Control: public, max-age=0, must-revalidate` with a content-hash `ETag`
  ([headers](https://developers.cloudflare.com/workers/static-assets/headers/)).
- **C.** 20,000 files (Free), 100,000 on paid plans, 25 MiB per file; builds in Cloudflare are
  500 a month on Free ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)).
- No site build was at hand to measure. Large Wasm files today come from the Wasmer registry,
  jsDelivr and unpkg, not from our host (`cellb.dev/site/scripts/check-containers.mjs`). A
  self-hosted Wasm binary over 25 MiB would not fit B or C **(inference)**.

## 3. Custom domains and redirects

- **A.** Exact names (`httpeers.com`, `vcs.statewalker.com`, `cellb.dev`) need an A record in
  their own zone, then a Caddyfile block; the Caddyfile is a bind mount that a person copies and
  reloads on the server ("Nothing deploys this file", `httpeers/deploy/README.md`). Host-level
  redirects are Caddy `redir` blocks: `www.httpeers.com`, `httpeers.org`, `www.httpeers.org` →
  `httpeers.com`, `vcs.statewalker.org` → `vcs.statewalker.com`, `www.cellb.dev` → `cellb.dev`
  (`httpeers/deploy/Caddyfile`). Path redirects: none in the app; cellb.dev publishes HTML pages
  that redirect (`cellb.dev/.github/scripts/redirect-site.sh`).
- **B.** A Custom Domain needs "an active Cloudflare zone", does not support wildcard DNS
  records, and the limit is 100 per zone
  ([custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
  [limits](https://developers.cloudflare.com/workers/platform/limits/)). A CNAME (partial) zone
  setup is Business or Enterprise only
  ([partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/)), so on Free
  every domain's nameservers move to Cloudflare **(inference from the two pages)**. `_redirects`
  allows 2,000 static and 100 dynamic rules but **no domain-level redirects**
  ([redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)). Domain
  redirects go to Single Redirects (10 rules per zone on Free) or Bulk Redirects (15 rules, 10,000
  URLs per account on Free), available on every plan
  ([URL forwarding](https://developers.cloudflare.com/rules/url-forwarding/)).
- **C.** A subdomain can stay at any DNS provider with a CNAME to `<site>.pages.dev`; an apex
  must be a zone on the same Cloudflare account
  ([Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)).
  Wildcard custom domains are not possible
  ([known issues](https://developers.cloudflare.com/pages/platform/known-issues/)).
  `_redirects` limits as in B ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)).
- Today: `statewalker.com` is at Cloudflare (DNS only for `vcs`); `httpeers.net`, `httpeers.com`,
  `httpeers.org`, `cellb.dev` and `statewalker.org` are at Gandi LiveDNS
  (`httpeers/deploy/README.md`). Moving all sites to B means moving those zones to Cloudflare
  **(inference)**.

## 4. TLS

- **A.** Caddy issues Let's Encrypt certificates. Wildcards (`*.httpeers.net`, `*.p.`, `*.s.`,
  `*.cellb.dev`) use DNS-01 with a Gandi Personal Access Token per zone and a 2-minute
  propagation delay; exact names use HTTP-01 and must resolve to the server before their block is
  deployed (`httpeers/deploy/Caddyfile`, `deploy/README.md`). Let's Encrypt's rate limits are per
  registered domain, which is why `caddy_data` is kept across redeploys.
- **B.** A Custom Domain creates DNS records and a certificate; Universal SSL "covers the apex and
  one level of subdomain only", and the Custom Domain's own certificate covers deeper names
  ([custom domains, Certificates](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#certificates)).
- **C.** Automatic; Pages manages the minimum TLS version and ciphers for its hostnames, which
  zone settings cannot change
  ([Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)).

## 5. A preview deploy per pull request

- **A.** None today: every `site.yml` builds and tests on pull requests and publishes only from
  `main`. A preview could be published to a one-level name under the wildcard, such as
  `pr-12-cellb.httpeers.net`, with no DNS or Caddy change, if the key's policy allows that prefix
  and a job deletes it when the PR closes **(inference)**. Secrets are not given to pull requests
  from forks, so previews would work for branches of the repository only **(inference)**.
- **B.** Previews: "`npx wrangler preview` creates or updates a Preview for your current branch
  under the same Worker", with a Preview URL (latest) and a Deployment URL (fixed), on
  `<preview-name>-<worker-name>.<subdomain>.workers.dev` or `<preview-name>.app.example.com`.
  100 Previews per Worker on Free, 500 on Paid; the oldest is deleted at the limit. Public by
  default; Cloudflare Access can protect them. Needs Wrangler 4.135.0 or later
  ([Previews](https://developers.cloudflare.com/workers/previews/),
  [custom domains](https://developers.cloudflare.com/workers/previews/custom-domains/)). The
  docs give a GitHub Actions workflow that names the preview `pr-<n>`, comments its URL and
  deletes it on close ([examples](https://developers.cloudflare.com/workers/previews/examples/)).
- **C.** The Git integration creates a preview for each PR from the repository itself, at
  `<hash>.<project>.pages.dev` plus a branch alias `<branch>.<project>.pages.dev`; kept 30 days
  or while among the last 100 deployments
  ([preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/),
  [limits](https://developers.cloudflare.com/pages/platform/limits/)).
- A preview on `workers.dev` or `pages.dev` is a different origin from production, so service
  workers and storage start empty there, which is what a preview wants **(inference)**.

## 6. A subdomain per demo

Demos need their own origin: "EmDash and the Astro builder take their whole origin (a
ServiceWorker at `/`…), and a demo that runs code from npm must not share cellb.dev's storage"
(`cellb.dev/site/README.md`, Domains).

- **A.** `*.cellb.dev` and `*.httpeers.net` have wildcard DNS and wildcard certificates, so a new
  demo is a new bucket prefix. The only setup is adding the name to the publishing key's policy
  (`SITE_DOMAINS` in `site/scripts/setup-publish-secrets.sh`). A deeper level (`*.s.cellb.dev`)
  needs another wildcard record and certificate (`cellb.dev/site/README.md`).
- **B.** One Worker per demo with its own Custom Domain (no wildcard Custom Domains). Routes take
  `*.example.com/*` patterns ([routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)),
  but one Worker serves one asset directory, so many demos behind one wildcard would need Worker
  code that picks files by host **(inference)**. 100 Workers per account on Free, 500 on Paid.
- **C.** One project per demo; 100 projects per account, "not routinely increased"
  ([limits](https://developers.cloudflare.com/pages/platform/limits/)).

## 7. Response headers for live cells and demos

- **What is needed.** `SharedArrayBuffer` needs a cross-origin isolated page, which needs
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy` (`require-corp` or
  `credentialless`). CellB shard workers and cross-site frames need the same, and a frame needs
  `allow="cross-origin-isolated"` (`docs/research/cellb-frame-nodes.md`, section 2). A service
  worker can take a wider scope than its script's folder only with `Service-Worker-Allowed`
  ([Service Workers spec](https://www.w3.org/TR/service-workers/)).
- **A.** The `sites` app sets CORS (per-site `cors` list), `Cache-Control`, `ETag`,
  `Content-Encoding`, ranges, and nothing else (`httpeers/apps/sites/src/serve.ts`,
  `site-config.ts`). Caddy can add headers per host block (it already sets a
  `Content-Security-Policy: frame-ancestors …` on `*.p.httpeers.net`), but that is an operator
  edit, not something a site's build can choose. The containers demos work around it: their
  service worker "gives every page of its scope cross-origin isolation (COOP `same-origin`, COEP
  `credentialless`): a static host sends no such headers"; the first visit reloads once
  (`cellb.dev/packages/containers/examples/browser-demos/README.md`). Per-site headers in
  `.site/config.json` would be a change to the `sites` app **(inference)**.
- **B.** A `_headers` file in the build adds, overrides or removes headers by path or absolute
  URL; 100 rules, 2,000 characters per line; not applied to responses made by Worker code
  ([headers](https://developers.cloudflare.com/workers/static-assets/headers/)). So COOP/COEP,
  CSP and `Service-Worker-Allowed` can be set by each site's build **(inference)**. Cloudflare
  "reserves the right to attach new headers to static asset responses at any time".
- **C.** The same `_headers` format and limits
  ([Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)).
- With real headers the reload of the service-worker shim is not needed, and the isolation also
  holds on a page's first load **(inference)**.

## 8. Separate registrable domains

Cross-site frames raise the renderer limit only on separate registrable domains
(`docs/research/cellb-frame-nodes.md`, answer 3). `workers.dev` and `pages.dev` are public
suffixes (Public Suffix List, lines 12797 and 12799), so the registrable domain is the account's
`<subdomain>.workers.dev` or the project's `<project>.pages.dev`: two Workers of one account are
same-site, two Pages projects are cross-site **(inference from the list)**. On any option, frames
on separate domains of our own (for example `cellb.dev` and `httpeers.net`) are cross-site.

## 9. Deploys from CI without long-lived secrets

- **A.** Today each project stores `HTTPEERS_S3_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY`, a RustFS user
  limited to its prefixes, created and rotated by `cellb.dev/site/scripts/setup-publish-secrets.sh`
  over ssh. RustFS's main branch documents `AssumeRoleWithWebIdentity` for workload OIDC issuers
  (issuer, JWKS, audience, and claims mapped to policies,
  [oidc-provider-requirements.md](https://github.com/rustfs/rustfs/blob/main/docs/operations/oidc-provider-requirements.md)).
  The server runs `rustfs/rustfs:v1.0.0-rc.5` (`httpeers/deploy/docker-compose.yml`); whether that
  version has it was not checked. GitHub's tokens carry the repository in claims, not in a
  `groups` claim, so limiting each repository to its own prefix may need policy conditions on
  those claims; a token from any GitHub repository with the right audience must not get a write
  policy **(inference, untested)**.
- **B.** Wrangler in CI needs "a Cloudflare API token and account ID"; the token can be scoped to
  one account and given an expiry and a client IP filter
  ([GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
  [create token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)).
  Cloudflare's docs describe no GitHub OIDC exchange for the API (none found in the docs
  source). The alternative is Workers Builds through the Cloudflare Workers & Pages GitHub App:
  builds run in Cloudflare, comment Preview URLs on PRs, 3,000 build minutes a month on Free
  ([GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/),
  [limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)).
  statewalker-sites uses the token route and warns against running both, which deploys twice
  (`statewalker-sites/README.md`).
- **C.** `wrangler pages deploy` with the same token, or the Pages Git integration
  ([direct upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)).
- With Cloudflare's GitHub App the builds move off our CI, where the sites' Chromium checks
  (`check:examples`, `check:containers`) run today; the checks would stay in GitHub Actions and
  the deploy would no longer wait for them **(inference)**.

## 10. Who operates what

- **A.** We do: one server (relay, STUN, sites, RustFS, LLM appliance), the `httpeers-ingress`
  image (never auto-deployed, since restarting it restarts TLS for everything), the Caddyfile
  (copied by hand), Gandi tokens per zone, the external `httpeers_rustfs_data` volume "holds every
  published site" (`httpeers/deploy/README.md`). One host is one point of failure for every site
  **(inference)**. The upside: the same host is the hosted product's base in
  `docs/research/monetization-strategy.md` ("publish to `*.httpeers.net`"), so the sites
  exercise it.
- **B.** Cloudflare serves, terminates TLS and runs DNS for the zones; we keep the zones, one
  `wrangler.jsonc` per site and the token. Cloudflare calls Workers "Cloudflare's primary
  platform… Start new projects with Workers"
  (the note on [Pages' overview](https://developers.cloudflare.com/pages/), which links the
  [migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)).
- **C.** As B, on a product Cloudflare steers new projects away from (the note above is shown on
  Pages' own pages).

## Trade-offs

- **A** keeps every site and demo on infrastructure we own and dogfood, with free wildcard demo
  subdomains, ranges and no file limits; it lacks per-site headers, PR previews and keyless
  deploys, and one server and one operator carry all of it.
- **B** gives per-site headers, PR previews, free unlimited static traffic and managed TLS; it
  needs every zone on Cloudflare, one Worker and Custom Domain per demo, Redirect Rules for
  domain redirects, an API token (or Cloudflare's GitHub App), and has no range requests.
- **C** matches B on headers and price, adds subdomains without moving DNS and the simplest PR
  previews, but is the platform Cloudflare tells new projects not to start on.
- A mix is possible: sites on B with demos on A, or the reverse **(inference)**.

## Open

- The server's monthly cost and the sites' traffic (no records found).
- Whether RustFS `v1.0.0-rc.5` supports web-identity STS, and how to bind GitHub claims to
  per-repository prefixes.
- Largest file in each site's and demo's build, against the 25 MiB limit of B and C.
