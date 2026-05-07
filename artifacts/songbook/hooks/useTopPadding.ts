import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Reads env(safe-area-inset-top) directly from CSS.
// Returns > 0 only in standalone/installed PWA mode (status bar present, no browser chrome).
// In a regular browser the value is 0 (the browser manages its own chrome separately).
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
  if (typeof window === "undefined") return 67;

  const envTop = readEnvSafeAreaTop();

  // env(safe-area-inset-top) > 0 means we're in standalone/installed PWA mode
  // where only the status bar sits above our content.
  if (envTop > 0) {
    _cachedWebTop = envTop;
    return _cachedWebTop;
  }

  // Also detect standalone via matchMedia / iOS navigator.standalone
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;

  // In standalone mode with no env inset reported, fall back to a sensible
  // status-bar height so content isn't buried under the status bar.
  if (isStandalone) {
    _cachedWebTop = 24;
    return _cachedWebTop;
  }

  // Regular browser — needs full browser-chrome compensation.
  _cachedWebTop = 67;
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
  const base = isStandalone ? 16 : 34;
  return base + extra;
}
