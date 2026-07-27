# app.py
# Level-Up Interview — Flask API backend (deploys to Render)
#
# Now includes:
#   - Company + student accounts (signup/login, token-based auth)
#   - Company skill profiles ("recommended skills for this role")
#   - A LangChain + LangGraph grading pipeline (unchanged from before)
#   - A skill guide + resume builder that both take the student's *chosen
#     target company* into account, using that company's recommended skills
#     alongside the student's actual interview performance
#
# Auth: simple signed tokens (itsdangerous), not cookies — this avoids
# cross-site cookie headaches between a Vercel frontend and a Render backend.
# The frontend sends the token back as "Authorization: Bearer <token>".

import os
import csv
import uuid
from datetime import datetime
from functools import wraps
from typing import TypedDict

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

load_dotenv()

app = Flask(__name__)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")
CORS(
    app,
    resources={r"/api/*": {"origins": [FRONTEND_URL, "http://localhost:5173"]}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-in-production")
serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 days

MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
PASS_THRESHOLD = int(os.environ.get("PASS_THRESHOLD", "70"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
USERS_FILE = os.path.join(DATA_DIR, "users.csv")
QUESTIONS_FILE = os.path.join(DATA_DIR, "questions.csv")
RESULTS_FILE = os.path.join(DATA_DIR, "results.csv")

USER_FIELDS = ["id", "role", "name", "email", "password_hash", "company_name", "recommended_skills", "created_at"]
QUESTION_FIELDS = ["id", "company_id", "level", "question", "expected_answer", "active"]
RESULT_FIELDS = [
    "id", "timestamp", "student_id", "candidate_name", "company_id",
    "level", "question", "candidate_answer", "score", "passed", "feedback",
]


# ---------- small CSV helpers (no database needed) ----------

def read_csv_rows(path, fields):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def append_csv_row(path, fields, row):
    os.makedirs(DATA_DIR, exist_ok=True)
    file_exists = os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)


def write_csv_rows(path, fields, rows):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


# ---------- auth helpers ----------

def make_token(user_id):
    return serializer.dumps({"user_id": user_id})


def verify_token(token):
    try:
        data = serializer.loads(token, max_age=TOKEN_MAX_AGE)
        return data.get("user_id")
    except (BadSignature, SignatureExpired):
        return None


def find_user_by_id(user_id):
    for u in read_csv_rows(USERS_FILE, USER_FIELDS):
        if u["id"] == user_id:
            return u
    return None


def find_user_by_email(email):
    for u in read_csv_rows(USERS_FILE, USER_FIELDS):
        if u["email"].lower() == email.lower():
            return u
    return None


def public_user(u):
    return {
        "id": u["id"],
        "role": u["role"],
        "name": u["name"],
        "email": u["email"],
        "company_name": u.get("company_name", ""),
        "recommended_skills": u.get("recommended_skills", ""),
    }


def require_auth(role=None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Missing or invalid Authorization header."}), 401

            token = auth_header.split(" ", 1)[1]
            user_id = verify_token(token)
            if not user_id:
                return jsonify({"error": "Invalid or expired token. Please log in again."}), 401

            user = find_user_by_id(user_id)
            if not user:
                return jsonify({"error": "User not found."}), 401

            if role and user["role"] != role:
                return jsonify({"error": f"This action requires a {role} account."}), 403

            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------- LangChain + LangGraph grading pipeline ----------

class GradeResult(BaseModel):
    score: int = Field(description="Similarity/correctness score from 0 to 100")
    feedback: str = Field(description="1-2 sentences of specific, constructive feedback for the candidate")


class InterviewState(TypedDict):
    question: str
    expected_answer: str
    candidate_answer: str
    score: int
    feedback: str
    passed: bool


SYSTEM_PROMPT = """You are a strict but fair technical interview grader for questions about AI and language models.
You will be given a QUESTION, an EXPECTED ANSWER (the ideal answer the company wants), and a CANDIDATE ANSWER.
Judge whether the candidate answer conveys the same key meaning/concepts as the expected answer, even if worded
completely differently, in more or fewer words, or in a different order. Minor omissions of small detail are OK
if the core idea is correct. Wrong or missing core concepts should score low."""

grade_prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "QUESTION:\n{question}\n\nEXPECTED ANSWER:\n{expected_answer}\n\nCANDIDATE ANSWER:\n{candidate_answer}"),
])

llm = ChatGroq(model=MODEL, temperature=0)
structured_llm = llm.with_structured_output(GradeResult)
grade_chain = grade_prompt | structured_llm


def grade_node(state: InterviewState) -> dict:
    result: GradeResult = grade_chain.invoke({
        "question": state["question"],
        "expected_answer": state["expected_answer"],
        "candidate_answer": state["candidate_answer"],
    })
    return {"score": result.score, "feedback": result.feedback}


def decide_node(state: InterviewState) -> dict:
    return {"passed": state["score"] >= PASS_THRESHOLD}


graph_builder = StateGraph(InterviewState)
graph_builder.add_node("grade", grade_node)
graph_builder.add_node("decide", decide_node)
graph_builder.set_entry_point("grade")
graph_builder.add_edge("grade", "decide")
graph_builder.add_edge("decide", END)
interview_graph = graph_builder.compile()


def run_grading(question, expected_answer, candidate_answer):
    final_state = interview_graph.invoke({
        "question": question,
        "expected_answer": expected_answer,
        "candidate_answer": candidate_answer,
        "score": 0,
        "feedback": "",
        "passed": False,
    })
    return {
        "passed": final_state["passed"],
        "score": final_state["score"],
        "feedback": final_state["feedback"],
    }


# ---------- health check ----------

@app.route("/")
def health():
    return jsonify({"status": "ok", "service": "level-up-interview-api"})


# ---------- auth ----------

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(force=True)
    role = data.get("role")
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    company_name = (data.get("company_name") or "").strip()
    recommended_skills = (data.get("recommended_skills") or "").strip()

    if role not in ("company", "student"):
        return jsonify({"error": "role must be 'company' or 'student'."}), 400
    if not name or not email or not password:
        return jsonify({"error": "name, email, and password are required."}), 400
    if role == "company" and not company_name:
        return jsonify({"error": "company_name is required for a company account."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if find_user_by_email(email):
        return jsonify({"error": "An account with that email already exists."}), 409

    user = {
        "id": uuid.uuid4().hex,
        "role": role,
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "company_name": company_name if role == "company" else "",
        "recommended_skills": recommended_skills if role == "company" else "",
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    append_csv_row(USERS_FILE, USER_FIELDS, user)

    token = make_token(user["id"])
    return jsonify({"token": token, "user": public_user(user)}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = find_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    token = make_token(user["id"])
    return jsonify({"token": token, "user": public_user(user)})


@app.route("/api/me", methods=["GET"])
@require_auth()
def me():
    return jsonify(public_user(g.user))


# ---------- companies ----------

@app.route("/api/companies", methods=["GET"])
def list_companies():
    users = read_csv_rows(USERS_FILE, USER_FIELDS)
    companies = [
        {"id": u["id"], "company_name": u["company_name"], "recommended_skills": u.get("recommended_skills", "")}
        for u in users if u["role"] == "company"
    ]
    return jsonify(companies)


@app.route("/api/companies/me", methods=["PUT"])
@require_auth(role="company")
def update_my_company():
    data = request.get_json(force=True)
    company_name = data.get("company_name")
    recommended_skills = data.get("recommended_skills")

    users = read_csv_rows(USERS_FILE, USER_FIELDS)
    for u in users:
        if u["id"] == g.user["id"]:
            if company_name is not None:
                u["company_name"] = company_name.strip()
            if recommended_skills is not None:
                u["recommended_skills"] = recommended_skills.strip()
    write_csv_rows(USERS_FILE, USER_FIELDS, users)

    updated = find_user_by_id(g.user["id"])
    return jsonify(public_user(updated))


# ---------- questions ----------

@app.route("/api/questions", methods=["GET"])
def get_questions():
    # Public: what candidates see. Only active questions — a company can pull
    # a question out of rotation without deleting its history.
    company_id = request.args.get("company_id")
    if not company_id:
        return jsonify({"error": "company_id query parameter is required."}), 400

    rows = [
        r for r in read_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS)
        if r["company_id"] == company_id and str(r.get("active", "true")).strip().lower() == "true"
    ]
    for r in rows:
        r["level"] = int(r["level"])
    rows.sort(key=lambda r: r["level"])
    return jsonify(rows)


@app.route("/api/questions/mine", methods=["GET"])
@require_auth(role="company")
def get_my_questions():
    # Company's own view: every question they've ever added, active or not,
    # so they can see and manage what's currently live.
    rows = [r for r in read_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS) if r["company_id"] == g.user["id"]]
    for r in rows:
        r["level"] = int(r["level"])
        r["active"] = str(r.get("active", "true")).strip().lower() == "true"
    rows.sort(key=lambda r: r["level"])
    return jsonify(rows)


@app.route("/api/questions", methods=["POST"])
@require_auth(role="company")
def add_question():
    data = request.get_json(force=True)
    level = data.get("level")
    question = (data.get("question") or "").strip()
    expected_answer = (data.get("expected_answer") or "").strip()

    if not level or not question or not expected_answer:
        return jsonify({"error": "level, question, and expected_answer are required."}), 400

    row = {
        "id": uuid.uuid4().hex,
        "company_id": g.user["id"],
        "level": int(level),
        "question": question,
        "expected_answer": expected_answer,
        "active": "true",
    }
    append_csv_row(QUESTIONS_FILE, QUESTION_FIELDS, row)
    return jsonify(row), 201


@app.route("/api/questions/<question_id>", methods=["PATCH"])
@require_auth(role="company")
def set_question_active(question_id):
    # Toggle a question in/out of the active ladder — never deletes the row,
    # so results that reference it stay valid history either way.
    data = request.get_json(force=True)
    active = data.get("active")
    if active is None:
        return jsonify({"error": "active (true/false) is required."}), 400

    rows = read_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS)
    found = None
    for r in rows:
        r.setdefault("active", "true")
        if r["id"] == question_id:
            if r["company_id"] != g.user["id"]:
                return jsonify({"error": "You can only manage your own questions."}), 403
            r["active"] = "true" if active else "false"
            found = r

    if not found:
        return jsonify({"error": "Question not found."}), 404

    write_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS, rows)
    found["level"] = int(found["level"])
    found["active"] = active
    return jsonify(found)


# ---------- evaluate ----------

def active_levels_for_company(company_id):
    """Distinct active levels for a company, in ascending order — used to
    decide what candidates can currently see/attempt."""
    rows = read_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS)
    levels = {
        int(r["level"]) for r in rows
        if r["company_id"] == company_id and str(r.get("active", "true")).strip().lower() == "true"
    }
    return sorted(levels)


