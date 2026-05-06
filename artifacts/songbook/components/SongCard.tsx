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
import { relativeTime } from "@/utils/relativeTime";

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

  const visibleTags = song.tags.slice(0, 3);
  const extraTagCount = song.tags.length - visibleTags.length;

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
            {visibleTags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tagBadge,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.tagText, { color: colors.secondaryForeground }]}
                >
                  {tag}
                </Text>
              </View>
            ))}
            {extraTagCount > 0 && (
              <Text style={[styles.tempo, { color: colors.mutedForeground }]}>
                +{extraTagCount}
              </Text>
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
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {relativeTime(song.updatedAt)}
          </Text>
          {lineCount > 0 && (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
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
    alignItems: "flex-end",
    gap: 2,
    minWidth: 60,
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
    flexWrap: "wrap",
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
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  tempo: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
