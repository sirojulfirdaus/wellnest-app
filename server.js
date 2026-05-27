require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'wellnest_user',
  password: process.env.DB_PASSWORD || 'YOUR_DATABASE_PASSWORD_HERE',
  database: process.env.DB_NAME || 'wellnest_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(DB_CONFIG);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message
  });
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Missing or invalid authorization token.');
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return sendError(res, 401, 'Session expired or token is invalid. Please login again.');
  }
}

function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'You are not allowed to access this feature.');
    }

    next();
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only image, gif, mp4, and webm files are allowed.'));
    }

    cb(null, true);
  }
});

const curationRules = {
  'Strength / Gym': {
    keywords: ['gym', 'strength', 'workout', 'weight', 'upper', 'lower', 'push', 'pull', 'lifting', 'muscle'],
    summary: 'Your recent activity logs show a tendency toward gym or strength-based workouts.',
    recommendations: [
      {
        title: 'Resistance Band',
        reason: 'Useful for warm-up, mobility, and accessory strength exercises.'
      },
      {
        title: 'Foam Roller',
        reason: 'Helps with recovery after strength training sessions.'
      },
      {
        title: 'Protein Shaker',
        reason: 'Keeps post-workout nutrition simple and consistent.'
      },
      {
        title: 'Recovery Reminder',
        reason: 'Plan rest days so strength progress does not turn into overtraining.'
      }
    ]
  },
  'Cardio / Running': {
    keywords: ['run', 'running', 'jog', 'jogging', 'cardio', 'cycling', 'bike', 'swim', 'swimming'],
    summary: 'Your recent activity logs show a tendency toward cardio or endurance activities.',
    recommendations: [
      {
        title: 'Hydration Bottle',
        reason: 'Supports steady hydration before and after cardio sessions.'
      },
      {
        title: 'Running Socks',
        reason: 'Helps keep longer runs or walks more comfortable.'
      },
      {
        title: 'Sport Towel',
        reason: 'Useful for outdoor runs, gym cardio, and post-workout cooldowns.'
      },
      {
        title: 'Pace Tracking Habit',
        reason: 'Record pace or effort level to notice endurance progress over time.'
      }
    ]
  },
  'Mobility / Recovery': {
    keywords: ['yoga', 'stretch', 'stretching', 'mobility', 'recovery', 'pilates', 'meditation'],
    summary: 'Your recent activity logs show a tendency toward mobility, recovery, or mindful movement.',
    recommendations: [
      {
        title: 'Yoga Mat',
        reason: 'Provides a comfortable base for stretching, yoga, and floor exercises.'
      },
      {
        title: 'Stretching Strap',
        reason: 'Supports controlled stretching and mobility work.'
      },
      {
        title: 'Breathing Routine',
        reason: 'A short breathing routine can make recovery sessions more focused.'
      },
      {
        title: 'Sleep Wind-down Reminder',
        reason: 'A calmer evening routine can support recovery and consistency.'
      }
    ]
  },
  'General Wellness': {
    keywords: [],
    summary: 'Your recent activity pattern is still general, so start with simple wellness support.',
    recommendations: [
      {
        title: 'Water Bottle',
        reason: 'Makes daily hydration easier to remember.'
      },
      {
        title: 'Daily Walk Reminder',
        reason: 'A short walk helps build a simple baseline activity habit.'
      },
      {
        title: 'Basic Workout Mat',
        reason: 'Useful for light exercise, stretching, and beginner home workouts.'
      },
      {
        title: 'Sleep Schedule Check',
        reason: 'Consistent sleep timing supports energy, recovery, and mood.'
      }
    ]
  }
};

function buildWellnessCuration(logs) {
  const scores = {
    'Strength / Gym': 0,
    'Cardio / Running': 0,
    'Mobility / Recovery': 0
  };
  const matchedByPattern = {
    'Strength / Gym': new Set(),
    'Cardio / Running': new Set(),
    'Mobility / Recovery': new Set()
  };

  logs.forEach((log) => {
    const text = `${log.activity_type || ''} ${log.notes || ''}`.toLowerCase();

    Object.keys(scores).forEach((pattern) => {
      curationRules[pattern].keywords.forEach((keyword) => {
        if (text.includes(keyword)) {
          scores[pattern] += 1;
          matchedByPattern[pattern].add(keyword);
        }
      });
    });
  });

  let pattern = 'General Wellness';
  let highestScore = 0;

  Object.keys(scores).forEach((candidate) => {
    if (scores[candidate] > highestScore) {
      highestScore = scores[candidate];
      pattern = candidate;
    }
  });

  const rule = curationRules[pattern];

  return {
    pattern,
    summary: rule.summary,
    evidence: {
      totalLogsAnalyzed: logs.length,
      matchedKeywords: pattern === 'General Wellness'
        ? []
        : Array.from(matchedByPattern[pattern])
    },
    recommendations: rule.recommendations
  };
}

