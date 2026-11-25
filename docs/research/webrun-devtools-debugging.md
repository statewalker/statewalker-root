# Debugging and testing the extension; Obscura

Part of statewalker/statewalker-root#430.

**Question.** How should the Chrome MV3 extension be debugged locally and tested in CI? Does Obscura,
or a similar project, help?

**Answer.** Use Chromium or Chrome for Testing with `--load-extension` in a Playwright persistent
context, headless, with no Xvfb. Everything the extension does ran that way in this container (details
below). **Obscura does not help:** it has no extension system and no `chrome.*` APIs.

Some sources could not be fetched from this session: developer.chrome.com, playwright.dev and pptr.dev
did not resolve. The Playwright and Puppeteer documentation was read from their GitHub sources; the
Chrome documentation is cited from search results.

## Local dev loop

**Loading and inspecting.**
- Load unpacked from `dist/webrun-devtools-extension`.
- *Inspect views: service worker* on the extension card opens DevTools for the worker. Offscreen
  documents are listed there too.
- Content scripts are under *Sources → Content scripts*, or in the console's context drop-down.
- The popup opens with right-click → *Inspect*, or at `chrome-extension://<id>/popup/index.html`.
- `chrome://serviceworker-internals` can **Stop** the worker by hand to test the MV3 lifetime. Chrome
  recommends terminating it at random points in tests
  ([Chrome](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)).

