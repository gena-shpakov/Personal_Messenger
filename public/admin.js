const token = sessionStorage.getItem("token");

if (!token) {
  document.getElementById("authMessage").textContent = "Немає токена, увійдіть як адміністратор.";
  return;
}

const socket = io({ auth: { token } });

socket.on("connect_error", (err) => {
  document.getElementById("authMessage").textContent = "Доступ заборонено. Ви не адміністратор.";
});

socket.on("admin allowed", () => {
  document.getElementById("authMessage").style.display = "none";
  document.getElementById("adminContent").style.display = "block";

  socket.emit("get all users");
  socket.emit("get all messages");
});

socket.on("all users", (users) => {
  const list = document.getElementById("allUsersList");
  list.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u.nickname + (u.isBlocked ? " [🔒]" : "");
    list.appendChild(li);
  });
});

socket.on("all messages", (messages) => {
  const list = document.getElementById("allMessagesList");
  list.innerHTML = "";
  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = `${msg.sender}: ${msg.text}`;
    list.appendChild(li);
  });
});
