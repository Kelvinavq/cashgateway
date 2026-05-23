const router = require('express').Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      level,
      source,
      event_type,
      date_from,
      date_to,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (level)      { conditions.push('level = ?');           params.push(level); }
    if (source)     { conditions.push('source = ?');          params.push(source); }
    if (event_type) { conditions.push('event_type LIKE ?');   params.push(`%${event_type}%`); }
    if (date_from)  { conditions.push('created_at >= ?');     params.push(date_from); }
    if (date_to)    { conditions.push('created_at <= ?');     params.push(date_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM system_logs ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
