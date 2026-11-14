// review-metrics.mjs at its command-line seam: recorded GitHub responses in, report out. No network.
// Run: node --test tools/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  assert.deepEqual(s.critical, { total: 4, perMerge: 0.67, downgraded: 1, overrides: 1 });
  assert.deepEqual(s.speculative, { rejected: 2, findings: 7, share: 0.29 });
  assert.deepEqual(s.deferredBugs, { "webrun-files": 4, "statewalker-db": 1 });
  assert.equal(s.escalations, 1); // the open root PR labelled bug is not an issue
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
  assert.equal(rep.signals.critical.total, 2);
  assert.equal(rep.signals.critical.overrides, 0); // last pass clean: no override
});

test("busy: thresholds — critical rising and deferred growth fire where they should, nowhere else", () => {
  const rep = json("busy", "webrun-files,statewalker-db");
  assert.deepEqual(titles(rep), [
    "Review metrics: critical findings rising in webrun-files",
    "Review metrics: deferred bugs growing in webrun-files",
  ]);
  assert.deepEqual(rep.perProject["statewalker-db"].deferredHistory, [1, 2, 2, 1]); // not growing
  assert.equal(rep.perProject["statewalker-db"].criticalPerMergeLater, 0); // falling, not rising
});

test("busy: duplicate check against open area:root issues", () => {
  const rep = json("busy", "webrun-files,statewalker-db");
  assert.deepEqual(rep.thresholds.map((t) => t.duplicateOf), [40, null]);
  const md = run("busy", "webrun-files,statewalker-db").stdout;
  assert.match(md, /critical findings rising in webrun-files: .*Already filed: #40\./);
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
