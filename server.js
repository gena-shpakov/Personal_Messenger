require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());               // Парсинг JSON у POST-запитах
app.use(express.static("public"));    // Статичні файли з папки "public"

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "5e9f90ece308f253c69726f539f879c557ca5f6324f0d324eb97a1aff193c6cdf350385b93d0d7ab1221bd7132fd351377b76c35d488b31f693dc2044ea16a51";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let usersCollection;
let messagesCollection;

const onlineUsers = new Map();

async function startServer() {
  try {
    await client.connect();
    console.log("✅ Підключено до MongoDB Atlas");

    const db = client.db("chat");
    usersCollection = db.collection("users");
    messagesCollection = db.collection("messages");

    // Socket.io логіка
    io.on("connection", (socket) => {
      console.log("🟢 Користувач підключився");
      let currentUser = null;

      socket.on("user connected", (nickname) => {
        currentUser = nickname;
        onlineUsers.set(socket.id, nickname);
        io.emit("online users", Array.from(onlineUsers.values()));
      });

      socket.on("get history", async () => {
        try {
          const history = await messagesCollection.find({}).sort({ timestamp: 1 }).toArray();
          socket.emit("chat history", history);
        } catch (error) {
          console.error("❌ Помилка отримання історії:", error);
        }
      });

      socket.on("chat message", async (msg) => {
        try {
          await messagesCollection.insertOne({ text: msg, timestamp: new Date() });
          io.emit("chat message", msg);
        } catch (error) {
          console.error("❌ Помилка збереження повідомлення:", error);
        }
      });

      socket.on("disconnect", () => {
        if (currentUser) {
          onlineUsers.delete(socket.id);
          io.emit("online users", Array.from(onlineUsers.values()));
        }
        console.log("🔴 Користувач вийшов");
      });
    });

    // Реєстрація користувача
    app.post("/api/register", async (req, res) => {
      const { email, password, nickname } = req.body;
      if (!email || !password || !nickname) {
        return res.status(400).json({ message: "Всі поля потрібні" });
      }
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Користувач вже існує" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await usersCollection.insertOne({ email, password: hashedPassword, nickname, role: "user" });
      res.status(201).json({ message: "Користувача створено" });
    });

    // Логін користувача
    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Вкажіть email та пароль" });
      }
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Невірний email або пароль" });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Невірний email або пароль" });
      }
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, nickname: user.nickname },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.json({ token, nickname: user.nickname });
    });

    // Middleware для захисту роутів
    function authenticateToken(req, res, next) {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Токен відсутній" });
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Недійсний токен" });
        req.user = user;
        next();
      });
    }

    // Захищений роут профілю
    app.get("/api/profile", authenticateToken, async (req, res) => {
      const user = await usersCollection.findOne(
        { _id: new ObjectId(req.user.userId) },
        { projection: { password: 0 } }
      );
      res.json(user);
    });

    server.listen(3000, "0.0.0.0", () => {
      console.log("🚀 Сервер запущено на http://localhost:3000");
    });
  } catch (error) {
    console.error("❌ Помилка підключення до MongoDB:", error);
  }
}

startServer();
