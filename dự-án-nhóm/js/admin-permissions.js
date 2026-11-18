const adminActionButtons = [
    "#openRuleDialog",
    "#saveRuleButton",
    "#rulesContainer [data-action='edit-rule']",
    "#openMemberDialog",
    "#saveMemberButton",
    "#editProfileMember",
    "#openNotificationDialog",
    "#notificationForm button[type='submit']",
].join(", ");
const adminForms = "#ruleForm, #memberForm, #notificationForm";
const permissionStatus = document.querySelector(
    "#ruleStatus, #memberStatus, #notificationStatus",
);

let currentRole = null;
let roleCheckFailed = false;

function showPermissionMessage(message) {
    if (permissionStatus) {
        permissionStatus.textContent = message;
        permissionStatus.classList.add("permission-error");
        permissionStatus.setAttribute("role", "alert");
        permissionStatus.setAttribute("aria-live", "assertive");
        return;
    }

    window.alert(message);
}

function denyUnlessAdmin(event) {
    if (currentRole === "admin") {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    showPermissionMessage(
        roleCheckFailed
            ? "Không thể xác minh quyền. Vui lòng tải lại trang."
            : currentRole === "user"
                ? "Bạn không có quyền thực hiện việc này."
                : "Đang xác minh quyền. Vui lòng thử lại.",
    );
}

document.addEventListener("click", function(event) {
    if (!(event.target instanceof Element) || !event.target.closest(adminActionButtons)) {
        return;
    }
    denyUnlessAdmin(event);
}, true);

document.addEventListener("submit", function(event) {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches(adminForms)) {
        return;
    }
    denyUnlessAdmin(event);
}, true);

fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
})
    .then(function(response) {
        if (!response.ok) {
            throw new Error("Không thể đọc quyền tài khoản.");
        }
        return response.json();
    })
    .then(function(user) {
        if (user.role !== "admin" && user.role !== "user") {
            throw new Error("Quyền tài khoản không hợp lệ.");
        }
        currentRole = user.role;
    })
    .catch(function(error) {
        roleCheckFailed = true;
        console.error("Không thể xác minh quyền quản lý:", error);
    });
