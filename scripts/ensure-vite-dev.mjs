import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = 1420;
const url = `http://${host}:${port}`;
const viteBin =
  process.platform === "win32"
    ? "node_modules\\.bin\\vite.cmd"
    : "node_modules/.bin/vite";

async function isDevServerAvailable() {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

if (await isDevServerAvailable()) {
  console.log(`Vite dev server already running at ${url}; reusing it.`);
  process.exit(0);
}

const vite = spawn(
  viteBin,
  ["vite", "--host", host, "--port", String(port)],
  {
    stdio: "inherit",
    env: process.env,
  },
);

vite.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
