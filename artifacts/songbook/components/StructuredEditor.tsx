/**
 * StructuredEditor
 *
 * Section-based song editor with five line types:
 *   chord  — amber chips from chord library only; tap to pick/replace
 *   lyric  — plain text (supports ChordPro [Am]word notation)
 *   strum  — 8-beat tap grid (↓ ↑ ↕ ✕ —)
 *   riff   — 6-string visual fret grid (tap cell → pick fret 0-9)
 *   note   — italic annotation
 *
 * Serialisation: STRUM:D,U,-,...  |  NOTE:text  |  RIFF:e|...|:...:E|...|
 */
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useChords } from "@/context/ChordContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────
export type StrumBeat = "-" | "D" | "U" | "DU" | "x" | "C";

type ChordLine = { id: string; type: "chord"; chords: string[] };
type LyricLine = { id: string; type: "lyric"; text: string };
type StrumLine = { id: string; type: "strum"; beats: StrumBeat[]; repeat: number; chordChanges?: Record<number, string> };
type RiffLine  = { id: string; type: "riff";  grid: (number | string | null)[][]; numSlots: number };
type NoteLine  = { id: string; type: "note";  text: string };

type SongLine = ChordLine | LyricLine | StrumLine | RiffLine | NoteLine;
type Section  = { id: string; name: string; lines: SongLine[] };

type ChordPickerState = { sectionId: string; lineId: string; replaceIdx: number | null } | null;

// ─── Constants ────────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 7);

const CHORD_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

const TAB_LINE_RE = /^[eEADGBb]\|/;

const BEAT_CYCLE: StrumBeat[] = ["-", "D", "U", "DU", "x"];
const cycleBeat = (b: StrumBeat): StrumBeat =>
  BEAT_CYCLE[(BEAT_CYCLE.indexOf(b) + 1) % BEAT_CYCLE.length];

export const BEAT_SYMBOL: Record<StrumBeat, string> = {
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕", C: "↺",
};

const DEFAULT_BEATS: StrumBeat[] = ["-", "-", "-", "-", "-", "-", "-", "-"];
const DEFAULT_SLOTS = 8;
export const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];

function makeEmptyGrid(numSlots: number): (number | string | null)[][] {
  return STRING_NAMES.map(() => Array(numSlots).fill(null));
}

const ART_CHAR_SET = new Set(["h", "p", "/", "＼", "\\", "b", "~"]);
const normalizeArt = (ch: string) => ch === "\\" ? "＼" : ch;

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => CHORD_RE.test(t));
}

const REPEAT_CYCLE = [1, 2, 3, 4];

// ─── RIFF serialise / parse ───────────────────────────────────────────────────
export function serializeRiff(grid: (number | string | null)[][], numSlots: number): string {
  return (
    "RIFF:" +
    grid
      .map((slots, i) => {
        const content = slots
          .slice(0, numSlots)
          .map((v) => v === null ? "-" : typeof v === "number" ? v.toString() : v)
          .join("");
        return `${STRING_NAMES[i]}|${content}|`;
      })
      .join(":")
  );
}

function parseRiff(raw: string): { grid: (number | string | null)[][]; numSlots: number } {
  const payload = raw.startsWith("RIFF:") ? raw.slice(5) : raw;
  const parts = payload.split(":");
  const rows: (number | string | null)[][] = STRING_NAMES.map(() => []);

  parts.slice(0, 6).forEach((part, i) => {
    const inner = part.replace(/^[a-zA-Z]\|/, "").replace(/\|$/, "");
    if (inner.includes(",")) {
      // Legacy format "5h,7,-" — expand arts into their own slots
      inner.split(",").forEach((token) => {
        if (token === "-" || token === "") {
          rows[i].push(null);
        } else {
          const fret = /\d/.test(token[0]) ? parseInt(token[0], 10) : null;
          const art = token.length > 1 ? token[1] : null;
          if (fret !== null) rows[i].push(fret);
          if (art && ART_CHAR_SET.has(art)) rows[i].push(normalizeArt(art));
          if (fret === null && !art) rows[i].push(null);
        }
      });
    } else {
      // New format: each char is its own slot
      [...inner].forEach((ch) => {
        if (ch === "-") rows[i].push(null);
        else if (/\d/.test(ch)) rows[i].push(parseInt(ch, 10));
        else if (ART_CHAR_SET.has(ch)) rows[i].push(normalizeArt(ch));
        else rows[i].push(null);
      });
    }
  });

  const numSlots = Math.max(DEFAULT_SLOTS, ...rows.map((r) => r.length));
  rows.forEach((row, i) => {
    while (row.length < numSlots) row.push(null);
    rows[i] = row.slice(0, numSlots);
  });

  return { grid: rows, numSlots };
}

// ─── Parse / Serialize ────────────────────────────────────────────────────────
export function parseContent(raw: string): Section[] {
  const result: Section[] = [];
  let current: Section | null = null;

  for (const line of raw.split("\n")) {
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      current = { id: genId(), name: m[1], lines: [] };
      result.push(current);
      continue;
    }
    if (!line.trim()) continue;
    if (!current) {
      current = { id: genId(), name: "Verse", lines: [] };
      result.push(current);
    }

    if (line.startsWith("STRUM:")) {
      const [beatsPart, ...rest] = line.slice(6).split(";");
      const rawBeats = beatsPart.split(",").map((b) =>
        BEAT_CYCLE.includes(b as StrumBeat) || b === "C" ? (b as StrumBeat) : "-"
      ) as StrumBeat[];
      while (rawBeats.length < 8) rawBeats.push("-");

      // Build chordChanges: parse CHORDS: segment + migrate legacy "C" beats
      const chordChanges: Record<number, string> = {};
      const chordsSegment = rest.find((p) => p.startsWith("CHORDS:"));
      if (chordsSegment) {
        chordsSegment.slice(7).split(",").forEach((cc) => {
          const ai = cc.lastIndexOf("@");
          if (ai < 0) return;
          const name = cc.slice(0, ai);
          const beatIdx = parseInt(cc.slice(ai + 1), 10);
          if (!isNaN(beatIdx) && beatIdx >= 0 && name) chordChanges[beatIdx] = name;
        });
      }

      // Migrate "C" beats → chordChanges entry + replace with "-"
      const beats = rawBeats.map((b, bi) => {
        if (b === "C") {
          if (!chordChanges[bi]) chordChanges[bi] = "?";
          return "-" as StrumBeat;
        }
        return b;
      });

      const repeatStr = rest.find((p) => p.startsWith("REPEAT:"));
      const repeat = repeatStr ? Math.max(1, parseInt(repeatStr.slice(7), 10)) : 1;
      current.lines.push({
        id: genId(), type: "strum", beats, repeat,
        ...(Object.keys(chordChanges).length > 0 ? { chordChanges } : {}),
      });
    } else if (line.startsWith("CHORD:")) {
      current.lines.push({
        id: genId(),
        type: "chord",
        chords: line.slice(6).trim().split(/\s+/).filter(Boolean),
      });
    } else if (line.startsWith("NOTE:")) {
      current.lines.push({ id: genId(), type: "note", text: line.slice(5) });
    } else if (line.startsWith("RIFF:")) {
      const { grid, numSlots } = parseRiff(line);
      current.lines.push({ id: genId(), type: "riff", grid, numSlots });
    } else if (TAB_LINE_RE.test(line.trim())) {
      const inner = line.trim().replace(/^[eEADGBb]\|/, "").replace(/\|$/, "");
      const frets = [...inner].map((c) =>
        c === "-" ? null : /\d/.test(c) ? parseInt(c, 10) : null
      );
      const numSlots = Math.max(frets.length, DEFAULT_SLOTS);
      const grid = makeEmptyGrid(numSlots);
      frets.forEach((f, i) => { if (i < numSlots) grid[0][i] = f; });
      current.lines.push({ id: genId(), type: "riff", grid, numSlots });
    } else if (isChordLine(line)) {
      current.lines.push({
        id: genId(),
        type: "chord",
        chords: line.trim().split(/\s+/).filter(Boolean),
      });
    } else {
      current.lines.push({ id: genId(), type: "lyric", text: line });
    }
  }
  return result;
}

