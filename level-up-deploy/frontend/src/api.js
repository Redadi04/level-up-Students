const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}, auth = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // ---- auth ----
  signup: (payload) => request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/me", {}, true),

  // ---- companies ----
  getCompanies: () => request("/api/companies"),
  updateMyCompany: (payload) =>
    request("/api/companies/me", { method: "PUT", body: JSON.stringify(payload) }, true),

  // ---- questions ----
  getQuestions: (companyId) => request(`/api/questions?company_id=${encodeURIComponent(companyId)}`),
  getMyQuestions: () => request("/api/questions/mine", {}, true),
  addQuestion: (level, question, expected_answer) =>
    request("/api/questions", { method: "POST", body: JSON.stringify({ level, question, expected_answer }) }, true),
  setQuestionActive: (id, active) =>
    request(`/api/questions/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }, true),

  // ---- evaluate ----
  evaluate: ({ question, expected_answer, candidate_answer, company_id, level }) =>
    request(
      "/api/evaluate",
      { method: "POST", body: JSON.stringify({ question, expected_answer, candidate_answer, company_id, level }) },
      true
    ),

  // ---- results (company side) ----
  getResults: () => request("/api/results", {}, true),
  getMyResults: (companyId) => request(`/api/my-results?company_id=${encodeURIComponent(companyId)}`, {}, true),

  // ---- skill guide + resume ----
  getSkillGuide: (company_id) =>
    request("/api/skill-guide", { method: "POST", body: JSON.stringify({ company_id }) }, true),
  buildResume: (payload) =>
    request("/api/resume", { method: "POST", body: JSON.stringify(payload) }, true),
};