app.get('/api/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS db_ok');

    res.json({
      success: true,
      message: 'WellNest API is running.',
      port: PORT,
      database: rows[0].db_ok === 1 ? 'connected' : 'unknown'
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'WellNest API is running, but database connection failed.');
  }
});

app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return sendError(res, 400, 'Email, password, and role are required.');
  }

  if (!['admin', 'user'].includes(role)) {
    return sendError(res, 400, 'Public registration only allows admin or user role.');
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `
      INSERT INTO users (email, password, role, is_approved)
      VALUES (?, ?, ?, 0)
      `,
      [email, passwordHash, role]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending approval by the Superadmin.',
      user: {
        id: result.insertId,
        email,
        role,
        is_approved: false
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'Email is already registered.');
    }

    console.error(error);
    sendError(res, 500, 'Failed to register account.');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required.');
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, password, role, is_approved FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    if (!user.is_approved) {
      return sendError(res, 403, 'Account pending approval.');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_approved: Boolean(user.is_approved)
    };

    res.json({
      success: true,
      message: 'Login successful.',
      token: createToken(user),
      user: safeUser
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to login.');
  }
});

app.get('/api/users/pending', verifyToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, email, role, is_approved, created_at
      FROM users
      WHERE is_approved = 0
      ORDER BY created_at DESC
      `
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to fetch pending users.');
  }
});

app.patch('/api/users/:id/approve', verifyToken, authorizeRole('superadmin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute(
      `
      UPDATE users
      SET is_approved = 1
      WHERE id = ? AND role IN ('admin', 'user')
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, 'Pending user not found or cannot be approved.');
    }

    res.json({
      success: true,
      message: 'User account approved successfully.'
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to approve user.');
  }
});

app.get('/api/users/summary', verifyToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) AS pendingUsers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmins,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS totalRegularUsers
      FROM users
      `
    );

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to calculate users summary.');
  }
});

app.get('/api/logs', verifyToken, authorizeRole('user', 'admin', 'superadmin'), async (req, res) => {
  try {
    let query = `
      SELECT
        health_logs.id,
        health_logs.user_id,
        users.email AS user_email,
        health_logs.activity_type,
        health_logs.duration_minutes,
        health_logs.heart_rate,
        health_logs.date,
        health_logs.media_path,
        health_logs.notes,
        health_logs.created_at
      FROM health_logs
      LEFT JOIN users ON health_logs.user_id = users.id
    `;

    const params = [];

    if (req.user.role === 'user') {
      query += ' WHERE health_logs.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY health_logs.created_at DESC, health_logs.date DESC';

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to fetch health logs.');
  }
});

app.post(
  '/api/logs',
  verifyToken,
  authorizeRole('user'),
  upload.single('media'),
  async (req, res) => {
    const { activity_type, duration_minutes, heart_rate, date, notes } = req.body;

    if (!activity_type || !duration_minutes) {
      return sendError(res, 400, 'Activity type and duration are required.');
    }

    const duration = Number(duration_minutes);
    const parsedHeartRate = heart_rate ? Number(heart_rate) : null;

    if (!Number.isInteger(duration) || duration <= 0) {
      return sendError(res, 400, 'Duration must be a positive integer.');
    }

    if (parsedHeartRate !== null && (!Number.isInteger(parsedHeartRate) || parsedHeartRate <= 0)) {
      return sendError(res, 400, 'Heart rate must be a positive integer when provided.');
    }

    const mediaPath = req.file ? `/uploads/${req.file.filename}` : null;
    const logDate = date || new Date().toISOString().slice(0, 10);

    try {
      const [result] = await pool.execute(
        `
        INSERT INTO health_logs
        (user_id, activity_type, duration_minutes, heart_rate, date, media_path, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          req.user.id,
          activity_type,
          duration,
          parsedHeartRate,
          logDate,
          mediaPath,
          notes || null
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Progress log uploaded successfully.',
        data: {
          id: result.insertId,
          user_id: req.user.id,
          activity_type,
          duration_minutes: duration,
          heart_rate: parsedHeartRate,
          date: logDate,
          media_path: mediaPath,
          notes: notes || null
        }
      });
    } catch (error) {
      console.error(error);
      sendError(res, 500, 'Failed to upload progress log.');
    }
  }
);

