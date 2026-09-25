const API_URL = "http://127.0.0.1:8000";

let student = null;

let quantities = {
    shirt: 0,
    pant: 0,
    tshirt: 0,
    shorts: 0,
    socks: 0,
    towel: 0,
    bedsheet: 0
};


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const saved =
            localStorage.getItem("student");

        if (!saved) {

            location.href =
                "login.html";

            return;
        }


        student =
            JSON.parse(saved);


        document.getElementById(
            "studentName"
        ).textContent =
            student.name;


        document.getElementById(
            "profileRegister"
        ).textContent =
            student.register_no;


        document.getElementById(
            "profileHostel"
        ).textContent =
            `${student.hostel} • Room ${student.room_no}`;


        updateTotal();

        loadBookingWindow();

        loadOrders();

        loadNotifications();

    }
);


// ============================================================
// LOGOUT
// ============================================================

function logoutStudent() {

    localStorage.removeItem("student");

    location.href =
        "login.html";
}


// ============================================================
// QUANTITY
// ============================================================

function changeQuantity(
    type,
    change
) {

    quantities[type] += change;

    if (quantities[type] < 0) {

        quantities[type] = 0;

    }


    document.getElementById(
        type
    ).textContent =
        quantities[type];


    updateTotal();
}


// ============================================================
// TOTAL
// ============================================================

function updateTotal() {

    const totalClothes =
        Object.values(
            quantities
        ).reduce(
            (sum, value) =>
                sum + value,
            0
        );


    const selectedService =
        document.querySelector(
            'input[name="service"]:checked'
        );


    const service =
        selectedService
            ? selectedService.value
            : "washing";


    let amount = 0;


    if (
        service === "ironing" ||
        service === "both"
    ) {

        amount =
            totalClothes * 20;

    }


    document.getElementById(
        "totalClothes"
    ).textContent =
        totalClothes;


    document.getElementById(
        "totalAmount"
    ).textContent =
        amount;
}


document
    .querySelectorAll(
        'input[name="service"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                updateTotal
            );

        }
    );


// ============================================================
// BOOKING WINDOW
// ============================================================

async function loadBookingWindow() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/booking-window`
            );


        const data =
            await response.json();


        const banner =
            document.getElementById(
                "bookingBanner"
            );

        const title =
            document.getElementById(
                "bookingTitle"
            );

        const message =
            document.getElementById(
                "bookingMessage"
            );

        const button =
            document.getElementById(
                "createOrderButton"
            );


        if (data.booking_open) {

            banner.className =
                "booking-banner booking-open";

            title.textContent =
                "Laundry booking is OPEN";

            message.textContent =
                "Book your laundry now. Booking closes at 8:30 AM.";

            button.disabled = false;

        } else {

            banner.className =
                "booking-banner booking-closed";

            title.textContent =
                "Laundry booking is CLOSED";

            message.textContent =
                "Booking is available only from 6:00 AM to 8:30 AM.";

            button.disabled = true;

        }


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// CREATE ORDER
// ============================================================

async function createOrder() {

    const message =
        document.getElementById(
            "orderMessage"
        );


    const bagNumber =
        document.getElementById(
            "bagNumber"
        ).value.trim();


    if (!/^\d{4}$/.test(bagNumber)) {

        showOrderMessage(
            "Bag number must contain exactly 4 digits.",
            "error"
        );

        return;
    }


    const total =
        Object.values(
            quantities
        ).reduce(
            (sum, value) =>
                sum + value,
            0
        );


    if (total === 0) {

        showOrderMessage(
            "Please select at least one cloth.",
            "error"
        );

        return;
    }


    const selectedService =
        document.querySelector(
            'input[name="service"]:checked'
        );


    const service =
        selectedService.value;


    const button =
        document.getElementById(
            "createOrderButton"
        );


    button.disabled = true;

    button.textContent =
        "Creating Order...";


    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/order`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            register_no:
                                student.register_no,

                            bag_number:
                                bagNumber,

                            shirt:
                                quantities.shirt,

                            pant:
                                quantities.pant,

                            tshirt:
                                quantities.tshirt,

                            shorts:
                                quantities.shorts,

                            socks:
                                quantities.socks,

                            towel:
                                quantities.towel,

                            bedsheet:
                                quantities.bedsheet,

                            service:
                                service

                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Unable to create order."
            );

        }


        const order =
            data.order;


        document.getElementById(
            "codeEmpty"
        ).style.display =
            "none";


        document.getElementById(
            "codeResult"
        ).style.display =
            "block";


        document.getElementById(
            "verificationCode"
        ).textContent =
            data.verification_code;


        document.getElementById(
            "codeBag"
        ).textContent =
            order.bag_number;


        document.getElementById(
            "codeStatus"
        ).textContent =
            "Waiting";


        showOrderMessage(
            "Laundry order created successfully!",
            "success"
        );


        await loadOrders();

        await loadNotifications();


    } catch (error) {

        showOrderMessage(
            error.message,
            "error"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Generate Laundry Code";

    }
}


