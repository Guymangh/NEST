const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// ─── Get All Active Products (Public) ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
    `;
    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND c.slug = $${paramCount}`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.tags ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        query += ' ORDER BY p.price ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY p.price DESC';
        break;
      case 'newest':
        query += ' ORDER BY p.created_at DESC';
        break;
      default:
        query += ' ORDER BY p.featured DESC, p.created_at DESC';
    }

    // Count query — build separate clean query without ORDER BY
    let baseQuery = `
      SELECT COUNT(*)
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
    `;
    if (category) baseQuery += ` AND c.slug = $1`;
    if (search) {
      const idx = category ? 2 : 1;
      baseQuery += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.tags ILIKE $${idx})`;
    }
    const countResult = await pool.query(baseQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Paginate
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);

    // Strip product_data from public listing (only deliver after purchase)
    const products = result.rows.map(p => {
      const { product_data, ...rest } = p;
      rest.price = parseFloat(rest.price);
      return rest;
    });

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.json({
      success: true,
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Get Categories (Public) ─────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=59');
    return res.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Create Product ────────────────────────────────────────────────────
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      name, category_id, description, short_description,
      price, stock, product_data, image_url, is_active, featured, tags
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required.' });
    }

    let stockVal = -1;
    if (stock !== undefined && stock !== null && stock !== '') {
      stockVal = parseInt(stock, 10);
      if (isNaN(stockVal) || (stockVal !== -1 && stockVal < 1)) {
        return res.status(400).json({ success: false, message: 'Stock must be 1 or greater, or -1 for unlimited.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO products 
        (name, category_id, description, short_description, price, stock, product_data, image_url, is_active, featured, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, category_id || null, description, short_description, price, stockVal, product_data, image_url, is_active !== false, featured || false, tags]
    );

    const product = result.rows[0];
    product.price = parseFloat(product.price);
    return res.status(201).json({ success: true, message: 'Product created!', product });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Update Product ────────────────────────────────────────────────────
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      name, category_id, description, short_description,
      price, stock, product_data, image_url, is_active, featured, tags
    } = req.body;

    const updates = { name, category_id, description, short_description, price, product_data, image_url, is_active, featured, tags };

    // Validate stock if provided
    if (stock !== undefined) {
      const stockVal = parseInt(stock, 10);
      if (isNaN(stockVal) || (stockVal !== -1 && stockVal < 1)) {
        return res.status(400).json({ success: false, message: 'Stock must be 1 or greater, or -1 for unlimited.' });
      }
      updates.stock = stockVal;
    }

    const result = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        category_id = COALESCE($2, category_id),
        description = COALESCE($3, description),
        short_description = COALESCE($4, short_description),
        price = COALESCE($5, price),
        stock = COALESCE($6, stock),
        product_data = COALESCE($7, product_data),
        image_url = COALESCE($8, image_url),
        is_active = COALESCE($9, is_active),
        featured = COALESCE($10, featured),
        tags = COALESCE($11, tags)
       WHERE id = $12
       RETURNING *`,
      [updates.name, updates.category_id, updates.description, updates.short_description,
       updates.price, updates.stock, updates.product_data, updates.image_url,
       updates.is_active, updates.featured, updates.tags, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = result.rows[0];
    product.price = parseFloat(product.price);
    return res.json({ success: true, message: 'Product updated!', product });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Delete Product ────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get All Products (strip product_data from list) ────────────────────────
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.short_description, p.price, p.stock,
             p.is_active, p.featured, p.tags, p.image_url, p.created_at,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    // product_data deliberately excluded from list — fetched only when editing
    const products = result.rows.map(p => ({ ...p, price: parseFloat(p.price) }));
    return res.json({ success: true, products });
  } catch (error) {
    console.error('Admin get products error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Admin: Get Single Product WITH product_data (for editing only) ────────────
router.get('/admin/edit/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const product = result.rows[0];
    product.price = parseFloat(product.price);
    return res.json({ success: true, product });
  } catch (error) {
    console.error('Admin get product error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Get Single Product (Public) — MUST be last to avoid catching /admin/all ──
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.is_active = TRUE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const { product_data, ...product } = result.rows[0];
    product.price = parseFloat(product.price);

    return res.json({ success: true, product });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
