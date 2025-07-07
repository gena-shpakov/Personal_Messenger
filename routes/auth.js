const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const router = express.Router();

module.exports = function (usersCollection, JWT_SECRET) {
  // Реєстрація
  router.post("/register",
    [
      body("email").isEmail().withMessage("Невірна електронна адреса"),
      body("password").isLength({ min: 5 }).withMessage("Мінімум 5 символів"),
      body("nickname").notEmpty().withMessage("Нікнейм обов'язковий")
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password, nickname } = req.body;

      try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Користувач вже існує" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({
          email,
          password: hashedPassword,
          nickname,
          role: "user"
        });

        res.status(201).json({ message: "Користувача створено" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Помилка сервера" });
      }
    }
  );

  // Авторизація
  router.post("/login",
    [
      body("email").isEmail().withMessage("Невірна електронна адреса"),
      body("password").notEmpty().withMessage("Пароль обов’язковий")
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(401).json({ message: "Невірний email або пароль" });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: "Невірний email або пароль" });

        const token = jwt.sign(
          { userId: user._id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "1h" }
        );

        res.json({ token, nickname: user.nickname });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Помилка сервера" });
      }
    }
  );

  return router;
};