// ============================================================
// ORDER MESSAGE
// ============================================================

function showOrderMessage(
    message,
    type
) {

    const box =
        document.getElementById(
            "orderMessage"
        );


    box.textContent =
        message;


    box.style.display =
        "block";


    box.className =
        "message-box " +
        (
            type === "error"
                ? "error-message"
                : "success-message"
        );
}


// ============================================================
// ORDERS
// ============================================================

async function loadOrders() {

    if (!student) return;


    try {

        const response =
            await fetch(
                `${API_URL}/api/student/${encodeURIComponent(student.register_no)}/orders`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Unable to load orders."
            );

        }


        const orders =
            data.orders || [];


        document.getElementById(
            "totalOrders"
        ).textContent =
            orders.length;


        const active =
            orders.filter(
                order =>
                    order.status !==
                    "delivered"
            ).length;


        const delivered =
            orders.filter(
                order =>
                    order.status ===
                    "delivered"
            ).length;


        const rated =
            orders.filter(
                order =>
                    order.rating
            ).length;


        document.getElementById(
            "activeOrders"
        ).textContent =
            active;


        document.getElementById(
            "deliveredOrders"
        ).textContent =
            delivered;


        document.getElementById(
            "ratingCount"
        ).textContent =
            rated;


        renderOrders(orders);


        if (orders.length > 0) {

            const latest =
                orders[0];


            document.getElementById(
                "verificationCode"
            ).textContent =
                latest.order_code;


            document.getElementById(
                "codeBag"
            ).textContent =
                latest.bag_number;


            document.getElementById(
                "codeStatus"
            ).textContent =
                formatStatus(
                    latest.status
                );


            document.getElementById(
                "codeEmpty"
            ).style.display =
                "none";


            document.getElementById(
                "codeResult"
            ).style.display =
                "block";

        }


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// RENDER ORDERS
// ============================================================

function renderOrders(orders) {

    const container =
        document.getElementById(
            "ordersList"
        );


    if (!orders.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div>🧺</div>

                <p>
                    No laundry orders yet.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        orders.map(
            order =>
                createOrderHTML(order)
        ).join("");
}


// ============================================================
// ORDER HTML
// ============================================================

function createOrderHTML(order) {

    const ratingHTML =
        order.status === "delivered" &&
        !order.rating
            ? `
                <button
                    class="rating-button"
                    onclick="openRating('${order.order_code}')">

                    ⭐ Rate this order

                </button>
              `
            : order.rating
                ? `
                    <div class="rated">
                        ⭐ ${order.rating.overall_rating}/5
                    </div>
                  `
                : "";


    return `

        <div class="order-history-card">

            <div class="order-main">

                <div class="order-code-box">

                    <span>
                        CODE
                    </span>

                    <strong>
                        ${order.order_code}
                    </strong>

                </div>


                <div>

                    <h3>
                        Bag ${order.bag_number}
                    </h3>

                    <p>
                        ${order.total_clothes}
                        clothes •
                        ${formatService(order.service)}
                    </p>

                </div>

            </div>


            <div class="order-status-area">

                <span class="
                    status-badge
                    ${order.status}
                ">

                    ${formatStatus(order.status)}

                </span>

                <small>
                    ${order.created_at}
                </small>

                ${ratingHTML}

            </div>


            <div class="mini-timeline">

                <span class="${timelineClass(order.status, "waiting")}">
                    Waiting
                </span>

                <span class="${timelineClass(order.status, "collected")}">
                    Collected
                </span>

                <span class="${timelineClass(order.status, "washing")}">
                    Washing
                </span>

                <span class="${timelineClass(order.status, "ready")}">
                    Ready
                </span>

                <span class="${timelineClass(order.status, "delivered")}">
                    Delivered
                </span>

            </div>

        </div>

    `;
}


// ============================================================
// STATUS
// ============================================================

function formatStatus(status) {

    const names = {

        waiting: "🟠 Waiting",

        collected: "🔴 Collected",

        washing: "🔵 Washing",

        ready: "🟢 Ready",

        delivered: "✅ Delivered"

    };


    return names[status] ||
        status;
}


function formatService(service) {

    const names = {

        washing: "Washing",

        ironing: "Ironing",

        both: "Wash + Iron"

    };


    return names[service] ||
        service;
}


function timelineClass(
    current,
    step
) {

    const order = [
        "waiting",
        "collected",
        "washing",
        "ready",
        "delivered"
    ];


    const currentIndex =
        order.indexOf(current);

    const stepIndex =
        order.indexOf(step);


    return stepIndex <= currentIndex
        ? "timeline-step active"
        : "timeline-step";

}


// ============================================================
// NOTIFICATIONS
// ============================================================

async function loadNotifications() {

    if (!student) return;


    try {

        const response =
            await fetch(
                `${API_URL}/api/student/${encodeURIComponent(student.register_no)}/notifications`
            );


        const data =
            await response.json();


        if (!response.ok) return;


        const notifications =
            data.notifications || [];


        const unread =
            notifications.filter(
                n => n.is_read === 0
            ).length;


        document.getElementById(
            "notificationCount"
        ).textContent =
            unread;


        renderNotifications(
            notifications
        );


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// RENDER NOTIFICATIONS
// ============================================================

function renderNotifications(
    notifications
) {

    const container =
        document.getElementById(
            "notificationsList"
        );


    if (!notifications.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div>🔔</div>

                <p>
                    No notifications yet.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        notifications.map(
            notification => `

                <div class="
                    notification-item
                    ${notification.is_read ? "read" : "unread"}
                ">

                    <div class="notification-icon">
                        ${getNotificationIcon(
                            notification.notification_type
                        )}
                    </div>

                    <div>

                        <strong>
                            ${notification.title}
                        </strong>

                        <p>
                            ${notification.message}
                        </p>

                        <small>
                            ${notification.created_at}
                        </small>

                    </div>

                </div>

            `
        ).join("");
}


function getNotificationIcon(
    type
) {

    if (type === "ready")
        return "🟢";

    if (type === "delay")
        return "⚠️";

    if (type === "delivered")
        return "✅";

    return "🔔";
}


// ============================================================
// RATING
// ============================================================

function openRating(orderCode) {

    const rating =
        prompt(
            "Enter your overall rating from 1 to 5:"
        );


    if (!rating) return;


    const value =
        Number(rating);


    if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
    ) {

        alert(
            "Please enter a rating between 1 and 5."
        );

        return;
    }


    submitSimpleRating(
        orderCode,
        value
    );
}


async function submitSimpleRating(
    orderCode,
    value
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/order/${orderCode}/rating`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            washing_quality:
                                value,

                            ironing_quality:
                                value,

                            on_time_delivery:
                                value,

                            clothes_handling:
                                value,

                            behaviour:
                                value,

                            review:
                                ""

                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Unable to submit rating."
            );

        }


        alert(
            "Thank you! Your rating has been submitted."
        );


        loadOrders();


    } catch (error) {

        alert(error.message);

    }
}


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    () => {

        if (student) {

            loadOrders();

            loadNotifications();

            loadBookingWindow();

        }

    },
    15000
);