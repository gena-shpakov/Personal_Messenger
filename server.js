// ✅ Оновлений server.js з JWT-перевіркою для Socket.io
const envPath = process.env.NODE_ENV === "production" ? "/etc/secrets/.env" : ".env";
require("dotenv").config({ path: envPath });

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // дозвіл для всіх frontend-доменів
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

app.use(express.json());
app.use(express.static("public"));

async function startServer() {
  try {
    // HTTP-захист через helmet
    app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );

    // Rate limiting
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    // Підключення до MongoDB
    const uri = process.env.MONGODB_URI;
    const JWT_SECRET = process.env.JWT_SECRET || "5e9f90ece308f253c69726f539f879c557ca5f6324f0d324eb97a1aff193c6cdf350385b93d0d7ab1221bd7132fd351377b76c35d488b31f693dc2044ea16a51";

    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    console.log("✅ Підключено до MongoDB Atlas");

    const db = client.db("chat");
    const usersCollection = db.collection("users");
    const messagesCollection = db.collection("messages");

    const onlineUsers = new Map();

    // ✅ Перевірка JWT перед підключенням
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Неавторизовано: токен відсутній"));
      }

      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error("Недійсний токен"));
        socket.user = user;
        next();
      });
    });

    // ✅ Socket.io логіка з автентифікацією
    io.on("connection", (socket) => {
      console.log("🟢 Користувач підключився", socket.user.nickname);

      const currentUser = socket.user.nickname;
      onlineUsers.set(socket.id, currentUser);
      io.emit("online users", Array.from(onlineUsers.values()));

      socket.on("get history", async () => {
        try {
          const history = await messagesCollection.find({}).sort({ timestamp: 1 }).toArray();
          socket.emit("chat history", history);
        } catch (error) {
          console.error("❌ Помилка отримання історії:", error);
          socket.emit("error", "Не вдалось завантажити історію");
        }
      });

      socket.on("chat message", async (msg) => {
        try {
          const cleanMsg = sanitizeHtml(msg, { allowedTags: [], allowedAttributes: {} });
          const messageObj = {
            text: cleanMsg,
            sender: socket.user.nickname,
            timestamp: new Date(),
          };
          await messagesCollection.insertOne(messageObj);
          io.emit("chat message", messageObj);
        } catch (error) {
          console.error("❌ Помилка збереження повідомлення:", error);
          socket.emit("error", "Не вдалось відправити повідомлення");
        }
      });

      socket.on("disconnect", () => {
        onlineUsers.delete(socket.id);
        io.emit("online users", Array.from(onlineUsers.values()));
        console.log("🔴 Користувач вийшов", currentUser);
      });
    });

    // Реєстрація
    app.post(
      "/api/register",
      [
        body("email").isEmail().normalizeEmail(),
        body("nickname").trim().isLength({ min: 3 }),
        body("password").isLength({ min: 6 }),
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { email, password, nickname } = req.body;
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Користувач вже існує" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ email, password: hashedPassword, nickname, role: "user" });
        res.status(201).json({ message: "Користувача створено" });
      }
    );

    // Логін
    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Невірний email або пароль" });
      }

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role,
          nickname: user.nickname,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ token, nickname: user.nickname });
    });

    // Захищений маршрут
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

    app.get("/api/profile", authenticateToken, async (req, res) => {
      const user = await usersCollection.findOne(
        { _id: new ObjectId(req.user.userId) },
        { projection: { password: 0 } }
      );
      res.json(user);
    });

    // Healthcheck для Render
    app.get("/health", (req, res) => res.send("OK"));

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Сервер запущено на порті ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Помилка підключення:", error);
  }
}

startServer();