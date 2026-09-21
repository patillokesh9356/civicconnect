import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    try:
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
    """Returns a dict-like cursor (like MySQL's dictionary=True)"""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
