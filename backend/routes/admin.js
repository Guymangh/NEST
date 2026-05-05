const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// ─── Admin: Dashboard Stats ───────────────────────────────────────────────────
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [usersResult, productsResult, ordersResult, revenueResult, pendingDeposits] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['user']),
      pool.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'completed'"),
      pool.query("SELECT COUNT(*) FROM deposits WHERE status = 'pending'"),
    ]);

    // Recent activity
    const recentOrders = await pool.query(`
      SELECT o.*, u.username FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 5
    `);

    const recentDeposits = await pool.query(`
      SELECT d.*, u.username FROM deposits d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC LIMIT 5
    `);

    // Revenue by month (last 6 months)
    const monthlyRevenue = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon YYYY') as month,
        EXTRACT(MONTH FROM created_at) as month_num,
        EXTRACT(YEAR FROM created_at) as year,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '6 months'
        AND status = 'completed'
      GROUP BY month, month_num, year
      ORDER BY year, month_num
    `);

    return res.json({
      success: true,
      stats: {
        total_users: parseInt(usersResult.rows[0].count),
        total_products: parseInt(productsResult.rows[0].count),
        total_orders: parseInt(ordersResult.rows[0].count),
        total_revenue: parseFloat(revenueResult.rows[0].total),
        pending_deposits: parseInt(pendingDeposits.rows[0].count),
      },
      recent_orders: recentOrders.rows.map(o => ({ ...o, total: parseFloat(o.total) })),
      recent_deposits: recentDeposits.rows.map(d => ({ ...d, amount: parseFloat(d.amount) })),
      monthly_revenue: monthlyRevenue.rows.map(r => ({ ...r, revenue: parseFloat(r.revenue) })),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get All Users ─────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, username, email, balance, role, is_banned, created_at
      FROM users
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }

    const countResult = await pool.query(
      query.replace('SELECT id, username, email, balance, role, is_banned, created_at', 'SELECT COUNT(*)'),
      params
    );

    query += ' ORDER BY created_at DESC';
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);
    const users = result.rows.map(u => ({ ...u, balance: parseFloat(u.balance) }));

    return res.json({
      success: true,
      users,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Update User ───────────────────────────────────────────────────────
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { balance, role, is_banned, password } = req.body;
    const userId = req.params.id;

    // Prevent admin from editing themselves to non-admin
    if (userId === req.user.id && role === 'user') {
      return res.status(400).json({ success: false, message: "You can't remove your own admin role." });
    }

    let updateFields = [];
    let params = [];
    let paramCount = 0;

    if (balance !== undefined) {
      paramCount++;
      updateFields.push(`balance = $${paramCount}`);
      params.push(parseFloat(balance));
    }
    if (role) {
      paramCount++;
      updateFields.push(`role = $${paramCount}`);
      params.push(role);
    }
    if (is_banned !== undefined) {
      paramCount++;
      updateFields.push(`is_banned = $${paramCount}`);
      params.push(is_banned);
    }
    if (password) {
      paramCount++;
      const hashed = await bcrypt.hash(password, 12);
      updateFields.push(`password = $${paramCount}`);
      params.push(hashed);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    paramCount++;
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, username, email, balance, role, is_banned`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    user.balance = parseFloat(user.balance);
    return res.json({ success: true, message: 'User updated.', user });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Adjust User Balance ───────────────────────────────────────────────
router.post('/users/:id/adjust-balance', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined) {
      return res.status(400).json({ success: false, message: 'Amount is required.' });
    }

    const result = await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING id, username, balance',
      [parseFloat(amount), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    user.balance = parseFloat(user.balance);

    return res.json({
      success: true,
      message: `Balance adjusted by $${parseFloat(amount).toFixed(2)} for ${user.username}`,
      user,
    });
  } catch (error) {
    console.error('Adjust balance error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Public: Wallet Addresses (no auth required) ─────────────────────────────
router.get('/settings/public', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM site_settings WHERE key IN ('btc_wallet', 'usdt_wallet')"
    );
    const settings = {};
    result.rows.forEach(r => (settings[r.key] = r.value));
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('Public settings error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get/Update Site Settings ─────────────────────────────────────────
router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM site_settings ORDER BY key');
    const settings = {};
    result.rows.forEach(r => (settings[r.key] = r.value));
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }

    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    return res.json({ success: true, message: 'Settings updated.' });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Manage Categories ─────────────────────────────────────────────────
router.post('/categories', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const result = await pool.query(
      'INSERT INTO categories (name, slug, description, icon) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, slug, description, icon || 'package']
    );

    return res.status(201).json({ success: true, category: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({ success: false, message: 'Server error or duplicate category.' });
  }
});

router.delete('/categories/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
