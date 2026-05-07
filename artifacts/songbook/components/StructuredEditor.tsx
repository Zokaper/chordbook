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
import React, { useEffect, useRef, useState } from "react";
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
export type StrumBeat = "-" | "D" | "U" | "DU" | "x";

type ChordLine = { id: string; type: "chord"; chords: string[] };
type LyricLine = { id: string; type: "lyric"; text: string };
type StrumLine = { id: string; type: "strum"; beats: StrumBeat[] };
type RiffLine  = { id: string; type: "riff";  grid: (number | null)[][]; numSlots: number };
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
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕",
};

const DEFAULT_BEATS: StrumBeat[] = ["-", "-", "-", "-", "-", "-", "-", "-"];
const DEFAULT_SLOTS = 8;
export const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];

function makeEmptyGrid(numSlots: number): (number | null)[][] {
  return STRING_NAMES.map(() => Array(numSlots).fill(null));
}

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => CHORD_RE.test(t));
}

// ─── RIFF serialise / parse ───────────────────────────────────────────────────
export function serializeRiff(grid: (number | null)[][], numSlots: number): string {
  return (
    "RIFF:" +
    grid
      .map((slots, i) => {
        const content = slots
          .slice(0, numSlots)
          .map((s) => (s === null ? "-" : s.toString()))
          .join("");
        return `${STRING_NAMES[i]}|${content}|`;
      })
      .join(":")
  );
}

function parseRiff(raw: string): { grid: (number | null)[][]; numSlots: number } {
  const payload = raw.startsWith("RIFF:") ? raw.slice(5) : raw;
  const parts = payload.split(":");
  let numSlots = DEFAULT_SLOTS;
  const grid: (number | null)[][] = STRING_NAMES.map(() => Array(numSlots).fill(null));

  parts.slice(0, 6).forEach((part, i) => {
    const inner = part.replace(/^[a-zA-Z]\|/, "").replace(/\|$/, "");
    const slots = [...inner].map((c) =>
      c === "-" ? null : /\d/.test(c) ? parseInt(c, 10) : null
    );
    numSlots = Math.max(numSlots, slots.length);
    grid[i] = slots;
  });

  grid.forEach((str, i) => {
    while (str.length < numSlots) str.push(null);
    grid[i] = str.slice(0, numSlots);
  });

  return { grid, numSlots };
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
      const payload = line.slice(6);
      const beats = payload.split(",").map((b) =>
        BEAT_CYCLE.includes(b as StrumBeat) ? (b as StrumBeat) : "-"
      ) as StrumBeat[];
      while (beats.length < 8) beats.push("-");
      current.lines.push({ id: genId(), type: "strum", beats: beats.slice(0, 8) });
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
          if (l.type === "strum") return l.beats.some((b) => b !== "-");
          if (l.type === "riff")  return l.grid.some((row) => row.some((c) => c !== null));
          return l.text.trim() !== "";
        })
        .map((l) => {
          if (l.type === "chord") return l.chords.join("  ");
          if (l.type === "strum") return `STRUM:${l.beats.join(",")}`;
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

  const isFirstRender = useRef(true);

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
          case "strum": newLine = { id: genId(), type: "strum", beats: [...DEFAULT_BEATS] }; break;
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
    strIdx: number, slotIdx: number, val: number | null
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

      {sections.map((section) => {
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

              {section.lines.map((line) => {
                const pickerOpen = chordPicker?.lineId === line.id;

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
                        <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
                      </View>

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
                          colors={colors}
                        />
                      )}
                    </View>
                  );
                }

                // ── Lyric line ──
                if (line.type === "lyric") {
                  return (
                    <View key={line.id} style={styles.lineRow}>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.lyricInput, { color: colors.foreground }]}
                          value={line.text}
                          onChangeText={(v) => updateText(section.id, line.id, v)}
                          placeholder="Lyrics… or [Am]chord over words"
                          placeholderTextColor={colors.mutedForeground}
                          multiline
                          blurOnSubmit={false}
                        />
                      </View>
                      <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
                    </View>
                  );
                }

                // ── Strum line ──
                if (line.type === "strum") {
                  return (
                    <View key={line.id} style={styles.lineRow}>
                      <View style={styles.strumRow}>
                        {line.beats.map((beat, bi) => (
                          <React.Fragment key={bi}>
                            {bi === 4 && (
                              <View style={[styles.strumBarDiv, { backgroundColor: colors.border }]} />
                            )}
                            <Pressable
                              onPress={() => updateBeat(section.id, line.id, bi, cycleBeat(beat))}
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
                      <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
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
                        <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
                      </View>
                    </View>
                  );
                }

                // ── Note line ──
                if (line.type === "note") {
                  return (
                    <View key={line.id} style={[styles.lineRow, styles.noteLineRow]}>
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
                      <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
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
  colors: ColorsLike;
}

function ChordPickerPanel({
  filter, onFilterChange, chordNames, hasLibrary,
  onSelect, onClose, onCreateNew, colors,
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
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});

// ─── RiffEditorGrid ────────────────────────────────────────────────────────────
interface RiffEditorGridProps {
  grid: (number | null)[][];
  numSlots: number;
  onCellChange: (strIdx: number, slotIdx: number, val: number | null) => void;
  onAddSlot: () => void;
  onRemoveSlot: () => void;
  colors: ColorsLike;
}

const FRET_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

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

  const handleFretPick = (fret: number) => {
    if (!selected) return;
    onCellChange(selected[0], selected[1], fret);
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
                  const hasFret = val !== null;
                  return (
                    <React.Fragment key={sli}>
                      {sli === 4 && (
                        <View style={[riffStyles.barDiv, { backgroundColor: `${colors.border}88` }]} />
                      )}
                      <Pressable
                        onPress={() => handleCellPress(si, sli)}
                        style={({ pressed }) => [
                          riffStyles.cell,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : hasFret
                              ? `${colors.primary}18`
                              : "transparent",
                            borderColor: isSelected
                              ? colors.primary
                              : hasFret
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
                                : hasFret
                                ? colors.primary
                                : `${colors.border}cc`,
                            },
                          ]}
                        >
                          {hasFret ? val!.toString() : "·"}
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

      {selected !== null && (
        <View style={riffStyles.picker}>
          {FRET_OPTIONS.map((f) => (
            <Pressable
              key={f}
              onPress={() => handleFretPick(f)}
              style={({ pressed }) => [
                riffStyles.fretBtn,
                { backgroundColor: pressed ? colors.primary : colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text style={[riffStyles.fretBtnText, { color: colors.foreground }]}>{f}</Text>
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
  picker: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 2, paddingLeft: 18 },
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
  card: string;
}

function LineDeleteBtn({ onPress, colors }: { onPress: () => void; colors: ColorsLike }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: pressed ? 0.4 : 0.5,
        paddingLeft: 4,
        alignSelf: "flex-start",
        paddingTop: 4,
      })}
    >
      <Feather name="x" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ChordChip({ chord, onPress, onLongPress, colors }: {
  chord: string; onPress: () => void; onLongPress: () => void; colors: ColorsLike;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.chordChip,
        {
          backgroundColor: pressed ? colors.primary : `${colors.primary}22`,
          borderColor: `${colors.primary}66`,
        },
      ]}
    >
      <Text style={[styles.chordChipText, { color: colors.primary }]}>{chord}</Text>
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
  chordChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  addChordBtn: {
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },

  lyricInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 6, lineHeight: 20 },

  strumRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  strumBarDiv: { width: 1.5, height: 28, borderRadius: 1, marginHorizontal: 2 },
  strumBeat: {
    width: 30, height: 34, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  strumBeatText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

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
