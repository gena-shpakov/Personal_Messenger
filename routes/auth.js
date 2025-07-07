const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const router = express.Router();
const User = require("../models/User");

router.post("/register",
  [
    body("username").notEmpty().withMessage("Ім'я обов'язкове"),
    body("password").isLength({ min: 5 }).withMessage("Мінімум 5 символів")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;

    try {
      // Чи існує вже такий користувач?
      const existingUser = await User.findOne({ username });
      if (existingUser) return res.status(400).json({ error: "Користувач вже існує" });

      // Хешування паролю
      const hashedPassword = await bcrypt.hash(password, 10);

      // Створення користувача
      const newUser = new User({ username, password: hashedPassword });
      await newUser.save();

      res.status(201).json({ message: "Користувач зареєстрований!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Помилка сервера" });
    }
  }
);

module.exports = router;
