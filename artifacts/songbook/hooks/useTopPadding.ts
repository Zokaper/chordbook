import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Reads env(safe-area-inset-top) from CSS.
// Returns > 0 only in standalone/installed PWA mode (status bar present, no browser chrome).
// Returns 0 in a regular browser — the browser viewport already sits below its own chrome.
function readEnvSafeAreaTop(): number {
  if (typeof document === "undefined") return 0;
  try {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.paddingTop = "env(safe-area-inset-top, 0px)";
    div.style.visibility = "hidden";
    document.documentElement.appendChild(div);
    const val = parseInt(window.getComputedStyle(div).paddingTop, 10) || 0;
    div.remove();
    return val;
  } catch {
    return 0;
  }
}

let _cachedWebTop: number | null = null;

function getWebTopPadding(): number {
  if (_cachedWebTop !== null) return _cachedWebTop;
  if (typeof window === "undefined") return 0;

  const envTop = readEnvSafeAreaTop();

  // env(safe-area-inset-top) > 0 means we're in standalone/installed PWA mode.
  if (envTop > 0) {
    _cachedWebTop = envTop;
    return _cachedWebTop;
  }

  // Also detect standalone via matchMedia / iOS navigator.standalone
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;

  if (isStandalone) {
    // Standalone but no env inset reported — use a reasonable status-bar height
    _cachedWebTop = 24;
    return _cachedWebTop;
  }

  // Regular browser — no compensation needed; the viewport already starts
  // below the browser's own chrome. Visual padding comes from the + 12 in callers.
  _cachedWebTop = 0;
  return _cachedWebTop;
}

export function useTopPadding(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.top;
  return getWebTopPadding();
}

export function useBottomPadding(extra = 0): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "web") return insets.bottom + extra;

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true);

  const base = isStandalone ? 16 : 0;
  return base + extra;
}
