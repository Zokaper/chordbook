import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  tempo: string;
  genre: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface SongContextValue {
  songs: Song[];
  loading: boolean;
  createSong: (
    data: Omit<Song, "id" | "createdAt" | "updatedAt">
  ) => Promise<Song>;
  updateSong: (
    id: string,
    data: Partial<Omit<Song, "id" | "createdAt" | "updatedAt">>
  ) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  getSong: (id: string) => Song | undefined;
}

const SongContext = createContext<SongContextValue | null>(null);

const STORAGE_KEY = "songbook_songs_v1";

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
        setSongs(JSON.parse(raw));
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

  return (
    <SongContext.Provider
      value={{ songs, loading, createSong, updateSong, deleteSong, getSong }}
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
