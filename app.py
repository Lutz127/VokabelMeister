import sqlite3, re, os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, render_template, session, g, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "fallback-secret")

# Secure session cookies
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = True

def execute(db, query, params=()):
    """Automatically choose placeholder style depending on DB engine."""
    cur = db.cursor()

    if isinstance(db, sqlite3.Connection):
        # SQLite uses "?"
        cur.execute(query, params)
    else:
        # PostgreSQL uses "%s"
        q = query.replace("?", "%s")
        cur.execute(q, params)
    return cur

def valid_username(username):
    """Allow A-Z, a-z, 0-9, underscore, length 3–20."""
    return re.fullmatch(r"[A-Za-z0-9_]{3,20}", username) is not None

def get_db():
    if "db" not in g:

        # On Render -> use PostgreSQL
        if "DATABASE_URL" in os.environ:
            g.db = psycopg2.connect(
                os.environ["DATABASE_URL"],
                cursor_factory=RealDictCursor
            )
        else:
            # Local development -> SQLite
            g.db = sqlite3.connect("database/users.db", check_same_thread=False)
            g.db.row_factory = sqlite3.Row

    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect("/")

    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        confirm = request.form["confirm_password"]

        if not valid_username(username):
            flash("Invalid username. Use 3–20 letters, numbers, or underscores only.")
            return redirect("/register")


        if password != confirm:
            flash("Passwords do not match!")
            return redirect("/register")

        db = get_db()

        existing = execute(db,
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()

        if existing:
            flash("Username already taken")
            return redirect("/register")

        hash_pw = generate_password_hash(password)

        execute(db,
            "INSERT INTO users (username, hash) VALUES (?, ?)",
            (username, hash_pw)
        )
        db.commit()

        flash("Registration successful! Please log in.")
        return redirect("/login")

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect("/")

    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        db = get_db()

        user = execute(db,"SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not user or not check_password_hash(user["hash"], password):
            flash("Invalid username or password")
            return redirect("/login")

        session["user_id"] = user["id"]
        session["username"] = user["username"]

        return redirect("/")
    
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

    
@app.route("/save_score", methods=["POST"])
def save_score():
    if "user_id" not in session:
        return jsonify({"status": "error", "message": "not_logged_in"})

    data = request.get_json()
    category = data["category"]
    score = data["score"]
    time = data["time"]

    db = get_db()

    existing = execute(db,
        "SELECT * FROM scores WHERE user_id = ? AND category = ?",
        (session["user_id"], category)
    ).fetchone()

    if existing:
        old_score = existing["best_score"]
        old_time = existing["best_time"]

        # Update only if BETTER score OR equal score but better time
        if score > old_score or (score == old_score and time < old_time):
            execute(db,"""
                UPDATE scores
                SET best_score = ?, best_time = ?
                WHERE id = ?
            """, (score, time, existing["id"]))
    else:
        execute(db,"""
            INSERT INTO scores (user_id, category, best_score, best_time)
            VALUES (?, ?, ?, ?)
        """, (session["user_id"], category, score, time))

    db.commit()
    return jsonify({"status": "ok"})

@app.route("/account")
def account():
    if "user_id" not in session:
        return redirect(url_for("login"))

    db = get_db()

    # Fetch all stats for this user
    stats = execute(db,"""
        SELECT category, best_score, best_time
        FROM scores
        WHERE user_id = ?
        ORDER BY category
    """, (session["user_id"],)).fetchall()

    return render_template("account.html",
                           username=session["username"],
                           stats=stats)

if __name__ == "__main__":
    app.run(debug=True)