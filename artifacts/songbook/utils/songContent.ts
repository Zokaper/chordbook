export type StrumBeat = "-" | "D" | "U" | "DU" | "x" | "C";

export type ChordLine = { id: string; type: "chord"; chords: string[] };
export type LyricLine = { id: string; type: "lyric"; text: string };
export type StrumLine = { id: string; type: "strum"; beats: StrumBeat[]; repeat: number; chordChanges?: Record<number, string>; repeatChords?: string[] };
export type RiffLine = { id: string; type: "riff"; grid: (number | string | null)[][]; numSlots: number };
export type NoteLine = { id: string; type: "note"; text: string };
export type SongLine = ChordLine | LyricLine | StrumLine | RiffLine | NoteLine;
export type Section = { id: string; name: string; lines: SongLine[] };

const genId = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);
const CHORD_RE = /^[A-G][#b]?(m|maj|maj7|M7|min|dim|aug|sus2|sus4|sus|add9|add11|7|9|11|13|6|5|m7|m9|mM7)?(\/[A-G][#b]?)?$/;
const TAB_LINE_RE = /^[eEADGBb]\|/;
const BEAT_VALUES: StrumBeat[] = ["-", "D", "U", "DU", "x"];
const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const DEFAULT_SLOTS = 8;
const ARTICULATIONS = new Set(["h", "p", "/", "＼", "\\", "b", "~"]);
const normalizeArticulation = (value: string) => value === "\\" ? "＼" : value;

const makeEmptyGrid = (slots: number) => STRING_NAMES.map(() => Array<number | string | null>(slots).fill(null));
const isChordLine = (line: string) => {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => CHORD_RE.test(token));
};

export function serializeRiff(grid: (number | string | null)[][], numSlots: number): string {
  return "RIFF:" + grid.map((slots, index) => {
    const content = slots.slice(0, numSlots).map((value) =>
      value === null ? "-" : String(value)
    ).join("");
    return `${STRING_NAMES[index]}|${content}|`;
  }).join(":");
}

function parseRiff(raw: string): { grid: (number | string | null)[][]; numSlots: number } {
  const payload = raw.startsWith("RIFF:") ? raw.slice(5) : raw;
  const rows: (number | string | null)[][] = STRING_NAMES.map(() => []);
  payload.split(":").slice(0, 6).forEach((part, index) => {
    const inner = part.replace(/^[a-zA-Z]\|/, "").replace(/\|$/, "");
    if (inner.includes(",")) {
      inner.split(",").forEach((token) => {
        if (!token || token === "-") return void rows[index].push(null);
        const fret = /\d/.test(token[0]) ? Number.parseInt(token[0], 10) : null;
        const articulation = token.length > 1 ? token[1] : null;
        if (fret !== null) rows[index].push(fret);
        if (articulation && ARTICULATIONS.has(articulation)) rows[index].push(normalizeArticulation(articulation));
        if (fret === null && !articulation) rows[index].push(null);
      });
    } else {
      [...inner].forEach((character) => {
        if (character === "-") rows[index].push(null);
        else if (/\d/.test(character)) rows[index].push(Number.parseInt(character, 10));
        else if (ARTICULATIONS.has(character)) rows[index].push(normalizeArticulation(character));
        else rows[index].push(null);
      });
    }
  });
  const numSlots = Math.max(DEFAULT_SLOTS, ...rows.map((row) => row.length));
  rows.forEach((row, index) => {
    while (row.length < numSlots) row.push(null);
    rows[index] = row.slice(0, numSlots);
  });
  return { grid: rows, numSlots };
}

