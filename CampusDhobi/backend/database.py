import sqlite3
from pathlib import Path


# ============================================================
# CHOTA DHOBI DATABASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "database"
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = DATABASE_DIR / "chotadhobi.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def create_tables():

    connection = get_connection()
    cursor = connection.cursor()

    # --------------------------------------------------------
    # STUDENTS
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            register_no TEXT UNIQUE NOT NULL,

            name TEXT NOT NULL,

            date_of_birth TEXT NOT NULL,

            gender TEXT NOT NULL,

            hostel TEXT NOT NULL,

            room_no TEXT NOT NULL,

            phone TEXT NOT NULL,

            password TEXT NOT NULL,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --------------------------------------------------------
    # LAUNDRY ORDERS
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS laundry_orders (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            order_code TEXT UNIQUE NOT NULL,

            register_no TEXT NOT NULL,

            phone TEXT NOT NULL,

            gender TEXT NOT NULL,

            hostel TEXT NOT NULL,

            room_no TEXT NOT NULL,

            bag_number TEXT NOT NULL,

            shirt INTEGER DEFAULT 0,

            pant INTEGER DEFAULT 0,

            tshirt INTEGER DEFAULT 0,

            shorts INTEGER DEFAULT 0,

            socks INTEGER DEFAULT 0,

            towel INTEGER DEFAULT 0,

            bedsheet INTEGER DEFAULT 0,

            total_clothes INTEGER DEFAULT 0,

            service TEXT NOT NULL,

            total_amount INTEGER DEFAULT 0,

            status TEXT DEFAULT 'waiting',

            payment_status TEXT DEFAULT 'pending',

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            collected_at TIMESTAMP,

            washing_at TIMESTAMP,

            ready_at TIMESTAMP,

            delivered_at TIMESTAMP,

            delay_notification_sent INTEGER DEFAULT 0,

            ready_notification_sent INTEGER DEFAULT 0,

            FOREIGN KEY (register_no)
            REFERENCES students(register_no)
        )
    """)

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            register_no TEXT NOT NULL,

            order_code TEXT,

            title TEXT NOT NULL,

            message TEXT NOT NULL,

            notification_type TEXT DEFAULT 'general',

            is_read INTEGER DEFAULT 0,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --------------------------------------------------------
    # RATINGS
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ratings (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            order_code TEXT UNIQUE NOT NULL,

            register_no TEXT NOT NULL,

            washing_quality INTEGER NOT NULL,

            ironing_quality INTEGER NOT NULL,

            on_time_delivery INTEGER NOT NULL,

            clothes_handling INTEGER NOT NULL,

            behaviour INTEGER NOT NULL,

            overall_rating REAL NOT NULL,

            review TEXT,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()


# Create tables automatically
create_tables()