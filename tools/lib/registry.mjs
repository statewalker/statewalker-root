// Where things are, for every tool in this folder. Plain Node, no dependencies.
//
//   ROOT        the main checkout of this repository, also when a tool runs from a worktree of it
//               (ws/<feature>/statewalker-root): repos/ and ws/ live in the main checkout only
//   repos.json  { "<name>": "<git url>" }: every managed project (the source of truth)
//   REPOS_DIR   the clones, one folder per project: <ROOT>/repos (SW_REPOS overrides)
//   WS_DIR      the per-feature workspaces: <ROOT>/ws (docs/process/sessions.md)
//   CI_SCRIPTS  the shared CI scripts, from the clone of statewalker/statewalker-ci (SW_CI_SCRIPTS overrides)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function mainCheckout() {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: HERE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path.basename(common) === ".git" ? path.dirname(common) : HERE;
  } catch {
    return HERE; // not a git checkout (a copy of the tools): use where they are
  }
}
export const ROOT = mainCheckout();
export const REPOS_DIR = path.resolve(process.env.SW_REPOS ?? path.join(ROOT, "repos"));
export const WS_DIR = path.join(ROOT, "ws");
export const ORG = "statewalker";
/** This repository: it manages the others and is not in its own registry. */
export const SELF = "statewalker-root";

/** { name: url } from repos.json, in file order. */
export function registry() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "repos.json"), "utf8"));
}

export const repoDir = (name) => path.join(REPOS_DIR, name);

export const CI_SCRIPTS = path.resolve(process.env.SW_CI_SCRIPTS ?? path.join(repoDir("statewalker-ci"), "scripts"));

/** Registry projects that are cloned. */
export const clonedRepos = () => Object.keys(registry()).filter((n) => fs.existsSync(path.join(repoDir(n), ".git")));

/** Cloned projects that are pnpm workspaces (have a package.json): the ones with packages. */
export const packageRepos = () => clonedRepos().filter((n) => fs.existsSync(path.join(repoDir(n), "package.json")));

/** git in a directory; returns trimmed stdout, throws with stderr on failure. */
export const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Branch, uncommitted file count and ahead/behind its upstream, of a checkout, as one line. */
export function checkoutState(dir) {
  const tryGit = (...args) => {
    try {
      return git(dir, ...args);
    } catch {
      return null;
    }
  };
  const branch = tryGit("branch", "--show-current") || "(detached)";
  const dirty = (tryGit("status", "--porcelain") ?? "").split("\n").filter(Boolean).length;
  const counts = tryGit("rev-list", "--left-right", "--count", "HEAD...@{upstream}");
  let c = " (no upstream)";
  if (counts) {
    const [a, b] = counts.split(/\s+/);
    c = `${a !== "0" ? ` ahead ${a}` : ""}${b !== "0" ? ` behind ${b}` : ""}`;
  }
  return { branch, dirty, text: `${branch}${dirty ? `, ${dirty} uncommitted` : ""}${c}` };
}

/**
 * The catalogs of a pnpm-workspace.yaml: { "": {default catalog}, <name>: {...} }.
 * A small reader for the flat maps pnpm uses (`catalog:` and `catalogs: <name>:`), not general YAML.
 * (Same reader as statewalker/statewalker-ci's scripts/lib/workspace.mjs.)
 */
export function readCatalogs(dir) {
  const file = path.join(dir, "pnpm-workspace.yaml");
  const catalogs = { "": {} };
  if (!fs.existsSync(file)) return catalogs;
  const unquote = (s) => s.trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
  let section = null;
  let named = null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const top = /^([^\s#][^:]*):/.exec(line);
    if (top && !line.startsWith(" ")) {
      section = top[1].trim();
      named = null;
      continue;
    }
    if (section === "catalogs") {
      const head = /^ {2}(["']?)([^"':#]+)\1:\s*(#.*)?$/.exec(line);
      if (head) {
        named = head[2].trim();
        catalogs[named] ??= {};
        continue;
      }
    }
    const entry = /^(\s+)(["']?)([^"'\s:#][^"':#]*?)\2\s*:\s*(.+)$/.exec(line);
    if (!entry) continue;
    if (section === "catalog" && entry[1].length === 2) catalogs[""][entry[3]] = unquote(entry[4]);
    else if (section === "catalogs" && named && entry[1].length === 4) catalogs[named][entry[3]] = unquote(entry[4]);
  }
  return catalogs;
}

/** The `packages:` globs of a pnpm-workspace.yaml (empty when there is none). */
export function packageGlobs(dir) {
  const file = path.join(dir, "pnpm-workspace.yaml");
  if (!fs.existsSync(file)) return [];
  const block = /^packages:\s*\n((?:[ \t]+-.*\n?|[ \t]*#.*\n?)+)/m.exec(fs.readFileSync(file, "utf8"))?.[1] ?? "";
  return [...block.matchAll(/^[ \t]+-\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm)].map((m) => m[1]);
}
