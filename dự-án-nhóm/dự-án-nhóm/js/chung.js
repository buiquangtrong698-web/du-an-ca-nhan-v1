
const duongDanHienTai = window.location.pathname;
const header = document.querySelector(".header");
const navbar = document.querySelector(".navbar");
let accountButton = null;
let accountPanel = null;
let mobileAccountButton = null;
let accountSummaryLoaded = false;
let accountSummaryLoading = false;
let accountTriggerForFocus = null;
let mobileMenuElement = null;
let setAccountPanelOpen = null;

if (navbar instanceof HTMLElement && !navbar.querySelector(".account-link")) {
    accountButton = document.createElement("button");
    accountButton.className = "account-link";
    accountButton.type = "button";
    accountButton.textContent = "Tài khoản";
    accountButton.setAttribute("aria-expanded", "false");
    accountButton.setAttribute("aria-controls", "account-panel");
    navbar.append(accountButton);

    accountPanel = document.createElement("section");
    accountPanel.className = "account-panel";
    accountPanel.id = "account-panel";
    accountPanel.hidden = true;
    accountPanel.setAttribute("aria-label", "Thông tin tài khoản");

    const accountPanelHeader = document.createElement("div");
    accountPanelHeader.className = "account-panel-header";

    const accountPanelTitle = document.createElement("h2");
    accountPanelTitle.textContent = "Thông tin tài khoản";

    const closeAccountPanel = document.createElement("button");
    closeAccountPanel.className = "account-panel-close";
    closeAccountPanel.type = "button";
    closeAccountPanel.setAttribute("aria-label", "Đóng thông tin tài khoản");
    closeAccountPanel.textContent = "×";

    accountPanelHeader.append(accountPanelTitle, closeAccountPanel);

    const accountPanelUser = document.createElement("div");
    accountPanelUser.className = "account-panel-user";

    const accountPanelAvatar = document.createElement("span");
    accountPanelAvatar.className = "account-panel-avatar";
    accountPanelAvatar.setAttribute("aria-hidden", "true");

    const accountPanelAvatarFallback = document.createElement("span");
    accountPanelAvatarFallback.className = "account-panel-avatar-fallback";
    accountPanelAvatarFallback.textContent = "🍊";

    const accountPanelAvatarImage = document.createElement("img");
    accountPanelAvatarImage.className = "account-panel-avatar-image";
    accountPanelAvatarImage.alt = "";
    accountPanelAvatarImage.hidden = true;
    accountPanelAvatar.append(accountPanelAvatarFallback, accountPanelAvatarImage);

    const accountPanelIdentity = document.createElement("div");
    accountPanelIdentity.className = "account-panel-identity";

    const accountDisplayName = document.createElement("strong");
    accountDisplayName.className = "account-panel-display-name";
    accountDisplayName.textContent = "Đang tải...";

    const accountUsername = document.createElement("span");
    accountUsername.className = "account-panel-username";

    const accountAvatarButton = document.createElement("button");
    accountAvatarButton.className = "account-panel-avatar-upload";
    accountAvatarButton.type = "button";
    accountAvatarButton.textContent = "Đổi ảnh";
    accountAvatarButton.hidden = true;

    const accountAvatarInput = document.createElement("input");
    accountAvatarInput.type = "file";
    accountAvatarInput.accept = "image/png,image/jpeg,image/webp";
    accountAvatarInput.setAttribute("aria-label", "Chọn ảnh đại diện");
    accountAvatarInput.hidden = true;

    accountPanelIdentity.append(accountDisplayName, accountUsername);
    accountPanelUser.append(accountPanelAvatar, accountPanelIdentity, accountAvatarButton);

    const accountPanelRole = document.createElement("p");
    accountPanelRole.className = "account-panel-role";
    accountPanelRole.hidden = true;

    const accountPanelStatus = document.createElement("p");
    accountPanelStatus.className = "account-panel-status";
    accountPanelStatus.setAttribute("role", "status");
    accountPanelStatus.setAttribute("aria-live", "polite");

    const accountDetailsLink = document.createElement("a");
    accountDetailsLink.className = "account-panel-action";
    accountDetailsLink.href = "/frontend/html/trang-chu.html";
    accountDetailsLink.textContent = "Xem chi tiết tài khoản";

    const accountLogoutButton = document.createElement("button");
    accountLogoutButton.className = "account-panel-logout";
    accountLogoutButton.type = "button";
    accountLogoutButton.textContent = "Đăng xuất";
    accountLogoutButton.hidden = true;

    accountPanel.append(
        accountPanelHeader,
        accountPanelUser,
        accountPanelRole,
        accountPanelStatus,
        accountDetailsLink,
        accountLogoutButton,
        accountAvatarInput
    );
    header?.append(accountPanel);

    async function loadAccountSummary() {
        if (accountSummaryLoaded || accountSummaryLoading) {
            return;
        }

        accountSummaryLoading = true;
        accountPanelStatus.textContent = "";
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin",
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            if (response.status === 401) {
                accountDisplayName.textContent = "Chưa đăng nhập";
                accountUsername.textContent = "";
                accountPanelRole.hidden = true;
                accountDetailsLink.href = "/frontend/html/dang-nhap.html";
                accountDetailsLink.textContent = "Đăng nhập";
                accountSummaryLoaded = true;
                return;
            }
            if (!response.ok) {
                throw new Error("Không thể tải thông tin tài khoản.");
            }

            const user = await response.json();
            if (
                typeof user.display_name !== "string"
                || typeof user.username !== "string"
                || typeof user.role !== "string"
            ) {
                throw new Error("Thông tin tài khoản không đúng định dạng.");
            }

            accountDisplayName.textContent = user.display_name;
            accountUsername.textContent = "@" + user.username;
            if (typeof user.avatar_url === "string" && user.avatar_url) {
                accountPanelAvatarImage.src = user.avatar_url;
                accountPanelAvatarImage.hidden = false;
                accountPanelAvatarFallback.hidden = true;
            }
            accountPanelRole.textContent =
                "Vai trò: " + (user.role === "admin" ? "Quản trị viên" : "Người dùng");
            accountPanelRole.hidden = false;
            accountLogoutButton.hidden = false;
            accountAvatarButton.hidden = false;
            accountSummaryLoaded = true;
        } catch (error) {
            accountPanelStatus.textContent = error instanceof Error
                ? error.message
                : "Không thể tải thông tin tài khoản.";
            console.error("Không thể tải thông tin tài khoản:", error);
        } finally {
            accountSummaryLoading = false;
        }
    }

    setAccountPanelOpen = function(open, trigger = accountButton) {
        accountPanel.hidden = !open;
        accountButton.setAttribute("aria-expanded", String(open));
        mobileAccountButton?.setAttribute("aria-expanded", String(open));
        if (open) {
            accountTriggerForFocus = trigger;
            loadAccountSummary();
        };
    }

    function closeAccountPanelAndRestoreFocus() {
        setAccountPanelOpen(false);
        if (accountTriggerForFocus === mobileAccountButton && mobileMenuElement) {
            mobileMenuElement.querySelector(".mobile-nav-trigger")?.focus();
            return;
        }
        accountTriggerForFocus?.focus();
    }

    accountButton.addEventListener("click", () => {
        setAccountPanelOpen(accountPanel.hidden, accountButton);
    });

    closeAccountPanel.addEventListener("click", () => {
        closeAccountPanelAndRestoreFocus();
    });

    accountAvatarButton.addEventListener("click", () => {
        accountAvatarInput.click();
    });

    accountAvatarInput.addEventListener("change", async () => {
        const file = accountAvatarInput.files?.[0];
        if (!file) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            accountPanelStatus.textContent = "Ảnh tải lên không được vượt quá 5 MB.";
            accountAvatarInput.value = "";
            return;
        }
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            accountPanelStatus.textContent = "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.";
            accountAvatarInput.value = "";
            return;
        }
        if (!window.OrangeAuth || typeof window.OrangeAuth.request !== "function") {
            accountPanelStatus.textContent = "Chức năng tải avatar chưa sẵn sàng. Hãy tải lại trang.";
            accountAvatarInput.value = "";
            return;
        }

        accountAvatarButton.disabled = true;
        accountPanelStatus.textContent = "Đang tải ảnh đại diện...";
        try {
            const formData = new FormData();
            formData.append("file", file);
            const updatedUser = await window.OrangeAuth.request("/api/auth/avatar", {
                method: "POST",
                body: formData,
            });
            if (typeof updatedUser.avatar_url !== "string" || !updatedUser.avatar_url) {
                throw new Error("Máy chủ chưa cập nhật ảnh đại diện.");
            }

            accountPanelAvatarImage.src = updatedUser.avatar_url + "?v=" + Date.now();
            accountPanelAvatarImage.hidden = false;
            accountPanelAvatarFallback.hidden = true;
            accountPanelStatus.textContent = "Ảnh đại diện đã được cập nhật.";
        } catch (error) {
            accountPanelStatus.textContent = error instanceof Error
                ? error.message
                : "Không thể cập nhật ảnh đại diện.";
            console.error("Không thể cập nhật avatar:", error);
        } finally {
            accountAvatarButton.disabled = false;
            accountAvatarInput.value = "";
        }
    });

    accountPanelAvatarImage.addEventListener("error", () => {
        accountPanelAvatarImage.hidden = true;
        accountPanelAvatarFallback.hidden = false;
        accountPanelStatus.textContent = "Không thể tải ảnh đại diện.";
    });

    accountLogoutButton.addEventListener("click", async () => {
        accountPanelStatus.textContent = "";
        accountLogoutButton.disabled = true;
        try {
            if (!window.OrangeAuth || typeof window.OrangeAuth.request !== "function") {
                throw new Error("Chức năng đăng xuất chưa sẵn sàng. Hãy tải lại trang.");
            }
            await window.OrangeAuth.request("/api/auth/logout", {
                method: "POST",
                body: "{}",
            });
            window.location.replace("/frontend/html/dang-nhap.html");
        } catch (error) {
            accountPanelStatus.textContent = error instanceof Error
                ? error.message
                : "Không thể đăng xuất. Vui lòng thử lại.";
            console.error("Không thể đăng xuất tài khoản:", error);
            accountLogoutButton.disabled = false;
        }
    });

    document.addEventListener("click", (event) => {
        if (
            event.target instanceof Node
            && !accountPanel.contains(event.target)
            && !accountButton.contains(event.target)
            && !mobileAccountButton?.contains(event.target)
        ) {
            setAccountPanelOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !accountPanel.hidden) {
            closeAccountPanelAndRestoreFocus();
        }
    });
}

