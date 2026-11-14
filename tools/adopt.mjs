#!/usr/bin/env node
// adopt.mjs REPO_DIR : bring a repository to the current conventions. Idempotent; prints what changed.
//
//   .github/workflows/ci.yml   the shared CI (statewalker/.github), created when missing. Publishing
//                              jobs are left alone: CI publishing is the release path
//                              (docs/process/README.md §4); a `release.yml` outside ci.yml is reported
//   renovate.json              removed (Dependabot replaces it)
//   .github/dependabot.yml     weekly npm (pnpm catalogs included) and GitHub Actions updates
//   .changeset/                config and README, for a repository with public packages
//   package.json               devDependency @changesets/cli (catalog:) and a "changeset" script
//   pnpm-workspace.yaml        catalog entry for @changesets/cli
// Run `pnpm install` and `pnpm exec biome format --write .github .changeset package.json` afterwards.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error("usage: node tools/adopt.mjs REPO_DIR");
  process.exit(2);
}
const CHANGESETS_CLI = "^3.0.3";
const at = (p) => path.join(dir, p);
const write = (rel, content) => {
  const before = fs.existsSync(at(rel)) ? fs.readFileSync(at(rel), "utf8") : null;
  if (before === content) return;
  fs.mkdirSync(path.dirname(at(rel)), { recursive: true });
  fs.writeFileSync(at(rel), content);
  console.log(`${before === null ? "added" : "updated"} ${rel}`);
};
const remove = (rel) => {
  if (!fs.existsSync(at(rel))) return;
  fs.rmSync(at(rel));
  console.log(`removed ${rel}`);
};
const hasPackageJson = fs.existsSync(at("package.json"));
const hasPublic =
  hasPackageJson &&
  JSON.parse(execFileSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], { cwd: dir, encoding: "utf8" })).some((p) => {
    const m = JSON.parse(fs.readFileSync(path.join(p.path, "package.json"), "utf8"));
    return m.name && !m.private;
  });

// CI: the shared workflow. Publishing lives in ci.yml's standard `publish` job only.
const ci = ".github/workflows/ci.yml";
if (!fs.existsSync(at(ci)) && hasPackageJson) {
  write(
    ci,
    `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: statewalker/.github/.github/workflows/ci.yml@main
`,
  );
}
if (fs.existsSync(at(".github/workflows/release.yml")))
  console.log("NOTE .github/workflows/release.yml: publishing belongs in ci.yml's standard `publish` job only");
remove("renovate.json");

// Dependabot.
const schedule = `      interval: weekly
      day: monday
      time: "06:00"
      timezone: Europe/Paris`;
const npm = `  # Dependencies, pnpm catalogs included. A version that still fits its range only moves the
  # lockfile; one outside it (a major, or a minor below 1.0) rewrites the range.
  - package-ecosystem: npm
    directory: "/"
    schedule:
${schedule}
    versioning-strategy: increase-if-necessary
    cooldown:
      default-days: 3
    open-pull-requests-limit: 10
    groups:
      # Internal packages are normally updated automatically right after a CI publish
      # (statewalker-root#15); this group catches whatever that missed.
      statewalker:
        patterns: ["@statewalker/*"]
      external-minor-patch:
        patterns: ["*"]
        exclude-patterns: ["@statewalker/*"]
        update-types: [minor, patch]
`;
const actions = `  - package-ecosystem: github-actions
    directory: "/"
    schedule:
${schedule}
    groups:
      actions:
        patterns: ["*"]
`;
write(
  ".github/dependabot.yml",
  `# Dependabot version updates: weekly pull requests, checked by CI and merged through the merge gate
# (statewalker-root docs/process/merging.md).
version: 2
updates:
${hasPackageJson ? npm : ""}${actions}`,
);

// Changesets: CI turns them into a "version packages" pull request; merging it publishes.
if (hasPublic) {
  write(
    ".changeset/config.json",
    `${JSON.stringify(
      {
        $schema: "https://unpkg.com/@changesets/config@4.0.1/schema.json",
        changelog: "@changesets/cli/changelog",
        commit: false,
        fixed: [],
        linked: [],
        access: "public",
        baseBranch: "main",
        updateInternalDependencies: "patch",
        privatePackages: { version: false, tag: false },
        ignore: [],
      },
      null,
      2,
    )}\n`,
  );
  write(
    ".changeset/README.md",
    `# Changesets

A changeset records a package release: which packages, which bump, and the changelog text.

- \`pnpm changeset\` writes one; commit it with the change it describes. It decides the bump and the
  changelog text of the next release.
- Without one, the release planner writes a patch changeset for every package whose published
  contents changed since npm's \`latest\` (a minor, on 0.x, when a dependency moved to another
  breaking line).
- Releases are made by CI: it applies the pending changesets (versions, \`CHANGELOG.md\`) in a
  "version packages" pull request, and merging that pull request publishes the packages to npm.
  Never publish by hand.
`,
  );
  const pkgFile = at("package.json");
  const raw = fs.readFileSync(pkgFile, "utf8");
  const indent = /\n(\s+)"/.exec(raw)?.[1] ?? "  ";
  const pkg = JSON.parse(raw);
  pkg.scripts ??= {};
  for (const s of ["publish-all", "version-packages", "release-packages", "version", "release"]) delete pkg.scripts[s];
  pkg.scripts.changeset = "changeset";
  pkg.devDependencies = Object.fromEntries(
    Object.entries({ ...pkg.devDependencies, "@changesets/cli": "catalog:" }).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  write("package.json", `${JSON.stringify(pkg, null, indent)}\n`);
  const ws = fs.readFileSync(at("pnpm-workspace.yaml"), "utf8");
  if (!/^\s+["']?@changesets\/cli["']?\s*:/m.test(ws)) {
    write(
      "pnpm-workspace.yaml",
      /^catalog:\s*$/m.test(ws)
        ? ws.replace(/^catalog:\s*$/m, `catalog:\n  "@changesets/cli": ${CHANGESETS_CLI}`)
        : `${ws.replace(/\n*$/, "\n")}\ncatalog:\n  "@changesets/cli": ${CHANGESETS_CLI}\n`,
    );
  }
}
