import { useState } from "react";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [role, setRole] = useState("student"); // "student" | "company"

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [recommendedSkills, setRecommendedSkills] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup({
          role,
          name,
          email,
          password,
          company_name: role === "company" ? companyName : undefined,
          recommended_skills: role === "company" ? recommendedSkills : undefined,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="panel auth-panel" onSubmit={handleSubmit}>
        <div className="brand auth-brand">
          <span className="brand-mark">&#9650;</span>
          <span className="brand-name">Level-Up Interview</span>
        </div>

        <div className="tabs auth-mode-tabs">
          <button type="button" className={`tab-btn ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
            Log in
          </button>
          <button type="button" className={`tab-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>
            Sign up
          </button>
        </div>

        {mode === "signup" && (
          <>
            <label className="field-label">I am a...</label>
            <div className="tabs auth-role-tabs">
              <button type="button" className={`tab-btn ${role === "student" ? "active" : ""}`} onClick={() => setRole("student")}>
                Student
              </button>
              <button type="button" className={`tab-btn ${role === "company" ? "active" : ""}`} onClick={() => setRole("company")}>
                Company
              </button>
            </div>

            <label className="field-label" htmlFor="name">{role === "company" ? "Your name" : "Full name"}</label>
            <input id="name" className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

            {role === "company" && (
              <>
                <label className="field-label" htmlFor="company-name">Company name</label>
                <input
                  id="company-name"
                  className="field-input"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />

                <label className="field-label" htmlFor="recommended-skills">
                  Skills you're looking for (shown to students, guides their prep)
                </label>
                <textarea
                  id="recommended-skills"
                  className="field-input"
                  rows={3}
                  placeholder="e.g. Python, transformer architectures, prompt engineering, evaluation metrics"
                  value={recommendedSkills}
                  onChange={(e) => setRecommendedSkills(e.target.value)}
                />
              </>
            )}
          </>
        )}

        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label className="field-label" htmlFor="password">Password</label>
        <input
          id="password"
          className="field-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-primary auth-submit" disabled={busy}>
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
