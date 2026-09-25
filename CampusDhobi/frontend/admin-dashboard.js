const API_URL =
    "http://127.0.0.1:8000";


let currentOrder = null;

let currentDateMode = "today";


// ============================================================
// CHECK ADMIN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const admin =
            localStorage.getItem("admin");

        if (!admin) {

            window.location.href =
                "admin-login.html";

            return;
        }

        showToday();

    }
);


// ============================================================
// VERIFY STUDENT
// ============================================================

async function verifyStudent() {

    const input =
        document.getElementById(
            "verificationCode"
        );

    const message =
        document.getElementById(
            "verifyMessage"
        );

    const code =
        input.value.trim();


    if (
        !code ||
        code.length !== 6
    ) {

        message.style.color =
            "#dc2626";

        message.innerText =
            "Enter the 6-digit verification code.";

        return;
    }


    message.style.color =
        "#2563eb";

    message.innerText =
        "Verifying student...";


    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/verify-code`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        verification_code:
                            code
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            message.style.color =
                "#dc2626";

            message.innerText =
                data.detail ||
                "Invalid verification code.";

            hideStudent();

            return;
        }


        currentOrder =
            data.order;


        displayStudent(
            currentOrder
        );


        message.style.color =
            "#16a34a";

        message.innerText =
            "Student verified successfully.";


    } catch (error) {

        console.error(error);

        message.style.color =
            "#dc2626";

        message.innerText =
            "Cannot connect to server.";

    }

}


// ============================================================
// DISPLAY STUDENT
// ============================================================

function displayStudent(order) {

    document
        .getElementById("studentCard")
        .classList.add("show");


    document
        .getElementById("studentName")
        .innerText =
        order.name;


    document
        .getElementById("studentRegister")
        .innerText =
        "Register Number: "
        + order.register_no;


    document
        .getElementById("studentPhone")
        .innerText =
        order.phone;


    document
        .getElementById("studentHostel")
        .innerText =
        order.hostel;


    document
        .getElementById("studentRoom")
        .innerText =
        order.room_no;


    document
        .getElementById("orderId")
        .innerText =
        order.order_id;


    document
        .getElementById("bagNumber")
        .innerText =
        order.bag_number;


    document
        .getElementById("shirt")
        .innerText =
        order.shirt;


    document
        .getElementById("pant")
        .innerText =
        order.pant;


    document
        .getElementById("tshirt")
        .innerText =
        order.tshirt;


    document
        .getElementById("shorts")
        .innerText =
        order.shorts;


    document
        .getElementById("socks")
        .innerText =
        order.socks;


    document
        .getElementById("towel")
        .innerText =
        order.towel;


    document
        .getElementById("bedsheet")
        .innerText =
        order.bedsheet;


    document
        .getElementById("totalClothes")
        .innerText =
        order.total_clothes;


    document
        .getElementById("service")
        .innerText =
        getServiceText(
            order.service
        );


    document
        .getElementById("amount")
        .innerText =
        "💰 Amount: ₹"
        + order.total_amount;


    updateCurrentStatus(
        order.status
    );

}


// ============================================================
// SERVICE TEXT
// ============================================================

function getServiceText(service) {

    if (service === "washing") {

        return "🧼 Washing — FREE";

    }

    if (service === "ironing") {

        return "👔 Ironing — ₹20 / cloth";

    }

    if (service === "both") {

        return "🧺 Washing + Ironing — ₹20 / cloth";

    }

    return service;
}


// ============================================================
// STATUS TEXT
// ============================================================

function updateCurrentStatus(status) {

    const element =
        document.getElementById(
            "currentStatus"
        );


    const names = {

        waiting:
            "🟠 Waiting",

        collected:
            "🟠 Collected",

        washing:
            "🔵 Washing",

        ready:
            "🟢 Ready — Student Can Collect",

        delivered:
            "✅ Delivered"

    };


    element.innerText =
        "Status: "
        + (
            names[status]
            || status
        );

}


// ============================================================
// UPDATE STATUS
// ============================================================

async function updateStatus(status) {

    if (!currentOrder) {

        alert(
            "Please verify a student first."
        );

        return;
    }


    const confirmMessage =
        "Change "
        + currentOrder.name
        + "'s laundry status to "
        + status
        + "?";


    if (!confirm(confirmMessage)) {

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/order/${currentOrder.order_id}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: status
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Status update failed."
            );

            return;
        }


        currentOrder.status =
            status;


        updateCurrentStatus(
            status
        );


        if (status === "ready") {

            alert(
                "✅ Laundry marked READY.\n\n"
                + "Student notification created.\n\n"
                + "Phone: "
                + currentOrder.phone
            );

        } else {

            alert(
                "Status changed to "
                + status
            );

        }


        loadOrders();

    } catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }

}


// ============================================================
// TODAY
// ============================================================

function showToday() {

    currentDateMode =
        "today";


    document
        .getElementById("todayButton")
        .classList.add("active");


    document
        .getElementById("tomorrowButton")
        .classList.remove("active");


    loadOrders();

}


// ============================================================
// TOMORROW
// ============================================================

function showTomorrow() {

    currentDateMode =
        "tomorrow";


    document
        .getElementById("tomorrowButton")
        .classList.add("active");


    document
        .getElementById("todayButton")
        .classList.remove("active");


    loadOrders();

}


// ============================================================
// GET INDIA DATE
// ============================================================

function getIndiaDate(
    addDays = 0
) {

    const now =
        new Date();


    const indiaString =
        now.toLocaleString(
            "en-US",
            {
                timeZone:
                    "Asia/Kolkata"
            }
        );


    const indiaDate =
        new Date(
            indiaString
        );


    indiaDate.setDate(
        indiaDate.getDate()
        + addDays
    );


    const year =
        indiaDate.getFullYear();


    const month =
        String(
            indiaDate.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            indiaDate.getDate()
        ).padStart(2, "0");


    return (
        year
        + "-"
        + month
        + "-"
        + day
    );

}


// ============================================================
// LOAD ORDERS
// ============================================================

async function loadOrders() {

    const list =
        document.getElementById(
            "ordersList"
        );


    list.innerHTML =
        `
        <div class="empty">
            Loading students...
        </div>
        `;


    const date =
        currentDateMode === "today"
            ? getIndiaDate(0)
            : getIndiaDate(1);


    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/orders/date/${date}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            list.innerHTML =
                `
                <div class="empty">
                    Unable to load orders.
                </div>
                `;

            return;
        }


        renderOrders(
            data.orders
        );


    } catch (error) {

        console.error(error);

        list.innerHTML =
            `
            <div class="empty">
                Cannot connect to CampusDhobi server.
            </div>
            `;

    }

}


// ============================================================
// RENDER ORDERS
// ============================================================

function renderOrders(
    orders
) {

    const list =
        document.getElementById(
            "ordersList"
        );


    if (
        !orders ||
        orders.length === 0
    ) {

        list.innerHTML =
            `
            <div class="empty">
                🧺 No laundry students for this date.
            </div>
            `;

        return;
    }


    list.innerHTML =
        orders.map(
            order => {

                return `
                    <div class="order-row">

                        <div>

                            <div class="order-name">
                                ${escapeHtml(order.name)}
                            </div>

                            <div class="order-small">
                                ${escapeHtml(order.register_no)}
                            </div>

                        </div>


                        <div>

                            <span class="bag-small">
                                ${escapeHtml(order.bag_number || "-")}
                            </span>

                            <div class="order-small">
                                Bag Number
                            </div>

                        </div>


                        <div>

                            📱 ${escapeHtml(order.phone)}

                            <div class="order-small">
                                Phone
                            </div>

                        </div>


                        <div>

                            ${order.total_clothes} clothes

                            <div class="order-small">
                                ${escapeHtml(order.order_id)}
                            </div>

                        </div>


                        <div>

                            <span class="status-badge ${getStatusClass(order.status)}">

                                ${getStatusText(order.status)}

                            </span>

                        </div>


                        <div class="quick-actions">

                            <button
                                class="quick"
                                onclick="quickStatus('${order.order_id}', 'collected')"
                            >
                                🟠 Collect
                            </button>

                            <button
                                class="quick"
                                onclick="quickStatus('${order.order_id}', 'washing')"
                            >
                                🔵 Wash
                            </button>

                            <button
                                class="quick"
                                onclick="quickStatus('${order.order_id}', 'ready')"
                            >
                                🟢 Ready
                            </button>

                            <button
                                class="quick"
                                onclick="quickStatus('${order.order_id}', 'delivered')"
                            >
                                ✅ Done
                            </button>

                        </div>

                    </div>
                `;

            }
        ).join("");

}


// ============================================================
// QUICK STATUS
// ============================================================

async function quickStatus(
    orderId,
    status
) {

    if (
        !confirm(
            "Change status to "
            + status
            + "?"
        )
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/order/${orderId}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: status
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Status update failed."
            );

            return;
        }


        if (status === "ready") {

            alert(
                "🟢 Laundry ready.\n"
                + "Student notification created."
            );

        }


        loadOrders();


    } catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }

}


// ============================================================
// STATUS CLASS
// ============================================================

function getStatusClass(
    status
) {

    return (
        "status-"
        + status
    );

}


// ============================================================
// STATUS TEXT
// ============================================================

function getStatusText(
    status
) {

    const values = {

        waiting:
            "🟠 Waiting",

        collected:
            "🟠 Collected",

        washing:
            "🔵 Washing",

        ready:
            "🟢 Ready",

        delivered:
            "✅ Delivered"

    };


    return (
        values[status]
        || status
    );

}


// ============================================================
// HIDE STUDENT
// ============================================================

function hideStudent() {

    document
        .getElementById(
            "studentCard"
        )
        .classList.remove("show");

    currentOrder = null;

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem(
        "admin"
    );

    window.location.href =
        "index.html";

}


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    function () {

        loadOrders();

    },
    15000
);