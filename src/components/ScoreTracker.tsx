type ScoreTrackerProps = {
  streak: number;
  correct: number;
  incorrect: number;
  currentNoteElapsedMs: number;
  averageResponseMs: number;
};

function formatMsAsSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ScoreTracker({
  streak,
  correct,
  incorrect,
  currentNoteElapsedMs,
  averageResponseMs
}: ScoreTrackerProps) {
  const total = correct + incorrect;

  return (
    <header className="score-panel">
      <div className="score-card">
        <span>Streak</span>
        <strong>{streak}</strong>
      </div>
      <div className="score-card">
        <span>Correct</span>
        <strong>{correct}</strong>
      </div>
      <div className="score-card">
        <span>Incorrect</span>
        <strong>{incorrect}</strong>
      </div>
      <div className="score-card">
        <span>Total</span>
        <strong>{total}</strong>
      </div>
      <div className="score-card">
        <span>Current timer</span>
        <strong>{formatMsAsSeconds(currentNoteElapsedMs)}</strong>
      </div>
      <div className="score-card">
        <span>Average time per note</span>
        <strong>{formatMsAsSeconds(averageResponseMs)}</strong>
      </div>
    </header>
  );
}
