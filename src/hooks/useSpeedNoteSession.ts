import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNoteGenerator,
  DIFFICULTY_CONFIGS,
  midiToSharpLabel,
  noteLabelToMidi,
  type ClefMode,
  type DifficultyTier,
  type GeneratedNote,
  type NoteLetter,
  type PracticeMode
} from "../lib/noteGenerator";
import { playPianoNote, warmPianoSamples } from "../lib/pianoPlayer";

export type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

export type NoteResultState = "pending" | "correct" | "wrong";

export type SpeedNoteSessionState = {
  mode: ClefMode;
  difficulty: DifficultyTier;
  practiceMode: PracticeMode;
  leaderboardMode: boolean;
  notesPerSet: number;
  numberOfSets: number;
  gameRunning: boolean;
  completedSets: number;
  currentNotes: GeneratedNote[];
  currentNoteIndex: number;
  currentTargetNote: GeneratedNote;
  locked: boolean;
  streak: number;
  correct: number;
  incorrect: number;
  correctNotesAnswered: number;
  totalNotesAnswered: number;
  accuracyPercent: number;
  currentNoteResults: NoteResultState[];
  currentNoteElapsedMs: number;
  averageResponseMs: number;
  feedback: FeedbackState;
  feedbackClass: "neutral" | "success" | "error";
  roundEnded: boolean;
  leaderboardEligible: boolean;
  remainingSprintMs: number;
};

const DEFAULT_MODE: ClefMode = "treble";
const DEFAULT_DIFFICULTY: DifficultyTier = "beginner";
const DEFAULT_PRACTICE_MODE: PracticeMode = "classic";
const DEFAULT_NOTES_PER_SET = 4;
const DEFAULT_NUMBER_OF_SETS = 5;
const SPRINT_DURATION_MS = 60_000;
const LEADERBOARD_MODE_PRESET = {
  mode: "treble" as const,
  difficulty: "beginner" as const,
  practiceMode: "classic" as const,
  notesPerSet: 4,
  numberOfSets: 5
};

function isCorrectGuess(inputLabel: string, expectedLabel: string, exactPitch: boolean) {
  if (!exactPitch) {
    return inputLabel[0] === expectedLabel[0];
  }
  const inputMidi = noteLabelToMidi(inputLabel);
  const expectedMidi = noteLabelToMidi(expectedLabel);
  if (inputMidi === null || expectedMidi === null) {
    return inputLabel === expectedLabel;
  }
  return inputMidi === expectedMidi;
}

