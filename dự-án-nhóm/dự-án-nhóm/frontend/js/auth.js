(function () {
    const nextPath = new URLSearchParams(window.location.search).get("next");

    function safeNextPath(path) {
        if (!path || !path.startsWith("/") || path.startsWith("//")) {
            return "/";
        }

        const destination = new URL(path, window.location.origin);
        if (destination.origin !== window.location.origin) {
            return "/";
        }
        return `${destination.pathname}${destination.search}${destination.hash}`;
    }

    document.querySelectorAll("[data-auth-destination]").forEach((link) => {
        const destination = link.dataset.authDestination;
        if (!destination) {
            return;
        }
        const query = nextPath ? `?next=${encodeURIComponent(safeNextPath(nextPath))}` : "";
        link.href = `/frontend/html/${destination}.html${query}`;
    });

    async function getCsrfToken() {
        const response = await fetch("/api/auth/csrf", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error("Không thể bắt đầu phiên làm việc. Hãy tải lại trang.");
        }
        const result = await response.json();
        return result.csrf_token;
    }

    async function request(path, options) {
        const settings = options || {};
        const method = (settings.method || "GET").toUpperCase();
        const headers = new Headers(settings.headers || {});
        headers.set("Accept", "application/json");

        if (settings.body !== undefined && !(settings.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
            headers.set("X-CSRF-Token", await getCsrfToken());
        }

        const response = await fetch(path, {
            ...settings,
            method,
            headers,
            credentials: "same-origin",
        });
        if (response.status === 204) {
            return null;
        }

        let result = {};
        try {
            result = await response.json();
        } catch {
            throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
        }
        if (!response.ok) {
            const detail = Array.isArray(result.detail)
                ? result.detail.map((item) => item.msg).join(" ")
                : result.detail;
            throw new Error(detail || "Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
        return result;
    }

    window.OrangeAuth = {
        getCsrfToken,
        request,
        safeNextPath,
        getNextPath: () => safeNextPath(nextPath),
    };
})();
