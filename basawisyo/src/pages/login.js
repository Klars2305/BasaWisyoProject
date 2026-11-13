AUTH.init();
if (AUTH.currentUser) {
  window.location.replace("index.html");
}

const loginForm = document.querySelector("#entry-login-form");
const loginEmail = document.querySelector("#entry-email");
const loginPassword = document.querySelector("#entry-password");
const loginError = document.querySelector("#entry-error");
const passwordToggle = document.querySelector("#entry-toggle-password");

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = !message;
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  const result = AUTH.login(loginEmail.value, loginPassword.value);
  if (!result.success) {
    showLoginError(result.message);
    return;
  }

  try {
    const savedSession = JSON.parse(localStorage.getItem(AUTH.SESSION_KEY) || "null");
    if (savedSession?.id !== result.user.id) throw new Error("Session was not saved");
  } catch (error) {
    AUTH.logout();
    showLoginError("Sign-in could not be saved in this browser. Check browser storage settings and try again.");
    return;
  }

  loginPassword.value = "";
  window.location.replace("index.html");
});

loginEmail.addEventListener("input", () => showLoginError(""));
loginPassword.addEventListener("input", () => showLoginError(""));

passwordToggle.addEventListener("click", () => {
  const show = loginPassword.type === "password";
  loginPassword.type = show ? "text" : "password";
  passwordToggle.textContent = show ? "Hide" : "Show";
  passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  passwordToggle.setAttribute("aria-pressed", String(show));
});
