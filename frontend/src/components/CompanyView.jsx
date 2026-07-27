import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function CompanyView() {
  const { user, refreshUser } = useAuth();

  // profile
  const [recommendedSkills, setRecommendedSkills] = useState(user?.recommended_skills || "");
  const [profileStatus, setProfileStatus] = useState("");

  // questions
  const [level, setLevel] = useState(1);
  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [questions, setQuestions] = useState([]);

  // results
  const [results, setResults] = useState([]);

  function loadBank() {
    if (!user) return;
    api.getMyQuestions().then((qs) => {
      qs.sort((a, b) => a.level - b.level);
      setQuestions(qs);
    }).catch(() => {});
  }

  function loadResults() {
    api.getResults().then(setResults).catch(() => {});
  }

  useEffect(() => {
    loadBank();
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileStatus("Saving...");
    try {
      await api.updateMyCompany({ recommended_skills: recommendedSkills });
      await refreshUser();
      setProfileStatus("Saved.");
    } catch (err) {
      setProfileStatus(err.message);
    } finally {
      setTimeout(() => setProfileStatus(""), 2000);
    }
  }

  async function toggleActive(q) {
    try {
      await api.setQuestionActive(q.id, !q.active);
      loadBank();
    } catch (err) {
      setStatus(err.message);
      setTimeout(() => setStatus(""), 2000);
    }
  }

  async function handleAddQuestion(e) {
    e.preventDefault();
    if (!level || !question.trim() || !expectedAnswer.trim()) return;

    setStatus("Saving...");
    try {
      await api.addQuestion(Number(level), question.trim(), expectedAnswer.trim());
      setStatus("Added.");
      setQuestion("");
      setExpectedAnswer("");
      setLevel(1);
      loadBank();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setTimeout(() => setStatus(""), 2000);
    }
  }

  return (
    <div className="company-grid">
      <form className="panel" onSubmit={saveProfile}>
        <h2 className="panel-title">Your skill profile</h2>
        <p className="empty-body" style={{ marginBottom: 16 }}>
          Shown to students browsing companies to prepare for — this drives their skill guide and resume.
        </p>
        <label className="field-label" htmlFor="recommended-skills">Skills you're looking for</label>
        <textarea
          id="recommended-skills"
          className="field-input"
          rows={4}
          placeholder="e.g. Python, transformer architectures, prompt engineering, evaluation metrics"
          value={recommendedSkills}
          onChange={(e) => setRecommendedSkills(e.target.value)}
        />
        <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>Save profile</button>
        <span className="grading-status">{profileStatus}</span>
      </form>

      <form className="panel" onSubmit={handleAddQuestion}>
        <h2 className="panel-title">Host a Q&amp;A session</h2>

        <label className="field-label" htmlFor="level-input">Level</label>
        <input
          id="level-input"
          className="field-input"
          type="number"
          min="1"
          step="1"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="question-input">Question</label>
        <textarea
          id="question-input"
          className="field-input"
          rows={2}
          placeholder="e.g. What is a token in a language model?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="expected-input">Expected answer</label>
        <textarea
          id="expected-input"
          className="field-input"
          rows={3}
          placeholder="The ideal answer the AI grader will compare against"
          value={expectedAnswer}
          onChange={(e) => setExpectedAnswer(e.target.value)}
          required
        />

        <button type="submit" className="btn-primary">Add question</button>
        <span className="grading-status">{status}</span>
      </form>

      <div className="panel">
        <h2 className="panel-title">Your question bank</h2>
        <ul className="question-bank">
          {questions.length === 0 && <li className="qb-empty">No questions added yet.</li>}
          {questions.map((q) => (
            <li key={q.id} className={`qb-item ${!q.active ? "qb-inactive" : ""}`}>
              <div className="qb-level-row">
                <div className="qb-level">
                  Level {q.level}
                  {!q.active && <span className="qb-inactive-tag"> · inactive</span>}
                </div>
                <button
                  type="button"
                  className="btn-ghost qb-toggle-btn"
                  onClick={() => toggleActive(q)}
                >
                  {q.active ? "Remove from active" : "Reactivate"}
                </button>
              </div>
              <div className="qb-question">{q.question}</div>
              <div className="qb-expected">{q.expected_answer}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 className="panel-title">Candidate results</h2>
        <ul className="question-bank">
          {results.length === 0 && <li className="qb-empty">No attempts logged yet.</li>}
          {results.map((r) => (
            <li key={r.id} className="qb-item">
              <div className="qb-level">
                {r.candidate_name} &middot; Level {r.level} &middot;{" "}
                <span style={{ color: String(r.passed).toLowerCase() === "true" ? "var(--success)" : "var(--danger)" }}>
                  {String(r.passed).toLowerCase() === "true" ? "Passed" : "Failed"} ({r.score}/100)
                </span>
              </div>
              <div className="qb-question">{r.question}</div>
              <div className="qb-expected">{r.feedback}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
