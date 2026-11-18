const rulesContainer = document.getElementById("rulesContainer");
const openRuleDialog = document.getElementById("openRuleDialog");
const ruleDialog = document.getElementById("ruleDialog");
const ruleForm = document.getElementById("ruleForm");
const ruleTitle = document.getElementById("ruleTitle");
const ruleDescription = document.getElementById("ruleDescription");
const ruleStatus = document.getElementById("ruleStatus");
const ruleFormMessage = document.getElementById("ruleFormMessage");
const ruleDialogTitle = document.getElementById("ruleDialogTitle");
const saveRuleButton = document.getElementById("saveRuleButton");

const ruleStorageKey = "orange_house_rules";
const defaultRules = Array.from(rulesContainer.querySelectorAll(".rule-card")).map(function(card) {
    const heading = card.querySelector("h2").textContent;
    return {
        id: card.dataset.ruleId,
        title: heading.replace(/^Quy định\s+\d+\s*-\s*/, ""),
        description: card.querySelector("p").textContent.trim()
    };
});

let rules = [];
let editingRuleId = null;
let canManageRules = true;

function createRuleId() {
    return "rule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function isValidRule(rule) {
    return rule
        && typeof rule.id === "string"
        && typeof rule.title === "string"
        && typeof rule.description === "string";
}

function loadRules() {
    try {
        const storedRules = localStorage.getItem(ruleStorageKey);
        if (storedRules === null) {
            return defaultRules;
        }

        const parsedRules = JSON.parse(storedRules);
        if (Array.isArray(parsedRules)) {
            if (!parsedRules.every(function(rule) {
                return rule && typeof rule.title === "string"
                    && typeof rule.description === "string";
            })) {
                throw new Error("Dữ liệu quy định không đúng định dạng.");
            }
            return defaultRules.concat(parsedRules.map(function(rule) {
                return {
                    id: rule.id || createRuleId(),
                    title: rule.title,
                    description: rule.description
                };
            }));
        }

        if (parsedRules && parsedRules.version === 2
            && Array.isArray(parsedRules.rules)
            && parsedRules.rules.every(isValidRule)) {
            return parsedRules.rules;
        }

        throw new Error("Dữ liệu quy định không đúng định dạng.");
    } catch (error) {
        canManageRules = false;
        ruleStatus.textContent = "Không thể tải quy định đã lưu trong trình duyệt.";
        openRuleDialog.disabled = true;
        console.error("Không thể đọc dữ liệu quy định:", error);
        return defaultRules;
    }
}

function createRuleCard(rule, number) {
    const card = document.createElement("article");
    card.className = "rule-card";
    card.dataset.ruleId = rule.id;

    const badge = document.createElement("div");
    badge.className = "rule-number";
    badge.textContent = String(number).padStart(2, "0");

    const content = document.createElement("div");
    content.className = "rule-content";

    const title = document.createElement("h2");
    title.textContent = "Quy định " + number + " - " + rule.title;

    const description = document.createElement("p");
    description.textContent = rule.description;

    const actions = document.createElement("div");
    actions.className = "entry-actions";
    actions.appendChild(createEntryAction("edit-rule", "Sửa", "Sửa quy định"));

    content.appendChild(title);
    content.appendChild(description);
    card.appendChild(badge);
    card.appendChild(content);
    card.appendChild(actions);
    return card;
}

function createEntryAction(action, label, accessibleLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-action-button";
    button.dataset.action = action;
    button.textContent = label;
    button.setAttribute("aria-label", accessibleLabel);
    button.disabled = !canManageRules;
    return button;
}

function renderRules() {
    while (rulesContainer.firstChild) {
        rulesContainer.removeChild(rulesContainer.firstChild);
    }
    rules.forEach(function(rule, index) {
        rulesContainer.appendChild(createRuleCard(rule, index + 1));
    });
}

function saveRules(updatedRules) {
    try {
        localStorage.setItem(ruleStorageKey, JSON.stringify({
            version: 2,
            rules: updatedRules
        }));
        rules = updatedRules;
        ruleStatus.textContent = "";
        renderRules();
        return true;
    } catch (error) {
        ruleStatus.textContent = "Không thể lưu thay đổi quy định. Hãy kiểm tra dung lượng trình duyệt.";
        console.error("Không thể lưu quy định:", error);
        return false;
    }
}

function openRuleEditor(rule) {
    editingRuleId = rule ? rule.id : null;
    ruleForm.reset();
    ruleFormMessage.textContent = "";
    ruleDialogTitle.textContent = rule ? "Sửa quy định" : "Thêm quy định mới";
    saveRuleButton.textContent = rule ? "Lưu thay đổi" : "Thêm quy định";

    if (rule) {
        ruleTitle.value = rule.title;
        ruleDescription.value = rule.description;
    }

    ruleDialog.showModal();
    ruleTitle.focus();
}

function closeRuleDialog() {
    ruleDialog.close();
}

openRuleDialog.addEventListener("click", function() {
    openRuleEditor(null);
});
document.getElementById("closeRuleDialog").addEventListener("click", closeRuleDialog);
document.getElementById("cancelRule").addEventListener("click", closeRuleDialog);
ruleDialog.addEventListener("click", function(event) {
    if (event.target === ruleDialog) {
        const bounds = ruleDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            closeRuleDialog();
        }
    }
});
ruleDialog.addEventListener("close", function() {
    openRuleDialog.focus();
});

rulesContainer.addEventListener("click", function(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
        return;
    }

    const card = button.closest(".rule-card");
    const rule = rules.find(function(item) {
        return item.id === card.dataset.ruleId;
    });
    if (!rule) {
        return;
    }

    if (button.dataset.action === "edit-rule") {
        openRuleEditor(rule);
        return;
    }

});

ruleForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const title = ruleTitle.value.trim();
    const description = ruleDescription.value.trim();
    if (!title || !description) {
        ruleFormMessage.textContent = "Vui lòng nhập tên và nội dung quy định.";
        return;
    }
    if (!canManageRules) {
        ruleFormMessage.textContent = "Không thể lưu quy định vì dữ liệu hiện tại không đọc được.";
        return;
    }

    let updatedRules;
    if (editingRuleId) {
        updatedRules = rules.map(function(rule) {
            return rule.id === editingRuleId
                ? Object.assign({}, rule, { title: title, description: description })
                : rule;
        });
    } else {
        updatedRules = rules.concat({
            id: createRuleId(),
            title: title,
            description: description
        });
    }

    if (!saveRules(updatedRules)) {
        ruleFormMessage.textContent = "Không thể lưu quy định. Hãy kiểm tra dung lượng trình duyệt.";
        return;
    }

    ruleStatus.textContent = editingRuleId ? "Đã sửa quy định." : "Đã thêm quy định.";
    ruleForm.reset();
    editingRuleId = null;
    ruleDialog.close();
});

rules = loadRules();
renderRules();
