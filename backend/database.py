import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# Load .env file (local development)
load_dotenv()

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host     = os.getenv("DB_HOST",     "localhost"),
            user     = os.getenv("DB_USER",     "root"),
            password = os.getenv("DB_PASSWORD", ""),
            database = os.getenv("DB_NAME",     "civic_complaints_db"),
            port     = int(os.getenv("DB_PORT", 3306)),
            # Supabase / PlanetScale SSL support
            ssl_disabled = os.getenv("DB_SSL_DISABLED", "false").lower() == "true",
        )
        return connection

    except Error as e:
        print("Database connection error:", e)
        return None
