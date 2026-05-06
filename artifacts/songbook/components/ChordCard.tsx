import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ChordDiagram } from "@/components/ChordDiagram";
import { ChordFingering } from "@/context/ChordContext";
import { useColors } from "@/hooks/useColors";

interface ChordCardProps {
  chord: ChordFingering;
  onLongPress?: (id: string) => void;
}

export function ChordCard({ chord, onLongPress }: ChordCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chord-editor?id=${chord.id}`);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.(chord.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <View style={styles.diagram}>
        <ChordDiagram
          chord={chord}
          width={110}
          showLabel
          primaryColor={colors.primary}
          textColor={colors.foreground}
          gridColor={colors.border}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    flex: 1,
    maxWidth: "48%",
  },
  diagram: {
    alignItems: "center",
  },
});
