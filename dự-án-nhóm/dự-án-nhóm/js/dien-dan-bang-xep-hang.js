const rankingList = document.getElementById("rankingList");
const rankingEmpty = document.getElementById("rankingEmpty");
const rankingStatus = document.getElementById("rankingStatus");
const rankingTabs = document.querySelector(".ranking-tabs");
const featuredBadges = document.getElementById("featuredBadges");
const pointMilestones = document.getElementById("pointMilestones");
const communityPostFeed = document.getElementById("communityPostFeed");
const communityPostCount = document.getElementById("communityPostCount");
const communityFeedEmpty = document.getElementById("communityFeedEmpty");
const communityFeedStatus = document.getElementById("communityFeedStatus");
const communityMemberCount = document.getElementById("communityMemberCount");
const communityTotalPosts = document.getElementById("communityTotalPosts");
const communityTotalComments = document.getElementById("communityTotalComments");
const quickPostForm = document.getElementById("quickPostForm");
const quickPostContent = document.getElementById("quickPostContent");
const quickPostRoom = document.getElementById("quickPostRoom");
const quickPostStatus = document.getElementById("quickPostStatus");
const feedTabs = document.querySelector(".community-feed-tabs");

const roomStorageKeys = [
    "bai_viet_dien-dan-lien-quan.html",
    "bai_viet_dien-dan-lang-vit.html",
    "bai_viet_dien-dan-mobi.html"
];

const roomDetails = {
    "dien-dan-lien-quan.html": {
        key: roomStorageKeys[0],
        name: "Liên Quân",
        icon: "⚔️"
    },
    "dien-dan-lang-vit.html": {
        key: roomStorageKeys[1],
        name: "Làng Vịt",
        icon: "🦆"
    },
    "dien-dan-mobi.html": {
        key: roomStorageKeys[2],
        name: "Mobile Legends",
        icon: "🎮"
    }
};

const pendingDraftStorageKey = "orange_forum_pending_draft";

const badgeRules = [
    {
        name: "Người mở lời",
        icon: "✍️",
        requirement: "1 bài viết",
        earnedBy: function(member) {
            return member.posts >= 1;
        }
    },
    {
        name: "Thành viên tích cực",
        icon: "🔥",
        requirement: "5 bài viết",
        earnedBy: function(member) {
            return member.posts >= 5;
        }
    },
    {
        name: "Được yêu thích",
        icon: "❤️",
        requirement: "3 lượt thích",
        earnedBy: function(member) {
            return member.likes >= 3;
        }
    },
    {
        name: "Người kết nối",
        icon: "💬",
        requirement: "5 bình luận",
        earnedBy: function(member) {
            return member.comments >= 5;
        }
    }
];

const pointBadgeRules = [
    { name: "Ngôi sao ORANGE", icon: "⭐", points: 100 },
    { name: "Chiến Binh Chăm Chỉ", icon: "⚔️", points: 200 },
    { name: "Báu Vật Của Nhóm", icon: "💎", points: 500 }
];

let currentRanking = "points";
let currentFeedFilter = "all";

function isValidPost(post) {
    return post
        && typeof post.id === "string"
        && typeof post.ten === "string"
        && typeof post.noiDung === "string"
        && Number.isFinite(new Date(post.thoiGian).getTime())
        && Array.isArray(post.hinhAnh)
        && post.hinhAnh.every(function(image) {
            return typeof image === "string"
                && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image);
        })
        && (post.daThich === undefined || typeof post.daThich === "boolean")
        && (post.binhLuan === undefined
            || (Array.isArray(post.binhLuan) && post.binhLuan.every(function(comment) {
                return comment
                    && typeof comment.ten === "string"
                    && typeof comment.noiDung === "string"
                    && Number.isFinite(new Date(comment.thoiGian).getTime());
            })));
}

