const notificationList = document.querySelector(".notification-list");
const notificationStatus = document.getElementById("notificationStatus");
const notificationSyncStatus = document.getElementById("notificationSyncStatus");
const notificationCount = document.getElementById("notificationCount");
const loadMoreNotifications = document.getElementById("loadMoreNotifications");
const openNotificationDialog = document.getElementById("openNotificationDialog");
const notificationDialog = document.getElementById("notificationDialog");
const notificationForm = document.getElementById("notificationForm");
const notificationFormMessage = document.getElementById("notificationFormMessage");
const notificationTitleInput = document.getElementById("newNotificationTitle");
const notificationStorageKey = "orange_house_notifications";

let addedNotifications = [];
let serverNotifications = [];
let serverTotalCount = 0;
let serverHasMore = false;
let loadingServerNotifications = false;
let loadingOlderNotifications = false;

function isValidNotification(notification) {
    return notification
        && typeof notification.id === "string"
        && typeof notification.title === "string"
        && typeof notification.category === "string"
        && typeof notification.description === "string"
        && typeof notification.createdAt === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(notification.createdAt);
}

function loadNotifications() {
    try {
        const storedNotifications = localStorage.getItem(notificationStorageKey);
        if (storedNotifications === null) {
            return [];
        }

        const parsedNotifications = JSON.parse(storedNotifications);
        if (parsedNotifications && parsedNotifications.version === 1
            && Array.isArray(parsedNotifications.notifications)
            && parsedNotifications.notifications.every(isValidNotification)) {
            return parsedNotifications.notifications;
        }

        throw new Error("Dữ liệu thông báo không đúng định dạng.");
    } catch (error) {
        notificationStatus.textContent = "Không thể tải thông báo đã lưu trong trình duyệt.";
        console.error("Không thể đọc dữ liệu thông báo:", error);
        return [];
    }
}

function createNotificationCard(notification) {
    const card = document.createElement("details");
    card.className = "notification-card is-new";
    if (notification.source === "server") {
        card.dataset.serverNotification = "true";
    } else {
        card.dataset.addedNotification = "true";
    }

    const summary = document.createElement("summary");
    summary.className = "notification-summary";

    const categoryIcon = notification.category === "Cộng đồng"
        ? { className: "icon-group", text: "👥" }
        : notification.category === "Diễn đàn"
            ? { className: "icon-forum", text: "💬" }
            : { className: "icon-event", text: "🔔" };
    const icon = document.createElement("span");
    icon.className = "notification-icon " + categoryIcon.className;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = categoryIcon.text;

    const content = document.createElement("span");
    content.className = "notification-content";

    const meta = document.createElement("span");
    meta.className = "notification-meta";

    const category = document.createElement("span");
    category.className = "notification-category";
    category.textContent = notification.category || "Thông báo";

    const newLabel = document.createElement("span");
    newLabel.className = "new-label";
    const newDot = document.createElement("span");
    newLabel.appendChild(newDot);
    newLabel.appendChild(document.createTextNode("Mới"));
    meta.appendChild(category);
    meta.appendChild(newLabel);

    const title = document.createElement("span");
    title.className = "notification-title";
    title.textContent = notification.title;

    const time = document.createElement("time");
    time.dateTime = notification.createdAt;
    const dateToDisplay = new Date(
        notification.createdAt.length === 10
            ? notification.createdAt + "T00:00:00"
            : notification.createdAt,
    );
    time.textContent = dateToDisplay.toLocaleDateString("vi-VN");

    content.appendChild(meta);
    content.appendChild(title);
    content.appendChild(time);

    const arrow = document.createElement("span");
    arrow.className = "notification-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";

    summary.appendChild(icon);
    summary.appendChild(content);
    summary.appendChild(arrow);

    const details = document.createElement("div");
    details.className = "notification-details";
    const description = document.createElement("p");
    description.textContent = notification.description;
    details.appendChild(description);

    card.appendChild(summary);
    card.appendChild(details);
    return card;
}

function renderNotifications() {
    notificationList.querySelectorAll(
        "[data-added-notification], [data-server-notification]",
    ).forEach(function(card) {
        card.remove();
    });

    const dynamicNotifications = addedNotifications.concat(serverNotifications).sort(function(a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    dynamicNotifications.reverse().forEach(function(notification) {
        notificationList.prepend(createNotificationCard(notification));
    });

    const staticCount = notificationList.querySelectorAll(
        ".notification-card:not([data-added-notification]):not([data-server-notification])",
    ).length;
    const total = staticCount + addedNotifications.length + serverTotalCount;
    notificationCount.textContent = String(total).padStart(2, "0") + " thông báo";
    loadMoreNotifications.hidden = !serverHasMore;
}

function closeNotificationDialog() {
    notificationDialog.close();
}

openNotificationDialog.addEventListener("click", function() {
    notificationForm.reset();
    notificationFormMessage.textContent = "";
    document.getElementById("newNotificationCategory").value = "Thông báo";
    notificationDialog.showModal();
    notificationTitleInput.focus();
});

document.getElementById("closeNotificationDialog").addEventListener("click", closeNotificationDialog);
document.getElementById("cancelNotification").addEventListener("click", closeNotificationDialog);

notificationDialog.addEventListener("click", function(event) {
    if (event.target === notificationDialog) {
        const bounds = notificationDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            closeNotificationDialog();
        }
    }
});

notificationDialog.addEventListener("close", function() {
    openNotificationDialog.focus();
});

notificationForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = notificationForm.elements.title.value.trim();
    const category = notificationForm.elements.category.value.trim() || "Thông báo";
    const description = notificationForm.elements.description.value.trim();

    if (!title || !description) {
        notificationFormMessage.textContent = "Vui lòng nhập tiêu đề và nội dung thông báo.";
        return;
    }
    const submitButton = notificationForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    notificationFormMessage.textContent = "";

    try {
        const newNotification = await createServerNotification({
            title: title,
            category: category,
            description: description
        });
        const alreadyLoaded = serverNotifications.some(function(item) {
            return item.serverId === newNotification.serverId;
        });
        mergeServerNotifications([newNotification]);
        if (!alreadyLoaded) {
            serverTotalCount += 1;
        }
        renderNotifications();
        notificationSyncStatus.textContent = "";
        notificationStatus.textContent = "Đã lưu thông báo lên máy chủ.";
        notificationForm.reset();
        notificationDialog.close();
    } catch (error) {
        notificationFormMessage.textContent = error.message || "Không thể lưu thông báo.";
        console.error("Không thể tạo thông báo:", error);
    } finally {
        submitButton.disabled = false;
    }
});

