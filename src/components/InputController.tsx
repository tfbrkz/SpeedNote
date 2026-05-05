import type { ClefMode, DifficultyTier, PracticeMode } from "../lib/noteGenerator";

const NOTES_PER_SET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const DIFFICULTY_OPTIONS: ReadonlyArray<{ value: DifficultyTier; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" }
];
const PRACTICE_MODE_OPTIONS: ReadonlyArray<{ value: PracticeMode; label: string }> = [
  { value: "classic", label: "Classic" },
  { value: "sprint", label: "Sprint" },
  { value: "survival", label: "Survival" }
];

type InputControllerProps = {
  gameRunning: boolean;
  leaderboardMode: boolean;
  mode: ClefMode;
  difficulty: DifficultyTier;
  practiceMode: PracticeMode;
  notesPerSet: number;
  numberOfSets: number;
  midiStatus: string;
  rhythmModeEnabled: boolean;
  rhythmMsPerNote: number;
  showSolvedNoteLetters: boolean;
  onModeChange: (mode: ClefMode) => void;
  onDifficultyChange: (difficulty: DifficultyTier) => void;
  onPracticeModeChange: (practiceMode: PracticeMode) => void;
  onRhythmModeChange: (enabled: boolean) => void;
  onRhythmSpeedChange: (msPerNote: number) => void;
  onNotesPerSetChange: (count: number) => void;
  onNumberOfSetsChange: (count: number) => void;
  onLeaderboardModeChange: (enabled: boolean) => void;
  onShowSolvedNoteLettersChange: (enabled: boolean) => void;
};

export function InputController({
  gameRunning,
  leaderboardMode,
  mode,
  difficulty,
  practiceMode,
  notesPerSet,
  numberOfSets,
  midiStatus,
  rhythmModeEnabled,
  rhythmMsPerNote,
  showSolvedNoteLetters,
  onModeChange,
  onDifficultyChange,
  onPracticeModeChange,
  onRhythmModeChange,
  onRhythmSpeedChange,
  onNotesPerSetChange,
  onNumberOfSetsChange,
  onLeaderboardModeChange,
  onShowSolvedNoteLettersChange
}: InputControllerProps) {
  const controlsLocked = gameRunning || leaderboardMode;

  return (
    <section className="settings-panel" aria-label="Training settings">
      <h3>Training Settings</h3>

      <div className="settings-group" aria-label="Leaderboard mode">
        <p className="settings-label">Leaderboard mode</p>
        <p className="settings-description">Locks Treble + Beginner + Classic + 4 notes/set + 5 sets.</p>
        <nav className="mode-row">
          <button
            type="button"
            onClick={() => onLeaderboardModeChange(!leaderboardMode)}
            className={leaderboardMode ? "active" : ""}
            disabled={gameRunning}
          >
            {leaderboardMode ? "Enabled" : "Disabled"}
          </button>
        </nav>
      </div>

      <div className="settings-group" aria-label="Solved note letters">
        <p className="settings-label">Solved note letters</p>
        <p className="settings-description">Show the solved letter above notes after correct answers.</p>
        <nav className="mode-row">
          <button
            type="button"
            onClick={() => onShowSolvedNoteLettersChange(!showSolvedNoteLetters)}
            className={showSolvedNoteLetters ? "active" : ""}
            disabled={gameRunning}
          >
            {showSolvedNoteLetters ? "Enabled" : "Disabled"}
          </button>
        </nav>
      </div>

        <div className="settings-group" aria-label="Clef mode">
          <p className="settings-label">Clef mode</p>
          <p className="settings-description">Choose which staff to train on.</p>
          <nav className="mode-row">
            <button type="button" onClick={() => onModeChange("treble")} className={mode === "treble" ? "active" : ""} disabled={controlsLocked}>
              Treble
            </button>
            <button type="button" onClick={() => onModeChange("bass")} className={mode === "bass" ? "active" : ""} disabled={controlsLocked}>
              Bass
            </button>
            <button type="button" onClick={() => onModeChange("mixed")} className={mode === "mixed" ? "active" : ""} disabled={controlsLocked}>
              Mixed
            </button>
          </nav>
        </div>

        <div className="settings-group" aria-label="Difficulty tier">
          <p className="settings-label">Difficulty</p>
          <p className="settings-description">Higher difficulty increases note range and complexity.</p>
          <nav className="mode-row">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDifficultyChange(option.value)}
                className={difficulty === option.value ? "active" : ""}
                disabled={controlsLocked}
              >
                {option.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-group" aria-label="Practice mode">
          <p className="settings-label">Practice mode</p>
          <p className="settings-description">Classic rounds, timed sprint, or limited mistakes survival.</p>
          <nav className="mode-row">
            {PRACTICE_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPracticeModeChange(option.value)}
                className={practiceMode === option.value ? "active" : ""}
                disabled={controlsLocked}
              >
                {option.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-group" aria-label="Rhythm timing mode">
          <p className="settings-label">Rhythm timing mode</p>
          <p className="settings-description">Use the moving scan bar and answer while it overlaps each note.</p>
          <nav className="mode-row">
            <button
              type="button"
              onClick={() => onRhythmModeChange(!rhythmModeEnabled)}
              className={rhythmModeEnabled ? "active" : ""}
              disabled={controlsLocked}
            >
              {rhythmModeEnabled ? "Enabled" : "Disabled"}
            </button>
          </nav>
        </div>

        <div className="settings-group slider-row" aria-label="Rhythm speed">
          <p className="settings-label">Rhythm speed: {(rhythmMsPerNote / 1000).toFixed(1)}s per note</p>
          <p className="settings-description">Lower values move faster. Higher values give more reaction time.</p>
          <input
            type="range"
            min={600}
            max={4000}
            step={100}
            value={rhythmMsPerNote}
            onChange={(event) => onRhythmSpeedChange(Number(event.target.value))}
            disabled={controlsLocked}
          />
        </div>

        <div className="settings-group" aria-label="Notes per set">
          <p className="settings-label">Notes per set</p>
          <p className="settings-description">How many notes must be solved before a set completes.</p>
          <nav className="mode-row notes-per-set-row">
            {NOTES_PER_SET_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onNotesPerSetChange(count)}
                className={notesPerSet === count ? "active" : ""}
                disabled={controlsLocked}
              >
                {count}
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-group slider-row" aria-label="Number of sets">
          <p className="settings-label">Number of sets: {numberOfSets}</p>
          <p className="settings-description">Session length. Increase for longer focused training.</p>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={numberOfSets}
            onChange={(event) => onNumberOfSetsChange(Number(event.target.value))}
            disabled={controlsLocked}
          />
        </div>

      <p className="midi-status">MIDI: {midiStatus}</p>
    </section>
  );
}
