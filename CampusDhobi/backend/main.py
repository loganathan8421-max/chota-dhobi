from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
import sqlite3
import secrets
import re
import asyncio

from database import get_connection, create_tables


# ============================================================
# CHOTA DHOBI
# Backend API
# ============================================================

IST = ZoneInfo("Asia/Kolkata")

BOOKING_START = time(6, 0)
BOOKING_END = time(8, 30)

DELIVERY_START = time(16, 0)
DELIVERY_END = time(19, 0)

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin@123"

MALE_HOSTELS = [
    "Old Hostel",
    "9 Storey Hostel",
    "Titanic Hostel",
    "Butterfly Hostel"
]

FEMALE_HOSTELS = [
    "H1 Hostel",
    "H2 Hostel",
    "H3 Hostel",
    "H4 Hostel"
]

ALL_HOSTELS = MALE_HOSTELS + FEMALE_HOSTELS

SERVICES = {
    "washing": 0,
    "ironing": 20,
    "both": 20
}


# ============================================================
# TIME HELPERS
# ============================================================

def now_ist():
    return datetime.now(IST)


def now_string():
    return now_ist().strftime("%Y-%m-%d %H:%M:%S")


def is_booking_open():
    current = now_ist().time().replace(microsecond=0)

    return BOOKING_START <= current <= BOOKING_END


def is_delivery_time():
    current = now_ist().time().replace(microsecond=0)

    return DELIVERY_START <= current <= DELIVERY_END


# ============================================================
# GENERAL HELPERS
# ============================================================

def row_to_dict(row):

    if row is None:
        return None

    return dict(row)


def generate_verification_code(connection):

    while True:

        code = str(secrets.randbelow(900000) + 100000)

        result = connection.execute(
            """
            SELECT id
            FROM laundry_orders
            WHERE order_code = ?
            """,
            (code,)
        ).fetchone()

        if result is None:
            return code


def generate_order_id(connection):

    while True:

        order_id = (
            "CD-"
            + now_ist().strftime("%Y")
            + "-"
            + str(secrets.randbelow(900000) + 100000)
        )

        result = connection.execute(
            """
            SELECT id
            FROM laundry_orders
            WHERE order_code = ?
            """,
            (order_id,)
        ).fetchone()

        if result is None:
            return order_id


def validate_dob(dob):

    try:
        value = datetime.strptime(dob, "%d/%m/%Y")

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="DOB must be in DD/MM/YYYY format."
        )

    if value.date() > now_ist().date():

        raise HTTPException(
            status_code=400,
            detail="Date of birth cannot be in the future."
        )

    return value


def generate_password(name, dob):

    dob_date = validate_dob(dob)

    first_name = name.strip().split()[0]

    return f"{first_name}@{dob_date.year}"


def validate_phone(phone):

    phone = phone.strip()

    if not re.fullmatch(r"[6-9][0-9]{9}", phone):

        raise HTTPException(
            status_code=400,
            detail="Enter a valid 10-digit Indian phone number."
        )

    return phone


def validate_bag_number(bag_number):

    bag_number = str(bag_number).strip()

    if not re.fullmatch(r"[0-9]{4}", bag_number):

        raise HTTPException(
            status_code=400,
            detail="Bag number must contain exactly 4 digits."
        )

    return bag_number


def get_student(connection, register_no):

    return connection.execute(
        """
        SELECT *
        FROM students
        WHERE register_no = ?
        """,
        (register_no,)
    ).fetchone()


def get_order(connection, order_code):

    return connection.execute(
        """
        SELECT
            o.*,

            s.name AS student_name,
            s.date_of_birth,
            s.phone AS student_phone,
            s.gender AS student_gender,
            s.hostel AS student_hostel,
            s.room_no AS student_room

        FROM laundry_orders o

        JOIN students s
        ON s.register_no = o.register_no

        WHERE o.order_code = ?
        """,
        (order_code,)
    ).fetchone()


