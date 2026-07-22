import assert from "node:assert/strict";
import test from "node:test";

import { relativeTime } from "../utils/relativeTime.ts";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");

test("formats recent timestamps", () => {
  const originalNow = Date.now;
  Date.now = () => NOW;
  try {
    assert.equal(relativeTime("2026-07-22T11:59:30.000Z"), "just now");
    assert.equal(relativeTime("2026-07-22T11:45:00.000Z"), "15m ago");
    assert.equal(relativeTime("2026-07-22T09:00:00.000Z"), "3h ago");
    assert.equal(relativeTime("2026-07-21T12:00:00.000Z"), "yesterday");
    assert.equal(relativeTime("2026-07-19T12:00:00.000Z"), "3d ago");
  } finally {
    Date.now = originalNow;
  }
});

test("handles invalid and future timestamps defensively", () => {
  const originalNow = Date.now;
  Date.now = () => NOW;
  try {
    assert.equal(relativeTime("not-a-date"), "");
    assert.equal(relativeTime("2026-07-23T12:00:00.000Z"), "just now");
  } finally {
    Date.now = originalNow;
  }
});
