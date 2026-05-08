import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

const MONO_FONT = Platform.select({
  ios: "Courier New",
  android: "monospace",
  default: "monospace",
});

import { useColors } from "@/hooks/useColors";
import { transposeChord } from "@/utils/transposing";

export type ChordViewerCapoMode = "none" | "real" | "both";

interface ChordViewerProps {
  content: string;
  capo?: number;
  capoMode?: ChordViewerCapoMode;
}

type LineType = "section" | "chord" | "tab" | "strum" | "riff" | "note" | "lyric" | "empty";

interface ParsedLine {
  type: LineType;
  text: string;
  pairedChords?: string[];
  consumed?: boolean;
}

type RenderItem = ParsedLine;

const CHORD_TOKEN_REGEX =
  /^[A-G][#b]?(maj|min|m|M|dim|aug|sus2|sus4|sus|add|alt)?(\d{1,2})?(\/[A-G][#b]?)?$/;

const TAB_LINE_REGEX = /^[eEADGBb]\|/;

function parseLine(line: string): LineType {
  if (!line.trim()) return "empty";
  const trimmed = line.trim();
  if (/^\[.+\]$/.test(trimmed)) return "section";
  if (trimmed.startsWith("STRUM:")) return "strum";
  if (trimmed.startsWith("CHORD:")) return "chord";
  if (trimmed.startsWith("NOTE:"))  return "note";
  if (trimmed.startsWith("RIFF:"))  return "riff";
  if (TAB_LINE_REGEX.test(trimmed)) return "tab";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_REGEX.test(t))) return "chord";
  return "lyric";
}

// ─── Strum helpers ────────────────────────────────────────────────────────────
type StrumBeat = "-" | "D" | "U" | "DU" | "x" | "C";

const BEAT_SYMBOL: Record<StrumBeat, string> = {
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕", C: "↺",
};

const VALID_BEATS: string[] = ["D", "U", "DU", "x", "-", "C"];

interface StrumData {
  beats: StrumBeat[];
  repeat: number;
}

function parseStrumData(raw: string): StrumData {
  const payload = raw.startsWith("STRUM:") ? raw.slice(6) : raw;
  const [beatsPart, ...rest] = payload.split(";");
  const beats = beatsPart
    .split(",")
    .map((b) => (VALID_BEATS.includes(b) ? (b as StrumBeat) : "-")) as StrumBeat[];
  const repeatStr = rest.find((p) => p.startsWith("REPEAT:"));
  const repeat = repeatStr ? Math.max(1, parseInt(repeatStr.slice(7), 10)) : 1;
  return { beats, repeat };
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
  mode: ChordViewerCapoMode;
  accentColor: string;
  mutedColor: string;
  primaryColor: string;
}

function ChordTokenView({ chord, capo, mode, accentColor, primaryColor }: ChordTokenProps) {
  const transposed = capo > 0 ? transposeChord(chord, capo) : null;
  const different = transposed !== null && transposed !== chord;

  if (mode === "none" || !transposed || !different) {
    return (
      <View style={tokenStyles.wrap}>
        <Text style={[tokenStyles.chord, { color: accentColor }]}>{chord}</Text>
      </View>
    );
  }
  if (mode === "real") {
    return (
      <View style={tokenStyles.wrap}>
        <Text style={[tokenStyles.chord, { color: accentColor }]}>{transposed}</Text>
      </View>
    );
  }
  return (
    <View style={tokenStyles.wrap}>
      <Text style={[tokenStyles.chord, { color: accentColor }]}>{chord}</Text>
      <Text style={[tokenStyles.label, { color: primaryColor }]}>{transposed}</Text>
    </View>
  );
}

const tokenStyles = StyleSheet.create({
  wrap: { alignItems: "center", marginRight: 12 },
  chord: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  label: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3, marginTop: 1, opacity: 0.75 },
  warnDot: { fontSize: 9, marginLeft: 2, marginTop: -4 },
});