export function serializeContent(sections: Section[]): string {
  return sections
    .map((s) => {
      const lines = s.lines
        .filter((l) => {
          if (l.type === "chord") return l.chords.length > 0;
          if (l.type === "strum") return l.beats.some((b) => b !== "-") || (!!l.chordChanges && Object.keys(l.chordChanges).length > 0);
          if (l.type === "riff")  return l.grid.some((row) => row.some((c) => c !== null));
          return l.text.trim() !== "";
        })
        .map((l) => {
          if (l.type === "chord") return "CHORD:" + l.chords.join("  ");
          if (l.type === "strum") {
            let s = `STRUM:${l.beats.join(",")}`;
            if (l.repeat > 1) s += `;REPEAT:${l.repeat}`;
            if (l.chordChanges && Object.keys(l.chordChanges).length > 0) {
              const chordsStr = Object.entries(l.chordChanges)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([idx, name]) => `${name}@${idx}`)
                .join(",");
              s += `;CHORDS:${chordsStr}`;
            }
            return s;
          }
          if (l.type === "note")  return `NOTE:${l.text}`;
          if (l.type === "riff")  return serializeRiff(l.grid, l.numSlots);
          return l.text;
        });
      return [`[${s.name}]`, ...lines].join("\n");
    })
    .join("\n\n");
}

