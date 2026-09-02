import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  environmentValue,
  findExecutableOnPath,
} from "./executable-paths.mjs";

const execFileAsync = promisify(execFile);

export class CompShareCliError extends Error {
  constructor(message, { code = "COMPSHARE_CLI_ERROR", details } = {}) {
    super(message);
    this.name = "CompShareCliError";
    this.code = code;
    this.details = details;
  }
}
function parseEnvelope(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(String(stdout).replace(/^\uFEFF/u, ""));
  } catch {
    throw new CompShareCliError("compshare-cli 没有返回有效 JSON", {
      code: "COMPSHARE_INVALID_JSON",
    });
  }

  if (!envelope?.ok) {
    throw new CompShareCliError(
      envelope?.error?.message ?? "compshare-cli 请求失败",
      {
        code: envelope?.error?.code ?? "COMPSHARE_API_ERROR",
        details: envelope?.error?.details,
      },
    );
  }

  return envelope.data;
}

export function resolveCompShareCliPath({
  env = process.env,
  platform = process.platform,
} = {}) {
  const override = environmentValue(env, "COMPSHARE_CLI_PATH")?.trim();
  if (override) return override;
  const command = platform === "win32" ? "compshare.exe" : "compshare";
  return findExecutableOnPath(command, { env, platform }) ?? command;
}

export function resolveCompShareAskpassPath({
  env = process.env,
  platform = process.platform,
} = {}) {
  const override = environmentValue(
    env,
    "MINIMAX_H3_SSH_ASKPASS_PATH",
  )?.trim();
  if (override) return override;

  const command =
    platform === "win32"
      ? "compshare-ssh-askpass.exe"
      : "compshare-ssh-askpass";
  const located = findExecutableOnPath(command, { env, platform });
  if (located) return located;

  const cliPath = resolveCompShareCliPath({ env, platform });
  if (/[\\/]/.test(cliPath)) {
    const sibling = join(dirname(cliPath), command);
    return findExecutableOnPath(sibling, { env, platform });
  }
  return undefined;
}

export async function runCompShareCli(
  args,
  {
    timeoutMs = 620_000,
    env = process.env,
    platform = process.platform,
    executable = resolveCompShareCliPath({ env, platform }),
    execFileImpl = execFileAsync,
  } = {},
) {
  try {
    const { stdout } = await execFileImpl(executable, args, {
      encoding: "utf8",
      env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: timeoutMs,
    });
    return parseEnvelope(stdout);
  } catch (error) {
    if (error instanceof CompShareCliError) throw error;

    if (typeof error?.stdout === "string" && error.stdout.trim()) {
      return parseEnvelope(error.stdout);
    }

    const missing = error?.code === "ENOENT";
    throw new CompShareCliError(
      missing
        ? `找不到 CompShare CLI：${executable}。请安装 compshare-cli 并确认其 Scripts/bin 目录已加入 PATH，或设置 COMPSHARE_CLI_PATH。`
        : error?.message ?? String(error),
      {
        code: missing ? "COMPSHARE_CLI_NOT_FOUND" : error?.code ?? "COMPSHARE_PROCESS_ERROR",
      },
    );
  }
}
