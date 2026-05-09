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
  getChordsByName: (name: string) => ChordFingering[];
  importChords: (raw: unknown[]) => Promise<void>;
}

const ChordContext = createContext<ChordContextValue | null>(null);

const STORAGE_KEY = "songbook_chords_v1";

// ── Seed chords (A, E, D, F#m — key of A) ────────────────────────────────────
function makeSeedChords(): ChordFingering[] {
  const now = new Date().toISOString();
  return [
    {
      id: "seed_chord_A",
      name: "A",
      strings: [-1, 0, 2, 2, 2, 0], // x02220
      baseFret: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed_chord_E",
      name: "E",
      strings: [0, 2, 2, 1, 0, 0], // 022100
      baseFret: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed_chord_D",
      name: "D",
      strings: [-1, -1, 0, 2, 3, 2], // xx0232
      baseFret: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed_chord_Fshm",
      name: "F#m",
      strings: [2, 4, 4, 2, 2, 2], // 244222 — Em shape barre fret 2
      baseFret: 2,
      barre: { fret: 2, from: 0, to: 5 },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function ChordProvider({ children }: { children: React.ReactNode }) {
  const [chords, setChords] = useState<ChordFingering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChords();
  }, []);

  const loadChords = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setChords(JSON.parse(raw));
      } else {
        // First run — seed the example chords
        const seed = makeSeedChords();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        setChords(seed);
      }
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

  const getChordsByName = useCallback(
    (name: string) => chords.filter((c) => c.name === name),
    [chords]
  );

  const importChords = useCallback(async (raw: unknown[]) => {
    const now = new Date().toISOString();
    const normalized = (raw as Partial<ChordFingering>[]).map((c) => ({
      id: c.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 7),
      name: c.name ?? "",
      strings: Array.isArray(c.strings) ? c.strings : [0, 0, 0, 0, 0, 0],
      baseFret: c.baseFret ?? 1,
      barre: c.barre,
      createdAt: c.createdAt ?? now,
      updatedAt: c.updatedAt ?? now,
    })) as ChordFingering[];
    await saveChords(normalized);
  }, []);

  return (
    <ChordContext.Provider
      value={{ chords, loading, createChord, updateChord, deleteChord, getChord, getChordsByName, importChords }}
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
