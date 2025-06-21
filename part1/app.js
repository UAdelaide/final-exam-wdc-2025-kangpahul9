const express = require('express');

const mysql = require('mysql2/promise');

const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
const port = 3000;

// Setup MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'DogWalkService',
  waitForConnections: true,
  connectionLimit: 10
});

// Insert records on startup
(async () => {
  try {
    const conn = await pool.getConnection();

    const [users] = await conn.query('SELECT COUNT(*) AS count FROM Users');
    if (users[0].count === 0) {
      await conn.query(`
        INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('david99', 'david@example.com', 'hashed000', 'walker'),
        ('emily88', 'emily@example.com', 'hashed999', 'owner')
      `);
    }

    const [dogs] = await conn.query('SELECT COUNT(*) AS count FROM Dogs');
    if (dogs[0].count === 0) {
      await conn.query(`
        INSERT INTO Dogs (owner_id, name, size)
        SELECT user_id, 'Max', 'medium' FROM Users WHERE username = 'alice123'
        UNION ALL
        SELECT user_id, 'Bella', 'small' FROM Users WHERE username = 'carol123'
        UNION ALL
        SELECT user_id, 'Rocky', 'large' FROM Users WHERE username = 'emily88'
        UNION ALL
        SELECT user_id, 'Luna', 'small' FROM Users WHERE username = 'alice123'
        UNION ALL
        SELECT user_id, 'Charlie', 'medium' FROM Users WHERE username = 'carol123'
      `);
    }

    const [requests] = await conn.query('SELECT COUNT(*) AS count FROM WalkRequests');
    if (requests[0].count === 0) {
      await conn.query(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        SELECT dog_id, '2025-06-10 08:00:00', 30, 'Parklands', 'open' FROM Dogs WHERE name = 'Max'
        UNION ALL
        SELECT dog_id, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted' FROM Dogs WHERE name = 'Bella'
        UNION ALL
        SELECT dog_id, '2025-06-11 10:00:00', 60, 'Central Park', 'open' FROM Dogs WHERE name = 'Rocky'
        UNION ALL
        SELECT dog_id, '2025-06-12 07:30:00', 20, 'Maple Street', 'cancelled' FROM Dogs WHERE name = 'Luna'
        UNION ALL
        SELECT dog_id, '2025-06-13 15:45:00', 40, 'Hilltop Trail', 'completed' FROM Dogs WHERE name = 'Charlie'
      `);
    }

    conn.release();
    console.log('Sample data inserted if needed.');
  } catch (err) {
    console.error('Failed to insert startup data:', err.message);
  }
})();
// Route 1: /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Route 2: /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open';
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

// Route 3: /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 1) AS average_rating,
        (
          SELECT COUNT(*)
          FROM WalkRequests wr
          JOIN WalkApplications wa ON wr.request_id = wa.request_id
          WHERE wr.status = 'completed' AND wa.walker_id = u.user_id AND wa.status = 'accepted'
        ) AS completed_walks
      FROM Users u
      LEFT JOIN WalkRatings r ON r.walker_id = u.user_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

module.exports = app;
