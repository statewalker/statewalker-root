#!/usr/bin/env node
// ws.mjs — per-feature workspaces under ws/ (docs/process/sessions.md, "Local"). Plain Node, no
// dependencies. A workspace ws/<feature>/ holds a worktree of this repository and worktrees of the
// projects the feature changes, all on the branch <feature>, plus a pnpm-workspace.yaml that links
// the projects so they build and test together.
//
//   node tools/ws.mjs new <feature> [project...] [--libraries]
//       create the workspace, or add projects to it (idempotent). Each project worktree comes from
//       the clone repos/<project> (cloned when missing), on branch <feature>: the existing local or
//       remote branch, else a new one from origin/main. --libraries adds every cloned project that
//       publishes packages, linking only its packages/* globs (apps keep their own tooling).
//       Writes pnpm-workspace.yaml; run `pnpm install` in ws/<feature>/ afterwards.
//   node tools/ws.mjs list
//       every workspace: its projects, branch, uncommitted files, ahead/behind origin.
//   node tools/ws.mjs sync <feature>
//       fetch every project and rewrite pnpm-workspace.yaml from the worktrees' current files
//       (after a project changed its package globs or catalogs). Never rebases or merges.
//   node tools/ws.mjs rm <feature> [--force]
//       remove the worktrees and ws/<feature>/. Refuses while a worktree has uncommitted files or
//       commits not on any remote, unless --force. Branches are kept.
//
// The generated pnpm-workspace.yaml lists each project's package globs prefixed with its folder,
// the merged catalogs (where two projects give different ranges, the highest minimum version wins,
// and the conflict is printed), and linkWorkspacePackages: true, so @statewalker/* resolve to the
// worktrees whenever their version satisfies the range.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { clonedRepos, git, packageGlobs, readCatalogs, registry, repoDir, ROOT, WS_DIR } from "./lib/registry.mjs";

const SELF = "statewalker-root";
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [command, feature, ...projects] = argv.filter((a) => !a.startsWith("--"));
const usage = "usage: node tools/ws.mjs new <feature> [project...] [--libraries] | list | sync <feature> | rm <feature> [--force]";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
const wsOf = (f) => path.join(WS_DIR, f);
/** Project worktrees of a workspace (folders with a .git file), this repository excluded. */
const membersOf = (f) =>
  fs.existsSync(wsOf(f))
    ? fs
        .readdirSync(wsOf(f), { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== SELF && fs.existsSync(path.join(wsOf(f), e.name, ".git")))
        .map((e) => e.name)
    : [];
const tryGit = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
};

/** A worktree of `source` at `dir`, on `branch`: local branch, else remote branch, else new from `base`. */
function addWorktree(source, dir, branch, base) {
  if (fs.existsSync(dir)) return "exists";
  if (tryGit(source, "rev-parse", "--verify", "-q", `refs/heads/${branch}`)) {
    git(source, "worktree", "add", "-q", dir, branch);
    return `branch ${branch}`;
  }
  if (tryGit(source, "rev-parse", "--verify", "-q", `refs/remotes/origin/${branch}`)) {
    git(source, "worktree", "add", "-q", "--track", "-b", branch, dir, `origin/${branch}`);
    return `branch ${branch} from origin/${branch}`;
  }
  git(source, "worktree", "add", "-q", "--no-track", "-b", branch, dir, base);
  return `new branch ${branch} from ${base}`;
}

function ensureClone(name) {
  const url = registry()[name];
  if (!url) fail(`${name} is not in repos.json`);
  if (!fs.existsSync(repoDir(name))) {
    console.log(`cloning ${name} into repos/`);
    execFileSync("git", ["clone", "-q", url, repoDir(name)], { stdio: "inherit" });
  } else git(repoDir(name), "fetch", "-q", "--prune", "origin");
}

/** Projects that publish packages: a package.json with a non-private package somewhere under packages/. */
function libraryProjects() {
  return clonedRepos().filter((name) => {
    const dir = path.join(repoDir(name), "packages");
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((d) => {
      const m = path.join(dir, d, "package.json");
      return fs.existsSync(m) && JSON.parse(fs.readFileSync(m, "utf8")).private !== true;
    });
  });
}