const cacLienKet = document.querySelectorAll(".navbar a");
const navItems = navbar instanceof HTMLElement
    ? Array.from(navbar.querySelectorAll(":scope > a, .menu-dien-dan > a"))
    : [];

cacLienKet.forEach(function(lienKet) {
    lienKet.classList.remove("active");
});

let activeItem = navItems.find((link) => new URL(link.href).pathname === duongDanHienTai);

if (!activeItem) {
    const forumItem = navItems.find((link) => new URL(link.href).pathname.endsWith("/dien-dan.html"));

    if (forumItem) {
        const forumDirectory = new URL(".", forumItem.href).pathname;

        if (duongDanHienTai.startsWith(forumDirectory)) {
            activeItem = forumItem;
        }
    }
}

if (activeItem) {
    activeItem.classList.add("active");
}

if (header instanceof HTMLElement && navbar instanceof HTMLElement) {
    const mobileMenu = document.createElement("details");
    mobileMenu.className = "mobile-nav-menu";
    mobileMenuElement = mobileMenu;

    const trigger = document.createElement("summary");
    trigger.className = "mobile-nav-trigger";

    const currentLabel = document.createElement("span");
    currentLabel.textContent = (activeItem?.textContent ?? "Chọn trang")
        .replace(/\s*▾\s*$/, "")
        .trim();

    const arrow = document.createElement("span");
    arrow.className = "mobile-nav-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";
    trigger.append(currentLabel, arrow);

    const options = document.createElement("nav");
    options.className = "mobile-nav-options";
    options.setAttribute("aria-label", "Điều hướng");

    navItems.forEach((link) => {
        const option = document.createElement("a");
        option.href = link.href;
        option.textContent = (link.textContent ?? "").replace(/\s*▾\s*$/, "").trim();

        if (link === activeItem) {
            option.classList.add("active");
        }

        option.addEventListener("click", () => {
            mobileMenu.open = false;
        });
        options.append(option);
    });

    if (accountButton && accountPanel) {
        mobileAccountButton = document.createElement("button");
        mobileAccountButton.className = "mobile-account-option";
        mobileAccountButton.type = "button";
        mobileAccountButton.textContent = "Tài khoản";
        mobileAccountButton.setAttribute("aria-expanded", "false");
        mobileAccountButton.setAttribute("aria-controls", "account-panel");
        mobileAccountButton.addEventListener("click", () => {
            mobileMenu.open = false;
            setAccountPanelOpen(accountPanel.hidden, mobileAccountButton);
        });
        options.append(mobileAccountButton);
    }

    mobileMenu.append(trigger, options);
    header.insertBefore(mobileMenu, navbar);

    document.addEventListener("click", (event) => {
        if (event.target instanceof Node && !mobileMenu.contains(event.target)) {
            mobileMenu.open = false;
        }
    });
}
