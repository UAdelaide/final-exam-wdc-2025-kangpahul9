const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, username, email, role FROM Users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const {
    username, email, password, role
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, password, role]);

    res.status(201).json({ message: 'User registered', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET currently logged-in user session
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

// Answer to Q13 - Validate user credentials and create session
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.query('SELECT * FROM Users WHERE username = ? AND password_hash = ?', [username, password]);

  if (rows.length === 1) {
    const user = rows[0];
    req.session.user = {
      id: user.user_id,
      username: user.username,
      role: user.role
    };

    // Redirect based on user role
    if (user.role === 'owner') return res.json({ redirect: '/owner-dashboard.html' });
    if (user.role === 'walker') return res.json({ redirect: '/walker-dashboard.html' });

    return res.status(400).json({ message: 'Unknown user role' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});


// Answer to Q14 - Destroy session and redirect to login
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Remove session cookie
    return res.redirect('/');// Redirect to login form
  });
});

module.exports = router;
