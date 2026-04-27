import { useCallback, useEffect, useMemo, useState } from "react";
import { AnswerButtons } from "./components/AnswerButtons";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffDisplay } from "./components/StaffDisplay";
import { generateNote, type ClefMode, type GeneratedNote, type NoteLetter } from "./lib/noteGenerator";
import { playPianoNote } from "./lib/pianoPlayer";

type FeedbackState = {
  revealAnswer: boolean;
  lastGuess: NoteLetter | null;
  message: string;
};

const NOTES_PER_SET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function generateNoteSet(mode: ClefMode, notesPerSet: number): GeneratedNote[] {
  const firstNote = generateNote(mode);
  const notes: GeneratedNote[] = [firstNote];

  for (let index = 1; index < notesPerSet; index += 1) {
    notes.push(generateNote(firstNote.clef));
  }

  return notes;
}

function App() {
  const [mode, setMode] = useState<ClefMode>("mixed");
  const [notesPerSet, setNotesPerSet] = useState<number>(1);
  const [currentNotes, setCurrentNotes] = useState<GeneratedNote[]>(() => generateNoteSet("mixed", 1));
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
  const [feedback, setFeedback] = useState<FeedbackState>({
    revealAnswer: false,
    lastGuess: null,
    message: "Pick the letter name for this note."
  });

  const nextNoteSet = useCallback((currentMode: ClefMode, count: number) => {
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
  }, []);

  const onModeChange = useCallback(
    (nextMode: ClefMode) => {
      setMode(nextMode);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setCurrentNotes(generateNoteSet(nextMode, notesPerSet));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Mode updated. Identify the notes in order."
      });
    },
    [notesPerSet]
  );

  const onNotesPerSetChange = useCallback(
    (count: number) => {
      setNotesPerSet(count);
      setStreak(0);
      setCorrect(0);
      setIncorrect(0);
      setTotalCorrectResponseTimeMs(0);
      setCorrectNotesSolved(0);
      setPendingFailedTimeMs(0);
      setLocked(false);
      setCurrentNotes(generateNoteSet(mode, count));
      setCurrentNoteIndex(0);
      setNoteStartedAt(Date.now());
      setElapsedNow(Date.now());
      setLastResponseTimeMs(0);
      setFeedback({
        revealAnswer: false,
        lastGuess: null,
        message: "Set size updated. Answer each note in order."
      });
    },
    [mode]
  );

  const handleAnswer = useCallback(
    (letter: NoteLetter) => {
      if (locked) {
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

        window.setTimeout(() => {
          nextNoteSet(mode, notesPerSet);
        }, 1000);
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

      window.setTimeout(() => {
        nextNoteSet(mode, notesPerSet);
      }, 1000);
    },
    [currentNoteIndex, currentNotes, locked, mode, nextNoteSet, noteStartedAt, notesPerSet, pendingFailedTimeMs]
  );

  useEffect(() => {
    if (locked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [locked]);

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

      <nav className="mode-row" aria-label="Clef mode">
        <button type="button" onClick={() => onModeChange("treble")} className={mode === "treble" ? "active" : ""}>
          Treble
        </button>
        <button type="button" onClick={() => onModeChange("bass")} className={mode === "bass" ? "active" : ""}>
          Bass
        </button>
        <button type="button" onClick={() => onModeChange("mixed")} className={mode === "mixed" ? "active" : ""}>
          Mixed
        </button>
      </nav>

      <div className="set-size-row" aria-label="Notes per set">
        <span>Notes per set</span>
        <select
          value={notesPerSet}
          onChange={(event) => onNotesPerSetChange(Number(event.target.value))}
          disabled={locked}
        >
          {NOTES_PER_SET_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <section className="trainer-grid">
        <StaffDisplay notes={currentNotes} activeNoteIndex={currentNoteIndex} />
        <AnswerButtons
          disabled={locked}
          lastGuess={feedback.lastGuess}
          correctLetter={currentTargetNote.letter}
          revealAnswer={feedback.revealAnswer}
          onAnswer={handleAnswer}
        />
      </section>

      <p className={`feedback ${feedbackClass}`}>{feedback.message}</p>
    </main>
  );
}

export default App;
