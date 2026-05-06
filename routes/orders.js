const express = require('express');
const crypto  = require('crypto');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// ─── One-Time Credential Token Store ─────────────────────────────────────────
const revealTokens    = new Map();
const revealRateLimit = new Map();

const TOKEN_TTL_MS   = 60 * 1000;
const RATE_LIMIT_MAX = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const REVEAL_FEE     = 350; // $350 deducted from balance each time credentials are revealed

// Get user's current balance
async function getUserBalance(userId) {
  try {
    const r = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    return parseFloat(r.rows[0].balance);
  } catch { return 0; }
}

// Auto-clean expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [tok, val] of revealTokens) {
    if (val.expires < now) revealTokens.delete(tok);
  }
}, 5 * 60 * 1000);

// ─── Purchase alias ───────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res, next) => {
  req.url = '/buy';
  router.handle(req, res, next);
});

// ─── Purchase a Product ───────────────────────────────────────────────────────
router.post('/buy', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    await client.query('BEGIN');

    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Product not found or unavailable.' });
    }

    const product = productResult.rows[0];
    const qty = parseInt(quantity, 10);

    if (isNaN(qty) || qty < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number.' });
    }

    const total = parseFloat(product.price) * qty;

    if (product.stock !== -1 && product.stock < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Insufficient stock. Only ${product.stock} available.` });
    }

    const userResult = await client.query(
      'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    const user = userResult.rows[0];
    const userBalance = parseFloat(user.balance);

    if (userBalance < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. You need $${total.toFixed(2)} but have $${userBalance.toFixed(2)}.`,
        required: total,
        balance: userBalance,
      });
    }

    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [total, req.user.id]
    );

    const newStock = product.stock === -1 ? -1 : product.stock - qty;
    const isActive = newStock === -1 ? true : newStock > 0;

    await client.query(
      'UPDATE products SET stock = $1, is_active = $2 WHERE id = $3',
      [newStock, isActive, product_id]
    );

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, product_id, product_name, quantity, unit_price, total, status, product_data)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7)
       RETURNING *`,
      [req.user.id, product_id, product.name, qty, product.price, total, product.product_data]
    );

    await client.query('COMMIT');

    const order = orderResult.rows[0];
    order.total = parseFloat(order.total);
    order.unit_price = parseFloat(order.unit_price);

    const updatedUser = await pool.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
    const newBalance = parseFloat(updatedUser.rows[0].balance);

    return res.json({ success: true, message: 'Purchase successful! 🎉', order, new_balance: newBalance });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Purchase failed.' });
  } finally {
    client.release();
  }
});

// ─── Get User Orders ──────────────────────────────────────────────────────────
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT o.*, p.image_url, c.name as category_name
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM orders WHERE user_id = $1', [req.user.id]);

    const orders = result.rows.map(o => ({
      ...o,
      total: parseFloat(o.total),
      unit_price: parseFloat(o.unit_price),
    }));

    return res.json({
      success: true,
      orders,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get All Orders ────────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*, u.username, u.email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);
    const countParams = status ? [status] : [];
    const countQuery = `SELECT COUNT(*) FROM orders${status ? ' WHERE status = $1' : ''}`;
    const countResult = await pool.query(countQuery, countParams);
    const orders = result.rows.map(o => ({ ...o, total: parseFloat(o.total), unit_price: parseFloat(o.unit_price) }));
    return res.json({ success: true, orders, total: parseInt(countResult.rows[0].count) });

  } catch (error) {
    console.error('Admin get orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get Refunded Logs ─────────────────────────────────────────────────
router.get('/admin/refunded', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT rl.*, u.username, u.email
       FROM refunded_logs rl
       LEFT JOIN users u ON rl.user_id = u.id
       ORDER BY rl.refunded_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM refunded_logs');

    return res.json({
      success: true,
      logs: result.rows.map(r => ({ ...r, refunded_amount: parseFloat(r.refunded_amount) })),
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Refunded logs error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Refund Order ──────────────────────────────────────────────────────
router.post('/admin/refund/:id', authMiddleware, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orderResult.rows[0];
    if (order.status === 'refunded') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Order already refunded.' });
    }

    // 1. Refund user balance
    await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [order.total, order.user_id]);

    // 2. Save credentials to refunded_logs BEFORE wiping
    if (order.product_data) {
      await client.query(
        `INSERT INTO refunded_logs
           (order_id, user_id, product_id, product_name, recovered_data, refunded_amount, refunded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (order_id) DO NOTHING`,
        [order.id, order.user_id, order.product_id, order.product_name, order.product_data, order.total]
      );
    }

    // 3. Wipe credentials, mark refunded
    await client.query(
      `UPDATE orders SET status = 'refunded', product_data = NULL WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    return res.json({ success: true, message: `$${parseFloat(order.total).toFixed(2)} refunded to user.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refund error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// ─── Get Single Order (no credentials) ───────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.product_name, o.quantity, o.unit_price, o.total,
              o.status, o.created_at, o.user_id
       FROM orders o
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = result.rows[0];
    order.total      = parseFloat(order.total);
    order.unit_price = parseFloat(order.unit_price);

    return res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Step 1: Request a one-time reveal token ──────────────────────────────────
// User must have ≥ $350 balance. A $350 fee is charged on Step 2 when token is redeemed.
router.post('/:id/request-credentials', authMiddleware, async (req, res) => {
  try {
    // Balance gate: must have at least $350
    const balance = await getUserBalance(req.user.id);
    if (balance < REVEAL_FEE) {
      return res.status(402).json({
        success: false,
        activation_required: true,
        message: `You need a balance of $${REVEAL_FEE.toFixed(2)} to unlock credentials. Your current balance is $${balance.toFixed(2)}. Please deposit $${(REVEAL_FEE - balance).toFixed(2)} more.`,
        balance,
        required: REVEAL_FEE,
        remaining: parseFloat((REVEAL_FEE - balance).toFixed(2)),
      });
    }

    // Verify order belongs to this user
    const result = await pool.query(
      `SELECT id, status, product_data FROM orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const { status, product_data } = result.rows[0];

    if (status === 'refunded' || status === 'cancelled') {
      return res.status(403).json({ success: false, message: 'Access revoked — order was ' + status + '.' });
    }
    if (!product_data) {
      return res.status(404).json({ success: false, message: 'Credentials not yet available.' });
    }

    // Rate limit
    const rlKey = `${req.user.id}:${req.params.id}`;
    const now   = Date.now();
    const times = (revealRateLimit.get(rlKey) || []).filter(t => now - t < RATE_WINDOW_MS);

    if (times.length >= RATE_LIMIT_MAX) {
      return res.status(429).json({
        success: false,
        message: `Too many reveal requests. Try again later (max ${RATE_LIMIT_MAX}/hour per order).`
      });
    }

    times.push(now);
    revealRateLimit.set(rlKey, times);

    // Issue one-time token
    const token = crypto.randomBytes(32).toString('hex');
    revealTokens.set(token, {
      orderId: req.params.id,
      userId:  req.user.id,
      expires: now + TOKEN_TTL_MS,
      used:    false,
    });

    return res.json({
      success: true,
      token,
      expires_in: TOKEN_TTL_MS / 1000,
      fee: REVEAL_FEE,
    });
  } catch (error) {
    console.error('Request credentials error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Step 2: Redeem token — deducts $350 and returns credentials ──────────────
router.get('/:id/credentials', authMiddleware, async (req, res) => {
  const { t: token } = req.query;

  // Balance gate
  const balance = await getUserBalance(req.user.id);
  if (balance < REVEAL_FEE) {
    return res.status(402).json({
      success: false,
      activation_required: true,
      message: `You need a balance of $${REVEAL_FEE.toFixed(2)} to unlock credentials. Your current balance is $${balance.toFixed(2)}.`,
      balance,
      required: REVEAL_FEE,
      remaining: parseFloat((REVEAL_FEE - balance).toFixed(2)),
    });
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Reveal token required. Click the Reveal button to request one.'
    });
  }

  // Validate token
  const entry = revealTokens.get(token);
  if (!entry) {
    return res.status(401).json({ success: false, message: 'Invalid or expired reveal token.' });
  }
  if (entry.used) {
    return res.status(401).json({ success: false, message: 'Reveal token already used.' });
  }
  if (Date.now() > entry.expires) {
    revealTokens.delete(token);
    return res.status(401).json({ success: false, message: 'Reveal token expired. Please try again.' });
  }
  if (entry.orderId !== req.params.id || entry.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Token does not match this order.' });
  }

  // Consume token immediately (single-use)
  revealTokens.delete(token);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-check balance inside transaction & deduct $350 reveal fee
    const userRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    const currentBalance = parseFloat(userRes.rows[0].balance);
    if (currentBalance < REVEAL_FEE) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        success: false,
        activation_required: true,
        message: `Insufficient balance. You need $${REVEAL_FEE.toFixed(2)} to unlock credentials.`,
        balance: currentBalance,
        required: REVEAL_FEE,
      });
    }

    // Deduct the $350 reveal fee
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [REVEAL_FEE, req.user.id]
    );

    // Fetch order credentials
    const result = await client.query(
      `SELECT status, product_data FROM orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const { status, product_data } = result.rows[0];

    if (status === 'refunded' || status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access revoked — order was ' + status + '.' });
    }
    if (!product_data) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Credentials not yet available.' });
    }

    // Log access
    const accessIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await client.query(
      `UPDATE orders SET credentials_accessed_at = NOW(), credentials_access_ip = $1 WHERE id = $2`,
      [accessIp, req.params.id]
    ).catch(() => {});

    await client.query('COMMIT');

    const encoded = Buffer.from(product_data, 'utf8').toString('base64');

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    return res.json({ success: true, data: encoded, fee_charged: REVEAL_FEE });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Get credentials error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
