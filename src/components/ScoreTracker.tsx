type ScoreTrackerProps = {
  correct: number;
  incorrect: number;
};

export function ScoreTracker({ correct, incorrect }: ScoreTrackerProps) {
  const metrics = [
    { label: "Correct", value: correct, tone: "success" },
    { label: "Incorrect", value: incorrect, tone: "danger" }
  ] as const;

  return (
    <header className="score-panel">
      {metrics.map((metric) => (
        <div key={metric.label} className={`score-card ${metric.tone}`.trim()}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </header>
  );
}
