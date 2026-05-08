import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";


import { SongCard } from "@/components/SongCard";
import { useChords } from "@/context/ChordContext";
import { useSettings, type SortBy } from "@/context/SettingsContext";
import { Song, useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useTabScreenBottomPadding } from "@/hooks/useTopPadding";

const CHORD_TOKEN_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

function songContainsExactChord(content: string, chordName: string): boolean {
  for (const line of content.split("\n")) {
    if (line.startsWith("[")) continue;
    // New explicit CHORD: prefix format
    if (line.startsWith("CHORD:")) {
      if (line.slice(6).trim().split(/\s+/).includes(chordName)) return true;
      continue;
    }
    // ChordPro [chord] notation or legacy plain chord lines
    const chordPro = [...line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map((m) => m[1]);
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const isLegacyChordLine = tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_RE.test(t));
    const candidates = isLegacyChordLine ? tokens : chordPro;
    if (candidates.includes(chordName)) return true;
  }
  return false;
}

const SORT_LABELS: Record<SortBy, string> = {
  recent: "Recent",
  title: "Title",
  artist: "Artist",
};

export default function LibraryScreen() {
  const colors = useColors();
  const { songs, deleteSong, loading, allTags } = useSongs();
  const { chords } = useChords();
  const { settings, setSortBy } = useSettings();

  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeChords, setActiveChords] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const topPadding = useTopPadding();
  const bottomPadding = useTabScreenBottomPadding();

  // All unique keys across songs
  const allKeys = useMemo(
    () => [...new Set(songs.map((s) => s.key).filter(Boolean))].sort(),
    [songs]
  );

  // All unique chord names from library
  const allChordNames = useMemo(
    () => [...new Set(chords.map((c) => c.name))].sort(),
    [chords]
  );

  const activeFilterCount = activeTags.length + (activeKey ? 1 : 0) + activeChords.length;
  const hasFilters = activeFilterCount > 0;

  const filtered = useMemo(() => {
    const result = songs.filter((s: Song) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q);
      const matchesTags = activeTags.every((tag) => s.tags.includes(tag));
      const matchesKey = !activeKey || s.key === activeKey;
      const matchesChords = activeChords.every((chord) =>
        songContainsExactChord(s.content, chord)
      );
      return matchesSearch && matchesTags && matchesKey && matchesChords;
    });
    const sorted = [...result];
    switch (settings.sortBy) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "artist":
        sorted.sort((a, b) => {
          if (!a.artist && !b.artist) return 0;
          if (!a.artist) return 1;
          if (!b.artist) return -1;
          return a.artist.localeCompare(b.artist);
        });
        break;
      case "recent":
      default:
        sorted.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
    return sorted;
  }, [songs, search, activeTags, activeKey, activeChords, settings.sortBy]);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const toggleChord = (chord: string) =>
    setActiveChords((prev) =>
      prev.includes(chord) ? prev.filter((c) => c !== chord) : [...prev, chord]
    );

  const clearAllFilters = () => {
    setActiveTags([]);
    setActiveKey(null);
    setActiveChords([]);
    setSearch("");
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Song", "Are you sure you want to delete this song?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSong(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/editor");
  };

  const openSortMenu = () => {
    const order: SortBy[] = ["recent", "title", "artist"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...order.map((o) => `Sort by ${SORT_LABELS[o]}`), "Cancel"],
          cancelButtonIndex: order.length,
          title: "Sort songs",
        },
        (idx) => {
          if (idx >= 0 && idx < order.length) setSortBy(order[idx]);
        }
      );
    } else {
      Alert.alert("Sort songs", undefined, [
        ...order.map((o) => ({
          text: `Sort by ${SORT_LABELS[o]}`,
          onPress: () => setSortBy(o),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: topPadding + 12, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.appName, { color: colors.foreground }]}>Songbook</Text>
            <Text style={[styles.songCount, { color: colors.mutedForeground }]}>
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={openSortMenu}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="sliders" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <Feather name="plus" size={22} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        {/* ── Search bar (title / artist only) ── */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search title or artist..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <Pressable onPress={() => setSearch("")}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter toggle button */}
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            style={({ pressed }) => [
              styles.filterToggleBtn,
              {
                backgroundColor: showFilters || hasFilters ? colors.primary : colors.secondary,
                borderColor: showFilters || hasFilters ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="filter"
              size={16}
              color={showFilters || hasFilters ? colors.primaryForeground : colors.foreground}
            />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primaryForeground }]}>
                <Text style={[styles.filterBadgeText, { color: colors.primary }]}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Filter panel ── */}
        {showFilters && (
          <View style={[styles.filterPanel, { backgroundColor: `${colors.secondary}88`, borderColor: colors.border }]}>
            {/* Tags */}
            {allTags.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionLabel, { color: colors.mutedForeground }]}>Tags</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  <View style={styles.filterChipRow}>
                    {allTags.map((tag) => {
                      const active = activeTags.includes(tag);
                      return (
                        <Pressable
                          key={tag}
                          onPress={() => toggleTag(tag)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: active ? colors.primary : colors.secondary,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              { color: active ? colors.primaryForeground : colors.secondaryForeground },
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Key */}
            {allKeys.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionLabel, { color: colors.mutedForeground }]}>Key</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  <View style={styles.filterChipRow}>
                    {allKeys.map((key) => {
                      const active = activeKey === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => setActiveKey(active ? null : key)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: active ? colors.primary : colors.secondary,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              { color: active ? colors.primaryForeground : colors.secondaryForeground },
                            ]}
                          >
                            {key}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Chords */}
            {allChordNames.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionLabel, { color: colors.mutedForeground }]}>Chords</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  <View style={styles.filterChipRow}>
                    {allChordNames.map((name) => {
                      const active = activeChords.includes(name);
                      return (
                        <Pressable
                          key={name}
                          onPress={() => toggleChord(name)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: active ? colors.primary : colors.secondary,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              {
                                color: active ? colors.primaryForeground : colors.secondaryForeground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Clear all */}
            {hasFilters && (
              <Pressable onPress={clearAllFilters} style={styles.clearFiltersBtn}>
                <Feather name="x" size={12} color={colors.mutedForeground} />
                <Text style={[styles.clearFiltersText, { color: colors.mutedForeground }]}>
                  Clear all filters
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        renderItem={({ item }) => <SongCard song={item} onDelete={handleDelete} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? null : songs.length === 0 ? (
              <>
                <Feather name="music" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Your songbook is empty
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Start building your personal library
                </Text>
                <Pressable
                  onPress={handleCreate}
                  style={({ pressed }) => [
                    styles.emptyCta,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="plus" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.emptyCtaText, { color: colors.primaryForeground }]}>
                    Add your first song
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Feather name="search" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No results found
                </Text>
                {(hasFilters || search) && (
                  <Pressable onPress={clearAllFilters}>
                    <Text style={[styles.emptyText, { color: colors.primary }]}>
                      Clear all filters
                    </Text>
                  </Pressable>
                )}
              </>
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  songCount: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  addButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  // ── Search row ──────────────────────────────────────────────────────────────
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterToggleBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  filterBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },

  // ── Filter panel ────────────────────────────────────────────────────────────
  filterPanel: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  filterSection: { gap: 6 },
  filterSectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  filterChipRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  filterChip: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  clearFiltersBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 5, alignSelf: "flex-start",
    paddingVertical: 2,
  },
  clearFiltersText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { padding: 16 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyCta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, marginTop: 8,
  },
  emptyCtaText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
