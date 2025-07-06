const socket = io();

const loginWindow = document.getElementById("loginWindow");
const chatWindow = document.getElementById("chatWindow");
const nicknameInput = document.getElementById("nicknameInput");
const enterBtn = document.getElementById('enterButton');
const displayNickname = document.getElementById('displayNickname');

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

//обробка для кнопки входу
enterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  if (nickname) {
    sessionStorage.setItem('nickname', nickname);
    showChatWindow();
  } else {
    alert("Please enter a nickname.");
  }
});  

//Показати чат і приховати форму логіну
function showChatWindow() {
  const nickname = sessionStorage.getItem('nickname');
  if (nickname) {
    displayNickname.textContent = nickname;
    loginWindow.style.display = "none";
    chatWindow.style.display = "block";
    input.focus();
  } else {
    alert("Please enter a nickname.");
  }
}

// Якщо нікнейм не збережений - показати чат одразу
if (sessionStorage.getItem('nickname')) {
  showChatWindow();
}

// Відправка повідомлення з нікнеймом
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const nickname = sessionStorage.getItem('nickname');
  const message = input.value.trim();
  if (message) {
    socket.emit("chat message", `${nickname}: ${message}`);
    input.value = "";
  }
});

// Отримання повідомлення 
socket.on("chat message", (msg) => {
  const item = document.createElement("li");
  item.textContent = msg;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});
