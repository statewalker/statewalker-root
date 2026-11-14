// GitHub access for the review tools: live through `gh api` (REST), or recorded responses
// (fixtures) in tests. Plain Node, no dependencies.
//
//   source.list(path, stop?)  every page of a list endpoint (stop(item) ends paging early)
//   source.get(path)          one object
//   source.create(path, fields)  a POST; array fields are sent as name[]=value
//
// A failing live request throws an error with `unreadable` set: callers skip that repository and
// go on. A request with no recorded response throws without it: in tests, a missing fixture is
// an error, never a silent skip, and nothing reaches the network.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

export function liveSource() {
  const gh = (args) => {
    try {
      return JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] }));
    } catch (e) {
      const err = new Error(`gh api ${args.join(" ")}: ${(e.stderr || e.message).toString().trim().split("\n").pop()}`);
      err.unreadable = true;
      throw err;
    }
  };
  return {
    list(p, stop = () => false) {
      const out = [];
      for (let page = 1; ; page++) {
        const items = gh([`${p}${p.includes("?") ? "&" : "?"}per_page=100&page=${page}`]);
        out.push(...items);
        if (items.length < 100 || items.some(stop)) return out;
      }
    },
    get: (p) => gh([p]),
    create(p, fields) {
      const f = Object.entries(fields).flatMap(([k, v]) => (Array.isArray(v) ? v.flatMap((x) => ["-f", `${k}[]=${x}`]) : ["-f", `${k}=${v}`]));
      return gh(["--method", "POST", p, ...f]);
    },
  };
}

export function fixtureSource(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const read = (p) => {
    if (!(p in data)) throw new Error(`no fixture for ${p}`);
    return data[p];
  };
  return {
    list: read,
    get: read,
    create() {
      throw new Error("fixtures are read-only");
    },
  };
}
