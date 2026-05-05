const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// ─── NowPayments Helper ───────────────────────────────────────────────────────────────────────────────────
function nowpaymentsRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'api.nowpayments.io',
      port: 443,
      path: `/v1${endpoint}`,
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from NowPayments')); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const router = express.Router();

// ─── Multer Setup (Proof of Payment Uploads) ──────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'proofs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPG, PNG, WEBP) and PDF are allowed.'));
    }
  },
});

// ─── Submit Manual Deposit ────────────────────────────────────────────────────
router.post('/manual', authMiddleware, upload.single('proof'), async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const proofFile = req.file;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }
    if (!proofFile) {
      return res.status(400).json({ success: false, message: 'Payment proof is required.' });
    }

    // Get min deposit setting
    const settingResult = await pool.query("SELECT value FROM site_settings WHERE key = 'min_deposit'");
    const minDeposit = settingResult.rows.length > 0 ? parseFloat(settingResult.rows[0].value) : 5;

    if (parseFloat(amount) < minDeposit) {
      return res.status(400).json({ success: false, message: `Minimum deposit is $${minDeposit}.` });
    }

    const proofUrl = `/uploads/proofs/${proofFile.filename}`;

    const result = await pool.query(
      `INSERT INTO deposits (user_id, amount, method, proof_url, notes)
       VALUES ($1, $2, 'manual', $3, $4)
       RETURNING *`,
      [req.user.id, parseFloat(amount), proofUrl, notes || null]
    );

    const deposit = result.rows[0];
    deposit.amount = parseFloat(deposit.amount);

    return res.status(201).json({
      success: true,
      message: 'Deposit request submitted! Admin will review within 24 hours.',
      deposit,
    });
  } catch (error) {
    console.error('Manual deposit error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Submit Crypto Deposit ────────────────────────────────────────────────────
router.post('/crypto', authMiddleware, async (req, res) => {
  try {
    const { amount, method, transaction_hash } = req.body;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }
    if (!['bitcoin', 'usdt'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Invalid crypto method.' });
    }
    if (!transaction_hash || transaction_hash.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Valid transaction hash is required.' });
    }

    // Check min deposit
    const settingResult = await pool.query("SELECT value FROM site_settings WHERE key = 'min_deposit'");
    const minDeposit = settingResult.rows.length > 0 ? parseFloat(settingResult.rows[0].value) : 5;

    if (parseFloat(amount) < minDeposit) {
      return res.status(400).json({ success: false, message: `Minimum deposit is $${minDeposit}.` });
    }

    // Check for duplicate transaction hash
    const dupCheck = await pool.query(
      'SELECT id FROM deposits WHERE transaction_hash = $1',
      [transaction_hash.trim()]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This transaction hash has already been submitted.' });
    }

    const result = await pool.query(
      `INSERT INTO deposits (user_id, amount, method, transaction_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, parseFloat(amount), method, transaction_hash.trim()]
    );

    const deposit = result.rows[0];
    deposit.amount = parseFloat(deposit.amount);

    return res.status(201).json({
      success: true,
      message: 'Crypto deposit submitted! Admin will verify and credit your account.',
      deposit,
    });
  } catch (error) {
    console.error('Crypto deposit error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Get User's Deposits ──────────────────────────────────────────────────────
router.get('/my-deposits', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );

    const deposits = result.rows.map(d => ({ ...d, amount: parseFloat(d.amount) }));
    return res.json({ success: true, deposits });
  } catch (error) {
    console.error('Get deposits error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Get Wallet Addresses (Public) ────────────────────────────────────────────
router.get('/wallets', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM site_settings WHERE key IN ('btc_wallet', 'usdt_wallet', 'min_deposit')"
    );
    const settings = {};
    result.rows.forEach(r => (settings[r.key] = r.value));
    return res.json({ success: true, wallets: settings });
  } catch (error) {
    console.error('Get wallets error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get All Deposits ──────────────────────────────────────────────────
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, u.username, u.email
      FROM deposits d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
    }

    const countResult = await pool.query(
      query.replace('SELECT d.*, u.username, u.email', 'SELECT COUNT(*)'),
      params
    );

    query += ' ORDER BY d.created_at DESC';
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);
    const deposits = result.rows.map(d => ({ ...d, amount: parseFloat(d.amount) }));

    return res.json({
      success: true,
      deposits,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Admin get deposits error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Approve Deposit ───────────────────────────────────────────────────
router.post('/admin/approve/:id', authMiddleware, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const depositResult = await client.query(
      "SELECT * FROM deposits WHERE id = $1 AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );

    if (depositResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pending deposit not found.' });
    }

    const deposit = depositResult.rows[0];

    // Credit user balance
    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [deposit.amount, deposit.user_id]
    );

    // Update deposit status
    await client.query(
      "UPDATE deposits SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
      [req.user.id, req.params.id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `$${parseFloat(deposit.amount).toFixed(2)} credited to user's account.`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve deposit error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// ─── Admin: Reject Deposit ────────────────────────────────────────────────────
router.post('/admin/reject/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await pool.query(
      "UPDATE deposits SET status = 'rejected', notes = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING *",
      [reason || 'Rejected by admin', req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending deposit not found.' });
    }

    return res.json({ success: true, message: 'Deposit rejected.' });
  } catch (error) {
    console.error('Reject deposit error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── NowPayments: Create Invoice ──────────────────────────────────────────────────────────────────────
router.post('/nowpayments/create', authMiddleware, async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }

    // Check minimum deposit
    const settingResult = await pool.query("SELECT value FROM site_settings WHERE key = 'min_deposit'");
    const minDeposit = settingResult.rows.length > 0 ? parseFloat(settingResult.rows[0].value) : 5;
    if (parseFloat(amount) < minDeposit) {
      return res.status(400).json({ success: false, message: `Minimum deposit is $${minDeposit}.` });
    }

    if (!process.env.NOWPAYMENTS_API_KEY || process.env.NOWPAYMENTS_API_KEY === 'YOUR_NOWPAYMENTS_API_KEY_HERE') {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured. Contact admin.' });
    }

    // Pre-create a pending deposit record so we can track it
    const depositRecord = await pool.query(
      `INSERT INTO deposits (user_id, amount, method, notes, status)
       VALUES ($1, $2, 'nowpayments', $3, 'pending')
       RETURNING id`,
      [req.user.id, parseFloat(amount), `NowPayments invoice - ${currency.toUpperCase()}`]
    );
    const depositId = depositRecord.rows[0].id;

    // Create a NowPayments invoice
    const invoice = await nowpaymentsRequest('POST', '/invoice', {
      price_amount: parseFloat(amount),
      price_currency: currency,
      order_id: `deposit_${depositId}`,
      order_description: `LogNest Balance Top-Up – $${parseFloat(amount).toFixed(2)}`,
      ipn_callback_url: process.env.NOWPAYMENTS_CALLBACK_URL,
      success_url: process.env.NOWPAYMENTS_SUCCESS_URL,
      cancel_url: process.env.NOWPAYMENTS_CANCEL_URL,
    });

    if (!invoice || invoice.id === undefined) {
      // Clean up the pending record
      await pool.query('DELETE FROM deposits WHERE id = $1', [depositId]);
      console.error('NowPayments invoice creation failed:', invoice);
      return res.status(502).json({ success: false, message: 'Payment gateway error. Please try again.' });
    }

    // Store the NowPayments invoice ID in the transaction_hash field for tracking
    await pool.query(
      'UPDATE deposits SET transaction_hash = $1 WHERE id = $2',
      [String(invoice.id), depositId]
    );

    return res.status(201).json({
      success: true,
      invoice_url: invoice.invoice_url,
      invoice_id: invoice.id,
      deposit_id: depositId,
    });
  } catch (error) {
    console.error('NowPayments create error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating payment.' });
  }
});

// ─── NowPayments: Check Payment Status ──────────────────────────────────────────────────────────────────
router.get('/nowpayments/status/:depositId', authMiddleware, async (req, res) => {
  try {
    const { depositId } = req.params;

    // Fetch from our DB (scoped to the calling user)
    const result = await pool.query(
      'SELECT * FROM deposits WHERE id = $1 AND user_id = $2',
      [depositId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deposit not found.' });
    }

    const deposit = result.rows[0];
    return res.json({
      success: true,
      status: deposit.status,
      amount: parseFloat(deposit.amount),
    });
  } catch (error) {
    console.error('NowPayments status error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── NowPayments: IPN Webhook (auto-credit on confirmed payment) ────────────────────────────────────────────────
router.post('/nowpayments/webhook', express.json(), async (req, res) => {
  try {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || '';

    // Verify HMAC-SHA512 signature
    if (ipnSecret) {
      const receivedSig = req.headers['x-nowpayments-sig'];
      if (!receivedSig) {
        console.warn('NowPayments webhook: missing signature header');
        return res.status(400).json({ success: false, message: 'Missing signature.' });
      }
      const sortedBody = JSON.stringify(
        Object.keys(req.body).sort().reduce((acc, k) => { acc[k] = req.body[k]; return acc; }, {})
      );
      const expected = crypto.createHmac('sha512', ipnSecret).update(sortedBody).digest('hex');
      if (expected !== receivedSig) {
        console.warn('NowPayments webhook: invalid signature');
        return res.status(403).json({ success: false, message: 'Invalid signature.' });
      }
    }

    const { payment_status, order_id, price_amount } = req.body;

    // order_id is formatted as "deposit_{id}"
    const depositId = order_id ? order_id.replace('deposit_', '') : null;
    if (!depositId) return res.status(400).json({ success: false, message: 'Invalid order_id.' });

    // Only credit on finished/confirmed status
    const CONFIRMED_STATUSES = ['finished', 'confirmed', 'partially_paid'];
    if (!CONFIRMED_STATUSES.includes(payment_status)) {
      // Acknowledge receipt but do nothing yet
      return res.json({ success: true, message: `Status ${payment_status} acknowledged — no action.` });
    }

    // Use a transaction to avoid double-crediting
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const depositResult = await client.query(
        "SELECT * FROM deposits WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [depositId]
      );

      if (depositResult.rows.length === 0) {
        // Already processed or not found — idempotent response
        await client.query('ROLLBACK');
        return res.json({ success: true, message: 'Already processed.' });
      }

      const deposit = depositResult.rows[0];
      const creditAmount = parseFloat(price_amount) || parseFloat(deposit.amount);

      // Credit the user's balance
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [creditAmount, deposit.user_id]
      );

      // Mark deposit as approved
      await client.query(
        "UPDATE deposits SET status = 'approved', reviewed_at = NOW(), notes = COALESCE(notes,'') || ' [Auto-approved via NowPayments IPN]' WHERE id = $1",
        [depositId]
      );

      await client.query('COMMIT');
      console.log(`✅ NowPayments IPN: Deposit #${depositId} approved — $${creditAmount} credited to user #${deposit.user_id}`);
      return res.json({ success: true, message: 'Deposit approved and balance credited.' });
    } catch (innerErr) {
      await client.query('ROLLBACK');
      throw innerErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('NowPayments webhook error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing error.' });
  }
});

module.exports = router;