function readAllPosts() {
    const allPosts = [];

    Object.keys(roomDetails).forEach(function(roomFile) {
        const room = roomDetails[roomFile];
        const storedPosts = localStorage.getItem(room.key);
        if (storedPosts === null) {
            return;
        }

        const posts = JSON.parse(storedPosts);
        if (!Array.isArray(posts) || !posts.every(isValidPost)) {
            throw new Error("Dữ liệu bài viết không đúng định dạng: " + room.key);
        }

        posts.forEach(function(post) {
            allPosts.push(Object.assign({}, post, {
                roomFile: roomFile,
                roomName: room.name,
                roomIcon: room.icon,
                binhLuan: post.binhLuan || []
            }));
        });
    });

    return allPosts.sort(function(left, right) {
        return new Date(right.thoiGian).getTime() - new Date(left.thoiGian).getTime();
    });
}

function readMembers(posts) {
    const members = new Map();

    function getMember(name) {
        const normalizedName = name.trim();
        if (!normalizedName) {
            return null;
        }

        const key = normalizedName.toLocaleLowerCase("vi-VN");
        let member = members.get(key);
        if (!member) {
            member = {
                name: normalizedName,
                posts: 0,
                likes: 0,
                comments: 0,
                commentsPosted: 0
            };
            members.set(key, member);
        }
        return member;
    }

    posts.forEach(function(post) {
        const member = getMember(post.ten);
        if (!member) {
            return;
        }

        member.posts += 1;
        member.likes += post.daThich === true ? 1 : 0;
        member.comments += post.binhLuan.length;

        post.binhLuan.forEach(function(comment) {
            const commenter = getMember(comment.ten);
            if (commenter) {
                commenter.commentsPosted += 1;
            }
        });
    });

    return Array.from(members.values()).map(function(member) {
        member.points = window.OrangeForumProgression.getPoints(member);
        member.level = window.OrangeForumProgression.getLevel(member.points);
        member.badges = badgeRules.filter(function(badge) {
            return badge.earnedBy(member);
        });
        member.pointBadges = pointBadgeRules.filter(function(badge) {
            return member.points >= badge.points;
        });
        return member;
    });
}

function createCommunityPost(post) {
    const card = document.createElement("article");
    card.className = "community-post-card";

    const header = document.createElement("div");
    header.className = "community-post-header";

    const avatar = document.createElement("span");
    avatar.className = "community-post-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = post.ten.trim().charAt(0).toLocaleUpperCase("vi-VN") || "?";

    const authorGroup = document.createElement("div");
    authorGroup.className = "community-post-author-group";

    const author = document.createElement("strong");
    author.className = "community-post-author";
    author.textContent = post.ten;

    const meta = document.createElement("div");
    meta.className = "community-post-meta";

    const room = document.createElement("span");
    room.className = "community-post-room";
    room.textContent = post.roomIcon + " " + post.roomName;

    const time = document.createElement("time");
    time.dateTime = new Date(post.thoiGian).toISOString();
    time.textContent = new Date(post.thoiGian).toLocaleString("vi-VN");

    meta.append(room, time);
    authorGroup.append(author, meta);
    header.append(avatar, authorGroup);

    const content = document.createElement("p");
    content.className = "community-post-content";
    content.textContent = post.noiDung;

    const actions = document.createElement("div");
    actions.className = "community-post-actions";

    const likes = document.createElement("span");
    likes.textContent = post.daThich === true ? "♥ 1 lượt thích" : "♡ 0 lượt thích";

    const comments = document.createElement("span");
    comments.textContent = "💬 " + post.binhLuan.length + " bình luận";

    const openPost = document.createElement("a");
    openPost.href = post.roomFile + "#post-" + encodeURIComponent(post.id);
    openPost.className = "community-post-open";
    openPost.textContent = "Mở bài viết →";

    actions.append(likes, comments, openPost);
    card.append(header, content);

    if (post.hinhAnh.length > 0) {
        const imageSummary = document.createElement("p");
        imageSummary.className = "community-post-image-count";
        imageSummary.textContent = "🖼️ " + post.hinhAnh.length + " ảnh đính kèm";
        card.appendChild(imageSummary);
    }

    card.appendChild(actions);
    return card;
}

