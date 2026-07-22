import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EXAMPLE_SONG_ID, makeExampleSong, useSongs } from "@/context/SongContext";
import { useColors } from "@/hooks/useColors";

interface Slide {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  bullets: { icon: keyof typeof Feather.glyphMap; text: string }[];
}

const SLIDES: Slide[] = [
  {
    icon: "book-open",
    title: "Songbook",
    subtitle: "Your songs, your way",
    bullets: [
      { icon: "lock", text: "Everything stays on your device — private by default" },
      { icon: "wifi-off", text: "Works fully offline, no account needed" },
      { icon: "music", text: "Store as many songs as you like" },
    ],
  },
  {
    icon: "list",
    title: "Your Library",
    subtitle: "Find any song instantly",
    bullets: [
      { icon: "search", text: "Search by title, artist, or tag" },
      { icon: "tag", text: "Organise with your own free-text tags" },
      { icon: "clock", text: "Sort by recent, title, or artist" },
    ],
  },
  {
    icon: "edit-2",
    title: "Build Your Arrangement",
    subtitle: "Keep only what helps you play",
    bullets: [
      { icon: "music", text: "Type chord progressions with suggestions from your library" },
      { icon: "type", text: "Add lyrics only when you want them" },
      { icon: "activity", text: "Capture strumming, fingerstyle riffs, or detailed tab" },
      { icon: "message-square", text: "Keep notes beside the relevant section" },
      { icon: "save", text: "Work is saved locally as you build" },
    ],
  },
];

interface Props {
  onDone: () => void;
}

export function OnboardingCarousel({ onDone }: Props) {
  const colors = useColors();
  const { songs, createSong } = useSongs();
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = Dimensions.get("window");
  const isLast = page === SLIDES.length - 1;

  const alreadyAdded = songs.some((s) => s.id === EXAMPLE_SONG_ID);

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      goTo(page + 1);
    }
  };

  const handleSkip = () => onDone();

  const handleAddExample = async () => {
    if (alreadyAdded || adding) return;
    setAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const song = makeExampleSong();
      await createSong({
        title: song.title,
        artist: song.artist,
        key: song.key,
        capo: song.capo,
        tempo: song.tempo,
        tags: song.tags,
        content: song.content,
        chordVariants: song.chordVariants,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      {/* Skip */}
      {!isLast && (
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(p);
        }}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
              <Feather name={slide.icon} size={38} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{slide.subtitle}</Text>
            <View style={styles.bullets}>
              {slide.bullets.map((b, bi) => (
                <View key={bi} style={styles.bullet}>
                  <View style={[styles.bulletIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Feather name={b.icon} size={14} color={colors.primary} />
                  </View>
                  <Text style={[styles.bulletText, { color: colors.foreground }]}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* Example song card — last slide only */}
            {i === SLIDES.length - 1 && (
              <View style={styles.exampleWrap}>
                <Text style={[styles.exampleHint, { color: colors.mutedForeground }]}>
                  Try it with a real song:
                </Text>
                <Pressable
                  onPress={handleAddExample}
                  disabled={alreadyAdded || adding}
                  style={({ pressed }) => [
                    styles.exampleCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: alreadyAdded ? `${colors.primary}60` : colors.border,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  {/* Left: metadata */}
                  <View style={styles.exampleLeft}>
                    <Text style={[styles.exampleTitle, { color: colors.foreground }]} numberOfLines={1}>
                      Let the Light In
                    </Text>
                    <Text style={[styles.exampleArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                      Lana Del Rey
                    </Text>
                    <View style={styles.exampleBadges}>
                      <View style={[styles.keyBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.keyText, { color: colors.primaryForeground }]}>A</Text>
                      </View>
                      {["example", "folk"].map((tag) => (
                        <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{tag}</Text>
                        </View>
                      ))}
                      <Text style={[styles.tagText, { color: colors.mutedForeground }]}>110 BPM</Text>
                    </View>
                  </View>

                  {/* Right: add / added state */}
                  <View style={[
                    styles.addBtn,
                    {
                      backgroundColor: alreadyAdded
                        ? `${colors.primary}18`
                        : `${colors.primary}12`,
                      borderColor: alreadyAdded
                        ? `${colors.primary}50`
                        : `${colors.primary}30`,
                    },
                  ]}>
                    {alreadyAdded ? (
                      <>
                        <Feather name="check" size={13} color={colors.primary} />
                        <Text style={[styles.addBtnText, { color: colors.primary }]}>Added</Text>
                      </>
                    ) : (
                      <>
                        <Feather name="plus" size={13} color={colors.primary} />
                        <Text style={[styles.addBtnText, { color: colors.primary }]}>
                          {adding ? "Adding…" : "Add"}
                        </Text>
                      </>
                    )}
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Dots + Button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? colors.primary : `${colors.primary}30`,
                    width: i === page ? 20 : 7,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            {isLast ? "Get started" : "Next"}
          </Text>
          <Feather
            name={isLast ? "check" : "arrow-right"}
            size={16}
            color={colors.primaryForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  scrollView: { flex: 1, alignSelf: "stretch" },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 20,
    gap: 16,
  },
  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginTop: -4,
  },
  bullets: { gap: 12, alignSelf: "stretch", marginTop: 12 },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bulletIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    paddingTop: 5,
  },

  // ── Example song card ──────────────────────────────────────────────────────
  exampleWrap: { alignSelf: "stretch", gap: 8, marginTop: 4 },
  exampleHint: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  exampleCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exampleLeft: { flex: 1, gap: 4 },
  exampleTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  exampleArtist: { fontSize: 13, fontFamily: "Inter_400Regular" },
  exampleBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  keyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  keyText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tagBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  tagText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexShrink: 0,
  },
  addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 52,
    paddingTop: 20,
    gap: 24,
    alignSelf: "stretch",
    alignItems: "center",
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 7, borderRadius: 4 },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: 16,
    paddingVertical: 16,
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
