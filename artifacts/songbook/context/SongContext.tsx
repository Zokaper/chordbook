import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  tempo: string;
  tags: string[];
  content: string;
  chordVariants: Record<string, string>; // chord name → selected ChordFingering id
  createdAt: string;
  updatedAt: string;
}

interface SongContextValue {
  songs: Song[];
  loading: boolean;
  allTags: string[];
  createSong: (
    data: Omit<Song, "id" | "createdAt" | "updatedAt">
  ) => Promise<Song>;
  updateSong: (
    id: string,
    data: Partial<Omit<Song, "id" | "createdAt" | "updatedAt">>
  ) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  getSong: (id: string) => Song | undefined;
  clearAllSongs: () => Promise<void>;
  importSongs: (raw: unknown[]) => Promise<void>;
}

const SongContext = createContext<SongContextValue | null>(null);

const STORAGE_KEY = "songbook_songs_v1";

type RawSong = Partial<Song> & { genre?: string };

function migrate(raw: unknown): { songs: Song[]; changed: boolean } {
  if (!Array.isArray(raw)) return { songs: [], changed: false };
  let changed = false;
  const songs = (raw as RawSong[]).map((s) => {
    let tags = Array.isArray(s.tags) ? s.tags.filter(Boolean) : undefined;
    if (!tags) {
      tags = s.genre ? [s.genre] : [];
      changed = true;
    }
    const { genre: _genre, ...rest } = s;
    return {
      id: rest.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 7),
      title: rest.title ?? "",
      artist: rest.artist ?? "",
      key: rest.key ?? "",
      capo: typeof rest.capo === "number" ? rest.capo : 0,
      tempo: rest.tempo ?? "",
      tags,
      content: rest.content ?? "",
      chordVariants: (rest.chordVariants && typeof rest.chordVariants === "object" && !Array.isArray(rest.chordVariants))
        ? rest.chordVariants as Record<string, string>
        : {},
      createdAt: rest.createdAt ?? new Date().toISOString(),
      updatedAt: rest.updatedAt ?? rest.createdAt ?? new Date().toISOString(),
    } as Song;
  });
  return { songs, changed };
}

export function SongProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { songs: migrated, changed } = migrate(JSON.parse(raw));
        setSongs(migrated);
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
      }
    } catch (e) {
      console.error("Failed to load songs", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSongs = async (updated: Song[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSongs(updated);
  };

  const createSong = useCallback(
    async (data: Omit<Song, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const song: Song = {
        ...data,
        tags: data.tags ?? [],
        chordVariants: data.chordVariants ?? {},
        id:
          Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [song, ...songs];
      await saveSongs(updated);
      return song;
    },
    [songs]
  );

  const updateSong = useCallback(
    async (
      id: string,
      data: Partial<Omit<Song, "id" | "createdAt" | "updatedAt">>
    ) => {
      const updated = songs.map((s) =>
        s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
      );
      await saveSongs(updated);
    },
    [songs]
  );

  const deleteSong = useCallback(
    async (id: string) => {
      const updated = songs.filter((s) => s.id !== id);
      await saveSongs(updated);
    },
    [songs]
  );

  const getSong = useCallback(
    (id: string) => {
      return songs.find((s) => s.id === id);
    },
    [songs]
  );

  const clearAllSongs = useCallback(async () => {
    await saveSongs([]);
  }, []);

  const importSongs = useCallback(async (raw: unknown[]) => {
    const { songs: migrated } = migrate(raw);
    await saveSongs(migrated);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of songs) for (const t of s.tags) if (t) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  return (
    <SongContext.Provider
      value={{
        songs,
        loading,
        allTags,
        createSong,
        updateSong,
        deleteSong,
        getSong,
        clearAllSongs,
        importSongs,
      }}
    >
      {children}
    </SongContext.Provider>
  );
}

export function useSongs() {
  const ctx = useContext(SongContext);
  if (!ctx) throw new Error("useSongs must be used within SongProvider");
  return ctx;
}
