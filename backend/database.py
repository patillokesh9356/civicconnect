import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    try:
        # Use DATABASE_URL if available (Render / Supabase full connection string)
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url, sslmode="require")
            return conn

        # Fallback: individual params
        conn = psycopg2.connect(
            host     = os.getenv("DB_HOST",     "localhost"),
            port     = int(os.getenv("DB_PORT", 5432)),
            database = os.getenv("DB_NAME",     "postgres"),
            user     = os.getenv("DB_USER",     "postgres"),
            password = os.getenv("DB_PASSWORD", ""),
            sslmode  = os.getenv("DB_SSLMODE",  "require"),
        )
        return conn

    except Exception as e:
        print("Database connection error:", e)
        return None


def get_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
