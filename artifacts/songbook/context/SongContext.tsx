import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { migrateSongs, type PersistedSong } from "@/utils/songMigration";

export interface Song extends PersistedSong {}

type SongInput = Omit<Song, "id" | "createdAt" | "updatedAt" | "isDraft"> & {
  isDraft?: boolean;
};

interface SongContextValue {
  songs: Song[];
  loading: boolean;
  allTags: string[];
  createSong: (data: SongInput) => Promise<Song>;
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

// ── Example seed song ─────────────────────────────────────────────────────────
const SEED_CONTENT = [
  "[Intro]",
  "STRUM:D,-,DU,-,D,-,DU,-",
  "A E D A",
  "[Verse]",
  "A E D A",
  "Look at us, you and me back at it again",
  "A E D A",
  "Pickin' up the pieces of the mess we made back then",
  "[Pre-Chorus]",
  "A E",
  "Turn the light on, baby, I'm home",
  "[Chorus]",
  "A E D A",
  "Ooh, let the light in",
  "A E D A",
  "At your back door, yelling 'cause I wanna come in",
  "A E D A",
  "Ooh, let the light in",
  "[Bridge]",
  "D E A F#m",
  "D E A",
  "NOTE:Capo optional. Waltz feel — emphasise beat 1.",
].join("\n");

export const EXAMPLE_SONG_ID = "seed_let_the_light_in";

export function makeExampleSong(): Song {
  const now = new Date().toISOString();
  return {
    id: EXAMPLE_SONG_ID,
    title: "Let the Light In",
    artist: "Lana Del Rey",
    key: "A",
    capo: 0,
    tempo: "110",
    tags: ["example", "folk"],
    content: SEED_CONTENT,
    chordVariants: {},
    isDraft: false,
    createdAt: now,
    updatedAt: now,
  };
}

// keep old name for internal use
const makeSeedSong = makeExampleSong;

export function SongProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const songsRef = useRef<Song[]>([]);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { songs: storedSongs, changed } = migrateSongs(JSON.parse(raw));
        const migrated = storedSongs as Song[];
        songsRef.current = migrated;
        setSongs(migrated);
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
      } else {
        // First run — seed the example song
        const seed = [makeSeedSong()];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        songsRef.current = seed;
        setSongs(seed);
      }
    } catch (e) {
      console.error("Failed to load songs", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSongs = useCallback(async (updated: Song[]) => {
    songsRef.current = updated;
    setSongs(updated);
    writeQueueRef.current = writeQueueRef.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)));
    await writeQueueRef.current;
  }, []);

  const createSong = useCallback(
    async (data: SongInput) => {
      const now = new Date().toISOString();
      const song: Song = {
        ...data,
        tags: data.tags ?? [],
        chordVariants: data.chordVariants ?? {},
        isDraft: data.isDraft ?? false,
        id:
          Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [song, ...songsRef.current];
      await saveSongs(updated);
      return song;
    },
    [saveSongs]
  );

  const updateSong = useCallback(
    async (
      id: string,
      data: Partial<Omit<Song, "id" | "createdAt" | "updatedAt">>
    ) => {
      const updated = songsRef.current.map((s) =>
        s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
      );
      await saveSongs(updated);
    },
    [saveSongs]
  );

  const deleteSong = useCallback(
    async (id: string) => {
      const updated = songsRef.current.filter((s) => s.id !== id);
      await saveSongs(updated);
    },
    [saveSongs]
  );

  const getSong = useCallback(
    (id: string) => {
      return songs.find((s) => s.id === id);
    },
    [songs]
  );

  const clearAllSongs = useCallback(async () => {
    await saveSongs([]);
  }, [saveSongs]);

  const importSongs = useCallback(async (raw: unknown[]) => {
    const { songs: migrated } = migrateSongs(raw);
    await saveSongs(migrated as Song[]);
  }, [saveSongs]);

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
