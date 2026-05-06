import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemePref = "system" | "light" | "dark";
export type SortBy = "recent" | "title" | "artist";

export interface Settings {
  theme: ThemePref;
  sortBy: SortBy;
}

interface SettingsContextValue {
  settings: Settings;
  setTheme: (theme: ThemePref) => Promise<void>;
  setSortBy: (sort: SortBy) => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  sortBy: "recent",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "songbook_settings_v1";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    })();
  }, []);

  const persist = async (next: Settings) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const setTheme = useCallback(
    async (theme: ThemePref) => {
      await persist({ ...settings, theme });
    },
    [settings]
  );

  const setSortBy = useCallback(
    async (sortBy: SortBy) => {
      await persist({ ...settings, sortBy });
    },
    [settings]
  );

  return (
    <SettingsContext.Provider value={{ settings, setTheme, setSortBy }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      setTheme: async () => {},
      setSortBy: async () => {},
    };
  }
  return ctx;
}
