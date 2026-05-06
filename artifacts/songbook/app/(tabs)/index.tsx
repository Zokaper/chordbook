import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
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

import { SongCard } from "@/components/SongCard";
import { Song, useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

const GENRES = [
  "All",
  "Rock",
  "Pop",
  "Folk",
  "Blues",
  "Jazz",
  "Country",
  "R&B",
  "Metal",
  "Indie",
  "Other",
];

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { songs, deleteSong, loading } = useSongs();
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered = songs.filter((s: Song) => {
    const matchesSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = activeGenre === "All" || s.genre === activeGenre;
    return matchesSearch && matchesGenre;
  });

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

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search songs..."
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

        <FlatList
          data={GENRES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(g) => g}
          contentContainerStyle={styles.genreList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveGenre(item)}
              style={[
                styles.genreChip,
                {
                  backgroundColor:
                    activeGenre === item ? colors.primary : colors.secondary,
                  borderColor:
                    activeGenre === item ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.genreChipText,
                  {
                    color:
                      activeGenre === item
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                    fontFamily:
                      activeGenre === item
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                  },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
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
                  Tap the + button to add your first song
                </Text>
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
  genreList: {
    gap: 8,
    paddingBottom: 2,
  },
  genreChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  genreChipText: {
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
});