function renderCommunityFeed() {
    communityFeedStatus.textContent = "";
    while (communityPostFeed.firstChild) {
        communityPostFeed.removeChild(communityPostFeed.firstChild);
    }

    try {
        const posts = readAllPosts();
        const members = readMembers(posts);
        const filteredPosts = currentFeedFilter === "liked"
            ? posts.filter(function(post) {
                return post.daThich === true;
            })
            : posts;

        communityPostCount.textContent = filteredPosts.length + " bài viết";
        communityMemberCount.textContent = members.length;
        communityTotalPosts.textContent = posts.length;
        communityTotalComments.textContent = posts.reduce(function(total, post) {
            return total + post.binhLuan.length;
        }, 0);

        communityFeedEmpty.hidden = filteredPosts.length > 0;
        const visiblePosts = currentFeedFilter === "recent"
            ? filteredPosts.slice(0, 10)
            : filteredPosts.slice(0, 20);
        visiblePosts.forEach(function(post) {
            communityPostFeed.appendChild(createCommunityPost(post));
        });
    } catch (error) {
        communityPostCount.textContent = "Không tải được";
        communityFeedEmpty.hidden = false;
        communityFeedEmpty.textContent = "Không thể tải bài viết từ bộ nhớ trình duyệt.";
        communityFeedStatus.textContent = "Hãy kiểm tra dữ liệu bài đăng đã lưu.";
        communityMemberCount.textContent = "—";
        communityTotalPosts.textContent = "—";
        communityTotalComments.textContent = "—";
        console.error("Không thể tải bảng tin diễn đàn:", error);
    }
}

function sortMembers(members, ranking) {
    const byName = function(left, right) {
        return left.name.localeCompare(right.name, "vi");
    };

    if (ranking === "points") {
        return members.sort(function(left, right) {
            return right.points - left.points || byName(left, right);
        });
    }

    const membersWithPosts = members.filter(function(member) {
        return member.posts > 0;
    });

    if (ranking === "likes") {
        return membersWithPosts.sort(function(left, right) {
            return right.likes - left.likes
                || right.comments - left.comments
                || byName(left, right);
        });
    }

    if (ranking === "badges") {
        return membersWithPosts.sort(function(left, right) {
            return right.badges.length - left.badges.length
                || right.posts - left.posts
                || byName(left, right);
        });
    }

    return membersWithPosts.sort(function(left, right) {
        return right.posts - left.posts || byName(left, right);
    });
}

function createRankingEntry(member, index, ranking) {
    const entry = document.createElement("li");
    entry.className = "ranking-entry";

    const rank = document.createElement("span");
    rank.className = "ranking-position";
    rank.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("strong");
    name.className = "ranking-name";
    name.textContent = member.name;

    const level = document.createElement("span");
    level.className = "ranking-level";
    level.textContent = "Cấp " + member.level.number;

    const identity = document.createElement("div");
    identity.className = "ranking-identity";
    identity.append(name, level);

    const score = document.createElement("span");
    score.className = "ranking-score";

    if (ranking === "likes") {
        score.textContent = member.likes + " ♥ · " + member.comments + " 💬";
    } else if (ranking === "badges") {
        score.textContent = member.badges.length + " danh hiệu";
    } else if (ranking === "points") {
        const latestBadge = member.pointBadges[member.pointBadges.length - 1];
        score.textContent = member.points + " điểm · "
            + (latestBadge ? latestBadge.name : "Chưa có danh hiệu");
    } else {
        score.textContent = member.posts + " bài viết";
    }

    entry.append(rank, identity, score);
    return entry;
}

function renderPointMilestones(members) {
    while (pointMilestones.firstChild) {
        pointMilestones.removeChild(pointMilestones.firstChild);
    }

    pointBadgeRules.forEach(function(badge) {
        const item = document.createElement("div");
        item.className = "point-milestone";
        item.setAttribute("role", "listitem");

        const icon = document.createElement("span");
        icon.className = "point-milestone-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = badge.icon;

        const name = document.createElement("strong");
        name.className = "point-milestone-name";
        name.textContent = badge.name;

        const requirement = document.createElement("span");
        requirement.className = "point-milestone-requirement";
        requirement.textContent = badge.points + " điểm";

        const count = document.createElement("span");
        count.className = "point-milestone-count";
        if (members === null) {
            count.textContent = "Không thể tải dữ liệu thành tích.";
        } else {
            const earnedCount = members.filter(function(member) {
                return member.points >= badge.points;
            }).length;
            count.textContent = earnedCount + " thành viên đã đạt";
        }

        item.append(icon, name, requirement, count);
        pointMilestones.appendChild(item);
    });
}

