import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChordDiagram } from "@/components/ChordDiagram";
import { useChords } from "@/context/ChordContext";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm", "G#m", "Abm", "Bbm",
];

const GENRES = [
  "Rock", "Pop", "Folk", "Blues", "Jazz",
  "Country", "R&B", "Metal", "Indie", "Other",
];

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getSong, createSong, updateSong, deleteSong } = useSongs();
  const { chords } = useChords();
  const isEdit = !!id;
  const existingSong = id ? getSong(id) : undefined;

  const [title, setTitle] = useState(existingSong?.title ?? "");
  const [artist, setArtist] = useState(existingSong?.artist ?? "");
  const [songKey, setSongKey] = useState(existingSong?.key ?? "");
  const [tempo, setTempo] = useState(existingSong?.tempo ?? "");
  const [genre, setGenre] = useState(existingSong?.genre ?? "");
  const [content, setContent] = useState(existingSong?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [showChordPalette, setShowChordPalette] = useState(false);

  const contentRef = useRef<TextInput>(null);
  const lastCursorPos = useRef<number>(0);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const data = {
        title: title.trim(),
        artist: artist.trim(),
        key: songKey,
        tempo: tempo.trim(),
        genre,
        content,
      };
      if (isEdit && id) {
        await updateSong(id, data);
        router.back();
      } else {
        const song = await createSong(data);
        router.replace(`/song/${song.id}`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert("Delete Song", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSong(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.dismissAll();
        },
      },
    ]);
  };

  const insertChord = (chordName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pos = lastCursorPos.current;
    const before = content.substring(0, pos);
    const after = content.substring(pos);
    const insertion = chordName + " ";
    const newContent = before + insertion + after;
    setContent(newContent);
    const newPos = pos + insertion.length;
    lastCursorPos.current = newPos;
    // Re-focus and set cursor
    setTimeout(() => {
      contentRef.current?.focus();
      contentRef.current?.setNativeProps?.({
        selection: { start: newPos, end: newPos },
      });
    }, 50);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
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

          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isEdit ? "Edit Song" : "New Song"}
          </Text>

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
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Title *</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                fontSize: 20,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
            placeholder="Song title"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            autoFocus={!isEdit}
          />
        </View>

        {/* Artist */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Artist</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            placeholder="Artist name (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={artist}
            onChangeText={setArtist}
            returnKeyType="next"
          />
        </View>

        {/* Key */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Key</Text>
          <FlatList
            data={KEYS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(k) => k}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSongKey(songKey === item ? "" : item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: songKey === item ? colors.primary : colors.secondary,
                    borderColor: songKey === item ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: songKey === item ? colors.primaryForeground : colors.secondaryForeground,
                      fontFamily: songKey === item ? "Inter_700Bold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {/* Tempo */}
        <View style={[styles.section, { maxWidth: 180 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Tempo (BPM)</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            placeholder="120"
            placeholderTextColor={colors.mutedForeground}
            value={tempo}
            onChangeText={setTempo}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {/* Genre */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Genre</Text>
          <View style={styles.genreGrid}>
            {GENRES.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGenre(genre === g ? "" : g)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: genre === g ? colors.primary : colors.secondary,
                    borderColor: genre === g ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: genre === g ? colors.primaryForeground : colors.secondaryForeground,
                      fontFamily: genre === g ? "Inter_700Bold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {g}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Chords & Lyrics */}
        <View style={styles.section}>
          <View style={styles.contentLabelRow}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Chords & Lyrics
            </Text>
            <View style={styles.contentLabelActions}>
              {chords.length > 0 && (
                <Pressable
                  onPress={() => setShowChordPalette((v) => !v)}
                  style={[
                    styles.paletteToggle,
                    {
                      backgroundColor: showChordPalette ? colors.primary : colors.secondary,
                      borderColor: showChordPalette ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="grid"
                    size={12}
                    color={showChordPalette ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.paletteToggleText,
                      { color: showChordPalette ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    My Chords
                  </Text>
                </Pressable>
              )}
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Use [Section] headers
              </Text>
            </View>
          </View>

          {/* Chord Palette */}
          {showChordPalette && chords.length > 0 && (
            <View
              style={[
                styles.chordPalette,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <FlatList
                data={chords}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.paletteList}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => insertChord(item.name)}
                    style={({ pressed }) => [
                      styles.paletteItem,
                      {
                        backgroundColor: pressed ? colors.secondary : colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ChordDiagram
                      chord={item}
                      width={64}
                      showLabel={false}
                      primaryColor={colors.primary}
                      textColor={colors.foreground}
                      gridColor={colors.border}
                    />
                    <Text
                      style={[styles.paletteItemName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          <TextInput
            ref={contentRef}
            style={[
              styles.contentInput,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                fontFamily: "Inter_400Regular",
              },
            ]}
            multiline
            textAlignVertical="top"
            placeholder={`[Verse 1]\nG         Em\nHere go your lyrics\nC         D\nAnd more lyrics here\n\n[Chorus]\nAm  G  F  C\nChorus chords`}
            placeholderTextColor={colors.mutedForeground}
            value={content}
            onChangeText={setContent}
            onSelectionChange={(e) => {
              lastCursorPos.current = e.nativeEvent.selection.start;
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  section: { gap: 8 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chipList: { gap: 8, paddingBottom: 2 },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  contentLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  contentLabelActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  paletteToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paletteToggleText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  chordPalette: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  paletteList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  paletteItem: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
    minWidth: 76,
  },
  paletteItemName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  contentInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    minHeight: 260,
    lineHeight: 22,
  },
});
