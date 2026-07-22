import assert from "node:assert/strict";
import test from "node:test";

import { migrateSongs } from "../utils/songMigration.ts";

test("migrates legacy tags and draft state without dropping unknown fields", () => {
  const { songs, changed } = migrateSongs([{
    id: "legacy",
    title: "Old arrangement",
    genre: "folk",
    experimentalField: { keep: true },
  }]);

  assert.equal(changed, true);
  assert.deepEqual(songs[0].tags, ["folk"]);
  assert.equal(songs[0].isDraft, false);
  assert.deepEqual(songs[0].experimentalField, { keep: true });
  assert.equal("genre" in songs[0], false);
});

test("keeps explicit draft state stable", () => {
  const { songs, changed } = migrateSongs([{ title: "Working", tags: [], isDraft: true }]);
  assert.equal(changed, false);
  assert.equal(songs[0].isDraft, true);
});