**Which browser.** Branded Chrome ignores `--load-extension` since version 137, so scripted launches
use Chromium or Chrome for Testing
([PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY),
[Playwright docs](https://github.com/microsoft/playwright/blob/main/docs/src/chrome-extensions-js-python.md)).

**Reload on change.** The smallest step for the plain Vite build is `vite build --watch` together with
`web-ext run --target chromium --chromium-binary <Chrome for Testing>`, which reloads the extension when
`dist/` changes
([web-ext](https://github.com/mozilla/extension-workshop/blob/master/src/content/documentation/develop/web-ext-command-reference.md)).
Other options:

- `@crxjs/vite-plugin` gives HMR for the popup and content scripts, but means merging the five Vite
  configs into one manifest-driven build.
- WXT and Plasmo would take over the project layout.
- Under every tool, a change to the service worker still needs a full extension reload.

**Agent-assisted debugging.** `chrome-devtools-mcp --categoryExtensions` can install, reload and
trigger an unpacked extension
([Chrome](https://developer.chrome.com/docs/devtools/agents/extensions)).

## Automated tests

**Playwright.** `chromium.launchPersistentContext(dir, { channel: "chromium", args:
["--disable-extensions-except=<ext>", "--load-extension=<ext>"] })`.
- The `chromium` channel is what makes extensions load headless. The default headless shell loads none.
- The worker comes from `context.serviceWorkers()`, and the extension id from its URL.
- Open the popup by its URL.
- An `evaluate` running when the worker is killed throws "Service worker restarted".
- Playwright has no way to click the toolbar action.

**Puppeteer.** `launch({ enableExtensions: [path] })`, or `browser.installExtension(path)`
([guide](https://github.com/puppeteer/puppeteer/blob/main/docs/guides/chrome-extensions.md)).
- `page.triggerExtensionAction(ext)` opened the **real toolbar popup** headless. By contrast,
  `chrome.action.openPopup()` from the worker failed headless with "Could not find an active browser
  window".
- `page.extensionRealms()` reaches the content script's isolated world.
- `worker.close()` terminates the worker.

**The extension's `chrome.debugger` and the test driver's CDP do not conflict.** Both attached to the
same tab, both evaluated in it, and Playwright took a screenshot. In headed runs,
`--silent-debugger-extension-api` hides the infobar.

**Unit level.** Vitest with a small typed fake of the few `chrome.*` APIs used: `runtime` Port and
connect events, `debugger`, `storage`. jest-chrome and sinon-chrome are dated.

## Hands-on results

Run with Playwright 1.63, Chromium 158 and Chrome for Testing 158. The current extension built
unchanged. The harness wrote the API key into the worker's IndexedDB with `sw.evaluate`, then drove
the page API.

| Step | Headless, `channel: "chromium"` or CfT | Headed, under Xvfb | Old headless shell |
|---|---|---|---|
| Find the worker and evaluate in it | ok | ok | no worker: extensions not loaded |
| API key through the worker's IndexedDB; popup reads it | ok | ok | – |
| `01.screenshot` (`windows.create` + `captureVisibleTab`) | ok | 4 of 5 (tab still loading) | – |
| `03` (`debugger.attach`, `Page.navigate`, `$once`, `Runtime.evaluate`, `Page.captureScreenshot`) | 6 of 7 (one hang) | ok | – |
| Extension debugger and Playwright CDP on one tab | ok | ok | – |
| Worker killed, page reconnects, `03` again | ok | ok | – |

Headed mode without a display fails at launch, so it needs Xvfb, but nothing the extension does needs
headed mode.

### Defects found in the current code

The redesign should fix these:

1. **`$once` race.** The `onEvent` listener is added only after `Page.navigate` has returned. A fast
   load fires `loadEventFired` first, and the promise, which has no timeout, never settles. Subscribe
   before the command (a single `sendCommandAndWait`), and give every wait a timeout.
2. **Errors lose their message across the port.** A wrong key and a failed capture both arrive as
   `"[object Object]"`. The message and code need to be serialized explicitly.
3. **Fixed sleeps in the examples.** They wait 500–800 ms before `captureVisibleTab`, which fails while
   the tab is still loading. Wait for `tabs.onUpdated` with `status: "complete"` instead.
4. **`captureVisibleTab` refuses `data:` URLs**, even with `<all_urls>`. Tests need an http(s) page.

### Recommended CI harness

A GitHub Actions job on ubuntu-latest:

- unit tests in Vitest;
- end-to-end tests in `@playwright/test`, using the persistent-context fixture, headless (no Xvfb),
  with test pages from a local server only;
- one Puppeteer spec for the toolbar popup and the content-script realm;
- one end-to-end pass with a forced worker termination between steps.

## Obscura

**What it is.** [h4ckf0r0day/obscura](https://github.com/h4ckf0r0day/obscura): Apache-2.0, about 37k
stars, very active. It is a Rust/V8 headless browser engine behind a subset of CDP, aimed at scraping
and AI agents. Forks and adapters, such as nxpatterns/obscura-headless-browser and obscura-mcp, derive
from it. Other repositories named Obscura are unrelated.

**What it lacks.** Read from its README, docs and source at 6f278af:

- no extension system: no `--load-extension`, no `chrome.runtime`, no `Extensions` CDP domain;
- `ServiceWorker.enable` is a no-op stub;
- no `chrome.debugger`, no windows or tabs API, no `captureVisibleTab` and no popup, because it has no
  browser UI;
- Playwright reaches it only through `connectOverCDP`.

Its own CDP domains are Target, Page, Runtime, DOM, Network, Fetch, IO, Storage, Input and a custom
`LP`.

**Verdict for each use:**

- **(a) Debugging the extension:** not possible; it cannot load it.
- **(b) CI:** not for the extension. Its rendering is its own, so it is a poor oracle even for tests
  that do not involve the extension.
- **(c) As a backend in place of the extension:** a page that wants to automate the *user's own*
  browser (tabs, logins, what the user sees) still needs the extension. For a headless
  fetch-and-screenshot service, real headless Chromium behind a CDP relay is the faithful choice.

**Hands-on.** Its Linux binary was downloaded but not run (this session's permissions refused it). The
verdict rests on its source and docs, which are unambiguous about extensions.

**Comparable projects:**

- **Lightpanda:** partial CDP, no extensions; its own guides send extension work to Chrome.
- **Browserless:** hosts real Chromium and can load extensions, but adds nothing over a CI runner.
- **Chrome for Testing:** the binary to use.
- **chrome-devtools-mcp:** useful for agent-driven local debugging.
