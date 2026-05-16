const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'strict' : 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour
};

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

    res.cookie(env.cookie.name, token, COOKIE_OPTIONS);
    logger.info(`User ${user.email} logged in`);

    res.json({ success: true, user: payload });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  res.clearCookie(env.cookie.name);
  res.json({ success: true, message: 'Logged out' });
}

async function me(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { login, logout, me };
