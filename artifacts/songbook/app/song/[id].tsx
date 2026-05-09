import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";


import { ChordDiagram } from "@/components/ChordDiagram";
import { ChordViewer } from "@/components/ChordViewer";
import { ChordFingering, useChords } from "@/context/ChordContext";
import { useSettings } from "@/context/SettingsContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useBottomPadding } from "@/hooks/useTopPadding";
import { transposeChord } from "@/utils/transposing";

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

  const addToken = (token: string) => {
    if (!seen.has(token)) {
      seen.add(token);
      const variants = library.filter((c) => c.name === token);
      if (variants.length > 0) result.push({ name: token, variants });
    }
  };

  for (const line of content.split("\n")) {
    if (line.startsWith("[")) continue;

    // New explicit CHORD: prefix format
    if (line.startsWith("CHORD:")) {
      line.slice(6).trim().split(/\s+/).filter(Boolean).forEach(addToken);
      continue;
    }

    // ChordPro [Am]word notation in lyric lines
    const chordProMatches = [...line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map((m) => m[1]);
    // Legacy: plain chord line detected by regex
    const lineTokens = line.trim().split(/\s+/).filter(Boolean);
    const isLegacyChordLine = lineTokens.length > 0 && lineTokens.every((t) => CHORD_TOKEN_RE.test(t));
    const tokens = isLegacyChordLine ? lineTokens : chordProMatches;
    tokens.forEach(addToken);
  }
  return result;
}

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getSong, deleteSong, updateSong } = useSongs();
  const { chords: chordLibrary } = useChords();
  const { settings } = useSettings();

  const song = getSong(id ?? "");

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    song?.chordVariants ?? {}
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [chordsPinned, setChordsPinned] = useState(false);
  const [warnTooltip, setWarnTooltip] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeleteConfirm(false);
    await deleteSong(song.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/");
  };

  const capoValue = song.capo ?? 0;

  const chordStripEl = chordGroups.length > 0 ? (
    <View style={[
      chordsPinned ? styles.pinnedStrip : styles.chordStrip,
      { borderColor: colors.border, backgroundColor: colors.card },
    ]}>
      <View style={styles.chordStripHeader}>
        <Text style={[styles.chordStripLabel, { color: colors.mutedForeground }]}>
          Chords used
          {chordGroups.some((g) => g.variants.length > 1) && (
            <Text style={{ fontFamily: "Inter_400Regular" }}> · tap to cycle</Text>
          )}
        </Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setChordsPinned((p) => !p); }}
          style={({ pressed }) => [
            styles.pinBtn,
            {
              backgroundColor: chordsPinned ? `${colors.primary}18` : colors.secondary,
              borderColor: chordsPinned ? `${colors.primary}44` : colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="anchor" size={13} color={chordsPinned ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.pinBtnText, { color: chordsPinned ? colors.primary : colors.mutedForeground }]}>
            {chordsPinned ? "Pinned" : "Pin"}
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chordStripRow}>
        {chordGroups.map(({ name, variants }) => {
          const selectedId = selectedVariants[name];
          const chord = variants.find((v) => v.id === selectedId) ?? variants[0];
          const variantIdx = variants.findIndex((v) => v.id === chord.id);
          const hasMultiple = variants.length > 1;
          const display = settings.capoLabelDisplay;
          const isStd = CHORD_TOKEN_RE.test(name);
          const transposed = capoValue > 0 && display !== "none" && isStd
            ? transposeChord(name, capoValue) : null;
          const showTransposed = transposed !== null && transposed !== name;
          const showWarn = capoValue > 0 && display !== "none" && !isStd;

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
                showLabel={display !== "real"}
                primaryColor={colors.primary}
                textColor={colors.foreground}
                gridColor={colors.border}
              />
              {showTransposed && (
                <Text style={[styles.stripTransposed, { color: colors.primary }]}>{transposed}</Text>
              )}
              {showWarn && (
                <Pressable
                  onPress={() => setWarnTooltip((w) => w === name ? null : name)}
                  style={[styles.warnBadge, { backgroundColor: `${colors.accent}22`, borderColor: `${colors.accent}50` }]}
                >
                  <Feather name="alert-triangle" size={10} color={colors.accent} />
                </Pressable>
              )}
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

      {warnTooltip && (
        <View style={[styles.warnTooltip, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}28` }]}>
          <Feather name="alert-triangle" size={12} color={colors.accent} />
          <Text style={[styles.warnTooltipText, { color: colors.mutedForeground }]}>
            "{warnTooltip}" is a custom chord name — it can't be transposed automatically.
          </Text>
        </View>
      )}
    </View>
  ) : null;

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
                {
                  backgroundColor: deleteConfirm ? `${colors.destructive}18` : colors.secondary,
                  borderWidth: deleteConfirm ? 1.5 : 0,
                  borderColor: deleteConfirm ? colors.destructive : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name={deleteConfirm ? "check" : "trash-2"}
                size={18}
                color={colors.destructive}
              />
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

      {chordsPinned && chordStripEl}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!chordsPinned && chordStripEl}

        <ChordViewer
          content={song.content}
          capo={settings.capoLabelLocation === "everywhere" ? (song.capo ?? 0) : 0}
          capoMode={settings.capoLabelDisplay}
        />
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
  pinnedStrip: {
    borderBottomWidth: 1, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0,
    paddingTop: 10, paddingBottom: 6, overflow: "hidden",
  },
  chordStripHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 8,
  },
  chordStripLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase",
    flex: 1,
  },
  pinBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pinBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  chordStripRow: { paddingHorizontal: 12, gap: 8, flexDirection: "row", alignItems: "flex-start" },
  chordStripItem: { alignItems: "center", gap: 4 },
  stripTransposed: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  variantBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  variantText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  warnBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
  },
  warnTooltip: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
  warnTooltipText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },
});
