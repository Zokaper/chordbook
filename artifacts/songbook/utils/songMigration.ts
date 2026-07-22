export interface PersistedSong {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  tempo: string;
  tags: string[];
  content: string;
  chordVariants: Record<string, string>;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

type RawSong = Partial<PersistedSong> & { genre?: string };

export function migrateSongs(raw: unknown): { songs: PersistedSong[]; changed: boolean } {
  if (!Array.isArray(raw)) return { songs: [], changed: false };
  let changed = false;
  const songs = (raw as RawSong[]).map((song) => {
    let tags = Array.isArray(song.tags) ? song.tags.filter(Boolean) : undefined;
    if (!tags) {
      tags = song.genre ? [song.genre] : [];
      changed = true;
    }
    if (typeof song.isDraft !== "boolean") changed = true;
    const { genre: _legacyGenre, ...rest } = song;
    return {
      ...rest,
      id: rest.id ?? Date.now().toString() + Math.random().toString(36).slice(2, 7),
      title: rest.title ?? "",
      artist: rest.artist ?? "",
      key: rest.key ?? "",
      capo: typeof rest.capo === "number" ? rest.capo : 0,
      tempo: rest.tempo ?? "",
      tags,
      content: rest.content ?? "",
      chordVariants: rest.chordVariants && typeof rest.chordVariants === "object" && !Array.isArray(rest.chordVariants)
        ? rest.chordVariants as Record<string, string>
        : {},
      isDraft: rest.isDraft === true,
      createdAt: rest.createdAt ?? new Date().toISOString(),
      updatedAt: rest.updatedAt ?? rest.createdAt ?? new Date().toISOString(),
    } satisfies PersistedSong;
  });
  return { songs, changed };
}
