import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { updateConfigResourceId } from "../src/config-store.mjs";

test("an existing config can be atomically replaced", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minimax-h3-config-"));
  const path = join(directory, "config.json");
  const config = {
    provider: { type: "compshare", credentialProfile: "h3", resourceId: "" },
  };
  try {
    await writeFile(path, `${JSON.stringify(config)}\n`, "utf8");
    const updated = await updateConfigResourceId(path, config, "resource-123");
    assert.equal(updated.provider.resourceId, "resource-123");
    assert.equal(
      JSON.parse(await readFile(path, "utf8")).provider.resourceId,
      "resource-123",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
