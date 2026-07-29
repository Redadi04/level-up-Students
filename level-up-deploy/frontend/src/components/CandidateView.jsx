import { useEffect, useState } from "react";
import { api } from "../api.js";
import Ladder from "./Ladder.jsx";

export default function CandidateView() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [passedLevels, setPassedLevels] = useState(new Set());
  const [verdict, setVerdict] = useState(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCompanies().then((cs) => {
      setCompanies(cs);
      if (cs.length > 0) setCompanyId(cs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!companyId) return;
    setLoadingQuestions(true);
    setVerdict(null);
    setAnswer("");

    Promise.all([api.getQuestions(companyId), api.getMyResults(companyId)])
      .then(([qs, myResults]) => {
        qs.sort((a, b) => a.level - b.level);
        setQuestions(qs);

        const passed = new Set(
          myResults
            .filter((r) => String(r.passed).toLowerCase() === "true")
            .map((r) => Number(r.level))
        );
        setPassedLevels(passed);

        // Resume at the first level not yet passed, instead of making the
        // student retake levels they've already cleared.
        const resumeIndex = qs.findIndex((q) => !passed.has(q.level));
        setCurrentIndex(resumeIndex === -1 ? qs.length : resumeIndex);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingQuestions(false));
  }, [companyId]);

  const current = questions[currentIndex];
  const selectedCompany = companies.find((c) => c.id === companyId);

  async function submitAnswer() {
    if (!answer.trim() || !current) return;
    setGrading(true);
    setError("");
    try {
      const result = await api.evaluate({
        question: current.question,
        expected_answer: current.expected_answer,
        candidate_answer: answer.trim(),
        company_id: companyId,
        level: current.level,
      });
      setVerdict(result);
      if (result.passed) {
        setPassedLevels((prev) => new Set(prev).add(current.level));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGrading(false);
    }
  }

  function nextLevel() {
    setVerdict(null);
    setAnswer("");
    setCurrentIndex((i) => i + 1);
  }

  function retry() {
    setVerdict(null);
  }

  if (companies.length === 0) {
    return (
      <div className="stage">
        <div className="empty-state">
          <p className="empty-title">No companies hosting a session yet</p>
          <p className="empty-body">
            Once a company signs up and adds questions, their session will show up here to attempt.
            In the meantime, check the Build Resume tab to get ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="candidate-layout">
      <div className="ladder-rail">
        <div className="ladder-title">Session</div>
        <select
          className="field-input company-select"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>

        {questions.length > 0 && (
          <Ladder questions={questions} currentIndex={currentIndex} passedLevels={passedLevels} />
        )}
      </div>

      <div className="stage">
        {loadingQuestions ? null : questions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No questions yet from {selectedCompany?.company_name}</p>
            <p className="empty-body">This company hasn't posted a Q&amp;A session yet. Check back later.</p>
          </div>
        ) : !current ? (
          <div className="all-clear">
            <p className="all-clear-title">All levels cleared 🎉</p>
            <p className="all-clear-body">
              You've passed every level {selectedCompany?.company_name} currently has posted. Head to
              "Build Resume" to turn this into a resume targeted at them.
            </p>
          </div>
        ) : (
          <>
            <p className="eyebrow">Level {current.level} &middot; {selectedCompany?.company_name}</p>
            <h1 className="question-text">{current.question}</h1>

            <textarea
              className="answer-box"
              rows={6}
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={grading || !!verdict}
            />

            <div className="stage-actions">
              <button className="btn-primary" onClick={submitAnswer} disabled={grading || !!verdict}>
                Submit answer
              </button>
              {grading && <span className="grading-status">Grading with Groq...</span>}
              {error && <span className="grading-status">{error}</span>}
            </div>

            {verdict && (
              <div className="verdict">
                <div className="verdict-row">
                  <span className={`badge ${verdict.passed ? "pass" : "fail"}`}>
                    {verdict.passed ? "Passed" : "Not yet"}
                  </span>
                  <span className="score">{verdict.score ?? 0}/100</span>
                </div>
                <p className="verdict-feedback">{verdict.feedback}</p>
                {verdict.passed ? (
                  <button className="btn-primary" onClick={nextLevel}>
                    Advance to next level &rarr;
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={retry}>
                    Try again
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
