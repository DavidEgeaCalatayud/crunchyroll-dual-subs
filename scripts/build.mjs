import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

const isWatch = process.argv.includes("--watch");

function log(...args) {
  console.log("[build]", ...args);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyFileSafe(from, to) {
  if (!fs.existsSync(from)) {
    log(`Aviso: no existe ${from}`);
    return;
  }

  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
  log(`Copiado: ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

function prepareStaticFiles() {
  removeDir(distDir);
  ensureDir(distDir);

  copyFileSafe(
    path.join(publicDir, "manifest.json"),
    path.join(distDir, "manifest.json")
  );

  copyFileSafe(
    path.join(srcDir, "content", "overlay.css"),
    path.join(distDir, "content", "overlay.css")
  );

  copyFileSafe(
    path.join(srcDir, "popup", "popup.html"),
    path.join(distDir, "popup", "popup.html")
  );

  copyFileSafe(
    path.join(srcDir, "popup", "popup.css"),
    path.join(distDir, "popup", "popup.css")
  );

}

async function buildJs() {
  await esbuild.build({
    entryPoints: {
      content: path.join(srcDir, "content", "content.js"),
      "service-worker": path.join(srcDir, "background", "service-worker.js"),
      "popup/popup": path.join(srcDir, "popup", "popup.js")
    },
    outdir: distDir,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    sourcemap: true,
    logLevel: "info"
  });
}

async function watchJs() {
  const ctx = await esbuild.context({
    entryPoints: {
      content: path.join(srcDir, "content", "content.js"),
      "service-worker": path.join(srcDir, "background", "service-worker.js"),
      "popup/popup": path.join(srcDir, "popup", "popup.js")
    },
    outdir: distDir,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    sourcemap: true,
    logLevel: "info"
  });

  await ctx.watch();
  log("Modo watch activo");

  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    const relative = String(filename).replaceAll("\\", "/");

    if (relative.endsWith(".html") || relative.endsWith(".css")) {
      log(`Cambio detectado en estáticos: ${relative}`);
      try {
        prepareStaticFiles();
      } catch (error) {
        console.error("[build] Error copiando estáticos:", error);
      }
    }
  });
}

async function main() {
  prepareStaticFiles();

  if (isWatch) {
    await watchJs();
    return;
  }

  await buildJs();
  log("Build completado");
}

main().catch((error) => {
  console.error("[build] Error:", error);
  process.exit(1);
});
