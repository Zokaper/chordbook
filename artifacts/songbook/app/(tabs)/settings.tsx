import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChords } from "@/context/ChordContext";
import {
  useSettings,
  type SortBy,
  type ThemePref,
} from "@/context/SettingsContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "system", label: "System", icon: "smartphone" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Recently edited" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setTheme, setSortBy } = useSettings();
  const { songs, clearAllSongs } = useSongs();
  const { chords } = useChords();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const handleClearSongs = () => {
    Alert.alert(
      "Delete all songs?",
      `This permanently removes all ${songs.length} song${
        songs.length === 1 ? "" : "s"
      } from your library. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: async () => {
            await clearAllSongs();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
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
        <Text style={[styles.appName, { color: colors.foreground }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <Section label="Appearance" colors={colors}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Theme
            </Text>
            <View style={styles.segmented}>
              {THEME_OPTIONS.map((opt) => {
                const active = settings.theme === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTheme(opt.value);
                    }}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.secondary,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={13}
                      color={
                        active
                          ? colors.primaryForeground
                          : colors.secondaryForeground
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
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
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Library */}
        <Section label="Library" colors={colors}>
          <View style={[styles.row, styles.rowColumn]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Sort songs by
            </Text>
            <View style={[styles.segmented, { marginTop: 4 }]}>
              {SORT_OPTIONS.map((opt) => {
                const active = settings.sortBy === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy(opt.value);
                    }}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.secondary,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
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
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Stats */}
        <Section label="Your library" colors={colors}>
          <StatRow
            icon="music"
            label="Songs"
            value={String(songs.length)}
            colors={colors}
          />
          <StatRow
            icon="grid"
            label="Saved chords"
            value={String(chords.length)}
            colors={colors}
          />
        </Section>

        {/* Danger zone */}
        <Section label="Danger zone" colors={colors}>
          <Pressable
            onPress={handleClearSongs}
            disabled={songs.length === 0}
            style={({ pressed }) => [
              styles.dangerBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.destructive,
                opacity: songs.length === 0 ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.dangerText, { color: colors.destructive }]}>
              Delete all songs
            </Text>
          </Pressable>
        </Section>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Songbook · made for musicians
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.sectionBody,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        <Feather name={icon} size={15} color={colors.mutedForeground} />
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.mutedForeground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  content: {
    padding: 16,
    gap: 22,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  sectionBody: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowColumn: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  segmentText: {
    fontSize: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  statLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  dangerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
  },
});
