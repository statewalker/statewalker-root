#!/usr/bin/env node
// A stand-in for `gh api` in tests: answers from the fixture file in FAKE_GH_FIXTURES, fails like an
// unattached repository for any path under FAKE_GH_DENY, and logs POSTs to FAKE_GH_LOG. No network.
import fs from "node:fs";
const args = process.argv.slice(2);
if (args[0] !== "api") process.exit(2);
if (args[1] === "--method" && args[2] === "POST") {
  const fields = {};
  for (let i = 4; i < args.length; i += 2) {
    const [k, v] = args[i + 1].split(/=(.*)/s);
    if (k.endsWith("[]")) (fields[k.slice(0, -2)] ??= []).push(v);
    else fields[k] = v;
  }
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ path: args[3], ...fields }) + "\n");
  console.log(JSON.stringify({ number: 900 + fs.readFileSync(process.env.FAKE_GH_LOG, "utf8").trim().split("\n").length }));
  process.exit(0);
}
const url = args[1];
if (process.env.FAKE_GH_DENY && url.startsWith(`repos/statewalker/${process.env.FAKE_GH_DENY}/`)) {
  console.error("gh: GitHub access to this repository is not enabled for this session. (HTTP 403)");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(process.env.FAKE_GH_FIXTURES, "utf8"));
const key = url.replace(/[?&]per_page=100&page=\d+$/, "");
const page = Number(/page=(\d+)$/.exec(url)?.[1] ?? 1);
if (!(key in data)) {
  console.error(`fake gh: no fixture for ${key}`);
  process.exit(1);
}
console.log(JSON.stringify(page === 1 ? data[key] : []));
