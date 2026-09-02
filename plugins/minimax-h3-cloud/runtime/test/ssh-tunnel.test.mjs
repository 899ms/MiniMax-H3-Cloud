import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { resolveCompShareAskpassPath } from "../src/compshare-cli.mjs";
import {
  buildSshTunnelArgs,
  createAskpassContext,
  decodeCompSharePassword,
  parseSshLoginCommand,
  resolveSshPath,
} from "../src/ssh-tunnel.mjs";

const execFileAsync = promisify(execFile);

test("SSH login parser accepts Windows OpenSSH paths", () => {
  assert.deepEqual(
    parseSshLoginCommand(
      '"C:\\Windows\\System32\\OpenSSH\\ssh.exe" -p 22022 root@gpu.example',
    ),
    { user: "root", host: "gpu.example", port: 22022 },
  );
});

test("SSH defaults are platform aware and overridable", () => {
  assert.equal(resolveSshPath({ env: {}, platform: "win32" }), "ssh.exe");
  assert.equal(resolveSshPath({ env: {}, platform: "linux" }), "ssh");
  assert.equal(
    resolveSshPath({
      env: { MINIMAX_H3_SSH_PATH: "D:\\OpenSSH\\ssh.exe" },
      platform: "win32",
    }),
    "D:\\OpenSSH\\ssh.exe",
  );
});

test("SSH tunnel arguments use a dedicated known-hosts file", () => {
  const args = buildSshTunnelArgs({
    user: "root",
    host: "gpu.example",
    port: 22,
    localHost: "127.0.0.1",
    localPort: 48188,
    remoteHost: "127.0.0.1",
    remotePort: 8188,
    knownHostsPath: "C:\\state\\known-hosts\\gpu-1",
  });
  assert.ok(args.includes("127.0.0.1:48188:127.0.0.1:8188"));
  assert.ok(args.includes("UserKnownHostsFile=C:\\state\\known-hosts\\gpu-1"));
  assert.ok(args.includes("NumberOfPasswordPrompts=1"));
});

test("CompShare base64 passwords are decoded without changing ordinary text", () => {
  assert.equal(decodeCompSharePassword(Buffer.from("secret").toString("base64")), "secret");
  assert.equal(decodeCompSharePassword("plain-password"), "plain-password");
});

test("askpass keeps the password in a short-lived file", async () => {
  const root = await mkdtemp(join(tmpdir(), "minimax-h3-test-"));
  let context;
  try {
    if (process.platform === "win32") {
      const helper = join(root, "compshare-ssh-askpass.exe");
      await writeFile(helper, "test", "utf8");
      context = await createAskpassContext({
        password: "s3cret!&%",
        env: { MINIMAX_H3_SSH_ASKPASS_PATH: helper },
        platform: "win32",
        temporaryRoot: root,
      });
      assert.equal(context.path, helper);
      assert.equal(
        await readFile(
          context.environment.COMPSHARE_INTERNAL_SSH_PASSWORD_FILE,
          "utf8",
        ),
        "s3cret!&%",
      );
    } else {
      context = await createAskpassContext({
        password: "s3cret!&%",
        env: {},
        platform: process.platform,
        temporaryRoot: root,
      });
      const { stdout } = await execFileAsync(context.path, [], {
        encoding: "utf8",
        env: { ...process.env, ...context.environment },
      });
      assert.equal(stdout, "s3cret!&%\n");
    }
  } finally {
    if (context) await rm(context.directory, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
});

test("installed Windows CompShare askpass helper can read the temporary password", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only integration check");
    return;
  }
  const helper = resolveCompShareAskpassPath();
  if (!helper) {
    t.skip("CompShare CLI is not installed");
    return;
  }

  const context = await createAskpassContext({ password: "integration-secret" });
  try {
    const { stdout } = await execFileAsync(context.path, [], {
      encoding: "utf8",
      env: { ...process.env, ...context.environment },
    });
    assert.equal(stdout.trimEnd(), "integration-secret");
  } finally {
    await rm(context.directory, { recursive: true, force: true });
  }
});
