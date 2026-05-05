type StatDashboardProps = {
  gameRunning: boolean;
  completedSets: number;
  numberOfSets: number;
  onStartStop: () => void;
};

export function StatDashboard({
  gameRunning,
  completedSets,
  numberOfSets,
  onStartStop
}: StatDashboardProps) {
  return (
    <header className="app-topbar">
      <div className="session-row">
        <button type="button" className="session-btn" onClick={onStartStop}>
          {gameRunning ? "Stop Session" : "Start Session"}
        </button>
        <span>
          Sets: {completedSets}/{numberOfSets}
        </span>
      </div>
    </header>
  );
}
