const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#form-message");

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";
    const submitButton = loginForm.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const formData = new FormData(loginForm);
    try {
        await window.OrangeAuth.request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                username: formData.get("username"),
                password: formData.get("password"),
            }),
        });
        window.location.assign(window.OrangeAuth.getNextPath());
    } catch (error) {
        loginMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});
