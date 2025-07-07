require("dotenv").config();

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
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// Функція для запуску ngrok і отримання публічного URL
async function getNgrokUrl(port) {
  try {
    const url = await ngrok.connect(port);
    console.log(`🌍 Ngrok tunnel URL: ${url}`);
    return url;
  } catch (err) {
    console.error("❌ Помилка запуску ngrok:", err);
    return null;
  }
}

async function startServer() {
  try {
    // Запускаємо ngrok перед іншими налаштуваннями
    const ngrokUrl = await getNgrokUrl(3000);

    // Налаштування CORS з урахуванням ngrok URL
    const allowedOrigins = ["http://localhost:3000"];
    if (ngrokUrl) allowedOrigins.push(ngrokUrl);

    app.use(
      cors({
        origin: function (origin, callback) {
          // Дозволити запити без origin (наприклад, Postman)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS policy: Дозвіл заборонено для origin ${origin}`));
          }
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Безпека HTTP заголовків
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", ngrokUrl || "'self'"],
          },
        },
      })
    );

    // Обмеження частоти запитів (Rate limiting)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 хвилин
      max: 100, // максимум 100 запитів з однієї IP
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    const uri = process.env.MONGODB_URI;
    const JWT_SECRET =
      process.env.JWT_SECRET ||
      "5e9f90ece308f253c69726f539f879c557ca5f6324f0d324eb97a1aff193c6cdf350385b93d0d7ab1221bd7132fd351377b76c35d488b31f693dc2044ea16a51";

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
    usersCollection = db.collection("users");
    messagesCollection = db.collection("messages");

    const onlineUsers = new Map();

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
          socket.emit("error", "Не вдалось завантажити історію");
        }
      });

      socket.on("chat message", async (msg) => {
        try {
          const cleanMsg = sanitizeHtml(msg, { allowedTags: [], allowedAttributes: {} });
          if (!currentUser) {
            socket.emit("error", "Користувач не автентифікований");
            return;
          }
          const messageObj = {
            text: cleanMsg,
            sender: currentUser,
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
        if (currentUser) {
          onlineUsers.delete(socket.id);
          io.emit("online users", Array.from(onlineUsers.values()));
        }
        console.log("🔴 Користувач вийшов");
      });
    });

    // Реєстрація користувача з валідацією
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
        if (existingUser) {
          return res.status(400).json({ message: "Користувач вже існує" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({
          email,
          password: hashedPassword,
          nickname,
          role: "user",
        });
        res.status(201).json({ message: "Користувача створено" });
      }
    );

    // Логін користувача з перевіркою
    app.post(
      "/api/login",
      [
        body("email").isEmail().normalizeEmail(),
        body("password").isLength({ min: 6 }),
      ],
      async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(401).json({ message: "Невірний email або пароль" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
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
      }
    );

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
      const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
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
