import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";


import { ChordDiagram } from "@/components/ChordDiagram";
import { ChordViewer } from "@/components/ChordViewer";
import { ChordFingering, useChords } from "@/context/ChordContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useBottomPadding } from "@/hooks/useTopPadding";

const CHORD_TOKEN_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

interface ChordGroup {
  name: string;
  variants: ChordFingering[];
}

function extractChordGroups(
  content: string,
  library: ChordFingering[]
): ChordGroup[] {
  const seen = new Set<string>();
  const result: ChordGroup[] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith("[")) continue;

    // Collect chord names from chord lines and ChordPro [chord] markers
    const chordProMatches = [...line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map((m) => m[1]);
    const lineTokens = line.trim().split(/\s+/).filter(Boolean);
    const isChordLine = lineTokens.length > 0 && lineTokens.every((t) => CHORD_TOKEN_RE.test(t));
    const tokens = isChordLine ? lineTokens : chordProMatches;

    for (const token of tokens) {
      if (!seen.has(token)) {
        seen.add(token);
        const variants = library.filter((c) => c.name === token);
        if (variants.length > 0) result.push({ name: token, variants });
      }
    }
  }
  return result;
}

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getSong, deleteSong, updateSong } = useSongs();
  const { chords: chordLibrary } = useChords();

  const song = getSong(id ?? "");

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    song?.chordVariants ?? {}
  );

  const topPadding = useTopPadding();
  const bottomPadding = useBottomPadding();

  if (!song) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.foreground }]}>Song not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const chordGroups = extractChordGroups(song.content, chordLibrary);

  const cycleVariant = (name: string, variants: ChordFingering[]) => {
    if (variants.length <= 1) return;
    Haptics.selectionAsync();
    const currentId = selectedVariants[name];
    const currentIdx = variants.findIndex((v) => v.id === currentId);
    const nextIdx = (currentIdx + 1) % variants.length;
    const nextId = variants[nextIdx].id;
    const updated = { ...selectedVariants, [name]: nextId };
    setSelectedVariants(updated);
    updateSong(song.id, { chordVariants: updated });
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/editor?id=${song.id}`);
  };

  const handleDelete = () => {
    Alert.alert("Delete Song", `Delete "${song.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSong(song.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="trash-2" size={18} color={colors.destructive} />
            </Pressable>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                styles.editButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="edit-2" size={16} color={colors.primaryForeground} />
              <Text style={[styles.editButtonText, { color: colors.primaryForeground }]}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.songMeta}>
          <Text style={[styles.title, { color: colors.foreground }]}>{song.title}</Text>
          {!!song.artist && (
            <Text style={[styles.artist, { color: colors.mutedForeground }]}>{song.artist}</Text>
          )}
          <View style={styles.badges}>
            {!!song.key && (
              <View style={[styles.keyBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.keyText, { color: colors.primaryForeground }]}>{song.key}</Text>
              </View>
            )}
            {song.tags.map((tag) => (
              <View key={tag} style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>{tag}</Text>
              </View>
            ))}
            {!!song.tempo && (
              <View style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="activity" size={11} color={colors.mutedForeground} />
                <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>{song.tempo} BPM</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Chord diagram strip — grouped by name with variant cycling */}
        {chordGroups.length > 0 && (
          <View style={[styles.chordStrip, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.chordStripLabel, { color: colors.mutedForeground }]}>
              Chords used
              {chordGroups.some((g) => g.variants.length > 1) && (
                <Text style={{ fontFamily: "Inter_400Regular" }}> · tap to cycle variations</Text>
              )}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chordStripRow}
            >
              {chordGroups.map(({ name, variants }) => {
                const selectedId = selectedVariants[name];
                const chord = variants.find((v) => v.id === selectedId) ?? variants[0];
                const variantIdx = variants.findIndex((v) => v.id === chord.id);
                const hasMultiple = variants.length > 1;

                return (
                  <Pressable
                    key={name}
                    onPress={() => cycleVariant(name, variants)}
                    style={({ pressed }) => [
                      styles.chordStripItem,
                      {
                        opacity: pressed ? 0.75 : 1,
                        backgroundColor: hasMultiple ? `${colors.primary}08` : "transparent",
                        borderRadius: 10,
                        borderWidth: hasMultiple ? 1 : 0,
                        borderColor: `${colors.primary}22`,
                        padding: hasMultiple ? 4 : 0,
                      },
                    ]}
                  >
                    <ChordDiagram
                      chord={chord}
                      width={76}
                      showLabel
                      primaryColor={colors.primary}
                      textColor={colors.foreground}
                      gridColor={colors.border}
                    />
                    {hasMultiple && (
                      <View style={styles.variantBadge}>
                        <Feather name="refresh-cw" size={9} color={colors.primary} />
                        <Text style={[styles.variantText, { color: colors.primary }]}>
                          {variantIdx + 1}/{variants.length}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ChordViewer content={song.content} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_500Medium" },
  backLink: { fontSize: 15, fontFamily: "Inter_500Medium" },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  editButton: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 5,
  },
  editButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  songMeta: { gap: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  artist: { fontSize: 15, fontFamily: "Inter_400Regular" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  keyBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  keyText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  badge: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, gap: 4,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  chordStrip: {
    borderRadius: 12, borderWidth: 1,
    marginBottom: 20, paddingTop: 12, paddingBottom: 8, overflow: "hidden",
  },
  chordStripLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase",
    paddingHorizontal: 16, marginBottom: 8,
  },
  chordStripRow: { paddingHorizontal: 12, gap: 8, flexDirection: "row", alignItems: "flex-start" },
  chordStripItem: { alignItems: "center", gap: 4 },
  variantBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  variantText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
