import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {

  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";


import { ChordDiagram } from "@/components/ChordDiagram";
import { ChordDiagramEditor } from "@/components/ChordDiagramEditor";
import { ChordFingering, useChords } from "@/context/ChordContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useBottomPadding } from "@/hooks/useTopPadding";

type EditorState = Pick<ChordFingering, "strings" | "baseFret" | "barre">;

const EMPTY: EditorState = {
  strings: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  barre: undefined,
};

const CHORD_TOKEN_RE =
  /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;

function songContainsChordName(content: string, chordName: string): boolean {
  for (const line of content.split("\n")) {
    if (line.startsWith("[")) continue;
    const chordPro = [...line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map((m) => m[1]);
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const isChordLine = tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_RE.test(t));
    const candidates = isChordLine ? tokens : chordPro;
    if (candidates.includes(chordName)) return true;
  }
  return false;
}

const NUM_FRETS = 4;

export default function ChordEditorScreen() {
  // accept both ?id=... (edit) and ?name=... (new with pre-filled name for variations)
  const { id, name: nameProp } = useLocalSearchParams<{ id?: string; name?: string }>();
  const colors = useColors();
  const { getChord, getChordsByName, createChord, updateChord, deleteChord } = useChords();
  const { songs } = useSongs();

  const existing = id ? getChord(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? nameProp ?? "");
  const [state, setState] = useState<EditorState>(
    existing
      ? { strings: existing.strings, baseFret: existing.baseFret, barre: existing.barre }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const topPadding = useTopPadding();
  const bottomPadding = useBottomPadding();
  const canSave = name.trim().length > 0;
  const isNonStandard = canSave && !CHORD_TOKEN_RE.test(name.trim());
  const diagramWidth = 220;

  // Other variations (same chord name, different id)
  const variations: ChordFingering[] = useMemo(() => {
    if (!isEdit || !existing) return [];
    return getChordsByName(existing.name).filter((c) => c.id !== id);
  }, [isEdit, existing, getChordsByName, id]);

  // Songs that use this chord name
  const songsUsingChord = useMemo(() => {
    if (!isEdit || !existing) return [];
    return songs.filter((s) => songContainsChordName(s.content, existing.name));
  }, [songs, isEdit, existing]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const data = { name: name.trim(), ...state };
      if (isEdit && id) {
        await updateChord(id, data);
      } else {
        await createChord(data);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteChord(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const shiftFret = (delta: number) => {
    setState((s) => {
      const newBase = Math.max(1, Math.min(12, s.baseFret + delta));
      if (newBase === s.baseFret) return s;
      const diff = newBase - s.baseFret;
      const newStrings = s.strings.map((v) => (v > 0 ? Math.max(1, v + diff) : v));
      const newBarre = s.barre
        ? { ...s.barre, fret: Math.max(1, s.barre.fret + diff) }
        : undefined;
      return { baseFret: newBase, strings: newStrings, barre: newBarre };
    });
  };

  const toggleBarre = () => {
    setState((s) => {
      if (s.barre) return { ...s, barre: undefined };
      return { ...s, barre: { fret: s.baseFret, from: 0, to: 5 } };
    });
  };

  const shiftBarreFret = (delta: number) => {
    setState((s) => {
      if (!s.barre) return s;
      const newFret = Math.max(s.baseFret, Math.min(s.baseFret + NUM_FRETS - 1, s.barre.fret + delta));
      return { ...s, barre: { ...s.barre, fret: newFret } };
    });
  };

  const handleClear = () => {
    setState((s) => ({ ...s, strings: [0, 0, 0, 0, 0, 0], barre: undefined }));
  };

  const handleAddVariation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chord-editor?name=${encodeURIComponent(name.trim())}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
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
        {/* Row 1: back + actions always visible */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {isEdit && (
            confirmDelete ? (
              <>
                <Text style={[styles.confirmText, { color: colors.destructive }]}>Delete?</Text>
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: `${colors.destructive}22`, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="check" size={18} color={colors.destructive} />
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirmDelete(true); }}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </Pressable>
            )
          )}

          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: canSave ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                { color: canSave ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>

        {/* Row 2: name input full-width */}
        <TextInput
          style={[styles.nameInput, { color: colors.foreground, borderColor: isNonStandard ? colors.accent : colors.primary }]}
          placeholder="Name (e.g. Am7, G, Fmaj9)"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          autoFocus={!isEdit}
        />
        {isNonStandard && (
          <View style={[styles.nonStdWarning, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}35` }]}>
            <Feather name="alert-triangle" size={13} color={colors.accent} />
            <Text style={[styles.nonStdWarningText, { color: colors.mutedForeground }]}>
              Custom name — this chord won't be auto-transposed when a capo is set.
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Interactive Diagram ── */}
        <View style={[styles.diagramCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ChordDiagramEditor
            value={state}
            onChange={setState}
            width={diagramWidth}
            primaryColor={colors.primary}
            textColor={colors.foreground}
            gridColor={colors.border}
            mutedColor={colors.destructive}
          />
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Tap a fret to place a finger · Tap a string name to mute it
        </Text>

        {/* ── Controls ── */}
        <View style={styles.controls}>
          {/* Fret Position */}
          <View style={[styles.controlRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.controlTitle, { color: colors.mutedForeground }]}>Position</Text>
            <View style={styles.controlInner}>
              <Pressable
                onPress={() => shiftFret(-1)}
                disabled={state.baseFret <= 1}
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: state.baseFret <= 1 ? 0.3 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </Pressable>
              <View style={[styles.valueDisplay, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.valueText, { color: colors.foreground }]}>
                  {state.baseFret === 1 ? "Open" : `Fret ${state.baseFret}`}
                </Text>
              </View>
              <Pressable
                onPress={() => shiftFret(1)}
                disabled={state.baseFret >= 12}
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: state.baseFret >= 12 ? 0.3 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chevron-right" size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          {/* Barre */}
          <View style={[styles.controlRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.controlTitle, { color: colors.mutedForeground }]}>Barre</Text>
            <View style={styles.controlInner}>
              <Pressable
                onPress={toggleBarre}
                style={({ pressed }) => [
                  styles.barreToggle,
                  {
                    backgroundColor: state.barre ? colors.primary : colors.secondary,
                    borderColor: state.barre ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name={state.barre ? "check-square" : "square"}
                  size={16}
                  color={state.barre ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.barreLabel, { color: state.barre ? colors.primaryForeground : colors.foreground }]}>
                  {state.barre ? "On" : "Off"}
                </Text>
              </Pressable>
              {state.barre && (
                <>
                  <Pressable
                    onPress={() => shiftBarreFret(-1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="chevron-left" size={20} color={colors.foreground} />
                  </Pressable>
                  <View style={[styles.valueDisplay, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.valueText, { color: colors.foreground }]}>
                      Fret {state.barre.fret}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => shiftBarreFret(1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="chevron-right" size={20} color={colors.foreground} />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Clear */}
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="refresh-ccw" size={15} color={colors.mutedForeground} />
            <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>Clear diagram</Text>
          </Pressable>
        </View>

        {/* ── Variations ── */}
        {isEdit && (
          <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                Variations of "{existing?.name}"
              </Text>
              <Pressable
                onPress={handleAddVariation}
                style={({ pressed }) => [
                  styles.addVariationBtn,
                  { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44`, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="plus" size={13} color={colors.primary} />
                <Text style={[styles.addVariationText, { color: colors.primary }]}>Add variation</Text>
              </Pressable>
            </View>

            {/* Current variation highlight */}
            <View style={styles.variationRow}>
              <View style={[styles.currentVariation, { borderColor: colors.primary, backgroundColor: `${colors.primary}08` }]}>
                <ChordDiagram
                  chord={{ ...state, name: name }}
                  width={72}
                  showLabel={false}
                  primaryColor={colors.primary}
                  textColor={colors.foreground}
                  gridColor={colors.border}
                />
                <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.currentBadgeText, { color: colors.primaryForeground }]}>Current</Text>
                </View>
              </View>

              {variations.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  <View style={styles.variationScroll}>
                    {variations.map((v) => (
                      <Pressable
                        key={v.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.replace(`/chord-editor?id=${v.id}`);
                        }}
                        style={({ pressed }) => [
                          styles.variationItem,
                          { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 },
                        ]}
                      >
                        <ChordDiagram
                          chord={v}
                          width={72}
                          showLabel={false}
                          primaryColor={colors.primary}
                          textColor={colors.foreground}
                          gridColor={colors.border}
                        />
                        <Text style={[styles.editVariationText, { color: colors.mutedForeground }]}>
                          Edit
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text style={[styles.noVariationsText, { color: colors.mutedForeground }]}>
                  Tap "Add variation" to create an alternative fingering
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Songs using this chord ── */}
        {isEdit && songsUsingChord.length > 0 && (
          <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              Used in {songsUsingChord.length} {songsUsingChord.length === 1 ? "song" : "songs"}
            </Text>
            <View style={styles.songList}>
              {songsUsingChord.map((song) => (
                <Pressable
                  key={song.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/song/${song.id}`);
                  }}
                  style={({ pressed }) => [
                    styles.songRow,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" },
                  ]}
                >
                  <View style={styles.songRowContent}>
                    <Text style={[styles.songTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {song.title}
                    </Text>
                    {!!song.artist && (
                      <Text style={[styles.songArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {song.artist}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  confirmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nameInput: {
    fontSize: 19, fontFamily: "Inter_600SemiBold",
    borderBottomWidth: 2, paddingVertical: 4, paddingHorizontal: 2,
  },
  saveBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, flexShrink: 0 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  nonStdWarning: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
  nonStdWarningText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },
  body: { alignItems: "center", paddingTop: 24, paddingHorizontal: 16, gap: 16 },
  diagramCard: { borderRadius: 20, borderWidth: 1, padding: 16, alignItems: "center" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 12 },
  controls: { width: "100%", gap: 10 },
  controlRow: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  controlTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  controlInner: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  stepBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  valueDisplay: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, minWidth: 100, alignItems: "center" },
  valueText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  barreToggle: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  barreLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, alignSelf: "flex-start" },
  clearBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    width: "100%", borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  addVariationBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  addVariationText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  variationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  currentVariation: { borderRadius: 12, borderWidth: 2, padding: 8, alignItems: "center", gap: 6 },
  currentBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  variationScroll: { flexDirection: "row", gap: 8 },
  variationItem: { borderRadius: 12, borderWidth: 1, padding: 8, alignItems: "center", gap: 4 },
  editVariationText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  noVariationsText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 18 },

  // ── Song list ─────────────────────────────────────────────────────────────
  songList: { gap: 2 },
  songRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  songRowContent: { flex: 1, gap: 1 },
  songTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  songArtist: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
