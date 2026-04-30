export type ClefMode = "treble" | "bass" | "mixed";
export type Clef = "treble" | "bass";
export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type NoteDuration = "w" | "h" | "q" | "8";
export type DifficultyTier = "beginner" | "intermediate" | "advanced";
export type PracticeMode = "classic" | "sprint" | "survival";

export type GeneratedNote = {
  clef: Clef;
  key: string;
  letter: NoteLetter;
  label: string;
  duration: NoteDuration;
};

export type DifficultyConfig = {
  tier: DifficultyTier;
  minMidi: number;
  maxMidi: number;
  accidentalProbability: number;
  allowDoubleAccidentals: boolean;
  exactPitchMatch: boolean;
};

const DURATION_WEIGHTS: ReadonlyArray<{ duration: NoteDuration; weight: number }> = [
  { duration: "q", weight: 1 },
  { duration: "8", weight: 1 },
  { duration: "h", weight: 1 },
  { duration: "w", weight: 1 }
];
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const DOUBLE_SHARP_ROOTS = ["C", "D", "F", "G", "A"] as const;
const DOUBLE_FLAT_ROOTS = ["D", "E", "G", "A", "B"] as const;
const LETTER_TO_BASE_PC: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

export const DIFFICULTY_CONFIGS: Record<DifficultyTier, DifficultyConfig> = {
  beginner: {
    tier: "beginner",
    minMidi: 64, // E4
    maxMidi: 77, // F5
    accidentalProbability: 0,
    allowDoubleAccidentals: false,
    exactPitchMatch: false
  },
  intermediate: {
    tier: "intermediate",
    minMidi: 60, // C4
    maxMidi: 84, // C6
    accidentalProbability: 0.2,
    allowDoubleAccidentals: false,
    exactPitchMatch: true
  },
  advanced: {
    tier: "advanced",
    minMidi: 43, // G2
    maxMidi: 96, // C7
    accidentalProbability: 0.45,
    allowDoubleAccidentals: true,
    exactPitchMatch: true
  }
};

