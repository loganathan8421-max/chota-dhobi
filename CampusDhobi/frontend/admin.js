const API_URL = "http://127.0.0.1:8000";

let verifiedOrder = null;


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            localStorage.getItem(
                "adminLoggedIn"
            ) !== "true"
        ) {

            location.href =
                "admin-login.html";

            return;
        }


        loadDashboard();

        loadTodayCollection();

        loadTomorrowOrders();

        loadRatings();

    }
);


// ============================================================
// LOGOUT
// ============================================================

function logoutAdmin() {

    localStorage.removeItem(
        "adminLoggedIn"
    );

    location.href =
        "admin-login.html";
}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/dashboard`
            );


        const data =
            await response.json();


        if (!response.ok) return;


        document.getElementById(
            "studentCount"
        ).textContent =
            data.students;


        document.getElementById(
            "waitingCount"
        ).textContent =
            data.status.waiting;


        document.getElementById(
            "washingCount"
        ).textContent =
            data.status.washing;


        document.getElementById(
            "readyCount"
        ).textContent =
            data.status.ready;


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// VERIFY CODE
// ============================================================

async function verifyCode() {

    const input =
        document.getElementById(
            "verificationCode"
        );


    const code =
        input.value.trim();


    if (!/^\d{6}$/.test(code)) {

        showVerifyMessage(
            "Enter a valid 6-digit verification code.",
            "error"
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/verify/${code}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Code not found."
            );

        }


        verifiedOrder =
            data.order;


        displayVerifiedOrder(
            verifiedOrder
        );


        showVerifyMessage(
            "Code verified successfully.",
            "success"
        );


    } catch (error) {

        document.getElementById(
            "verifiedOrder"
        ).style.display =
            "none";


        showVerifyMessage(
            error.message,
            "error"
        );

    }
}


// ============================================================
// DISPLAY ORDER
// ============================================================

function displayVerifiedOrder(
    order
) {

    document.getElementById(
        "verifiedOrder"
    ).style.display =
        "block";


    document.getElementById(
        "verifiedStudent"
    ).textContent =
        order.student.name;


    document.getElementById(
        "verifiedRegister"
    ).textContent =
        order.register_no;


    document.getElementById(
        "verifiedPhone"
    ).textContent =
        order.student.phone;


    document.getElementById(
        "verifiedHostel"
    ).textContent =
        order.student.hostel;


    document.getElementById(
        "verifiedRoom"
    ).textContent =
        order.student.room_no;


    document.getElementById(
        "verifiedBag"
    ).textContent =
        order.bag_number;


    document.getElementById(
        "verifiedTotal"
    ).textContent =
        order.total_clothes;


    document.getElementById(
        "verifiedStatus"
    ).textContent =
        formatStatus(order.status);


    document.getElementById(
        "verifiedStatus"
    ).className =
        `status-badge ${order.status}`;


    const clothes =
        order.clothes;


    const parts = [];


    if (clothes.shirt > 0)
        parts.push(
            `Shirt: ${clothes.shirt}`
        );


    if (clothes.pant > 0)
        parts.push(
            `Pant: ${clothes.pant}`
        );


    if (clothes.tshirt > 0)
        parts.push(
            `T-Shirt: ${clothes.tshirt}`
        );


    if (clothes.shorts > 0)
        parts.push(
            `Shorts: ${clothes.shorts}`
        );


    if (clothes.socks > 0)
        parts.push(
            `Socks: ${clothes.socks}`
        );


    if (clothes.towel > 0)
        parts.push(
            `Towel: ${clothes.towel}`
        );


    if (clothes.bedsheet > 0)
        parts.push(
            `Bedsheet: ${clothes.bedsheet}`
        );


    document.getElementById(
        "verifiedClothes"
    ).textContent =
        parts.join(" • ");


    updateActionButtons(
        order.status
    );
}


// ============================================================
// STATUS BUTTONS
// ============================================================

function updateActionButtons(
    status
) {

    const buttons = {

        collected:
            document.getElementById(
                "collectButton"
            ),

        washing:
            document.getElementById(
                "washingButton"
            ),

        ready:
            document.getElementById(
                "readyButton"
            ),

        delivered:
            document.getElementById(
                "deliveredButton"
            )

    };


    Object.values(buttons)
        .forEach(
            button =>
                button.disabled = true
        );


    if (status === "waiting") {

        buttons.collected.disabled =
            false;

    }


    if (status === "collected") {

        buttons.washing.disabled =
            false;

    }


    if (status === "washing") {

        buttons.ready.disabled =
            false;

    }


    if (status === "ready") {

        buttons.delivered.disabled =
            false;

    }

}


// ============================================================
// UPDATE STATUS
// ============================================================

async function updateStatus(
    newStatus
) {

    if (!verifiedOrder) {

        alert(
            "Verify an order first."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/laundry/order/${verifiedOrder.order_code}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status:
                                newStatus
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Unable to update status."
            );

        }


        verifiedOrder =
            data.order;


        displayVerifiedOrder(
            verifiedOrder
        );


        showVerifyMessage(
            `Order updated to ${newStatus}.`,
            "success"
        );


        loadDashboard();

        loadTodayCollection();

        loadTomorrowOrders();


    } catch (error) {

        showVerifyMessage(
            error.message,
            "error"
        );

    }
}


// ============================================================
// TODAY
// ============================================================

async function loadTodayCollection() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/collections/today`
            );


        const data =
            await response.json();


        if (!response.ok) return;


        const container =
            document.getElementById(
                "todayCollection"
            );


        if (!data.orders.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <div>🧺</div>
                    <p>No collected orders today.</p>
                </div>
            `;

            return;
        }


        container.innerHTML =
            data.orders
                .map(
                    order =>
                        adminOrderHTML(order)
                )
                .join("");


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// TOMORROW
// ============================================================

async function loadTomorrowOrders() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/collections/tomorrow`
            );


        const data =
            await response.json();


        if (!response.ok) return;


        const container =
            document.getElementById(
                "tomorrowOrders"
            );


        if (!data.orders.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <div>📅</div>
                    <p>No orders scheduled for tomorrow.</p>
                </div>
            `;

            return;
        }


        container.innerHTML =
            data.orders
                .map(
                    order =>
                        adminOrderHTML(order)
                )
                .join("");


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// ADMIN ORDER CARD
// ============================================================

function adminOrderHTML(order) {

    return `

        <div class="admin-order-card">

            <div>

                <strong>
                    ${order.student.name}
                </strong>

                <span>
                    ${order.register_no}
                </span>

            </div>


            <div>

                <span>
                    Bag
                </span>

                <strong>
                    ${order.bag_number}
                </strong>

            </div>


            <div>

                <span>
                    Clothes
                </span>

                <strong>
                    ${order.total_clothes}
                </strong>

            </div>


            <span class="
                status-badge
                ${order.status}
            ">

                ${formatStatus(order.status)}

            </span>

        </div>

    `;
}


// ============================================================
// RATINGS
// ============================================================

async function loadRatings() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/admin/ratings`
            );


        const data =
            await response.json();


        if (!response.ok) return;


        const container =
            document.getElementById(
                "ratingsList"
            );


        if (!data.ratings.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <div>⭐</div>
                    <p>No ratings yet.</p>
                </div>
            `;

            return;
        }


        container.innerHTML =
            data.ratings
                .map(
                    rating => `

                        <div class="rating-admin-card">

                            <div>

                                <strong>
                                    ${rating.name}
                                </strong>

                                <small>
                                    ${rating.register_no}
                                </small>

                            </div>

                            <div class="big-rating">
                                ⭐
                                ${rating.overall_rating}/5
                            </div>

                            <p>
                                ${rating.review || "No review"}
                            </p>

                        </div>

                    `
                )
                .join("");


    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// MESSAGE
// ============================================================

function showVerifyMessage(
    message,
    type
) {

    const box =
        document.getElementById(
            "verifyMessage"
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
// STATUS TEXT
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


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    () => {

        loadDashboard();

        loadTodayCollection();

        loadTomorrowOrders();

    },
    15000
);