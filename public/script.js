const socket = io();

// Захоплення елементів
const loginWindow = document.getElementById("loginWindow");
const chatWindow = document.getElementById("chatWindow");
const nicknameInput = document.getElementById("nicknameInput");
const enterBtn = document.getElementById("enterBtn");
const displayNickname = document.getElementById("displayNickname");

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

const onlineUsersList = document.getElementById("onlineUsersList");

// Натискання кнопки "Увійти"
enterBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  if (nickname) {
    sessionStorage.setItem("nickname", nickname);
    showChatWindow();
  } else {
    alert("Будь ласка, введіть нікнейм.");
  }
});

// Показати вікно чату
function showChatWindow() {
  const nickname = sessionStorage.getItem("nickname");
  if (nickname) {
    displayNickname.textContent = nickname;
    loginWindow.style.display = "none";
    chatWindow.style.display = "flex";
    input.focus();

    socket.emit("user connected", nickname);)

    // ✅ Після відображення чату — запросити історію повідомлень
    socket.emit("get history");
  } else {
    alert("Будь ласка, введіть нікнейм.");
  }
}

// Якщо нікнейм вже збережено — одразу перейти до чату
if (sessionStorage.getItem("nickname")) {
  showChatWindow();
}

// Надсилання повідомлення
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const nickname = sessionStorage.getItem("nickname");
  const message = input.value.trim();
  if (message) {
    socket.emit("chat message", `${nickname}: ${message}`);
    input.value = "";
  }
});

// ✅ Отримання історії повідомлень
socket.on("chat history", (history) => {
  history.forEach((msgObj) => {
    const item = document.createElement("li");
    item.textContent = msgObj.text;
    messages.appendChild(item);
  });
  messages.scrollTop = messages.scrollHeight;
});

// Отримання нового повідомлення
socket.on("chat message", (msg) => {
  const item = document.createElement("li");
  item.textContent = msg;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

// Отримання списку онлайн користувачів
socket.on("online users", (users) => {
  onlineUsersList.innerHTML = ""; // Очищення списку
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    onlineUsersList.appendChild(li);
  });
});
