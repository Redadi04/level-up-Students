export default function Ladder({ questions, currentIndex, passedLevels }) {
  return (
    <aside className="ladder-rail" aria-label="Level progress">
      <div className="ladder-title">Ladder</div>
      <ol className="ladder-list">
        {questions.map((q, i) => {
          const passed = passedLevels.has(q.level);
          const current = !passed && i === currentIndex;
          return (
            <li key={q.level} className={`rung ${passed ? "passed" : ""} ${current ? "current" : ""}`}>
              <span className="rung-dot">{passed ? "✓" : q.level}</span>
              <span className="rung-label">Level {q.level}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
