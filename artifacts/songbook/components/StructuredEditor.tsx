/**
 * StructuredEditor
 *
 * Section-based song editor with five line types:
 *   chord  — amber chips, tap to edit inline with saved-chord suggestions
 *   lyric  — plain text rows
 *   strum  — 8-beat tap grid (↓ ↑ ↕ ✕ —)
 *   riff   — monospace tab-style text input (serialises as plain tab text)
 *   note   — italic annotation (capo, feel, technique hints)
 *
 * Serialises to / parses from the plain-text format ChordViewer understands.
 * New prefixes: STRUM:D,U,-,DU,x,...  and  NOTE:text
 */
import { Feather } from "@expo/vector-icons";
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
type RiffLine  = { id: string; type: "riff";  text: string };
type NoteLine  = { id: string; type: "note";  text: string };

type SongLine = ChordLine | LyricLine | StrumLine | RiffLine | NoteLine;
type Section  = { id: string; name: string; lines: SongLine[] };

type EditingChord = { sectionId: string; lineId: string; idx: number; value: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 7);

const CHORD_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

const TAB_LINE_RE = /^[eEADGBb]\|/;

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => CHORD_RE.test(t));
}

const BEAT_CYCLE: StrumBeat[] = ["-", "D", "U", "DU", "x"];
const cycleBeat = (b: StrumBeat): StrumBeat =>
  BEAT_CYCLE[(BEAT_CYCLE.indexOf(b) + 1) % BEAT_CYCLE.length];

const BEAT_SYMBOL: Record<StrumBeat, string> = {
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕",
};

const DEFAULT_BEATS: StrumBeat[] = ["-", "-", "-", "-", "-", "-", "-", "-"];

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
      current = { id: genId(), name: "Verse 1", lines: [] };
      result.push(current);
    }

    if (line.startsWith("STRUM:")) {
      const raw = line.slice(6);
      const beats = raw.split(",").map((b) =>
        BEAT_CYCLE.includes(b as StrumBeat) ? (b as StrumBeat) : "-"
      ) as StrumBeat[];
      // Pad or trim to 8
      while (beats.length < 8) beats.push("-");
      current.lines.push({ id: genId(), type: "strum", beats: beats.slice(0, 8) });
    } else if (line.startsWith("NOTE:")) {
      current.lines.push({ id: genId(), type: "note", text: line.slice(5) });
    } else if (TAB_LINE_RE.test(line.trim())) {
      current.lines.push({ id: genId(), type: "riff", text: line });
    } else if (isChordLine(line)) {
      current.lines.push({
        id: genId(), type: "chord",
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
          return l.text.trim() !== "";
        })
        .map((l) => {
          if (l.type === "chord") return l.chords.join("  ");
          if (l.type === "strum") return `STRUM:${l.beats.join(",")}`;
          if (l.type === "note")  return `NOTE:${l.text}`;
          return l.text; // lyric, riff
        });
      return [`[${s.name}]`, ...lines].join("\n");
    })
    .join("\n\n");
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTION_PRESETS = [
  "Intro", "Verse 1", "Verse 2", "Pre-Chorus",
  "Chorus", "Bridge", "Outro", "Solo",
];

