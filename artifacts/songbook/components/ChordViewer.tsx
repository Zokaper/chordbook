import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ChordViewerProps {
  content: string;
}

type LineType = "section" | "chord" | "tab" | "strum" | "riff" | "note" | "lyric" | "empty";

interface ParsedLine {
  type: LineType;
  text: string;
}

const CHORD_TOKEN_REGEX =
  /^[A-G][#b]?(maj|min|m|M|dim|aug|sus2|sus4|sus|add|alt)?(\d{1,2})?(\/[A-G][#b]?)?$/;

const TAB_LINE_REGEX = /^[eEADGBb]\|/;

function parseLine(line: string): LineType {
  if (!line.trim()) return "empty";
  const trimmed = line.trim();
  if (/^\[.+\]$/.test(trimmed)) return "section";
  if (trimmed.startsWith("STRUM:"))  return "strum";
  if (trimmed.startsWith("NOTE:"))   return "note";
  if (trimmed.startsWith("RIFF:"))   return "riff";
  if (TAB_LINE_REGEX.test(trimmed))  return "tab";
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
  return payload.split(",").map((b) =>
    (["D", "U", "DU", "x", "-"] as string[]).includes(b) ? (b as StrumBeat) : "-"
  );
}

// ─── Riff helpers ─────────────────────────────────────────────────────────────
const RIFF_STRING_NAMES = ["e", "B", "G", "D", "A", "E"];

interface RiffString { name: string; slots: string }

function parseRiffLine(raw: string): RiffString[] {
  const payload = raw.startsWith("RIFF:") ? raw.slice(5) : raw;
  return payload.split(":").slice(0, 6).map((part, i) => {
    const name = RIFF_STRING_NAMES[i] ?? "?";
    const inner = part.replace(/^[a-zA-Z]\|/, "").replace(/\|$/, "");
    return { name, slots: inner };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ChordViewer({ content }: ChordViewerProps) {
  const colors = useColors();

  const lines = useMemo<ParsedLine[]>(() => {
    if (!content?.trim()) return [];
    return content.split("\n").map((line) => ({ type: parseLine(line), text: line }));
  }, [content]);

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
        {lines.map((line, i) => {
          if (line.type === "empty") return <View key={i} style={styles.spacer} />;

          if (line.type === "section") {
            return (
              <Text key={i} style={[styles.sectionHeader, { color: colors.primary }]}>
                {line.text.trim()}
              </Text>
            );
          }

          if (line.type === "chord") {
            return (
              <Text key={i} style={[styles.chordLine, { color: colors.accent }]}>
                {line.text}
              </Text>
            );
          }

          if (line.type === "tab") {
            return (
              <Text key={i} style={[styles.tabLine, { color: colors.primary }]}>
                {line.text}
              </Text>
            );
          }

          // ── Strum ────────────────────────────────────────────────────────
          if (line.type === "strum") {
            const beats = parseStrumBeats(line.text.trim());
            return (
              <View
                key={i}
                style={[
                  styles.strumContainer,
                  { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}22` },
                ]}
              >
                <Text style={[styles.strumLabel, { color: `${colors.primary}88` }]}>
                  strum
                </Text>
                <View style={styles.strumBeats}>
                  {beats.map((beat, bi) => (
                    <React.Fragment key={bi}>
                      {bi === 4 && (
                        <Text style={[styles.strumBarChar, { color: `${colors.border}` }]}>│</Text>
                      )}
                      <Text
                        style={[
                          styles.strumSymbol,
                          {
                            color:
                              beat === "-" ? `${colors.border}`
                              : beat === "x" ? colors.destructive
                              : colors.primary,
                            opacity: beat === "-" ? 0.5 : 1,
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

          // ── Riff (RIFF: prefix) ───────────────────────────────────────────
          if (line.type === "riff") {
            const strings = parseRiffLine(line.text.trim());
            // Only render strings that have at least one non-dash character
            const used = strings.filter((s) => /[^-]/.test(s.slots));
            return (
              <View
                key={i}
                style={[
                  styles.riffBlock,
                  {
                    backgroundColor: `${colors.primary}07`,
                    borderColor: `${colors.primary}20`,
                  },
                ]}
              >
                {(used.length > 0 ? used : strings).map((s, si) => (
                  <View key={si} style={styles.riffRow}>
                    <Text style={[styles.riffStrName, { color: `${colors.primary}88` }]}>
                      {s.name}
                    </Text>
                    <Text style={[styles.riffContent, { color: colors.primary }]}>
                      {`|${s.slots}|`}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }

          // ── Note ──────────────────────────────────────────────────────────
          if (line.type === "note") {
            const noteText = line.text.startsWith("NOTE:") ? line.text.slice(5) : line.text;
            return (
              <View
                key={i}
                style={[styles.noteRow, { borderLeftColor: `${colors.mutedForeground}44` }]}
              >
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {noteText}
                </Text>
              </View>
            );
          }

          // ── Lyric ─────────────────────────────────────────────────────────
          return (
            <Text key={i} style={[styles.lyricLine, { color: colors.foreground }]}>
              {line.text || " "}
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
  tabLine: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    letterSpacing: 0.3, lineHeight: 19,
  },
  lyricLine: {
    fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24,
  },

  // Strum — horizontal strip with a subtle tinted background
  strumContainer: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    marginVertical: 3, gap: 10,
  },
  strumLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  strumBeats: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  strumBarChar: {
    fontSize: 16, fontFamily: "Inter_400Regular", opacity: 0.4, marginHorizontal: 2,
  },
  strumSymbol: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
  },

  // Riff block
  riffBlock: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 7,
    marginVertical: 3, gap: 1,
  },
  riffRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  riffStrName: {
    width: 10, fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right",
  },
  riffContent: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    letterSpacing: 0.3, lineHeight: 20,
  },

  // Note — left-border style, italic
  noteRow: {
    borderLeftWidth: 2.5, paddingLeft: 10,
    marginVertical: 2,
  },
  noteText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    fontStyle: "italic", lineHeight: 20,
  },
});
