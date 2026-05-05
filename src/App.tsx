import { useCallback, useEffect, useMemo, useState } from "react";
import { AnswerButtons } from "./components/AnswerButtons";
import { InputController } from "./components/InputController";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffContainer } from "./components/StaffContainer";
import { useMidi } from "./providers/midiContext";
import { useSpeedNoteSession } from "./hooks/useSpeedNoteSession";
import { type NoteLetter } from "./lib/noteGenerator";

const LEADERBOARD_MAX_ENTRIES = 100;
const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const ADSENSE_LEFT_SLOT_ID = import.meta.env.VITE_ADSENSE_LEFT_SLOT_ID as string | undefined;
const ADSENSE_RIGHT_SLOT_ID = import.meta.env.VITE_ADSENSE_RIGHT_SLOT_ID as string | undefined;

type AdRailProps = {
  slotId?: string;
  label: string;
};

function AdRail({ slotId, label }: AdRailProps) {
  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId) {
      return;
    }

    try {
      const ads = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ?? [];
      ads.push({});
      (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = ads;
    } catch {
      // Ad blockers and script-loading failures are non-fatal.
    }
  }, [slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) {
    return (
      <aside className="ad-rail ad-placeholder" aria-label={`${label} ad space`}>
        <span>{label} ad space</span>
      </aside>
    );
  }

  return (
    <aside className="ad-rail" aria-label={`${label} advertisement`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "160px", height: "600px" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="false"
      />
    </aside>
  );
}

type LeaderboardEntry = {
  user_id: string;
  username: string;
  average_time_per_note_ms: number;
  accuracy: number;
  updated_at: string;
};

type AppTab = "game" | "settings";
const IS_LOCAL_DEV = import.meta.env.DEV;

