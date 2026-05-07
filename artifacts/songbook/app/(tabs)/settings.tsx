import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

interface BackupData {
  version: number;
  exportedAt: string;
  songs: unknown[];
  chords: unknown[];
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setTheme, setSortBy } = useSettings();
  const { songs, clearAllSongs, importSongs } = useSongs();
  const { chords, importChords } = useChords();
  const [importing, setImporting] = useState(false);

  const isStandalonePWA =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)").matches;
  const topPadding = Platform.OS === "web"
    ? isStandalonePWA ? Math.max(insets.top, 24) : 67
    : insets.top;
  const bottomPadding = Platform.OS === "web"
    ? (isStandalonePWA ? Math.max(insets.bottom, 16) : 34) + 60
    : insets.bottom + 60;

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const data: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      songs,
      chords,
    };
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `songbook-backup-${date}.json`;

    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert(
        "Export not available",
        "Open this app in a browser to export your library as a backup file."
      );
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Import not available",
        "Open this app in a browser to import a backup file."
      );
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Partial<BackupData>;

        if (!Array.isArray(data.songs)) {
          Alert.alert(
            "Invalid backup",
            "This file doesn't look like a Songbook backup. No songs found."
          );
          return;
        }

        const songCount = data.songs.length;
        const chordCount = Array.isArray(data.chords) ? data.chords.length : 0;
        const exportDate = data.exportedAt
          ? new Date(data.exportedAt).toLocaleDateString()
          : "unknown date";

        Alert.alert(
          "Restore backup?",
          `This backup from ${exportDate} contains ${songCount} song${songCount !== 1 ? "s" : ""}${chordCount > 0 ? ` and ${chordCount} chord${chordCount !== 1 ? "s" : ""}` : ""}.\n\nYour current library will be replaced. This cannot be undone.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Restore",
              style: "destructive",
              onPress: async () => {
                await importSongs(data.songs!);
                if (Array.isArray(data.chords)) {
                  await importChords(data.chords);
                }
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
                Alert.alert(
                  "Restored",
                  `${songCount} song${songCount !== 1 ? "s" : ""} have been restored to your library.`
                );
              },
            },
          ]
        );
      } catch {
        Alert.alert(
          "Import failed",
          "Could not read the file. Make sure it's a valid Songbook backup."
        );
      } finally {
        setImporting(false);
      }
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // ── Delete all ──────────────────────────────────────────────────────────────
  const handleClearSongs = () => {
    Alert.alert(
      "Delete all songs?",
      `This permanently removes all ${songs.length} song${songs.length === 1 ? "" : "s"} from your library. This cannot be undone.`,
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
          { paddingTop: topPadding + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.appName, { color: colors.foreground }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
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
                        backgroundColor: active ? colors.primary : colors.secondary,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={13}
                      color={active ? colors.primaryForeground : colors.secondaryForeground}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: active ? colors.primaryForeground : colors.secondaryForeground,
                          fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
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
                        backgroundColor: active ? colors.primary : colors.secondary,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: active ? colors.primaryForeground : colors.secondaryForeground,
                          fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
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
          <StatRow icon="music" label="Songs" value={String(songs.length)} colors={colors} />
          <StatRow icon="grid" label="Saved chords" value={String(chords.length)} colors={colors} />
        </Section>

        {/* Backup & Restore */}
        <Section label="Backup & Restore" colors={colors}>
          <Text style={[styles.backupHint, { color: colors.mutedForeground }]}>
            Export your library to a file you can save anywhere. Import it later to restore everything — songs, chords, and all.
          </Text>

          <View style={styles.backupRow}>
            <Pressable
              onPress={handleExport}
              disabled={songs.length === 0 && chords.length === 0}
              style={({ pressed }) => [
                styles.backupBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity:
                    songs.length === 0 && chords.length === 0
                      ? 0.4
                      : pressed
                      ? 0.75
                      : 1,
                },
              ]}
            >
              <Feather name="download" size={17} color={colors.primary} />
              <Text style={[styles.backupBtnText, { color: colors.primary }]}>
                Export
              </Text>
            </Pressable>

            <Pressable
              onPress={handleImport}
              disabled={importing}
              style={({ pressed }) => [
                styles.backupBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: importing ? 0.5 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name="upload" size={17} color={colors.foreground} />
              <Text style={[styles.backupBtnText, { color: colors.foreground }]}>
                {importing ? "Importing…" : "Import"}
              </Text>
            </Pressable>
          </View>
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
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  content: { padding: 16, gap: 22 },
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
  rowColumn: { flexDirection: "column", alignItems: "flex-start" },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  segmentText: { fontSize: 12 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  statLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Backup ────────────────────────────────────────────────────────────────
  backupHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  backupRow: { flexDirection: "row", gap: 10 },
  backupBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  backupBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Danger ────────────────────────────────────────────────────────────────
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  dangerText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
  },
});
