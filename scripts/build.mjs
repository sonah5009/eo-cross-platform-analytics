import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "dist", "server");
const files = [
  ["index.html", "text/html; charset=utf-8"],
  ["detail.html", "text/html; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"],
  ["app.js", "text/javascript; charset=utf-8"],
  ["data/youtube-content-master.json", "application/json; charset=utf-8"],
  ["data/youtube-content-master.csv", "text/csv; charset=utf-8"],
  ["data/magazine-content-candidates.json", "application/json; charset=utf-8"],
  ["data/magazine-content-candidates.csv", "text/csv; charset=utf-8"],
];

const routes = [];
for (const [fileName, contentType] of files) {
  const source = await fs.readFile(path.join(projectRoot, fileName));
  routes.push([
    `/${fileName}`,
    {
      contentType,
      body: source.toString("base64"),
    },
  ]);
}
routes.push(["/", routes.find(([route]) => route === "/index.html")[1]]);

const worker = `const routes = new Map(${JSON.stringify(routes)});

const decodeBase64 = (encoded) => {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = routes.get(url.pathname);
    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(decodeBase64(asset.body), {
      headers: {
        "content-type": asset.contentType,
        "cache-control": asset.contentType.startsWith("text/html")
          ? "no-cache"
          : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

await fs.rm(path.join(projectRoot, "dist"), { recursive: true, force: true });
await fs.mkdir(outputPath, { recursive: true });
await fs.writeFile(path.join(outputPath, "index.js"), worker);
console.log(`Built ${routes.length} routes.`);
