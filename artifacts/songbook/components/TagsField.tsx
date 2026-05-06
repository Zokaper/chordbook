import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface TagsFieldProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagsField({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag...",
}: TagsFieldProps) {
  const colors = useColors();
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const availableSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        {value.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => removeTag(tag)}
            style={[
              styles.activeChip,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[styles.activeChipText, { color: colors.primaryForeground }]}
            >
              {tag}
            </Text>
            <Feather name="x" size={11} color={colors.primaryForeground} />
          </Pressable>
        ))}
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholder={value.length === 0 ? placeholder : "Add another..."}
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => addTag(input)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {input.trim().length > 0 && (
          <Pressable
            onPress={() => addTag(input)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={13} color={colors.primaryForeground} />
          </Pressable>
        )}
      </View>

      {availableSuggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsRow}
          keyboardShouldPersistTaps="handled"
        >
          {availableSuggestions.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => addTag(tag)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="plus" size={10} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.suggestionText,
                  { color: colors.secondaryForeground },
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activeChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    flex: 1,
    minWidth: 100,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 4,
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
