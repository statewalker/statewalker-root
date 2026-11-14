// lib/adopt-lockfile.mjs: the automatic lockfile updates (statewalker-root#15) added to a project's
// workflows, as text, keeping everything else. Run: node --test tools/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adoptLockfile, ciJobs } from "../lib/adopt-lockfile.mjs";

function project(ci) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-lockfile-"));
  fs.mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
  if (ci != null) fs.writeFileSync(path.join(dir, ".github/workflows/ci.yml"), ci);
  return dir;
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");

const SHARED_ONLY = `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: statewalker/statewalker-ci/.github/workflows/ci.yml@main
`;

const VERSION_PR = `name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: statewalker/statewalker-ci/.github/workflows/ci.yml@main

  browser:
    runs-on: ubuntu-latest
    steps:
      - run: echo browser

  # The release jobs.
  version:
    needs: [ci, browser]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo version

  pack:
    needs: version
    runs-on: ubuntu-latest
    steps:
      - run: echo pack

  publish:
    needs: pack
    runs-on: ubuntu-latest
    steps:
      - run: echo publish
`;

test("the check jobs are the jobs that run on pull requests, release jobs excluded", () => {
  assert.deepEqual(ciJobs(VERSION_PR).checks, ["ci", "browser"]);
  assert.deepEqual(ciJobs(SHARED_ONLY).checks, ["ci"]);
});

test("a dependent gets statewalker-update.yml and a lockfile job after its check jobs", () => {
  const dir = project(SHARED_ONLY);
  const changes = adoptLockfile(dir);
  assert.deepEqual(changes, ["added .github/workflows/statewalker-update.yml", "updated .github/workflows/ci.yml (lockfile job)"]);
  assert.match(read(dir, ".github/workflows/statewalker-update.yml"), /types: \[statewalker-published\]/);
  assert.match(read(dir, ".github/workflows/statewalker-update.yml"), /statewalker-update\.yml@main/);
  const ci = read(dir, ".github/workflows/ci.yml");
  assert.ok(ci.startsWith(SHARED_ONLY.trimEnd()), "the existing file is kept as it was");
  assert.match(ci, /\n  lockfile:\n    needs: ci\n/);
  assert.match(ci, /if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' && github\.head_ref == 'deps\/statewalker-lockfile' \}\}/);
  assert.match(ci, /merge-lockfile\.yml@main\n    secrets: inherit\n$/);
  assert.doesNotMatch(ci, /notify/);
});

test("a publisher also gets the notify job, and the lockfile job goes before the release jobs", () => {
  const dir = project(VERSION_PR);
  adoptLockfile(dir);
  const ci = read(dir, ".github/workflows/ci.yml");
  const at = (s) => ci.indexOf(s);
  assert.ok(at("\n  browser:") < at("\n  lockfile:") && at("\n  lockfile:") < at("  # The release jobs."), ci);
  assert.match(ci, /\n  lockfile:\n    needs: \[ci, browser\]\n/);
  assert.match(ci, /\n  notify:\n    needs: publish\n    if: \$\{\{ !cancelled\(\) && needs\.publish\.result != 'skipped' \}\}\n    permissions: \{\}\n    uses: statewalker\/statewalker-ci\/\.github\/workflows\/notify-dependents\.yml@main\n    secrets: inherit\n$/);
  assert.ok(at("\n  publish:") < at("\n  notify:"));
});

test("adopting twice changes nothing", () => {
  const dir = project(VERSION_PR);
  adoptLockfile(dir);
  const once = read(dir, ".github/workflows/ci.yml");
  assert.deepEqual(adoptLockfile(dir), []);
  assert.equal(read(dir, ".github/workflows/ci.yml"), once);
});

test("a project that already calls the shared workflows keeps its own jobs", () => {
  const dir = project(`${SHARED_ONLY}
  lockfile:
    needs: ci
    uses: statewalker/statewalker-ci/.github/workflows/merge-lockfile.yml@main
    secrets: inherit
`);
  fs.writeFileSync(path.join(dir, ".github/workflows/statewalker-update.yml"), "custom\n");
  assert.deepEqual(adoptLockfile(dir), []);
  assert.equal(read(dir, ".github/workflows/statewalker-update.yml"), "custom\n");
});

test("without a ci.yml nothing is added", () => {
  assert.deepEqual(adoptLockfile(project(null)), []);
});
