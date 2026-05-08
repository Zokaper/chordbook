import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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


import { StructuredEditor } from "@/components/StructuredEditor";
import { TagsField } from "@/components/TagsField";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useTopPadding, useBottomPadding } from "@/hooks/useTopPadding";

const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm", "G#m", "Abm", "Bbm",
];

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const { getSong, createSong, updateSong, deleteSong, allTags } = useSongs();
  const isEdit = !!id;
  const existingSong = id ? getSong(id) : undefined;

  const [title, setTitle] = useState(existingSong?.title ?? "");
  const [artist, setArtist] = useState(existingSong?.artist ?? "");
  const [songKey, setSongKey] = useState(existingSong?.key ?? "");
  const [tempo, setTempo] = useState(existingSong?.tempo ?? "");
  const [tags, setTags] = useState<string[]>(existingSong?.tags ?? []);
  const [content, setContent] = useState(existingSong?.content ?? "");
  const [saving, setSaving] = useState(false);

  const topPadding = useTopPadding();
  const bottomPadding = useBottomPadding(60);
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
        tags,
        content,
        chordVariants: existingSong?.chordVariants ?? {},
      };
      if (isEdit && id) {
        await updateSong(id, data);
        router.back();
      } else {
        const song = await createSong(data);
        router.replace(`/song/${song.id}`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
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
                  {
                    color: canSave
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Title *
          </Text>
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
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Artist
          </Text>
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
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Key
          </Text>
          <FlatList
            data={KEYS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(k) => k}
            contentContainerStyle={styles.chipRow}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSongKey(songKey === item ? "" : item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      songKey === item ? colors.primary : colors.secondary,
                    borderColor:
                      songKey === item ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        songKey === item
                          ? colors.primaryForeground
                          : colors.secondaryForeground,
                      fontFamily:
                        songKey === item
                          ? "Inter_700Bold"
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

        {/* Tempo */}
        <View style={[styles.field, { maxWidth: 160 }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Tempo (BPM)
          </Text>
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

        {/* Tags */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Tags
          </Text>
          <TagsField
            value={tags}
            onChange={setTags}
            suggestions={allTags}
            placeholder="Add a tag (e.g. acoustic, christmas)"
          />
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />

        {/* Structured song editor */}
        <StructuredEditor content={content} onChange={setContent} />
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
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chipRow: { gap: 7, paddingBottom: 2 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  metaRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});
