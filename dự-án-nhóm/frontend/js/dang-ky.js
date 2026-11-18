const registerForm = document.querySelector("#register-form");
const registerMessage = document.querySelector("#form-message");
const usernameInput = document.querySelector("#username");

function validateUsername() {
    if (!(usernameInput instanceof HTMLInputElement)) {
        return;
    }

    usernameInput.setCustomValidity(
        usernameInput.value && usernameInput.validity.patternMismatch
            ? "Tên đăng nhập không được có dấu; chỉ dùng chữ A-Z, chữ số và dấu gạch dưới."
            : "",
    );
}

usernameInput?.addEventListener("input", validateUsername);
usernameInput?.addEventListener("invalid", validateUsername);

registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    registerMessage.textContent = "";
    const submitButton = registerForm.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const formData = new FormData(registerForm);
    try {
        await window.OrangeAuth.request("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username: formData.get("username"),
                display_name: formData.get("display_name"),
                password: formData.get("password"),
                password_confirmation: formData.get("password_confirmation"),
            }),
        });
        window.location.assign(window.OrangeAuth.getNextPath());
    } catch (error) {
        registerMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});
