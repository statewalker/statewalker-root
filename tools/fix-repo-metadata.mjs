#!/usr/bin/env node
// fix-repo-metadata.mjs REPO_DIR GITHUB_REPO
//
// Points every package of a repository at the repository it actually lives in:
//   repository: { type: "git", url: "git+https://github.com/statewalker/<repo>.git", directory }
//   homepage:   https://github.com/statewalker/<repo>/tree/main/<directory>#readme
//   bugs:       { url: https://github.com/statewalker/<repo>/issues }
// for the root package.json (no directory, homepage = the repository) and for every workspace
// package pnpm lists. Packages split out of other repositories, or living in a
// renamed one, carried the old repository's URLs. Keys keep their position when present; new
// ones go after "description" (or "version"). Prints what changed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [repoDir, githubRepo] = process.argv.slice(2);
if (!repoDir || !githubRepo) {
  console.error("usage: fix-repo-metadata.mjs REPO_DIR GITHUB_REPO");
  process.exit(2);
}
const base = `https://github.com/statewalker/${githubRepo}`;

function manifests() {
  // Every workspace package, as pnpm lists it (nested globs like apps/demos/* included).
  const listed = JSON.parse(
    execFileSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], { cwd: repoDir, encoding: "utf8", maxBuffer: 64 << 20 }),
  );
  const root = path.resolve(repoDir);
  const dirs = [...new Set([root, ...listed.map((p) => path.resolve(p.path))])];
  return dirs
    .map((dir) => ({ file: path.join(dir, "package.json"), directory: dir === root ? null : path.relative(root, dir) }))
    .filter(({ file }) => fs.existsSync(file));
}

/** Set `key` to `value`, keeping its position, or inserting it after the anchor keys. */
function withKey(obj, key, value) {
  if (key in obj) return { ...obj, [key]: value };
  const anchor = ["description", "version", "name"].find((k) => k in obj);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === anchor) out[key] = value;
  }
  if (!(key in out)) out[key] = value;
  return out;
}

let changed = 0;
for (const { file, directory } of manifests()) {
  const before = fs.readFileSync(file, "utf8");
  let m = JSON.parse(before);
  m = withKey(m, "homepage", directory ? `${base}/tree/main/${directory}#readme` : `${base}#readme`);
  m = withKey(m, "bugs", { url: `${base}/issues` });
  m = withKey(m, "repository", {
    type: "git",
    url: `git+${base}.git`,
    ...(directory ? { directory } : {}),
  });
  const after = `${JSON.stringify(m, null, 2)}\n`;
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log(`updated ${path.relative(repoDir, file)}`);
  }
}
console.log(`${changed} manifests updated`);