function buildDummyLeaderboardEntries(): LeaderboardEntry[] {
  const now = Date.now();
  const rows = [
    { username: "Aria", average_time_per_note_ms: 980, accuracy: 0.98 },
    { username: "Max", average_time_per_note_ms: 1120, accuracy: 0.95 },
    { username: "Noah", average_time_per_note_ms: 1240, accuracy: 0.92 },
    { username: "Mia", average_time_per_note_ms: 1320, accuracy: 0.9 },
    { username: "Eli", average_time_per_note_ms: 1460, accuracy: 0.86 }
  ];
  return rows.map((entry, index) => ({
    user_id: `local-demo-${index}`,
    username: entry.username,
    average_time_per_note_ms: entry.average_time_per_note_ms,
    accuracy: entry.accuracy,
    updated_at: new Date(now - index * 60000).toISOString()
  }));
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("game");
  const { status: midiStatus, errorMessage: midiErrorMessage, subscribeNoteOn } = useMidi();
  const { state, actions } = useSpeedNoteSession();
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardApiError, setLeaderboardApiError] = useState<string | null>(null);
  const [lastLeaderboardPromptSignature, setLastLeaderboardPromptSignature] = useState<string | null>(null);
  const [showLeaderboardSubmitModal, setShowLeaderboardSubmitModal] = useState(false);
  const [submissionUsername, setSubmissionUsername] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state.gameRunning || state.locked) {
        return;
      }

      const letter = event.key.toUpperCase();
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(letter)) {
        return;
      }

      actions.handleAnswer(letter as NoteLetter);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actions, state.gameRunning, state.locked]);

  useEffect(() => {
    return subscribeNoteOn((noteNumber) => {
      if (!state.gameRunning || state.locked) {
        return;
      }
      actions.handleMidiAnswer(noteNumber);
    });
  }, [actions, state.gameRunning, state.locked, subscribeNoteOn]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard");
        }
        const data = (await response.json()) as { entries?: LeaderboardEntry[] };
        if (cancelled) {
          return;
        }
        const entries = Array.isArray(data.entries) ? data.entries : [];
        setLeaderboardEntries(entries.length > 0 ? entries : IS_LOCAL_DEV ? buildDummyLeaderboardEntries() : []);
        setLeaderboardApiError(null);
      } catch {
        if (!cancelled) {
          if (IS_LOCAL_DEV) {
            setLeaderboardEntries(buildDummyLeaderboardEntries());
            setLeaderboardApiError(null);
          } else {
            setLeaderboardApiError("Leaderboard service unavailable.");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedLeaderboard = useMemo(
    () =>
      [...leaderboardEntries]
        .sort((left, right) => {
          if (left.accuracy === right.accuracy) {
            return left.average_time_per_note_ms - right.average_time_per_note_ms;
          }
          return right.accuracy - left.accuracy;
        })
        .slice(0, LEADERBOARD_MAX_ENTRIES),
    [leaderboardEntries]
  );

  const handleStartStop = useCallback(() => {
    if (state.gameRunning) {
      actions.stop();
      return;
    }
    actions.start();
  }, [actions, state.gameRunning]);

  useEffect(() => {
    if (!state.roundEnded || !state.leaderboardMode || !state.leaderboardEligible) {
      return;
    }
    if (state.averageResponseMs <= 0 || state.totalNotesAnswered <= 0) {
      return;
    }
    const signature = `${state.completedSets}:${state.correctNotesAnswered}:${state.totalNotesAnswered}:${state.averageResponseMs}`;
    if (signature === lastLeaderboardPromptSignature) {
      return;
    }
    setLastLeaderboardPromptSignature(signature);
    setShowLeaderboardSubmitModal(true);
    setSubmissionError(null);
  }, [
    lastLeaderboardPromptSignature,
    state.averageResponseMs,
    state.completedSets,
    state.correctNotesAnswered,
    state.leaderboardEligible,
    state.leaderboardMode,
    state.roundEnded,
    state.totalNotesAnswered
  ]);

  const handleSubmitLeaderboardScore = useCallback(async () => {
    const trimmedUsername = submissionUsername.trim();
    if (!trimmedUsername) {
      setSubmissionError("Please enter a username.");
      return;
    }
    setSubmissionBusy(true);
    setSubmissionError(null);
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: trimmedUsername,
          averageTimePerNoteMs: state.averageResponseMs,
          accuracy: state.accuracyPercent / 100
        })
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSubmissionError(errorPayload?.error ?? "Failed to submit leaderboard run.");
        setSubmissionBusy(false);
        return;
      }
      const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
      setLeaderboardEntries(Array.isArray(payload.entries) ? payload.entries : []);
      setLeaderboardApiError(null);
      setShowLeaderboardSubmitModal(false);
      setSubmissionBusy(false);
    } catch {
      setSubmissionError("Failed to submit leaderboard run.");
      setSubmissionBusy(false);
    }
  }, [state.accuracyPercent, state.averageResponseMs, submissionUsername]);

  const handleSeedLocalLeaderboard = useCallback(() => {
    setLeaderboardEntries(buildDummyLeaderboardEntries());
    setLeaderboardApiError(null);
  }, []);

  return (
    <main className="page-layout">
      <AdRail label="Left" slotId={ADSENSE_LEFT_SLOT_ID} />
      <section className="app-shell">
        <header className="app-main-header">
          <div className="app-heading">
            <p className="app-kicker">SpeedNote</p>
            <h1>Learn to read sheet music at speed</h1>
          </div>
          <nav className="tab-row" aria-label="Main sections">
            <button type="button" className={activeTab === "game" ? "active" : ""} onClick={() => setActiveTab("game")}>
              Game
            </button>
            <button
              type="button"
              className={activeTab === "settings" ? "active" : ""}
              onClick={() => setActiveTab("settings")}
            >
              Instructions & Settings
            </button>
          </nav>
        </header>

        {activeTab === "game" && (
          <>
        <section className="training-stack">
          <StaffContainer
            notes={state.currentNotes}
            activeNoteIndex={state.currentNoteIndex}
            gameRunning={state.gameRunning}
            onStartStop={handleStartStop}
            showSolvedNoteLetters={state.showSolvedNoteLetters}
            feedbackMessage={state.feedback.message}
            feedbackClass={state.feedbackClass}
            showGrandStaff={state.mode === "mixed"}
            noteResults={state.currentNoteResults}
            rhythmModeEnabled={state.rhythmModeEnabled}
            scanProgress={state.scanProgress}
            scanWindowWidth={state.scanWindowWidth}
            countdownValue={state.countdownValue}
          />
          <AnswerButtons
            disabled={state.locked || !state.gameRunning}
            lastGuess={state.feedback.lastGuess}
            correctLetter={state.feedback.expectedLetter}
            revealAnswer={state.feedback.revealAnswer}
            onAnswer={actions.handleAnswer}
          />
          <ScoreTracker correct={state.correct} incorrect={state.incorrect} />
        </section>
        <section className="leaderboard-panel" aria-label="Leaderboard">
          <div className="leaderboard-header-row">
            <h3>Leaderboard</h3>
            {IS_LOCAL_DEV && (
              <button type="button" className="leaderboard-dev-btn" onClick={handleSeedLocalLeaderboard}>
                Load demo rows
              </button>
            )}
          </div>
          {leaderboardApiError && <p className="leaderboard-error">{leaderboardApiError}</p>}
          {sortedLeaderboard.length === 0 ? (
            <p className="leaderboard-empty">No scores submitted yet.</p>
          ) : (
            <div className="leaderboard-table">
              <div className="leaderboard-row leaderboard-header compact">
                <span>Username</span>
                <span>Average time / note</span>
                <span>Accuracy</span>
              </div>
              {sortedLeaderboard.map((entry) => (
                <div key={entry.user_id} className="leaderboard-row compact">
                  <span>{entry.username}</span>
                  <span>{(entry.average_time_per_note_ms / 1000).toFixed(2)}s</span>
                  <span>{(entry.accuracy * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === "settings" && (
          <section className="app-tab-panel">
            <section className="instructions-panel">
              <h3>How to play</h3>
              <p>Start a session, read each note from left to right, and choose the correct letter name.</p>
              <p>In mixed mode, both treble and bass staves are shown. Keyboard answers (`A-G`) and MIDI input are supported.</p>
              <p>Choose a higher difficulty to expand range and accidental complexity. Sprint is timed; Survival ends after mistakes.</p>
            </section>
            <InputController
              gameRunning={state.gameRunning}
              leaderboardMode={state.leaderboardMode}
              mode={state.mode}
              difficulty={state.difficulty}
              practiceMode={state.practiceMode}
              notesPerSet={state.notesPerSet}
              numberOfSets={state.numberOfSets}
              midiStatus={midiErrorMessage ? `error (${midiErrorMessage})` : midiStatus}
              rhythmModeEnabled={state.rhythmModeEnabled}
              rhythmMsPerNote={state.rhythmMsPerNote}
              showSolvedNoteLetters={state.showSolvedNoteLetters}
              onModeChange={actions.onModeChange}
              onDifficultyChange={actions.onDifficultyChange}
              onPracticeModeChange={actions.onPracticeModeChange}
              onRhythmModeChange={actions.onRhythmModeChange}
              onRhythmSpeedChange={actions.onRhythmSpeedChange}
              onNotesPerSetChange={actions.onNotesPerSetChange}
              onNumberOfSetsChange={actions.onNumberOfSetsChange}
              onLeaderboardModeChange={actions.onLeaderboardModeChange}
              onShowSolvedNoteLettersChange={actions.onShowSolvedNoteLettersChange}
            />
          </section>
        )}

      </section>
      <AdRail label="Right" slotId={ADSENSE_RIGHT_SLOT_ID} />
      <footer className="site-footer">Copyright &copy; 2026 SpeedNote Piano</footer>
      {showLeaderboardSubmitModal && (
        <div className="modal-backdrop" role="presentation">
          <section className="leaderboard-modal" role="dialog" aria-modal="true" aria-label="Submit leaderboard score">
            <h3>Submit leaderboard score</h3>
            <p>Correct: {state.correctNotesAnswered}</p>
            <p>Incorrect: {Math.max(0, state.totalNotesAnswered - state.correctNotesAnswered)}</p>
            <p>Average speed per note: {(state.averageResponseMs / 1000).toFixed(2)}s</p>
            <div className="leaderboard-submit-row">
              <input
                type="text"
                placeholder="Pick a username"
                value={submissionUsername}
                onChange={(event) => setSubmissionUsername(event.target.value)}
                autoComplete="nickname"
              />
            </div>
            {submissionError && <p className="leaderboard-error">{submissionError}</p>}
            <div className="leaderboard-submit-row">
              <button type="button" onClick={() => void handleSubmitLeaderboardScore()} disabled={submissionBusy}>
                {submissionBusy ? "Submitting..." : "Submit"}
              </button>
              <button type="button" onClick={() => setShowLeaderboardSubmitModal(false)} disabled={submissionBusy}>
                Skip
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