function renderRanking(ranking) {
    currentRanking = ranking;
    rankingStatus.textContent = "";
    while (rankingList.firstChild) {
        rankingList.removeChild(rankingList.firstChild);
    }

    rankingTabs.querySelectorAll("[data-ranking]").forEach(function(tab) {
        const isSelected = tab.dataset.ranking === ranking;
        tab.classList.toggle("is-active", isSelected);
        tab.setAttribute("aria-pressed", String(isSelected));
    });

    try {
        const allMembers = readMembers(readAllPosts());
        const members = sortMembers(allMembers, ranking);
        renderPointMilestones(allMembers);
        rankingEmpty.hidden = members.length > 0;
        rankingEmpty.textContent = "Chưa có bài đăng nào để xếp hạng.";
        members.slice(0, 3).forEach(function(member, index) {
            rankingList.appendChild(createRankingEntry(member, index, ranking));
        });
    } catch (error) {
        renderPointMilestones(null);
        rankingEmpty.hidden = false;
        rankingEmpty.textContent = "Không thể đọc dữ liệu bài viết để xếp hạng.";
        rankingStatus.textContent = "Hãy kiểm tra dữ liệu bài viết đã lưu trong trình duyệt.";
        console.error("Không thể tải bảng xếp hạng diễn đàn:", error);
    }
}

function renderBadgeCatalog() {
    badgeRules.forEach(function(badge) {
        const item = document.createElement("div");
        item.className = "featured-badge";

        const icon = document.createElement("span");
        icon.className = "featured-badge-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = badge.icon;

        const name = document.createElement("strong");
        name.className = "featured-badge-name";
        name.textContent = badge.name;

        const requirement = document.createElement("span");
        requirement.className = "featured-badge-requirement";
        requirement.textContent = badge.requirement;

        item.append(icon, name, requirement);
        featuredBadges.appendChild(item);
    });
}

rankingTabs.addEventListener("click", function(event) {
    const tab = event.target.closest("[data-ranking]");
    if (tab) {
        renderRanking(tab.dataset.ranking);
    }
});

feedTabs.addEventListener("click", function(event) {
    const tab = event.target.closest("[data-feed-filter]");
    if (!tab) {
        return;
    }

    currentFeedFilter = tab.dataset.feedFilter;
    feedTabs.querySelectorAll("[data-feed-filter]").forEach(function(feedTab) {
        const isSelected = feedTab === tab;
        feedTab.classList.toggle("is-active", isSelected);
        feedTab.setAttribute("aria-pressed", String(isSelected));
    });
    renderCommunityFeed();
});

quickPostForm.addEventListener("submit", function(event) {
    event.preventDefault();
    quickPostStatus.textContent = "";

    const roomFile = quickPostRoom.value;
    if (!Object.prototype.hasOwnProperty.call(roomDetails, roomFile)) {
        quickPostStatus.textContent = "Vui lòng chọn một phòng diễn đàn.";
        return;
    }

    const draft = quickPostContent.value.trim();
    if (!draft) {
        quickPostStatus.textContent = "Vui lòng nhập nội dung bài viết.";
        return;
    }

    try {
        sessionStorage.setItem(pendingDraftStorageKey, draft);
    } catch (error) {
        quickPostStatus.textContent = "Không thể chuyển nội dung sang phòng đăng bài.";
        console.error("Không thể lưu bản nháp tạm thời:", error);
        return;
    }

    window.location.assign(roomFile + "?compose=1");
});

window.addEventListener("storage", function(event) {
    if (event.key === null || roomStorageKeys.includes(event.key)) {
        renderRanking(currentRanking);
        renderCommunityFeed();
    }
});

window.addEventListener("pageshow", function() {
    renderRanking(currentRanking);
    renderCommunityFeed();
});

renderBadgeCatalog();
renderRanking(currentRanking);
renderCommunityFeed();