def all_levels_for_company(company_id):
    """Every level a company has ever created, active or not. Used for the
    prerequisite check — deactivating level 1 shouldn't let someone who never
    passed it skip straight to level 2."""
    rows = read_csv_rows(QUESTIONS_FILE, QUESTION_FIELDS)
    levels = {int(r["level"]) for r in rows if r["company_id"] == company_id}
    return sorted(levels)


def student_passed_level(student_id, company_id, level):
    """Has this student already logged a passing attempt at this level for this company?"""
    for r in read_csv_rows(RESULTS_FILE, RESULT_FIELDS):
        if (
            r["student_id"] == student_id
            and r["company_id"] == company_id
            and str(r["level"]) == str(level)
            and str(r["passed"]).strip().lower() == "true"
        ):
            return True
    return False


@app.route("/api/evaluate", methods=["POST"])
@require_auth(role="student")
def evaluate():
    data = request.get_json(force=True)
    question = data.get("question")
    expected_answer = data.get("expected_answer")
    candidate_answer = data.get("candidate_answer")
    company_id = data.get("company_id")
    level = data.get("level")

    if not question or not expected_answer or not candidate_answer or not company_id or level is None:
        return jsonify({"error": "question, expected_answer, candidate_answer, company_id, and level are required."}), 400

    level = int(level)

    # Enforce sequential unlocking: every earlier active level for this company
    # must already be passed by this student before they can attempt this one.
    # This is checked server-side (not just hidden in the UI) using the same
    # Groq-graded "passed" verdict already logged for each attempt.
    earlier_levels = [lv for lv in all_levels_for_company(company_id) if lv < level]
    for lv in earlier_levels:
        if not student_passed_level(g.user["id"], company_id, lv):
            return jsonify({
                "error": f"You need to pass level {lv} before attempting level {level}."
            }), 403

    if not os.environ.get("GROQ_API_KEY"):
        return jsonify({"error": "GROQ_API_KEY is not set on the server."}), 500

    try:
        verdict = run_grading(question, expected_answer, candidate_answer)
    except Exception as e:
        return jsonify({"error": f"Grading pipeline failed: {e}"}), 502

    append_csv_row(RESULTS_FILE, RESULT_FIELDS, {
        "id": uuid.uuid4().hex,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "student_id": g.user["id"],
        "candidate_name": g.user["name"],
        "company_id": company_id,
        "level": level,
        "question": question,
        "candidate_answer": candidate_answer,
        "score": verdict["score"],
        "passed": verdict["passed"],
        "feedback": verdict["feedback"],
    })

    return jsonify(verdict)