// ─── Presets ──────────────────────────────────────────────────────────────────
const SECTION_PRESETS = [
  "Intro", "Verse", "Pre-Chorus",
  "Chorus", "Bridge", "Outro", "Solo",
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  content: string;
  onChange: (content: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function StructuredEditor({ content, onChange }: Props) {
  const colors = useColors();
  const { chords: savedChords } = useChords();

  const [sections, setSections] = useState<Section[]>(() => parseContent(content));
  const [chordPicker, setChordPicker] = useState<ChordPickerState>(null);
  const [pickerFilter, setPickerFilter] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [strumChordPicker, setStrumChordPicker] = useState<{ lineId: string; beatIdx: number } | null>(null);

  const isFirstRender = useRef(true);
  // Lyric chord-palette state
  const [focusedLyricLine, setFocusedLyricLine] = useState<{ sectionId: string; lineId: string } | null>(null);
  const lyricCursorRef = useRef<Record<string, number>>({});
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange(serializeContent(sections));
  }, [sections]);

  // ── Section mutations ──────────────────────────────────────────────────────
  const addSection = (name: string) => {
    setSections((prev) => [...prev, { id: genId(), name, lines: [] }]);
    setShowSectionPicker(false);
  };
  const deleteSection = (id: string) =>
    setSections((prev) => prev.filter((s) => s.id !== id));
  const renameSection = (id: string, name: string) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));

  // ── Line mutations ─────────────────────────────────────────────────────────
  const addLine = (sectionId: string, type: SongLine["type"]) => {
    setChordPicker(null);
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        let newLine: SongLine;
        switch (type) {
          case "chord": newLine = { id: genId(), type: "chord", chords: [] }; break;
          case "strum": newLine = { id: genId(), type: "strum", beats: [...DEFAULT_BEATS], repeat: 1 }; break;
          case "riff":  newLine = { id: genId(), type: "riff", grid: makeEmptyGrid(DEFAULT_SLOTS), numSlots: DEFAULT_SLOTS }; break;
          case "note":  newLine = { id: genId(), type: "note", text: "" }; break;
          default:      newLine = { id: genId(), type: "lyric", text: "" };
        }
        return { ...s, lines: [...s.lines, newLine] };
      })
    );
    // Auto-open chord picker for new chord lines
    if (type === "chord") {
      // We'll open the picker after state settles; find the new line id via a ref trick
    }
  };

  const deleteLine = (sectionId: string, lineId: string) => {
    if (chordPicker?.lineId === lineId) setChordPicker(null);
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : { ...s, lines: s.lines.filter((l) => l.id !== lineId) }
      )
    );
  };

  const updateText = (sectionId: string, lineId: string, text: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          lines: s.lines.map((l) => (l.id === lineId ? { ...l, text } : l)),
        }
      )
    );

  const updateBeat = (sectionId: string, lineId: string, beatIdx: number, beat: StrumBeat) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "strum") return l;
            const beats = [...l.beats] as StrumBeat[];
            beats[beatIdx] = beat;
            return { ...l, beats };
          }),
        }
      )
    );

  const updateRiffCell = (
    sectionId: string, lineId: string,
    strIdx: number, slotIdx: number, val: number | string | null
  ) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "riff") return l;
            const grid = l.grid.map((row) => [...row]);
            grid[strIdx][slotIdx] = val;
            return { ...l, grid };
          }),
        };
      })
    );

  const changeRiffSlots = (sectionId: string, lineId: string, delta: 1 | -1) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "riff") return l;
            const next = l.numSlots + delta;
            if (next < 2 || next > 32) return l;
            const grid =
              delta === 1
                ? l.grid.map((row) => [...row, null])
                : l.grid.map((row) => row.slice(0, -1));
            return { ...l, grid, numSlots: next };
          }),
        };
      })
    );

  // ── Line reorder / duplicate mutations ─────────────────────────────────────
  const duplicateLine = (sectionId: string, lineId: string) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.lines.findIndex((l) => l.id === lineId);
        if (idx < 0) return s;
        const copy: SongLine = { ...s.lines[idx], id: genId() };
        const newLines = [...s.lines];
        newLines.splice(idx + 1, 0, copy);
        return { ...s, lines: newLines };
      })
    );

  const moveLine = (sectionId: string, lineId: string, dir: -1 | 1) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.lines.findIndex((l) => l.id === lineId);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= s.lines.length) return s;
        const newLines = [...s.lines];
        [newLines[idx], newLines[newIdx]] = [newLines[newIdx], newLines[idx]];
        return { ...s, lines: newLines };
      })
    );

  // ── Section reorder / duplicate mutations ──────────────────────────────────
  const duplicateSection = (id: string) =>
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const orig = prev[idx];
      const copy: Section = {
        ...orig,
        id: genId(),
        name: `${orig.name} (copy)`,
        lines: orig.lines.map((l) => ({ ...l, id: genId() })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const moveSection = (id: string, dir: -1 | 1) =>
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });

  // ── Chord picker mutations ─────────────────────────────────────────────────
  const openChordPicker = (sectionId: string, lineId: string, replaceIdx: number | null) => {
    setPickerFilter("");
    setChordPicker({ sectionId, lineId, replaceIdx });
  };

  const commitChordFromPicker = (chordName: string) => {
    if (!chordPicker) return;
    const { sectionId, lineId, replaceIdx } = chordPicker;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "chord") return l;
            const next = [...l.chords];
            if (replaceIdx === null) {
              next.push(chordName);
            } else {
              next[replaceIdx] = chordName;
            }
            return { ...l, chords: next };
          }),
        };
      })
    );
    setChordPicker(null);
    setPickerFilter("");
  };

  const addStrumBeat = (sectionId: string, lineId: string) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "strum") return l;
            return { ...l, beats: [...l.beats, "-"] };
          }),
        };
      })
    );

  const removeStrumBeat = (sectionId: string, lineId: string) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "strum") return l;
            if (l.beats.length <= 1) return l;
            const newLen = l.beats.length - 1;
            const chordChanges = l.chordChanges ? { ...l.chordChanges } : undefined;
            if (chordChanges) delete chordChanges[newLen];
            return { ...l, beats: l.beats.slice(0, -1), chordChanges };
          }),
        };
      })
    );

  const updateChordChange = (sectionId: string, lineId: string, beatIdx: number, chord: string | null) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "strum") return l;
            const cc = { ...(l.chordChanges ?? {}) };
            if (chord === null) { delete cc[beatIdx]; } else { cc[beatIdx] = chord; }
            return { ...l, chordChanges: Object.keys(cc).length > 0 ? cc : undefined };
          }),
        };
      })
    );

  const cycleRepeat = (sectionId: string, lineId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "strum") return l;
            const ri = REPEAT_CYCLE.indexOf(l.repeat);
            return { ...l, repeat: REPEAT_CYCLE[(ri + 1) % REPEAT_CYCLE.length] };
          }),
        };
      })
    );
  };

  const removeChordAtIdx = (sectionId: string, lineId: string, idx: number) => {
    if (chordPicker?.lineId === lineId) setChordPicker(null);
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "chord") return l;
            const next = [...l.chords];
            next.splice(idx, 1);
            return { ...l, chords: next };
          }),
        };
      })
    );
  };

  // ── Filtered library chords for picker ────────────────────────────────────
  const uniqueChordNames = Array.from(new Set(savedChords.map((c) => c.name)));
  const filteredPickerChords = pickerFilter.trim()
    ? uniqueChordNames.filter((n) => n.toLowerCase().includes(pickerFilter.toLowerCase()))
    : uniqueChordNames;

  // ── Chord names already used in this song (for lyric ChordPro palette) ────
  const songChordNames = useMemo(() => {
    const names = new Set<string>();
    sections.forEach((s) =>
      s.lines.forEach((l) => {
        if (l.type === "chord") l.chords.forEach((c) => { if (c) names.add(c); });
      })
    );
    return Array.from(names);
  }, [sections]);

  // ── Lyric focus / chord-insert helpers ───────────────────────────────────
  const handleLyricFocus = useCallback((sectionId: string, lineId: string) => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    setFocusedLyricLine({ sectionId, lineId });
  }, []);

  const handleLyricBlur = useCallback(() => {
    focusTimerRef.current = setTimeout(() => setFocusedLyricLine(null), 150);
  }, []);

  const handleLyricInsertChord = useCallback((sectionId: string, lineId: string, chordName: string) => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    const cursor = lyricCursorRef.current[lineId] ?? -1;
    const tag = `[${chordName}]`;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "lyric") return l;
            const t = l.text;
            const pos = cursor >= 0 && cursor <= t.length ? cursor : t.length;
            return { ...l, text: t.slice(0, pos) + tag + t.slice(pos) };
          }),
        };
      })
    );
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ gap: 14 }}>
      {sections.length === 0 && !showSectionPicker && (
        <View style={styles.emptyHint}>
          <Feather name="music" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Add a section to start building your song
          </Text>
        </View>
      )}

      {sections.map((section, sIdx) => {
        const isEditingName = editingSectionId === section.id;

        return (
          <View
            key={section.id}
            style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* ── Section header ── */}
            <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
              {isEditingName ? (
                <TextInput
                  style={[styles.sectionNameInput, { color: colors.foreground }]}
                  value={section.name}
                  onChangeText={(v) => renameSection(section.id, v)}
                  onBlur={() => setEditingSectionId(null)}
                  onSubmitEditing={() => setEditingSectionId(null)}
                  autoFocus
                  selectTextOnFocus
                />
              ) : (
                <Pressable onPress={() => setEditingSectionId(section.id)} style={{ flex: 1 }}>
                  <Text style={[styles.sectionName, { color: colors.primary }]}>
                    {section.name}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => moveSection(section.id, -1)}
                disabled={sIdx === 0}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: sIdx === 0 ? 0.2 : pressed ? 0.4 : 0.6 })}
              >
                <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => moveSection(section.id, 1)}
                disabled={sIdx === sections.length - 1}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: sIdx === sections.length - 1 ? 0.2 : pressed ? 0.4 : 0.6 })}
              >
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => duplicateSection(section.id)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.4 : 0.6 })}
              >
                <Feather name="copy" size={14} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => deleteSection(section.id)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Feather name="trash-2" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* ── Lines ── */}
            <View style={styles.linesContainer}>
              {section.lines.length === 0 && (
                <Text style={[styles.noLinesHint, { color: colors.mutedForeground }]}>
                  Add chords, lyrics, strumming, riffs, or notes below
                </Text>
              )}

              {section.lines.map((line, lIdx) => {
                const pickerOpen = chordPicker?.lineId === line.id;
                const isFirstLine = lIdx === 0;
                const isLastLine  = lIdx === section.lines.length - 1;

                // ── Chord line ──
                if (line.type === "chord") {
                  return (
                    <View key={line.id}>
                      <View style={styles.lineRow}>
                        <View style={styles.chordChips}>
                          {line.chords.map((chord, idx) => (
                            <ChordChip
                              key={`${line.id}-${idx}`}
                              chord={chord || "?"}
                              active={
                                chordPicker?.lineId === line.id &&
                                chordPicker?.replaceIdx === idx
                              }
                              onPress={() => openChordPicker(section.id, line.id, idx)}
                              onLongPress={() => removeChordAtIdx(section.id, line.id, idx)}
                              colors={colors}
                            />
                          ))}
                          <Pressable
                            onPress={() => openChordPicker(section.id, line.id, null)}
                            style={({ pressed }) => [
                              styles.addChordBtn,
                              { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                            ]}
                          >
                            <Feather name="plus" size={13} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                        <Pressable
                          onPress={() => setActiveMenu(activeMenu === line.id ? null : line.id)}
                          hitSlop={10}
                          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 0.65 })}
                        >
                          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {activeMenu === line.id && (
                        <LineActionBar
                          onMoveUp={isFirstLine ? undefined : () => { moveLine(section.id, line.id, -1); }}
                          onMoveDown={isLastLine ? undefined : () => { moveLine(section.id, line.id, 1); }}
                          onDuplicate={() => { duplicateLine(section.id, line.id); setActiveMenu(null); }}
                          onDelete={() => { deleteLine(section.id, line.id); setActiveMenu(null); }}
                          colors={colors}
                        />
                      )}

                      {/* ── Chord Picker Panel ── */}
                      {pickerOpen && (
                        <ChordPickerPanel
                          filter={pickerFilter}
                          onFilterChange={setPickerFilter}
                          chordNames={filteredPickerChords}
                          hasLibrary={savedChords.length > 0}
                          onSelect={commitChordFromPicker}
                          onClose={() => setChordPicker(null)}
                          onCreateNew={() => {
                            setChordPicker(null);
                            router.push("/chord-editor");
                          }}
                          onRemove={
                            chordPicker?.replaceIdx !== null && chordPicker?.replaceIdx !== undefined
                              ? () => {
                                  removeChordAtIdx(
                                    chordPicker.sectionId,
                                    chordPicker.lineId,
                                    chordPicker.replaceIdx!
                                  );
                                }
                              : undefined
                          }
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                // ── Lyric line ──
                if (line.type === "lyric") {
                  const lyricFocused =
                    focusedLyricLine?.lineId === line.id &&
                    focusedLyricLine?.sectionId === section.id;
                  return (
                    <View key={line.id}>
                      <View style={styles.lineRow}>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={[styles.lyricInput, { color: colors.foreground }]}
                            value={line.text}
                            onChangeText={(v) => updateText(section.id, line.id, v)}
                            placeholder="Lyrics… or [Am]chord over words"
                            placeholderTextColor={colors.mutedForeground}
                            multiline
                            blurOnSubmit={false}
                            onFocus={() => handleLyricFocus(section.id, line.id)}
                            onBlur={handleLyricBlur}
                            onSelectionChange={(e) => {
                              lyricCursorRef.current[line.id] = e.nativeEvent.selection.end;
                            }}
                          />
                        </View>
                        <Pressable
                          onPress={() => setActiveMenu(activeMenu === line.id ? null : line.id)}
                          hitSlop={10}
                          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 0.65 })}
                        >
                          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {activeMenu === line.id && (
                        <LineActionBar
                          onMoveUp={isFirstLine ? undefined : () => { moveLine(section.id, line.id, -1); }}
                          onMoveDown={isLastLine ? undefined : () => { moveLine(section.id, line.id, 1); }}
                          onDuplicate={() => { duplicateLine(section.id, line.id); setActiveMenu(null); }}
                          onDelete={() => { deleteLine(section.id, line.id); setActiveMenu(null); }}
                          colors={colors}
                        />
                      )}
                      {lyricFocused && songChordNames.length > 0 && (
                        <ChordProPalette
                          chordNames={songChordNames}
                          onInsert={(name) => handleLyricInsertChord(section.id, line.id, name)}
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                // ── Strum line ──
                if (line.type === "strum") {
                  const scPickerOpen =
                    strumChordPicker?.lineId === line.id;
                  return (
                    <View key={line.id}>
                      <View style={styles.lineRow}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="always"
                          style={{ flex: 1 }}
                        >
                          <View>
                            {/* ── Chord-change label row ── */}
                            <View style={styles.strumChordRow}>
                              {line.beats.map((_, bi) => {
                                const chord = line.chordChanges?.[bi];
                                const isActive = scPickerOpen && strumChordPicker?.beatIdx === bi;
                                return (
                                  <React.Fragment key={bi}>
                                    {bi > 0 && bi % 4 === 0 && (
                                      <View style={styles.strumBarDivSpacer} />
                                    )}
                                    <Pressable
                                      onPress={() => {
                                        if (isActive) {
                                          setStrumChordPicker(null);
                                        } else {
                                          setStrumChordPicker({ lineId: line.id, beatIdx: bi });
                                        }
                                      }}
                                      style={({ pressed }) => [
                                        styles.strumChordSlot,
                                        chord
                                          ? {
                                              backgroundColor: isActive
                                                ? colors.primary
                                                : `${colors.primary}18`,
                                              borderColor: isActive
                                                ? colors.primary
                                                : `${colors.primary}55`,
                                            }
                                          : {
                                              backgroundColor: "transparent",
                                              borderColor: pressed ? `${colors.primary}40` : "transparent",
                                            },
                                        { opacity: pressed ? 0.7 : 1 },
                                      ]}
                                    >
                                      {chord ? (
                                        <Text
                                          style={[
                                            styles.strumChordChipText,
                                            { color: isActive ? colors.primaryForeground : colors.primary },
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {chord}
                                        </Text>
                                      ) : (
                                        <Text style={[styles.strumChordDot, { color: `${colors.primary}30` }]}>
                                          ·
                                        </Text>
                                      )}
                                    </Pressable>
                                  </React.Fragment>
                                );
                              })}
                            </View>

                            {/* ── Beat row ── */}
                            <View style={styles.strumScrollContent}>
                              {line.beats.map((beat, bi) => (
                                <React.Fragment key={bi}>
                                  {bi > 0 && bi % 4 === 0 && (
                                    <View style={[styles.strumBarDiv, { backgroundColor: colors.border }]} />
                                  )}
                                  <Pressable
                                    onPress={() => { setStrumChordPicker(null); updateBeat(section.id, line.id, bi, cycleBeat(beat)); }}
                                    style={({ pressed }) => [
                                      styles.strumBeat,
                                      {
                                        backgroundColor:
                                          beat === "-" ? "transparent"
                                          : beat === "x" ? `${colors.destructive}22`
                                          : `${colors.primary}22`,
                                        borderColor:
                                          beat === "-" ? colors.border
                                          : beat === "x" ? colors.destructive
                                          : colors.primary,
                                        opacity: pressed ? 0.6 : 1,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.strumBeatText,
                                        {
                                          color:
                                            beat === "-" ? colors.mutedForeground
                                            : beat === "x" ? colors.destructive
                                            : colors.primary,
                                          opacity: beat === "-" ? 0.35 : 1,
                                        },
                                      ]}
                                    >
                                      {BEAT_SYMBOL[beat]}
                                    </Text>
                                  </Pressable>
                                </React.Fragment>
                              ))}
                            </View>
                          </View>
                        </ScrollView>
                        <Pressable
                          onPress={() => cycleRepeat(section.id, line.id)}
                          style={[styles.repeatBadge, { borderColor: line.repeat > 1 ? colors.primary : colors.border }]}
                        >
                          <Text style={[styles.repeatBadgeText, { color: line.repeat > 1 ? colors.primary : colors.mutedForeground }]}>
                            ×{line.repeat}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setStrumChordPicker(null); setActiveMenu(activeMenu === line.id ? null : line.id); }}
                          hitSlop={10}
                          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 0.65 })}
                        >
                          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      <View style={styles.strumBeatControls}>
                        <Pressable
                          onPress={() => removeStrumBeat(section.id, line.id)}
                          disabled={line.beats.length <= 1}
                          style={({ pressed }) => [styles.strumBeatBtn, { borderColor: colors.border, opacity: line.beats.length <= 1 ? 0.3 : pressed ? 0.5 : 0.8 }]}
                        >
                          <Feather name="minus" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.strumBeatBtnText, { color: colors.mutedForeground }]}>beat</Text>
                        </Pressable>
                        <Text style={[styles.strumBeatCount, { color: colors.mutedForeground }]}>
                          {line.beats.length} beats
                        </Text>
                        <Pressable
                          onPress={() => addStrumBeat(section.id, line.id)}
                          style={({ pressed }) => [styles.strumBeatBtn, { borderColor: colors.border, opacity: pressed ? 0.5 : 0.8 }]}
                        >
                          <Feather name="plus" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.strumBeatBtnText, { color: colors.mutedForeground }]}>beat</Text>
                        </Pressable>
                      </View>
                      {/* ── Inline chord-change picker ── */}
                      {scPickerOpen && (
                        <View style={[styles.strumChordPickerPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.strumChordPickerHeader}>
                            <Text style={[styles.strumChordPickerLabel, { color: colors.mutedForeground }]}>
                              Chord on beat {strumChordPicker!.beatIdx + 1}
                            </Text>
                            {line.chordChanges?.[strumChordPicker!.beatIdx] && (
                              <Pressable
                                onPress={() => {
                                  updateChordChange(section.id, line.id, strumChordPicker!.beatIdx, null);
                                  setStrumChordPicker(null);
                                }}
                                style={({ pressed }) => [styles.strumChordClearBtn, { borderColor: `${colors.destructive}55`, opacity: pressed ? 0.7 : 1 }]}
                              >
                                <Feather name="x" size={11} color={colors.destructive} />
                                <Text style={[styles.strumChordClearText, { color: colors.destructive }]}>Clear</Text>
                              </Pressable>
                            )}
                            <Pressable onPress={() => setStrumChordPicker(null)} hitSlop={8} style={{ marginLeft: "auto" }}>
                              <Feather name="x" size={14} color={colors.mutedForeground} />
                            </Pressable>
                          </View>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                            contentContainerStyle={styles.strumChordPickerChips}
                          >
                            {(songChordNames.length > 0 ? songChordNames : uniqueChordNames).map((name) => (
                              <Pressable
                                key={name}
                                onPress={() => {
                                  updateChordChange(section.id, line.id, strumChordPicker!.beatIdx, name);
                                  setStrumChordPicker(null);
                                }}
                                style={({ pressed }) => [
                                  styles.strumChordPickerChip,
                                  {
                                    backgroundColor: pressed ? colors.primary : `${colors.primary}18`,
                                    borderColor: `${colors.primary}55`,
                                  },
                                ]}
                              >
                                <Text style={[styles.strumChordPickerChipText, { color: colors.primary }]}>{name}</Text>
                              </Pressable>
                            ))}
                            {songChordNames.length === 0 && uniqueChordNames.length === 0 && (
                              <Text style={[styles.strumChordPickerEmpty, { color: colors.mutedForeground }]}>
                                Add chords to your song first
                              </Text>
                            )}
                          </ScrollView>
                        </View>
                      )}
                      {activeMenu === line.id && (
                        <LineActionBar
                          onMoveUp={isFirstLine ? undefined : () => { moveLine(section.id, line.id, -1); }}
                          onMoveDown={isLastLine ? undefined : () => { moveLine(section.id, line.id, 1); }}
                          onDuplicate={() => { duplicateLine(section.id, line.id); setActiveMenu(null); }}
                          onDelete={() => { deleteLine(section.id, line.id); setActiveMenu(null); }}
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                // ── Riff line ──
                if (line.type === "riff") {
                  return (
                    <View key={line.id}>
                      <View style={[styles.lineRow, { alignItems: "flex-start" }]}>
                        <RiffEditorGrid
                          grid={line.grid}
                          numSlots={line.numSlots}
                          onCellChange={(si, sli, val) =>
                            updateRiffCell(section.id, line.id, si, sli, val)
                          }
                          onAddSlot={() => changeRiffSlots(section.id, line.id, 1)}
                          onRemoveSlot={() => changeRiffSlots(section.id, line.id, -1)}
                          colors={colors}
                        />
                        <Pressable
                          onPress={() => setActiveMenu(activeMenu === line.id ? null : line.id)}
                          hitSlop={10}
                          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 0.65 })}
                        >
                          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {activeMenu === line.id && (
                        <LineActionBar
                          onMoveUp={isFirstLine ? undefined : () => { moveLine(section.id, line.id, -1); }}
                          onMoveDown={isLastLine ? undefined : () => { moveLine(section.id, line.id, 1); }}
                          onDuplicate={() => { duplicateLine(section.id, line.id); setActiveMenu(null); }}
                          onDelete={() => { deleteLine(section.id, line.id); setActiveMenu(null); }}
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                // ── Note line ──
                if (line.type === "note") {
                  return (
                    <View key={line.id}>
                      <View style={[styles.lineRow, styles.noteLineRow]}>
                        <Feather name="info" size={13} color={colors.mutedForeground} style={{ marginTop: 5 }} />
                        <TextInput
                          style={[styles.noteInput, { color: colors.mutedForeground }]}
                          value={line.text}
                          onChangeText={(v) => updateText(section.id, line.id, v)}
                          placeholder="capo 2, palm mute, swing feel…"
                          placeholderTextColor={`${colors.mutedForeground}66`}
                          multiline
                          blurOnSubmit={false}
                        />
                        <Pressable
                          onPress={() => setActiveMenu(activeMenu === line.id ? null : line.id)}
                          hitSlop={10}
                          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 0.65 })}
                        >
                          <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {activeMenu === line.id && (
                        <LineActionBar
                          onMoveUp={isFirstLine ? undefined : () => { moveLine(section.id, line.id, -1); }}
                          onMoveDown={isLastLine ? undefined : () => { moveLine(section.id, line.id, 1); }}
                          onDuplicate={() => { duplicateLine(section.id, line.id); setActiveMenu(null); }}
                          onDelete={() => { deleteLine(section.id, line.id); setActiveMenu(null); }}
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                return null;
              })}
            </View>

            {/* ── Add line row ── */}
            <View style={[styles.addLineRow, { borderTopColor: colors.border }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.addLineScroll}
              >
                {(
                  [
                    { type: "chord", icon: "music",      label: "Chords" },
                    { type: "lyric", icon: "align-left", label: "Lyrics" },
                    { type: "strum", icon: "activity",   label: "Strum"  },
                    { type: "riff",  icon: "sliders",    label: "Riff"   },
                    { type: "note",  icon: "info",       label: "Note"   },
                  ] as const
                ).map(({ type, icon, label }) => (
                  <Pressable
                    key={type}
                    onPress={() => addLine(section.id, type)}
                    style={({ pressed }) => [
                      styles.addLineBtn,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={icon as any}
                      size={11}
                      color={type === "chord" ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.addLineBtnText, { color: colors.foreground }]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        );
      })}

      {/* ── Add section ── */}
      {showSectionPicker ? (
        <View style={[styles.sectionPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionPickerTitle, { color: colors.mutedForeground }]}>
            Choose section type
          </Text>
          <View style={styles.sectionPickerGrid}>
            {SECTION_PRESETS.map((name) => (
              <Pressable
                key={name}
                onPress={() => addSection(name)}
                style={({ pressed }) => [
                  styles.sectionPresetBtn,
                  { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.sectionPresetText, { color: colors.foreground }]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setShowSectionPicker(false)} style={{ alignSelf: "center", padding: 8 }}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowSectionPicker(true)}
          style={({ pressed }) => [
            styles.addSectionBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="plus" size={16} color={colors.mutedForeground} />
          <Text style={[styles.addSectionText, { color: colors.mutedForeground }]}>Add section</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── ChordPickerPanel ──────────────────────────────────────────────────────────
interface ChordPickerPanelProps {
  filter: string;
  onFilterChange: (v: string) => void;
  chordNames: string[];
  hasLibrary: boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
  onRemove?: () => void;
  colors: ColorsLike;
}

function ChordPickerPanel({
  filter, onFilterChange, chordNames, hasLibrary,
  onSelect, onClose, onCreateNew, onRemove, colors,
}: ChordPickerPanelProps) {
  return (
    <View
      style={[
        pickerStyles.panel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {hasLibrary ? (
        <>
          <View
            style={[
              pickerStyles.filterRow,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={13} color={colors.mutedForeground} />
            <TextInput
              style={[pickerStyles.filterInput, { color: colors.foreground }]}
              value={filter}
              onChangeText={onFilterChange}
              placeholder="Search chords…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {filter.length > 0 && (
              <Pressable onPress={() => onFilterChange("")}>
                <Feather name="x" size={13} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={pickerStyles.chipRow}
          >
            {chordNames.length > 0 ? (
              chordNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => onSelect(name)}
                  style={({ pressed }) => [
                    pickerStyles.chip,
                    {
                      backgroundColor: pressed ? colors.primary : `${colors.primary}18`,
                      borderColor: `${colors.primary}55`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      pickerStyles.chipText,
                      { color: colors.primary, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={[pickerStyles.noMatch, { color: colors.mutedForeground }]}>
                No match in library
              </Text>
            )}
            <Pressable
              onPress={onCreateNew}
              style={({ pressed }) => [
                pickerStyles.chip,
                pickerStyles.newChordBtn,
                {
                  backgroundColor: pressed ? `${colors.primary}22` : "transparent",
                  borderColor: colors.border,
                  borderStyle: "dashed" as const,
                },
              ]}
            >
              <Feather name="plus" size={12} color={colors.mutedForeground} />
              <Text style={[pickerStyles.chipText, { color: colors.mutedForeground }]}>
                New chord
              </Text>
            </Pressable>
          </ScrollView>
        </>
      ) : (
        <View style={pickerStyles.emptyLibrary}>
          <Text style={[pickerStyles.emptyLibText, { color: colors.mutedForeground }]}>
            No chords in your library yet.
          </Text>
          <Pressable
            onPress={onCreateNew}
            style={({ pressed }) => [
              pickerStyles.goCreateBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[pickerStyles.goCreateText, { color: colors.primaryForeground }]}>
              Create first chord
            </Text>
          </Pressable>
        </View>
      )}
      {onRemove && (
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => [
            pickerStyles.removeBtn,
            { borderColor: `${colors.destructive}55`, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trash-2" size={13} color={colors.destructive} />
          <Text style={[pickerStyles.removeBtnText, { color: colors.destructive }]}>
            Remove chord
          </Text>
        </Pressable>
      )}
      <Pressable onPress={onClose} style={pickerStyles.closeBtn} hitSlop={8}>
        <Feather name="x" size={14} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
    padding: 10,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  filterInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  chipRow: {
    gap: 6,
    paddingVertical: 2,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
  },
  newChordBtn: {},
  noMatch: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
  },
  emptyLibrary: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  emptyLibText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  goCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goCreateText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
  },
  removeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});

// ─── ChordProPalette ──────────────────────────────────────────────────────────
interface ChordProPaletteProps {
  chordNames: string[];
  onInsert: (name: string) => void;
  colors: ColorsLike;
}

function ChordProPalette({ chordNames, onInsert, colors }: ChordProPaletteProps) {
  return (
    <View style={[paletteStyles.wrapper, { borderColor: `${colors.primary}33`, backgroundColor: `${colors.primary}07` }]}>
      <Text style={[paletteStyles.label, { color: `${colors.primary}99` }]}>Insert chord</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={paletteStyles.row}
      >
        {chordNames.map((name) => (
          <Pressable
            key={name}
            onPress={() => onInsert(name)}
            style={({ pressed }) => [
              paletteStyles.chip,
              {
                backgroundColor: pressed ? colors.primary : `${colors.primary}18`,
                borderColor: `${colors.primary}55`,
              },
            ]}
          >
            <Text style={[paletteStyles.chipText, { color: colors.primary }]}>
              [{name}]
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const paletteStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 6,
    gap: 6,
    marginTop: 2,
    paddingLeft: 2,
  },
  label: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flexShrink: 0,
    paddingLeft: 4,
  },
  row: { gap: 5, alignItems: "center" },
  chip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});

// ─── RiffEditorGrid ────────────────────────────────────────────────────────────
interface RiffEditorGridProps {
  grid: (number | string | null)[][];
  numSlots: number;
  onCellChange: (strIdx: number, slotIdx: number, val: number | string | null) => void;
  onAddSlot: () => void;
  onRemoveSlot: () => void;
  colors: ColorsLike;
}

const FRET_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ART_OPTIONS  = ["h", "p", "/", "＼", "b", "~"] as const;

function RiffEditorGrid({
  grid, numSlots, onCellChange, onAddSlot, onRemoveSlot, colors,
}: RiffEditorGridProps) {
  const [selected, setSelected] = useState<[number, number] | null>(null);

  const handleCellPress = (si: number, sli: number) => {
    if (selected && selected[0] === si && selected[1] === sli) {
      setSelected(null);
    } else {
      setSelected([si, sli]);
    }
  };

  const handleCellLongPress = (si: number, sli: number) => {
    onCellChange(si, sli, null);
    setSelected(null);
  };

  const handlePick = (val: number | string) => {
    if (!selected) return;
    onCellChange(selected[0], selected[1], val);
    setSelected(null);
  };

  const handleClear = () => {
    if (!selected) return;
    onCellChange(selected[0], selected[1], null);
    setSelected(null);
  };

  const selSi  = selected?.[0] ?? -1;
  const selSli = selected?.[1] ?? -1;

  return (
    <View style={riffStyles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={riffStyles.grid}>
          {STRING_NAMES.map((name, si) => (
            <View key={si} style={riffStyles.stringRow}>
              <Text style={[riffStyles.strLabel, { color: colors.mutedForeground }]}>
                {name}
              </Text>
              <View style={riffStyles.slots}>
                {Array.from({ length: numSlots }, (_, sli) => {
                  const val = grid[si]?.[sli] ?? null;
                  const isSelected = selSi === si && selSli === sli;
                  const hasValue = val !== null;
                  const isArt = typeof val === "string";
                  return (
                    <React.Fragment key={sli}>
                      {sli === 4 && (
                        <View style={[riffStyles.barDiv, { backgroundColor: `${colors.border}88` }]} />
                      )}
                      <Pressable
                        onPress={() => handleCellPress(si, sli)}
                        onLongPress={() => handleCellLongPress(si, sli)}
                        style={({ pressed }) => [
                          riffStyles.cell,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : hasValue
                              ? `${colors.primary}18`
                              : "transparent",
                            borderColor: isSelected
                              ? colors.primary
                              : hasValue
                              ? `${colors.primary}55`
                              : `${colors.border}88`,
                            opacity: pressed && !isSelected ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            riffStyles.cellText,
                            {
                              color: isSelected
                                ? colors.primaryForeground
                                : isArt
                                ? colors.accent
                                : hasValue
                                ? colors.primary
                                : `${colors.border}cc`,
                            },
                          ]}
                        >
                          {hasValue ? (typeof val === "number" ? val.toString() : val) : "·"}
                        </Text>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Combined picker: frets + arts */}
      {selected !== null && (
        <View style={riffStyles.picker}>
          {FRET_OPTIONS.map((f) => (
            <Pressable
              key={f}
              onPress={() => handlePick(f)}
              style={({ pressed }) => [
                riffStyles.fretBtn,
                { backgroundColor: pressed ? colors.primary : colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text style={[riffStyles.fretBtnText, { color: colors.foreground }]}>{f}</Text>
            </Pressable>
          ))}
          <View style={[riffStyles.pickerDiv, { backgroundColor: colors.border }]} />
          {ART_OPTIONS.map((a) => (
            <Pressable
              key={a}
              onPress={() => handlePick(a)}
              style={({ pressed }) => [
                riffStyles.fretBtn,
                {
                  backgroundColor: pressed ? colors.primary : `${colors.primary}12`,
                  borderColor: `${colors.primary}40`,
                },
              ]}
            >
              <Text style={[riffStyles.fretBtnText, { color: colors.accent }]}>{a}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              riffStyles.fretBtn,
              {
                backgroundColor: pressed ? colors.destructive : `${colors.destructive}15`,
                borderColor: `${colors.destructive}55`,
              },
            ]}
          >
            <Feather name="x" size={13} color={colors.destructive} />
          </Pressable>
        </View>
      )}

      <View style={riffStyles.slotControls}>
        <Pressable
          onPress={onRemoveSlot}
          style={({ pressed }) => [riffStyles.slotBtn, { borderColor: colors.border, opacity: pressed ? 0.5 : 0.8 }]}
        >
          <Feather name="minus" size={11} color={colors.mutedForeground} />
          <Text style={[riffStyles.slotBtnText, { color: colors.mutedForeground }]}>beat</Text>
        </Pressable>
        <Pressable
          onPress={onAddSlot}
          style={({ pressed }) => [riffStyles.slotBtn, { borderColor: colors.border, opacity: pressed ? 0.5 : 0.8 }]}
        >
          <Feather name="plus" size={11} color={colors.mutedForeground} />
          <Text style={[riffStyles.slotBtnText, { color: colors.mutedForeground }]}>beat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const riffStyles = StyleSheet.create({
  root: { flex: 1, gap: 6, paddingVertical: 4 },
  grid: { gap: 3 },
  stringRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  strLabel: { width: 14, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right", opacity: 0.7 },
  slots: { flexDirection: "row", alignItems: "center", gap: 2 },
  barDiv: { width: 1.5, height: 22, borderRadius: 1, marginHorizontal: 1 },
  cell: {
    width: 24, height: 24, borderRadius: 5, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cellText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  picker: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingTop: 2, paddingLeft: 18 },
  pickerDiv: { width: 1, height: 24, opacity: 0.4, marginHorizontal: 2 },
  fretBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  fretBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  slotControls: { flexDirection: "row", gap: 6, paddingLeft: 18, paddingTop: 2 },
  slotBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4,
  },
  slotBtnText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

// ─── Other sub-components ──────────────────────────────────────────────────────
interface ColorsLike {
  primary: string; primaryForeground: string; secondary: string;
  foreground: string; mutedForeground: string; border: string; destructive: string;
  card: string; accent: string;
}

function LineActionBar({
  onMoveUp, onMoveDown, onDuplicate, onDelete, colors,
}: {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  colors: ColorsLike;
}) {
  return (
    <View style={[lineBarStyles.bar, { borderTopColor: colors.border }]}>
      <Pressable
        onPress={onMoveUp}
        disabled={!onMoveUp}
        style={({ pressed }) => [lineBarStyles.action, { opacity: onMoveUp ? (pressed ? 0.6 : 1) : 0.28 }]}
      >
        <Feather name="chevron-up" size={17} color={onMoveUp ? colors.foreground : colors.mutedForeground} />
        <Text style={[lineBarStyles.label, { color: onMoveUp ? colors.foreground : colors.mutedForeground }]}>Up</Text>
      </Pressable>
      <Pressable
        onPress={onMoveDown}
        disabled={!onMoveDown}
        style={({ pressed }) => [lineBarStyles.action, { opacity: onMoveDown ? (pressed ? 0.6 : 1) : 0.28 }]}
      >
        <Feather name="chevron-down" size={17} color={onMoveDown ? colors.foreground : colors.mutedForeground} />
        <Text style={[lineBarStyles.label, { color: onMoveDown ? colors.foreground : colors.mutedForeground }]}>Down</Text>
      </Pressable>
      <View style={[lineBarStyles.sep, { backgroundColor: colors.border }]} />
      <Pressable
        onPress={onDuplicate}
        style={({ pressed }) => [lineBarStyles.action, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="copy" size={17} color={colors.primary} />
        <Text style={[lineBarStyles.label, { color: colors.primary }]}>Duplicate</Text>
      </Pressable>
      <View style={[lineBarStyles.sep, { backgroundColor: colors.border }]} />
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [lineBarStyles.action, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="trash-2" size={17} color={colors.destructive} />
        <Text style={[lineBarStyles.label, { color: colors.destructive }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

const lineBarStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  action: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.2,
  },
  sep: {
    width: 1,
    height: 26,
    opacity: 0.4,
  },
});

function ChordChip({ chord, active, onPress, onLongPress, colors }: {
  chord: string; active?: boolean; onPress: () => void; onLongPress: () => void; colors: ColorsLike;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.chordChip,
        active && styles.chordChipActive,
        {
          backgroundColor: active
            ? colors.primary
            : pressed ? colors.primary : `${colors.primary}22`,
          borderColor: active ? colors.primary : `${colors.primary}66`,
          transform: [{ scale: pressed ? 0.93 : 1 }],
        },
      ]}
    >
      <Text
        style={[
          styles.chordChipText,
          { color: active ? colors.primaryForeground : colors.primary },
        ]}
      >
        {chord}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  emptyHint: { alignItems: "center", gap: 10, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, gap: 8,
  },
  sectionName: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  sectionNameInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_700Bold",
    letterSpacing: 0.5, textTransform: "uppercase", paddingVertical: 0,
  },

  linesContainer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 6 },
  noLinesHint: { fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 8, textAlign: "center", opacity: 0.7 },

  lineRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },

  chordChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chordChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  chordChipActive: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 },
  chordChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  addChordBtn: {
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },

  lyricInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 6, lineHeight: 20 },

  strumRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  strumScrollContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  strumChordRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 3 },
  strumChordSlot: {
    width: 30, height: 22, borderRadius: 6, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  strumChordChipText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  strumChordDot: { fontSize: 14, lineHeight: 16 },
  strumBarDivSpacer: { width: 5.5, height: 22 },
  strumBarDiv: { width: 1.5, height: 28, borderRadius: 1, marginHorizontal: 2 },
  strumChordPickerPanel: {
    borderRadius: 10, borderWidth: 1, padding: 10, gap: 8, marginTop: 2,
  },
  strumChordPickerHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  strumChordPickerLabel: {
    fontSize: 11, fontFamily: "Inter_500Medium", flexShrink: 1,
  },
  strumChordClearBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  strumChordClearText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  strumChordPickerChips: { gap: 6, alignItems: "center" as const, paddingVertical: 2 },
  strumChordPickerChip: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  strumChordPickerChipText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  strumChordPickerEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", opacity: 0.6, paddingHorizontal: 4 },
  strumBeatControls: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingLeft: 2, paddingTop: 2, paddingBottom: 2,
  },
  strumBeatBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4,
  },
  strumBeatBtnText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  strumBeatCount: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.6 },
  strumBeat: {
    width: 30, height: 34, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  strumBeatText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  repeatBadge: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4, marginLeft: 2 },
  repeatBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  noteLineRow: { alignItems: "flex-start", gap: 6 },
  noteInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    fontStyle: "italic", paddingVertical: 4, lineHeight: 18,
  },

  addLineRow: { borderTopWidth: 1 },
  addLineScroll: { paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  addLineBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  addLineBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  addSectionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed",
  },
  addSectionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionPicker: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionPickerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  sectionPickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionPresetBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  sectionPresetText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  cancelText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
