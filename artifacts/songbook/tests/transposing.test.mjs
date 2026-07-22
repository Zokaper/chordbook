import assert from "node:assert/strict";
import test from "node:test";

import { capoLabel, transposeChord } from "../utils/transposing.ts";

test("transposes standard chord names while retaining their quality", () => {
  assert.equal(transposeChord("C", 4), "E");
  assert.equal(transposeChord("Am", 4), "C#m");
  assert.equal(transposeChord("Fmaj7", 4), "Amaj7");
});

test("transposes both sides of slash chords", () => {
  assert.equal(transposeChord("G/B", 4), "B/D#");
});

test("normalizes flat input to the chromatic sharp spelling", () => {
  assert.equal(transposeChord("Bb", 2), "C");
  assert.equal(transposeChord("Dbm7", 2), "D#m7");
});

test("leaves custom names and zero-semitone input unchanged", () => {
  assert.equal(transposeChord("Mystery", 4), "Mystery");
  assert.equal(transposeChord("Bb", 0), "Bb");
});

test("wraps transposition across octaves", () => {
  assert.equal(transposeChord("B", 1), "C");
  assert.equal(transposeChord("C", 13), "C#");
});

test("formats capo labels", () => {
  assert.equal(capoLabel(0), "");
  assert.equal(capoLabel(4), "Capo 4");
});
