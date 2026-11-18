const membersContainer = document.querySelector(".members-container");
const memberStatus = document.getElementById("memberStatus");
const memberDialog = document.getElementById("memberDialog");
const memberForm = document.getElementById("memberForm");
const memberFormMessage = document.getElementById("memberFormMessage");
const openMemberDialog = document.getElementById("openMemberDialog");
const newMemberName = document.getElementById("newMemberName");
const saveMemberButton = document.getElementById("saveMemberButton");
const memberStorageKey = "orange_house_added_members";

const memberModal = document.getElementById("memberModal");
const closeProfileButton = document.getElementById("closeModal");
const editProfileMemberButton = document.getElementById("editProfileMember");
const modalAvatar = document.getElementById("modalAvatar");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");
const modalNickname = document.getElementById("modalNickname");
const modalHobby = document.getElementById("modalHobby");
const modalDescription = document.getElementById("modalDescription");

const defaultMembers = Array.from(membersContainer.querySelectorAll(".member-card"))
    .map(function(card) {
        const avatar = card.querySelector(".member-avatar");
        return {
            id: card.dataset.memberId,
            name: card.dataset.name,
            nickname: card.dataset.nickname,
            role: card.dataset.role,
            avatar: avatar ? avatar.textContent : "🙂",
            hobby: card.dataset.hobby,
            description: card.dataset.description,
            leader: card.classList.contains("member-card-leader")
        };
    });

let members = [];
let editingMemberId = null;
let canManageMembers = true;
let profileOpener = null;

function createMemberId() {
    return "member-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function isValidMember(member) {
    return member
        && typeof member.id === "string"
        && typeof member.name === "string"
        && typeof member.nickname === "string"
        && typeof member.role === "string"
        && typeof member.avatar === "string"
        && typeof member.hobby === "string"
        && typeof member.description === "string"
        && (member.leader === undefined || typeof member.leader === "boolean");
}

function loadMembers() {
    try {
        const storedMembers = localStorage.getItem(memberStorageKey);
        if (storedMembers === null) {
            return defaultMembers;
        }

        const parsedMembers = JSON.parse(storedMembers);
        if (Array.isArray(parsedMembers)) {
            if (!parsedMembers.every(function(member) {
                return member
                    && typeof member.name === "string"
                    && typeof member.nickname === "string"
                    && typeof member.role === "string"
                    && typeof member.avatar === "string"
                    && typeof member.hobby === "string"
                    && typeof member.description === "string";
            })) {
                throw new Error("Dữ liệu thành viên không đúng định dạng.");
            }
            return defaultMembers.concat(parsedMembers.map(function(member) {
                return Object.assign({}, member, {
                    id: member.id || createMemberId(),
                    leader: member.leader === true
                });
            }));
        }

        if (parsedMembers && parsedMembers.version === 2
            && Array.isArray(parsedMembers.members)
            && parsedMembers.members.every(isValidMember)) {
            return parsedMembers.members;
        }

        throw new Error("Dữ liệu thành viên không đúng định dạng.");
    } catch (error) {
        canManageMembers = false;
        memberStatus.textContent = "Không thể tải thành viên đã lưu trong trình duyệt.";
        openMemberDialog.disabled = true;
        console.error("Không thể đọc dữ liệu thành viên:", error);
        return defaultMembers;
    }
}

function createMemberEntry(member) {
    const entry = document.createElement("div");
    entry.className = "member-entry";

    const card = document.createElement("button");
    card.type = "button";
    card.className = member.leader ? "member-card member-card-leader" : "member-card";
    card.dataset.memberId = member.id;
    card.dataset.name = member.name;
    card.dataset.nickname = member.nickname;
    card.dataset.role = member.role;
    card.dataset.hobby = member.hobby;
    card.dataset.description = member.description;

    if (member.leader) {
        const crown = document.createElement("span");
        crown.className = "leader-crown";
        crown.setAttribute("aria-hidden", "true");
        crown.textContent = "👑";
        card.appendChild(crown);
    }

    const avatar = document.createElement("div");
    avatar.className = "member-avatar";
    avatar.textContent = member.avatar || "🙂";

    const name = document.createElement("h2");
    name.textContent = member.name;

    const nickname = document.createElement("p");
    nickname.className = "nickname";
    nickname.textContent = "Biệt danh: " + (member.nickname || "Chưa có");

    const role = document.createElement("span");
    role.className = "member-role";
    role.textContent = member.role || "Thành viên";

    const detail = document.createElement("span");
    detail.className = "view-detail";
    detail.textContent = "Xem hồ sơ →";

    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(nickname);
    card.appendChild(role);
    card.appendChild(detail);

    entry.appendChild(card);
    return entry;
}

function renderMembers() {
    while (membersContainer.firstChild) {
        membersContainer.removeChild(membersContainer.firstChild);
    }
    members.forEach(function(member) {
        membersContainer.appendChild(createMemberEntry(member));
    });
}

