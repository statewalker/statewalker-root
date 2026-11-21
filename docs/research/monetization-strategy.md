# How can the StateWalker projects make money, and what is the shortest path?

Research requested in a session on 2026-11-21 (no ticket yet). Sources: the README of every
project in `repos.json` (shallow clones of `main`, 2026-11-21), this repository's ADRs, research
notes and open issues, and the public web pages listed under **Sources**. Statements marked
**(inference)** are this note's own reasoning; figures from third-party sites are marked as such.

## Question

1. What has the ecosystem built, and which parts can be monetized, and how?
2. What has to be built on top to make that possible, and what is the shortest path?
3. How do comparable successful projects create and capture value? The Business Model Canvas
   cells used throughout: **value proposition**, **customer segments**, **customer
   relationships**, **channels**, **revenue streams**.
4. Which communities, partners and competitors can spread the word?

---

## 1. Headline

- **Everything published is MIT-licensed.** Nothing can be sold as a licence for the existing
  libraries, and nothing should be: they are the distribution engine. Money has to come from
  **things people cannot get from npm**: a hosted service (compute, storage, relays, domains,
  model tokens), team and enterprise features (accounts, SSO, audit, quotas, support, SLAs),
  and expertise (integration work, sponsored features).
- **The ecosystem's economic edge is that code runs on the user's device.** CellB runs Workers
  and Durable Objects in a browser tab, webrun-vcs runs git there, the search indexes and
  databases run there, and httpeers connects tabs without servers. A free user therefore costs
  close to nothing to serve. Bolt, Replit and E2B pay for a container for every free user;
  StateWalker would not **(inference)**. That makes a generous free tier affordable, the lever
  behind Tailscale's and Obsidian's bottom-up growth.
