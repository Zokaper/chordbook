import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTopPadding, useBottomPadding } from "@/hooks/useTopPadding";

interface HelpSection {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  bullets: string[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    icon: "music",
    title: "Chords",
    bullets: [
      "Tap + to pick a chord from your library",
      "Tap an existing chip to replace it",
      "Long-press a chip to remove it",
    ],
  },
  {
    icon: "align-left",
    title: "Lyrics",
    bullets: [
      "Free-form text — type anything",
      "Use [Am]word notation to embed chords over syllables",
      "A chord palette appears while typing if chords exist in the song",
    ],
  },
  {
    icon: "activity",
    title: "Strum",
    bullets: [
      "Tap a beat cell to cycle: — → ↓ → ↑ → ↕ → ✕",
      "Tap ×N to change how many times the pattern repeats",
      "Use + beat / − beat to adjust the bar length",
    ],
  },
  {
    icon: "chevrons-down",
    title: "Strum: chord options",
    bullets: [
      "Tap the ⌄ expand button on any strum line to reveal chord options",
      "Beat labels: tap any slot above the beat grid to assign a chord change at that beat",
      "Chord cycle: tap + chord to label each repeat pass with a different chord (Am → G → F → C)",
    ],
  },
  {
    icon: "sliders",
    title: "Riff",
    bullets: [
      "6-string fret grid — tap a cell to set a fret number (0–9)",
      "Tap again to cycle through articulations (h p / \\)",
      "Use + / − to add or remove columns",
    ],
  },
  {
    icon: "message-square",
    title: "Note",
    bullets: [
      "Italic annotation shown beneath the section in the viewer",
      "Great for reminders: 'palm mute', 'capo 2', 'swing feel'",
    ],
  },
];

interface Props {
  onClose: () => void;
}

export function EditorHelpSheet({ onClose }: Props) {
  const colors = useColors();
  const topPadding = useTopPadding();
  const bottomPadding = useBottomPadding(24);

  return (
    <View style={[styles.overlay, { backgroundColor: `${colors.background}cc` }]}>
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: topPadding + 14, borderBottomColor: colors.border },
          ]}
        >
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="help-circle" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Editor guide
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {HELP_SECTIONS.map((sec) => (
            <View
              key={sec.title}
              style={[styles.section, { borderColor: colors.border }]}
            >
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Feather name={sec.icon} size={14} color={colors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {sec.title}
                </Text>
              </View>
              <View style={styles.bullets}>
                {sec.bullets.map((b, i) => (
                  <View key={i} style={styles.bullet}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bullets: { gap: 7 },
  bullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    flexShrink: 0,
    opacity: 0.6,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
