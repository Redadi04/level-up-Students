import { useState } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import Login from "./components/Login.jsx";
import CandidateView from "./components/CandidateView.jsx";
import CompanyView from "./components/CompanyView.jsx";
import GrowthView from "./components/GrowthView.jsx";

function Shell() {
  const { user, loading, logout } = useAuth();
  // Students land on resume-building by default; interviewing is a secondary tab.
  const [tab, setTab] = useState("growth");

  if (loading) return null;
  if (!user) return <Login />;

  const isCompany = user.role === "company";

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">&#9650;</span>
          <span className="brand-name">Level-Up Interview</span>
        </div>

        {!isCompany && (
          <nav className="tabs" role="tablist">
            <button className={`tab-btn ${tab === "growth" ? "active" : ""}`} onClick={() => setTab("growth")}>
              Build Resume
            </button>
            <button className={`tab-btn ${tab === "interview" ? "active" : ""}`} onClick={() => setTab("interview")}>
              Take Interview
            </button>
          </nav>
        )}

        <div className="user-chip">
          <span>{user.name}{isCompany ? ` · ${user.company_name}` : ""}</span>
          <button className="btn-ghost logout-btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <main>
        {isCompany && <CompanyView />}
        {!isCompany && tab === "growth" && <GrowthView />}
        {!isCompany && tab === "interview" && <CandidateView />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
