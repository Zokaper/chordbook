import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ChordViewerProps {
  content: string;
}

type LineType = "section" | "chord" | "tab" | "strum" | "note" | "lyric" | "empty";

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
  if (TAB_LINE_REGEX.test(trimmed))  return "tab";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_REGEX.test(t))) return "chord";
  return "lyric";
}

// ─── Strum rendering helpers ──────────────────────────────────────────────────
type StrumBeat = "-" | "D" | "U" | "DU" | "x";

const BEAT_SYMBOL: Record<StrumBeat, string> = {
  "-": "—", D: "↓", U: "↑", DU: "↕", x: "✕",
};

function parseStrumBeats(raw: string): StrumBeat[] {
  const payload = raw.startsWith("STRUM:") ? raw.slice(6) : raw;
  return payload.split(",").map((b) =>
    ["D", "U", "DU", "x"].includes(b) ? (b as StrumBeat) : "-"
  ) as StrumBeat[];
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

          if (line.type === "strum") {
            const beats = parseStrumBeats(line.text.trim());
            return (
              <View key={i} style={styles.strumRow}>
                {beats.map((beat, bi) => (
                  <React.Fragment key={bi}>
                    {bi === 4 && (
                      <View style={[styles.strumBarDiv, { backgroundColor: colors.border }]} />
                    )}
                    <View
                      style={[
                        styles.strumBeat,
                        {
                          backgroundColor:
                            beat === "-" ? "transparent"
                            : beat === "x" ? `${colors.destructive}18`
                            : `${colors.primary}18`,
                          borderColor:
                            beat === "-" ? `${colors.border}88`
                            : beat === "x" ? `${colors.destructive}66`
                            : `${colors.primary}66`,
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
                            opacity: beat === "-" ? 0.3 : 1,
                          },
                        ]}
                      >
                        {BEAT_SYMBOL[beat]}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            );
          }

          if (line.type === "note") {
            const noteText = line.text.startsWith("NOTE:") ? line.text.slice(5) : line.text;
            return (
              <View key={i} style={styles.noteRow}>
                <Text style={[styles.noteDot, { color: colors.mutedForeground }]}>ℹ</Text>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {noteText}
                </Text>
              </View>
            );
          }

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
  spacer: { height: 12 },

  sectionHeader: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    letterSpacing: 1, textTransform: "uppercase",
    marginTop: 16, marginBottom: 4,
  },
  chordLine: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5, lineHeight: 22,
  },
  tabLine: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    letterSpacing: 0.5, lineHeight: 20,
  },
  lyricLine: {
    fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24,
  },

  // Strum
  strumRow: {
    flexDirection: "row", alignItems: "center",
    gap: 3, marginVertical: 4, flexWrap: "nowrap",
  },
  strumBarDiv: { width: 1.5, height: 24, borderRadius: 1, marginHorizontal: 1 },
  strumBeat: {
    width: 26, height: 30, borderRadius: 6, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  strumBeatText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Note
  noteRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 6, marginVertical: 2,
  },
  noteDot: { fontSize: 12, lineHeight: 20, opacity: 0.6 },
  noteText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    fontStyle: "italic", lineHeight: 20, flex: 1,
  },
});
