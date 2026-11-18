const postForm = document.getElementById("postForm");
const postContent = document.getElementById("postContent");
const postImages = document.getElementById("postImages");
const postImageStatus = document.getElementById("postImageStatus");
const postImagePreview = document.getElementById("postImagePreview");
const postFormMessage = document.getElementById("postFormMessage");
const postCount = document.getElementById("postCount");
const postsList = document.getElementById("postsList");
const emptyPosts = document.getElementById("emptyPosts");
const postsFeedback = document.getElementById("postsFeedback");
const postDialog = document.getElementById("postDialog");
const openPostDialog = document.getElementById("openPostDialog");
const closePostDialog = document.getElementById("closePostDialog");
const cancelPost = document.getElementById("cancelPost");
const submitButton = postForm.querySelector('button[type="submit"]');
const forumRoom = document.querySelector(".forum-heading h1").textContent.trim();

const tenTrang = window.location.pathname.split("/").pop();
const khoaLuu = "bai_viet_" + tenTrang;
const pendingDraftStorageKey = "orange_forum_pending_draft";
const soAnhToiDa = 4;
const danhSachUrlAnhXemTruoc = [];
const cacBaiVietDangMo = new Set();
let danhSachBaiViet = [];
let coTheLuu = true;
let tenHienThiNguoiDung = "";
let taiKhoanSanSang = false;

submitButton.disabled = true;

function thongBaoLoi(thongBao) {
    postFormMessage.textContent = thongBao;
}

async function taiTaiKhoanDangNhap() {
    try {
        const user = await window.OrangeAuth.request("/api/auth/me");
        if (typeof user.display_name !== "string" || !user.display_name.trim()) {
            throw new Error("Tài khoản chưa có tên hiển thị hợp lệ.");
        }

        tenHienThiNguoiDung = user.display_name.trim();
        taiKhoanSanSang = true;
        submitButton.disabled = !coTheLuu;
        postsList.querySelectorAll(".post-comment-submit").forEach(function(button) {
            button.disabled = false;
        });
    } catch (error) {
        if (error.message === "Vui lòng đăng nhập.") {
            const nextPath = window.location.pathname + window.location.search + window.location.hash;
            window.location.replace(
                "/frontend/html/dang-nhap.html?next=" + encodeURIComponent(nextPath)
            );
            return;
        }

        thongBaoLoi("Không thể tải tên hiển thị tài khoản. Vui lòng tải lại trang.");
        console.error("Không thể tải tài khoản đăng bài:", error);
    }
}

function laThoiGianHopLe(thoiGian) {
    return Number.isFinite(thoiGian) && !Number.isNaN(new Date(thoiGian).getTime());
}

function laBinhLuanHopLe(binhLuan) {
    return binhLuan
        && typeof binhLuan.ten === "string"
        && typeof binhLuan.noiDung === "string"
        && laThoiGianHopLe(binhLuan.thoiGian);
}

function laBaiVietHopLe(baiViet) {
    return baiViet
        && typeof baiViet.id === "string"
        && typeof baiViet.ten === "string"
        && typeof baiViet.noiDung === "string"
        && laThoiGianHopLe(baiViet.thoiGian)
        && Array.isArray(baiViet.hinhAnh)
        && baiViet.hinhAnh.every(function(anh) {
            return typeof anh === "string"
                && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(anh);
        })
        && (baiViet.daThich === undefined || typeof baiViet.daThich === "boolean")
        && (baiViet.binhLuan === undefined
            || (Array.isArray(baiViet.binhLuan) && baiViet.binhLuan.every(laBinhLuanHopLe)));
}

function docBaiViet() {
    try {
        const duLieu = localStorage.getItem(khoaLuu);
        if (duLieu === null) {
            return [];
        }

        const baiVietDaLuu = JSON.parse(duLieu);
        if (!Array.isArray(baiVietDaLuu) || !baiVietDaLuu.every(laBaiVietHopLe)) {
            throw new Error("Dữ liệu bài viết không đúng định dạng.");
        }

        return baiVietDaLuu.map(function(baiViet) {
            return Object.assign({}, baiViet, {
                daThich: baiViet.daThich === true,
                binhLuan: baiViet.binhLuan || []
            });
        });
    } catch (loi) {
        coTheLuu = false;
        thongBaoLoi("Không thể đọc bài viết đã lưu trong trình duyệt.");
        postsFeedback.textContent = "Không thể tải bài viết. Hãy kiểm tra bộ nhớ trình duyệt.";
        console.error("Không thể đọc dữ liệu diễn đàn:", loi);
        return [];
    }
}

