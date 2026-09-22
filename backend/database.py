import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    """
    Local: MySQL (mysql-connector-python)
    Production (Render): PostgreSQL/Supabase (psycopg2)
    Auto-detects based on DATABASE_URL env variable.
    """
    database_url = os.getenv("DATABASE_URL")

    # ── PRODUCTION: PostgreSQL / Supabase ──
    if database_url:
        try:
            import psycopg2
            import psycopg2.extras
            conn = psycopg2.connect(database_url, sslmode="require")
            return conn
        except Exception as e:
            print("PostgreSQL connection error:", e)
            return None

    # ── LOCAL: MySQL ──
    try:
        import mysql.connector
        conn = mysql.connector.connect(
            host     = os.getenv("DB_HOST",     "localhost"),
            user     = os.getenv("DB_USER",     "root"),
            password = os.getenv("DB_PASSWORD", "Lokesh@003"),
            database = os.getenv("DB_NAME",     "civic_complaints_db"),
            port     = int(os.getenv("DB_PORT", 3306)),
        )
        return conn
    except Exception as e:
        print("MySQL connection error:", e)
        return None


def get_cursor(conn):
    """Returns dict-like cursor for both MySQL and PostgreSQL."""
    # Check if PostgreSQL connection
    try:
        import psycopg2.extras
        if hasattr(conn, 'autocommit'):  # psycopg2 connection
            return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    except ImportError:
        pass

    # MySQL — dictionary cursor
    return conn.cursor(dictionary=True)