def order_response(row):

    if row is None:
        return None

    data = dict(row)

    return {
        "order_code": data.get("order_code"),
        "register_no": data.get("register_no"),

        "student": {
            "name": data.get("student_name"),
            "phone": data.get("student_phone"),
            "gender": data.get("student_gender"),
            "hostel": data.get("student_hostel"),
            "room_no": data.get("student_room")
        },

        "bag_number": data.get("bag_number"),

        "clothes": {
            "shirt": data.get("shirt", 0),
            "pant": data.get("pant", 0),
            "tshirt": data.get("tshirt", 0),
            "shorts": data.get("shorts", 0),
            "socks": data.get("socks", 0),
            "towel": data.get("towel", 0),
            "bedsheet": data.get("bedsheet", 0)
        },

        "total_clothes": data.get("total_clothes", 0),

        "service": data.get("service"),

        "total_amount": data.get("total_amount", 0),

        "status": data.get("status"),

        "payment_status": data.get("payment_status"),

        "created_at": data.get("created_at"),
        "collected_at": data.get("collected_at"),
        "washing_at": data.get("washing_at"),
        "ready_at": data.get("ready_at"),
        "delivered_at": data.get("delivered_at")
    }


def add_notification(
    connection,
    register_no,
    order_code,
    title,
    message,
    notification_type
):

    connection.execute(
        """
        INSERT INTO notifications
        (
            register_no,
            order_code,
            title,
            message,
            notification_type,
            is_read,
            created_at
        )

        VALUES (?, ?, ?, ?, ?, 0, ?)
        """,
        (
            register_no,
            order_code,
            title,
            message,
            notification_type,
            now_string()
        )
    )


# ============================================================
# AUTOMATIC DELAY NOTIFICATION
# ============================================================

def check_delayed_orders():

    connection = get_connection()

    try:

        current_time = now_ist()
        limit_time = current_time - timedelta(days=2)

        rows = connection.execute(
            """
            SELECT *
            FROM laundry_orders

            WHERE status != 'delivered'
            AND delay_notification_sent = 0
            """
        ).fetchall()

        for order in rows:

            try:
                created_time = datetime.strptime(
                    order["created_at"],
                    "%Y-%m-%d %H:%M:%S"
                ).replace(tzinfo=IST)

            except Exception:
                continue

            if created_time < limit_time:

                message = (
                    "Sorry for the delay. Your laundry order is "
                    "taking longer than expected. "
                    "We apologize for the inconvenience."
                )

                add_notification(
                    connection,
                    order["register_no"],
                    order["order_code"],
                    "Laundry Delay",
                    message,
                    "delay"
                )

                connection.execute(
                    """
                    UPDATE laundry_orders

                    SET delay_notification_sent = 1

                    WHERE id = ?
                    """,
                    (order["id"],)
                )

        connection.commit()

    finally:

        connection.close()


async def delay_notification_loop():

    while True:

        try:
            check_delayed_orders()

        except Exception as error:
            print("Delay notification error:", error)

        await asyncio.sleep(60)


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app):

    create_tables()

    task = asyncio.create_task(
        delay_notification_loop()
    )

    yield

    task.cancel()

    try:
        await task

    except asyncio.CancelledError:
        pass


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Chota Dhobi API",
    description="Smart College Laundry Management System",
    version="1.0",
    lifespan=lifespan
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=False,

    allow_methods=["*"],

    allow_headers=["*"]
)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class StudentRegister(BaseModel):

    register_no: str

    name: str

    date_of_birth: str

    gender: str

    hostel: str

    room_no: str

    phone: str


class StudentLogin(BaseModel):

    register_no: str

    password: str


class AdminLogin(BaseModel):

    username: str

    password: str


class LaundryOrder(BaseModel):

    register_no: str

    bag_number: str

    shirt: int = Field(default=0, ge=0)

    pant: int = Field(default=0, ge=0)

    tshirt: int = Field(default=0, ge=0)

    shorts: int = Field(default=0, ge=0)

    socks: int = Field(default=0, ge=0)

    towel: int = Field(default=0, ge=0)

    bedsheet: int = Field(default=0, ge=0)

    service: str


class StatusUpdate(BaseModel):

    status: str


class RatingCreate(BaseModel):

    washing_quality: int = Field(ge=1, le=5)

    ironing_quality: int = Field(ge=1, le=5)

    on_time_delivery: int = Field(ge=1, le=5)

    clothes_handling: int = Field(ge=1, le=5)

    behaviour: int = Field(ge=1, le=5)

    review: str = ""


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "application": "Chota Dhobi",
        "status": "running",
        "version": "1.0"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "time": now_string()
    }


# ============================================================
# STUDENT REGISTRATION
# ============================================================