/** Write ws/<feature>/pnpm-workspace.yaml and package.json from the member worktrees. */
function writeWorkspace(f) {
  const ws = wsOf(f);
  const members = membersOf(f).sort((a, b) => order(a) - order(b));
  const librariesOnly = new Set(readMeta(f).librariesOnly ?? []);
  const globs = [];
  for (const name of members) {
    let own = packageGlobs(path.join(ws, name));
    if (librariesOnly.has(name)) own = own.filter((g) => g.startsWith("packages/"));
    if (own.length === 0 && fs.existsSync(path.join(ws, name, "package.json"))) own = ["."];
    for (const g of own) globs.push(g === "." ? name : `${name}/${g}`);
  }
  const minOf = (r) => (/(\d+)\.(\d+)\.(\d+)/.exec(r) ?? [0, 0, 0, 0]).slice(1).map(Number);
  const higher = (a, b) => {
    const [x, y] = [minOf(a), minOf(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? a : b;
    return a;
  };
  const merged = {};
  for (const name of members) {
    for (const [cat, entries] of Object.entries(readCatalogs(path.join(ws, name)))) {
      merged[cat] ??= {};
      for (const [pkg, range] of Object.entries(entries)) {
        const prev = merged[cat][pkg];
        if (prev && prev !== range) console.log(`catalog ${cat || "default"}: ${pkg} ${prev} / ${range} (${name})`);
        merged[cat][pkg] = prev ? higher(prev, range) : range;
      }
    }
  }
  const q = (s) => JSON.stringify(s);
  const lines = (o, indent) => Object.keys(o).sort().map((k) => `${indent}${q(k)}: ${q(o[k])}\n`).join("");
  let yaml = `# Workspace ${f}: links the project worktrees beside this file.\n`;
  yaml += "# Generated by statewalker-root's tools/ws.mjs (sync rewrites it); not a source of truth.\n";
  yaml += "linkWorkspacePackages: true\n\npackages:\n";
  yaml += globs.map((g) => `  - ${q(g)}\n`).join("");
  yaml += `\ncatalog:\n${lines(merged[""] ?? {}, "  ")}`;
  const named = Object.keys(merged).filter((c) => c !== "").sort();
  if (named.length) {
    yaml += "\ncatalogs:\n";
    for (const c of named) yaml += `  ${q(c)}:\n${lines(merged[c], "    ")}`;
  }
  fs.writeFileSync(path.join(ws, "pnpm-workspace.yaml"), yaml);
  const pkg = path.join(ws, "package.json");
  if (!fs.existsSync(pkg))
    fs.writeFileSync(pkg, `${JSON.stringify({ name: `ws-${f}`, private: true, type: "module" }, null, 2)}\n`);
  console.log(`ws/${f}: ${members.length} project(s), ${globs.length} package glob(s); run pnpm install there`);
}

// repos.json lists the projects bottom-up; keep that order in the generated file.
const order = (name) => {
  const i = Object.keys(registry()).indexOf(name);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
};
const metaFile = (f) => path.join(wsOf(f), ".ws.json");
const readMeta = (f) => (fs.existsSync(metaFile(f)) ? JSON.parse(fs.readFileSync(metaFile(f), "utf8")) : {});

function status(dir) {
  const branch = tryGit(dir, "branch", "--show-current") || "(detached)";
  const dirty = (tryGit(dir, "status", "--porcelain") ?? "").split("\n").filter(Boolean).length;
  const counts = tryGit(dir, "rev-list", "--left-right", "--count", "HEAD...@{upstream}");
  let c = " (not pushed)";
  if (counts) {
    const [a, b] = counts.split(/\s+/);
    c = `${a !== "0" ? ` ahead ${a}` : ""}${b !== "0" ? ` behind ${b}` : ""}`;
  }
  return { branch, dirty, text: `${branch}${dirty ? `, ${dirty} uncommitted` : ""}${c}` };
}

if (command === "new") {
  if (!feature || !/^[\w.-]+$/.test(feature)) fail(usage);
  const ws = wsOf(feature);
  fs.mkdirSync(ws, { recursive: true });
  const self = path.join(ws, SELF);
  console.log(`${SELF}: ${addWorktree(ROOT, self, feature, "HEAD")}`);
  const wanted = [...projects];
  const meta = readMeta(feature);
  if (flags.has("--libraries")) {
    const libs = libraryProjects();
    wanted.push(...libs);
    meta.librariesOnly = [...new Set([...(meta.librariesOnly ?? []), ...libs.filter((l) => !projects.includes(l))])];
  }
  for (const name of [...new Set(wanted)]) {
    if (name === SELF) continue;
    ensureClone(name);
    console.log(`${name}: ${addWorktree(repoDir(name), path.join(ws, name), feature, "origin/main")}`);
  }
  meta.librariesOnly = (meta.librariesOnly ?? []).filter((l) => !projects.includes(l));
  fs.writeFileSync(metaFile(feature), `${JSON.stringify(meta, null, 2)}\n`);
  writeWorkspace(feature);
} else if (command === "list") {
  const all = fs.existsSync(WS_DIR) ? fs.readdirSync(WS_DIR).filter((d) => fs.statSync(wsOf(d)).isDirectory()) : [];
  if (all.length === 0) console.log("no workspaces (node tools/ws.mjs new <feature> <project...>)");
  for (const f of all) {
    console.log(`${f}`);
    for (const name of [SELF, ...membersOf(f)]) {
      const dir = path.join(wsOf(f), name);
      if (fs.existsSync(path.join(dir, ".git"))) console.log(`  ${name}: ${status(dir).text}`);
    }
  }
} else if (command === "sync") {
  if (!feature || !fs.existsSync(wsOf(feature))) fail(usage);
  for (const name of membersOf(feature)) {
    const dir = path.join(wsOf(feature), name);
    if (tryGit(dir, "fetch", "-q", "--prune", "origin") === null) console.log(`${name}: fetch failed`);
    console.log(`  ${name}: ${status(dir).text}`);
  }
  writeWorkspace(feature);
} else if (command === "rm") {
  if (!feature || !fs.existsSync(wsOf(feature))) fail(usage);
  const force = flags.has("--force");
  const all = [SELF, ...membersOf(feature)].filter((n) => fs.existsSync(path.join(wsOf(feature), n, ".git")));
  const blocked = [];
  for (const name of all) {
    const dir = path.join(wsOf(feature), name);
    const s = status(dir);
    const unpushed = tryGit(dir, "rev-list", "--count", "HEAD", "--not", "--remotes");
    if (s.dirty || (unpushed && unpushed !== "0")) blocked.push(`${name}: ${s.dirty} uncommitted, ${unpushed ?? "?"} commit(s) on no remote`);
  }
  if (blocked.length && !force) fail(`not removed (use --force to discard):\n  ${blocked.join("\n  ")}`);
  for (const name of all) {
    const dir = path.join(wsOf(feature), name);
    const source = name === SELF ? ROOT : repoDir(name);
    git(source, "worktree", "remove", ...(force ? ["--force"] : []), dir);
    console.log(`removed worktree ${name} (branch ${feature} kept)`);
  }
  fs.rmSync(wsOf(feature), { recursive: true, force: true });
  console.log(`removed ws/${feature}`);
} else {
  fail(usage);
}
