require("dotenv").config(); // має бути ПЕРШИМ!

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// === Підключення до MongoDB через змінну середовища ===
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function startServer() {
  try {
    await client.connect();
    console.log("✅ Підключено до MongoDB Atlas");

    const db = client.db("chat"); // назва бази
    const messagesCollection = db.collection("messages"); // колекція повідомлень

    app.use(express.static("public"));

    io.on("connection", (socket) => {
      console.log("Користувач підключився");

      socket.on("chat message", async (msg) => {
        // Збереження повідомлення в базу
        await messagesCollection.insertOne({
          text: msg,
          timestamp: new Date(),
        });

        io.emit("chat message", msg);
      });

      socket.on("disconnect", () => {
        console.log("Користувач вийшов");
      });
    });

    server.listen(3000, "0.0.0.0", () => {
      console.log("🚀 Сервер запущено на http://localhost:3000");
    });
  } catch (error) {
    console.error("❌ Помилка підключення до MongoDB:", error);
  }
}

startServer();
