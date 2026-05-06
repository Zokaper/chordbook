import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Song } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

interface SongCardProps {
  song: Song;
  onDelete?: (id: string) => void;
}

export function SongCard({ song, onDelete }: SongCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/song/${song.id}`);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.(song.id);
  };

  const lineCount = song.content
    ? song.content.split("\n").filter((l) => l.trim()).length
    : 0;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {song.title}
          </Text>
          {!!song.artist && (
            <Text
              style={[styles.artist, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {song.artist}
            </Text>
          )}
          <View style={styles.tags}>
            {!!song.key && (
              <View
                style={[styles.keyBadge, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.keyText, { color: colors.primaryForeground }]}>
                  {song.key}
                </Text>
              </View>
            )}
            {!!song.genre && (
              <View
                style={[styles.genreBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.genreText, { color: colors.secondaryForeground }]}>
                  {song.genre}
                </Text>
              </View>
            )}
            {!!song.tempo && (
              <Text style={[styles.tempo, { color: colors.mutedForeground }]}>
                {song.tempo} BPM
              </Text>
            )}
          </View>
        </View>
        <View style={styles.right}>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          {lineCount > 0 && (
            <Text style={[styles.lineCount, { color: colors.mutedForeground }]}>
              {lineCount} lines
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  right: {
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  artist: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  keyBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  keyText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  genreBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  genreText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  tempo: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  lineCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