function taoTheBinhLuan(binhLuan) {
    const muc = document.createElement("article");
    muc.className = "post-comment";

    const thongTin = document.createElement("div");
    thongTin.className = "post-comment-meta";

    const ten = document.createElement("strong");
    ten.textContent = binhLuan.ten;

    const thoiGian = document.createElement("time");
    thoiGian.dateTime = new Date(binhLuan.thoiGian).toISOString();
    thoiGian.textContent = new Date(binhLuan.thoiGian).toLocaleString("vi-VN");

    const noiDung = document.createElement("p");
    noiDung.className = "post-comment-text";
    noiDung.textContent = binhLuan.noiDung;

    thongTin.appendChild(ten);
    thongTin.appendChild(thoiGian);
    muc.appendChild(thongTin);
    muc.appendChild(noiDung);
    return muc;
}

function taoTheBaiViet(baiViet) {
    const theBaiViet = document.createElement("article");
    theBaiViet.className = "post-card";
    theBaiViet.dataset.postId = baiViet.id;
    theBaiViet.id = "post-" + baiViet.id;

    const dauBaiViet = document.createElement("div");
    dauBaiViet.className = "post-card-header";

    const avatar = document.createElement("span");
    avatar.className = "post-avatar";
    avatar.textContent = baiViet.ten.trim().charAt(0).toLocaleUpperCase("vi-VN") || "?";
    avatar.setAttribute("aria-hidden", "true");

    const thongTin = document.createElement("div");
    const ten = document.createElement("div");
    ten.className = "post-author";
    ten.textContent = baiViet.ten;

    const thoiGian = document.createElement("time");
    thoiGian.className = "post-time";
    thoiGian.dateTime = new Date(baiViet.thoiGian).toISOString();
    thoiGian.textContent = new Date(baiViet.thoiGian).toLocaleString("vi-VN");

    thongTin.appendChild(ten);
    thongTin.appendChild(thoiGian);
    dauBaiViet.appendChild(avatar);
    dauBaiViet.appendChild(thongTin);
    theBaiViet.appendChild(dauBaiViet);

    const noiDung = document.createElement("p");
    noiDung.className = "post-text";
    noiDung.textContent = baiViet.noiDung;
    theBaiViet.appendChild(noiDung);

    if (baiViet.hinhAnh.length > 0) {
        const luoiAnh = document.createElement("div");
        luoiAnh.className = "post-gallery";

        baiViet.hinhAnh.forEach(function(duLieuAnh, index) {
            const anh = document.createElement("img");
            anh.className = "post-image";
            anh.src = duLieuAnh;
            anh.alt = "Ảnh " + (index + 1) + " trong bài viết của " + baiViet.ten;
            anh.loading = "lazy";
            luoiAnh.appendChild(anh);
        });

        theBaiViet.appendChild(luoiAnh);
    }

    const thaoTac = document.createElement("div");
    thaoTac.className = "post-actions";

    const nutThich = document.createElement("button");
    nutThich.type = "button";
    nutThich.className = "post-action-button";
    nutThich.dataset.action = "like";
    nutThich.setAttribute("aria-pressed", String(baiViet.daThich));
    nutThich.appendChild(document.createTextNode(baiViet.daThich ? "♥ Đã thích " : "♡ Thích "));
    const soLuotThich = document.createElement("span");
    soLuotThich.className = "post-action-count";
    soLuotThich.textContent = baiViet.daThich ? "1" : "0";
    nutThich.appendChild(soLuotThich);

    const nutBinhLuan = document.createElement("button");
    nutBinhLuan.type = "button";
    nutBinhLuan.className = "post-action-button";
    nutBinhLuan.dataset.action = "comments";
    nutBinhLuan.setAttribute("aria-expanded", String(cacBaiVietDangMo.has(baiViet.id)));
    nutBinhLuan.appendChild(document.createTextNode("💬 Bình luận "));
    const soBinhLuan = document.createElement("span");
    soBinhLuan.className = "post-action-count";
    soBinhLuan.textContent = baiViet.binhLuan.length;
    nutBinhLuan.appendChild(soBinhLuan);

    thaoTac.appendChild(nutThich);
    thaoTac.appendChild(nutBinhLuan);
    theBaiViet.appendChild(thaoTac);

    const khuBinhLuan = document.createElement("section");
    khuBinhLuan.className = "post-comments";
    khuBinhLuan.hidden = !cacBaiVietDangMo.has(baiViet.id);
    khuBinhLuan.setAttribute("aria-label", "Bình luận cho bài viết của " + baiViet.ten);

    const danhSachBinhLuan = document.createElement("div");
    danhSachBinhLuan.className = "post-comment-list";
    if (baiViet.binhLuan.length === 0) {
        const trong = document.createElement("p");
        trong.className = "post-comments-empty";
        trong.textContent = "Chưa có bình luận nào.";
        danhSachBinhLuan.appendChild(trong);
    } else {
        baiViet.binhLuan.forEach(function(binhLuan) {
            danhSachBinhLuan.appendChild(taoTheBinhLuan(binhLuan));
        });
    }

    const bieuMauBinhLuan = document.createElement("form");
    bieuMauBinhLuan.className = "post-comment-form";

    const oNoiDungBinhLuan = document.createElement("input");
    oNoiDungBinhLuan.className = "post-comment-content";
    oNoiDungBinhLuan.name = "content";
    oNoiDungBinhLuan.type = "text";
    oNoiDungBinhLuan.maxLength = 1000;
    oNoiDungBinhLuan.placeholder = "Viết bình luận...";
    oNoiDungBinhLuan.setAttribute("aria-label", "Nội dung bình luận");
    oNoiDungBinhLuan.required = true;

    const nutGuiBinhLuan = document.createElement("button");
    nutGuiBinhLuan.className = "post-comment-submit";
    nutGuiBinhLuan.type = "submit";
    nutGuiBinhLuan.disabled = !taiKhoanSanSang;
    nutGuiBinhLuan.textContent = "Gửi";

    bieuMauBinhLuan.appendChild(oNoiDungBinhLuan);
    bieuMauBinhLuan.appendChild(nutGuiBinhLuan);

    khuBinhLuan.appendChild(danhSachBinhLuan);
    khuBinhLuan.appendChild(bieuMauBinhLuan);
    theBaiViet.appendChild(khuBinhLuan);
    return theBaiViet;
}

