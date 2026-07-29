import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function GrowthView() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");

  const [guide, setGuide] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState("");

  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [projects, setProjects] = useState("");
  const [extraSkills, setExtraSkills] = useState("");
  const [resume, setResume] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState("");

  useEffect(() => {
    api.getCompanies().then((cs) => {
      setCompanies(cs);
      if (cs.length > 0) setCompanyId(cs[0].id);
    });
  }, []);

  const selectedCompany = companies.find((c) => c.id === companyId);

  async function generateGuide() {
    if (!companyId) return;
    setGuideLoading(true);
    setGuideError("");
    setGuide("");
    try {
      const result = await api.getSkillGuide(companyId);
      setGuide(result.guide);
    } catch (e) {
      setGuideError(e.message);
    } finally {
      setGuideLoading(false);
    }
  }

  async function generateResume(e) {
    e.preventDefault();
    if (!companyId) return;
    setResumeLoading(true);
    setResumeError("");
    setResume("");
    try {
      const result = await api.buildResume({
        company_id: companyId,
        education,
        experience,
        projects,
        extra_skills: extraSkills,
      });
      setResume(result.resume);
    } catch (e) {
      setResumeError(e.message);
    } finally {
      setResumeLoading(false);
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (companies.length === 0) {
    return (
      <div className="stage">
        <div className="empty-state">
          <p className="empty-title">No companies yet</p>
          <p className="empty-body">Once a company signs up and posts a profile, you'll be able to target your prep at them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="growth-grid">
      <div className="panel">
        <h2 className="panel-title">Target company</h2>
        <label className="field-label" htmlFor="company-select">Which company are you preparing for?</label>
        <select
          id="company-select"
          className="field-input"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setGuide("");
            setResume("");
          }}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>

        {selectedCompany?.recommended_skills && (
          <div className="skills-callout">
            <div className="qb-level">Skills {selectedCompany.company_name} wants</div>
            <p className="qb-expected">{selectedCompany.recommended_skills}</p>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Skill guide</h2>
        <p className="empty-body" style={{ marginBottom: 16 }}>
          Compares what you've shown in {selectedCompany?.company_name || "this company"}'s interview (if you've
          taken it) against the skills they want, and tells you what to study next.
        </p>
        <button className="btn-primary" onClick={generateGuide} disabled={guideLoading}>
          {guideLoading ? "Generating..." : "Generate skill guide"}
        </button>
        {guideError && <p className="auth-error">{guideError}</p>}
        {guide && (
          <div className="verdict growth-output">
            <p className="verdict-feedback growth-text">{guide}</p>
            <button className="btn-ghost" onClick={() => downloadText(`skill_guide_${selectedCompany?.company_name}.txt`, guide)}>
              Download .txt
            </button>
          </div>
        )}
      </div>

      <div className="panel growth-span">
        <h2 className="panel-title">Resume builder</h2>
        <form onSubmit={generateResume}>
          <label className="field-label" htmlFor="education">Education</label>
          <input id="education" className="field-input" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Degree, school, year" />

          <label className="field-label" htmlFor="experience">Experience</label>
          <textarea id="experience" className="field-input" rows={2} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Work / internship experience, or leave blank" />

          <label className="field-label" htmlFor="projects">Projects</label>
          <textarea id="projects" className="field-input" rows={2} value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="Notable projects, or leave blank" />

          <label className="field-label" htmlFor="extra-skills">Other skills</label>
          <input id="extra-skills" className="field-input" value={extraSkills} onChange={(e) => setExtraSkills(e.target.value)} placeholder="Comma separated, or leave blank" />

          <button type="submit" className="btn-primary" disabled={resumeLoading} style={{ marginTop: 20 }}>
            {resumeLoading ? "Drafting..." : `Build resume for ${selectedCompany?.company_name || "this company"}`}
          </button>
        </form>
        {resumeError && <p className="auth-error">{resumeError}</p>}
        {resume && (
          <div className="verdict growth-output">
            <p className="verdict-feedback growth-text">{resume}</p>
            <button className="btn-ghost" onClick={() => downloadText(`resume_${selectedCompany?.company_name}.txt`, resume)}>
              Download .txt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
