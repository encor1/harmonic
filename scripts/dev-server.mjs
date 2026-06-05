import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { createServer, get } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 1420);
const host = process.env.HOST || "127.0.0.1";
const clients = new Set();
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
]);

const reloadClient = `
<script type="module">
  const events = new EventSource("/__reload");
  events.addEventListener("reload", () => location.reload());
</script>`;

function sendReload() {
  for (const response of clients) {
    response.write("event: reload\\ndata: now\\n\\n");
  }
}

function resolveRequestPath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  const normalized = normalize(decoded).replace(/^([/\\])+/, "");
  const absolute = resolve(join(root, normalized));

  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    return null;
  }

  return absolute;
}

function serveFile(request, response) {
  const filePath = resolveRequestPath(request.url);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const type = mimeTypes.get(extname(filePath)) || "application/octet-stream";

  if (filePath.endsWith("index.html")) {
    let html = "";
    createReadStream(filePath, "utf8")
      .on("data", (chunk) => {
        html += chunk;
      })
      .on("end", () => {
        response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
        response.end(html.replace("</body>", `${reloadClient}\\n  </body>`));
      });
    return;
  }

  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  createReadStream(filePath).pipe(response);
}

function checkExistingServer() {
  const request = get(`http://${host}:${port}/`, (response) => {
    response.resume();

    if (response.statusCode && response.statusCode < 500) {
      console.log(`Frontend dev server already running on http://${host}:${port}`);
      process.exit(0);
    }

    console.error(`Port ${port} is in use, but it does not look like this dev server.`);
    process.exit(1);
  });

  request.on("error", () => {
    console.error(`Port ${port} is already in use.`);
    process.exit(1);
  });
}

const server = createServer((request, response) => {
  if (request.url === "/__reload") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write("\\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  serveFile(request, response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    checkExistingServer();
    return;
  }

  throw error;
});

server.listen(port, host, () => {
  console.log(`Frontend dev server listening on http://${host}:${port}`);
});

let reloadTimer = null;
for (const file of ["index.html", "styles.css", "app.js"]) {
  watch(join(root, file), () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(sendReload, 80);
  });
}
