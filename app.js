const path = require("path");
const next = require("next");
const http = require("http");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const appDir = path.join(__dirname, "frontend");

const app = next({
  dev: false,
  dir: appDir,
  hostname,
  port,
});

const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, hostname, () => {
        console.log(`Next.js server ready on http://${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error("Failed to start Next.js server", error);
    process.exit(1);
  });