export function useSpeedNoteSession() {
  const [mode, setMode] = useState<ClefMode>(DEFAULT_MODE);
  const [difficulty, setDifficulty] = useState<DifficultyTier>(DEFAULT_DIFFICULTY);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(DEFAULT_PRACTICE_MODE);
  const [leaderboardMode, setLeaderboardMode] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [numberOfSets, setNumberOfSets] = useState(DEFAULT_NUMBER_OF_SETS);
  const [completedSets, setCompletedSets] = useState(0);
  const [notesPerSet, setNotesPerSet] = useState(DEFAULT_NOTES_PER_SET);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [totalCorrectResponseTimeMs, setTotalCorrectResponseTimeMs] = useState(0);
  const [correctNotesAnswered, setCorrectNotesAnswered] = useState(0);
  const [totalNotesAnswered, setTotalNotesAnswered] = useState(0);
  const [noteStartedAt, setNoteStartedAt] = useState(() => Date.now());
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [lastResponseTimeMs, setLastResponseTimeMs] = useState(0);
  const [locked, setLocked] = useState(false);
  const [remainingSprintMs, setRemainingSprintMs] = useState(SPRINT_DURATION_MS);
  const [missCountByPitch, setMissCountByPitch] = useState<Map<string, number>>(new Map());
  const [currentSetHadWrong, setCurrentSetHadWrong] = useState(false);
  const nextSetTimeoutRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Press Start to begin."
  });

  const generator = useMemo(() => createNoteGenerator(DIFFICULTY_CONFIGS[difficulty]), [difficulty]);
  const initialSet = useMemo(
    () =>
      generator.generateNoteSet(DEFAULT_MODE, DEFAULT_NOTES_PER_SET, {
        missCountByPitch
      }),
    [generator, missCountByPitch]
  );
  const [currentNotes, setCurrentNotes] = useState<GeneratedNote[]>(initialSet);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [currentNoteResults, setCurrentNoteResults] = useState<NoteResultState[]>(
    Array.from({ length: initialSet.length }, () => "pending")
  );

  const clearQueuedNextSet = useCallback(() => {
    if (nextSetTimeoutRef.current !== null) {
      window.clearTimeout(nextSetTimeoutRef.current);
      nextSetTimeoutRef.current = null;
    }
  }, []);

  const nextNoteSet = useCallback(
    (nextMode: ClefMode, nextCount: number) => {
      clearQueuedNextSet();
      const nextNotes = generator.generateNoteSet(nextMode, nextCount, { missCountByPitch });
      setCurrentNotes(nextNotes);
      setCurrentNoteIndex(0);
      setCurrentNoteResults(Array.from({ length: nextNotes.length }, () => "pending"));
      setCurrentSetHadWrong(false);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setLocked(false);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Pick the letter name for this note."
      });
    },
    [clearQueuedNextSet, generator, missCountByPitch]
  );

  const resetSessionState = useCallback(
    (message: string, overrides?: { mode?: ClefMode; notesPerSet?: number; numberOfSets?: number; difficulty?: DifficultyTier }) => {
      const targetMode = overrides?.mode ?? mode;
      const targetNotesPerSet = overrides?.notesPerSet ?? notesPerSet;
      const targetNumberOfSets = overrides?.numberOfSets ?? numberOfSets;
      const targetDifficulty = overrides?.difficulty ?? difficulty;
      const targetGenerator = createNoteGenerator(DIFFICULTY_CONFIGS[targetDifficulty]);
      clearQueuedNextSet();
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesAnswered(0);
      setTotalNotesAnswered(0);
      setLocked(false);
      setRemainingSprintMs(SPRINT_DURATION_MS);
      setNumberOfSets(targetNumberOfSets);
      const nextNotes = targetGenerator.generateNoteSet(targetMode, targetNotesPerSet, { missCountByPitch });
      setCurrentNotes(nextNotes);
      setCurrentNoteIndex(0);
      setCurrentNoteResults(Array.from({ length: nextNotes.length }, () => "pending"));
      setCurrentSetHadWrong(false);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message
      });
    },
    [clearQueuedNextSet, difficulty, missCountByPitch, mode, notesPerSet, numberOfSets]
  );

  const start = useCallback(() => {
    if (completedSets >= numberOfSets) {
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesAnswered(0);
      setTotalNotesAnswered(0);
      setCompletedSets(0);
    }
    void warmPianoSamples();
    nextNoteSet(mode, notesPerSet);
    setRemainingSprintMs(SPRINT_DURATION_MS);
    setGameRunning(true);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [completedSets, mode, nextNoteSet, notesPerSet, numberOfSets]);

  const stop = useCallback(() => {
    resetSessionState("Press Start to begin.");
  }, [resetSessionState]);

  const currentTargetNote = currentNotes[currentNoteIndex] ?? currentNotes[0];

  const submitGuess = useCallback(
    (guessLabel: string, lastGuess: NoteLetter | null) => {
      if (locked || !gameRunning || !currentTargetNote) {
        return;
      }
      const exactPitch = DIFFICULTY_CONFIGS[difficulty].exactPitchMatch;
      const isCorrect = isCorrectGuess(guessLabel, currentTargetNote.label, exactPitch);
      const responseTimeMs = Date.now() - noteStartedAt;

      setLastResponseTimeMs(responseTimeMs);
      setTotalNotesAnswered((value) => value + 1);
      setCurrentNoteResults((current) => {
        const next = [...current];
        next[currentNoteIndex] = isCorrect ? "correct" : "wrong";
        return next;
      });

      if (isCorrect) {
        setTotalCorrectResponseTimeMs((value) => value + responseTimeMs);
        setCorrectNotesAnswered((value) => value + 1);
        void playPianoNote(currentTargetNote.label).catch(() => {
          // Keep gameplay unblocked if audio playback fails.
        });
      } else {
        setCurrentSetHadWrong(true);
        setMissCountByPitch((current) => {
          const next = new Map(current);
          next.set(currentTargetNote.label, (next.get(currentTargetNote.label) ?? 0) + 1);
          return next;
        });
      }

      const isLastInSet = currentNoteIndex === currentNotes.length - 1;
      if (!isLastInSet) {
        setCurrentNoteIndex((value) => value + 1);
        setNoteStartedAt(Date.now());
        setElapsedNow(Date.now());
        setFeedback({
          revealAnswer: true,
          lastGuess,
          message: isCorrect
            ? `Correct. Now identify note ${currentNoteIndex + 2} of ${currentNotes.length}.`
            : `Incorrect. Expected ${currentTargetNote.letter}. Continue to note ${currentNoteIndex + 2} of ${currentNotes.length}.`
        });
        return;
      }

      const nextCompletedSets = completedSets + 1;
      setCompletedSets(nextCompletedSets);
      setLocked(true);
      const finalSetHadWrong = currentSetHadWrong || !isCorrect;
      if (finalSetHadWrong) {
        setIncorrect((value) => value + 1);
        setStreak(0);
        setFeedback({
          revealAnswer: true,
          lastGuess,
          message: `Set complete with mistakes (${nextCompletedSets}/${numberOfSets}).`
        });
      } else {
        setCorrect((value) => value + 1);
        setStreak((value) => value + 1);
        setFeedback({
          revealAnswer: true,
          lastGuess,
          message: `Perfect set complete (${nextCompletedSets}/${numberOfSets}).`
        });
      }

      if (nextCompletedSets >= numberOfSets) {
        setGameRunning(false);
        clearQueuedNextSet();
        return;
      }

      const delayMs = practiceMode === "sprint" ? 0 : 800;
      nextSetTimeoutRef.current = window.setTimeout(() => {
        nextNoteSet(mode, notesPerSet);
      }, delayMs);
    },
    [
      completedSets,
      clearQueuedNextSet,
      currentNoteIndex,
      currentNotes.length,
      currentTargetNote,
      currentSetHadWrong,
      difficulty,
      gameRunning,
      locked,
      mode,
      noteStartedAt,
      notesPerSet,
      numberOfSets,
      practiceMode,
      nextNoteSet
    ]
  );

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      submitGuess(`${letter}4`, letter);
    },
    [submitGuess]
  );

  const handleMidiAnswer = useCallback(
    (midiNote: number) => {
      const midiLabel = midiToSharpLabel(midiNote);
      submitGuess(midiLabel, midiLabel[0] as NoteLetter);
    },
    [submitGuess]
  );

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      setMode(nextMode);
      resetSessionState("Mode updated. Press Start to begin.", { mode: nextMode });
    },
    [resetSessionState]
  );

  const onDifficultyChange = useCallback((nextDifficulty: DifficultyTier) => {
    if (leaderboardMode) {
      return;
    }
    setDifficulty(nextDifficulty);
    setMissCountByPitch(new Map());
    resetSessionState("Difficulty updated. Press Start to begin.", { difficulty: nextDifficulty });
  }, [leaderboardMode, resetSessionState]);

  const onPracticeModeChange = useCallback((nextPracticeMode: PracticeMode) => {
    if (leaderboardMode) {
      return;
    }
    setPracticeMode(nextPracticeMode);
  }, [leaderboardMode]);

  const onNotesPerSetChange = useCallback(
    (count: number) => {
      if (leaderboardMode) {
        return;
      }
      setNotesPerSet(count);
      resetSessionState("Set size updated. Press Start to begin.", { notesPerSet: count });
    },
    [leaderboardMode, resetSessionState]
  );

  const onNumberOfSetsChange = useCallback(
    (count: number) => {
      if (leaderboardMode) {
        return;
      }
      resetSessionState(`Number of sets updated to ${count}. Press Start to begin.`, { numberOfSets: count });
    },
    [leaderboardMode, resetSessionState]
  );

  const onLeaderboardModeChange = useCallback(
    (enabled: boolean) => {
      setLeaderboardMode(enabled);
      if (enabled) {
        setMode(LEADERBOARD_MODE_PRESET.mode);
        setDifficulty(LEADERBOARD_MODE_PRESET.difficulty);
        setPracticeMode(LEADERBOARD_MODE_PRESET.practiceMode);
        setNotesPerSet(LEADERBOARD_MODE_PRESET.notesPerSet);
        resetSessionState("Leaderboard mode enabled.", {
          mode: LEADERBOARD_MODE_PRESET.mode,
          difficulty: LEADERBOARD_MODE_PRESET.difficulty,
          notesPerSet: LEADERBOARD_MODE_PRESET.notesPerSet,
          numberOfSets: LEADERBOARD_MODE_PRESET.numberOfSets
        });
        return;
      }
      resetSessionState("Leaderboard mode disabled.");
    },
    [resetSessionState]
  );

  useEffect(() => {
    if (locked || !gameRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedNow(Date.now());
      if (practiceMode === "sprint") {
        setRemainingSprintMs((value) => {
          const next = Math.max(0, value - 100);
          if (next === 0 && gameRunning) {
            clearQueuedNextSet();
            setGameRunning(false);
            setFeedback({
              revealAnswer: true,
              lastGuess: null,
              message: "Sprint complete. Time is up."
            });
          }
          return next;
        });
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [clearQueuedNextSet, gameRunning, locked, practiceMode]);

  useEffect(() => {
    return () => {
      clearQueuedNextSet();
    };
  }, [clearQueuedNextSet]);

  const currentNoteElapsedMs = useMemo(() => {
    const elapsed = locked ? lastResponseTimeMs : elapsedNow - noteStartedAt;
    return Math.max(0, elapsed);
  }, [elapsedNow, lastResponseTimeMs, locked, noteStartedAt]);

  const averageResponseMs = correctNotesAnswered > 0 ? totalCorrectResponseTimeMs / correctNotesAnswered : 0;
  const accuracyPercent = totalNotesAnswered > 0 ? (correctNotesAnswered / totalNotesAnswered) * 100 : 0;
  const roundEnded = !gameRunning && completedSets >= numberOfSets;
  const leaderboardEligible = leaderboardMode && roundEnded;
  const feedbackClass: "neutral" | "success" | "error" = !feedback.revealAnswer
    ? "neutral"
    : feedback.lastGuess === currentTargetNote?.letter
      ? "success"
      : "error";

  return {
    state: {
      mode,
      difficulty,
      practiceMode,
      leaderboardMode,
      notesPerSet,
      numberOfSets,
      gameRunning,
      completedSets,
      currentNotes,
      currentNoteIndex,
      currentTargetNote,
      locked,
      streak,
      correct,
      incorrect,
      correctNotesAnswered,
      totalNotesAnswered,
      accuracyPercent,
      currentNoteResults,
      currentNoteElapsedMs,
      averageResponseMs,
      feedback,
      feedbackClass,
      roundEnded,
      leaderboardEligible,
      remainingSprintMs
    } satisfies SpeedNoteSessionState,
    actions: {
      start,
      stop,
      handleAnswer,
      handleMidiAnswer,
      onModeChange,
      onDifficultyChange,
      onPracticeModeChange,
      onNotesPerSetChange,
      onNumberOfSetsChange,
      onLeaderboardModeChange
    }
  };
}
