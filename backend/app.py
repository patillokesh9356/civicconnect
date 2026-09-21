# ================================================================
# CivicConnect - Smart Civic Complaint & Resolution System
# Complete Backend API
# ================================================================

import os
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from functools import wraps
import re
from dotenv import load_dotenv

load_dotenv()

from database import get_db_connection

app = Flask(__name__)

# Allow requests from frontend (Vite dev + Vercel/Netlify production)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "civicconnect-super-secret-key-2024")

# ================================================================
# HELPERS
# ================================================================

def db():
    """Get DB connection; abort with 500 if unavailable."""
    conn = get_db_connection()
    if conn is None:
        return None, None
    return conn, conn.cursor(dictionary=True)


def to_str_dates(rows):
    """Convert datetime objects to ISO strings so jsonify can serialize them."""
    if isinstance(rows, list):
        return [to_str_dates(r) for r in rows]
    if isinstance(rows, dict):
        return {
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in rows.items()
        }
    return rows


# ================================================================
# JWT AUTH MIDDLEWARE
# ================================================================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        if not token:
            return jsonify({"message": "Token is missing"}), 401
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            g.user_id = payload["user_id"]
            g.role    = payload["role"]
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired. Please login again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.role != "admin":
            return jsonify({"message": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def officer_or_admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.role not in ("admin", "department_officer"):
            return jsonify({"message": "Access denied"}), 403
        return f(*args, **kwargs)
    return decorated


# ================================================================
# AI HELPER (rule-based – no external API needed)
# ================================================================

CATEGORY_KEYWORDS = {
    "Road":        ["road", "pothole", "street", "highway", "traffic", "pavement",
                    "footpath", "bridge", "rasta", "khad", "gutter"],
    "Water":       ["water", "pipe", "leak", "supply", "drainage", "flood",
                    "sewage", "pani", "nali"],
    "Electricity": ["light", "electricity", "power", "electric", "current",
                    "streetlight", "transformer", "wires", "bijli"],
    "Sanitation":  ["garbage", "waste", "trash", "smell", "dirty", "clean",
                    "mosquito", "rats", "drain", "kachara", "ganda"],
}

PRIORITY_KEYWORDS = {
    "Critical": ["emergency", "danger", "accident", "urgent", "critical",
                 "life", "death", "fire", "flood", "injury"],
    "High":     ["major", "big", "large", "serious", "severe", "worst",
                 "broken", "damaged", "mota", "mote"],
    "Low":      ["small", "minor", "little", "slight", "chota"],
}

SUGGESTIONS = {
    "Road":        "Please contact the Road Department. Meanwhile avoid the affected area.",
    "Water":       "Please report to the Water Department. Save water till the issue is resolved.",
    "Electricity": "Please contact the Electricity Department. Avoid touching loose wires.",
    "Sanitation":  "Please contact the Sanitation Department. Keep the area clean to avoid disease.",
    "Other":       "Your complaint has been registered. The relevant department will be notified.",
}


def ai_analyze(title: str, description: str) -> dict:
    text = (title + " " + description).lower()

    # Category detection
    category = "Other"
    max_hits = 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in text)
        if hits > max_hits:
            max_hits = hits
            category = cat

    # Priority detection
    priority = "Medium"
    for prio, keywords in PRIORITY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            priority = prio
            break

    # Summary (first 100 chars)
    raw = description.strip()
    summary = raw[:100] + ("..." if len(raw) > 100 else "")

    suggestion = SUGGESTIONS.get(category, SUGGESTIONS["Other"])

    return {
        "category":   category,
        "priority":   priority,
        "summary":    summary,
        "suggestion": suggestion,
    }


# ================================================================
# NOTIFICATION HELPER
# ================================================================

def create_notification(conn, cursor, user_id, complaint_id, title, message, ntype="info"):
    cursor.execute(
        """INSERT INTO notifications (user_id, complaint_id, title, message, type)
           VALUES (%s, %s, %s, %s, %s)""",
        (user_id, complaint_id, title, message, ntype)
    )
    conn.commit()


# ================================================================
# HOME
# ================================================================

@app.route("/")
def home():
    return jsonify({"message": "CivicConnect API Running ✅", "version": "2.0"})


# ================================================================
# AUTH ROUTES
# ================================================================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name     = (data.get("name")     or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()
    phone    = (data.get("phone")    or "").strip()
    address  = (data.get("address")  or "").strip()

    if not name or not email or not password:
        return jsonify({"message": "Name, email and password are required"}), 400

    if not re.match(r"^[\w.+-]+@[\w-]+\.[a-z]{2,}$", email):
        return jsonify({"message": "Invalid email address"}), 400

    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        return jsonify({"message": "Email already registered"}), 409

    hashed = generate_password_hash(password)
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password, phone, address) VALUES (%s,%s,%s,%s,%s)",
            (name, email, hashed, phone or None, address or None)
        )
        conn.commit()
    except Exception as db_err:
        cursor.close(); conn.close()
        print("DB Insert Error:", db_err)
        # Fallback: try without phone/address (old schema)
        try:
            conn2, cursor2 = db()
            if conn2 is None:
                return jsonify({"message": "Database error during registration"}), 500
            cursor2.execute(
                "INSERT INTO users (name, email, password) VALUES (%s,%s,%s)",
                (name, email, hashed)
            )
            conn2.commit()
            cursor2.close(); conn2.close()
        except Exception as db_err2:
            print("DB Insert Fallback Error:", db_err2)
            return jsonify({"message": f"Database error: {str(db_err2)}"}), 500
        return jsonify({"message": "Registration successful"}), 201
    cursor.close(); conn.close()
    return jsonify({"message": "Registration successful"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close(); conn.close()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"message": "Invalid email or password"}), 401

    # is_active column may not exist in older schema — default to True
    if user.get("is_active") is not None and not user["is_active"]:
        return jsonify({"message": "Account is disabled. Contact admin."}), 403

    # role column may not exist in older schema — default to 'citizen'
    user_role = user.get("role") or "citizen"

    token = jwt.encode(
        {
            "user_id": user["id"],
            "role":    user_role,
            "exp":     datetime.utcnow() + timedelta(hours=24),
        },
        app.config["SECRET_KEY"],
        algorithm="HS256",
    )

    return jsonify({
        "message": "Login successful",
        "token":   token,
        "user": {
            "id":            user["id"],
            "name":          user["name"],
            "email":         user["email"],
            "role":          user_role,
            "department_id": user.get("department_id"),
        },
    }), 200


