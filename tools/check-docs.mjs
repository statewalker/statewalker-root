#!/usr/bin/env node
// check-docs.mjs: the checks CI runs on this repository. Plain Node, no dependencies.
//   1. Every relative link in a Markdown file outside .claude/skills/ points at a file that exists.
//   2. skills-lock.json lists exactly the folders in .claude/skills/.
//   3. repos.json parses and every entry is a statewalker GitHub URL.
// Exits 1 and lists every problem when any check fails.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", "repos", "ws"]);
const problems = [];

function markdownFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name) || path.relative(ROOT, p) === path.join(".claude", "skills")) continue;
      out.push(...markdownFiles(p));
    } else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

for (const file of markdownFiles(ROOT)) {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target.split("#")[0]));
    if (!fs.existsSync(resolved)) problems.push(`${path.relative(ROOT, file)}: broken link ${target}`);
  }
}

const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "skills-lock.json"), "utf8"));
const locked = Object.keys(lock.skills ?? {}).sort();
const installed = fs
  .readdirSync(path.join(ROOT, ".claude", "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
for (const s of locked) if (!installed.includes(s)) problems.push(`skills-lock.json: ${s} is not installed`);
for (const s of installed) if (!locked.includes(s)) problems.push(`.claude/skills/${s}: missing from skills-lock.json`);

const repos = JSON.parse(fs.readFileSync(path.join(ROOT, "repos.json"), "utf8"));
for (const [name, url] of Object.entries(repos)) {
  if (url !== `https://github.com/statewalker/${name}.git`) problems.push(`repos.json: ${name} -> ${url}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-docs: ok");
