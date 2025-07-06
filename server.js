// Завантаження змінних середовища з файлу .env
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();                    // Створення екземпляру Express
const server = http.createServer(app);    // Створення HTTP-сервера
const io = new Server(server);            // Ініціалізація Socket.io

// Отримання MongoDB URI з файлу .env
const uri = process.env.MONGODB_URI;

// Налаштування MongoDB клієнта
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const onlineUsers = new Map(); // Збереження онлайн-користувачів

async function startServer() {
  try {
    // Підключення до MongoDB
    await client.connect();
    console.log("✅ Підключено до MongoDB Atlas");

    // Вибір бази та колекції
    const db = client.db("chat");
    const messagesCollection = db.collection("messages");

    // Статичні файли (HTML, CSS, JS) — папка "public"
    app.use(express.static("public"));

    // Обробка нових підключень через Socket.io
    io.on("connection", (socket) => {
      console.log("🟢 Користувач підключився");
      let currentUser = null;

      // Підключення користувача з нікнеймом
      socket.on("user connected", (nickname) => {
        currentUser = nickname;
        onlineUsers.set(socket.id, nickname);
        io.emit("online users", Array.from(onlineUsers.values()));
      });

      // Відправка історії повідомлень новому користувачу
      socket.on("get history", async () => {
        try {
          const history = await messagesCollection
            .find({})
            .sort({ timestamp: 1 })
            .toArray();
          socket.emit("chat history", history);
        } catch (error) {
          console.error("❌ Помилка отримання історії:", error);
        }
      });

      // Отримання повідомлення та збереження його у БД
      socket.on("chat message", async (msg) => {
        try {
          await messagesCollection.insertOne({
            text: msg,
            timestamp: new Date(),
          });
          io.emit("chat message", msg);
        } catch (error) {
          console.error("❌ Помилка збереження повідомлення:", error);
        }
      });

      // Відключення користувача
      socket.on("disconnect", () => {
        if (currentUser) {
          onlineUsers.delete(socket.id);
          io.emit("online users", Array.from(onlineUsers.values()));
        }
        console.log("🔴 Користувач вийшов");
      });
    });

    // Запуск сервера
    server.listen(3000, "0.0.0.0", () => {
      console.log("🚀 Сервер запущено на http://localhost:3000");
    });

  } catch (error) {
    console.error("❌ Помилка підключення до MongoDB:", error);
  }
}

// Старт сервера
startServer();
