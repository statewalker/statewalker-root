// review-metrics.mjs at its command-line seam: recorded GitHub responses in, report out. No network.
// Run: node --test tools/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, "..", "review-metrics.mjs");
const NOW = "2026-11-14T00:00:00Z";

function run(fixture, repos, ...extra) {
  const r = spawnSync("node", [TOOL, "--now", NOW, "--repos", repos, "--fixtures", path.join(HERE, "fixtures", `review-metrics-${fixture}.json`), ...extra], {
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH, GH_TOKEN: "", GITHUB_TOKEN: "" },
  });
  return r;
}
const json = (fixture, repos) => {
  const r = run(fixture, repos, "--json");
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const titles = (rep) => rep.thresholds.map((t) => t.title);

test("busy: the five signals", () => {
  const { signals: s } = json("busy", "webrun-files,statewalker-db");
  assert.equal(s.merged, 8); // closed-unmerged and pre-window PRs excluded
  assert.deepEqual(s.passes, { median: 1, max: 3 });
  assert.deepEqual(s.critical, { total: 5, perMerge: 0.83, downgraded: 1, overrides: 1 });
  assert.deepEqual(s.speculative, { rejected: 2, findings: 8, share: 0.25 });
  assert.deepEqual(s.deferredBugs, { "webrun-files": 4, "statewalker-db": 2 }); // every open bug, review label or not
  assert.equal(s.escalations, 1); // neither the root PR nor the root deferred bug counts
  assert.deepEqual(s.skippedRepos, []);
  assert.deepEqual(s.timeToMergeHours, { median: 9 });
});

test("busy: a missing record and a malformed record line are reported, not counted", () => {
  const { signals: s } = json("busy", "webrun-files,statewalker-db");
  assert.equal(s.withRecord, 6);
  assert.deepEqual(s.withoutRecord, ["webrun-files#14", "webrun-files#15"]);
  assert.equal(s.malformedRecords, 1);
});

test("busy: a PR with several passes counts its highest pass and every critical once", () => {
  const rep = json("busy", "statewalker-db");
  assert.deepEqual(rep.signals.passes, { median: 2, max: 3 });
  assert.equal(rep.signals.critical.total, 3);
  assert.equal(rep.signals.critical.overrides, 0); // a critical fixed in pass 3 is not an override
});

test("busy: thresholds — critical rising and deferred growth fire where they should, nowhere else", () => {
  const rep = json("busy", "webrun-files,statewalker-db");
  assert.deepEqual(titles(rep), [
    "Review metrics: critical findings rising in webrun-files",
    "Review metrics: deferred bugs growing in webrun-files",
  ]);
  assert.deepEqual(rep.perProject["statewalker-db"].deferredHistory, [1, 2, 2, 2]); // not growing
  assert.equal(rep.perProject["statewalker-db"].criticalPerMergeLater, 0); // falling, not rising
  assert.equal(rep.perProject["statewalker-db"].criticalPerMergeEarlier, 3);
});

test("busy: duplicate check against open area:root issues", () => {
  const rep = json("busy", "webrun-files,statewalker-db");
  assert.deepEqual(rep.thresholds.map((t) => t.duplicateOf), [40, null]);
  const md = run("busy", "webrun-files,statewalker-db").stdout;
  assert.match(md, /critical findings rising in webrun-files: .*Already filed: #40\./);
  assert.match(md, /Missing gate records: 2 \(webrun-files#14, webrun-files#15\)/);
  assert.match(md, /deferred bugs growing in webrun-files: .*To file\./);
});

test("busy: calibration candidates are this week's downgrades and overrides", () => {
  assert.deepEqual(json("busy", "webrun-files,statewalker-db").calibration, [
    { pr: "webrun-files#11", downgraded: 1, override: false },
    { pr: "webrun-files#13", downgraded: 0, override: true },
  ]);
});

test("noisy: median passes and speculative share fire; the speculative ticket is a duplicate", () => {
  const rep = json("noisy", "httpeers");
  assert.equal(rep.signals.passes.median, 2);
  assert.equal(rep.signals.speculative.share, 0.58); // 7 rejected of 12
  assert.deepEqual(titles(rep), ["Review metrics: median gate passes above 1.5", "Review metrics: speculative share above 30%"]);
  assert.deepEqual(rep.thresholds.map((t) => t.duplicateOf), [null, 60]);
  assert.equal(rep.perProject.httpeers.criticalPerMergeEarlier, null); // no earlier merges: not "rising"
});

test("empty week: no signals, no thresholds, no crash", () => {
  const rep = json("empty", "statewalker-fsm");
  assert.equal(rep.signals.merged, 0);
  assert.equal(rep.signals.passes.median, null);
  assert.equal(rep.signals.speculative.share, null);
  assert.equal(rep.signals.timeToMergeHours.median, null);
  assert.deepEqual(rep.thresholds, []);
  const md = run("empty", "statewalker-fsm").stdout;
  assert.match(md, /median n\/a/);
  assert.match(md, /No threshold fires\./);
});

test("the report ends with the week's metrics marker", () => {
  assert.match(run("empty", "statewalker-fsm").stdout, /<!-- review-metrics: week=2026-W46 -->\n$/);
});

test("an override is read from the Outcome cell only", async () => {
  const { hasOverrideRow } = await import(TOOL);
  const row = (outcome, verdict = "real") => `| # | Proposed / judged | Verdict | Outcome |\n|---|---|---|---|\n| 1 | critical / critical | ${verdict} | ${outcome} |`;
  for (const yes of [
    row("overridden (the human's message)"),
    row("Overridden: merge anyway"),
    row('overridden (the human: "a | b")'),
    row("overridden (a \\| b)"),
    row("**overridden** (human)"),
    "  | 1 | critical / critical | real | overridden (human)",
    row("overridden").replace(/\n/g, "\r\n"),
  ]) assert.equal(hasOverrideRow(yes), true, yes);
  for (const no of [
    row("fixed (abc)", 'an override is a record saying "overridden"'),
    row("not overridden: fixed"),
    `${row("fixed")}\n\nNot overridden; merged after the fix.`,
    "Earlier pass | overridden |",
  ]) assert.equal(hasOverrideRow(no), false, no);
});

test("a request without a recorded response fails instead of reaching the network", () => {
  const r = run("empty", "webrun-files");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no fixture for repos\/statewalker\/webrun-files\/pulls/);
});

test("--create is refused with fixtures", () => {
  const r = run("empty", "statewalker-fsm", "--create");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--create cannot be used with --fixtures/);
});

// The live path, through a fake `gh` on PATH (tools/test/fixtures/fake-gh.mjs): still no network.
function live(fixture, repos, { deny = "", extra = [] } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-gh-"));
  fs.symlinkSync(path.join(HERE, "fixtures", "fake-gh.mjs"), path.join(bin, "gh"));
  const log = path.join(bin, "posts.log");
  fs.writeFileSync(log, "");
  const r = spawnSync("node", [TOOL, "--now", NOW, "--repos", repos, ...extra], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_GH_FIXTURES: path.join(HERE, "fixtures", `review-metrics-${fixture}.json`), FAKE_GH_DENY: deny, FAKE_GH_LOG: log },
  });
  return { ...r, posts: fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) };
}

