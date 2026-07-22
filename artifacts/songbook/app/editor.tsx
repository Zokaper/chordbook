import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
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

import { ActionSheetModal } from "@/components/ActionSheetModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EditorHelpSheet } from "@/components/EditorHelpSheet";
import { StructuredEditor } from "@/components/StructuredEditor";
import { TagsField } from "@/components/TagsField";
import { useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";
import { useBottomPadding, useTopPadding } from "@/hooks/useTopPadding";

const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G",
  "G#", "Ab", "A", "A#", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em",
  "Fm", "Gm", "G#m", "Abm", "Bbm",
];

interface EditorData {
  title: string;
  artist: string;
  key: string;
  capo: number;
  tempo: string;
  tags: string[];
  content: string;
  chordVariants: Record<string, string>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const snapshot = (data: EditorData) => JSON.stringify(data);

const isMeaningful = (data: EditorData) =>
  !!(
    data.title.trim() ||
    data.artist.trim() ||
    data.key ||
    data.capo ||
    data.tempo.trim() ||
    data.tags.length ||
    (data.content.trim() && data.content.trim() !== "[Verse]")
  );

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const navigation = useNavigation();
  const { getSong, createSong, updateSong, deleteSong, allTags } = useSongs();
  const initialSongRef = useRef(id ? getSong(id) : undefined);
  const initialSong = initialSongRef.current;

