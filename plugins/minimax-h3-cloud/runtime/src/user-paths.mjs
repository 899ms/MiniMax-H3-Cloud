import { homedir } from "node:os";
import { posix, win32 } from "node:path";

function pathApi(platform) {
  return platform === "win32" ? win32 : posix;
}

function configuredRoot(value, fallback, path) {
  return value?.trim() ? path.resolve(value) : fallback;
}

export function resolveUserConfigDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  const path = pathApi(platform);
  const fallback =
    platform === "win32"
      ? configuredRoot(env.APPDATA, path.join(home, "AppData", "Roaming"), path)
      : path.join(home, ".config");
  const root = configuredRoot(env.XDG_CONFIG_HOME, fallback, path);
  return path.join(root, "minimax-h3-cloud");
}

export function resolveUserDataDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  const path = pathApi(platform);
  const fallback =
    platform === "win32"
      ? configuredRoot(env.LOCALAPPDATA, path.join(home, "AppData", "Local"), path)
      : path.join(home, ".local", "share");
  const root = configuredRoot(env.XDG_DATA_HOME, fallback, path);
  return path.join(root, "minimax-h3-cloud");
}

export function resolveUserStateDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  const path = pathApi(platform);
  if (platform === "win32" && !env.XDG_STATE_HOME?.trim()) {
    return path.join(resolveUserDataDir({ env, home, platform }), "state");
  }
  const root = configuredRoot(
    env.XDG_STATE_HOME,
    path.join(home, ".local", "state"),
    path,
  );
  return path.join(root, "minimax-h3-cloud");
}

const currentPath = pathApi(process.platform);
export const defaultConfigPath = currentPath.join(
  resolveUserConfigDir(),
  "config.json",
);
export const defaultOutputDir = currentPath.join(resolveUserDataDir(), "outputs");
