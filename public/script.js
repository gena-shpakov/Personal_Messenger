// Отримання токена
const token = sessionStorage.getItem("token");

// Ініціалізація socket з передачею токена
const socket = io({
  auth: { token },
});

// Захоплення елементів
const loginWindow = document.getElementById("loginWindow");
const registerWindow = document.getElementById("registerWindow");
const chatWindow = document.getElementById("chatWindow");
const displayNickname = document.getElementById("displayNickname");

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const onlineUsersList = document.getElementById("onlineUsersList");

// Поля для реєстрації
const regEmail = document.getElementById("regEmail");
const regNickname = document.getElementById("regNickname");
const regPassword = document.getElementById("regPassword");
const registerBtn = document.getElementById("registerBtn");
const registerMessage = document.getElementById("registerMessage");

// Поля для входу
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

// Перемикачі між вікнами
const showRegisterLink = document.getElementById("showRegister");
const showLoginLink = document.getElementById("showLogin");

showRegisterLink.addEventListener("click", (e) => {
  e.preventDefault();
  loginWindow.style.display = "none";
  registerWindow.style.display = "flex";
});

showLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  registerWindow.style.display = "none";
  loginWindow.style.display = "flex";
});

// Реєстрація
registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = regEmail.value.trim();
  const nickname = regNickname.value.trim();
  const password = regPassword.value.trim();

  if (!email || !nickname || !password) {
    registerMessage.textContent = "Будь ласка, заповніть всі поля.";
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nickname, password }),
    });
    const data = await res.json();

    if (res.ok) {
      registerMessage.style.color = "green";
      registerMessage.textContent = "Реєстрація успішна! Увійдіть.";
      setTimeout(() => {
        registerWindow.style.display = "none";
        loginWindow.style.display = "flex";
        registerMessage.textContent = "";
      }, 1500);
    } else {
      registerMessage.style.color = "red";
      registerMessage.textContent = data.message || "Помилка.";
    }
  } catch (err) {
    registerMessage.textContent = "Помилка мережі.";
  }
});

// Вхід
loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  loginMessage.style.color = "red";
  loginMessage.textContent = "";

  if (!email || !password) {
    loginMessage.textContent = "Заповніть усі поля.";
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      loginMessage.textContent = data.message || "Помилка входу";
      return;
    }

    if (data.token) {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("nickname", data.nickname);
      sessionStorage.setItem("role", data.role);

      if (data.role === "admin") {
        window.location.href = "admin.html";
      } else {
        location.reload();
      }
    } else {
      loginMessage.textContent = "Невідома помилка";
    }

  } catch (err) {
    loginMessage.textContent = "Помилка мережі або сервера";
  }
  });

// Показати вікно чату
function showChatWindow() {
  const nickname = sessionStorage.getItem("nickname");
  if (nickname) {
    displayNickname.textContent = nickname;
    loginWindow.style.display = "none";
    registerWindow.style.display = "none";
    chatWindow.style.display = "flex";
    input.focus();

    socket.emit("user connected", nickname);
    socket.emit("get history");
  }
}

if (sessionStorage.getItem("nickname") && sessionStorage.getItem("token")) {
  showChatWindow();
}

// Рендер повідомлення
function renderMessage(msgObj) {
  const li = document.createElement("li");

  const nickname = sessionStorage.getItem("nickname");
  const isOwnMessage = msgObj.sender === nickname;

  li.classList.add(isOwnMessage ? "own" : "other");

  const nicknameEl = document.createElement("div");
  nicknameEl.classList.add("message-nickname");
  nicknameEl.textContent = msgObj.sender;

  const textEl = document.createElement("div");
  textEl.classList.add("message-text");
  textEl.textContent = msgObj.text;

  li.appendChild(nicknameEl);
  li.appendChild(textEl);

  li.style.animation = "fadeIn 0.5s ease-in-out";
  return li;
}

// Надсилання повідомлення
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (message) {
    socket.emit("chat message", message);
    input.value = "";
  }
});

// Отримання історії повідомлень
socket.on("chat history", (history) => {
  messages.innerHTML = "";
  history.forEach((msgObj) => {
    const item = renderMessage(msgObj);
    messages.appendChild(item);
  });
  messages.scrollTop = messages.scrollHeight;
});

// Отримання нового повідомлення
socket.on("chat message", (msgObj) => {
  const item = renderMessage(msgObj);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

// Онлайн користувачі
socket.on("online users", (users) => {
  onlineUsersList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    onlineUsersList.appendChild(li);
  });
});

// Темна / світла тема
const themeToggle = document.getElementById("themeToggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "☀️ Світла тема";
}

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  themeToggle.textContent = isDark ? "☀️ Світла тема" : "🌙 Темна тема";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// ===================== 🔒 Обробка видаленого акаунта ======================
socket.on("force logout", (msg) => {
  alert(msg || "Сесію завершено. Увійдіть знову.");
  sessionStorage.clear();
  window.location.href = "/";
});

// Обробка WebSocket помилок
socket.on("connect_error", (err) => {
  console.error("Помилка WebSocket:", err.message);
  if (err.message.includes("токен") || err.message.includes("Користувача")) {
    alert("Помилка автентифікації. Увійдіть повторно.");
    sessionStorage.clear();
    window.location.href = "/";
  }
});