function hienThiBaiViet() {
    while (postsList.firstChild) {
        postsList.removeChild(postsList.firstChild);
    }

    if (!coTheLuu) {
        postCount.textContent = "Không tải được";
        emptyPosts.textContent = "Không thể tải bài viết. Hãy kiểm tra bộ nhớ trình duyệt.";
        emptyPosts.hidden = false;
        return;
    }

    danhSachBaiViet.forEach(function(baiViet) {
        postsList.appendChild(taoTheBaiViet(baiViet));
    });

    postCount.textContent = danhSachBaiViet.length + " bài viết";
    emptyPosts.textContent = "Chưa có bài viết nào trong phòng này.";
    emptyPosts.hidden = danhSachBaiViet.length > 0;
}

function luuDanhSachBaiViet(danhSachMoi) {
    try {
        localStorage.setItem(khoaLuu, JSON.stringify(danhSachMoi));
        danhSachBaiViet = danhSachMoi;
        postsFeedback.textContent = "";
        hienThiBaiViet();
        return true;
    } catch (loi) {
        postsFeedback.textContent = "Không thể lưu thay đổi. Bộ nhớ trình duyệt có thể đã đầy.";
        console.error("Không thể lưu dữ liệu diễn đàn:", loi);
        return false;
    }
}

async function notifyNewForumPost(content, imageCount) {
    const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });
    if (!csrfResponse.ok) {
        throw new Error("Không thể xác thực yêu cầu cập nhật thông báo.");
    }

    const csrfResult = await csrfResponse.json();
    const response = await fetch("/api/notifications/forum-post", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfResult.csrf_token
        },
        body: JSON.stringify({
            room: forumRoom,
            content: content,
            image_count: imageCount
        })
    });
    if (!response.ok) {
        let errorMessage = "Không thể cập nhật thông báo cho bài đăng.";
        try {
            const result = await response.json();
            if (typeof result.detail === "string") {
                errorMessage = result.detail;
            }
        } catch (error) {
            console.error("Máy chủ trả về lỗi không đọc được:", error);
        }
        throw new Error(errorMessage);
    }
}

function xoaAnhXemTruoc() {
    danhSachUrlAnhXemTruoc.forEach(function(url) {
        URL.revokeObjectURL(url);
    });
    danhSachUrlAnhXemTruoc.length = 0;

    while (postImagePreview.firstChild) {
        postImagePreview.removeChild(postImagePreview.firstChild);
    }
}