app.get('/api/logs/summary', verifyToken, authorizeRole('user', 'admin', 'superadmin'), async (req, res) => {
  try {
    let query = `
      SELECT
        COUNT(id) AS totalLogs,
        COALESCE(SUM(duration_minutes), 0) AS totalMinutes,
        COALESCE(ROUND(AVG(heart_rate)), 0) AS avgHeartRate,
        SUM(CASE WHEN media_path IS NOT NULL THEN 1 ELSE 0 END) AS logsWithMedia
      FROM health_logs
    `;

    const params = [];

    if (req.user.role === 'user') {
      query += ' WHERE user_id = ?';
      params.push(req.user.id);
    }

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to calculate health summary.');
  }
});

app.get('/api/curation', verifyToken, authorizeRole('user', 'admin', 'superadmin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT activity_type, notes, date, created_at
      FROM health_logs
      WHERE user_id = ?
      ORDER BY created_at DESC, date DESC
      LIMIT 10
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      data: buildWellnessCuration(rows)
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to build wellness curation.');
  }
});

app.post('/api/feedbacks', verifyToken, authorizeRole('admin'), async (req, res) => {
  const { log_id, message } = req.body;

  if (!log_id || !message) {
    return sendError(res, 400, 'Log ID and feedback message are required.');
  }

  try {
    const [logRows] = await pool.execute(
      'SELECT id FROM health_logs WHERE id = ? LIMIT 1',
      [log_id]
    );

    if (logRows.length === 0) {
      return sendError(res, 404, 'Health log not found.');
    }

    const [result] = await pool.execute(
      `
      INSERT INTO feedbacks (log_id, admin_id, message)
      VALUES (?, ?, ?)
      `,
      [log_id, req.user.id, message]
    );

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
      data: {
        id: result.insertId,
        log_id,
        admin_id: req.user.id,
        message
      }
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to submit feedback.');
  }
});

app.get('/api/feedbacks', verifyToken, authorizeRole('user', 'admin', 'superadmin'), async (req, res) => {
  try {
    let query = `
      SELECT
        feedbacks.id,
        feedbacks.log_id,
        feedbacks.admin_id,
        admin.email AS admin_email,
        health_logs.user_id,
        health_logs.activity_type,
        feedbacks.message,
        feedbacks.created_at
      FROM feedbacks
      JOIN health_logs ON feedbacks.log_id = health_logs.id
      JOIN users AS admin ON feedbacks.admin_id = admin.id
    `;

    const params = [];

    if (req.user.role === 'user') {
      query += ' WHERE health_logs.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY feedbacks.created_at DESC';

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to fetch feedbacks.');
  }
});

app.get('/api/health-info', async (req, res) => {
  try {
    const response = await fetch('https://api.fda.gov/food/enforcement.json?limit=5');

    if (!response.ok) {
      throw new Error(`OpenFDA responded with status ${response.status}`);
    }

    const data = await response.json();

    const simplified = (data.results || []).map((item) => ({
      recalling_firm: item.recalling_firm,
      reason_for_recall: item.reason_for_recall,
      status: item.status,
      report_date: item.report_date
    }));

    res.json({
      success: true,
      data: simplified
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Failed to fetch data from OpenFDA.');
  }
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    return sendError(res, 400, error.message);
  }

  if (error.message && error.message.includes('Only image')) {
    return sendError(res, 400, error.message);
  }

  sendError(res, 500, 'Internal server error.');
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`WellNest API is running at http://localhost:${PORT}`);
    console.log('MySQL database connected successfully.');
  } catch (error) {
    console.error('Server started, but database connection failed:', error.message);
  }
});
