import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ChordFingering {
  id: string;
  name: string;
  strings: number[]; // 6 values (index 0 = low E, index 5 = high e)
                     // -1 = muted, 0 = open, N > 0 = actual fret number
  baseFret: number;  // the fret shown at top of diagram (usually 1)
  barre?: {
    fret: number;    // actual fret number for the barre
    from: number;    // string index (0-5) start
    to: number;      // string index (0-5) end
  };
  createdAt: string;
  updatedAt: string;
}

interface ChordContextValue {
  chords: ChordFingering[];
  loading: boolean;
  createChord: (
    data: Omit<ChordFingering, "id" | "createdAt" | "updatedAt">
  ) => Promise<ChordFingering>;
  updateChord: (
    id: string,
    data: Partial<Omit<ChordFingering, "id" | "createdAt" | "updatedAt">>
  ) => Promise<void>;
  deleteChord: (id: string) => Promise<void>;
  getChord: (id: string) => ChordFingering | undefined;
}

const ChordContext = createContext<ChordContextValue | null>(null);

const STORAGE_KEY = "songbook_chords_v1";

export function ChordProvider({ children }: { children: React.ReactNode }) {
  const [chords, setChords] = useState<ChordFingering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChords();
  }, []);

  const loadChords = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setChords(JSON.parse(raw));
    } catch (e) {
      console.error("Failed to load chords", e);
    } finally {
      setLoading(false);
    }
  };

  const saveChords = async (updated: ChordFingering[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setChords(updated);
  };

  const createChord = useCallback(
    async (data: Omit<ChordFingering, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const chord: ChordFingering = {
        ...data,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        createdAt: now,
        updatedAt: now,
      };
      await saveChords([chord, ...chords]);
      return chord;
    },
    [chords]
  );

  const updateChord = useCallback(
    async (
      id: string,
      data: Partial<Omit<ChordFingering, "id" | "createdAt" | "updatedAt">>
    ) => {
      const updated = chords.map((c) =>
        c.id === id
          ? { ...c, ...data, updatedAt: new Date().toISOString() }
          : c
      );
      await saveChords(updated);
    },
    [chords]
  );

  const deleteChord = useCallback(
    async (id: string) => {
      await saveChords(chords.filter((c) => c.id !== id));
    },
    [chords]
  );

  const getChord = useCallback(
    (id: string) => chords.find((c) => c.id === id),
    [chords]
  );

  return (
    <ChordContext.Provider
      value={{ chords, loading, createChord, updateChord, deleteChord, getChord }}
    >
      {children}
    </ChordContext.Provider>
  );
}

export function useChords() {
  const ctx = useContext(ChordContext);
  if (!ctx) throw new Error("useChords must be used within ChordProvider");
  return ctx;
}