const FALLBACK_CHORDS = [
  "Am", "Em", "G", "C", "D", "F", "Dm", "E", "A", "Bm", "B",
  "F#m", "D7", "G7", "Am7", "Cmaj7",
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
  const [editingChord, setEditingChord] = useState<EditingChord | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  const isFirstRender = useRef(true);
  const suggestionSelectedRef = useRef(false);

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
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));

  // ── Line mutations ─────────────────────────────────────────────────────────
  const addLine = (sectionId: string, type: SongLine["type"]) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        let newLine: SongLine;
        switch (type) {
          case "chord": newLine = { id: genId(), type: "chord", chords: [] }; break;
          case "strum": newLine = { id: genId(), type: "strum", beats: [...DEFAULT_BEATS] }; break;
          case "riff":  newLine = { id: genId(), type: "riff",  text: "e|--|" }; break;
          case "note":  newLine = { id: genId(), type: "note",  text: "" }; break;
          default:      newLine = { id: genId(), type: "lyric", text: "" };
        }
        return { ...s, lines: [...s.lines, newLine] };
      })
    );
  };

  const deleteLine = (sectionId: string, lineId: string) => {
    if (editingChord?.lineId === lineId) setEditingChord(null);
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
          lines: s.lines.map((l) => l.id === lineId ? { ...l, text } : l),
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

  // ── Chord chip mutations ───────────────────────────────────────────────────
  const applyChordEdit = (sectionId: string, lineId: string, idx: number, value: string) => {
    const trimmed = value.trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "chord") return l;
            const next = [...l.chords];
            if (trimmed === "") next.splice(idx, 1);
            else next[idx] = trimmed;
            return { ...l, chords: next };
          }),
        };
      })
    );
    setEditingChord(null);
  };

  const deleteChord = (sectionId: string, lineId: string, idx: number) => {
    if (editingChord?.idx === idx && editingChord?.lineId === lineId) setEditingChord(null);
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

  const startAddChord = (sectionId: string, lineId: string) => {
    if (editingChord) {
      applyChordEdit(editingChord.sectionId, editingChord.lineId, editingChord.idx, editingChord.value);
    }
    setSections((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "chord") return l;
            return { ...l, chords: [...l.chords, ""] };
          }),
        };
      });
      const sec = updated.find((s) => s.id === sectionId);
      const line = sec?.lines.find((l) => l.id === lineId);
      if (line && line.type === "chord") {
        setEditingChord({ sectionId, lineId, idx: line.chords.length - 1, value: "" });
      }
      return updated;
    });
  };

  const suggestChord = (chord: string) => {
    if (!editingChord) return;
    setEditingChord({ ...editingChord, value: chord });
    applyChordEdit(editingChord.sectionId, editingChord.lineId, editingChord.idx, chord);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const suggestions = savedChords.length > 0
    ? savedChords.map((c) => c.name)
    : FALLBACK_CHORDS;

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
        const activeLine = editingChord?.sectionId === section.id ? editingChord.lineId : null;

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
                  Add chord lines, lyrics, strumming, riffs, or notes below
                </Text>
              )}

              {section.lines.map((line) => {
                // ── Chord line ──
                if (line.type === "chord") {
                  const isActiveChordLine = activeLine === line.id;
                  return (
                    <View key={line.id}>
                      <View style={styles.lineRow}>
                        <View style={styles.chordChips}>
                          {line.chords.map((chord, idx) => {
                            const isEditing =
                              editingChord?.lineId === line.id && editingChord.idx === idx;
                            return isEditing ? (
                              <ChordEditInput
                                key={`${line.id}-${idx}`}
                                value={editingChord.value}
                                onChange={(v) => setEditingChord({ ...editingChord, value: v })}
                                onBlur={() => {
                                  if (suggestionSelectedRef.current) {
                                    suggestionSelectedRef.current = false;
                                    return;
                                  }
                                  applyChordEdit(section.id, line.id, idx, editingChord.value);
                                }}
                                onCommit={() => applyChordEdit(section.id, line.id, idx, editingChord.value)}
                                onDelete={() => deleteChord(section.id, line.id, idx)}
                                colors={colors}
                              />
                            ) : (
                              <ChordChip
                                key={`${line.id}-${idx}`}
                                chord={chord || "?"}
                                onPress={() => setEditingChord({ sectionId: section.id, lineId: line.id, idx, value: chord })}
                                onLongPress={() => deleteChord(section.id, line.id, idx)}
                                colors={colors}
                              />
                            );
                          })}
                          <Pressable
                            onPress={() => startAddChord(section.id, line.id)}
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

                      {/* Suggestion row */}
                      {isActiveChordLine && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="always"
                          style={styles.suggestScroll}
                          contentContainerStyle={styles.suggestList}
                        >
                          {suggestions.map((name) => (
                            <Pressable
                              key={name}
                              onPressIn={() => {
                                suggestionSelectedRef.current = true;
                                suggestChord(name);
                              }}
                              style={({ pressed }) => [
                                styles.suggestChip,
                                {
                                  backgroundColor: pressed ? colors.primary : colors.secondary,
                                  borderColor: colors.border,
                                },
                              ]}
                            >
                              <Text style={[styles.suggestText, { color: colors.foreground }]}>
                                {name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  );
                }

                // ── Lyric line ──
                if (line.type === "lyric") {
                  return (
                    <View key={line.id} style={styles.lineRow}>
                      <TextInput
                        style={[styles.lyricInput, { color: colors.foreground }]}
                        value={line.text}
                        onChangeText={(v) => updateText(section.id, line.id, v)}
                        placeholder="Lyrics…"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        blurOnSubmit={false}
                      />
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
                                  backgroundColor: beat === "-"
                                    ? "transparent"
                                    : beat === "x"
                                    ? `${colors.destructive}22`
                                    : `${colors.primary}22`,
                                  borderColor: beat === "-"
                                    ? colors.border
                                    : beat === "x"
                                    ? colors.destructive
                                    : colors.primary,
                                  opacity: pressed ? 0.6 : 1,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.strumBeatText,
                                  {
                                    color: beat === "-"
                                      ? colors.mutedForeground
                                      : beat === "x"
                                      ? colors.destructive
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
                    <View key={line.id} style={styles.lineRow}>
                      <TextInput
                        style={[styles.riffInput, { color: colors.primary, borderColor: `${colors.primary}44` }]}
                        value={line.text}
                        onChangeText={(v) => updateText(section.id, line.id, v)}
                        placeholder="e|--0--2--3--|"
                        placeholderTextColor={`${colors.primary}55`}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        multiline
                        blurOnSubmit={false}
                      />
                      <LineDeleteBtn onPress={() => deleteLine(section.id, line.id)} colors={colors} />
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
                    { type: "chord", icon: "music",    label: "Chords" },
                    { type: "lyric", icon: "align-left",label: "Lyrics" },
                    { type: "strum", icon: "activity",  label: "Strum"  },
                    { type: "riff",  icon: "code",      label: "Riff"   },
                    { type: "note",  icon: "info",      label: "Note"   },
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

// ─── Sub-components ────────────────────────────────────────────────────────────

interface ColorsLike {
  primary: string; primaryForeground: string; secondary: string;
  foreground: string; mutedForeground: string; border: string; destructive: string;
}

function LineDeleteBtn({ onPress, colors }: { onPress: () => void; colors: ColorsLike }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.4 : 0.5, paddingLeft: 6, alignSelf: "flex-start", paddingTop: 4 })}
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

function ChordEditInput({ value, onChange, onBlur, onCommit, onDelete, colors }: {
  value: string; onChange: (v: string) => void;
  onBlur: () => void; onCommit: () => void; onDelete: () => void; colors: ColorsLike;
}) {
  return (
    <View style={[styles.chordEditWrap, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <TextInput
        style={[styles.chordEditInput, { color: colors.primaryForeground }]}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        onSubmitEditing={onCommit}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus
        returnKeyType="done"
        placeholder="?"
        placeholderTextColor={`${colors.primaryForeground}88`}
      />
      {value.length > 0 && (
        <Pressable onPress={onDelete} hitSlop={6}>
          <Feather name="x" size={11} color={colors.primaryForeground} />
        </Pressable>
      )}
    </View>
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

  // Chord
  chordChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chordChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  chordChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  chordEditWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, gap: 4, minWidth: 52,
  },
  chordEditInput: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 36, paddingVertical: 0 },
  addChordBtn: {
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },

  // Suggestions
  suggestScroll: { marginTop: 4, marginBottom: 4 },
  suggestList: { gap: 6, paddingVertical: 2 },
  suggestChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  suggestText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Lyric
  lyricInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 6, lineHeight: 20 },

  // Strum
  strumRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "nowrap" },
  strumBarDiv: { width: 1.5, height: 28, borderRadius: 1, marginHorizontal: 2 },
  strumBeat: {
    width: 30, height: 34, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  strumBeatText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Riff
  riffInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_500Medium",
    paddingVertical: 6, lineHeight: 20,
    borderBottomWidth: 1, paddingHorizontal: 2,
    letterSpacing: 0.3,
  },

  // Note
  noteLineRow: { alignItems: "flex-start", gap: 6 },
  noteInput: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    fontStyle: "italic", paddingVertical: 4, lineHeight: 18,
  },

  // Add line
  addLineRow: { borderTopWidth: 1 },
  addLineScroll: { paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  addLineBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  addLineBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Add section
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