- **Timing favours CellB.** On 2026-10-09 the Deno team joined Cloudflare to merge workerd and
  celld and make self-hosted Workers and Durable Objects simpler; Deno Deploy closes within six
  months. Flue (the Astro team's agent framework) is Cloudflare's first framework on its Agents
  SDK, and EmDash (Astro CMS on Workers) reached 1.0. CellB is the only runtime that runs that
  whole stack, unchanged, **inside a browser tab and in Node**, in celld's storage format, and it
  has live demos of EmDash and Flue doing so.
- **Shortest path to revenue: one product, the CellB Sandbox, sold like Bolt or StackBlitz but
  for the Cloudflare stack.** An in-browser, agent-assisted workspace for Workers, Durable
  Objects, Astro/EmDash and Flue apps: build and run in the tab (free, near-zero cost), share
  over httpeers, version with webrun-vcs, publish to `*.httpeers.net` or to the user's own
  Cloudflare account. Charge for AI credits, always-on hosting of published apps, private
  projects, custom domains and team seats. About 70% of it exists: `cellb.dev/apps/sandbox` and
  `apps/sandbox-hub`, cellb itself, the Flue agent, the Astro builder, webrun-vcs, the httpeers
  sites host and relay. What is missing is the commercial shell: accounts, billing, metering
  (already ticketed: #127, #179–#181), a landing page and onboarding.
- **Revenue that needs no product, starting now:** sponsored development and integration work
  (the EclipseSource model around Theia), GitHub Sponsors, and conference talks that feed the
  Sandbox's funnel.
- **Focus is the main risk.** Twenty projects and five possible product lines; picking one wedge
  and letting the others be its features is the strategy. Section 6 says which.

---

## 2. What exists: the inventory, as sellable assets

Maturity: **live** (deployed, people can use it today), **published** (on npm, tested), **built**
(works, private), **designed** (decided in ADRs or specs, partly built), **skeleton**.

| Asset line | Projects | Maturity | What is unique |
|---|---|---|---|
| **A. CellB runtime** | cellb.dev (`@statewalker/cellb` 0.11) | published, live demos (EmDash served from a tab, Astro built in a tab) | Cloudflare Workers + Durable Objects + KV/Queues/D1/R2/Workflows/Worker Loader in **browser and Node**, celld's storage format, 70 recorded conformance scenarios judged by real celld. Nobody else runs DOs in a tab. |
| **B. App platform on CellB** | statewalker-kernel → statewalker-platform, shell-react, shell-theia, cellb.dev `packages/platform` (ESM CDN, bundler, Astro builder, notebooks), `apps/sandbox`, `apps/sandbox-hub` | built (sandbox, platform DO apps), designed (fragments, ADRs 2026-11-17…21, map #112) | Theia-like extensible workbench whose plug-ins (fragments) have a `wrangler.jsonc` server half; runs with no backend; browser-only Theia over any FilesApi. |
| **C. AI harness** | statewalker-ai (spec #111) | skeleton; tickets for tenancy, model gateway, meters, limits, usage API (#127, #134, #179–#181) | Agents over the user's own files with capability-based access, on CellB, CellD and Workers; OpenAI and UHP projections; Flue, pi, opencode run in DOs, offline against a fake model. |
| **D. HTTPeers mesh** | httpeers (+ webrun-wire, webrun-biscuit) | published libraries; **live** infrastructure: relay, static-site host `*.httpeers.net`, session shell `*.p.httpeers.net`, S3, hub, LLM appliance | Everything is a `fetch()`: browser tabs and Node processes serve HTTP to each other over libp2p, Biscuit tokens and Datalog policy, invitations by QR, share a local service (PeerShare), share a local LLM. |
| **E. Data layer** | webrun-vcs, webrun-sync, webrun-files, statewalker-db, statewalker-search, statewalker-knowledge, sandclaw (`wiki.core`, `file-mounts.core`) | published; webrun-vcs has a site (vcs.statewalker.com) and native-git twin tests | Git (fetch/push v1/v2, LFS, Hugging Face Xet read client) with no native binary, in browser/Node/workers; rclone-like sync; one FilesApi over memory/OPFS/S3/SQLite/HTTP/RPC; one Db over DuckDB/SQLite/PGlite; hybrid search; notebooks to static sites; LLM-curated wiki. |
| **F. Tools** | statewalker-fsm, webrun-devtools | published | HFSM runtime with a validator that emits prompts for agents; a Chrome extension giving Playwright-like automation to scripts in a page or notebook. |

**(inference)** Lines A, D and E are mature enough to be features of a product today; B and C
are the product's future, not its first version.

---

## 3. Comparable projects, through the canvas

Each block names the comparables, fills the five cells, and ends with what made them work and
what StateWalker can borrow. Figures from third-party aggregators are flagged.

### 3.1 In-browser runtimes and AI app builders (compare: CellB, the Sandbox)

**StackBlitz (WebContainers, Bolt.new), CodeSandbox, Replit**

| Cell | What they do |
|---|---|
| Value proposition | A full Node dev environment in a tab, instant, no install (StackBlitz). "Describe an app and get it running and deployed" (Bolt, Replit Agent). |
| Customer segments | Front-end developers, docs and tutorial authors (embeds), companies embedding an IDE (WebContainer API licensees), and since 2024 non-developers building apps with AI. |
| Customer relationships | Self-serve, community, templates; enterprise sales for the API licence. |
| Channels | Embeds in framework docs and tutorials (each embed is an ad), viral "built with Bolt" links, social demos. |
| Revenue streams | Seats (StackBlitz Pro/Teams: about $18 and $55 per member, third-party figures); **a commercial licence for the WebContainer API**, custom-quoted, required only for production use in a for-profit setting; AI token plans (Bolt's plans now bundled with StackBlitz's). |

Why it worked: WebContainers spent years as a free, impressive technical demo embedded in
framework docs; when AI app generation arrived, StackBlitz had the only runtime that could run
the generated app instantly at zero server cost, and Bolt reportedly passed tens of millions of
ARR within months. CodeSandbox, with container-based VMs, was acquired by Together AI (2024).

**Borrow:** (1) the embed as the channel: every Astro, EmDash, Flue and Cloudflare tutorial could
carry a "run it in your tab" CellB embed; (2) the AI app builder as the monetized surface on top
of the runtime; (3) a commercial licence for embedding in for-profit products, which StateWalker
can only apply to **new** non-MIT code (for example a hosted multi-tenant control plane), never to
cellb itself.

### 3.2 Edge platforms (compare: CellB, the platform's hosting)

**Cloudflare Workers / Workers for Platforms / Dynamic Workers; Deno Deploy (closing); Vercel, Netlify; celld**

| Cell | What they do |
|---|---|
| Value proposition | Run code globally with no servers; Durable Objects give state with strong consistency; Workers for Platforms lets SaaS vendors run their customers' code. |
| Customer segments | Developers, SaaS platforms that host user code, enterprises (security bundle). |
| Customer relationships | Self-serve with a free tier; enterprise account teams; Launchpad startup programme. |
| Channels | Developer blog and docs, framework partnerships (Astro team, Flue, EmDash), acquisitions of developer tools (PartyKit 2024, the Deno team 2026). |
| Revenue streams | Usage: requests ($0.30/M), CPU ($0.02/M ms), storage; Workers for Platforms $25/month base; Dynamic Workers $0.002 per worker per day beyond 1,000/month; DO duration and storage. |

Why it worked: primitives that are cheap at the margin, a free tier that captures hobbyists who
later bring their employer, and framework partnerships that make the platform the default deploy
target. Deno Deploy's fate shows the limit for small runtime vendors competing on hosting alone:
the team was absorbed and the hosted product closed.

**Borrow:** do not compete with Cloudflare on hosting; be the **complement** that sends users to
it (develop and preview in the tab, deploy to Cloudflare) and the escape hatch it lacks (offline,
on-device, in Node tests). Being acquired by Cloudflare, as PartyKit and the Deno team were, is a
realistic exit, and the way to earn it is adoption inside Cloudflare's own communities
**(inference)**.

### 3.3 Networking (compare: HTTPeers)

**Tailscale (WireGuard), ngrok, Cloudflare Tunnel, ZeroTier/NetBird**

| Cell | What they do |
|---|---|
| Value proposition | Devices on one private network with no configuration (Tailscale); a public URL for localhost in one command (ngrok, Tunnel). |
| Customer segments | Home-labbers and developers first, then IT and security teams. |
| Customer relationships | Self-serve, generous free plan, excellent docs and blog, enterprise sales later. |
| Channels | Word of mouth in r/selfhosted, Hacker News, home-lab YouTubers; developers bringing it to work. |
| Revenue streams | Seats: Tailscale's Personal plan is free (6 users, unlimited devices, non-commercial); business plans are per user (about $8 and $18 per user per month, third-party figures), tagged resources $1/month each; ngrok sells reserved domains, bandwidth and team features. |

Why it worked: Tailscale made a hard thing (WireGuard mesh, NAT traversal) invisible, gave it away
for personal use forever, and charged when the same people brought it to their companies.

**Borrow:** a free personal tier that is genuinely unlimited for one person, seat pricing for
teams, paid reserved names (`<team>.httpeers.net`, custom domains) and relay bandwidth.
**Position against them as a complement:** Tailscale connects devices at the network layer and
needs an install; httpeers connects **browser tabs and apps** at the HTTP layer and needs a link.
"Share your local LLM, dev server or notebook with your team from a tab" is a sentence neither
Tailscale nor ngrok can say **(inference)**.

### 3.4 Version control and versioned data (compare: webrun-vcs, webrun-sync)

**GitHub, GitLab, Gitea/Forgejo, Hugging Face Hub (Xet), Dolt/DoltHub, isomorphic-git, Radicle**

| Cell | What they do |
|---|---|
| Value proposition | Hosting, collaboration and CI around git (GitHub, GitLab); self-hosted forge (Gitea); versioned models and datasets with chunk dedup (Hugging Face Xet); git semantics for a SQL database (Dolt); git in JS (isomorphic-git); P2P git (Radicle). |
| Customer segments | Developers and companies; ML teams; data teams; app builders embedding git (isomorphic-git powers the Obsidian Git plugin on mobile, StackBlitz, many web editors). |
| Customer relationships | Self-serve and community; enterprise sales for GitLab/GitHub Enterprise. |
| Channels | Network effects (public repos), integrations, open source. |
| Revenue streams | Seats and enterprise (GitHub, GitLab open core), compute (CI minutes, HF inference and Spaces), storage, hosted databases (DoltHub, Hosted Dolt). isomorphic-git and Radicle earn nothing directly. |

Why it worked: the money is in **the hosted place where versions live and people collaborate**,
not in the git implementation. Libraries alone (isomorphic-git) gain users but no revenue.

**Borrow:** webrun-vcs is a feature and a channel, not a product: "versioned workspace with
history, branches and sync" inside the Sandbox and the wiki, and paid storage of that history.
Its real differentiators for outreach: native-git parity tests, LFS and Xet in the browser, and
document versioning without a server.

### 3.5 Extensible workbenches (compare: the platform, the Theia shell)

**Eclipse Theia (EclipseSource, Arm, AMD/Xilinx), VS Code / vscode.dev, Gitpod → Ona, Coder, Eclipse Che**

| Cell | What they do |
|---|---|
| Value proposition | A white-label IDE framework (Theia, with Theia AI since 2025); a browser IDE backed by cloud dev environments (Gitpod/Ona, Coder, Che). |
| Customer segments | Tool vendors building domain-specific IDEs (chip design, modelling, automotive); enterprises standardizing dev environments. |
| Customer relationships | Consulting and sponsored development (Theia's ecosystem), enterprise sales (Coder, Ona). |
| Channels | Eclipse Foundation, TheiaCon, Open VSX (over 300 million monthly downloads), adopter showcases. |
| Revenue streams | Services and sponsored development (EclipseSource), enterprise licences and support (Coder's open-source core plus an enterprise tier), seats for hosted environments. |

Why it worked: Theia is invisible inside vendors' products, and the money flows to the experts
who build those products. Cloud IDE companies earned on the infrastructure behind the editor.

**Borrow:** the services model is available **today** and needs no new product: offer
"browser-only Theia (no backend) over any storage, joined to a peer mesh" and "Cloudflare
Workers apps that also run offline" as integration work. Later, a fragment marketplace (see
EmDash's sandboxed plug-in registry, VS Code's Marketplace) for the platform.

### 3.6 Agent infrastructure (compare: statewalker-ai, CellB as agent runtime)

**E2B, Browserbase, LangChain/LangSmith, Cloudflare Agents SDK + Flue, Mastra**

| Cell | What they do |
|---|---|
| Value proposition | Safe sandboxes for agent-run code (E2B); hosted headless browsers for agents (Browserbase); observability and evaluation (LangSmith); durable agents on Durable Objects (Agents SDK, Flue). |
| Customer segments | AI product teams, agent framework users. |
| Customer relationships | Self-serve, usage dashboards, enterprise for compliance. |
| Channels | Framework integrations (E2B is the default sandbox in many agent frameworks), open-source SDKs, AI developer media. |
| Revenue streams | Per-second compute (E2B: from $0.000014/s per vCPU; Pro about $150/month plus usage, third-party figure); per-session browser hours; seats plus traces (LangSmith). |

Why it worked: becoming the default integration inside a popular framework, and charging for
the resource that framework consumes.

**Borrow:** become a **target** inside Flue (a browser and Node target via CellB, offline,
private), pi and opencode, and meter what agents consume. The harness already plans a model
gateway, meters, limits and a usage API (#134, #179–#181): those are the billing hooks.

### 3.7 Local-first apps and tools (compare: sandclaw wiki, statewalker-knowledge, fsm, devtools)

**Obsidian, Observable, Stately (XState), Browser Use / Playwright**

| Cell | What they do |
|---|---|
| Value proposition | Your notes as local files, extended by plug-ins (Obsidian); data notebooks and dashboards (Observable); visual state machines (Stately). |
| Customer segments | Knowledge workers and developers (Obsidian), data teams (Observable), front-end teams (Stately). |
| Customer relationships | Community-run plug-in ecosystems, Discord, self-serve. |
| Channels | Plug-in authors, YouTube creators, word of mouth. |
| Revenue streams | Obsidian: free app, paid **Sync** and **Publish** add-ons (a few dollars a month each) and commercial licences; Observable: team seats; Stately: free public machines, Pro/Team seats with private projects, GitHub sync and AI credits. |

Why it worked: the core tool is free and local; the subscription is for the **service only a
server can give** (sync between devices, publishing on the web, private sharing).

**Borrow:** exactly that split for the wiki and notebooks: local and free; Sync (webrun-sync +
webrun-vcs to httpeers S3) and Publish (`*.httpeers.net` sites) are paid. For fsm: free runtime;
the validator's prompts for agents could be a hook into the Sandbox ("agent writes and checks
your state machine").

### 3.8 Patterns that recur

| Pattern | Who | Fit for StateWalker |
|---|---|---|
| Free OSS core, paid hosted service | GitLab, Obsidian, Tailscale, Stately | **High.** The only pattern compatible with MIT libraries. |
| Generous free tier, seats when people bring it to work | Tailscale, Stately, StackBlitz | **High**, affordable because compute runs on the user's device. |
| Usage-based billing for consumed resources | Cloudflare, E2B, Browserbase | **Medium:** model tokens, always-on DO hosting, relay bandwidth, storage. |
| AI builder on top of a runtime | Bolt, Replit, Lovable | **High** as the surface; crowded, so differentiate on the Cloudflare stack and on privacy/offline. |
| Commercial licence for embedding | WebContainers | **Low now:** only for new, separately licensed code. |
| Services and sponsored development | EclipseSource/Theia | **High, immediately.** |
| Marketplace take rate | VS Code, EmDash plug-ins, Shopify | **Later**, once the platform has third-party fragments. |
| Acquisition by the platform you complement | PartyKit, Deno team → Cloudflare | A real exit for CellB; maximise adoption and conformance. |

---

## 4. Strategy canvas for StateWalker

One product, four supporting lines. Each line's cells are written so that it either **is** the
product or **feeds** it.

### 4.1 The product: CellB Sandbox (working name)

| Cell | Proposal |
|---|---|
| **Value proposition** | "Build, run and share Cloudflare Workers, Durable Objects, Astro/EmDash and Flue agent apps **in your browser tab**, with an AI agent, git history and instant sharing, then deploy to Cloudflare unchanged." Instant start, works offline, private by default (code and data stay on the device until you publish), the same runtime semantics as Cloudflare (celld is the judge). |
| **Customer segments** | (1) Cloudflare developers who want a local/offline dev loop and previews; (2) Astro and EmDash site builders; (3) agent builders on Flue/pi/opencode who want a private, reproducible playground; (4) docs and tutorial authors who want runnable embeds; (5) later, non-developers building small apps with the agent, and teams. |
| **Customer relationships** | Self-serve and free to start; templates (EmDash site, Flue agent, DO chat, notebook); Discord; public roadmap on GitHub; for teams, onboarding calls; for enterprise, support contracts. |
| **Channels** | Embeds in tutorials ("Run on CellB" buttons); cellb.dev examples gallery; Cloudflare, Astro, EmDash and Flue communities (section 5); Hacker News launches of each "impossible demo" (EmDash served from a tab; an agent in a tab with no server); conference talks; the httpeers-published apps themselves (a "made with CellB Sandbox" footer). |
| **Revenue streams** | **Free:** unlimited in-tab projects, public sharing, small AI quota (or bring your own key / local model). **Pro (~$15–20/month):** private projects and history sync, custom domains, more AI credits, always-on hosting of published apps (on celld or CellB Node on the hub), larger storage. **Team (per seat):** shared workspaces, roles (statewalker-ai access layer), audit, central billing. **Usage:** AI credits through the model gateway with a margin; always-on DO hours and storage beyond the plan. **Enterprise:** self-hosted control plane on the customer's bucket (cellb + celld), SSO, support SLA. |

### 4.2 The supporting lines

| Line | Value proposition | Segments | Relationship | Channels | Revenue |
|---|---|---|---|---|---|
| **CellB runtime** (open source) | Cloudflare's stack in browser and Node, in celld's format | Cloudflare/celld users, test authors, platform builders | Community, conformance transparency | Cloudflare/celld upstream, npm, examples site | Indirect (feeds the Sandbox); sponsored features; possible acquisition |
| **HTTPeers** | Share any HTTP service, local LLM or app between tabs and machines from a link; Biscuit-based access | Self-hosters, local-LLM users, small teams | Self-serve | r/selfhosted, local-LLM communities, Tailscale-adjacent content | Free personal; paid reserved names, custom domains, relay bandwidth, team seats; inside the Sandbox, "share" is a Pro feature for private shares |
| **Data layer** (vcs, sync, files, search, db) | Git, sync, search and SQL anywhere JavaScript runs | App builders, editor vendors | Community | npm, git and editor communities | Indirect; paid Sync storage; services |
| **Workbench platform** | Theia-like, backend-optional extensible workbench with DO server halves | Tool vendors building domain IDEs | Consulting, partnership | Eclipse/Theia ecosystem, Open VSX | Services and sponsored development now; fragment marketplace later |
| **Apps** (wiki, notebooks) | Local-first knowledge base that an agent curates | Knowledge workers, researchers | Self-serve | Obsidian-adjacent and notebook communities | The Obsidian split: free local, paid Sync and Publish. Later, after the Sandbox. |

---

## 5. Partners, competitors and their audiences as channels

For each community: who they are, what StateWalker offers them, the concrete first move.

### 5.1 VCS: git, document management, versioned data

- **Obsidian users and plug-in authors.** The Obsidian Git plug-in runs isomorphic-git on mobile,
  where native git is unavailable. webrun-vcs is a more complete git (rebase, stash, LFS, native
  parity tests). First move: a benchmark and compatibility page against isomorphic-git, then a
  proof-of-concept backend for that plug-in.
- **Hugging Face.** `vcs-transport-xet` is a browser-capable Xet read client. First move: a demo
  "clone a Hugging Face model repo in a tab", posted to HF's community and blog submissions.
- **Gitea/Forgejo and web editors (vscode.dev).** Git in the browser without a backend proxy.
  First move: a VS Code web extension (FileSystemProvider + git over webrun-vcs) published to Open
  VSX and the VS Code Marketplace; a listing is itself a channel.
- **Document versioning (legal, technical writing, CMS).** The "versioned documents" demo plus
  EmDash: content history with branches and diffs inside the CMS. First move: an EmDash plug-in
  for git-backed content history.
- **Git community events** (Git Merge, FOSDEM's version-control track): talk "git in 100% portable
  TypeScript, checked byte-for-byte against native git".

### 5.2 CellB: celld, Cloudflare, Deno, Astro/EmDash

- **celld / Cloudflare.** With workerd and celld merging under Cloudflare, CellB is the natural
  browser-and-Node member of that family. First moves: contribute the recorded conformance corpus
  and the gap reports upstream; propose CellB as a "local preview / offline" option in celld's
  docs; apply to Cloudflare's Workers Launchpad; offer Cloudflare's DevRel the "EmDash in a tab"
  and "Flue agent in a tab" demos for their blog.
- **Deno Deploy users migrating** (shutdown within six months of 2026-10-09). A "Workers locally
  and in the browser" guide catches developers re-evaluating their stack.
- **Astro and EmDash.** EmDash's admin and plug-ins previewed in a tab with no server; Astro sites
  built in the tab. First move: "Try EmDash in your browser" button proposed for EmDash's docs and
  the Astro themes page; a talk at Astro's community events.

### 5.3 HTTPeers: WireGuard/Tailscale, ngrok, libp2p, self-hosting, local LLMs

- **Tailscale is a complement, not a target.** Tailscale connects devices; httpeers connects
  apps and tabs over HTTP with application-level tokens. First move: a hub that listens on a
  tailnet (works today as a Node process), written up as "Tailscale for machines, httpeers for
  tabs".
- **ngrok / Cloudflare Tunnel users.** PeerShare shares a local service with named people, not the
  whole internet. Position on that difference (private by default, Biscuit policy).
- **Local-LLM communities** (Ollama, LM Studio, LiteLLM users, r/LocalLLaMA). The LLM appliance and
  llm-chat already share a home GPU with a team over the mesh: "share your local model with your
  team from a link" is a strong post.
- **libp2p** (Interplanetary Shipyard, the libp2p community). httpeers is a showcase of
  browser-to-browser HTTP over libp2p; offer it to libp2p's showcase and its conference days.
- **Self-hosters and home-lab creators** (r/selfhosted, Home Assistant community): the hub and
  sites host as a self-hostable bundle.

### 5.4 Platform on CellB: Theia, Eclipse, VS Code

- **Eclipse Theia.** `statewalker-shell-theia` is a browser-only Theia (no backend) over any
  FilesApi, joined to a mesh, with an LLM chat. That is unusual in the Theia world. First moves:
  get it on Theia's adopter list, propose a TheiaCon talk, offer sponsored-development and
  integration services to Theia vendors who want a no-backend or offline variant.
- **VS Code / Open VSX.** Web extensions bring CellB (run a Worker from the editor) and webrun-vcs
  (git without a server) to vscode.dev users; marketplace listings are free distribution.
- **Gitpod/Ona, Coder, Eclipse Che.** Competitors on cloud dev environments; StateWalker's story
  is the opposite (the environment is the tab), useful as a contrast in launch posts rather than
  as partners.

### 5.5 Agents on CellB: Flue, Cloudflare Agents SDK, pi, opencode, MCP

- **Flue (withastro/flue).** Flue is runtime-agnostic and its first deep target is Cloudflare's
  Agents SDK. CellB already runs a Flue app built with Flue's own Cloudflare build, in Node and in
  Chromium. First move: propose a documented "run your Flue agent in the browser/Node with CellB"
  path or target to the Flue maintainers, with the example as the proof.
- **Cloudflare Agents SDK.** Same as Flue: CellB as the offline test and preview runtime.
- **pi, opencode.** Both run in DOs on CellB against a fake model; a "private agent in a tab"
  demo for their communities.
- **MCP and A2UI.** The sandbox serves MCP from a ServiceWorker and WebMCP; the platform renders
  A2UI surfaces. Listings in MCP directories and A2UI showcases are cheap channels.

### 5.6 The smaller tools

- **statewalker-fsm**: XState's audience; the validator's prompts for agents are a hook ("an agent
  that writes state machines you can trust").
- **webrun-devtools**: Playwright and Browser Use audiences; notebook-driven browser automation,
  and a natural tool for agents in the Sandbox.
- **statewalker-knowledge**: Observable notebook-kit users; notebooks built to static sites with
  SQL cells on DuckDB/SQLite, published to `*.httpeers.net`.

---

## 6. What has to be built, and the shortest path

### 6.1 The gaps between today and a paid product

| Gap | Exists already | To build |
|---|---|---|
| Identity and accounts | httpeers person keys, Biscuit tokens; harness tenancy (#127) | Sign-in (passkeys or GitHub OAuth), account ↔ person-key linking, workspace = tenant |
| Billing | nothing | Stripe (or Paddle as merchant of record for VAT) subscriptions and metered usage; plan → limits mapping |
| Metering and limits | tickets #158 (decided), #179 meters, #180 rate limits, #181 usage API, #182 telemetry | Implement them first in the hub and model gateway, since those are what cost money |
| Model gateway with credits | #134 model gateway | Provider keys server-side, per-tenant budgets, margin, bring-your-own-key option |
| Hosted control plane | `apps/sandbox-hub` (Ship/Publish), httpeers sites host, relay, S3, hub | Always-on hosting of published projects (celld or CellB Node behind the ingress), custom domains, per-tenant buckets, backups |
| Product surface | `cellb.dev/apps/sandbox`, templates, cellb.dev site and examples | Landing page with pricing, onboarding, template gallery, "Deploy to Cloudflare" button, embed snippet |
| Trust | `docs/security-model.md` (httpeers), harness `docs/security.md` | Terms, privacy policy, DPA; abuse handling for published sites; status page |
| Feedback | none | Waitlist, product analytics without content (#182's principle), support inbox, Discord |

### 6.2 Shortest path, in phases

**Phase 0 (now, weeks 0–2): decide and announce, earn from expertise.**

- Decide the wedge (this note recommends the Sandbox) as a Wayfinder map on this repository, so
  the platform map (#112) and the harness spec (#111) order their work by it.
- Open a services page (integration work on CellB, browser-only Theia, httpeers) and GitHub
  Sponsors; first revenue without new code.
- Start the channel work of section 5 that needs only existing demos: upstream conformance
  contribution to celld, Flue maintainers, EmDash "try in browser", the libp2p showcase.

**Phase 1 (weeks 2–8): public free beta of the Sandbox.**

- Polish `apps/sandbox` to a public URL on cellb.dev with three templates (EmDash site, Flue agent,
  Durable Object chat), git history (webrun-vcs), share over httpeers, publish to
  `*.httpeers.net`, export/deploy to Cloudflare.
- Bring-your-own model key or a local model; no billing yet; a waitlist for Pro.
- Embeddable "Run on CellB" button; launch on Hacker News with the "EmDash served from a tab" demo.
- Measure: weekly active projects, publishes, shares, embeds, waitlist conversions.

**Phase 2 (weeks 8–16): first paid plan.**

- Accounts, Stripe, the Pro plan; meters and limits (#179–#181) on the hub, sites host and model
  gateway; AI credits with a margin; private projects and history sync; custom domains;
  always-on hosting of published apps.
- Success threshold to continue (example): 1–3% of monthly actives on Pro after eight weeks.

**Phase 3 (months 4–9): teams, platform, enterprise.**

- Team workspaces, roles (statewalker-ai access), audit; the fragment platform (#112) lets the
  Sandbox grow through fragments (notebooks, wiki, search, VCS views), and opens a marketplace.
- Enterprise: the control plane self-hosted on the customer's bucket (cellb + celld), SSO, SLA.
- Spin-offs that reuse the same billing: Sync and Publish for the wiki and notebooks (the Obsidian
  split), PeerShare for teams (the Tailscale split).

### 6.3 Why the Sandbox and not another wedge

| Wedge | For | Against | Verdict |
|---|---|---|---|
| **CellB Sandbox** | Most assets exist; unique (Cloudflare stack in a tab); rides Cloudflare/celld/Flue/EmDash momentum; near-zero cost per free user; AI app builders are a proven market | Crowded AI-builder market; depends on Cloudflare's goodwill | **Recommended** |
| PeerShare / httpeers for teams | Live infrastructure; clear pain (share localhost/LLM) | Tailscale, ngrok and Cloudflare Tunnel are entrenched and cheap; security model needs care (code must not cross the mesh) | A Sandbox feature first, a product later |
| Wiki / notes app (sandclaw) | Proven Obsidian model | Consumer market, long path, heavy UX work, Obsidian and Notion dominate | After the Sandbox |
| Platform licence for tool vendors | Theia shows the demand | Services, not product revenue; platform still being designed | Services now, product later |
| Agent harness as a service | Hot market | Skeleton today; competes with E2B, Cloudflare Agents, LangSmith | Inside the Sandbox, then exposed through UHP/OpenAI projections |

---

## 7. Risks

- **MIT is permanent for what is published.** Anyone, Cloudflare included, can host the same
  stack. Defence: speed, brand, the hosted service and community, not licence terms. Code that
  should stay commercial (the multi-tenant control plane, billing) belongs in a private or
  source-available repository from the start (a decision for an ADR).
- **Cloudflare builds the same thing.** It now owns celld; a browser runtime is a plausible
  roadmap item. Defence: partner early, be the reference implementation, make acquisition the
  natural outcome.
- **Focus.** Twenty projects, five lines. The plan in section 6 makes everything else a feature of
  one product for at least two quarters.
- **Security and abuse.** Published sites and shared services attract abuse; the httpeers security
  model warns that code does not cross the mesh safely. A paid service needs abuse handling,
  content policy and isolation reviews before launch.
- **Upstream churn.** celld is young and merging with workerd; cellb's conformance suite is the
  safeguard and also the reason upstream should care about it.
- **AI cost.** Credits must be priced above provider cost with limits enforced server-side
  (#179–#181) before the free tier gets any hosted model.

---

## 8. Suggested next steps in this repository

1. File a Wayfinder map "Monetization: the CellB Sandbox as the first product" on
   `statewalker/statewalker-root`, with decision tickets: the wedge; the pricing and plans; the
   licence of the control plane (private, source-available or MIT); the brand and domain;
   billing provider; what the free tier includes for hosted models.
2. Re-rank the harness tickets so meters, limits, the usage API and the model gateway (#134,
   #179–#181) come before less revenue-critical ones, since they are the billing hooks.
3. Ask #186 ("which 2–3 demo applications ship") to pick the Sandbox as one of the demos.
4. Track the outreach moves of section 5 as tickets labelled `area:root`.

---

## Sources

Internal: the READMEs of every project in `repos.json` (2026-11-21); `docs/projects.md`;
`docs/research/unified-do-platform.md`; ADR `2026-11-19-platform-project-and-fragment-repositories`;
issues #111, #112, #127, #158, #179–#182, #186 on `statewalker/statewalker-root`.

External (read 2026-11-21):

- [denoland/celld](https://github.com/denoland/celld); [How celld runs Workers on your own infrastructure](https://flaviocopes.com/celld/); [The Register on celld](https://theregister.com/devops/2026/08/12/nodejs-creator-liberates-durable-objects-from-cloudflare-with-celld/5286954)
- [Deno is joining Cloudflare](https://blog.cloudflare.com/deno-joins-cloudflare/); [The New Stack](https://thenewstack.io/cloudflare-acquires-deno-ryan-dahl/); [AlternativeTo](https://alternativeto.net/news/2026/10/deno-team-joins-cloudflare-as-runtime-development-winds-down/)
- [Bringing more agent harnesses and frameworks to Cloudflare, starting with Flue](https://blog.cloudflare.com/agents-platform-flue-sdk); [withastro/flue](https://github.com/withastro/flue)
- [EmDash on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/emdash/index.md); [emdash-cms/emdash](https://github.com/emdash-cms/emdash); [EmDash 1.0](https://blog.cloudflare.com/tag/emdash/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/); [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing); [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/)
- [WebContainers enterprise and licensing](https://webcontainers.io/enterprise); [StackBlitz pricing](https://stackblitz.com/pricing); [StackBlitz pricing guide (third party)](https://www.eesel.ai/blog/stackblitz-pricing)
- [Tailscale pricing](https://tailscale.com/pricing/); [Tailscale pricing v4](https://tailscale.com/blog/pricing-v4); [Tailscale pricing FAQ](https://tailscale.com/kb/1251/pricing-faq)
- [E2B pricing](https://e2b.dev/pricing); [E2B pricing guide (third party)](https://www.activepieces.com/blog/e2b-pricing-plans-rates-and-limits-2026-guide)
- [Stately pricing](https://stately.ai/pricing)
- [The active ecosystem of Eclipse Theia adopters](https://www.eclipse.org/topics/ide/articles/the-active-ecosystem-of-eclipse-theia-adopters); [Eclipse newsroom, March 2026](https://newsroom.eclipse.org/node/43713); [EclipseSource: news from Theia, June 2026](https://eclipsesource.com/blogs/2026/06/25/eclipse-theia-news-from-the-next-gen-tools-platform/); [TheiaCon 2026](https://www.eclipse.org/events/2026/theiacon/)

Not verified on the web in this session (from general knowledge, treat as approximate): Obsidian
Sync/Publish pricing, Bolt.new's revenue figures, CodeSandbox's acquisition by Together AI,
Gitpod's rename to Ona, isomorphic-git's use in the Obsidian Git plug-in, GitLab/Coder licensing
models.