export function parseContent(raw: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of raw.split("\n")) {
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = { id: genId(), name: header[1], lines: [] };
      sections.push(current);
      continue;
    }
    if (!line.trim()) continue;
    if (!current) {
      current = { id: genId(), name: "Verse", lines: [] };
      sections.push(current);
    }

    if (line.startsWith("STRUM:")) {
      const [beatsPart, ...segments] = line.slice(6).split(";");
      const rawBeats = beatsPart.split(",").map((beat) =>
        BEAT_VALUES.includes(beat as StrumBeat) || beat === "C" ? beat as StrumBeat : "-"
      );
      while (rawBeats.length < 8) rawBeats.push("-");
      const chordChanges: Record<number, string> = {};
      const chordSegment = segments.find((part) => part.startsWith("CHORDS:"));
      chordSegment?.slice(7).split(",").forEach((change) => {
        const separator = change.lastIndexOf("@");
        if (separator < 0) return;
        const name = change.slice(0, separator);
        const beatIndex = Number.parseInt(change.slice(separator + 1), 10);
        if (name && beatIndex >= 0 && beatIndex < rawBeats.length) chordChanges[beatIndex] = name;
      });
      const beats = rawBeats.map((beat, index) => {
        if (beat !== "C") return beat;
        if (!chordChanges[index]) chordChanges[index] = "?";
        return "-" as StrumBeat;
      });
      const repeatSegment = segments.find((part) => part.startsWith("REPEAT:"));
      const parsedRepeat = repeatSegment ? Number.parseInt(repeatSegment.slice(7), 10) : 1;
      const cycleSegment = segments.find((part) => part.startsWith("CYCLE:"));
      const repeatChords = cycleSegment?.slice(6).split(",").filter(Boolean) ?? [];
      current.lines.push({
        id: genId(), type: "strum", beats, repeat: Number.isFinite(parsedRepeat) ? Math.max(1, parsedRepeat) : 1,
        ...(Object.keys(chordChanges).length ? { chordChanges } : {}),
        ...(repeatChords.length ? { repeatChords } : {}),
      });
    } else if (line.startsWith("CHORD:")) {
      current.lines.push({ id: genId(), type: "chord", chords: line.slice(6).trim().split(/\s+/).filter(Boolean) });
    } else if (line.startsWith("NOTE:")) {
      current.lines.push({ id: genId(), type: "note", text: line.slice(5) });
    } else if (line.startsWith("RIFF:")) {
      current.lines.push({ id: genId(), type: "riff", ...parseRiff(line) });
    } else if (TAB_LINE_RE.test(line.trim())) {
      const frets = [...line.trim().replace(/^[eEADGBb]\|/, "").replace(/\|$/, "")]
        .map((character) => character === "-" ? null : /\d/.test(character) ? Number.parseInt(character, 10) : null);
      const numSlots = Math.max(frets.length, DEFAULT_SLOTS);
      const grid = makeEmptyGrid(numSlots);
      frets.forEach((fret, index) => { if (index < numSlots) grid[0][index] = fret; });
      current.lines.push({ id: genId(), type: "riff", grid, numSlots });
    } else if (isChordLine(line)) {
      current.lines.push({ id: genId(), type: "chord", chords: line.trim().split(/\s+/).filter(Boolean) });
    } else {
      current.lines.push({ id: genId(), type: "lyric", text: line });
    }
  }
  return sections;
}

export function serializeContent(sections: Section[]): string {
  return sections.map((section) => {
    const lines = section.lines.filter((line) => {
      if (line.type === "chord") return line.chords.length > 0;
      if (line.type === "strum") return line.beats.some((beat) => beat !== "-") || !!Object.keys(line.chordChanges ?? {}).length || !!line.repeatChords?.length;
      if (line.type === "riff") return line.grid.some((row) => row.some((cell) => cell !== null));
      return line.text.trim() !== "";
    }).map((line) => {
      if (line.type === "chord") return `CHORD:${line.chords.join("  ")}`;
      if (line.type === "note") return `NOTE:${line.text}`;
      if (line.type === "riff") return serializeRiff(line.grid, line.numSlots);
      if (line.type === "strum") {
        let value = `STRUM:${line.beats.join(",")}`;
        if (line.repeat > 1) value += `;REPEAT:${line.repeat}`;
        const chordChanges = Object.entries(line.chordChanges ?? {}).sort(([a], [b]) => Number(a) - Number(b));
        if (chordChanges.length) value += `;CHORDS:${chordChanges.map(([index, name]) => `${name}@${index}`).join(",")}`;
        if (line.repeatChords?.length) value += `;CYCLE:${line.repeatChords.join(",")}`;
        return value;
      }
      return line.text;
    });
    return [`[${section.name}]`, ...lines].join("\n");
  }).join("\n\n");
}
