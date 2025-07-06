const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Користувач підключився");

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("Користувач вийшов");
  });
});

server.listen(3000,'0.0.0.0', () => {
  console.log("Сервер запущено на http://localhost:3000");
});
