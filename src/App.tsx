import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AnswerButtons } from "./components/AnswerButtons";
import { InputController } from "./components/InputController";
import { ScoreTracker } from "./components/ScoreTracker";
import { StaffContainer } from "./components/StaffContainer";
import { useMidi } from "./providers/midiContext";
import { useSpeedNoteSession } from "./hooks/useSpeedNoteSession";
import { supabase } from "./lib/supabaseClient";
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

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("game");
  const { status: midiStatus, errorMessage: midiErrorMessage, subscribeNoteOn } = useMidi();
  const { state, actions } = useSpeedNoteSession();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardApiError, setLeaderboardApiError] = useState<string | null>(null);
  const [lastAutoSubmittedSignature, setLastAutoSubmittedSignature] = useState<string | null>(null);

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
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      const existingUsername = data.session?.user?.user_metadata?.username;
      setAuthUsername(typeof existingUsername === "string" ? existingUsername : "");
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthError(null);
      const existingUsername = nextSession?.user?.user_metadata?.username;
      setAuthUsername(typeof existingUsername === "string" ? existingUsername : "");
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

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
        setLeaderboardEntries(Array.isArray(data.entries) ? data.entries : []);
        setLeaderboardApiError(null);
      } catch {
        if (!cancelled) {
          setLeaderboardApiError("Leaderboard service unavailable.");
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
    if (!session?.access_token || !user || !state.roundEnded || !state.leaderboardMode || !state.leaderboardEligible) {
      return;
    }
    if (state.averageResponseMs <= 0 || state.totalNotesAnswered <= 0) {
      return;
    }
    const signature = `${user.id}:${state.completedSets}:${state.correctNotesAnswered}:${state.totalNotesAnswered}:${state.averageResponseMs}`;
    if (signature === lastAutoSubmittedSignature) {
      return;
    }

    void (async () => {
      try {
        const username = (user.user_metadata?.username as string | undefined)?.trim();
        if (!username) {
          setLeaderboardApiError("Set a leaderboard username in your account section.");
          return;
        }
        const response = await fetch("/api/leaderboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            username,
            averageTimePerNoteMs: state.averageResponseMs,
            accuracy: state.accuracyPercent / 100
          })
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          setLeaderboardApiError(errorPayload?.error ?? "Failed to submit leaderboard run.");
          return;
        }

        const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
        setLeaderboardEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setLastAutoSubmittedSignature(signature);
        setLeaderboardApiError(null);
      } catch {
        setLeaderboardApiError("Failed to submit leaderboard run.");
      }
    })();
  }, [
    lastAutoSubmittedSignature,
    session?.access_token,
    state.accuracyPercent,
    state.averageResponseMs,
    state.completedSets,
    state.correctNotesAnswered,
    state.leaderboardEligible,
    state.leaderboardMode,
    state.roundEnded,
    state.totalNotesAnswered,
    user
  ]);

  const handleAuthSignup = useCallback(async () => {
    const trimmedUsername = authUsername.trim();
    if (!trimmedUsername) {
      setAuthError("Please choose a username.");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: {
        data: {
          username: trimmedUsername
        }
      }
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthPassword("");
  }, [authEmail, authPassword, authUsername]);

  const handleAuthLogin = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthPassword("");
  }, [authEmail, authPassword]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setLastAutoSubmittedSignature(null);
  }, []);

  const handleUsernameSave = useCallback(async () => {
    const trimmedUsername = authUsername.trim();
    if (!trimmedUsername) {
      setAuthError("Username cannot be empty.");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({
      data: {
        username: trimmedUsername
      }
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthUsername(trimmedUsername);
  }, [authUsername]);

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
        <section className="leaderboard-submit">
          <h3>Account</h3>
          {session && user ? (
            <div className="auth-panel">
              <p>Logged in as {user.email}</p>
              <div className="leaderboard-submit-row">
                <input
                  type="text"
                  placeholder="Leaderboard username"
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  autoComplete="nickname"
                />
                <button type="button" onClick={() => void handleUsernameSave()} disabled={authBusy || !authUsername.trim()}>
                  Save alias
                </button>
              </div>
              <button type="button" className="session-btn" onClick={() => void handleLogout()}>
                Log out
              </button>
            </div>
          ) : (
            <div className="auth-panel">
              <p>Sign in or create an account to auto-submit leaderboard runs.</p>
              <div className="leaderboard-submit-row">
                <input
                  type="text"
                  placeholder="Username (public alias)"
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  autoComplete="nickname"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="leaderboard-submit-row">
                <button type="button" onClick={() => void handleAuthLogin()} disabled={authBusy || !authEmail || !authPassword}>
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => void handleAuthSignup()}
                  disabled={authBusy || !authUsername.trim() || !authEmail || !authPassword}
                >
                  Sign up
                </button>
              </div>
              {authError && <p className="leaderboard-error">{authError}</p>}
            </div>
          )}
          {state.roundEnded && state.leaderboardMode && (
            <p>
              {session
                ? "Run complete. Your leaderboard result is submitted automatically."
                : "Run complete. Log in to auto-submit your result."}
            </p>
          )}
        </section>

        <section className="leaderboard-panel" aria-label="Leaderboard">
          <div className="leaderboard-header-row">
            <h3>Leaderboard</h3>
          </div>
          {leaderboardApiError && <p className="leaderboard-error">{leaderboardApiError}</p>}
          {sortedLeaderboard.length === 0 ? (
            <p className="leaderboard-empty">No scores submitted yet.</p>
          ) : (
            <div className="leaderboard-table">
              <div className="leaderboard-row leaderboard-header">
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
    </main>
  );
}

export default App;
