#!/usr/bin/env node
/* Capture each slide of the injected deck HTML at exactly 1280x720 CSS px
 * (2x output = 2560x1440 PNG) via CDP against a headless Chrome instance.
 *
 * Usage: node capture-deck.mjs <deck.html> <outdir> <cdp-port>
 * Requires a Chrome instance already listening on <cdp-port>.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const [html, outDir, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!html || !outDir || !port) {
  console.error("usage: node capture-deck.mjs <deck.html> <outdir> <cdp-port>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "deck-cdp-"));
const CHROME = process.env.CHROME;

const chrome = spawn(
  CHROME,
  [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function jsonList() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return res.json();
}

async function waitForTarget(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await jsonList();
      const page = targets.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome CDP endpoint never became ready");
}

const target = await waitForTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws connect failed")); });

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  }
};
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    screenWidth: 1280, screenHeight: 720,
  });

  for (let i = 1; i <= 6; i++) {
    const url = `file://${html}?n=${i}`;
    await send("Page.navigate", { url });

    let ready = false;
    for (let t = 0; t < 80; t++) {
      const r = await send("Runtime.evaluate", {
        expression:
          "document.readyState === 'complete' && document.fonts && document.fonts.status === 'loaded'",
        returnByValue: true,
      });
      if (r.result && r.result.value === true) { ready = true; break; }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) console.error(`slide ${i}: fonts not confirmed loaded (continuing anyway)`);

    const shot = await send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width: 1280, height: 720, scale: 2 },
    });
    const out = path.join(outDir, `slide-${String(i).padStart(2, "0")}.png`);
    fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`captured slide ${i} -> ${out}`);
  }
} finally {
  ws.close();
  chrome.kill("SIGKILL");
  fs.rmSync(PROFILE, { recursive: true, force: true });
}