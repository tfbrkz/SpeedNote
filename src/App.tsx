import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerButtons } from "./components/AnswerButtons";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffDisplay } from "./components/StaffDisplay";
import { generateNote, type ClefMode, type GeneratedNote, type NoteLetter } from "./lib/noteGenerator";
import { playPianoNote, warmPianoSamples } from "./lib/pianoPlayer";

type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  totalSets: number;
  totalCorrect: number;
  averageTimePerNoteMs: number;
  createdAtMs: number;
};

const NOTES_PER_SET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const DEFAULT_MODE: ClefMode = "treble";
const DEFAULT_NOTES_PER_SET = 4;
const DEFAULT_NUMBER_OF_SETS = 5;
const LEADERBOARD_STORAGE_KEY = "speednote-leaderboard-v1";

function loadLeaderboardEntries(): LeaderboardEntry[] {
  const storedValue = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
  if (!storedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue) as LeaderboardEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateNoteSet(mode: ClefMode, notesPerSet: number): GeneratedNote[] {
  const firstNote = generateNote(mode);
  const notes: GeneratedNote[] = [firstNote];

  for (let index = 1; index < notesPerSet; index += 1) {
    notes.push(generateNote(firstNote.clef));
  }

  return notes;
}

function App() {
  const [mode, setMode] = useState<ClefMode>(DEFAULT_MODE);
  const [gameRunning, setGameRunning] = useState(false);
  const [numberOfSets, setNumberOfSets] = useState<number>(DEFAULT_NUMBER_OF_SETS);
  const [completedSets, setCompletedSets] = useState(0);
  const [notesPerSet, setNotesPerSet] = useState<number>(DEFAULT_NOTES_PER_SET);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<GeneratedNote[]>(() =>
    generateNoteSet(DEFAULT_MODE, DEFAULT_NOTES_PER_SET)
  );
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [totalCorrectResponseTimeMs, setTotalCorrectResponseTimeMs] = useState(0);
  const [correctNotesSolved, setCorrectNotesSolved] = useState(0);
  const [pendingFailedTimeMs, setPendingFailedTimeMs] = useState(0);
  const [noteStartedAt, setNoteStartedAt] = useState(() => Date.now());
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [lastResponseTimeMs, setLastResponseTimeMs] = useState(0);
  const [locked, setLocked] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>(() => loadLeaderboardEntries());
  const [leaderboardName, setLeaderboardName] = useState("");
  const [hasSubmittedRound, setHasSubmittedRound] = useState(false);
  const nextSetTimeoutRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Press Start to begin."
  });

  const clearQueuedNextSet = useCallback(() => {
    if (nextSetTimeoutRef.current !== null) {
      window.clearTimeout(nextSetTimeoutRef.current);
      nextSetTimeoutRef.current = null;
    }
  }, []);

  const nextNoteSet = useCallback((currentMode: ClefMode, count: number) => {
    clearQueuedNextSet();
    setCurrentNotes(generateNoteSet(currentMode, count));
    setCurrentNoteIndex(0);
    setNoteStartedAt(Date.now());
    setElapsedNow(Date.now());
    setLastResponseTimeMs(0);
    setLocked(false);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [clearQueuedNextSet]);

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      clearQueuedNextSet();
      setMode(nextMode);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setHasSubmittedRound(false);
      setLeaderboardName("");
      setCurrentNotes(generateNoteSet(nextMode, notesPerSet));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Mode updated. Press Start to begin."
      });
    },
    [clearQueuedNextSet, notesPerSet]
  );

  const onNotesPerSetChange = useCallback(
    (count: number) => {
      clearQueuedNextSet();
      setNotesPerSet(count);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setHasSubmittedRound(false);
      setLeaderboardName("");
      setCurrentNotes(generateNoteSet(mode, count));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Set size updated. Press Start to begin."
      });
    },
    [clearQueuedNextSet, mode]
  );

  const onNumberOfSetsChange = useCallback(
    (count: number) => {
      clearQueuedNextSet();
      setNumberOfSets(count);
      setGameRunning(false);
      setCompletedSets(0);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setHasSubmittedRound(false);
      setLeaderboardName("");
      setCurrentNotes(generateNoteSet(mode, notesPerSet));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: `Number of sets updated to ${count}. Press Start to begin.`
      });
    },
    [clearQueuedNextSet, mode, notesPerSet]
  );

  const scheduleNextOrStop = useCallback(
    (nextCompletedSets: number) => {
      setCompletedSets(nextCompletedSets);
      if (nextCompletedSets >= numberOfSets) {
        setGameRunning(false);
        clearQueuedNextSet();
        return;
      }

      nextSetTimeoutRef.current = window.setTimeout(() => {
        nextNoteSet(mode, notesPerSet);
      }, 1000);
    },
    [clearQueuedNextSet, mode, nextNoteSet, notesPerSet, numberOfSets]
  );

  const handleStartStop = useCallback(() => {
    if (gameRunning) {
      clearQueuedNextSet();
      setGameRunning(false);
      setFeedback((value) =>
        value.revealAnswer ? value : { ...value, message: "Paused. Press Start to resume." }
      );
      return;
    }

    if (completedSets >= numberOfSets) {
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setCompletedSets(0);
      setHasSubmittedRound(false);
      setLeaderboardName("");
    }

    // Always start from a fresh set so users cannot pre-solve before pressing Start.
    void warmPianoSamples();
    nextNoteSet(mode, notesPerSet);
    setGameRunning(true);
    setFeedback({
      revealAnswer: false,
      lastGuess: null,
      message: "Pick the letter name for this note."
    });
  }, [
    completedSets,
    gameRunning,
    mode,
    nextNoteSet,
    notesPerSet,
    numberOfSets,
    clearQueuedNextSet
  ]);

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      if (locked || !gameRunning) {
        return;
      }

      const targetNote = currentNotes[currentNoteIndex];
      const isCorrect = letter === targetNote.letter;

      if (!isCorrect) {
        const responseTimeMs = Date.now() - noteStartedAt;
        setLastResponseTimeMs(responseTimeMs);
        setLocked(true);
        setFeedback({
          revealAnswer: true,
          lastGuess: letter,
          message: `Set failed. Expected ${targetNote.letter} for note ${currentNoteIndex + 1}.`
        });
        setIncorrect((value) => value + 1);
        setStreak(0);
        setPendingFailedTimeMs((value) => value + responseTimeMs);
        const nextCompletedSets = completedSets + 1;
        scheduleNextOrStop(nextCompletedSets);
        if (nextCompletedSets >= numberOfSets) {
          setFeedback({
            revealAnswer: true,
            lastGuess: letter,
            message: `Set failed. Expected ${targetNote.letter}. Session complete (${nextCompletedSets}/${numberOfSets} sets).`
          });
        }
        return;
      }

      void playPianoNote(targetNote.label).catch(() => {
        // Ignore audio playback failures so quiz flow is never blocked.
      });

      const isLastInSet = currentNoteIndex === currentNotes.length - 1;
      if (!isLastInSet) {
        setCurrentNoteIndex((value) => value + 1);
        setFeedback({
          revealAnswer: false,
          lastGuess: letter,
          message: `Good. Now identify note ${currentNoteIndex + 2} of ${currentNotes.length}.`
        });
        return;
      }

      const responseTimeMs = Date.now() - noteStartedAt;
      setLastResponseTimeMs(responseTimeMs);
      setLocked(true);
      setFeedback({
        revealAnswer: true,
        lastGuess: letter,
        message: `Set complete! All ${currentNotes.length} notes were correct.`
      });
      setCorrect((value) => value + 1);
      setCorrectNotesSolved((value) => value + currentNotes.length);
      setStreak((value) => value + 1);
      setTotalCorrectResponseTimeMs((value) => value + pendingFailedTimeMs + responseTimeMs);
      setPendingFailedTimeMs(0);
      const nextCompletedSets = completedSets + 1;
      scheduleNextOrStop(nextCompletedSets);
      if (nextCompletedSets >= numberOfSets) {
        setFeedback({
          revealAnswer: true,
          lastGuess: letter,
          message: `Set complete! Session complete (${nextCompletedSets}/${numberOfSets} sets).`
        });
      }
    },
    [
      completedSets,
      currentNoteIndex,
      currentNotes,
      gameRunning,
      locked,
      noteStartedAt,
      numberOfSets,
      pendingFailedTimeMs,
      scheduleNextOrStop
    ]
  );

  useEffect(() => {
    if (locked || !gameRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameRunning, locked]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!gameRunning || locked) {
        return;
      }

      const letter = event.key.toUpperCase();
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(letter)) {
        return;
      }

      handleAnswer(letter as NoteLetter);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameRunning, handleAnswer, locked]);

  useEffect(() => {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboardEntries));
  }, [leaderboardEntries]);

  useEffect(() => {
    return () => {
      clearQueuedNextSet();
    };
  }, [clearQueuedNextSet]);

  const currentTargetNote = currentNotes[currentNoteIndex];

  const feedbackClass = useMemo(() => {
    if (!feedback.revealAnswer) {
      return "neutral";
    }
    return feedback.lastGuess === currentTargetNote.letter ? "success" : "error";
  }, [currentTargetNote.letter, feedback]);

  const currentNoteElapsedMs = useMemo(() => {
    const elapsed = locked ? lastResponseTimeMs : elapsedNow - noteStartedAt;
    return Math.max(0, elapsed);
  }, [elapsedNow, lastResponseTimeMs, locked, noteStartedAt]);

  const averageResponseMs = correctNotesSolved > 0 ? totalCorrectResponseTimeMs / correctNotesSolved : 0;
  const roundEnded = !gameRunning && completedSets >= numberOfSets;
  const sortedLeaderboard = useMemo(
    () =>
      [...leaderboardEntries].sort((left, right) => {
        if (left.averageTimePerNoteMs === right.averageTimePerNoteMs) {
          return left.createdAtMs - right.createdAtMs;
        }
        return left.averageTimePerNoteMs - right.averageTimePerNoteMs;
      }),
    [leaderboardEntries]
  );

  const handleLeaderboardSubmit = useCallback(() => {
    const trimmedName = leaderboardName.trim();
    if (!trimmedName || !roundEnded || hasSubmittedRound) {
      return;
    }

    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      totalSets: completedSets,
      totalCorrect: correct,
      averageTimePerNoteMs: averageResponseMs,
      createdAtMs: Date.now()
    };

    setLeaderboardEntries((value) => [...value, entry]);
    setHasSubmittedRound(true);
  }, [averageResponseMs, completedSets, correct, hasSubmittedRound, leaderboardName, roundEnded]);

  return (
    <main className="app-shell">
      <h1>Piano Sight-Reading Trainer</h1>
      <ScoreTracker
        streak={streak}
        correct={correct}
        incorrect={incorrect}
        currentNoteElapsedMs={currentNoteElapsedMs}
        averageResponseMs={averageResponseMs}
      />

      <div className="session-row">
        <button type="button" className="session-btn" onClick={handleStartStop}>
          {gameRunning ? "Stop" : "Start"}
        </button>
        <span>
          Sets: {completedSets}/{numberOfSets}
        </span>
      </div>

      {roundEnded && (
        <section className="leaderboard-submit">
          <h3>Round Complete</h3>
          <p>Submit this score to the leaderboard.</p>
          <div className="leaderboard-submit-row">
            <input
              type="text"
              value={leaderboardName}
              onChange={(event) => setLeaderboardName(event.target.value)}
              placeholder="Enter name"
              maxLength={24}
              disabled={hasSubmittedRound}
            />
            <button type="button" onClick={handleLeaderboardSubmit} disabled={hasSubmittedRound || !leaderboardName.trim()}>
              {hasSubmittedRound ? "Submitted" : "Submit"}
            </button>
          </div>
        </section>
      )}

      <details className="settings-panel" open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
        <summary>Settings {settingsOpen ? "▼" : "▶"}</summary>

        <nav className="mode-row" aria-label="Clef mode">
          <button type="button" onClick={() => onModeChange("treble")} className={mode === "treble" ? "active" : ""} disabled={gameRunning}>
            Treble
          </button>
          <button type="button" onClick={() => onModeChange("bass")} className={mode === "bass" ? "active" : ""} disabled={gameRunning}>
            Bass
          </button>
          <button type="button" onClick={() => onModeChange("mixed")} className={mode === "mixed" ? "active" : ""} disabled={gameRunning}>
            Mixed
          </button>
        </nav>

        <div className="set-size-row" aria-label="Notes per set">
          <span>Notes per set</span>
          <select
            value={notesPerSet}
            onChange={(event) => onNotesPerSetChange(Number(event.target.value))}
            disabled={gameRunning}
          >
            {NOTES_PER_SET_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>

        <div className="set-size-row slider-row" aria-label="Number of sets">
          <span>Number of sets: {numberOfSets}</span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={numberOfSets}
            onChange={(event) => onNumberOfSetsChange(Number(event.target.value))}
            disabled={gameRunning}
          />
        </div>
      </details>

      <section className="trainer-grid">
        <StaffDisplay notes={currentNotes} activeNoteIndex={currentNoteIndex} />
        <AnswerButtons
          disabled={locked || !gameRunning}
          lastGuess={feedback.lastGuess}
          correctLetter={currentTargetNote.letter}
          revealAnswer={feedback.revealAnswer}
          onAnswer={handleAnswer}
        />
      </section>

      <section className="leaderboard-panel" aria-label="Leaderboard">
        <h3>Leaderboard</h3>
        {sortedLeaderboard.length === 0 ? (
          <p className="leaderboard-empty">No scores submitted yet.</p>
        ) : (
          <div className="leaderboard-table">
            <div className="leaderboard-row leaderboard-header">
              <span>Name</span>
              <span>Total sets</span>
              <span>Total correct</span>
              <span>Avg time / note</span>
            </div>
            {sortedLeaderboard.map((entry) => (
              <div key={entry.id} className="leaderboard-row">
                <span>{entry.name}</span>
                <span>{entry.totalSets}</span>
                <span>{entry.totalCorrect}</span>
                <span>{(entry.averageTimePerNoteMs / 1000).toFixed(2)}s</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className={`feedback ${feedbackClass}`}>{feedback.message}</p>
    </main>
  );
}

export default App;