@app.route("/api/results", methods=["GET"])
@require_auth(role="company")
def get_results():
    rows = [r for r in read_csv_rows(RESULTS_FILE, RESULT_FIELDS) if r["company_id"] == g.user["id"]]
    return jsonify(rows)


@app.route("/api/my-results", methods=["GET"])
@require_auth(role="student")
def get_my_results():
    # So the candidate UI can skip levels this student already passed,
    # instead of making them retake a level every time they come back.
    company_id = request.args.get("company_id")
    if not company_id:
        return jsonify({"error": "company_id query parameter is required."}), 400

    rows = [
        r for r in read_csv_rows(RESULTS_FILE, RESULT_FIELDS)
        if r["student_id"] == g.user["id"] and r["company_id"] == company_id
    ]
    return jsonify(rows)


# ---------- skill guide + resume builder (company-aware) ----------

def student_results_for_company(student_id, company_id):
    rows = read_csv_rows(RESULTS_FILE, RESULT_FIELDS)
    return [r for r in rows if r["student_id"] == student_id and r["company_id"] == company_id]


@app.route("/api/skill-guide", methods=["POST"])
@require_auth(role="student")
def skill_guide():
    data = request.get_json(force=True)
    company_id = data.get("company_id")
    if not company_id:
        return jsonify({"error": "company_id is required."}), 400

    company = find_user_by_id(company_id)
    if not company or company["role"] != "company":
        return jsonify({"error": "Company not found."}), 404

    attempts = student_results_for_company(g.user["id"], company_id)

    if attempts:
        lines = []
        for r in attempts:
            passed = str(r["passed"]).strip().lower() == "true"
            status = "PASSED" if passed else "DID NOT PASS"
            lines.append(f"Level {r['level']} - {r['question']} - {status} (score {r['score']}/100) - grader feedback: {r['feedback']}")
        attempts_text = "\n".join(lines)
    else:
        attempts_text = "This candidate has not attempted any interview questions from this company yet."

    recommended_skills = company.get("recommended_skills", "").strip() or "Not specified by the company."

    prompt = f"""You are a supportive career coach helping a candidate prepare for a role at {company['company_name']}.

Skills {company['company_name']} says they are looking for:
{recommended_skills}

The candidate's interview attempt history with {company['company_name']} so far:
{attempts_text}

Write a short, encouraging study guide tailored to landing a role at {company['company_name']}:
- Compare what the candidate has demonstrated (from their attempts, if any) against the skills the company wants
- Call out specific gaps and, for each, suggest 1-2 concrete things to study or practice
- If they've passed everything attempted, suggest 2-3 more advanced topics from the company's skill list to work on next
- Keep it to roughly 150-250 words, plain text, no markdown headers, second person ("you")"""

    if not os.environ.get("GROQ_API_KEY"):
        return jsonify({"error": "GROQ_API_KEY is not set on the server."}), 500

    try:
        response = llm.invoke(prompt)
    except Exception as e:
        return jsonify({"error": f"Groq request failed: {e}"}), 502

    return jsonify({"guide": response.content, "company_name": company["company_name"]})


