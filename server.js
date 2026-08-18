import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'venues.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err.message);
  } else {
    console.log('📦 Connected to SQLite database at:', dbPath);
    initDatabase();
  }
});

// Initialize database schema and initial seed data
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rate_morning REAL NOT NULL DEFAULT 0.0,
      rate_evening REAL NOT NULL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating venues table:', err.message);
      return;
    }
    
    // Check if table is empty
    db.get('SELECT COUNT(*) as count FROM venues', [], (countErr, row) => {
      if (countErr) return;
      if (row && row.count === 0) {
        console.log('🌱 Venues table is empty. Initializing seed data...');
        seedInitialVenues();
      }
    });
  });
}

// Seed initial venue data from venues.csv or defaults
function seedInitialVenues() {
  const csvPath = path.join(__dirname, 'venues.csv');
  const defaultVenues = [
    { name: 'Lavana Sport Center Setapak', rateMorning: 14.84, rateEvening: 29.68 },
    { name: 'Setapak Badminton Center (SBC)', rateMorning: 14.00, rateEvening: 28.00 }
  ];

  let venuesToInsert = [];

  if (fs.existsSync(csvPath)) {
    try {
      const text = fs.readFileSync(csvPath, 'utf-8');
      const lines = text.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split(/[,，]/);
        if (parts.length >= 3) {
          const vName = parts[0].trim();
          const vMorning = parseFloat(parts[1].trim());
          const vEvening = parseFloat(parts[2].trim());
          if (vName && vName !== '场地名称' && !isNaN(vMorning) && !isNaN(vEvening)) {
            venuesToInsert.push({ name: vName, rateMorning: vMorning, rateEvening: vEvening });
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not parse venues.csv for initial seed:', e.message);
    }
  }

  if (venuesToInsert.length === 0) {
    venuesToInsert = defaultVenues;
  }

  const stmt = db.prepare('INSERT INTO venues (name, rate_morning, rate_evening) VALUES (?, ?, ?)');
  for (const v of venuesToInsert) {
    stmt.run(v.name, v.rateMorning, v.rateEvening);
  }
  stmt.finalize(() => {
    console.log(`✅ Seeded ${venuesToInsert.length} initial venues into SQLite database.`);
  });
}

// REST API Endpoints

// GET /api/venues - Fetch all venues
app.get('/api/venues', (req, res) => {
  const sql = 'SELECT id, name, rate_morning AS rateMorning, rate_evening AS rateEvening, updated_at AS updatedAt FROM venues ORDER BY id ASC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
    res.json({ venues: rows });
  });
});

// POST /api/venues - Add a new venue
app.post('/api/venues', (req, res) => {
  const { name, rateMorning, rateEvening } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '球场名称不能为空' });
  }

  const morning = parseFloat(rateMorning);
  const evening = parseFloat(rateEvening);

  if (isNaN(morning) || morning < 0 || isNaN(evening) || evening < 0) {
    return res.status(400).json({ error: '请输入有效的价格' });
  }

  const sql = 'INSERT INTO venues (name, rate_morning, rate_evening) VALUES (?, ?, ?)';
  db.run(sql, [name.trim(), morning, evening], function (err) {
    if (err) {
      return res.status(500).json({ error: '保存球场失败: ' + err.message });
    }
    res.status(201).json({
      message: '球场添加成功',
      venue: {
        id: this.lastID,
        name: name.trim(),
        rateMorning: morning,
        rateEvening: evening
      }
    });
  });
});

// PUT /api/venues/:id - Update an existing venue
app.put('/api/venues/:id', (req, res) => {
  const { id } = req.params;
  const { name, rateMorning, rateEvening } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '球场名称不能为空' });
  }

  const morning = parseFloat(rateMorning);
  const evening = parseFloat(rateEvening);

  if (isNaN(morning) || morning < 0 || isNaN(evening) || evening < 0) {
    return res.status(400).json({ error: '请输入有效的价格' });
  }

  const sql = `
    UPDATE venues 
    SET name = ?, rate_morning = ?, rate_evening = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;

  db.run(sql, [name.trim(), morning, evening, id], function (err) {
    if (err) {
      return res.status(500).json({ error: '更新球场失败: ' + err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '未找到指定球场' });
    }
    res.json({
      message: '球场更新成功',
      venue: {
        id: parseInt(id),
        name: name.trim(),
        rateMorning: morning,
        rateEvening: evening
      }
    });
  });
});

// DELETE /api/venues/:id - Delete a venue
app.delete('/api/venues/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM venues WHERE id = ?';
  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ error: '删除球场失败: ' + err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '未找到指定球场' });
    }
    res.json({ message: '球场删除成功', id: parseInt(id) });
  });
});

// Serve static frontend files
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HostCalculator Server & Database running on http://localhost:${PORT}`);
});
