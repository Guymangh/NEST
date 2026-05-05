const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// ─── Register ───────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ success: false, message: 'Username must be 3-30 characters.' });
    }

    // Check existing
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email or username already in use.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, balance, role, created_at`,
      [username.toLowerCase(), email.toLowerCase(), hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned. Contact support.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── Get Current User ────────────────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, role, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    user.balance = parseFloat(user.balance);
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Update Profile ───────────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // Check uniqueness (exclude current user)
    const conflict = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase(), req.user.id]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const result = await pool.query(
      `UPDATE users SET email = $1 WHERE id = $2
       RETURNING id, username, email, balance, role, avatar, created_at`,
      [email.toLowerCase(), req.user.id]
    );
    const user = result.rows[0];
    user.balance = parseFloat(user.balance);

    return res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Change Password (PUT = user profile, POST = admin settings form) ─────────
async function handleChangePassword(req, res) {
  try {
    // Accept both camelCase (old) and snake_case (new form)
    const currentPassword = req.body.current_password || req.body.currentPassword;
    const newPassword     = req.body.new_password     || req.body.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    }

    const result  = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

router.put('/change-password',  authMiddleware, handleChangePassword);
router.post('/change-password', authMiddleware, handleChangePassword);

module.exports = router;