addedNotifications = loadNotifications();
renderNotifications();

function mapServerNotification(notification) {
    if (!notification
        || !Number.isInteger(notification.id)
        || typeof notification.category !== "string"
        || typeof notification.title !== "string"
        || typeof notification.description !== "string"
        || typeof notification.created_at !== "string"
        || Number.isNaN(new Date(notification.created_at).getTime())) {
        throw new Error("Dữ liệu thông báo từ máy chủ không hợp lệ.");
    }

    return {
        id: "server-" + notification.id,
        serverId: notification.id,
        category: notification.category,
        title: notification.title,
        description: notification.description,
        createdAt: notification.created_at,
        source: "server"
    };
}

function mergeServerNotifications(notifications) {
    const notificationsById = new Map(
        serverNotifications.map(function(notification) {
            return [notification.serverId, notification];
        }),
    );
    notifications.forEach(function(notification) {
        notificationsById.set(notification.serverId, notification);
    });
    serverNotifications = Array.from(notificationsById.values());
}

async function fetchNotificationPage(query) {
    const response = await fetch("/api/notifications" + query, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
    });
    if (!response.ok) {
        throw new Error("Máy chủ không thể tải thông báo mới.");
    }

    const result = await response.json();
    if (!result || !Array.isArray(result.items)
        || !Number.isInteger(result.total_count)
        || typeof result.has_more !== "boolean") {
        throw new Error("Dữ liệu thông báo từ máy chủ không hợp lệ.");
    }

    return {
        notifications: result.items.map(mapServerNotification),
        totalCount: result.total_count
    };
}

async function createServerNotification(payload) {
    const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });
    if (!csrfResponse.ok) {
        throw new Error("Không thể xác thực yêu cầu tạo thông báo.");
    }

    const csrfResult = await csrfResponse.json();
    if (typeof csrfResult.csrf_token !== "string") {
        throw new Error("Máy chủ không cấp được mã xác thực.");
    }

    const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfResult.csrf_token
        },
        body: JSON.stringify(payload)
    });
    let result;
    try {
        result = await response.json();
    } catch (error) {
        console.error("Máy chủ trả về dữ liệu thông báo không hợp lệ:", error);
        throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
    }
    if (!response.ok) {
        const detail = Array.isArray(result.detail)
            ? result.detail.map(function(item) { return item.msg; }).join(" ")
            : result.detail;
        throw new Error(detail || "Không thể lưu thông báo.");
    }

    return mapServerNotification(result);
}

async function loadServerNotifications() {
    if (loadingServerNotifications) {
        return;
    }
    loadingServerNotifications = true;

    try {
        const page = await fetchNotificationPage("?limit=30");
        mergeServerNotifications(page.notifications);
        serverTotalCount = page.totalCount;
        serverHasMore = serverNotifications.length < serverTotalCount;
        renderNotifications();
        notificationSyncStatus.textContent = "";
    } catch (error) {
        notificationSyncStatus.textContent = "Không thể cập nhật thông báo mới từ máy chủ.";
        console.error("Không thể cập nhật thông báo:", error);
    } finally {
        loadingServerNotifications = false;
    }
}

async function loadOlderNotifications() {
    if (loadingOlderNotifications || !serverHasMore || serverNotifications.length === 0) {
        return;
    }
    loadingOlderNotifications = true;
    loadMoreNotifications.disabled = true;
    loadMoreNotifications.textContent = "Đang tải...";

    try {
        const oldestId = Math.min(...serverNotifications.map(function(notification) {
            return notification.serverId;
        }));
        const page = await fetchNotificationPage(
            "?before_id=" + encodeURIComponent(oldestId) + "&limit=30",
        );
        mergeServerNotifications(page.notifications);
        serverTotalCount = page.totalCount;
        serverHasMore = serverNotifications.length < serverTotalCount;
        renderNotifications();
        notificationSyncStatus.textContent = "";
    } catch (error) {
        notificationSyncStatus.textContent = "Không thể tải các thông báo cũ hơn.";
        console.error("Không thể tải thêm thông báo:", error);
    } finally {
        loadingOlderNotifications = false;
        loadMoreNotifications.disabled = false;
        loadMoreNotifications.textContent = "Tải thêm thông báo cũ";
    }
}

loadMoreNotifications.addEventListener("click", loadOlderNotifications);
loadServerNotifications();
window.setInterval(function() {
    if (document.visibilityState === "visible") {
        loadServerNotifications();
    }
}, 15000);
document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") {
        loadServerNotifications();
    }
});
