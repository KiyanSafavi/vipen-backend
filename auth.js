const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'vipen_secret_change_in_prod';

// -------- POST /api/auth/register --------
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  if (password.length < 6)
    return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists)
    return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است' });

  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();

  db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)')
    .run(id, username, hashed);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, username } });
});

// -------- POST /api/auth/login --------
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user)
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// -------- GET /api/auth/me --------
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// -------- middleware export --------
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'توکن ارسال نشده' });

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'توکن نامعتبر است' });
  }
}

module.exports = { router, authenticate };