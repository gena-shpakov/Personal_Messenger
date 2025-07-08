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
const { startNgrok } = require("./ngrokHelper"); // ✅ Імпорт ngrok з окремого файлу

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

async function startServer() {
  try {
    // ✅ Запуск ngrok
    const ngrokUrl = await startNgrok(3000);

    // ✅ Дозволені origin-джерела
    const allowedOrigins = ["http://localhost:3000"];
    if (ngrokUrl) allowedOrigins.push(ngrokUrl);

    // ✅ CORS
    app.use(cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        } else {
          return callback(new Error("CORS policy: Заборонено для origin " + origin));
        }
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }));

    // ✅ HTTP-захист через helmet
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

    // ✅ Rate limiting
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }));

    // ✅ MongoDB підключення
    const uri = process.env.MONGODB_URI;
    const JWT_SECRET = process.env.JWT_SECRET || "your_default_jwt_secret";

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

    // ✅ Socket.io логіка
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

    // ✅ Реєстрація
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
        await usersCollection.insertOne({
          email,
          password: hashedPassword,
          nickname,
          role: "user",
        });
        res.status(201).json({ message: "Користувача створено" });
      }
    );

    // ✅ Логін
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
      }
    );

    // ✅ Middleware авторизації
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

    // ✅ Захищений маршрут
    app.get("/api/profile", authenticateToken, async (req, res) => {
      const user = await usersCollection.findOne(
        { _id: new ObjectId(req.user.userId) },
        { projection: { password: 0 } }
      );
      res.json(user);
    });

    // ✅ Запуск сервера
    server.listen(3000, "0.0.0.0", () => {
      console.log("🚀 Сервер запущено на http://localhost:3000");
    });
  } catch (error) {
    console.error("❌ Помилка підключення:", error);
  }
}

startServer();
