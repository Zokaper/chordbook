/**
 * StructuredEditor
 *
 * A section-based song editor. Songs are composed of named sections
 * (Verse, Chorus, Bridge, etc.), each containing chord lines and lyric lines.
 *
 * Chord lines  — amber chips, tap to edit inline with saved-chord suggestions
 * Lyric lines  — plain TextInput rows
 *
 * Serializes to / parses from the plain-text format that ChordViewer already
 * understands: [Section Name] headers, chord lines, lyric lines.
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

import { ChordFingering, useChords } from "@/context/ChordContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChordLine = { id: string; type: "chord"; chords: string[] };
type LyricLine = { id: string; type: "lyric"; text: string };
type SongLine = ChordLine | LyricLine;
type Section = { id: string; name: string; lines: SongLine[] };
type EditingChord = {
  sectionId: string;
  lineId: string;
  idx: number;
  value: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 7);

const CHORD_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => CHORD_RE.test(t));
}

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
    if (isChordLine(line)) {
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
        .filter((l) =>
          l.type === "lyric" ? l.text.trim() !== "" : l.chords.length > 0
        )
        .map((l) => (l.type === "chord" ? l.chords.join("  ") : l.text));
      return [`[${s.name}]`, ...lines].join("\n");
    })
    .join("\n\n");
}

const SECTION_PRESETS = [
  "Intro",
  "Verse 1",
  "Verse 2",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Outro",
  "Solo",
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

  const [sections, setSections] = useState<Section[]>(() =>
    parseContent(content)
  );
  const [editingChord, setEditingChord] = useState<EditingChord | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  const isFirstRender = useRef(true);

  // Sync to parent whenever sections change (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );

  // ── Line mutations ─────────────────────────────────────────────────────────
  const addLine = (sectionId: string, type: "chord" | "lyric") => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const newLine: SongLine =
          type === "chord"
            ? { id: genId(), type: "chord", chords: [] }
            : { id: genId(), type: "lyric", text: "" };
        return { ...s, lines: [...s.lines, newLine] };
      })
    );
  };

  const deleteLine = (sectionId: string, lineId: string) => {
    if (editingChord?.lineId === lineId) setEditingChord(null);
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, lines: s.lines.filter((l) => l.id !== lineId) }
      )
    );
  };

  const updateLyric = (sectionId: string, lineId: string, text: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              lines: s.lines.map((l) =>
                l.id === lineId ? { ...l, text } : l
              ),
            }
      )
    );

  // ── Chord chip mutations ───────────────────────────────────────────────────
  const applyChordEdit = (
    sectionId: string,
    lineId: string,
    idx: number,
    value: string
  ) => {
    const trimmed = value.trim();
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map((l) => {
            if (l.id !== lineId || l.type !== "chord") return l;
            const next = [...l.chords];
            if (trimmed === "") {
              next.splice(idx, 1); // remove if empty
            } else {
              next[idx] = trimmed;
            }
            return { ...l, chords: next };
          }),
        };
      })
    );
    setEditingChord(null);
  };

  const deleteChord = (sectionId: string, lineId: string, idx: number) => {
    if (editingChord?.idx === idx && editingChord?.lineId === lineId) {
      setEditingChord(null);
    }
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
    // Commit any active edit first
    if (editingChord) {
      applyChordEdit(
        editingChord.sectionId,
        editingChord.lineId,
        editingChord.idx,
        editingChord.value
      );
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
      // Find the index of the newly added chord
      const sec = updated.find((s) => s.id === sectionId);
      const line = sec?.lines.find((l) => l.id === lineId);
      if (line && line.type === "chord") {
        setEditingChord({
          sectionId,
          lineId,
          idx: line.chords.length - 1,
          value: "",
        });
      }
      return updated;
    });
  };

  const suggestChord = (chord: string) => {
    if (!editingChord) return;
    setEditingChord({ ...editingChord, value: chord });
    applyChordEdit(
      editingChord.sectionId,
      editingChord.lineId,
      editingChord.idx,
      chord
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const suggestions =
    savedChords.length > 0
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
        const activeLine = editingChord?.sectionId === section.id
          ? editingChord.lineId
          : null;

        return (
          <View
            key={section.id}
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Section header */}
            <View
              style={[
                styles.sectionHeader,
                { borderBottomColor: colors.border },
              ]}
            >
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
                <Pressable
                  onPress={() => setEditingSectionId(section.id)}
                  style={{ flex: 1 }}
                >
                  <Text
                    style={[
                      styles.sectionName,
                      { color: colors.primary },
                    ]}
                  >
                    {section.name}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => deleteSection(section.id)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Feather
                  name="trash-2"
                  size={15}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {/* Lines */}
            <View style={styles.linesContainer}>
              {section.lines.length === 0 && (
                <Text
                  style={[
                    styles.noLinesHint,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Add chord lines or lyrics below
                </Text>
              )}

              {section.lines.map((line) => {
                if (line.type === "chord") {
                  const isActiveChordLine = activeLine === line.id;
                  return (
                    <View key={line.id}>
                      {/* Chord chip row */}
                      <View style={styles.lineRow}>
                        <View style={styles.chordChips}>
                          {line.chords.map((chord, idx) => {
                            const isEditing =
                              editingChord?.lineId === line.id &&
                              editingChord.idx === idx;
                            return isEditing ? (
                              <ChordEditInput
                                key={`${line.id}-${idx}`}
                                value={editingChord.value}
                                onChange={(v) =>
                                  setEditingChord({ ...editingChord, value: v })
                                }
                                onCommit={() =>
                                  applyChordEdit(
                                    section.id,
                                    line.id,
                                    idx,
                                    editingChord.value
                                  )
                                }
                                onDelete={() =>
                                  deleteChord(section.id, line.id, idx)
                                }
                                colors={colors}
                              />
                            ) : (
                              <ChordChip
                                key={`${line.id}-${idx}`}
                                chord={chord || "?"}
                                onPress={() =>
                                  setEditingChord({
                                    sectionId: section.id,
                                    lineId: line.id,
                                    idx,
                                    value: chord,
                                  })
                                }
                                onLongPress={() =>
                                  deleteChord(section.id, line.id, idx)
                                }
                                colors={colors}
                              />
                            );
                          })}

                          {/* + chord button */}
                          <Pressable
                            onPress={() =>
                              startAddChord(section.id, line.id)
                            }
                            style={({ pressed }) => [
                              styles.addChordBtn,
                              {
                                borderColor: colors.border,
                                opacity: pressed ? 0.6 : 1,
                              },
                            ]}
                          >
                            <Feather
                              name="plus"
                              size={13}
                              color={colors.mutedForeground}
                            />
                          </Pressable>
                        </View>

                        {/* Delete line */}
                        <Pressable
                          onPress={() => deleteLine(section.id, line.id)}
                          hitSlop={10}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.4 : 0.5,
                            paddingLeft: 6,
                          })}
                        >
                          <Feather
                            name="x"
                            size={14}
                            color={colors.mutedForeground}
                          />
                        </Pressable>
                      </View>

                      {/* Suggestion row (when this chord line is active) */}
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
                              onPress={() => suggestChord(name)}
                              style={({ pressed }) => [
                                styles.suggestChip,
                                {
                                  backgroundColor: pressed
                                    ? colors.primary
                                    : colors.secondary,
                                  borderColor: colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.suggestText,
                                  {
                                    color: colors.foreground,
                                  },
                                ]}
                              >
                                {name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  );
                }

                // Lyric line
                return (
                  <View key={line.id} style={styles.lineRow}>
                    <TextInput
                      style={[
                        styles.lyricInput,
                        { color: colors.foreground },
                      ]}
                      value={line.text}
                      onChangeText={(v) =>
                        updateLyric(section.id, line.id, v)
                      }
                      placeholder="Lyrics..."
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      blurOnSubmit={false}
                    />
                    <Pressable
                      onPress={() => deleteLine(section.id, line.id)}
                      hitSlop={10}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.4 : 0.5,
                        paddingLeft: 6,
                        alignSelf: "flex-start",
                        paddingTop: 4,
                      })}
                    >
                      <Feather
                        name="x"
                        size={14}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Add line buttons */}
            <View
              style={[
                styles.addLineRow,
                { borderTopColor: colors.border },
              ]}
            >
              <Pressable
                onPress={() => addLine(section.id, "chord")}
                style={({ pressed }) => [
                  styles.addLineBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="music" size={12} color={colors.primary} />
                <Text
                  style={[
                    styles.addLineBtnText,
                    { color: colors.foreground },
                  ]}
                >
                  Chords
                </Text>
              </Pressable>

              <Pressable
                onPress={() => addLine(section.id, "lyric")}
                style={({ pressed }) => [
                  styles.addLineBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="edit-3" size={12} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.addLineBtnText,
                    { color: colors.foreground },
                  ]}
                >
                  Lyrics
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* Add section */}
      {showSectionPicker ? (
        <View
          style={[
            styles.sectionPicker,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.sectionPickerTitle, { color: colors.mutedForeground }]}
          >
            Choose section type
          </Text>
          <View style={styles.sectionPickerGrid}>
            {SECTION_PRESETS.map((name) => (
              <Pressable
                key={name}
                onPress={() => addSection(name)}
                style={({ pressed }) => [
                  styles.sectionPresetBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionPresetText,
                    { color: colors.foreground },
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setShowSectionPicker(false)}
            style={{ alignSelf: "center", padding: 8 }}
          >
            <Text
              style={[
                styles.cancelText,
                { color: colors.mutedForeground },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowSectionPicker(true)}
          style={({ pressed }) => [
            styles.addSectionBtn,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.mutedForeground} />
          <Text
            style={[styles.addSectionText, { color: colors.mutedForeground }]}
          >
            Add section
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColorsLike {
  primary: string;
  primaryForeground: string;
  secondary: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  destructive: string;
}

function ChordChip({
  chord,
  onPress,
  onLongPress,
  colors,
}: {
  chord: string;
  onPress: () => void;
  onLongPress: () => void;
  colors: ColorsLike;
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
      <Text
        style={[
          styles.chordChipText,
          { color: colors.primary },
        ]}
      >
        {chord}
      </Text>
    </Pressable>
  );
}

function ChordEditInput({
  value,
  onChange,
  onCommit,
  onDelete,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onDelete: () => void;
  colors: ColorsLike;
}) {
  return (
    <View
      style={[
        styles.chordEditWrap,
        {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
      ]}
    >
      <TextInput
        style={[styles.chordEditInput, { color: colors.primaryForeground }]}
        value={value}
        onChangeText={onChange}
        onBlur={onCommit}
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
  emptyHint: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  sectionName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionNameInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingVertical: 0,
  },
  linesContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 6,
  },
  noLinesHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
    textAlign: "center",
    opacity: 0.7,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
  },
  chordChips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  chordChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chordChipText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  chordEditWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    minWidth: 52,
  },
  chordEditInput: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    minWidth: 36,
    paddingVertical: 0,
  },
  addChordBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  lyricInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 6,
    lineHeight: 20,
  },
  suggestScroll: {
    marginTop: 4,
    marginBottom: 4,
  },
  suggestList: {
    gap: 6,
    paddingVertical: 2,
  },
  suggestChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggestText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  addLineRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  addLineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addLineBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  addSectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addSectionText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionPicker: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionPickerTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionPresetBtn: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionPresetText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