function randomIndex(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function randomChoice<T>(values: readonly T[]): T {
  return values[randomIndex(values.length)];
}

function midiToOctave(midi: number) {
  return Math.floor(midi / 12) - 1;
}

function midiToNaturalPitchName(midi: number, useFlats: boolean) {
  const octave = midiToOctave(midi);
  const name = useFlats ? FLAT_NAMES[midi % 12] : SHARP_NAMES[midi % 12];
  return `${name}${octave}`;
}

function toVexflowKey(label: string) {
  const match = label.match(/^([A-G])([#b]{0,2})(-?\d)$/);
  if (!match) {
    return "c/4";
  }
  const [, letter, accidental, octave] = match;
  return `${letter.toLowerCase()}${accidental}/${octave}`;
}

function chooseDuration(): NoteDuration {
  const totalWeight = DURATION_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let selector = Math.random() * totalWeight;
  for (const item of DURATION_WEIGHTS) {
    selector -= item.weight;
    if (selector <= 0) {
      return item.duration;
    }
  }
  return "q";
}

function toNoteLetter(label: string): NoteLetter {
  return label[0] as NoteLetter;
}

function chooseClef(mode: ClefMode): Clef {
  if (mode !== "mixed") {
    return mode;
  }
  return Math.random() < 0.5 ? "treble" : "bass";
}

function getRangeForTierAndClef(tier: DifficultyTier, clef: Clef) {
  if (clef === "treble") {
    if (tier === "beginner") return { min: 64, max: 77 }; // E4..F5
    if (tier === "intermediate") return { min: 60, max: 84 }; // C4..C6
    return { min: 57, max: 84 }; // A3..C6 (<=2 ledger lines)
  }

  if (tier === "beginner") return { min: 43, max: 57 }; // G2..A3
  if (tier === "intermediate") return { min: 40, max: 64 }; // E2..E4
  return { min: 36, max: 64 }; // C2..E4 (<=2 ledger lines)
}

function naturalizeFromTargetMidi(midi: number, tier: DifficultyTier) {
  const useFlats = Math.random() < 0.5;
  let label = midiToNaturalPitchName(midi, useFlats);

  if (tier !== "advanced") {
    return label;
  }

  const roll = Math.random();
  if (roll < 0.12) {
    const root = randomChoice(DOUBLE_SHARP_ROOTS);
    const octave = midiToOctave(midi);
    const candidatePc = (LETTER_TO_BASE_PC[root] + 2) % 12;
    if (candidatePc === midi % 12) {
      label = `${root}##${octave}`;
    }
  } else if (roll < 0.24) {
    const root = randomChoice(DOUBLE_FLAT_ROOTS);
    const octave = midiToOctave(midi);
    const candidatePc = (LETTER_TO_BASE_PC[root] + 10) % 12;
    if (candidatePc === midi % 12) {
      label = `${root}bb${octave}`;
    }
  }
  return label;
}

function weightedPitchChoice(pool: number[], missCountByPitch?: ReadonlyMap<string, number>) {
  if (!missCountByPitch || pool.length === 0) {
    return pool[randomIndex(pool.length)];
  }
  const weighted = pool.map((midi) => {
    const sharpLabel = midiToNaturalPitchName(midi, false);
    const flatLabel = midiToNaturalPitchName(midi, true);
    const misses = Math.max(missCountByPitch.get(sharpLabel) ?? 0, missCountByPitch.get(flatLabel) ?? 0);
    return { midi, weight: 1 + misses };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let selector = Math.random() * totalWeight;
  for (const item of weighted) {
    selector -= item.weight;
    if (selector <= 0) {
      return item.midi;
    }
  }
  return weighted[weighted.length - 1]?.midi ?? pool[0];
}

export type NoteGeneratorFactory = {
  generateNote: (
    mode: ClefMode,
    options?: {
      missCountByPitch?: ReadonlyMap<string, number>;
    }
  ) => GeneratedNote;
  generateNoteSet: (
    mode: ClefMode,
    notesPerSet: number,
    options?: {
      missCountByPitch?: ReadonlyMap<string, number>;
    }
  ) => GeneratedNote[];
};

export function createNoteGenerator(config: DifficultyConfig): NoteGeneratorFactory {
  const buildPool = (min: number, max: number) => {
    const pool: number[] = [];
    for (let midi = min; midi <= max; midi += 1) {
      pool.push(midi);
    }
    return pool;
  };

  const trebleRange = getRangeForTierAndClef(config.tier, "treble");
  const bassRange = getRangeForTierAndClef(config.tier, "bass");
  const treblePool = buildPool(trebleRange.min, trebleRange.max);
  const bassPool = buildPool(bassRange.min, bassRange.max);

  const generateFromPool = (mode: ClefMode, missCountByPitch?: ReadonlyMap<string, number>): GeneratedNote => {
    const clef = chooseClef(mode);
    const pool = clef === "treble" ? treblePool : bassPool;
    const midi = weightedPitchChoice(pool, missCountByPitch);
    const applyAccidental = Math.random() < config.accidentalProbability;
    const label = applyAccidental
      ? naturalizeFromTargetMidi(midi, config.tier)
      : midiToNaturalPitchName(midi, false);

    return {
      clef,
      key: toVexflowKey(label),
      letter: toNoteLetter(label),
      label,
      duration: chooseDuration()
    };
  };

  return {
    generateNote: (mode, options) => generateFromPool(mode, options?.missCountByPitch),
    generateNoteSet: (mode, notesPerSet, options) =>
      Array.from({ length: notesPerSet }, () => generateFromPool(mode, options?.missCountByPitch))
  };
}

export function noteLabelToMidi(noteLabel: string) {
  const match = noteLabel.match(/^([A-G])([#b]{0,2})(-?\d)$/);
  if (!match) {
    return null;
  }
  const [, letter, accidental, octaveText] = match;
  const base = LETTER_TO_BASE_PC[letter as NoteLetter];
  const octave = Number(octaveText);
  if (!Number.isFinite(octave)) {
    return null;
  }
  let shift = 0;
  if (accidental === "#") shift = 1;
  if (accidental === "b") shift = -1;
  if (accidental === "##") shift = 2;
  if (accidental === "bb") shift = -2;
  return 12 * (octave + 1) + base + shift;
}

export function midiToSharpLabel(midi: number) {
  const octave = midiToOctave(midi);
  return `${SHARP_NAMES[midi % 12]}${octave}`;
}

const legacyBeginnerGenerator = createNoteGenerator(DIFFICULTY_CONFIGS.beginner);

export function generateNote(mode: ClefMode): GeneratedNote {
  return legacyBeginnerGenerator.generateNote(mode);
}
