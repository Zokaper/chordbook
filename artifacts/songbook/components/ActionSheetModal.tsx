import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export interface ActionSheetOption {
  label: string;
  description?: string;
  icon?: keyof typeof Feather.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetModalProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onDismiss: () => void;
}

export function ActionSheetModal({
  visible,
  title,
  options,
  onDismiss,
}: ActionSheetModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {!!title && (
            <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
          )}
          {options.map((opt, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <Pressable
                onPress={() => { onDismiss(); opt.onPress(); }}
                style={({ pressed }) => [styles.option, { opacity: pressed ? 0.7 : 1 }]}
              >
                {!!opt.icon && (
                  <View style={[styles.optionIcon, { backgroundColor: opt.destructive ? `${colors.destructive}14` : `${colors.primary}14` }]}>
                    <Feather name={opt.icon} size={17} color={opt.destructive ? colors.destructive : colors.primary} />
                  </View>
                )}
                <View style={styles.optionCopy}>
                  <Text
                    style={[
                      styles.optionText,
                      { color: opt.destructive ? colors.destructive : colors.foreground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {!!opt.description && (
                    <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>
                      {opt.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            </React.Fragment>
          ))}
          <View style={[styles.gap, { backgroundColor: colors.muted }]} />
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.cancelRow, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
    paddingBottom: 34,
  },
  title: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  divider: { height: 1, opacity: 0.5 },
  option: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optionCopy: { flex: 1, gap: 2 },
  optionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  optionDescription: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  gap: { height: 8 },
  cancelRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
