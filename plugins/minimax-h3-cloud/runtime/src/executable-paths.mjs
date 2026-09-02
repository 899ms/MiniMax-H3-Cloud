import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";

export function environmentValue(env, name) {
  if (env[name] !== undefined) return env[name];
  const matchedKey = Object.keys(env).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return matchedKey ? env[matchedKey] : undefined;
}

export function findExecutableOnPath(
  command,
  { env = process.env, platform = process.platform } = {},
) {
  if (!command?.trim()) return undefined;
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    return existsSync(command) ? command : undefined;
  }

  const pathValue = environmentValue(env, "PATH");
  if (!pathValue) return undefined;
  const suffixes =
    platform === "win32" && !extname(command)
      ? (environmentValue(env, "PATHEXT") || ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter(Boolean)
      : [""];

  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = join(directory.replace(/^"|"$/g, ""), `${command}${suffix}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