@app.route("/api/resume", methods=["POST"])
@require_auth(role="student")
def build_resume():
    data = request.get_json(force=True)
    company_id = data.get("company_id")
    education = (data.get("education") or "").strip()
    experience = (data.get("experience") or "").strip()
    projects = (data.get("projects") or "").strip()
    extra_skills = (data.get("extra_skills") or "").strip()

    if not company_id:
        return jsonify({"error": "company_id is required."}), 400

    company = find_user_by_id(company_id)
    if not company or company["role"] != "company":
        return jsonify({"error": "Company not found."}), 404

    attempts = student_results_for_company(g.user["id"], company_id)
    passed_questions = [r["question"] for r in attempts if str(r["passed"]).strip().lower() == "true"]
    demonstrated_text = "\n".join(f"- {q}" for q in passed_questions) if passed_questions else "None logged yet."

    recommended_skills = company.get("recommended_skills", "").strip() or "Not specified by the company."

    prompt = f"""Write a clean, professional one-page resume in plain text for the following candidate,
targeted at a role at {company['company_name']}.

Name: {g.user['name']}
Education: {education or 'not provided'}
Experience: {experience or 'not provided'}
Projects: {projects or 'not provided'}
Other skills: {extra_skills or 'not provided'}

Skills {company['company_name']} has said they want for this role:
{recommended_skills}

The candidate has demonstrated real understanding of these concepts by passing interview
questions on them during {company['company_name']}'s hiring assessment:
{demonstrated_text}

Structure the resume with clear sections: a header with just the name and "Target: {company['company_name']}",
Summary (2-3 sentences that naturally reflect the company's wanted skills where truthfully supported),
Skills, Experience, Projects, Education. Use concise bullet points starting with strong action verbs.
Do not invent facts, companies, dates, or numbers that were not given above - if something was not
provided, leave it out rather than making it up. Keep the whole resume under 400 words."""

    if not os.environ.get("GROQ_API_KEY"):
        return jsonify({"error": "GROQ_API_KEY is not set on the server."}), 500

    try:
        response = llm.invoke(prompt)
    except Exception as e:
        return jsonify({"error": f"Groq request failed: {e}"}), 502

    return jsonify({"resume": response.content, "company_name": company["company_name"]})


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