function hienThiAnhXemTruoc(danhSachTep) {
    xoaAnhXemTruoc();

    danhSachTep.forEach(function(tep) {
        const url = URL.createObjectURL(tep);
        danhSachUrlAnhXemTruoc.push(url);

        const mucXemTruoc = document.createElement("div");
        mucXemTruoc.className = "post-preview-item";

        const anh = document.createElement("img");
        anh.className = "post-preview-image";
        anh.src = url;
        anh.alt = "Xem trước " + tep.name;

        const tenTep = document.createElement("span");
        tenTep.className = "post-preview-name";
        tenTep.textContent = tep.name;

        mucXemTruoc.appendChild(anh);
        mucXemTruoc.appendChild(tenTep);
        postImagePreview.appendChild(mucXemTruoc);
    });
}

function docTepAnh(tep) {
    return new Promise(function(resolve, reject) {
        const doc = new FileReader();
        doc.onload = function() {
            if (typeof doc.result !== "string") {
                reject(new Error("Tệp ảnh không thể đọc được."));
                return;
            }
            resolve(doc.result);
        };
        doc.onerror = function() {
            reject(doc.error || new Error("Không thể đọc tệp ảnh."));
        };
        doc.readAsDataURL(tep);
    });
}

postImages.addEventListener("change", function() {
    const danhSachTep = Array.from(postImages.files);
    const laTepAnh = danhSachTep.every(function(tep) {
        return tep.type.startsWith("image/");
    });

    if (danhSachTep.length > soAnhToiDa || !laTepAnh) {
        postImages.value = "";
        xoaAnhXemTruoc();
        postImageStatus.textContent = "Chỉ chọn tối đa 4 tệp ảnh.";
        thongBaoLoi("Tệp đã chọn không hợp lệ. Vui lòng chọn tối đa 4 ảnh.");
        return;
    }

    thongBaoLoi("");
    hienThiAnhXemTruoc(danhSachTep);
    postImageStatus.textContent = danhSachTep.length
        ? "Đã chọn " + danhSachTep.length + " ảnh."
        : "Có thể chọn tối đa 4 ảnh.";
});

postForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!coTheLuu) {
        thongBaoLoi("Không thể đăng bài vì dữ liệu diễn đàn không đọc được.");
        return;
    }

    const noiDung = postContent.value.trim();
    const danhSachTep = Array.from(postImages.files);

    if (!taiKhoanSanSang) {
        thongBaoLoi("Thông tin tài khoản chưa tải xong. Vui lòng thử lại.");
        return;
    }

    if (!noiDung) {
        thongBaoLoi("Vui lòng nhập nội dung bài viết.");
        return;
    }

    if (danhSachTep.length > soAnhToiDa) {
        thongBaoLoi("Mỗi bài viết chỉ có thể đăng tối đa 4 ảnh.");
        return;
    }

    submitButton.disabled = true;
    thongBaoLoi("");

    try {
        const hinhAnh = await Promise.all(danhSachTep.map(docTepAnh));
        const baiVietMoi = {
            id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2),
            ten: tenHienThiNguoiDung,
            noiDung: noiDung,
            thoiGian: Date.now(),
            hinhAnh: hinhAnh,
            daThich: false,
            binhLuan: []
        };
        const danhSachMoi = [baiVietMoi].concat(danhSachBaiViet);

        if (!luuDanhSachBaiViet(danhSachMoi)) {
            thongBaoLoi("Không thể lưu bài viết. Hãy thử ảnh nhỏ hơn hoặc giảm số ảnh.");
            return;
        }

        try {
            await notifyNewForumPost(baiVietMoi.noiDung, baiVietMoi.hinhAnh.length);
            postsFeedback.textContent = "Đã đăng bài và cập nhật thông báo.";
        } catch (loiThongBao) {
            postsFeedback.textContent = "Bài đã đăng nhưng chưa cập nhật được thông báo.";
            console.error("Không thể tạo thông báo bài viết mới:", loiThongBao);
        }

        postForm.reset();
        xoaAnhXemTruoc();
        postImageStatus.textContent = "Có thể chọn tối đa 4 ảnh.";
        postDialog.close();
    } catch (loi) {
        thongBaoLoi("Không thể đọc ảnh đã chọn. Vui lòng thử lại với ảnh khác.");
        console.error("Không thể đăng bài viết:", loi);
    } finally {
        submitButton.disabled = !taiKhoanSanSang || !coTheLuu;
    }
});

