# Sandboxes that run in the browser: a survey

Survey written on 2026-11-20 in the session "In-browser sandboxing technologies"
(session_014VQ7zpCGfhyUHvP9gvpqgz). It is saved here unchanged in substance, because the session
held it only in chat. It came from web searches plus the model's own knowledge.
- Claims that rest only on a young project's README are marked **(self-reported)**.
- Entries not re-checked in that session were listed from memory. Check versions and licences
  before relying on them.

No ticket asked for this survey. It is background for the container work
([lightweight-containers-on-do-runtimes](../../ai-harness/research/lightweight-containers-on-do-runtimes.md),
[node-python-clis-in-sandbox](../../ai-harness/research/node-python-clis-in-sandbox.md),
[almostnode-on-do-runtimes](almostnode-on-do-runtimes.md)) and for the glossary's **Sandbox**.

## 0. The basic split

| Approach | How it works | Examples | Fidelity | Isolation |
|---|---|---|---|---|
| **A. Re-implementing the API** | JS shims for `fs`, `process`, `http`; an in-memory filesystem; user JS run by the page's own engine | almostnode, Nodepod, Nodebox, Lifo, just-bash | Low to medium; native addons fail | Weakest, unless wrapped in a worker or a cross-origin iframe |
| **B. A virtual OS kernel in JS/Wasm** | A kernel in workers with processes, a VFS, pipes and sockets. JS runs on V8; other binaries are compiled to Wasm | WebContainers, BrowserPod, Wasmer SDK (WASIX), Wanix, jswasi | High for Node; other languages only with a Wasm build | Medium to strong (separate origin, workers, syscall layer) |
| **C. Emulating a CPU or VM** | x86 or RISC-V code emulated or JIT-compiled to Wasm, running a real Linux | CheerpX/WebVM, v86, container2wasm, nano, WebCM, JSLinux, linux-wasm | Highest: unmodified Debian or Docker images | Strongest (the guest can't reach JS); slowest |

All three still sit inside the browser's own process sandbox. The worst case is code taking over
its tab or origin (cookies, DOM, tokens), not the machine.

## 1. Mixed: browser front end, remote VMs or containers

| Product | Remote technology | Browser part | Notes |
|---|---|---|---|
| CodeSandbox / Together Code Sandbox | Firecracker microVMs with memory snapshots; resume in about 0.5–3 s; forks of running VMs | Sandpack, Nodebox | Part of Together AI since Dec 2024. `@codesandbox/sdk` offers one VM per agent |
| StackBlitz / Bolt.new | Mostly none: WebContainers run locally; a backend serves LLMs, deploys and registry proxying | WebContainers | The rare product that is mainly in-browser |
| Replit | Containers on GCP, Nix | IDE, preview | Replit Agent |
| GitHub Codespaces / vscode.dev | Docker on Azure VMs | VS Code web | vscode.dev can run WASI extensions locally |
| Gitpod (Ona), Coder, Daytona | Containers or VMs | Web IDE | Daytona moved toward agent sandboxes |
| E2B, Vercel Sandbox, Cloudflare Sandbox SDK, Modal, Fly Machines, Deno Sandbox | Firecracker, gVisor or containers | None; you build the UI | Agent-first APIs. Vercel's `bash-tool` uses just-bash locally and falls back to Vercel Sandbox |
| Compiler Explorer, Rust and Go playgrounds | Server sandboxes (nsjail, Docker, gVisor) | Editor | The classic remote-compile playground |

- **Why mixed:** full Linux, native binaries, GPUs, persistent state and shareable URLs.
- **Costs:** a price per session, cold starts, latency on every command, and a vendor that holds
  the code.

## 2. Proprietary or commercial runtimes that run purely in the browser

- **StackBlitz WebContainers** (the reference point):
  - **What:** a virtual OS kernel in JS/Wasm workers. Node runs on the browser's V8, with npm,
    pnpm and yarn, a TCP-like network stack, and dev servers previewed through a service worker on
    `*.webcontainer-api.io`.
  - **Requirements:** `SharedArrayBuffer`, so COOP/COEP. Best on Chromium.
  - **API:** `@webcontainer/api` (`boot`, `mount`, `spawn`, `on('server-ready')`).
  - **Use:** Bolt.new, bolt.diy and many AI app builders run on it.
  - **Licence:** free for open source, personal use and prototypes, but **a paid commercial
    licence is required for for-profit production use**. That is the main reason people look at
    the alternatives.
- **Leaning Technologies:**
  - **BrowserPod:** the Node.js C++ source compiled to Wasm and JS (Node 22 at launch), pitched
    as a sandbox for untrusted or AI code. Its Portals give public URLs for services inside a pod.
    Sources conflict between version 1.0 and 2.0. A price of about $20 per user per month comes
    only from a third-party listing.
  - **CheerpX:** an x86-to-Wasm JIT that runs unmodified 32-bit x86 Linux binaries. Free for
    non-commercial use.
  - **WebVM:** the open-source Debian-in-a-tab front end on CheerpX, with networking through
    Tailscale.
  - **Isolation:** category C.
- **CodeSandbox Nodebox:** a closed-source, Node-compatible runtime that needs no
  `SharedArrayBuffer`, so it works on iOS Safari. It powers Sandpack 2. Its modules come from the
  Sandpack CDN, and its EULA restricts commercial use.
- **Strapkit** (`@strapkit/core`): claims Node, git, sed and grep compiled to Wasm
  **(self-reported)**. It needs an API key, has about 3 commits and no releases. Unproven.
- **Others:**
  - the Figma plugin sandbox (QuickJS compiled to Wasm);
  - Anthropic Artifacts and ChatGPT Canvas (sandboxed iframes on separate origins; Canvas runs
    Python through Pyodide).

## 3. Open-source runtimes that run purely in the browser

### 3a. Agent-oriented (2025–26)

| Project | Approach | What you get | Notes |
|---|---|---|---|
| Lifo (lifo.sh, MIT) | A: "the browser is the kernel" | Bash-like shell, 60+ commands, VFS in IndexedDB; `@lifo-sh/core` `Sandbox` API, `@lifo-sh/ui` terminal | Node and edge support planned; sources disagree on whether it shipped. No security audit |
| almostnode (macaly, MIT) | A: Node 20 API shims, about 250 KB | `createContainer()`, an npm installer into the VFS; runs Vite and Next.js dev setups | Experimental: native modules fail. A WebContainers alternative without the licence issue |
| Nodepod (`@scelar/nodepod`) | A: polyfills, in-memory FS | FS, shell, npm, Express-style servers | "Lightweight WebContainer alternative" |
| just-bash (Vercel Labs) | An interpreter: bash written in TypeScript | Pipes, loops, 50+ commands (grep, sed, awk, jq), in-memory FS | Isolated by design: no process spawning and no host access. Used by Convex, Turso AgentFS and wterm |
| Wasmer JS SDK (`@wasmer/sdk`, MIT) | B: WASIX on the browser's Wasm engine | Registry packages: Python, PHP, Node apps, Postgres, bash; `sandbox.ports.expose(port)` | Pitched as local sandboxes for AI agents. The first run is slow because packages download. Related: Edge.js (server side) |
| agent-sandbox (Rust, MIT) | Wasm | Shell, a JS runtime, 80+ CLI tools, SSRF protection | Mainly hosted on wasmtime; browser use depends on the build |

### 3b. OS kernels and emulators

| Project | Approach | Notes |
|---|---|---|
| v86 | C: x86 emulator with a Wasm JIT | Boots Linux, Windows 9x and BSD; network through a WebSocket relay |
| container2wasm (NTT) | C: container image, Linux kernel and emulator in one `.wasm` | `c2w ubuntu:22.04 out.wasm`; experimental; also vscode-container-wasm |
| nano (userland-run) | C: RISC-V user-mode Linux in Wasm, about 585 KB | Runs BusyBox, Node, npm and TypeScript **(self-reported)** |
| WebCM | C: RISC-V machine emulator (Cartesi) | Full Linux in the browser |
| linux-wasm | The Linux kernel compiled to Wasm | Experimental; no CPU emulation |
| JSLinux (Bellard) | C: x86 and RISC-V | The original; not fully open source |
| Wanix | B: Plan 9-style OS running WASI binaries | Mounts browser resources as files |
| jswasi (Antmicro) | B: WASI runtime with a Linux-like environment | Shell, coreutils, filesystem backends |

### 3c. Isolation building blocks for JavaScript

- **quickjs-emscripten:** a JS interpreter inside Wasm. Real isolation, with its own heap, memory
  and CPU limits, and no DOM.
- **SES / Hardened JS** (Endo, LavaMoat): frozen intrinsics plus Compartments.
- **ShadowRealm:** a TC39 proposal, not broadly shipped.
- **The platform itself:** `<iframe sandbox>` with an opaque origin, CSP, Workers, COOP/COEP and
  credentialless iframes.

## 4. Specialized sandboxes

| Domain | Projects |
|---|---|
| Python | Pyodide, PyScript, JupyterLite, marimo WASM notebooks, Basthon, xeus-lite |
| Other languages | webR, ruby.wasm, php-wasm / WordPress Playground, Go and TinyGo to Wasm, Emception and wasm-clang, Runno, Fengari |
| Databases | PGlite, DuckDB-Wasm, SQLite Wasm with OPFS |
| Framework REPLs | Svelte, Solid, Vue SFC, React docs (Sandpack), Angular (WebContainers), Astro, Qwik, TypeScript |
| Toolchains | Wasm builds of Rolldown, Oxc and Vite (watch mode in WebContainers in 2026), esbuild-wasm, swc and Babel REPLs, the Biome playground |
| Bundlers and preview | Sandpack; esm.sh, jsDelivr and Skypack as package managers |

Their narrow scope keeps them small, fast and safe. Most compile code and show the output in a
sandboxed iframe, with no OS to emulate.

## 5. Common features

- **Virtual filesystem:** in memory, persisted to IndexedDB or OPFS, mounted from JSON or a
  tarball, often watchable.
- **Processes:** `spawn` or `exec` with streams, usually shown in an xterm.js terminal.
- **Package installs:** from the npm registry, a CORS proxy or a Wasm registry.
- **HTTP preview:** a service worker sends requests to an in-browser server shown in an iframe.
  Some products also offer a public tunnel.
- **Networking:** limited by CORS and the lack of raw TCP or UDP. The fixes are a WebSocket relay
  or a VPN.
- **Cost:** no server cost. They work offline after loading, and the code stays private.

## 6. Where they differ

- **Fidelity against size:** about 250 KB for almostnode; tens to hundreds of MB for WebVM or
  container2wasm images.
- **Browser support:** `SharedArrayBuffer` with COOP/COEP limits embedding and Safari. Nodebox
  and the shim runtimes avoid it.
- **Native binaries:** only category C runs arbitrary ELF binaries. B needs a Wasm port; A can't
  run them at all.
- **Languages:**
  - Node only: WebContainers, almostnode, Nodepod, BrowserPod 1.x;
  - bash only: just-bash, Lifo;
  - several: Wasmer and the emulators.
- **Licence:**
  - open: Wasmer, Lifo, almostnode, just-bash, v86, container2wasm;
  - restricted: the Nodebox EULA, CheerpX non-commercial;
  - paid: WebContainers, BrowserPod.

## 7. Degree of isolation

| Level | What protects the host | Examples | Remaining risk |
|---|---|---|---|
| 0 | Nothing: code runs in the host page's realm | Shim runtimes embedded directly | DOM, cookies, storage, tokens. Unsafe for untrusted AI code unless wrapped |
| 1 | No eval: an interpreter of a limited language | just-bash | Interpreter bugs only |
| 2 | A Web Worker or a sandboxed cross-origin iframe | Sandpack, Svelte REPL, Lifo or almostnode when wrapped | Network still open; CPU and memory DoS |
| 3 | A separate origin, workers and a syscall layer | WebContainers, BrowserPod, Wasmer | Plus a controlled network; a good default for AI apps |
| 4 | A Wasm interpreter or CPU emulation | quickjs-emscripten, CheerpX, v86, container2wasm, nano | The guest can't reach JS objects; memory limits can be enforced |
| Always | The browser's process sandbox | All | Compromising the machine needs a browser 0-day |

None of them handles these by default:
- data exfiltration through `fetch`, which needs CSP or a network allowlist;
- CPU or memory denial of service, which only Wasm interpreters can cap well;
- prompt injection driving the agent itself.

## 8. Use cases

- AI app builders and coding agents: Bolt.new, bolt.diy, Macaly (almostnode), clones of v0 and
  Lovable.
- Agent tools: a safe `bash` or `run_code` tool (just-bash, Lifo, Wasmer, BrowserPod).
- Interactive docs and tutorials: Svelte, Angular, Nuxt, TutorialKit.
- Education and assessment: Runno, JupyterLite, coding interviews.
- Bug reproductions: StackBlitz links in issues.
- Demos and products: WordPress Playground, PGlite, DuckDB-Wasm.
- Legacy and native software: CheerpX, v86.

## 9. How to choose

- **Real Node fidelity, a commercial product, Chromium is fine:** WebContainers (licensed) or
  BrowserPod.
- **Open source, several languages, an agent tool:** Wasmer SDK.
- **Small footprint, Node that is good enough:** almostnode or Nodepod, always in a cross-origin
  iframe or worker.
- **Only a shell for an agent:** just-bash (safest) or Lifo.
- **Arbitrary Linux binaries or Docker images:** CheerpX/WebVM, container2wasm or v86.
- **A single language:** Pyodide, PGlite, php-wasm and similar.
- **GPUs, persistence or long jobs:** a mixed product such as the CodeSandbox SDK, E2B, or Vercel
  or Cloudflare Sandbox.

## Gaps to check before relying on this

- BrowserPod's version and pricing.
- Whether Lifo's Node and edge runtime has shipped.
- The maturity of nano and Strapkit, which is self-reported.

## Sources

- Lifo: <https://lifo.sh>, <https://github.com/lifo-sh>
- almostnode: <https://github.com/macaly/almostnode>
- nano: <https://github.com/userland-run/nano>
- Strapkit: <https://github.com/Strapkit/strapkit>
- Wasmer: <https://wasmer.io/posts/wasmer-local-sandboxes-for-ai-agents>,
  <https://docs.wasmer.io/runtime/js>, <https://wasmer.io/posts/edgejs-safe-nodejs-using-wasm-sandbox>
- WebContainers: <https://webcontainers.io/enterprise>,
  <https://github.com/stackblitz/webcontainer-core/issues/2159>
- BrowserPod: <https://labs.leaningtech.com/blog/browserpod-annoucement>,
  <https://labs.leaningtech.com/blog/browserpod-10>,
  <https://browserpod.io/compare/browserpod-vs-webcontainers/>
- CheerpX and WebVM: <https://labs.leaningtech.com/cheerpx>, <https://github.com/leaningtech/webvm>
- Nodebox: <https://codesandbox.io/blog/announcing-sandpack-2>
- just-bash: <https://www.infoq.com/news/2026/01/vercel-bash-tool>,
  <https://turso.tech/blog/agentfs-just-bash>
- container2wasm: <https://medium.com/nttlabs/container2wasm-2dd90a18cc9a>
- Wanix: <https://github.com/tractordev/wanix>
- jswasi: <https://antmicro.com/blog/2024/03/introducing-jswasi-a-wasm-runtime-for-browsers/>
- WebCM: <https://github.com/edubart/webcm>
- VoidZero: <https://voidzero.dev/posts/whats-new-mar-2026>
- Together Code Sandbox and the CodeSandbox SDK: <https://www.together.ai/blog/code-sandbox>,
  <https://codesandbox.io/sdk>
- Wasm sandboxing for agents: <https://thenewstack.io/webassembly-sandboxing-ai-agents/>,
  <https://github.com/restyler/awesome-sandbox>
