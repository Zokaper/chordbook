import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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

const EMPTY_STRINGS: number[] = [0, 0, 0, 0, 0, 0];

type EditorState = Pick<ChordFingering, "strings" | "baseFret" | "barre">;

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"];

export default function ChordEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getChord, createChord, updateChord, deleteChord } = useChords();

  const existing = id ? getChord(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [state, setState] = useState<EditorState>({
    strings: existing?.strings ?? [...EMPTY_STRINGS],
    baseFret: existing?.baseFret ?? 1,
    barre: existing?.barre,
  });
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const canSave = name.trim().length > 0;

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
    } catch (e) {
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

  const handleClear = () => {
    setState((s) => ({
      ...s,
      strings: [...EMPTY_STRINGS],
      barre: undefined,
    }));
  };

  const shiftFret = (delta: number) => {
    setState((s) => {
      const newBase = Math.max(1, Math.min(12, s.baseFret + delta));
      const diff = newBase - s.baseFret;
      const newStrings = s.strings.map((v) =>
        v > 0 ? Math.max(1, v + diff) : v
      );
      const newBarre = s.barre
        ? { ...s.barre, fret: Math.max(1, s.barre.fret + diff) }
        : undefined;
      return { ...s, baseFret: newBase, strings: newStrings, barre: newBarre };
    });
  };

  const toggleBarre = () => {
    setState((s) => {
      if (s.barre) {
        return { ...s, barre: undefined };
      }
      return {
        ...s,
        barre: { fret: s.baseFret, from: 0, to: 5 },
      };
    });
  };

  const barreShift = (delta: number) => {
    if (!state.barre) return;
    setState((s) => {
      if (!s.barre) return s;
      const newFret = Math.max(s.baseFret, Math.min(s.baseFret + 3, s.barre.fret + delta));
      return { ...s, barre: { ...s.barre, fret: newFret } };
    });
  };

  const diagramWidth = Math.min(280, Platform.OS === "web" ? 280 : 300);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
            style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border }]}
            placeholder="Chord name (e.g. Am7)"
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
                {saving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPadding + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* String labels */}
        <View style={[styles.stringLabels, { width: diagramWidth }]}>
          {STRING_LABELS.map((lbl, i) => (
            <View key={i} style={styles.stringLabelWrap}>
              <Text style={[styles.stringLabel, { color: colors.mutedForeground }]}>
                {lbl}
              </Text>
            </View>
          ))}
        </View>

        {/* Interactive Diagram */}
        <View
          style={[
            styles.diagramWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
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

        {/* Hint */}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Tap a fret to place a finger · Tap the top row to mute/unmute a string
        </Text>

        {/* Controls */}
        <View style={styles.controls}>

          {/* Fret navigation */}
          <View style={styles.controlGroup}>
            <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
              POSITION
            </Text>
            <View style={styles.controlRow}>
              <Pressable
                onPress={() => shiftFret(-1)}
                disabled={state.baseFret <= 1}
                style={({ pressed }) => [
                  styles.controlBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: state.baseFret <= 1 ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </Pressable>
              <View style={[styles.fretDisplay, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.fretDisplayText, { color: colors.foreground }]}>
                  {state.baseFret === 1 ? "Open" : `Fret ${state.baseFret}`}
                </Text>
              </View>
              <Pressable
                onPress={() => shiftFret(1)}
                disabled={state.baseFret >= 12}
                style={({ pressed }) => [
                  styles.controlBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    opacity: state.baseFret >= 12 ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          {/* Barre toggle */}
          <View style={styles.controlGroup}>
            <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
              BARRE
            </Text>
            <View style={styles.controlRow}>
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
                  color={state.barre ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.barreToggleText,
                    { color: state.barre ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {state.barre ? "Barre On" : "Add Barre"}
                </Text>
              </Pressable>

              {state.barre && (
                <View style={styles.controlRow}>
                  <Pressable
                    onPress={() => barreShift(-1)}
                    style={({ pressed }) => [
                      styles.controlBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="chevron-left" size={18} color={colors.foreground} />
                  </Pressable>
                  <View style={[styles.fretDisplay, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.fretDisplayText, { color: colors.foreground }]}>
                      Fret {state.barre.fret}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => barreShift(1)}
                    style={({ pressed }) => [
                      styles.controlBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="chevron-right" size={18} color={colors.foreground} />
                  </Pressable>
                </View>
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
            <Feather name="refresh-ccw" size={16} color={colors.mutedForeground} />
            <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>
              Clear diagram
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

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
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    borderBottomWidth: 1.5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  saveBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  stringLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  stringLabelWrap: {
    alignItems: "center",
  },
  stringLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  diagramWrap: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  controls: {
    width: "100%",
    gap: 20,
    marginTop: 8,
  },
  controlGroup: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fretDisplay: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: "center",
  },
  fretDisplayText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  barreToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  barreToggleText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
