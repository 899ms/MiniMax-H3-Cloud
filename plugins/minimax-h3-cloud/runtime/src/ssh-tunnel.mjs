import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolveCompShareAskpassPath } from "./compshare-cli.mjs";
import { resolveUserStateDir } from "./user-paths.mjs";

const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export function parseSshLoginCommand(command) {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("优云没有返回 SSH 登录命令");
  }

  const tokens = command
    .trim()
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((token) => token.replace(/^(?:"([^"]*)"|'([^']*)')$/u, "$1$2"));
  const executable = tokens?.[0]?.split(/[\\/]/).pop()?.toLowerCase();
  if (!tokens || !["ssh", "ssh.exe"].includes(executable)) {
    throw new Error("优云返回了无法识别的 SSH 登录命令");
  }

  let port = 22;
  let destination;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "-p") {
      port = Number(tokens[index + 1]);
      index += 1;
      continue;
    }
    if (/^-p\d+$/.test(token)) {
      port = Number(token.slice(2));
      continue;
    }
    if (!token.startsWith("-") && token.includes("@")) destination = token;
  }

  const separator = destination?.indexOf("@") ?? -1;
  const user = separator > 0 ? destination.slice(0, separator) : "";
  const host = separator > 0 ? destination.slice(separator + 1) : "";
  if (!user || !host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("优云返回了无法识别的 SSH 登录地址");
  }

  return { user, host, port };
}

export function resolveSshPath({
  env = process.env,
  platform = process.platform,
} = {}) {
  return (
    env.MINIMAX_H3_SSH_PATH?.trim() ||
    (platform === "win32" ? "ssh.exe" : "ssh")
  );
}

export function decodeCompSharePassword(value) {
  if (typeof value !== "string") return value;
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    return value;
  }
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (
      !decoded ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(decoded) ||
      Buffer.from(decoded, "utf8").toString("base64") !== value
    ) {
      return value;
    }
    return decoded;
  } catch {
    return value;
  }
}

export function buildSshTunnelArgs({
  user,
  host,
  port,
  localHost,
  localPort,
  remoteHost,
  remotePort,
  knownHostsPath,
}) {
  return [
    "-N",
    "-T",
    "-p",
    String(port),
    "-L",
    `${localHost}:${localPort}:${remoteHost}:${remotePort}`,
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "ConnectTimeout=20",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    `UserKnownHostsFile=${knownHostsPath}`,
    "-o",
    "PreferredAuthentications=password,keyboard-interactive",
    "-o",
    "PubkeyAuthentication=no",
    "-o",
    "NumberOfPasswordPrompts=1",
    `${user}@${host}`,
  ];
}

async function allocateLocalPort(host) {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, host, resolvePromise);
  });
  const address = server.address();
  await new Promise((resolvePromise, rejectPromise) =>
    server.close((error) => (error ? rejectPromise(error) : resolvePromise())),
  );
  if (!address || typeof address === "string") {
    throw new Error("无法分配 SSH 隧道本地端口");
  }
  return address.port;
}

function canConnect(host, port) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host, port });
    const finish = (connected) => {
      socket.destroy();
      resolvePromise(connected);
    };
    socket.setTimeout(250, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return Promise.race([
    new Promise((resolvePromise) => child.once("exit", () => resolvePromise(true))),
    delay(timeoutMs).then(() => false),
  ]);
}

export async function createAskpassContext({
  password,
  env = process.env,
  platform = process.platform,
  temporaryRoot = tmpdir(),
} = {}) {
  const directory = await mkdtemp(join(temporaryRoot, "minimax-h3-askpass-"));
  const passwordPath = join(directory, "password");
  await writeFile(passwordPath, password, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  if (platform === "win32") {
    const askpassPath = resolveCompShareAskpassPath({ env, platform });
    if (!askpassPath) {
      await rm(directory, { recursive: true, force: true });
      throw new Error(
        "找不到 compshare-ssh-askpass.exe；请重新安装 CompShare CLI，或设置 MINIMAX_H3_SSH_ASKPASS_PATH。",
      );
    }
    return {
      directory,
      path: askpassPath,
      environment: {
        COMPSHARE_INTERNAL_SSH_PASSWORD_FILE: passwordPath,
      },
    };
  }

  const askpassPath = join(directory, "askpass.sh");
  await writeFile(
    askpassPath,
    [
      "#!/bin/sh",
      'test -n "$MINIMAX_H3_SSH_PASSWORD_FILE" || exit 1',
      'cat -- "$MINIMAX_H3_SSH_PASSWORD_FILE"',
      "printf '\\n'",
      'rm -f -- "$MINIMAX_H3_SSH_PASSWORD_FILE"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  return {
    directory,
    path: askpassPath,
    environment: {
      MINIMAX_H3_SSH_PASSWORD_FILE: passwordPath,
    },
  };
}

export async function openSshTunnel({
  user,
  host,
  port = 22,
  password,
  resourceId,
  remoteHost = "127.0.0.1",
  remotePort = 8188,
  localHost = "127.0.0.1",
  localPort,
  connectTimeoutMs = 30_000,
  sshPath,
  knownHostsPath,
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  if (!user || !host || !password || !resourceId) {
    throw new Error("SSH 隧道缺少连接信息");
  }
  if (password.includes("\0") || password.includes("\n") || password.includes("\r")) {
    throw new Error("SSH 密码包含不支持的字符");
  }

  const selectedLocalPort = localPort ?? (await allocateLocalPort(localHost));
  const safeResourceId = resourceId.replace(/[^A-Za-z0-9._-]/g, "_");
  const selectedKnownHostsPath =
    knownHostsPath ??
    join(
      resolveUserStateDir({ env, home, platform }),
      "known-hosts",
      safeResourceId,
    );
  await mkdir(dirname(selectedKnownHostsPath), {
    recursive: true,
    mode: 0o700,
  });

  const askpass = await createAskpassContext({ password, env, platform });

  const args = buildSshTunnelArgs({
    user,
    host,
    port,
    localHost,
    localPort: selectedLocalPort,
    remoteHost,
    remotePort,
    knownHostsPath: selectedKnownHostsPath,
  });
  const child = spawn(sshPath ?? resolveSshPath({ env, platform }), args, {
    env: {
      ...env,
      ...askpass.environment,
      DISPLAY: env.DISPLAY || "minimax-h3-cloud",
      SSH_ASKPASS: askpass.path,
      SSH_ASKPASS_REQUIRE: "force",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  let spawnError;
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-16_384);
  });
  child.once("error", (error) => {
    spawnError = error;
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(platform === "win32" ? undefined : "SIGTERM");
      if (!(await waitForExit(child, 2_000))) {
        child.kill(platform === "win32" ? undefined : "SIGKILL");
        await waitForExit(child, 1_000);
      }
    }
    await rm(askpass.directory, { recursive: true, force: true });
  };

  try {
    const deadline = Date.now() + connectTimeoutMs;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(stderr.trim() || "SSH 隧道进程提前退出");
      }
      if (await canConnect(localHost, selectedLocalPort)) {
        return {
          url: `http://${localHost}:${selectedLocalPort}`,
          localHost,
          localPort: selectedLocalPort,
          remoteHost,
          remotePort,
          close,
        };
      }
      await delay(100);
    }
    throw new Error(stderr.trim() || "等待 SSH 隧道就绪超时");
  } catch (error) {
    await close();
    const tunnelError = new Error(`建立 SSH 隧道失败：${error.message}`);
    tunnelError.code = "SSH_TUNNEL_FAILED";
    tunnelError.cause = error;
    throw tunnelError;
  }
}
