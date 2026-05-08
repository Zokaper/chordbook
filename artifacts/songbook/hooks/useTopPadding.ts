import { useEffect } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function readEnvPx(prop: string): number {
  if (typeof document === "undefined") return 0;
  try {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.paddingTop = `env(${prop}, 0px)`;
    div.style.visibility = "hidden";
    document.documentElement.appendChild(div);
    const val = parseInt(window.getComputedStyle(div).paddingTop, 10) || 0;
    div.remove();
    return val;
  } catch {
    return 0;
  }
}

/**
 * The visual height of the tab bar content area (icons + labels + padding).
 * Does NOT include the bottom safe area — that is added separately via useBottomPadding().
 */
export const TAB_BAR_BASE_HEIGHT = 56;

/**
 * Top padding for custom headers.
 *
 * Native: uses safe-area-inset-top from the OS.
 * Web: with apple-mobile-web-app-status-bar-style=default, the viewport
 * starts BELOW the status bar so no compensation needed.
 */
export function useTopPadding(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.top;
  return 0;
}

/**
 * Bottom padding for scroll content / floating buttons.
 *
 * Native: safe-area-inset-bottom + extra.
 * Web: env(safe-area-inset-bottom) live read (home indicator on iOS PWA) + extra.
 */
export function useBottomPadding(extra = 0): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.bottom + extra;
  const base = readEnvPx("safe-area-inset-bottom");
  return base + extra;
}

/**
 * Bottom padding for content inside a tab screen.
 * Accounts for the floating tab bar height + safe area + optional extra.
 */
export function useTabScreenBottomPadding(extra = 0): number {
  return useBottomPadding(TAB_BAR_BASE_HEIGHT + 8 + extra);
}

/**
 * Syncs the document theme-color meta tag to the given color.
 * No-op on native.
 */
export function useThemeColorSync(color: string): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const meta = document.querySelector(
      'meta[name="theme-color"]:not([media])'
    ) as HTMLMetaElement | null;
    if (meta) meta.content = color;
  }, [color]);
}
