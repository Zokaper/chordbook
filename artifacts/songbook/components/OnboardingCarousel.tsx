import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
    title: "Building a Song",
    subtitle: "Five types of lines per section",
    bullets: [
      { icon: "align-left", text: "Chords — tap to insert from your chord library" },
      { icon: "type", text: "Lyrics — freeform text below the chords" },
      { icon: "activity", text: "Strum — 8-beat D/U tap grid" },
      { icon: "grid", text: "Riff — 6-string fret grid with articulations" },
      { icon: "message-square", text: "Note — italic annotation or reminder" },
    ],
  },
];

interface Props {
  onDone: () => void;
}

export function OnboardingCarousel({ onDone }: Props) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = Dimensions.get("window");
  const isLast = page === SLIDES.length - 1;

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
    paddingHorizontal: 36,
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
