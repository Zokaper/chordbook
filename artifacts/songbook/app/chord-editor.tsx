import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChordDiagramEditor } from "@/components/ChordDiagramEditor";
import { ChordFingering, useChords } from "@/context/ChordContext";
import { useColors } from "@/hooks/useColors";

type EditorState = Pick<ChordFingering, "strings" | "baseFret" | "barre">;

const EMPTY: EditorState = {
  strings: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  barre: undefined,
};

export default function ChordEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getChord, createChord, updateChord, deleteChord } = useChords();

  const existing = id ? getChord(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [state, setState] = useState<EditorState>(
    existing
      ? { strings: existing.strings, baseFret: existing.baseFret, barre: existing.barre }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const canSave = name.trim().length > 0;

  // Diagram fills the screen width minus padding
  const diagramWidth = Math.min(320, (Platform.OS === "web" ? 390 : 420) - 32);

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

  const handleDelete = () => {
    if (!id) return;
    Alert.alert("Delete Chord", "Remove this chord from your library?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteChord(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
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

          <TextInput
            style={[
              styles.nameInput,
              { color: colors.foreground, borderColor: colors.primary },
            ]}
            placeholder="Name (e.g. Am7, G, Fmaj9)"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            autoFocus={!isEdit}
          />

          <View style={styles.headerRight}>
            {isEdit && (
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </Pressable>
            )}
            <Pressable
              onPress={handleSave}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: canSave ? colors.primary : colors.muted,
                  opacity: pressed ? 0.8 : 1,
                },
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
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomPadding + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Interactive Diagram ── */}
        <View
          style={[
            styles.diagramCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
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
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="refresh-ccw" size={15} color={colors.mutedForeground} />
            <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>
              Clear diagram
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const NUM_FRETS = 4;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nameInput: {
    flex: 1,
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    borderBottomWidth: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  saveBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexShrink: 0,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  diagramCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  controls: {
    width: "100%",
    gap: 10,
  },
  controlRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  controlTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  controlInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valueDisplay: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: "center",
  },
  valueText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  barreToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  barreLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
