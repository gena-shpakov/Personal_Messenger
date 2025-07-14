function initAdminPanel() {
  const token = sessionStorage.getItem("token");

  if (!token) {
    const msg = document.getElementById("authMessage");
    if (msg) msg.textContent = "Немає токена, увійдіть як адміністратор.";
    return;
  }

  const socket = io({ auth: { token } });

  socket.on("connect_error", (err) => {
    const msg = document.getElementById("authMessage");
    if (msg) msg.textContent = "Доступ заборонено. Ви не адміністратор.";
  });

  socket.on("admin allowed", () => {
    const msg = document.getElementById("authMessage");
    if (msg) msg.style.display = "none";

    const content = document.getElementById("adminContent");
    if (content) content.style.display = "block";

    socket.emit("get all users");
    socket.emit("get all messages");
  });

  socket.on("all users", (users) => {
    const list = document.getElementById("allUsersList");
    if (!list) return;

    list.innerHTML = "";
    users.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = u.nickname + (u.isBlocked ? " [🔒]" : "");
      list.appendChild(li);
    });
  });

  socket.on("all messages", (messages) => {
    const list = document.getElementById("allMessagesList");
    if (!list) return;

    list.innerHTML = "";
    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = `${msg.sender}: ${msg.text}`;
      list.appendChild(li);
    });
  });
}

// Запуск після завантаження сторінки
document.addEventListener("DOMContentLoaded", initAdminPanel);
