import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useChords } from "@/context/ChordContext";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  useSettings,
  type CapoLabelDisplay,
  type CapoLabelLocation,
  type SortBy,
  type ThemePref,
} from "@/context/SettingsContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useTabScreenBottomPadding } from "@/hooks/useTopPadding";

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

const CAPO_DISPLAY_OPTIONS: { value: CapoLabelDisplay; label: string }[] = [
  { value: "none", label: "Hide" },
  { value: "real", label: "Pitch only" },
  { value: "both", label: "Both" },
];

const CAPO_LOCATION_OPTIONS: { value: CapoLabelLocation; label: string }[] = [
  { value: "strip", label: "Chord strip" },
  { value: "everywhere", label: "Everywhere" },
];

interface BackupData {
  version: number;
  exportedAt: string;
  songs?: unknown[];
  chords?: unknown[];
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, setTheme, setSortBy, setCapoLabelDisplay, setCapoLabelLocation } = useSettings();
  const { songs, clearAllSongs, importSongs } = useSongs();
  const { chords, importChords, clearAllChords } = useChords();
  const { showOnboarding } = useOnboarding();
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const topPadding = useTopPadding();
  const bottomPadding = useTabScreenBottomPadding(24);

  const date = new Date().toISOString().slice(0, 10);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportSongs = () => {
    if (Platform.OS !== "web") return;
    downloadJson({ version: 1, exportedAt: new Date().toISOString(), songs }, `songbook-songs-${date}.json`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExportChords = () => {
    if (Platform.OS !== "web") return;
    downloadJson({ version: 1, exportedAt: new Date().toISOString(), chords }, `songbook-chords-${date}.json`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExportAll = () => {
    if (Platform.OS !== "web") return;
    downloadJson({ version: 1, exportedAt: new Date().toISOString(), songs, chords }, `songbook-backup-${date}.json`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = () => {
    if (Platform.OS !== "web") return;
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
        const songCount = Array.isArray(data.songs) ? data.songs.length : 0;
        const chordCount = Array.isArray(data.chords) ? data.chords.length : 0;
        const exportDate = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : "unknown date";

        setConfirm({
          title: "Restore backup?",
          message: `Backup from ${exportDate}: ${songCount} song${songCount !== 1 ? "s" : ""}${chordCount > 0 ? ` and ${chordCount} chord${chordCount !== 1 ? "s" : ""}` : ""}.\n\nYour current library will be replaced.`,
          confirmLabel: "Restore",
          onConfirm: async () => {
            if (songCount > 0) await importSongs(data.songs!);
            if (chordCount > 0) await importChords(data.chords!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        });
      } catch {
        // silently ignore bad files
      } finally {
        setImporting(false);
      }
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const askDeleteSongs = () => {
    setConfirm({
      title: "Delete all songs?",
      message: `This permanently removes all ${songs.length} song${songs.length === 1 ? "" : "s"}. This cannot be undone.`,
      confirmLabel: "Delete all",
      onConfirm: async () => {
        await clearAllSongs();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  };

  const askDeleteChords = () => {
    setConfirm({
      title: "Delete all chords?",
      message: `This permanently removes all ${chords.length} chord${chords.length === 1 ? "" : "s"} from your library. This cannot be undone.`,
      confirmLabel: "Delete all",
      onConfirm: async () => {
        await clearAllChords();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  };

  const askDeleteEverything = () => {
    setConfirm({
      title: "Delete everything?",
      message: `This permanently removes all ${songs.length} song${songs.length === 1 ? "" : "s"} and ${chords.length} chord${chords.length === 1 ? "" : "s"}. This cannot be undone.`,
      confirmLabel: "Delete everything",
      onConfirm: async () => {
        await clearAllSongs();
        await clearAllChords();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  };

  const exportUnavailable = Platform.OS !== "web";
  const nothingToExport = songs.length === 0 && chords.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.appName, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <Section label="Appearance" colors={colors}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Theme</Text>
            <View style={styles.segmented}>
              {THEME_OPTIONS.map((opt) => {
                const active = settings.theme === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { Haptics.selectionAsync(); setTheme(opt.value); }}
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
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Sort songs by</Text>
            <View style={[styles.segmented, { marginTop: 4 }]}>
              {SORT_OPTIONS.map((opt) => {
                const active = settings.sortBy === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { Haptics.selectionAsync(); setSortBy(opt.value); }}
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

        {/* Capo labels */}
        <Section label="Capo labels" colors={colors}>
          <View style={[styles.row, styles.rowColumn]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>What to show</Text>
            <View style={[styles.segmented, { marginTop: 4 }]}>
              {CAPO_DISPLAY_OPTIONS.map((opt) => {
                const active = settings.capoLabelDisplay === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { Haptics.selectionAsync(); setCapoLabelDisplay(opt.value); }}
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
          <View style={[styles.row, styles.rowColumn]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Where to show</Text>
            <View style={[styles.segmented, { marginTop: 4 }]}>
              {CAPO_LOCATION_OPTIONS.map((opt) => {
                const active = settings.capoLabelLocation === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { Haptics.selectionAsync(); setCapoLabelLocation(opt.value); }}
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
          {exportUnavailable ? (
            <Text style={[styles.backupHint, { color: colors.mutedForeground }]}>
              Open this app in a browser to export or import your library.
            </Text>
          ) : (
            <Text style={[styles.backupHint, { color: colors.mutedForeground }]}>
              Export your library as JSON files to save anywhere. Import to restore.
            </Text>
          )}

          <View style={styles.exportGrid}>
            <ExportBtn
              label="Songs"
              icon="music"
              disabled={exportUnavailable || songs.length === 0}
              onPress={handleExportSongs}
              colors={colors}
            />
            <ExportBtn
              label="Chords"
              icon="grid"
              disabled={exportUnavailable || chords.length === 0}
              onPress={handleExportChords}
              colors={colors}
            />
            <ExportBtn
              label="Everything"
              icon="archive"
              disabled={exportUnavailable || nothingToExport}
              onPress={handleExportAll}
              colors={colors}
            />
            <ExportBtn
              label={importing ? "Importing…" : "Import"}
              icon="upload"
              disabled={exportUnavailable || importing}
              onPress={handleImport}
              colors={colors}
              tint="foreground"
            />
          </View>
        </Section>

        {/* Getting started */}
        <Section label="Getting started" colors={colors}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); showOnboarding(); }}
            style={({ pressed }) => [styles.replayRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.statLeft}>
              <Feather name="play-circle" size={15} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Replay intro</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </Section>

        {/* Danger zone */}
        <Section label="Danger zone" colors={colors}>
          <DangerBtn
            label="Delete all songs"
            disabled={songs.length === 0}
            onPress={askDeleteSongs}
            colors={colors}
          />
          <View style={[styles.innerDivider, { backgroundColor: colors.border }]} />
          <DangerBtn
            label="Delete all chords"
            disabled={chords.length === 0}
            onPress={askDeleteChords}
            colors={colors}
          />
          <View style={[styles.innerDivider, { backgroundColor: colors.border }]} />
          <DangerBtn
            label="Delete everything"
            disabled={songs.length === 0 && chords.length === 0}
            onPress={askDeleteEverything}
            colors={colors}
          />
        </Section>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Songbook · made for musicians
        </Text>
      </ScrollView>

      <ConfirmModal
        visible={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        destructive
        onConfirm={async () => {
          await confirm?.onConfirm();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  label, colors, children,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function StatRow({
  icon, label, value, colors,
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

function ExportBtn({
  label, icon, disabled, onPress, colors, tint = "primary",
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  disabled: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  tint?: "primary" | "foreground";
}) {
  const color = tint === "primary" ? colors.primary : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.exportBtn,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          opacity: disabled ? 0.38 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.exportBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function DangerBtn({
  label, disabled, onPress, colors,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.dangerRow, { opacity: disabled ? 0.38 : pressed ? 0.7 : 1 }]}
    >
      <Feather name="trash-2" size={15} color={colors.destructive} />
      <Text style={[styles.dangerRowText, { color: colors.destructive }]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  content: { padding: 16, gap: 22 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 4,
  },
  sectionBody: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowColumn: { flexDirection: "column", alignItems: "flex-start" },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segment: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6,
  },
  segmentText: { fontSize: 12 },

  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  statLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  backupHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  exportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  exportBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  replayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },

  innerDivider: { height: 1, opacity: 0.5, marginHorizontal: -14 },
  dangerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  dangerRowText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  footer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
});
