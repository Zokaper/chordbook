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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SongCard } from "@/components/SongCard";
import { useSettings, type SortBy } from "@/context/SettingsContext";
import { Song, useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

const SORT_LABELS: Record<SortBy, string> = {
  recent: "Recent",
  title: "Title",
  artist: "Artist",
};

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { songs, deleteSong, loading, allTags } = useSongs();
  const { settings, setSortBy } = useSettings();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered = useMemo(() => {
    const result = songs.filter((s: Song) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = !activeTag || s.tags.includes(activeTag);
      return matchesSearch && matchesTag;
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
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
    return sorted;
  }, [songs, search, activeTag, settings.sortBy]);

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
        style={[
          styles.header,
          {
            paddingTop: topPadding + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.appName, { color: colors.foreground }]}>
              Songbook
            </Text>
            <Text style={[styles.songCount, { color: colors.mutedForeground }]}>
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={openSortMenu}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="sliders" size={18} color={colors.foreground} />
            </Pressable>
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
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search title, artist, or tag..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")}>
              <Feather
                name="x-circle"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        {allTags.length > 0 && (
          <FlatList
            data={["All", ...allTags]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g) => g}
            contentContainerStyle={styles.tagList}
            renderItem={({ item }) => {
              const isAll = item === "All";
              const active = isAll ? activeTag === null : activeTag === item;
              return (
                <Pressable
                  onPress={() => setActiveTag(isAll ? null : item)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.secondaryForeground,
                        fontFamily: active
                          ? "Inter_600SemiBold"
                          : "Inter_400Regular",
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPadding + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        renderItem={({ item }) => (
          <SongCard song={item} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? null : songs.length === 0 ? (
              <>
                <Feather
                  name="music"
                  size={48}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                >
                  Your songbook is empty
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  Start building your personal library
                </Text>
                <Pressable
                  onPress={handleCreate}
                  style={({ pressed }) => [
                    styles.emptyCta,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather name="plus" size={16} color={colors.primaryForeground} />
                  <Text
                    style={[
                      styles.emptyCtaText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Add your first song
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Feather
                  name="search"
                  size={40}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                >
                  No results found
                </Text>
                {(activeTag || search) && (
                  <Pressable
                    onPress={() => {
                      setActiveTag(null);
                      setSearch("");
                    }}
                  >
                    <Text style={[styles.emptyText, { color: colors.primary }]}>
                      Clear filters
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  songCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  tagList: {
    gap: 8,
    paddingBottom: 2,
  },
  tagChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 13,
  },
  list: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 8,
  },
  emptyCtaText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
