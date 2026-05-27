const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'wellnest_user',
  password: process.env.DB_PASSWORD || 'wellnest_docker_password',
  database: process.env.DB_NAME || 'wellnest_db'
};

async function waitForDatabase(retries = 20) {
  for (let i = 1; i <= retries; i++) {
    try {
      const db = await mysql.createConnection(DB_CONFIG);
      await db.end();
      console.log('Database is ready.');
      return;
    } catch (error) {
      console.log(`Waiting for database... attempt ${i}/${retries}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Database is not ready after waiting.');
}

async function main() {
  await waitForDatabase();

  const db = await mysql.createConnection(DB_CONFIG);

  const accounts = [
    {
      email: 'superadmin@wellnest.local',
      password: 'superadmin123',
      role: 'superadmin',
      isApproved: 1
    },
    {
      email: 'admin@wellnest.local',
      password: 'admin123',
      role: 'admin',
      isApproved: 1
    },
    {
      email: 'userdemo@wellnest.local',
      password: 'user123',
      role: 'user',
      isApproved: 1
    }
  ];

  for (const account of accounts) {
    const hash = await bcrypt.hash(account.password, 10);

    await db.execute(
      `
      INSERT INTO users (email, password, role, is_approved)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        role = VALUES(role),
        is_approved = VALUES(is_approved)
      `,
      [account.email, hash, account.role, account.isApproved]
    );
  }

  const [userRows] = await db.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    ['userdemo@wellnest.local']
  );

  const [adminRows] = await db.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    ['admin@wellnest.local']
  );

  if (userRows.length > 0 && adminRows.length > 0) {
    const userId = userRows[0].id;
    const adminId = adminRows[0].id;

    const [existingLogs] = await db.execute(
      'SELECT COUNT(*) AS total FROM health_logs WHERE user_id = ?',
      [userId]
    );

    if (existingLogs[0].total === 0) {
      const [logResult] = await db.execute(
        `
        INSERT INTO health_logs
        (user_id, activity_type, duration_minutes, heart_rate, date, notes)
        VALUES
        (?, 'Gym Progress', 45, 138, CURDATE(), 'Docker seed activity log.'),
        (?, 'Strength Training', 50, 142, CURDATE(), 'Upper body workout and recovery focus.'),
        (?, 'Gym Session', 40, 135, CURDATE(), 'Moderate intensity gym session.')
        `,
        [userId, userId, userId]
      );

      await db.execute(
        `
        INSERT INTO feedbacks (log_id, admin_id, message)
        VALUES (?, ?, ?)
        `,
        [
          logResult.insertId,
          adminId,
          'Progress sudah baik. Pertahankan konsistensi latihan dan perhatikan recovery.'
        ]
      );
    }
  }

  await db.end();

  console.log('Docker demo accounts and sample data are ready.');
}

main().catch((error) => {
  console.error('Docker seed failed:', error);
  process.exit(1);
});