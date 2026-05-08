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
 * Top padding for custom headers.
 *
 * Native: uses safe-area-inset-top from the OS.
 * Web (PWA): with apple-mobile-web-app-status-bar-style=default, the viewport
 * starts BELOW the status bar so no extra compensation is needed.
 * Returns 0 on web; callers add their own visual gap (e.g. + 8).
 */
export function useTopPadding(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.top;
  return 0;
}

/**
 * Bottom padding for scroll content / floating buttons.
 *
 * Native: uses safe-area-inset-bottom from the OS.
 * Web: reads env(safe-area-inset-bottom) live — this is ~34px for the iOS home
 * indicator in standalone PWA mode and 0 in a regular browser.
 */
export function useBottomPadding(extra = 0): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.bottom + extra;
  const base = readEnvPx("safe-area-inset-bottom");
  return base + extra;
}
