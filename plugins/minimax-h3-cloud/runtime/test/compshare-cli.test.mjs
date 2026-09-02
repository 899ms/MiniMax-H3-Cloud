import assert from "node:assert/strict";
import test from "node:test";
import {
  CompShareCliError,
  resolveCompShareCliPath,
  runCompShareCli,
} from "../src/compshare-cli.mjs";

test("CompShare CLI executable can be overridden on every platform", () => {
  assert.equal(
    resolveCompShareCliPath({
      env: { COMPSHARE_CLI_PATH: "D:\\Tools\\compshare.exe" },
      platform: "win32",
    }),
    "D:\\Tools\\compshare.exe",
  );
});

test("CompShare CLI accepts UTF-8 BOM JSON on Windows", async () => {
  let invocation;
  const result = await runCompShareCli(["profile", "show"], {
    executable: "C:\\Tools\\compshare.exe",
    env: { TEST_FLAG: "1" },
    execFileImpl: async (executable, args, options) => {
      invocation = { executable, args, options };
      return { stdout: '\uFEFF{"ok":true,"data":{"profile":"h3"}}' };
    },
  });

  assert.deepEqual(result, { profile: "h3" });
  assert.equal(invocation.executable, "C:\\Tools\\compshare.exe");
  assert.deepEqual(invocation.args, ["profile", "show"]);
  assert.equal(invocation.options.env.TEST_FLAG, "1");
});

test("missing CompShare CLI has an actionable error", async () => {
  await assert.rejects(
    runCompShareCli([], {
      executable: "missing-compshare.exe",
      execFileImpl: async () => {
        const error = new Error("spawn ENOENT");
        error.code = "ENOENT";
        throw error;
      },
    }),
    (error) =>
      error instanceof CompShareCliError &&
      error.code === "COMPSHARE_CLI_NOT_FOUND" &&
      error.message.includes("COMPSHARE_CLI_PATH"),
  );
});
