import { beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("build output", () => {
  beforeAll(async () => {
    await execFileAsync(process.execPath, ["scripts/build.mjs"]);
  }, 30000);

  it("generates required extension files", () => {
    expect(fs.existsSync("dist/manifest.json")).toBe(true);
    expect(fs.existsSync("dist/content.js")).toBe(true);
    expect(fs.existsSync("dist/service-worker.js")).toBe(true);
    expect(fs.existsSync("dist/popup/popup.js")).toBe(true);
  });
});