// ─── Component ───────────────────────────────────────────────────────────────
export function ChordViewer({ content, capo = 0, capoMode = "both" }: ChordViewerProps) {
  const colors = useColors();

  const lines = useMemo<ParsedLine[]>(() => {
    if (!content?.trim()) return [];
    const raw: ParsedLine[] = content.split("\n").map((line) => ({ type: parseLine(line), text: line }));
    // Pair chord lines that are immediately followed by a strum line
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].type === "strum") {
        let j = i - 1;
        while (j >= 0 && raw[j].type === "empty") j--;
        if (j >= 0 && raw[j].type === "chord") {
          const chordText = raw[j].text.startsWith("CHORD:") ? raw[j].text.slice(6) : raw[j].text;
          raw[i] = { ...raw[i], pairedChords: chordText.trim().split(/\s+/).filter(Boolean) };
          raw[j] = { ...raw[j], consumed: true };
        }
      }
    }
    return raw;
  }, [content]);

  const renderItems = useMemo<RenderItem[]>(() => lines.filter((l) => !l.consumed), [lines]);

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

          // ── Plain chord line ──────────────────────────────────────────────
          if (item.type === "chord") {
            const rawText = (item as ParsedLine).text;
            const chordText = rawText.startsWith("CHORD:") ? rawText.slice(6) : rawText;
            const tokens = chordText.trim().split(/\s+/).filter(Boolean);
            const hasNonStandard = tokens.some((t) => !CHORD_TOKEN_REGEX.test(t));
            return (
              <View key={idx}>
                <View style={styles.chordTokenRow}>
                  {tokens.map((chord, ti) => {
                    const isStandard = CHORD_TOKEN_REGEX.test(chord);
                    if (capo > 0 && capoMode !== "none" && isStandard) {
                      return (
                        <ChordTokenView
                          key={ti}
                          chord={chord}
                          capo={capo}
                          mode={capoMode}
                          accentColor={colors.accent}
                          mutedColor={colors.mutedForeground}
                          primaryColor={colors.primary}
                        />
                      );
                    }
                    return (
                      <View key={ti} style={[tokenStyles.wrap, { flexDirection: "row", alignItems: "center" }]}>
                        <Text style={[tokenStyles.chord, { color: isStandard ? colors.accent : colors.primary }]}>
                          {chord}
                        </Text>
                        {!isStandard && (
                          <Text style={[tokenStyles.warnDot, { color: colors.primary }]}>⚠</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {hasNonStandard && (
                  <Text style={[styles.chordWarnNote, { color: colors.mutedForeground }]}>
                    ⚠ Custom chord names — transposing won't work for these
                  </Text>
                )}
              </View>
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

          // ── Strum ─────────────────────────────────────────────────────────
          if (item.type === "strum") {
            const { beats, repeat } = parseStrumData((item as ParsedLine).text.trim());
            const pairedChords = (item as ParsedLine).pairedChords;

            if (pairedChords && pairedChords.length > 0) {
              // Split beats at "C" (chord-change) markers into segments
              const segments: StrumBeat[][] = [];
              let seg: StrumBeat[] = [];
              for (const beat of beats) {
                if (beat === "C") { segments.push(seg); seg = []; }
                else seg.push(beat);
              }
              segments.push(seg);
              const firstNonEmpty = segments.find((s) => s.length > 0) ?? [];

              // Each chord gets one segment; if a segment is empty (e.g. trailing ↺),
              // fall back to the first non-empty segment so every chord is displayed.
              const groups: { chord: string; groupBeats: StrumBeat[] }[] = pairedChords.map((chord, i) => {
                const raw = segments[i % segments.length];
                return { chord, groupBeats: raw && raw.length > 0 ? raw : firstNonEmpty };
              });
              if (groups.length === 0) {
                groups.push({ chord: pairedChords[0] ?? "?", groupBeats: beats.filter((b) => b !== "C") });
              }

              return (
                <View key={idx}>
                  <View style={[styles.chordStrumBlock, { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}22` }]}>
                    {groups.map((group, ci) => {
                      const isStd = CHORD_TOKEN_REGEX.test(group.chord);
                      const transposed = capo > 0 && isStd ? transposeChord(group.chord, capo) : null;
                      const showLabel = transposed !== null && transposed !== group.chord;
                      return (
                        <View key={ci} style={styles.chordGroup}>
                          <View style={styles.chordGroupNameWrap}>
                            {capoMode !== "real" && (
                              <Text style={[styles.chordGroupName, { color: colors.accent }]}>{group.chord}</Text>
                            )}
                            {capoMode === "real" && (
                              <Text style={[styles.chordGroupName, { color: colors.accent }]}>{showLabel ? transposed : group.chord}</Text>
                            )}
                            {capoMode === "both" && showLabel && (
                              <Text style={[styles.chordGroupTransposed, { color: colors.primary }]}>{transposed}</Text>
                            )}
                          </View>
                          <View style={styles.chordGroupBeats}>
                            {group.groupBeats.map((beat, bi) => (
                              <Text key={bi} style={[styles.chordGroupBeat, { color: beat === "-" ? colors.border : beat === "x" ? colors.destructive : colors.primary, opacity: beat === "-" ? 0.4 : 1 }]}>
                                {BEAT_SYMBOL[beat]}
                              </Text>
                            ))}
                          </View>
                          {ci < groups.length - 1 && (
                            <Text style={[styles.chordGroupDiv, { color: colors.border }]}>│</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  {repeat > 1 && (
                    <Text style={[styles.repeatLabel, { color: `${colors.primary}88` }]}>× {repeat}</Text>
                  )}
                </View>
              );
            }

            // Simple strum (no paired chord line)
            return (
              <View key={idx}>
                <View style={[styles.strumContainer, { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}22` }]}>
                  <Text style={[styles.strumLabel, { color: `${colors.primary}88` }]}>strum</Text>
                  <View style={styles.strumBeats}>
                    {beats.map((beat, bi) => (
                      <React.Fragment key={bi}>
                        {bi === 4 && <Text style={[styles.strumBarChar, { color: colors.border }]}>│</Text>}
                        <Text style={[styles.strumSymbol, {
                          color: beat === "-" ? colors.border : beat === "x" ? colors.destructive : beat === "C" ? colors.accent : colors.primary,
                          opacity: beat === "-" ? 0.4 : 1,
                        }]}>
                          {BEAT_SYMBOL[beat]}
                        </Text>
                      </React.Fragment>
                    ))}
                  </View>
                </View>
                {repeat > 1 && (
                  <Text style={[styles.repeatLabel, { color: `${colors.primary}88` }]}>× {repeat}</Text>
                )}
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
                            {capoMode !== "real" && (
                              <Text style={[styles.chordProName, { color: colors.accent }]}>
                                {seg.chord}
                              </Text>
                            )}
                            {capoMode === "real" && (
                              <Text style={[styles.chordProName, { color: colors.accent }]}>
                                {showLabel ? transposed : seg.chord}
                              </Text>
                            )}
                            {capoMode === "both" && showLabel && (
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
  repeatLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3, textAlign: "right", marginTop: 1, marginBottom: 3 },
  chordWarnNote: { fontSize: 10, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2, marginBottom: 2, opacity: 0.7 },

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