test("live: an unreadable repository is skipped and reported; the others are still measured", () => {
  const r = live("busy", "webrun-files,statewalker-db", { deny: "statewalker-db", extra: ["--json"] });
  assert.equal(r.status, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.deepEqual(rep.signals.skippedRepos.map((x) => x.repo), ["statewalker-db"]);
  assert.equal(rep.signals.merged, 6);
  assert.deepEqual(Object.keys(rep.perProject), ["webrun-files"]);
  assert.match(live("busy", "webrun-files,statewalker-db", { deny: "statewalker-db" }).stdout, /Not readable, skipped: statewalker-db\./);
});

test("live --create files only the thresholds not already open, with area:root and needs-triage", () => {
  const r = live("busy", "webrun-files,statewalker-db", { extra: ["--create"] });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.posts.map((p) => [p.path, p.title, p.labels]), [
    ["repos/statewalker/statewalker-root/issues", "Review metrics: deferred bugs growing in webrun-files", ["area:root", "needs-triage"]],
  ]);
  assert.match(r.posts[0].body, /open deferred bugs 1 → 2 → 3 → 4/);
  assert.match(r.stdout, /deferred bugs growing in webrun-files: .*Filed: #901\./);
  assert.match(r.stdout, /critical findings rising in webrun-files: .*Already filed: #40\./);
});

test("a lockfile-only pull request merged by merge-lockfile.yml has its own record, not a missing one", async () => {
  const { gateRecords, compute } = await import(TOOL);
  const SHA = "a".repeat(40);
  const lockfileRecord = { body: `Merge gate, lockfile-only pull request: verified mechanically.\n\n<!-- lockfile-gate: sha=${SHA} checks=3 -->` };
  const fullRecord = { body: "<!-- gate: pass=1 critical=0 downgraded=0 high=0 rejected=0 -->" };
  assert.deepEqual(gateRecords([lockfileRecord], SHA), { records: [], malformed: 0, lockfile: true });
  assert.equal(gateRecords([fullRecord], SHA).lockfile, false);
  // Changed after the mechanical record (another head merged): not a lockfile merge.
  assert.equal(gateRecords([lockfileRecord], "b".repeat(40)).lockfile, false);
  // A full gate record wins: counted once, as a record.
  assert.equal(gateRecords([lockfileRecord, fullRecord], SHA).lockfile, false);

  const now = new Date(NOW);
  const pr = (number, comments, head = SHA) => ({ repo: "cellb.dev", number, title: "t", created: new Date(now - 7200000), merged: new Date(now - 3600000), ...gateRecords(comments, head) });
  const { signals: s } = compute(
    { prs: [pr(1, [lockfileRecord]), pr(2, []), pr(3, [lockfileRecord], "c".repeat(40))], deferred: { "cellb.dev": [] }, escalations: 0, rootIssues: [] },
    now,
  );
  assert.deepEqual(s.withoutRecord, ["cellb.dev#2", "cellb.dev#3"]);
  assert.equal(s.lockfileMerges, 1);
  assert.equal(s.withRecord, 0);
});