function saveMembers(updatedMembers) {
    try {
        localStorage.setItem(memberStorageKey, JSON.stringify({
            version: 2,
            members: updatedMembers
        }));
        members = updatedMembers;
        memberStatus.textContent = "";
        renderMembers();
        return true;
    } catch (error) {
        memberStatus.textContent = "Không thể lưu thay đổi thành viên. Hãy kiểm tra dung lượng trình duyệt.";
        console.error("Không thể lưu thành viên:", error);
        return false;
    }
}

function showMemberProfile(card) {
    const avatar = card.querySelector(".member-avatar");
    modalAvatar.textContent = avatar ? avatar.textContent : "🙂";
    modalName.textContent = card.dataset.name || "";
    modalRole.textContent = card.dataset.role || "Thành viên";
    modalNickname.textContent = card.dataset.nickname || "Chưa có";
    modalHobby.textContent = card.dataset.hobby || "Chưa cập nhật";
    modalDescription.textContent = card.dataset.description || "Chưa có giới thiệu.";
    profileOpener = card;
    memberModal.classList.add("show");
}

function closeMemberProfile(restoreFocus) {
    memberModal.classList.remove("show");
    if (profileOpener) {
        if (restoreFocus !== false) {
            profileOpener.focus();
        }
        profileOpener = null;
    }
}

function openMemberEditor(member) {
    editingMemberId = member ? member.id : null;
    memberForm.reset();
    memberFormMessage.textContent = "";
    document.getElementById("memberDialogTitle").textContent =
        member ? "Sửa thông tin thành viên" : "Thêm thành viên mới";
    saveMemberButton.textContent = member ? "Lưu thay đổi" : "Thêm thành viên";

    if (member) {
        memberForm.elements.name.value = member.name;
        memberForm.elements.nickname.value = member.nickname;
        memberForm.elements.role.value = member.role;
        memberForm.elements.avatar.value = member.avatar;
        memberForm.elements.hobby.value = member.hobby;
        memberForm.elements.description.value = member.description;
    }

    memberDialog.showModal();
    newMemberName.focus();
}

membersContainer.addEventListener("click", function(event) {
    const card = event.target.closest(".member-card");
    if (card && membersContainer.contains(card)) {
        showMemberProfile(card);
    }
});

document.getElementById("closeMemberDialog").addEventListener("click", function() {
    memberDialog.close();
});
document.getElementById("cancelMember").addEventListener("click", function() {
    memberDialog.close();
});
openMemberDialog.addEventListener("click", function() {
    openMemberEditor(null);
});
editProfileMemberButton.addEventListener("click", function() {
    if (!profileOpener) {
        return;
    }
    const member = members.find(function(item) {
        return item.id === profileOpener.dataset.memberId;
    });
    if (member) {
        closeMemberProfile(false);
        openMemberEditor(member);
    }
});
memberDialog.addEventListener("click", function(event) {
    if (event.target === memberDialog) {
        const bounds = memberDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            memberDialog.close();
        }
    }
});
memberDialog.addEventListener("close", function() {
    openMemberDialog.focus();
});

memberForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const editedMember = {
        id: editingMemberId || createMemberId(),
        name: memberForm.elements.name.value.trim(),
        nickname: memberForm.elements.nickname.value.trim(),
        role: memberForm.elements.role.value.trim(),
        avatar: memberForm.elements.avatar.value.trim() || "🙂",
        hobby: memberForm.elements.hobby.value.trim(),
        description: memberForm.elements.description.value.trim(),
        leader: editingMemberId
            ? members.find(function(member) {
                return member.id === editingMemberId;
            }).leader === true
            : false
    };

    if (!editedMember.name || !editedMember.role) {
        memberFormMessage.textContent = "Vui lòng nhập tên và vai trò của thành viên.";
        return;
    }
    if (!canManageMembers) {
        memberFormMessage.textContent = "Không thể lưu thành viên vì dữ liệu hiện tại không đọc được.";
        return;
    }

    const updatedMembers = editingMemberId
        ? members.map(function(member) {
            return member.id === editingMemberId ? editedMember : member;
        })
        : members.concat(editedMember);

    if (!saveMembers(updatedMembers)) {
        memberFormMessage.textContent = "Không thể lưu thành viên. Hãy kiểm tra dung lượng trình duyệt.";
        return;
    }

    memberStatus.textContent = editingMemberId ? "Đã sửa thành viên." : "Đã thêm thành viên.";
    editingMemberId = null;
    memberForm.reset();
    memberFormMessage.textContent = "";
    memberDialog.close();
});

closeProfileButton.addEventListener("click", closeMemberProfile);
memberModal.addEventListener("click", function(event) {
    if (event.target === memberModal) {
        closeMemberProfile();
    }
});
document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && memberModal.classList.contains("show")) {
        closeMemberProfile();
    }
});

members = loadMembers();
if (!canManageMembers) {
    openMemberDialog.disabled = true;
}
renderMembers();