  const [title, setTitle] = useState(initialSong?.title ?? "");
  const [artist, setArtist] = useState(initialSong?.artist ?? "");
  const [songKey, setSongKey] = useState(initialSong?.key ?? "");
  const [tempo, setTempo] = useState(initialSong?.tempo ?? "");
  const [tags, setTags] = useState<string[]>(initialSong?.tags ?? []);
  const [capo, setCapo] = useState(initialSong?.capo ?? 0);
  const [content, setContent] = useState(initialSong?.content || "[Verse]");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialSong ? "saved" : "idle");
  const [titleError, setTitleError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);

  const topPadding = useTopPadding();
  const bottomPadding = useBottomPadding(60);
  const titleRef = useRef<TextInput>(null);
  const songIdRef = useRef<string | null>(id ?? null);
  const remainsDraftRef = useRef(initialSong?.isDraft ?? true);
  const createPromiseRef = useRef<ReturnType<typeof createSong> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowingExitRef = useRef(false);

  const editorData = useMemo<EditorData>(() => ({
    title,
    artist,
    key: songKey,
    capo,
    tempo,
    tags,
    content,
    chordVariants: initialSong?.chordVariants ?? {},
  }), [title, artist, songKey, capo, tempo, tags, content, initialSong?.chordVariants]);

  const dataRef = useRef(editorData);
  dataRef.current = editorData;
  const initialSnapshotRef = useRef(snapshot(editorData));
  const lastSavedSnapshotRef = useRef(initialSong ? snapshot(editorData) : "");

  const persistNow = useCallback(async (finalize = false): Promise<string | null> => {
    const data = dataRef.current;
    const currentSnapshot = snapshot(data);
    if (!songIdRef.current && !isMeaningful(data)) return null;
    if (!finalize && songIdRef.current && currentSnapshot === lastSavedSnapshotRef.current) {
      return songIdRef.current;
    }

    setSaveStatus("saving");
    try {
      if (!songIdRef.current) {
        if (!createPromiseRef.current) {
          createPromiseRef.current = createSong({
            ...data,
            title: data.title.trim(),
            artist: data.artist.trim(),
            tempo: data.tempo.trim(),
            isDraft: !finalize,
          });
        }
        const created = await createPromiseRef.current;
        songIdRef.current = created.id;
        remainsDraftRef.current = !finalize;
        router.setParams({ id: created.id });
      }

      const songId = songIdRef.current;
      if (!songId) return null;
      await updateSong(songId, {
        ...dataRef.current,
        title: dataRef.current.title.trim(),
        artist: dataRef.current.artist.trim(),
        tempo: dataRef.current.tempo.trim(),
        isDraft: finalize ? false : remainsDraftRef.current,
      });
      if (finalize) remainsDraftRef.current = false;
      lastSavedSnapshotRef.current = snapshot(dataRef.current);
      setSaveStatus("saved");
      return songId;
    } catch {
      if (!songIdRef.current) createPromiseRef.current = null;
      setSaveStatus("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    }
  }, [createSong, updateSong]);

  useEffect(() => {
    const currentSnapshot = snapshot(editorData);
    if (currentSnapshot === initialSnapshotRef.current && !songIdRef.current) return;
    if (!songIdRef.current && !isMeaningful(editorData)) return;
    if (currentSnapshot === lastSavedSnapshotRef.current) return;

    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow(false);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editorData, persistNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void persistNow(false);
    });
    return () => subscription.remove();
  }, [persistNow]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (allowingExitRef.current) return;
    event.preventDefault();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void persistNow(false).finally(() => {
      allowingExitRef.current = true;
      navigation.dispatch(event.data.action);
    });
  }), [navigation, persistNow]);

  const handleBack = () => router.back();

  const handleDone = async () => {
    if (!title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const savedId = await persistNow(true);
    if (savedId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      allowingExitRef.current = true;
      router.replace(`/song/${savedId}`);
    }
  };

  const detailsSummary = [
    songKey && `Key ${songKey}`,
    capo > 0 && `Capo ${capo}`,
    tempo && `${tempo} BPM`,
    tags.length > 0 && `${tags.length} tag${tags.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  const statusLabel = saveStatus === "saving"
    ? "Saving…"
    : saveStatus === "error"
      ? "Save failed"
      : saveStatus === "saved"
        ? (remainsDraftRef.current ? "Draft saved" : "Saved")
        : "Not saved yet";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, {
        paddingTop: topPadding + 8,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {initialSong ? "Edit arrangement" : "New arrangement"}
          </Text>
          <Text style={[styles.saveState, { color: saveStatus === "error" ? colors.destructive : colors.mutedForeground }]}>
            {statusLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowSongMenu(true)}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="more-horizontal" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.doneText, { color: colors.primaryForeground }]}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityBlock}>
          <TextInput
            ref={titleRef}
            style={[styles.titleInput, {
              color: colors.foreground,
              borderBottomColor: titleError ? colors.destructive : colors.border,
            }]}
            placeholder="Song title"
            placeholderTextColor={`${colors.mutedForeground}88`}
            value={title}
            onChangeText={(value) => { setTitle(value); if (value.trim()) setTitleError(false); }}
            returnKeyType="next"
            autoFocus={!initialSong}
          />
          {titleError && <Text style={[styles.errorText, { color: colors.destructive }]}>Add a title to finish this arrangement.</Text>}
          <TextInput
            style={[styles.artistInput, { color: colors.foreground }]}
            placeholder="Artist (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={artist}
            onChangeText={setArtist}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.detailsCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable onPress={() => setDetailsOpen((open) => !open)} style={styles.detailsToggle}>
            <View style={[styles.detailsIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Feather name="sliders" size={14} color={colors.primary} />
            </View>
            <View style={styles.detailsCopy}>
              <Text style={[styles.detailsTitle, { color: colors.foreground }]}>Song details</Text>
              <Text style={[styles.detailsSummary, { color: colors.mutedForeground }]} numberOfLines={1}>
                {detailsSummary || "Key, capo, tempo and tags"}
              </Text>
            </View>
            <Feather name={detailsOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} />
          </Pressable>

          {detailsOpen && (
            <View style={[styles.detailsBody, { borderTopColor: colors.border }]}>
              <MetaLabel label="Key" colors={colors} />
              <FlatList
                data={KEYS}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                contentContainerStyle={styles.chipRow}
                renderItem={({ item }) => (
                  <ChoiceChip label={item} active={songKey === item} onPress={() => setSongKey(songKey === item ? "" : item)} colors={colors} />
                )}
              />

              <MetaLabel label="Capo" colors={colors} />
              <FlatList
                data={[0, 1, 2, 3, 4, 5, 6, 7]}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item)}
                contentContainerStyle={styles.chipRow}
                renderItem={({ item }) => (
                  <ChoiceChip label={item === 0 ? "None" : String(item)} active={capo === item} onPress={() => setCapo(item)} colors={colors} />
                )}
              />

              <MetaLabel label="Tempo (BPM)" colors={colors} />
              <TextInput
                style={[styles.tempoInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
                placeholder="120"
                placeholderTextColor={colors.mutedForeground}
                value={tempo}
                onChangeText={setTempo}
                keyboardType="numeric"
              />

              <MetaLabel label="Tags" colors={colors} />
              <TagsField value={tags} onChange={setTags} suggestions={allTags} placeholder="Add a tag" />
            </View>
          )}
        </View>

        <View style={styles.arrangementHeading}>
          <Text style={[styles.arrangementTitle, { color: colors.foreground }]}>Arrangement</Text>
          <Text style={[styles.arrangementHint, { color: colors.mutedForeground }]}>Add only what you need for this song.</Text>
        </View>

        <StructuredEditor content={content} onChange={setContent} />
      </ScrollView>

      <ActionSheetModal
        visible={showSongMenu}
        title="Arrangement options"
        onDismiss={() => setShowSongMenu(false)}
        options={[
          { label: "Editor guide", onPress: () => setShowHelp(true) },
          ...(songIdRef.current ? [{ label: "Delete arrangement", destructive: true, onPress: () => setShowDeleteConfirm(true) }] : []),
        ]}
      />
      {showHelp && <EditorHelpSheet onClose={() => setShowHelp(false)} />}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Arrangement"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          allowingExitRef.current = true;
          if (songIdRef.current) await deleteSong(songIdRef.current);
          router.dismissAll();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </KeyboardAvoidingView>
  );
}

function MetaLabel({ label, colors }: { label: string; colors: { mutedForeground: string } }) {
  return <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>;
}

function ChoiceChip({ label, active, onPress, colors }: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: { primary: string; primaryForeground: string; secondary: string; secondaryForeground: string; border: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? colors.primary : colors.secondary, borderColor: active ? colors.primary : colors.border }]}
    >
      <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.secondaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saveState: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  doneBtn: { borderRadius: 20, paddingHorizontal: 17, paddingVertical: 9 },
  doneText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, gap: 18 },
  identityBlock: { gap: 5 },
  titleInput: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    paddingHorizontal: 2,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  artistInput: { fontSize: 16, fontFamily: "Inter_400Regular", paddingHorizontal: 2, paddingVertical: 8 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 2 },
  detailsCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  detailsIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  detailsCopy: { flex: 1, minWidth: 0 },
  detailsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  detailsSummary: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  detailsBody: { borderTopWidth: 1, padding: 13, gap: 8 },
  metaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7, textTransform: "uppercase", marginTop: 4 },
  chipRow: { gap: 7, paddingBottom: 2 },
  chip: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tempoInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, width: 130, fontSize: 14, fontFamily: "Inter_400Regular" },
  arrangementHeading: { gap: 3, paddingHorizontal: 2 },
  arrangementTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  arrangementHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
