# StateWalker blocks, SandClaw applications, and revenue from managed services

**Status**: accepted, 2026-11-27. Decided in
[Which product is the first paid wedge?](https://github.com/statewalker/statewalker-root/issues/194),
on the map [Monetization: StateWalker's first paid product](https://github.com/statewalker/statewalker-root/issues/193).
Amends [platform-project-and-fragment-repositories](../../subjects/platform/adr/2026-11-19-platform-project-and-fragment-repositories.md),
decision 3 (where SandClaw lives).

## Context

Every published `@statewalker/*` package is MIT, so the libraries cannot be sold, and should not
be: they are how developers find the ecosystem
([research: monetization-strategy](../../subjects/product/research/monetization-strategy.md)).
The research proposed one paid product, an agent-assisted workspace for the Cloudflare stack in a
browser tab. The human chose a different model: many open applications, and revenue from running
and packaging the services those applications need when they leave the browser.

Most browser prototypes already exist (office-document versioning, PDF tools, a code studio, LLM
chat, search, a wiki), and so do the blocks under them. Which of them deserve product work is not
known; developers' reaction is to decide it.

## Decision

1. **Two layers, two organisations.**
   - **StateWalker** (`github.com/statewalker`) holds the technology blocks: CellB, the platform,
     the AI harness, VCS, HTTPeers, files, data, search, sites. Published MIT, as today.
   - **SandClaw** (`github.com/sandclaw-ai`) holds the open-source applications assembled on the
     platform from those blocks, PeerShare among them. Its applications use only published
     `@statewalker/*` packages.
2. **Revenue comes from two offers, sold under SandClaw:**
   - **managed services**: pre-configured, domain-specific services run for a customer, such as
     S3 storage (RustFS or AWS S3), git servers (Gitea, GitLab), HTTPeers relays and hubs, AI model
     access, OpenTelemetry dashboards, and identity (OAuth, OpenID);
   - **on-premise packages**: the same services, configured for the customer's own machines.

   Applications run local-first in the browser for free; a managed service or an on-premise
   package is what an application moves to when it needs a server or the cloud.
3. **Showcase sites find what to build.** Three thematic sites present the work to developers:
   - the blocks (VCS, HTTPeers, CellB, the platform);
   - third-party applications running local-first in the browser, with a path to a server or the
     cloud (EmDash, Astro, Observable Framework);
   - SandClaw's own browser prototypes.
4. **Promotion follows measured interest.** A prototype or block that draws a positive, measured
   reaction is developed in the open and packaged as a SandClaw offer. The signals and thresholds
   are decided in their own ticket on the map.
5. **Earlier answers that still hold** (from the same ticket): traction comes before revenue;
   SandClaw complements Cloudflare and does not compete with it on hosting; this work leads
   development for the next three to four months, and the platform and harness plans order their
   work by what it needs.

## Considered options

- **One paid product: the agent-assisted workspace for the Cloudflare stack** (the research's
  recommendation). Replaced: it bets on one guess; the workspace becomes one prototype among the
  others, judged the same way.
- **Selling licences for the blocks.** Rejected: the blocks are MIT and are the channel.
- **SandClaw inside the `statewalker` organisation** (the 2026-11-19 ADR). Replaced: one
  organisation for open technology and one for the applications and their commercial offers keeps
  the brand that sells apart from the blocks that others reuse.

## Consequences

- The map's tickets are reworded for this model: which showcase sites launch first, how managed
  services and on-premise packages are priced, which domains the sites and the offer use, what
  SandClaw keeps open and what stays private, the promotion criteria, and outreach per site.
- `statewalker/sandclaw` and the PeerShare apps of httpeers move to `sandclaw-ai` when their
  ticket is worked. `repos.json`, `subjects/subjects.json`, `CLAUDE.md`'s table and
  `docs/projects.md` follow then, not before.
- Code for running managed services (operations configuration, billing, accounts) never goes into
  a `statewalker` repository.
