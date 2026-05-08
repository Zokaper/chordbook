const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC: Record<string, string> = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B",
};

function noteToIndex(note: string): number {
  const resolved = ENHARMONIC[note] ?? note;
  return CHROMATIC.indexOf(resolved);
}

function transposeNote(note: string, semitones: number): string {
  const idx = noteToIndex(note);
  if (idx === -1) return note;
  return CHROMATIC[(idx + semitones + 12) % 12];
}

/**
 * Transposes a chord name up by the given number of semitones.
 * Handles slash chords (G/B → B/D# with capo 4), any quality suffix, and
 * enharmonic spellings (Bb, Db, etc.).
 *
 * Examples with capo=4:
 *   C    → E
 *   Am   → C#m
 *   G/B  → B/D#
 *   Fmaj7 → Amaj7
 */
export function transposeChord(chord: string, semitones: number): string {
  if (!semitones || !chord) return chord;

  const slashIdx = chord.indexOf("/");

  if (slashIdx > 0) {
    const mainPart = chord.slice(0, slashIdx);
    const bassPart = chord.slice(slashIdx + 1);

    const mainMatch = mainPart.match(/^([A-G][#b]?)(.*)/);
    const bassMatch = bassPart.match(/^([A-G][#b]?)(.*)/);
    if (!mainMatch) return chord;

    const newMain = transposeNote(mainMatch[1], semitones) + mainMatch[2];
    const newBass = bassMatch
      ? transposeNote(bassMatch[1], semitones) + bassMatch[2]
      : bassPart;
    return `${newMain}/${newBass}`;
  }

  const match = chord.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chord;
  return transposeNote(match[1], semitones) + match[2];
}

/** Human-readable capo label, e.g. capoLabel(4) → "Capo 4" */
export function capoLabel(capo: number): string {
  return capo > 0 ? `Capo ${capo}` : "";
}
