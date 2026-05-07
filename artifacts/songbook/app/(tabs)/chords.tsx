import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChordCard } from "@/components/ChordCard";
import { ChordFingering, useChords } from "@/context/ChordContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

const CHORD_TOKEN_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

function chordsInContent(content: string): Set<string> {
  const names = new Set<string>();
  for (const line of content.split("\n")) {
    if (line.startsWith("[")) continue;
    const chordPro = [...line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map((m) => m[1]);
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const isChordLine = tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_RE.test(t));
    const hits = isChordLine ? tokens : chordPro;
    hits.forEach((h) => names.add(h));
  }
  return names;
}

interface ChordGroup {
  name: string;
  chords: ChordFingering[];
}

export default function ChordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chords, deleteChord } = useChords();
  const { songs } = useSongs();
  const [search, setSearch] = useState("");

  const isStandalonePWA =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)").matches;
  const topPadding = Platform.OS === "web"
    ? isStandalonePWA ? Math.max(insets.top, 24) : 67
    : insets.top;
  const bottomPadding = Platform.OS === "web" ? (isStandalonePWA ? Math.max(insets.bottom, 16) : 34) : 0;

  // Count how many songs use each chord name
  const songCountByName = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const song of songs) {
      const names = chordsInContent(song.content);
      names.forEach((name) => {
        counts[name] = (counts[name] ?? 0) + 1;
      });
    }
    return counts;
  }, [songs]);

  // Group chords by name (one card per unique name)
  const groups: ChordGroup[] = useMemo(() => {
    const filtered = chords.filter(
      (c: ChordFingering) => !search || c.name.toLowerCase().includes(search.toLowerCase())
    );
    const map = new Map<string, ChordFingering[]>();
    for (const c of filtered) {
      const arr = map.get(c.name) ?? [];
      arr.push(c);
      map.set(c.name, arr);
    }
    return Array.from(map.values()).map((arr) => ({ name: arr[0].name, chords: arr }));
  }, [chords, search]);

  const handleDeleteGroup = (group: ChordGroup) => {
    const label = group.chords.length > 1
      ? `Delete "${group.name}" and all ${group.chords.length} variations?`
      : `Remove "${group.name}" from your library?`;
    Alert.alert("Delete Chord", label, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          for (const c of group.chords) await deleteChord(c.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/chord-editor");
  };

  const renderItem = ({ item, index }: { item: ChordGroup; index: number }) => {
    if (index % 2 !== 0) return null;
    const next = groups[index + 1];
    return (
      <View style={styles.row}>
        <ChordCard
          chord={item.chords[0]}
          onLongPress={() => handleDeleteGroup(item)}
          songCount={songCountByName[item.name] ?? 0}
          variationCount={item.chords.length}
        />
        {next ? (
          <ChordCard
            chord={next.chords[0]}
            onLongPress={() => handleDeleteGroup(next)}
            songCount={songCountByName[next.name] ?? 0}
            variationCount={next.chords.length}
          />
        ) : (
          <View style={styles.emptySlot} />
        )}
      </View>
    );
  };

  const uniqueNames = groups.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: topPadding + 12, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>My Chords</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {uniqueNames} {uniqueNames === 1 ? "chord" : "chords"}
              {chords.length > uniqueNames ? ` · ${chords.length} total fingerings` : ""}
            </Text>
          </View>
          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Feather name="plus" size={22} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search chords..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.name}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="music" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {chords.length === 0 ? "No chords yet" : "No results found"}
            </Text>
            {chords.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap + to build your chord library
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  emptySlot: { flex: 1, maxWidth: "48%" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
