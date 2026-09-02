import assert from "node:assert/strict";
import test from "node:test";
import { posix, win32 } from "node:path";
import {
  resolveUserConfigDir,
  resolveUserDataDir,
  resolveUserStateDir,
} from "../src/user-paths.mjs";

test("Windows paths follow APPDATA and LOCALAPPDATA", () => {
  const env = {
    APPDATA: "C:\\Users\\alice\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\alice\\AppData\\Local",
  };
  const options = {
    env,
    home: "C:\\Users\\alice",
    platform: "win32",
  };

  assert.equal(
    resolveUserConfigDir(options),
    win32.join(env.APPDATA, "minimax-h3-cloud"),
  );
  assert.equal(
    resolveUserDataDir(options),
    win32.join(env.LOCALAPPDATA, "minimax-h3-cloud"),
  );
  assert.equal(
    resolveUserStateDir(options),
    win32.join(env.LOCALAPPDATA, "minimax-h3-cloud", "state"),
  );
});

test("Windows paths have conventional fallbacks", () => {
  const options = {
    env: {},
    home: "C:\\Users\\alice",
    platform: "win32",
  };
  assert.equal(
    resolveUserConfigDir(options),
    "C:\\Users\\alice\\AppData\\Roaming\\minimax-h3-cloud",
  );
  assert.equal(
    resolveUserDataDir(options),
    "C:\\Users\\alice\\AppData\\Local\\minimax-h3-cloud",
  );
});

test("Windows XDG state override still receives an application directory", () => {
  assert.equal(
    resolveUserStateDir({
      env: { XDG_STATE_HOME: "D:\\State" },
      home: "C:\\Users\\alice",
      platform: "win32",
    }),
    "D:\\State\\minimax-h3-cloud",
  );
});

test("POSIX paths honor XDG roots", () => {
  const options = {
    env: {
      XDG_CONFIG_HOME: "/srv/config",
      XDG_DATA_HOME: "/srv/data",
      XDG_STATE_HOME: "/srv/state",
    },
    home: "/home/alice",
    platform: "linux",
  };
  assert.equal(
    resolveUserConfigDir(options),
    posix.join("/srv/config", "minimax-h3-cloud"),
  );
  assert.equal(
    resolveUserDataDir(options),
    posix.join("/srv/data", "minimax-h3-cloud"),
  );
  assert.equal(
    resolveUserStateDir(options),
    posix.join("/srv/state", "minimax-h3-cloud"),
  );
});
