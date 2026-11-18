const accountMessage = document.querySelector("#form-message");
const logoutButton = document.querySelector("#logout-button");
const accountAchievements = document.querySelector("#account-achievements");
const accountBadges = document.querySelector("#account-badges");
const accountPostCount = document.querySelector("#account-post-count");
const accountLikeCount = document.querySelector("#account-like-count");
const accountLevelValue = document.querySelector("#account-level-value");
const accountLevelProgress = document.querySelector("#account-level-progress");
const accountLevelBar = document.querySelector("#account-level-bar");
const accountLevelFill = document.querySelector("#account-level-fill");
const accountAvatarImage = document.querySelector("#account-avatar-image");
const accountAvatarFallback = document.querySelector("#account-avatar-fallback");
const accountAvatarButton = document.querySelector("#account-avatar-upload");
const accountAvatarInput = document.querySelector("#account-avatar-input");
const forumPostStorageKeys = [
    "bai_viet_dien-dan-lien-quan.html",
    "bai_viet_dien-dan-lang-vit.html",
    "bai_viet_dien-dan-mobi.html",
];
const forumBadgeRules = [
    { name: "Người mở lời", icon: "✍️", earnedBy: member => member.posts >= 1 },
    { name: "Thành viên tích cực", icon: "🔥", earnedBy: member => member.posts >= 5 },
    { name: "Được yêu thích", icon: "❤️", earnedBy: member => member.likes >= 3 },
    { name: "Người kết nối", icon: "💬", earnedBy: member => member.comments >= 5 },
];

function getForumStats(displayName) {
    const memberName = displayName.trim().toLocaleLowerCase("vi-VN");
    const member = { posts: 0, likes: 0, comments: 0, commentsPosted: 0 };

    forumPostStorageKeys.forEach(storageKey => {
        const storedPosts = localStorage.getItem(storageKey);
        if (storedPosts === null) {
            return;
        }

        const posts = JSON.parse(storedPosts);
        if (!Array.isArray(posts)) {
            throw new Error("Dữ liệu bài viết không đúng định dạng: " + storageKey);
        }

        posts.forEach(post => {
            if (
                !post
                || typeof post.ten !== "string"
                || (post.daThich !== undefined && typeof post.daThich !== "boolean")
                || (
                    post.binhLuan !== undefined
                    && (
                        !Array.isArray(post.binhLuan)
                        || post.binhLuan.some(comment => !comment || typeof comment.ten !== "string")
                    )
                )
            ) {
                throw new Error("Dữ liệu bài viết không đúng định dạng: " + storageKey);
            }

            if (post.ten.trim().toLocaleLowerCase("vi-VN") === memberName) {
                member.posts += 1;
                member.likes += post.daThich === true ? 1 : 0;
                member.comments += post.binhLuan ? post.binhLuan.length : 0;
            }

            post.binhLuan?.forEach(comment => {
                if (comment.ten.trim().toLocaleLowerCase("vi-VN") === memberName) {
                    member.commentsPosted += 1;
                }
            });
        });
    });

    return member;
}

function renderEarnedForumBadges(displayName) {
    try {
        const member = getForumStats(displayName);
        const badges = forumBadgeRules.filter(badge => badge.earnedBy(member));
        const points = window.OrangeForumProgression.getPoints(member);
        const level = window.OrangeForumProgression.getLevel(points);
        accountPostCount.textContent = String(member.posts);
        accountLikeCount.textContent = String(member.likes);
        accountLevelValue.textContent = "Cấp " + level.number;
        accountLevelProgress.textContent =
            level.progress + " / " + level.pointsPerLevel + " điểm · còn "
            + level.pointsToNext + " điểm lên cấp";
        accountLevelBar.setAttribute("aria-valuenow", String(level.progress));
        accountLevelFill.style.width = level.progress + "%";
        accountBadges.replaceChildren();
        badges.forEach(badge => {
            const item = document.createElement("li");
            item.className = "account-badge";
            item.textContent = badge.icon + " " + badge.name;
            accountBadges.appendChild(item);
        });
        if (badges.length === 0) {
            const emptyMessage = document.createElement("li");
            emptyMessage.className = "account-badge-empty";
            emptyMessage.textContent = "Chưa đạt danh hiệu nào. Hãy tham gia diễn đàn nhé!";
            accountBadges.appendChild(emptyMessage);
        }
        accountAchievements.hidden = false;
    } catch (error) {
        accountMessage.textContent = "Không thể tải thống kê và danh hiệu diễn đàn từ bộ nhớ trình duyệt.";
        console.error("Không thể tải tiến độ diễn đàn:", error);
    }
}

async function loadAccount() {
    try {
        const user = await window.OrangeAuth.request("/api/auth/me");
        document.querySelector("#account-display-name").textContent = user.display_name;
        document.title = user.display_name + " - Orange Team";
        document.querySelector("#account-role").textContent =
            user.role === "admin" ? "Quản trị viên" : "Người dùng";
        if (typeof user.avatar_url === "string" && user.avatar_url) {
            accountAvatarImage.src = user.avatar_url;
            accountAvatarImage.hidden = false;
            accountAvatarFallback.hidden = true;
        }
        renderEarnedForumBadges(user.display_name);
    } catch (error) {
        if (error.message === "Vui lòng đăng nhập.") {
            window.location.replace("/frontend/html/dang-nhap.html?next=%2Ffrontend%2Fhtml%2Ftrang-chu.html");
            return;
        }
        accountMessage.textContent = error.message;
    }
}

accountAvatarButton?.addEventListener("click", () => {
    accountAvatarInput.click();
});

accountAvatarInput?.addEventListener("change", async () => {
    const file = accountAvatarInput.files?.[0];
    if (!file) {
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        accountMessage.textContent = "Ảnh tải lên không được vượt quá 5 MB.";
        accountAvatarInput.value = "";
        return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        accountMessage.textContent = "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.";
        accountAvatarInput.value = "";
        return;
    }

    accountAvatarButton.disabled = true;
    accountMessage.textContent = "Đang tải ảnh đại diện...";
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

        accountAvatarImage.src = updatedUser.avatar_url + "?v=" + Date.now();
        accountAvatarImage.hidden = false;
        accountAvatarFallback.hidden = true;
        accountMessage.textContent = "Ảnh đại diện đã được cập nhật.";
    } catch (error) {
        accountMessage.textContent = error.message;
        console.error("Không thể cập nhật avatar:", error);
    } finally {
        accountAvatarButton.disabled = false;
        accountAvatarInput.value = "";
    }
});

accountAvatarImage?.addEventListener("error", () => {
    accountAvatarImage.hidden = true;
    accountAvatarFallback.hidden = false;
});

logoutButton?.addEventListener("click", async () => {
    accountMessage.textContent = "";
    logoutButton.disabled = true;
    try {
        await window.OrangeAuth.request("/api/auth/logout", { method: "POST", body: "{}" });
        window.location.replace("/frontend/html/dang-nhap.html");
    } catch (error) {
        accountMessage.textContent = error.message;
        logoutButton.disabled = false;
    }
});

loadAccount();