postsList.addEventListener("click", function(event) {
    const nut = event.target.closest("[data-action]");
    if (!nut) {
        return;
    }

    const theBaiViet = nut.closest(".post-card");
    const baiViet = danhSachBaiViet.find(function(item) {
        return item.id === theBaiViet.dataset.postId;
    });
    if (!baiViet) {
        return;
    }

    if (nut.dataset.action === "comments") {
        const dangMo = !cacBaiVietDangMo.has(baiViet.id);
        if (dangMo) {
            cacBaiVietDangMo.add(baiViet.id);
        } else {
            cacBaiVietDangMo.delete(baiViet.id);
        }
        nut.setAttribute("aria-expanded", String(dangMo));
        theBaiViet.querySelector(".post-comments").hidden = !dangMo;
        if (dangMo) {
            theBaiViet.querySelector(".post-comment-content").focus();
        }
        return;
    }

    if (nut.dataset.action === "like") {
        const danhSachMoi = danhSachBaiViet.map(function(item) {
            return item.id === baiViet.id
                ? Object.assign({}, item, { daThich: !item.daThich })
                : item;
        });
        luuDanhSachBaiViet(danhSachMoi);
    }
});

postsList.addEventListener("submit", function(event) {
    const bieuMau = event.target.closest(".post-comment-form");
    if (!bieuMau) {
        return;
    }
    event.preventDefault();

    const theBaiViet = bieuMau.closest(".post-card");
    const baiViet = danhSachBaiViet.find(function(item) {
        return item.id === theBaiViet.dataset.postId;
    });
    const noiDung = bieuMau.elements.content.value.trim();
    if (!baiViet || !taiKhoanSanSang || !noiDung) {
        return;
    }

    const danhSachMoi = danhSachBaiViet.map(function(item) {
        if (item.id !== baiViet.id) {
            return item;
        }
        return Object.assign({}, item, {
            binhLuan: item.binhLuan.concat({
                ten: tenHienThiNguoiDung,
                noiDung: noiDung,
                thoiGian: Date.now()
            })
        });
    });

    cacBaiVietDangMo.add(baiViet.id);
    if (luuDanhSachBaiViet(danhSachMoi)) {
        const bieuMauMoi = postsList.querySelector(
            '.post-card[data-post-id="' + baiViet.id + '"] .post-comment-form'
        );
        if (bieuMauMoi) {
            bieuMauMoi.elements.content.focus();
        }
    }
});

openPostDialog.addEventListener("click", function() {
    postDialog.showModal();
    postContent.focus();
});

function dongHopThoaiDangBai() {
    postDialog.close();
}

closePostDialog.addEventListener("click", dongHopThoaiDangBai);
cancelPost.addEventListener("click", dongHopThoaiDangBai);
postDialog.addEventListener("click", function(event) {
    if (event.target === postDialog) {
        const khung = postDialog.getBoundingClientRect();
        if (event.clientX < khung.left || event.clientX > khung.right
            || event.clientY < khung.top || event.clientY > khung.bottom) {
            postDialog.close();
        }
    }
});
postDialog.addEventListener("close", function() {
    openPostDialog.focus();
});

danhSachBaiViet = docBaiViet();
if (!coTheLuu) {
    submitButton.disabled = true;
    openPostDialog.disabled = true;
}
hienThiBaiViet();
taiTaiKhoanDangNhap();

const query = new URLSearchParams(window.location.search);
if (query.get("compose") === "1") {
    try {
        const draft = sessionStorage.getItem(pendingDraftStorageKey);
        if (draft) {
            postContent.value = draft;
            sessionStorage.removeItem(pendingDraftStorageKey);
        }
    } catch (error) {
        thongBaoLoi("Không thể tải bản nháp từ bảng tin. Bạn vẫn có thể viết bài mới.");
        console.error("Không thể đọc bản nháp diễn đàn:", error);
    }

    postDialog.showModal();
    postContent.focus();
}

if (window.location.hash.startsWith("#post-")) {
    const postId = decodeURIComponent(window.location.hash.slice("#post-".length));
    const post = Array.from(postsList.querySelectorAll(".post-card")).find(function(card) {
        return card.dataset.postId === postId;
    });
    if (post) {
        post.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}