@app.route("/profile", methods=["GET"])
@token_required
def get_profile():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute(
        "SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = %s",
        (g.user_id,)
    )
    user = cursor.fetchone()
    cursor.close(); conn.close()
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": to_str_dates(user)}), 200


@app.route("/profile", methods=["PUT"])
@token_required
def update_profile():
    data = request.get_json() or {}
    name    = (data.get("name")    or "").strip()
    phone   = (data.get("phone")   or "").strip()
    address = (data.get("address") or "").strip()

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute(
        "UPDATE users SET name=%s, phone=%s, address=%s WHERE id=%s",
        (name or None, phone or None, address or None, g.user_id)
    )
    conn.commit()
    cursor.close(); conn.close()
    return jsonify({"message": "Profile updated successfully"}), 200


# ================================================================
# DEPARTMENTS
# ================================================================

@app.route("/departments", methods=["GET"])
def get_departments():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute("SELECT * FROM departments WHERE is_active = TRUE ORDER BY name")
    depts = cursor.fetchall()
    cursor.close(); conn.close()
    return jsonify({"departments": to_str_dates(depts)}), 200


# ================================================================
# COMPLAINTS - CITIZEN
# ================================================================

@app.route("/complaints", methods=["POST"])
@token_required
def submit_complaint():
    data = request.get_json() or {}
    title       = (data.get("title")       or "").strip()
    description = (data.get("description") or "").strip()
    category    = (data.get("category")    or "").strip()
    location    = (data.get("location")    or "").strip()
    latitude    = data.get("latitude")
    longitude   = data.get("longitude")

    if not title or not description:
        return jsonify({"message": "Title and description are required"}), 400

    # AI analysis
    ai = ai_analyze(title, description)
    final_category = category if category else ai["category"]

    # Auto-assign department
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute(
        "SELECT id FROM departments WHERE name LIKE %s LIMIT 1",
        (f"%{final_category}%",)
    )
    dept = cursor.fetchone()
    dept_id = dept["id"] if dept else None

    # Duplicate detection: same user, same category, similar title in last 7 days
    cursor.execute(
        """SELECT id FROM complaints
           WHERE user_id=%s AND category=%s AND title=%s
             AND created_at > NOW() - INTERVAL 7 DAY
           LIMIT 1""",
        (g.user_id, final_category, title)
    )
    dup = cursor.fetchone()
    is_duplicate = dup is not None
    dup_of = dup["id"] if dup else None

    cursor.execute(
        """INSERT INTO complaints
           (user_id, title, description, category, location, latitude, longitude,
            priority, department_id, ai_category, ai_priority, ai_summary,
            ai_suggestion, is_duplicate, duplicate_of)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            g.user_id, title, description, final_category,
            location or None, latitude, longitude,
            ai["priority"], dept_id,
            ai["category"], ai["priority"], ai["summary"], ai["suggestion"],
            is_duplicate, dup_of
        )
    )
    conn.commit()
    complaint_id = cursor.lastrowid

    # Timeline entry
    cursor.execute(
        """INSERT INTO complaint_timeline
           (complaint_id, changed_by, new_status, comment)
           VALUES (%s,%s,'Pending','Complaint submitted')""",
        (complaint_id, g.user_id)
    )
    conn.commit()

    # Notification to citizen
    create_notification(
        conn, cursor, g.user_id, complaint_id,
        "Complaint Submitted ✅",
        f"Your complaint '{title}' has been submitted successfully. ID: #{complaint_id}",
        "submitted"
    )

    cursor.close(); conn.close()

    return jsonify({
        "message": "Complaint submitted successfully",
        "complaint_id": complaint_id,
        "ai": ai,
        "is_duplicate": is_duplicate,
    }), 201


@app.route("/complaints/user", methods=["GET"])
@token_required
def get_my_complaints():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        # Try with departments join first
        cursor.execute(
            """SELECT c.*, d.name AS department_name
               FROM complaints c
               LEFT JOIN departments d ON c.department_id = d.id
               WHERE c.user_id = %s
               ORDER BY c.created_at DESC""",
            (g.user_id,)
        )
    except Exception:
        # Fallback: departments table নেই — simple query
        try:
            cursor.execute(
                """SELECT * FROM complaints
                   WHERE user_id = %s
                   ORDER BY created_at DESC""",
                (g.user_id,)
            )
        except Exception as e:
            cursor.close(); conn.close()
            return jsonify({"message": f"Database error: {str(e)}"}), 500

    complaints = cursor.fetchall()
    cursor.close(); conn.close()
    return jsonify({"complaints": to_str_dates(complaints)}), 200


@app.route("/complaints/<int:complaint_id>", methods=["GET"])
@token_required
def get_complaint_detail(complaint_id):
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor.execute(
            """SELECT c.*, d.name AS department_name,
                      u.name AS citizen_name, u.email AS citizen_email
               FROM complaints c
               LEFT JOIN departments d ON c.department_id = d.id
               LEFT JOIN users u ON c.user_id = u.id
               WHERE c.id = %s""",
            (complaint_id,)
        )
    except Exception:
        # Fallback without joins
        cursor.execute("SELECT * FROM complaints WHERE id = %s", (complaint_id,))

    complaint = cursor.fetchone()

    if not complaint:
        cursor.close(); conn.close()
        return jsonify({"message": "Complaint not found"}), 404

    # Authorization: citizen can only see own complaints
    if g.role == "citizen" and complaint["user_id"] != g.user_id:
        cursor.close(); conn.close()
        return jsonify({"message": "Access denied"}), 403

    # Timeline — safe if table doesn't exist
    timeline = []
    try:
        cursor.execute(
            """SELECT ct.*, u.name AS changed_by_name
               FROM complaint_timeline ct
               LEFT JOIN users u ON ct.changed_by = u.id
               WHERE ct.complaint_id = %s
               ORDER BY ct.created_at ASC""",
            (complaint_id,)
        )
        timeline = cursor.fetchall()
    except Exception:
        pass

    cursor.close(); conn.close()
    return jsonify({
        "complaint": to_str_dates(complaint),
        "timeline":  to_str_dates(timeline),
    }), 200


# ================================================================
# NOTIFICATIONS - CITIZEN
# ================================================================

@app.route("/notifications", methods=["GET"])
@token_required
def get_notifications():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor.execute(
            """SELECT * FROM notifications
               WHERE user_id = %s
               ORDER BY created_at DESC LIMIT 50""",
            (g.user_id,)
        )
        notifs = cursor.fetchall()

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=%s AND is_read=FALSE",
            (g.user_id,)
        )
        unread = cursor.fetchone()["cnt"]
    except Exception as e:
        print("Notifications error:", e)
        cursor.close(); conn.close()
        # Table may not exist yet — return empty safely
        return jsonify({"notifications": [], "unread_count": 0}), 200

    cursor.close(); conn.close()
    return jsonify({
        "notifications": to_str_dates(notifs),
        "unread_count":  unread,
    }), 200


@app.route("/notifications/read-all", methods=["PUT"])
@token_required
def mark_all_read():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute(
        "UPDATE notifications SET is_read=TRUE WHERE user_id=%s", (g.user_id,)
    )
    conn.commit()
    cursor.close(); conn.close()
    return jsonify({"message": "All notifications marked as read"}), 200


@app.route("/notifications/<int:notif_id>/read", methods=["PUT"])
@token_required
def mark_notification_read(notif_id):
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute(
        "UPDATE notifications SET is_read=TRUE WHERE id=%s AND user_id=%s",
        (notif_id, g.user_id)
    )
    conn.commit()
    cursor.close(); conn.close()
    return jsonify({"message": "Notification marked as read"}), 200


# ================================================================
# DASHBOARD STATS - CITIZEN
# ================================================================

@app.route("/dashboard/stats", methods=["GET"])
@app.route("/dashboard/stats", methods=["GET"])
@token_required
def user_dashboard_stats():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    uid = g.user_id

    try:
        cursor.execute("SELECT COUNT(*) AS total FROM complaints WHERE user_id=%s", (uid,))
        total = cursor.fetchone()["total"]

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM complaints WHERE user_id=%s AND status='Pending'", (uid,)
        )
        pending = cursor.fetchone()["cnt"]

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM complaints WHERE user_id=%s AND status='In Progress'", (uid,)
        )
        in_progress = cursor.fetchone()["cnt"]

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM complaints WHERE user_id=%s AND status='Resolved'", (uid,)
        )
        resolved = cursor.fetchone()["cnt"]

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM complaints WHERE user_id=%s AND status='Rejected'", (uid,)
        )
        rejected = cursor.fetchone()["cnt"]

        # Category breakdown
        cursor.execute(
            """SELECT category, COUNT(*) AS count
               FROM complaints WHERE user_id=%s
               GROUP BY category""",
            (uid,)
        )
        by_category = cursor.fetchall()

        # Monthly trend (last 6 months)
        cursor.execute(
            """SELECT DATE_FORMAT(created_at,'%%b %%Y') AS month,
                      COUNT(*) AS count
               FROM complaints
               WHERE user_id=%s AND created_at > NOW() - INTERVAL 6 MONTH
               GROUP BY DATE_FORMAT(created_at,'%%Y-%%m')
               ORDER BY MIN(created_at)""",
            (uid,)
        )
        monthly = cursor.fetchall()

    except Exception as e:
        print("Dashboard stats error:", e)
        cursor.close(); conn.close()
        # Return safe zero-state instead of crashing
        return jsonify({
            "total": 0, "pending": 0, "in_progress": 0,
            "resolved": 0, "rejected": 0,
            "by_category": [], "monthly": [],
            "warning": str(e)
        }), 200

    cursor.close(); conn.close()
    return jsonify({
        "total":       total,
        "pending":     pending,
        "in_progress": in_progress,
        "resolved":    resolved,
        "rejected":    rejected,
        "by_category": by_category,
        "monthly":     monthly,
    }), 200


# ================================================================
# ADMIN - DASHBOARD STATS
# ================================================================

@app.route("/admin/stats", methods=["GET"])
@admin_required
def admin_stats():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT COUNT(*) AS total FROM complaints")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT status, COUNT(*) AS count FROM complaints GROUP BY status")
    by_status = cursor.fetchall()

    cursor.execute("SELECT category, COUNT(*) AS count FROM complaints GROUP BY category")
    by_category = cursor.fetchall()

    cursor.execute(
        """SELECT DATE_FORMAT(created_at,'%%b %%Y') AS month,
                  COUNT(*) AS count
           FROM complaints
           WHERE created_at > NOW() - INTERVAL 6 MONTH
           GROUP BY DATE_FORMAT(created_at,'%%Y-%%m')
           ORDER BY MIN(created_at)"""
    )
    monthly = cursor.fetchall()

    cursor.execute(
        """SELECT d.name AS department, COUNT(c.id) AS count
           FROM departments d
           LEFT JOIN complaints c ON d.id = c.department_id
           GROUP BY d.id, d.name"""
    )
    by_dept = cursor.fetchall()

    # Resolution rate
    cursor.execute(
        "SELECT COUNT(*) AS cnt FROM complaints WHERE status='Resolved'"
    )
    resolved_cnt = cursor.fetchone()["cnt"]
    resolution_rate = round((resolved_cnt / total * 100), 1) if total else 0

    cursor.close(); conn.close()
    return jsonify({
        "total":           total,
        "by_status":       by_status,
        "by_category":     by_category,
        "monthly":         monthly,
        "by_department":   by_dept,
        "resolution_rate": resolution_rate,
    }), 200


# ================================================================
# ADMIN - COMPLAINTS (GET + FILTER)
# ================================================================

@app.route("/admin/complaints", methods=["GET"])
@admin_required
def admin_get_complaints():
    status   = request.args.get("status")
    category = request.args.get("category")
    dept_id  = request.args.get("department_id")
    search   = request.args.get("search", "").strip()
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    where_clauses = []
    params = []

    if status:
        where_clauses.append("c.status = %s"); params.append(status)
    if category:
        where_clauses.append("c.category = %s"); params.append(category)
    if dept_id:
        where_clauses.append("c.department_id = %s"); params.append(dept_id)
    if search:
        where_clauses.append("(c.title LIKE %s OR c.description LIKE %s OR u.name LIKE %s)")
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    count_params = params[:]
    cursor.execute(
        f"SELECT COUNT(*) AS total FROM complaints c JOIN users u ON c.user_id=u.id {where_sql}",
        count_params
    )
    total_count = cursor.fetchone()["total"]

    offset = (page - 1) * per_page
    params += [per_page, offset]

    cursor.execute(
        f"""SELECT c.*, u.name AS citizen_name, u.email AS citizen_email,
                   d.name AS department_name
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN departments d ON c.department_id = d.id
            {where_sql}
            ORDER BY c.created_at DESC
            LIMIT %s OFFSET %s""",
        params
    )
    complaints = cursor.fetchall()
    cursor.close(); conn.close()

    return jsonify({
        "complaints":  to_str_dates(complaints),
        "total":       total_count,
        "page":        page,
        "per_page":    per_page,
        "total_pages": (total_count + per_page - 1) // per_page,
    }), 200


# ================================================================
# ADMIN - UPDATE STATUS & ASSIGN DEPARTMENT
# ================================================================

@app.route("/admin/complaints/<int:complaint_id>/status", methods=["PUT"])
@admin_required
def admin_update_status(complaint_id):
    data    = request.get_json() or {}
    status  = data.get("status")
    comment = (data.get("comment") or "").strip()

    allowed = ["Pending", "Assigned", "In Progress", "Resolved", "Rejected"]
    if status not in allowed:
        return jsonify({"message": f"Status must be one of: {', '.join(allowed)}"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute(
        "SELECT * FROM complaints WHERE id=%s", (complaint_id,)
    )
    complaint = cursor.fetchone()
    if not complaint:
        cursor.close(); conn.close()
        return jsonify({"message": "Complaint not found"}), 404

    old_status = complaint["status"]
    resolved_at_sql = ", resolved_at=NOW()" if status == "Resolved" else ""

    cursor.execute(
        f"UPDATE complaints SET status=%s{resolved_at_sql} WHERE id=%s",
        (status, complaint_id)
    )
    conn.commit()

    # Timeline
    cursor.execute(
        """INSERT INTO complaint_timeline
           (complaint_id, changed_by, old_status, new_status, comment)
           VALUES (%s,%s,%s,%s,%s)""",
        (complaint_id, g.user_id, old_status, status, comment or f"Status changed to {status}")
    )
    conn.commit()

    # Notification to citizen
    type_map = {"Resolved": "resolved", "Rejected": "rejected"}
    ntype = type_map.get(status, "status_change")
    create_notification(
        conn, cursor,
        complaint["user_id"], complaint_id,
        f"Complaint Status Updated",
        f"Your complaint #{complaint_id} status changed from '{old_status}' to '{status}'. {comment}",
        ntype
    )

    cursor.close(); conn.close()
    return jsonify({"message": f"Status updated to {status}"}), 200


@app.route("/admin/complaints/<int:complaint_id>/assign", methods=["PUT"])
@admin_required
def admin_assign_department(complaint_id):
    data    = request.get_json() or {}
    dept_id = data.get("department_id")

    if not dept_id:
        return jsonify({"message": "department_id is required"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT id, name FROM departments WHERE id=%s", (dept_id,))
    dept = cursor.fetchone()
    if not dept:
        cursor.close(); conn.close()
        return jsonify({"message": "Department not found"}), 404

    cursor.execute(
        "SELECT user_id FROM complaints WHERE id=%s", (complaint_id,)
    )
    complaint = cursor.fetchone()
    if not complaint:
        cursor.close(); conn.close()
        return jsonify({"message": "Complaint not found"}), 404

    cursor.execute(
        "UPDATE complaints SET department_id=%s, status='Assigned' WHERE id=%s",
        (dept_id, complaint_id)
    )
    conn.commit()

    # Timeline
    cursor.execute(
        """INSERT INTO complaint_timeline
           (complaint_id, changed_by, old_status, new_status, comment)
           VALUES (%s,%s,'Pending','Assigned',%s)""",
        (complaint_id, g.user_id, f"Assigned to {dept['name']}")
    )
    conn.commit()

    create_notification(
        conn, cursor,
        complaint["user_id"], complaint_id,
        "Complaint Assigned 📋",
        f"Your complaint #{complaint_id} has been assigned to {dept['name']}.",
        "assigned"
    )

    cursor.close(); conn.close()
    return jsonify({"message": f"Complaint assigned to {dept['name']}"}), 200


# ================================================================
# ADMIN - USER MANAGEMENT
# ================================================================

@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_get_users():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute(
        "SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC"
    )
    users = cursor.fetchall()
    cursor.close(); conn.close()
    return jsonify({"users": to_str_dates(users)}), 200


@app.route("/admin/users/<int:user_id>/toggle", methods=["PUT"])
@admin_required
def admin_toggle_user(user_id):
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500
    cursor.execute("SELECT is_active FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    if not user:
        cursor.close(); conn.close()
        return jsonify({"message": "User not found"}), 404
    new_state = not user["is_active"]
    cursor.execute("UPDATE users SET is_active=%s WHERE id=%s", (new_state, user_id))
    conn.commit()
    cursor.close(); conn.close()
    return jsonify({"message": f"User {'activated' if new_state else 'deactivated'}"}), 200


@app.route("/admin/users/create-officer", methods=["POST"])
@admin_required
def create_department_officer():
    data      = request.get_json() or {}
    name      = (data.get("name")      or "").strip()
    email     = (data.get("email")     or "").strip().lower()
    password  = (data.get("password")  or "").strip()
    dept_id   = data.get("department_id")

    if not name or not email or not password or not dept_id:
        return jsonify({"message": "All fields required"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        return jsonify({"message": "Email already registered"}), 409

    hashed = generate_password_hash(password)
    cursor.execute(
        """INSERT INTO users (name, email, password, role, department_id)
           VALUES (%s,%s,%s,'department_officer',%s)""",
        (name, email, hashed, dept_id)
    )
    conn.commit()
    cursor.close(); conn.close()
    return jsonify({"message": "Department officer created successfully"}), 201


# ================================================================
# DEPARTMENT OFFICER - DASHBOARD
# ================================================================

@app.route("/department/complaints", methods=["GET"])
@officer_or_admin_required
def dept_get_complaints():
    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    # Get officer's department
    cursor.execute("SELECT department_id FROM users WHERE id=%s", (g.user_id,))
    user = cursor.fetchone()

    if g.role == "admin":
        dept_id = request.args.get("department_id")
    else:
        dept_id = user["department_id"] if user else None

    if not dept_id:
        cursor.close(); conn.close()
        return jsonify({"message": "Department not assigned"}), 400

    status = request.args.get("status")
    where_extra = " AND c.status=%s" if status else ""
    params = [dept_id] + ([status] if status else [])

    cursor.execute(
        f"""SELECT c.*, u.name AS citizen_name
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            WHERE c.department_id = %s {where_extra}
            ORDER BY c.created_at DESC""",
        params
    )
    complaints = cursor.fetchall()
    cursor.close(); conn.close()
    return jsonify({"complaints": to_str_dates(complaints)}), 200


@app.route("/department/complaints/<int:complaint_id>/status", methods=["PUT"])
@officer_or_admin_required
def dept_update_status(complaint_id):
    data    = request.get_json() or {}
    status  = data.get("status")
    comment = (data.get("comment") or "").strip()

    allowed = ["In Progress", "Resolved", "Rejected"]
    if status not in allowed:
        return jsonify({"message": f"Officers can set: {', '.join(allowed)}"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    cursor.execute("SELECT * FROM complaints WHERE id=%s", (complaint_id,))
    complaint = cursor.fetchone()
    if not complaint:
        cursor.close(); conn.close()
        return jsonify({"message": "Complaint not found"}), 404

    # Verify the officer belongs to this complaint's department
    if g.role == "department_officer":
        cursor.execute("SELECT department_id FROM users WHERE id=%s", (g.user_id,))
        officer = cursor.fetchone()
        if not officer or officer["department_id"] != complaint["department_id"]:
            cursor.close(); conn.close()
            return jsonify({"message": "You can only update complaints in your department"}), 403

    old_status = complaint["status"]
    resolved_at_sql = ", resolved_at=NOW()" if status == "Resolved" else ""
    cursor.execute(
        f"UPDATE complaints SET status=%s{resolved_at_sql} WHERE id=%s",
        (status, complaint_id)
    )
    conn.commit()

    cursor.execute(
        """INSERT INTO complaint_timeline
           (complaint_id, changed_by, old_status, new_status, comment)
           VALUES (%s,%s,%s,%s,%s)""",
        (complaint_id, g.user_id, old_status, status, comment or f"Status changed to {status}")
    )
    conn.commit()

    type_map = {"Resolved": "resolved", "Rejected": "rejected"}
    ntype = type_map.get(status, "status_change")
    create_notification(
        conn, cursor,
        complaint["user_id"], complaint_id,
        "Complaint Status Updated",
        f"Your complaint #{complaint_id} status changed to '{status}'. {comment}",
        ntype
    )

    cursor.close(); conn.close()
    return jsonify({"message": f"Status updated to {status}"}), 200


# ================================================================
# AI ENDPOINT
# ================================================================

@app.route("/ai/analyze", methods=["POST"])
@token_required
def analyze_complaint():
    data        = request.get_json() or {}
    title       = (data.get("title")       or "").strip()
    description = (data.get("description") or "").strip()

    if not title and not description:
        return jsonify({"message": "title or description required"}), 400

    result = ai_analyze(title, description)
    return jsonify(result), 200


# ================================================================
# NEARBY COMPLAINTS (map)
# ================================================================

@app.route("/complaints/nearby", methods=["GET"])
@token_required
def nearby_complaints():
    try:
        lat  = float(request.args.get("lat",  0))
        lng  = float(request.args.get("lng",  0))
        radius = float(request.args.get("radius", 5))   # km
    except ValueError:
        return jsonify({"message": "Invalid coordinates"}), 400

    conn, cursor = db()
    if conn is None:
        return jsonify({"message": "Database connection failed"}), 500

    # Haversine filter (~radius km)
    cursor.execute(
        """SELECT id, title, category, status, priority,
                  latitude, longitude, location, created_at,
                  (6371 * ACOS(
                      COS(RADIANS(%s)) * COS(RADIANS(latitude)) *
                      COS(RADIANS(longitude) - RADIANS(%s)) +
                      SIN(RADIANS(%s)) * SIN(RADIANS(latitude))
                  )) AS distance
           FROM complaints
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL
           HAVING distance < %s
           ORDER BY distance ASC
           LIMIT 50""",
        (lat, lng, lat, radius)
    )
    results = cursor.fetchall()
    cursor.close(); conn.close()
    return jsonify({"complaints": to_str_dates(results)}), 200


# ================================================================
# RUN
# ================================================================

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
