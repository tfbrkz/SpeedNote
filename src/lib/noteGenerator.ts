export type ClefMode = "treble" | "bass" | "mixed";
export type Clef = "treble" | "bass";
export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type NoteDuration = "w" | "h" | "q" | "8";

export type GeneratedNote = {
  clef: Clef;
  key: string;
  letter: NoteLetter;
  label: string;
  duration: NoteDuration;
};

const TREBLE_RANGE = ["E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"] as const;
const BASS_RANGE = ["G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3"] as const;

function randomIndex(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function pitchToVexflowKey(pitch: string) {
  const letter = pitch[0].toLowerCase();
  const octave = pitch.slice(1);
  return `${letter}/${octave}`;
}

function pitchToLetter(pitch: string): NoteLetter {
  return pitch[0] as NoteLetter;
}

function chooseClef(mode: ClefMode): Clef {
  if (mode === "mixed") {
    return Math.random() < 0.5 ? "treble" : "bass";
  }
  return mode;
}

function chooseDuration(): NoteDuration {
  const durations: NoteDuration[] = ["q", "8", "h", "w"];
  return durations[randomIndex(durations.length)];
}

export function generateNote(mode: ClefMode): GeneratedNote {
  const clef = chooseClef(mode);
  const range = clef === "treble" ? TREBLE_RANGE : BASS_RANGE;
  const pitch = range[randomIndex(range.length)];

  return {
    clef,
    key: pitchToVexflowKey(pitch),
    letter: pitchToLetter(pitch),
    label: pitch,
    duration: chooseDuration()
  };
}
