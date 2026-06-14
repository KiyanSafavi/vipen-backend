const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { authenticate } = require('./auth');

// ============================================================
//  CHANNELS
// ============================================================

// GET /api/channels — لیست همه کانال‌ها
router.get('/', (req, res) => {
  const channels = db.prepare(`
    SELECT c.*, u.username AS owner_name,
           (SELECT COUNT(*) FROM songs s WHERE s.channel_id = c.id) AS song_count,
           (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = c.id) AS member_count
    FROM channels c
    JOIN users u ON c.owner_id = u.id
    ORDER BY c.created_at DESC
  `).all();
  res.json({ channels });
});

// GET /api/channels/:id — یک کانال با آهنگ‌هایش
router.get('/:id', (req, res) => {
  const channel = db.prepare(`
    SELECT c.*, u.username AS owner_name
    FROM channels c
    JOIN users u ON c.owner_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });

  const songs = db.prepare(
    'SELECT * FROM songs WHERE channel_id = ? ORDER BY order_idx ASC, added_at ASC'
  ).all(req.params.id);

  res.json({ channel, songs });
});

// POST /api/channels — ساخت کانال جدید (نیاز به لاگین)
router.post('/', authenticate, (req, res) => {
  const { name, description, cover_url } = req.body;
  if (!name) return res.status(400).json({ error: 'نام کانال الزامی است' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO channels (id, name, description, cover_url, owner_id) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, description || '', cover_url || '', req.user.id);

  // سازنده کانال به عنوان admin عضو می‌شه
  db.prepare(
    'INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)'
  ).run(id, req.user.id, 'admin');

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  res.status(201).json({ channel });
});

// PUT /api/channels/:id — ویرایش کانال (فقط owner)
router.put('/:id', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'فقط مالک کانال می‌تواند آن را ویرایش کند' });

  const { name, description, cover_url } = req.body;
  db.prepare(
    'UPDATE channels SET name = ?, description = ?, cover_url = ? WHERE id = ?'
  ).run(
    name        ?? channel.name,
    description ?? channel.description,
    cover_url   ?? channel.cover_url,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  res.json({ channel: updated });
});

// DELETE /api/channels/:id — حذف کانال (فقط owner)
router.delete('/:id', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'فقط مالک کانال می‌تواند آن را حذف کند' });

  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
  res.json({ message: 'کانال حذف شد' });
});

// ============================================================
//  SONGS
// ============================================================

// POST /api/channels/:id/songs — اضافه کردن آهنگ
router.post('/:id/songs', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'فقط مالک کانال می‌تواند آهنگ اضافه کند' });

  const { title, artist, url, duration } = req.body;
  if (!title || !url) return res.status(400).json({ error: 'عنوان و لینک آهنگ الزامی است' });

  // بررسی معتبر بودن URL
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'لینک آهنگ معتبر نیست' });
  }

  const maxOrder = db.prepare(
    'SELECT MAX(order_idx) as m FROM songs WHERE channel_id = ?'
  ).get(req.params.id);

  const id = uuidv4();
  db.prepare(
    'INSERT INTO songs (id, channel_id, title, artist, url, duration, order_idx) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.id, title, artist || '', url, duration || 0, (maxOrder.m ?? -1) + 1);

  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  res.status(201).json({ song });
});

// PUT /api/channels/:channelId/songs/:songId — ویرایش آهنگ
router.put('/:channelId/songs/:songId', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'دسترسی ندارید' });

  const song = db.prepare('SELECT * FROM songs WHERE id = ? AND channel_id = ?')
    .get(req.params.songId, req.params.channelId);
  if (!song) return res.status(404).json({ error: 'آهنگ پیدا نشد' });

  const { title, artist, url, duration } = req.body;
  db.prepare(
    'UPDATE songs SET title = ?, artist = ?, url = ?, duration = ? WHERE id = ?'
  ).run(
    title    ?? song.title,
    artist   ?? song.artist,
    url      ?? song.url,
    duration ?? song.duration,
    song.id
  );

  const updated = db.prepare('SELECT * FROM songs WHERE id = ?').get(song.id);
  res.json({ song: updated });
});

// DELETE /api/channels/:channelId/songs/:songId — حذف آهنگ
router.delete('/:channelId/songs/:songId', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'دسترسی ندارید' });

  db.prepare('DELETE FROM songs WHERE id = ? AND channel_id = ?')
    .run(req.params.songId, req.params.channelId);
  res.json({ message: 'آهنگ حذف شد' });
});

// PUT /api/channels/:id/songs/reorder — تغییر ترتیب آهنگ‌ها
router.put('/:id/songs/reorder', authenticate, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'کانال پیدا نشد' });
  if (channel.owner_id !== req.user.id)
    return res.status(403).json({ error: 'دسترسی ندارید' });

  const { order } = req.body; // آرایه‌ای از { id, order_idx }
  if (!Array.isArray(order)) return res.status(400).json({ error: 'فرمت اشتباه' });

  const update = db.prepare('UPDATE songs SET order_idx = ? WHERE id = ? AND channel_id = ?');
  const updateMany = db.transaction((items) => {
    for (const item of items) update.run(item.order_idx, item.id, req.params.id);
  });
  updateMany(order);

  res.json({ message: 'ترتیب به‌روز شد' });
});

module.exports = router;