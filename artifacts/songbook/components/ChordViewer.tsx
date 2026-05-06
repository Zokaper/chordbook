import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ChordViewerProps {
  content: string;
}

type LineType = "section" | "chord" | "tab" | "lyric" | "empty";

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

  if (TAB_LINE_REGEX.test(trimmed)) return "tab";

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_REGEX.test(t))) {
    return "chord";
  }

  return "lyric";
}

export function ChordViewer({ content }: ChordViewerProps) {
  const colors = useColors();

  const lines = useMemo<ParsedLine[]>(() => {
    if (!content?.trim()) return [];
    return content.split("\n").map((line) => ({
      type: parseLine(line),
      text: line,
    }));
  }, [content]);

  if (!content?.trim()) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No content yet
        </Text>
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
          if (line.type === "empty") {
            return <View key={i} style={styles.spacer} />;
          }

          if (line.type === "section") {
            return (
              <Text
                key={i}
                style={[styles.sectionHeader, { color: colors.primary }]}
              >
                {line.text.trim()}
              </Text>
            );
          }

          if (line.type === "chord") {
            return (
              <Text
                key={i}
                style={[styles.chordLine, { color: colors.accent }]}
              >
                {line.text}
              </Text>
            );
          }

          if (line.type === "tab") {
            return (
              <Text
                key={i}
                style={[styles.tabLine, { color: colors.primary }]}
              >
                {line.text}
              </Text>
            );
          }

          return (
            <Text
              key={i}
              style={[styles.lyricLine, { color: colors.foreground }]}
            >
              {line.text || " "}
            </Text>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizontalScroll: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 2,
  },
  empty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  spacer: {
    height: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 4,
  },
  chordLine: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  tabLine: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  lyricLine: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
});
