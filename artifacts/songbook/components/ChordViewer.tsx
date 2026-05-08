import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

const MONO_FONT = Platform.select({
  ios: "Courier New",
  android: "monospace",
  default: "monospace",
});

import { useColors } from "@/hooks/useColors";
import { transposeChord } from "@/utils/transposing";

interface ChordViewerProps {
  content: string;
  capo?: number;
}

type LineType = "section" | "chord" | "tab" | "strum" | "riff" | "note" | "lyric" | "empty";

interface ParsedLine {
  type: LineType;
  text: string;
}

type RenderItem =
  | ParsedLine
  | { type: "chord-strum"; chord: ParsedLine; strum: ParsedLine };

const CHORD_TOKEN_REGEX =
  /^[A-G][#b]?(maj|min|m|M|dim|aug|sus2|sus4|sus|add|alt)?(\d{1,2})?(\/[A-G][#b]?)?$/;

const TAB_LINE_REGEX = /^[eEADGBb]\|/;

function parseLine(line: string): LineType {
  if (!line.trim()) return "empty";
  const trimmed = line.trim();
  if (/^\[.+\]$/.test(trimmed)) return "section";
  if (trimmed.startsWith("STRUM:")) return "strum";
  if (trimmed.startsWith("NOTE:"))  return "note";
  if (trimmed.startsWith("RIFF:"))  return "riff";
  if (TAB_LINE_REGEX.test(trimmed)) return "tab";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_REGEX.test(t))) return "chord";
  return "lyric";
}

// ─── Strum helpers ────────────────────────────────────────────────────────────
type StrumBeat = "-" | "D" | "U" | "DU" | "x";

const BEAT_SYMBOL: Record<StrumBeat, string> = {
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕",
};

function parseStrumBeats(raw: string): StrumBeat[] {
  const payload = raw.startsWith("STRUM:") ? raw.slice(6) : raw;
  return payload
    .split(",")
    .map((b) =>
      (["D", "U", "DU", "x", "-"] as string[]).includes(b) ? (b as StrumBeat) : "-"
    );
}

// ─── Riff helpers ─────────────────────────────────────────────────────────────
const RIFF_STRING_NAMES = ["e", "B", "G", "D", "A", "E"];

interface RiffString { name: string; slots: string }

function parseRiffLine(raw: string): RiffString[] {
  const payload = raw.startsWith("RIFF:") ? raw.slice(5) : raw;
  const parts = payload.split(":").slice(0, 6);
  const strings = parts.map((part, i) => {
    const name = RIFF_STRING_NAMES[i] ?? "?";
    const inner = part.replace(/^[a-zA-Z]\|/, "").replace(/\|$/, "");
    return { name, slots: inner };
  });
  const maxLen = Math.max(...strings.map((s) => s.slots.length), 0);
  return strings.map((s) => ({
    ...s,
    slots: s.slots.length < maxLen
      ? s.slots + "-".repeat(maxLen - s.slots.length)
      : s.slots,
  }));
}

