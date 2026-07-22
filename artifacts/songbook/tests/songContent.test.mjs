import assert from "node:assert/strict";
import test from "node:test";

import { parseContent, serializeContent } from "../utils/songContent.ts";

test("round trips every structured block type", () => {
  const raw = [
    "[Verse]",
    "CHORD:Am  F  C  G/B  Mystery",
    "STRUM:D,-,DU,-,D,-,DU,-;REPEAT:2;CHORDS:Am@0,F@4;CYCLE:Am,G",
    "[Am]Words with [F]inline chords",
    "NOTE:Palm mute the first pass",
    "RIFF:e|--------|:B|--------|:G|--------|:D|--------|:A|0h02----|:E|--------|",
  ].join("\n");

  assert.equal(serializeContent(parseContent(raw)), raw);
});

test("normalizes legacy plain chord lines without losing chord order", () => {
  const result = serializeContent(parseContent("[Chorus]\nAm F C G\nSing it out"));
  assert.equal(result, "[Chorus]\nCHORD:Am  F  C  G\nSing it out");
});

test("migrates the legacy strum change marker", () => {
  const result = serializeContent(parseContent("[Intro]\nSTRUM:C,D,-,-,-,-,-,-"));
  assert.equal(result, "[Intro]\nSTRUM:-,D,-,-,-,-,-,-;CHORDS:?@0");
});
