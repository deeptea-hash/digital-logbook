const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const router = express.Router();

/**
 * Hardcoded demo users, per the task's "simple auth assumption is fine"
 * allowance. `admin` represents "the college" (can upload templates and
 * define fields). `student1` / `student2` represent students filling
 * records, used to demonstrate per-user data isolation.
 */
const USERS = [
  { id: '11111111-1111-4111-8111-111111111111', username: 'admin', role: 'admin' },
  { id: '22222222-2222-4222-8222-222222222222', username: 'student1', role: 'student' },
  { id: '33333333-3333-4333-8333-333333333333', username: 'student2', role: 'student' },
];

router.get('/users', (req, res) => {
  // Convenience endpoint so the frontend login screen can list demo accounts
  // without hardcoding them in two places.
  res.json(USERS.map((u) => ({ username: u.username, role: u.role })));
});

router.post('/login', (req, res) => {
  const { username } = req.body || {};
  const user = USERS.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Unknown demo user' });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

module.exports = router;
