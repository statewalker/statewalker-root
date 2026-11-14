#!/usr/bin/env node
// repos.mjs — the clones of the managed projects (repos.json) under repos/ (SW_REPOS overrides).
// Plain Node, no dependencies. The clones are for reading and as worktree sources: never edit them
// (docs/process/sessions.md).
//
//   node tools/repos.mjs clone    clone every project that is not cloned yet (private ones need access)
//   node tools/repos.mjs pull     fetch all; fast-forward each clean `main` to origin/main
//   node tools/repos.mjs status   branch, uncommitted files, ahead/behind origin for each clone
//   node tools/repos.mjs check    compare repos.json with the GitHub organization (needs `gh` with a
//                                 token that can list the organization's private repositories):
//                                 projects missing from it, archived, renamed or deleted ones in it
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { checkoutState, clonedRepos, git, ORG, REPOS_DIR, registry, repoDir, SELF } from "./lib/registry.mjs";

const command = process.argv[2] ?? "status";
const state = (name) => checkoutState(repoDir(name)).text;

const firstLine = (e) => String(e.stderr || e.message || e).trim().split("\n").pop();

if (command === "clone") {
  fs.mkdirSync(REPOS_DIR, { recursive: true });
  let failed = 0;
  for (const [name, url] of Object.entries(registry())) {
    if (fs.existsSync(repoDir(name))) continue;
    console.log(`cloning ${name}`);
    try {
      execFileSync("git", ["clone", "-q", url, repoDir(name)], { stdio: ["ignore", "inherit", "pipe"] });
    } catch (e) {
      console.log(`${name}: clone failed: ${firstLine(e)}`);
      failed++;
    }
  }
  console.log(`${clonedRepos().length} of ${Object.keys(registry()).length} projects cloned in ${REPOS_DIR}`);
  process.exitCode = failed ? 1 : 0;
} else if (command === "pull") {
  for (const name of clonedRepos()) {
    const dir = repoDir(name);
    try {
      git(dir, "fetch", "-q", "--prune", "origin");
    } catch (e) {
      console.log(`${name}: fetch failed: ${firstLine(e)}`);
      continue;
    }
    if (git(dir, "branch", "--show-current") === "main" && !git(dir, "status", "--porcelain")) {
      try {
        git(dir, "merge", "-q", "--ff-only", "origin/main");
      } catch {
        console.log(`${name}: main has diverged from origin/main, not updated`);
        continue;
      }
    }
    console.log(`${name}: ${state(name)}`);
  }
} else if (command === "status") {
  for (const name of Object.keys(registry())) {
    if (!fs.existsSync(repoDir(name))) console.log(`${name}: not cloned (node tools/repos.mjs clone)`);
    else console.log(`${name}: ${state(name)}`);
  }
} else if (command === "check") {
  // REST, not `gh repo list`: GraphQL is unavailable in cloud sessions.
  let org;
  try {
    org = JSON.parse(
      execFileSync("gh", ["api", "--paginate", "--slurp", `orgs/${ORG}/repos?per_page=100&type=all`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 << 20,
      }),
    ).flat();
  } catch (e) {
    console.error(`cannot list the ${ORG} organization with gh: ${firstLine(e)}`);
    process.exit(2);
  }
  const byName = new Map(org.map((r) => [r.name, r]));
  const reg = registry();
  let problems = 0;
  const problem = (msg) => {
    console.log(msg);
    problems++;
  };
  for (const [name, url] of Object.entries(reg)) {
    const r = byName.get(name);
    if (!r) problem(`repos.json: ${name} is not in the organization (renamed, deleted, or private and not visible to this token?)`);
    else if (r.archived) problem(`repos.json: ${name} is archived on GitHub; remove it from repos.json`);
    else if (r.clone_url !== url) problem(`repos.json: ${name} url ${url}, GitHub says ${r.clone_url}`);
  }
  for (const r of org) {
    if (!r.archived && r.name !== SELF && !reg[r.name]) problem(`GitHub: ${r.name} is not in repos.json`);
  }
  if (!org.some((r) => r.private)) console.log("note: no private repository listed; the token may not see them");
  console.log(problems ? `${problems} difference(s)` : "repos.json matches the organization");
  process.exitCode = problems ? 1 : 0;
} else {
  console.error("usage: node tools/repos.mjs clone | pull | status | check");
  process.exitCode = 2;
}