// ─── ChordPro helpers ─────────────────────────────────────────────────────────
const CHORD_PRO_RE = /\[([A-G][#b]?[^\]]*)\]/;

function hasChordPro(text: string): boolean {
  return CHORD_PRO_RE.test(text);
}

interface ChordProSeg { chord: string | null; text: string }

function parseChordPro(text: string): ChordProSeg[] {
  const result: ChordProSeg[] = [];
  const re = /\[([^\]]+)\]([^\[]*)/g;
  const firstBracket = text.indexOf("[");

  if (firstBracket < 0) return [{ chord: null, text }];
  if (firstBracket > 0) result.push({ chord: null, text: text.slice(0, firstBracket) });

  re.lastIndex = firstBracket;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    result.push({ chord: m[1], text: m[2] });
  }
  return result;
}

// ─── Chord token with optional capo label ─────────────────────────────────────
interface ChordTokenProps {
  chord: string;
  capo: number;
  accentColor: string;
  mutedColor: string;
  primaryColor: string;
}

function ChordTokenView({ chord, capo, accentColor, mutedColor, primaryColor }: ChordTokenProps) {
  const transposed = capo > 0 ? transposeChord(chord, capo) : null;
  const showLabel = transposed !== null && transposed !== chord;
  return (
    <View style={tokenStyles.wrap}>
      <Text style={[tokenStyles.chord, { color: accentColor }]}>{chord}</Text>
      {showLabel && (
        <Text style={[tokenStyles.label, { color: primaryColor }]}>{transposed}</Text>
      )}
    </View>
  );
}

const tokenStyles = StyleSheet.create({
  wrap: { alignItems: "center", marginRight: 12 },
  chord: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  label: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3, marginTop: 1, opacity: 0.75 },
});

// ─── Component ───────────────────────────────────────────────────────────────
export function ChordViewer({ content, capo = 0 }: ChordViewerProps) {
  const colors = useColors();

  const lines = useMemo<ParsedLine[]>(() => {
    if (!content?.trim()) return [];
    return content.split("\n").map((line) => ({ type: parseLine(line), text: line }));
  }, [content]);

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].type === "chord" && lines[i + 1]?.type === "strum") {
        items.push({ type: "chord-strum", chord: lines[i], strum: lines[i + 1] });
        i += 2;
      } else {
        items.push(lines[i]);
        i++;
      }
    }
    return items;
  }, [lines]);

  if (!content?.trim()) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No content yet</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalScroll}
    >
      <View style={styles.container}>
        {renderItems.map((item, idx) => {
          if (item.type === "empty") return <View key={idx} style={styles.spacer} />;

          // ── Section header ────────────────────────────────────────────────
          if (item.type === "section") {
            return (
              <Text key={idx} style={[styles.sectionHeader, { color: colors.primary }]}>
                {(item as ParsedLine).text.trim()}
              </Text>
            );
          }

          // ── Chord + Strum paired ──────────────────────────────────────────
          if (item.type === "chord-strum") {
            const paired = item as { type: "chord-strum"; chord: ParsedLine; strum: ParsedLine };
            const chords = paired.chord.text.trim().split(/\s+/).filter(Boolean);
            const beats = parseStrumBeats(paired.strum.text.trim());
            const numChords = chords.length;
            const numBeats  = beats.length;
            const groups: StrumBeat[][] = chords.map((_, ci) => {
              const start = Math.round((ci * numBeats) / numChords);
              const end   = Math.round(((ci + 1) * numBeats) / numChords);
              return beats.slice(start, end);
            });
            return (
              <View
                key={idx}
                style={[
                  styles.chordStrumBlock,
                  { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}22` },
                ]}
              >
                {groups.map((groupBeats, ci) => {
                  const transposed = capo > 0 ? transposeChord(chords[ci], capo) : null;
                  const showLabel = transposed !== null && transposed !== chords[ci];
                  return (
                    <View key={ci} style={styles.chordGroup}>
                      <View style={styles.chordGroupNameWrap}>
                        <Text style={[styles.chordGroupName, { color: colors.accent }]}>
                          {chords[ci]}
                        </Text>
                        {showLabel && (
                          <Text style={[styles.chordGroupTransposed, { color: colors.primary }]}>
                            {transposed}
                          </Text>
                        )}
                      </View>
                      <View style={styles.chordGroupBeats}>
                        {groupBeats.map((beat, bi) => (
                          <Text
                            key={bi}
                            style={[
                              styles.chordGroupBeat,
                              {
                                color: beat === "-" ? colors.border : beat === "x" ? colors.destructive : colors.primary,
                                opacity: beat === "-" ? 0.4 : 1,
                              },
                            ]}
                          >
                            {BEAT_SYMBOL[beat]}
                          </Text>
                        ))}
                      </View>
                      {ci < chords.length - 1 && (
                        <Text style={[styles.chordGroupDiv, { color: colors.border }]}>│</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          }

          // ── Plain chord line ──────────────────────────────────────────────
          if (item.type === "chord") {
            const tokens = (item as ParsedLine).text.trim().split(/\s+/).filter(Boolean);
            if (capo > 0) {
              return (
                <View key={idx} style={styles.chordTokenRow}>
                  {tokens.map((chord, ti) => (
                    <ChordTokenView
                      key={ti}
                      chord={chord}
                      capo={capo}
                      accentColor={colors.accent}
                      mutedColor={colors.mutedForeground}
                      primaryColor={colors.primary}
                    />
                  ))}
                </View>
              );
            }
            return (
              <Text key={idx} style={[styles.chordLine, { color: colors.accent }]}>
                {(item as ParsedLine).text}
              </Text>
            );
          }

          // ── Tab line ──────────────────────────────────────────────────────
          if (item.type === "tab") {
            return (
              <Text key={idx} style={[styles.tabLine, { color: colors.primary }]}>
                {(item as ParsedLine).text}
              </Text>
            );
          }

          // ── Strum (standalone) ────────────────────────────────────────────
          if (item.type === "strum") {
            const beats = parseStrumBeats((item as ParsedLine).text.trim());
            return (
              <View
                key={idx}
                style={[
                  styles.strumContainer,
                  { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}22` },
                ]}
              >
                <Text style={[styles.strumLabel, { color: `${colors.primary}88` }]}>strum</Text>
                <View style={styles.strumBeats}>
                  {beats.map((beat, bi) => (
                    <React.Fragment key={bi}>
                      {bi === 4 && <Text style={[styles.strumBarChar, { color: colors.border }]}>│</Text>}
                      <Text
                        style={[
                          styles.strumSymbol,
                          {
                            color: beat === "-" ? colors.border : beat === "x" ? colors.destructive : colors.primary,
                            opacity: beat === "-" ? 0.4 : 1,
                          },
                        ]}
                      >
                        {BEAT_SYMBOL[beat]}
                      </Text>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            );
          }

          // ── Riff block ────────────────────────────────────────────────────
          if (item.type === "riff") {
            const strings = parseRiffLine((item as ParsedLine).text.trim());
            const used = strings.filter((s) => /[^-]/.test(s.slots));
            return (
              <View
                key={idx}
                style={[
                  styles.riffBlock,
                  { backgroundColor: `${colors.primary}07`, borderColor: `${colors.primary}20` },
                ]}
              >
                {(used.length > 0 ? used : strings).map((s, si) => (
                  <View key={si} style={styles.riffRow}>
                    <Text style={[styles.riffStrName, { color: `${colors.primary}88` }]}>{s.name}</Text>
                    <Text style={[styles.riffContent, { color: colors.primary }]}>{`|${s.slots}|`}</Text>
                  </View>
                ))}
              </View>
            );
          }

          // ── Note ──────────────────────────────────────────────────────────
          if (item.type === "note") {
            const noteText = (item as ParsedLine).text.startsWith("NOTE:")
              ? (item as ParsedLine).text.slice(5)
              : (item as ParsedLine).text;
            return (
              <View key={idx} style={[styles.noteRow, { borderLeftColor: `${colors.mutedForeground}44` }]}>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{noteText}</Text>
              </View>
            );
          }

          // ── Lyric (with optional ChordPro inline chords) ──────────────────
          const lyricText = (item as ParsedLine).text;
          if (hasChordPro(lyricText)) {
            const segs = parseChordPro(lyricText);
            return (
              <View key={idx} style={styles.chordProRow}>
                {segs.map((seg, si) => {
                  const transposed = seg.chord && capo > 0 ? transposeChord(seg.chord, capo) : null;
                  const showLabel = transposed !== null && transposed !== seg.chord;
                  return (
                    <View key={si} style={styles.chordProSeg}>
                      <View style={styles.chordProNameBox}>
                        {seg.chord ? (
                          <View style={styles.chordProNameStack}>
                            <Text style={[styles.chordProName, { color: colors.accent }]}>
                              {seg.chord}
                            </Text>
                            {showLabel && (
                              <Text style={[styles.chordProTransposed, { color: colors.primary }]}>
                                {transposed}
                              </Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.lyricLine, { color: colors.foreground }]}>
                        {seg.text || (si === segs.length - 1 ? "" : " ")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          }

          return (
            <Text key={idx} style={[styles.lyricLine, { color: colors.foreground }]}>
              {lyricText || " "}
            </Text>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizontalScroll: { flexGrow: 1 },
  container: { paddingHorizontal: 2 },
  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  spacer: { height: 10 },

  sectionHeader: {
    fontSize: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 1.2, textTransform: "uppercase",
    marginTop: 18, marginBottom: 6,
  },
  chordLine: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5, lineHeight: 22,
  },
  chordTokenRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginVertical: 2,
  },
  tabLine: {
    fontSize: 13, fontFamily: MONO_FONT,
    letterSpacing: 0, lineHeight: 19,
  },
  lyricLine: {
    fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24,
  },

  // ── ChordPro ───────────────────────────────────────────────────────────────
  chordProRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginVertical: 2,
  },
  chordProSeg: {
    alignItems: "flex-start",
  },
  chordProNameBox: {
    minHeight: 18,
    justifyContent: "flex-end",
  },
  chordProNameStack: {
    alignItems: "flex-start",
  },
  chordProName: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    lineHeight: 17,
  },
  chordProTransposed: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    opacity: 0.75,
  },

  // ── Chord + Strum paired block ─────────────────────────────────────────────
  chordStrumBlock: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginVertical: 4,
  },
  chordGroup: { flexDirection: "row", alignItems: "center", gap: 5 },
  chordGroupNameWrap: { alignItems: "center" },
  chordGroupName: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3, minWidth: 28 },
  chordGroupTransposed: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.3, opacity: 0.75 },
  chordGroupBeats: { flexDirection: "row", alignItems: "center", gap: 3 },
  chordGroupBeat: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chordGroupDiv: { fontSize: 18, fontFamily: "Inter_400Regular", opacity: 0.35, marginHorizontal: 6 },

  // ── Standalone strum ───────────────────────────────────────────────────────
  strumContainer: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    marginVertical: 3, gap: 10,
  },
  strumLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.2, textTransform: "uppercase" },
  strumBeats: { flexDirection: "row", alignItems: "center", gap: 6 },
  strumBarChar: { fontSize: 16, opacity: 0.4, marginHorizontal: 2 },
  strumSymbol: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // ── Riff block ─────────────────────────────────────────────────────────────
  riffBlock: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 7,
    marginVertical: 3, gap: 1,
  },
  riffRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  riffStrName: { width: 10, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  riffContent: { fontSize: 13, fontFamily: MONO_FONT, letterSpacing: 0, lineHeight: 20 },

  // ── Note ───────────────────────────────────────────────────────────────────
  noteRow: { borderLeftWidth: 2.5, paddingLeft: 10, marginVertical: 2 },
  noteText: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 20 },
});
