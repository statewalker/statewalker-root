// health-dispatch.mjs at its command-line seam: recorded GitHub responses in, plan out. No network.
// Run: node --test tools/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, "..", "health-dispatch.mjs");
const FX = (f) => path.join(HERE, "fixtures", f);
const NOW = "2026-11-14T00:00:00Z";
const REPOS = "p-released,p-claimed,p-first,p-first-low,p-unchanged,p-old,p-recent";
const BASE = ["--now", NOW, "--repos", REPOS, "--layers", FX("health-dispatch-layers.json")];

function run(args, env = {}) {
  return spawnSync("node", [TOOL, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}
function planOf(args = BASE) {
  const r = run([...args, "--fixtures", FX("health-dispatch.json"), "--json"]);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("order and cap: unfinished runs first, then never reviewed by layer, then least recently reviewed; five at most", () => {
  const p = planOf();
  assert.deepEqual(p.review.map((r) => `${r.action}:${r.repo}`), [
    "resume:p-released", // oldest open record
    "resume:p-claimed",
    "create:p-first-low", // first run, layer 0
    "create:p-first", // first run, layer 3
    "create:p-old", // reviewed 30 days ago
  ]);
  assert.deepEqual(p.waiting, ["p-recent"]); // reviewed 7 days ago: over the cap
});

test("an unchanged project is skipped (abbreviated recorded sha)", () => {
  assert.deepEqual(planOf().unchanged, ["p-unchanged"]);
});

test("unfinished runs are resumed, not duplicated, and count against the cap; a claimed one is not restarted", () => {
  const p = planOf();
  const byRepo = Object.fromEntries(p.review.map((r) => [r.repo, r]));
  assert.deepEqual(byRepo["p-released"], { repo: "p-released", action: "resume", record: 101, status: "Released", start: true });
  assert.deepEqual(byRepo["p-claimed"], { repo: "p-claimed", action: "resume", record: 102, status: "Claimed", start: false });
  assert.equal(p.review.filter((r) => r.action === "create" && ["p-released", "p-claimed"].includes(r.repo)).length, 0);
});

test("a first run has no base; a later run starts from the last finished record, ignoring a record without a record line", () => {
  const byRepo = Object.fromEntries(planOf().review.map((r) => [r.repo, r]));
  assert.equal(byRepo["p-first"].base, null);
  assert.equal(byRepo["p-old"].base, "b".repeat(40));
  assert.equal(byRepo["p-old"].lastRecord, 91); // not the later, abandoned #93
});

test("escalation at exactly four weeks and not before; an already escalated bug is a duplicate", () => {
  assert.deepEqual(planOf().escalate.map((e) => [e.repo, e.issue, e.ageDays, e.duplicateOf]), [
    ["p-first", 3, 60, 200],
    ["p-old", 7, 28, null], // 27.9 days old #8 is not escalated; #7 under two labels counts once
  ]);
});

test("the Markdown plan", () => {
  const out = run([...BASE, "--fixtures", FX("health-dispatch.json")]).stdout;
  assert.match(out, /- p-claimed: resume #102 \(not started: Claimed\)/);
  assert.match(out, /- p-old: new record ticket, since bbbbbbb/);
  assert.match(out, /Over the cap, next week: p-recent\./);
  assert.match(out, /p-first#3 \(60 days\): already escalated in #200/);
});

test("without --layers, layers come from CLAUDE.md's project table", () => {
  const r = run(["--now", NOW, "--repos", "statewalker-sandbox,webrun-files,statewalker-shared", "--fixtures", FX("health-dispatch-claude-md.json"), "--json"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).review.map((x) => x.repo), ["statewalker-shared", "webrun-files", "statewalker-sandbox"]); // L0, L1, app
});

test("a request without a recorded response fails instead of reaching the network", () => {
  const r = run([...BASE.slice(0, 2), "--repos", "p-missing", "--fixtures", FX("health-dispatch.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no fixture for repos\/statewalker\/p-missing\/commits\/main/);
});

// The live path through a fake gh (fixtures/fake-gh.mjs): skipping and --create, still no network.
function live(args, deny = "") {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-gh-"));
  fs.symlinkSync(FX("fake-gh.mjs"), path.join(bin, "gh"));
  const log = path.join(bin, "posts.log");
  fs.writeFileSync(log, "");
  const r = run(args, { PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_GH_FIXTURES: FX("health-dispatch.json"), FAKE_GH_DENY: deny, FAKE_GH_LOG: log });
  return { ...r, posts: fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) };
}

test("live: an unreadable project is skipped and reported", () => {
  const r = live([...BASE, "--json"], "p-first-low");
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.deepEqual(p.skippedRepos.map((x) => x.repo), ["p-first-low"]);
  assert.deepEqual(p.review.map((x) => x.repo), ["p-released", "p-claimed", "p-first", "p-old", "p-recent"]);
});

test("live --create: record tickets and the one new escalation, with their labels", () => {
  const r = live(BASE.concat("--create"));
  assert.equal(r.status, 0, r.stderr);
  const issues = r.posts.filter((p) => p.path.endsWith("/issues"));
  assert.deepEqual(issues.map((p) => [p.title, p.labels]), [
    ["Health review: p-first-low", ["health-review", "repo:p-first-low"]],
    ["Health review: p-first", ["health-review", "repo:p-first"]],
    ["Health review: p-old", ["health-review", "repo:p-old"]],
    ["Deferred bug: p-old#7 Exactly four weeks", ["bug", "ready-for-agent", "repo:p-old"]],
  ]);
  assert.match(issues[2].body, /Base commit\*\*: `b{40}` \(reviewed in #91\)/);
  assert.match(issues[0].body, /first run: review the whole project/);
  assert.match(issues[3].body, /https:\/\/github\.com\/statewalker\/p-old\/issues\/7/);
  assert.match(issues[3].body, /## Acceptance criteria/);
  assert.ok(r.posts.some((p) => p.path.endsWith("/labels") && p.name === "repo:p-old"));
  assert.match(r.stdout, /p-old: new record ticket, since bbbbbbb \(#\d+\)/);
});