@app.post("/api/student/register")
def register_student(data: StudentRegister):

    register_no = data.register_no.strip().upper()

    name = data.name.strip()

    dob = data.date_of_birth.strip()

    gender = data.gender.strip().lower()

    hostel = data.hostel.strip()

    room_no = data.room_no.strip()

    phone = validate_phone(data.phone)

    if not register_no:

        raise HTTPException(
            status_code=400,
            detail="Register number is required."
        )

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Name is required."
        )

    if not room_no:

        raise HTTPException(
            status_code=400,
            detail="Room number is required."
        )

    validate_dob(dob)

    if gender not in ["male", "female"]:

        raise HTTPException(
            status_code=400,
            detail="Gender must be Male or Female."
        )

    if hostel not in ALL_HOSTELS:

        raise HTTPException(
            status_code=400,
            detail="Invalid hostel."
        )

    if gender == "male" and hostel not in MALE_HOSTELS:

        raise HTTPException(
            status_code=400,
            detail="Please select a male hostel."
        )

    if gender == "female" and hostel not in FEMALE_HOSTELS:

        raise HTTPException(
            status_code=400,
            detail="Please select a female hostel."
        )

    password = generate_password(
        name,
        dob
    )

    connection = get_connection()

    try:

        connection.execute(
            """
            INSERT INTO students
            (
                register_no,
                name,
                date_of_birth,
                gender,
                hostel,
                room_no,
                phone,
                password,
                created_at
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                register_no,
                name,
                dob,
                gender,
                hostel,
                room_no,
                phone,
                password,
                now_string()
            )
        )

        connection.commit()

    except sqlite3.IntegrityError:

        raise HTTPException(
            status_code=400,
            detail="Register number already exists."
        )

    finally:

        connection.close()

    return {
        "success": True,

        "message": "Account created successfully.",

        "student": {
            "register_no": register_no,
            "name": name,
            "date_of_birth": dob,
            "gender": gender,
            "hostel": hostel,
            "room_no": room_no,
            "phone": phone
        },

        "password": password,

        "password_format": "Name@BirthYear"
    }


# ============================================================
# STUDENT LOGIN
# ============================================================

@app.post("/api/student/login")
def student_login(data: StudentLogin):

    register_no = data.register_no.strip().upper()

    password = data.password.strip()

    connection = get_connection()

    student = get_student(
        connection,
        register_no
    )

    connection.close()

    if student is None:

        raise HTTPException(
            status_code=401,
            detail="Student account not found."
        )

    if student["password"] != password:

        raise HTTPException(
            status_code=401,
            detail="Incorrect password."
        )

    return {
        "success": True,

        "message": "Login successful.",

        "student": {
            "register_no": student["register_no"],
            "name": student["name"],
            "date_of_birth": student["date_of_birth"],
            "gender": student["gender"],
            "hostel": student["hostel"],
            "room_no": student["room_no"],
            "phone": student["phone"]
        }
    }


# ============================================================
# ADMIN LOGIN
# ============================================================

@app.post("/api/admin/login")
def admin_login(data: AdminLogin):

    if (
        data.username.strip() != ADMIN_USERNAME
        or data.password != ADMIN_PASSWORD
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid admin username or password."
        )

    return {
        "success": True,
        "message": "Admin login successful.",
        "admin": {
            "username": ADMIN_USERNAME
        }
    }


# ============================================================
# BOOKING WINDOW
# ============================================================

@app.get("/api/laundry/booking-window")
def booking_window():

    current = now_ist()

    return {
        "current_time": current.strftime("%I:%M:%S %p"),

        "booking_open": is_booking_open(),

        "booking_start": "06:00 AM",

        "booking_end": "08:30 AM",

        "delivery_start": "04:00 PM",

        "delivery_end": "07:00 PM",

        "message":
            "Laundry booking is available from "
            "6:00 AM to 8:30 AM."
            if is_booking_open()
            else
            "Laundry booking is currently closed."
    }


# ============================================================
# CREATE LAUNDRY ORDER
# ============================================================

@app.post("/api/laundry/order")
def create_laundry_order(data: LaundryOrder):

    # --------------------------------------------------------
    # CHECK BOOKING TIME
    # --------------------------------------------------------

    if not is_booking_open():

        raise HTTPException(
            status_code=400,
            detail=(
                "Laundry booking is available only "
                "from 6:00 AM to 8:30 AM."
            )
        )

    # --------------------------------------------------------
    # VALIDATE BAG
    # --------------------------------------------------------

    bag_number = validate_bag_number(
        data.bag_number
    )

    # --------------------------------------------------------
    # SERVICE
    # --------------------------------------------------------

    service = data.service.strip().lower()

    if service not in SERVICES:

        raise HTTPException(
            status_code=400,
            detail="Invalid laundry service."
        )

    # --------------------------------------------------------
    # STUDENT
    # --------------------------------------------------------

    register_no = data.register_no.strip().upper()

    connection = get_connection()

    student = get_student(
        connection,
        register_no
    )

    if student is None:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Student account not found."
        )

    # --------------------------------------------------------
    # CLOTH COUNT
    # --------------------------------------------------------

    total_clothes = (
        data.shirt
        + data.pant
        + data.tshirt
        + data.shorts
        + data.socks
        + data.towel
        + data.bedsheet
    )

    if total_clothes <= 0:

        connection.close()

        raise HTTPException(
            status_code=400,
            detail="Please select at least one cloth."
        )

    # --------------------------------------------------------
    # PRICE
    # --------------------------------------------------------

    price_per_cloth = SERVICES[service]

    total_amount = (
        total_clothes
        * price_per_cloth
    )

    # --------------------------------------------------------
    # CODES
    # --------------------------------------------------------

    verification_code = generate_verification_code(
        connection
    )

    order_code = generate_order_id(
        connection
    )

    # --------------------------------------------------------
    # INSERT
    # --------------------------------------------------------

    created_at = now_string()

    connection.execute(
        """
        INSERT INTO laundry_orders
        (
            order_code,
            register_no,
            phone,
            gender,
            hostel,
            room_no,
            bag_number,

            shirt,
            pant,
            tshirt,
            shorts,
            socks,
            towel,
            bedsheet,

            total_clothes,
            service,
            total_amount,

            status,
            payment_status,

            created_at
        )

        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            'waiting',
            'pending',
            ?
        )
        """,
        (
            verification_code,
            register_no,
            student["phone"],
            student["gender"],
            student["hostel"],
            student["room_no"],
            bag_number,

            data.shirt,
            data.pant,
            data.tshirt,
            data.shorts,
            data.socks,
            data.towel,
            data.bedsheet,

            total_clothes,
            service,
            total_amount,

            created_at
        )
    )

    connection.commit()

    order = get_order(
        connection,
        verification_code
    )

    connection.close()

    return {
        "success": True,

        "message":
            "Laundry order created successfully.",

        "verification_code":
            verification_code,

        "order": order_response(order),

        "delivery_window":
            "04:00 PM - 07:00 PM"
    }


# ============================================================
# VERIFY LAUNDRY CODE
# ADMIN
# ============================================================

@app.get("/api/admin/verify/{verification_code}")
def verify_laundry_code(
    verification_code: str
):

    verification_code = verification_code.strip()

    connection = get_connection()

    order = get_order(
        connection,
        verification_code
    )

    connection.close()

    if order is None:

        raise HTTPException(
            status_code=404,
            detail="Verification code not found."
        )

    return {
        "success": True,
        "order": order_response(order)
    }


# ============================================================
# UPDATE ORDER STATUS
# ============================================================

@app.put("/api/laundry/order/{order_code}/status")
def update_order_status(
    order_code: str,
    data: StatusUpdate
):

    new_status = data.status.strip().lower()

    valid_statuses = [
        "waiting",
        "collected",
        "washing",
        "ready",
        "delivered"
    ]

    if new_status not in valid_statuses:

        raise HTTPException(
            status_code=400,
            detail="Invalid order status."
        )

    connection = get_connection()

    order = get_order(
        connection,
        order_code
    )

    if order is None:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Laundry order not found."
        )

    current_status = order["status"]

    # --------------------------------------------------------
    # STATUS FLOW
    # --------------------------------------------------------

    allowed_next = {
        "waiting": "collected",
        "collected": "washing",
        "washing": "ready",
        "ready": "delivered"
    }

    if new_status != current_status:

        expected_status = allowed_next.get(
            current_status
        )

        if expected_status != new_status:

            connection.close()

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Order cannot move from "
                    f"{current_status} to {new_status}."
                )
            )

    # --------------------------------------------------------
    # DELIVERY TIME CHECK
    # --------------------------------------------------------

    if new_status == "delivered":

        if not is_delivery_time():

            connection.close()

            raise HTTPException(
                status_code=400,
                detail=(
                    "Delivery is available only "
                    "between 4:00 PM and 7:00 PM."
                )
            )

    current_time = now_string()

    # --------------------------------------------------------
    # COLLECTED
    # --------------------------------------------------------

    if new_status == "collected":

        connection.execute(
            """
            UPDATE laundry_orders

            SET
                status = ?,
                collected_at = ?

            WHERE order_code = ?
            """,
            (
                new_status,
                current_time,
                order_code
            )
        )

    # --------------------------------------------------------
    # WASHING
    # --------------------------------------------------------

    elif new_status == "washing":

        connection.execute(
            """
            UPDATE laundry_orders

            SET
                status = ?,
                washing_at = ?

            WHERE order_code = ?
            """,
            (
                new_status,
                current_time,
                order_code
            )
        )

    # --------------------------------------------------------
    # READY
    # --------------------------------------------------------

    elif new_status == "ready":

        connection.execute(
            """
            UPDATE laundry_orders

            SET
                status = ?,
                ready_at = ?,
                ready_notification_sent = 1

            WHERE order_code = ?
            """,
            (
                new_status,
                current_time,
                order_code
            )
        )

        # Notification
        add_notification(
            connection,

            order["register_no"],

            order_code,

            "Laundry Ready",

            (
                "Your dress is ready. "
                "Please collect it between "
                "4:00 PM and 7:00 PM."
            ),

            "ready"
        )

    # --------------------------------------------------------
    # DELIVERED
    # --------------------------------------------------------

    elif new_status == "delivered":

        connection.execute(
            """
            UPDATE laundry_orders

            SET
                status = ?,
                delivered_at = ?

            WHERE order_code = ?
            """,
            (
                new_status,
                current_time,
                order_code
            )
        )

        add_notification(
            connection,

            order["register_no"],

            order_code,

            "Laundry Delivered",

            "Your laundry order has been delivered successfully.",

            "delivered"
        )

    # --------------------------------------------------------
    # WAITING / SAME STATUS
    # --------------------------------------------------------

    else:

        connection.execute(
            """
            UPDATE laundry_orders

            SET status = ?

            WHERE order_code = ?
            """,
            (
                new_status,
                order_code
            )
        )

    connection.commit()

    updated_order = get_order(
        connection,
        order_code
    )

    connection.close()

    return {
        "success": True,

        "message":
            f"Order status updated to {new_status}.",

        "order":
            order_response(updated_order)
    }


# ============================================================
# STUDENT ORDERS
# ============================================================

@app.get("/api/student/{register_no}/orders")
def student_orders(register_no: str):

    register_no = register_no.strip().upper()

    # Check delayed orders first
    check_delayed_orders()

    connection = get_connection()

    student = get_student(
        connection,
        register_no
    )

    if student is None:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Student not found."
        )

    orders = connection.execute(
        """
        SELECT *

        FROM laundry_orders

        WHERE register_no = ?

        ORDER BY id DESC
        """,
        (register_no,)
    ).fetchall()

    result = []

    for order in orders:

        rating = connection.execute(
            """
            SELECT *

            FROM ratings

            WHERE order_code = ?
            """,
            (order["order_code"],)
        ).fetchone()

        order_data = order_response(
            get_order(
                connection,
                order["order_code"]
            )
        )

        order_data["rating"] = (
            dict(rating)
            if rating
            else None
        )

        result.append(order_data)

    connection.close()

    return {
        "success": True,
        "orders": result
    }


# ============================================================
# STUDENT NOTIFICATIONS
# ============================================================

@app.get("/api/student/{register_no}/notifications")
def student_notifications(
    register_no: str
):

    register_no = register_no.strip().upper()

    check_delayed_orders()

    connection = get_connection()

    notifications = connection.execute(
        """
        SELECT *

        FROM notifications

        WHERE register_no = ?

        ORDER BY id DESC

        LIMIT 50
        """,
        (register_no,)
    ).fetchall()

    connection.close()

    return {
        "success": True,

        "notifications": [
            dict(item)
            for item in notifications
        ]
    }


# ============================================================
# MARK NOTIFICATION READ
# ============================================================

@app.put("/api/student/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int
):

    connection = get_connection()

    connection.execute(
        """
        UPDATE notifications

        SET is_read = 1

        WHERE id = ?
        """,
        (notification_id,)
    )

    connection.commit()
    connection.close()

    return {
        "success": True
    }


# ============================================================
# CREATE RATING
# ============================================================

@app.post("/api/laundry/order/{order_code}/rating")
def create_rating(
    order_code: str,
    data: RatingCreate
):

    connection = get_connection()

    order = get_order(
        connection,
        order_code
    )

    if order is None:

        connection.close()

        raise HTTPException(
            status_code=404,
            detail="Laundry order not found."
        )

    if order["status"] != "delivered":

        connection.close()

        raise HTTPException(
            status_code=400,
            detail="You can rate the laundry only after delivery."
        )

    existing = connection.execute(
        """
        SELECT id

        FROM ratings

        WHERE order_code = ?
        """,
        (order_code,)
    ).fetchone()

    if existing:

        connection.close()

        raise HTTPException(
            status_code=400,
            detail="This order has already been rated."
        )

    overall = (
        data.washing_quality
        + data.ironing_quality
        + data.on_time_delivery
        + data.clothes_handling
        + data.behaviour
    ) / 5

    connection.execute(
        """
        INSERT INTO ratings
        (
            order_code,
            register_no,

            washing_quality,
            ironing_quality,
            on_time_delivery,
            clothes_handling,
            behaviour,

            overall_rating,
            review,

            created_at
        )

        VALUES
        (
            ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?
        )
        """,
        (
            order_code,
            order["register_no"],

            data.washing_quality,
            data.ironing_quality,
            data.on_time_delivery,
            data.clothes_handling,
            data.behaviour,

            round(overall, 1),

            data.review.strip(),

            now_string()
        )
    )

    connection.commit()
    connection.close()

    return {
        "success": True,

        "message":
            "Thank you! Your rating has been submitted.",

        "overall_rating":
            round(overall, 1)
    }


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@app.get("/api/admin/dashboard")
def admin_dashboard():

    connection = get_connection()

    stats = {}

    for status in [
        "waiting",
        "collected",
        "washing",
        "ready",
        "delivered"
    ]:

        row = connection.execute(
            """
            SELECT COUNT(*) AS count

            FROM laundry_orders

            WHERE status = ?
            """,
            (status,)
        ).fetchone()

        stats[status] = row["count"]

    total_students = connection.execute(
        """
        SELECT COUNT(*) AS count

        FROM students
        """
    ).fetchone()["count"]

    total_orders = connection.execute(
        """
        SELECT COUNT(*) AS count

        FROM laundry_orders
        """
    ).fetchone()["count"]

    connection.close()

    return {
        "success": True,

        "students": total_students,

        "orders": total_orders,

        "status": stats
    }


# ============================================================
# TODAY'S COLLECTION
# ============================================================

@app.get("/api/admin/collections/today")
def today_collection():

    today = now_ist().strftime("%Y-%m-%d")

    connection = get_connection()

    rows = connection.execute(
        """
        SELECT *

        FROM laundry_orders

        WHERE collected_at LIKE ?

        ORDER BY collected_at DESC
        """,
        (today + "%",)
    ).fetchall()

    result = []

    for row in rows:

        order = get_order(
            connection,
            row["order_code"]
        )

        result.append(
            order_response(order)
        )

    connection.close()

    return {
        "success": True,
        "date": today,
        "orders": result
    }


# ============================================================
# TOMORROW'S ORDERS
# ============================================================

@app.get("/api/admin/collections/tomorrow")
def tomorrow_collection():

    tomorrow = (
        now_ist().date()
        + timedelta(days=1)
    ).strftime("%Y-%m-%d")

    connection = get_connection()

    rows = connection.execute(
        """
        SELECT *

        FROM laundry_orders

        WHERE created_at LIKE ?

        ORDER BY created_at DESC
        """,
        (tomorrow + "%",)
    ).fetchall()

    result = []

    for row in rows:

        order = get_order(
            connection,
            row["order_code"]
        )

        result.append(
            order_response(order)
        )

    connection.close()

    return {
        "success": True,
        "date": tomorrow,
        "orders": result
    }


# ============================================================
# ADMIN RATINGS
# ============================================================

@app.get("/api/admin/ratings")
def admin_ratings():

    connection = get_connection()

    rows = connection.execute(
        """
        SELECT
            r.*,
            s.name

        FROM ratings r

        JOIN students s
        ON s.register_no = r.register_no

        ORDER BY r.id DESC
        """
    ).fetchall()

    connection.close()

    return {
        "success": True,

        "ratings": [
            dict(row)
            for row in rows
        ]
    }


# ============================================================
# ADMIN ALL ORDERS
# ============================================================

@app.get("/api/admin/orders")
def admin_orders():

    connection = get_connection()

    rows = connection.execute(
        """
        SELECT *

        FROM laundry_orders

        ORDER BY id DESC

        LIMIT 200
        """
    ).fetchall()

    result = []

    for row in rows:

        order = get_order(
            connection,
            row["order_code"]
        )

        result.append(
            order_response(order)
        )

    connection.close()

    return {
        "success": True,
        "orders": result
    }