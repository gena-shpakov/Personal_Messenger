const regEmail = document.getElementById("regEmail");
const regNickname = document.getElementById("regNickname");
const regPassword = document.getElementById("regPassword");
const regAdminKey = document.getElementById("regAdminKey");
const registerBtn = document.getElementById("registerBtn");
const registerMessage = document.getElementById("registerMessage");

registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = regEmail.value.trim();
  const nickname = regNickname.value.trim();
  const password = regPassword.value.trim();
  const adminKey = regAdminKey.value.trim();

  if (!email || !nickname || !password || !adminKey) {
    registerMessage.textContent = "Заповніть усі поля.";
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nickname, password, adminKey })
    });

    const data = await res.json();
    if (res.ok) {
      registerMessage.style.color = "green";
      registerMessage.textContent = "Адміністратора створено!";
    } else {
      registerMessage.style.color = "red";
      registerMessage.textContent = data.message || "Помилка.";
    }
  } catch (err) {
    registerMessage.textContent = "Помилка мережі.";
  }
});
