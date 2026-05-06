import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Honors the user's theme preference from SettingsContext when set
 * to "light" or "dark", otherwise falls back to the system color scheme.
 */
export function useColors() {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const effective =
    settings.theme === "system" ? systemScheme : settings.theme;
  const palette =
    effective === "dark" && "dark" in colors
      ? (colors as unknown as { dark: typeof colors.light }).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
