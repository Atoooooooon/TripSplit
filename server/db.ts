import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tripsplit.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      settlement_currency TEXT NOT NULL DEFAULT 'CNY',
      access_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_current_user INTEGER NOT NULL DEFAULT 0,
      avatar_color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      settlement_amount REAL NOT NULL,
      exchange_rate REAL NOT NULL,
      date TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'equal',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_payers (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES trip_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_participants (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      share REAL NOT NULL,
      share_ratio REAL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES trip_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      from_member_id TEXT NOT NULL,
      to_member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      settled_at TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (from_member_id) REFERENCES trip_members(id) ON DELETE CASCADE,
      FOREIGN KEY (to_member_id) REFERENCES trip_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add access_code column if table already exists without it
  try {
    db.exec('ALTER TABLE trips ADD COLUMN access_code TEXT');
  } catch (e) {
    // Column already exists
  }

  // Enforce unique index on access_code
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_access_code ON trips(UPPER(access_code))');
  } catch (e) {
    console.warn('Could not create unique index on access_code', e);
  }

  // Populate any existing trips that don't have access_code yet
  try {
    const tripsWithoutCode = db.prepare("SELECT id, name FROM trips WHERE access_code IS NULL OR access_code = ''").all() as any[];
    for (const t of tripsWithoutCode) {
      let code = 'TRIP' + Math.random().toString(36).substring(2, 6).toUpperCase();
      if (t.id === 'trip_korea_2026') code = 'KR2026';
      else if (t.id === 'trip_japan_2026') code = 'JP2026';
      else if (t.name && t.name.includes('河南')) code = 'HN8888';
      db.prepare('UPDATE trips SET access_code = ? WHERE id = ?').run(code, t.id);
    }
  } catch (e) {
    console.warn('Migration access_code check failed', e);
  }

  // Ensure dev_password is set to 010034 in database settings table
  try {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('dev_password', '010034')
      ON CONFLICT(key) DO UPDATE SET value = '010034'
    `).run();
  } catch (e) {
    console.warn('Failed to seed dev_password', e);
  }

  seedDefaultTripIfEmpty();
}

function seedDefaultTripIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number };
  if (row && row.count > 0) return;

  console.log('Seeding initial Korea trip demonstration data...');
  const tripId = 'trip_korea_2026';
  const now = new Date().toISOString();

  // Create Trip
  db.prepare(`
    INSERT INTO trips (id, name, destination, start_date, end_date, settlement_currency, access_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    '2026 韩国旅行',
    '韩国 · 首尔',
    '2026-10-01',
    '2026-10-07',
    'CNY',
    'KR2026',
    now
  );

  // Members: 我, 小王, 小李, Amy
  const members = [
    { id: 'mem_me', name: '我', isCurrentUser: 1, color: '#3b82f6' },
    { id: 'mem_wang', name: '小王', isCurrentUser: 0, color: '#10b981' },
    { id: 'mem_li', name: '小李', isCurrentUser: 0, color: '#f59e0b' },
    { id: 'mem_amy', name: 'Amy', isCurrentUser: 0, color: '#ec4899' },
  ];

  const insertMember = db.prepare(`
    INSERT INTO trip_members (id, trip_id, name, is_current_user, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const m of members) {
    insertMember.run(m.id, tripId, m.name, m.isCurrentUser, m.color, now);
  }

  // Sample Expenses:
  // 1. 烤肉 ₩86,000 (KRW) 我付，4人AA (1 CNY = 190 KRW -> 452.63 CNY)
  const exp1Id = 'exp_sample_1';
  db.prepare(`
    INSERT INTO expenses (id, trip_id, title, category, amount, currency, settlement_amount, exchange_rate, date, split_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(exp1Id, tripId, '烤肉', '餐饮', 86000, 'KRW', 452.63, 190, '2026-10-01', 'equal', now);

  db.prepare(`INSERT INTO expense_payers (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)`).run(
    'p_1', exp1Id, 'mem_me', 86000
  );
  // 86000 / 4 = 21500 each
  for (const m of members) {
    db.prepare(`INSERT INTO expense_participants (id, expense_id, member_id, share) VALUES (?, ?, ?, ?)`).run(
      `part_1_${m.id}`, exp1Id, m.id, 21500
    );
  }

  // 2. 打车 ₩23,000 (KRW) 小王付，我、小王、Amy 3人 (121.05 CNY)
  const exp2Id = 'exp_sample_2';
  db.prepare(`
    INSERT INTO expenses (id, trip_id, title, category, amount, currency, settlement_amount, exchange_rate, date, split_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(exp2Id, tripId, '打车', '交通', 23000, 'KRW', 121.05, 190, '2026-10-01', 'equal', now);

  db.prepare(`INSERT INTO expense_payers (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)`).run(
    'p_2', exp2Id, 'mem_wang', 23000
  );
  // 23000 / 3 = 7667, 7667, 7666
  db.prepare(`INSERT INTO expense_participants (id, expense_id, member_id, share) VALUES (?, ?, ?, ?)`).run('part_2_me', exp2Id, 'mem_me', 7667);
  db.prepare(`INSERT INTO expense_participants (id, expense_id, member_id, share) VALUES (?, ?, ?, ?)`).run('part_2_wang', exp2Id, 'mem_wang', 7667);
  db.prepare(`INSERT INTO expense_participants (id, expense_id, member_id, share) VALUES (?, ?, ?, ?)`).run('part_2_amy', exp2Id, 'mem_amy', 7666);

  // 3. 酒店 ₩420,000 (KRW) 我付款，4人AA (2210.53 CNY)
  const exp3Id = 'exp_sample_3';
  db.prepare(`
    INSERT INTO expenses (id, trip_id, title, category, amount, currency, settlement_amount, exchange_rate, date, split_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(exp3Id, tripId, '首尔明洞酒店', '住宿', 420000, 'KRW', 2210.53, 190, '2026-10-02', 'equal', now);

  db.prepare(`INSERT INTO expense_payers (id, expense_id, member_id, amount) VALUES (?, ?, ?, ?)`).run(
    'p_3', exp3Id, 'mem_me', 420000
  );
  for (const m of members) {
    db.prepare(`INSERT INTO expense_participants (id, expense_id, member_id, share) VALUES (?, ?, ?, ?)`).run(
      `part_3_${m.id}`, exp3Id, m.id, 105000
    );
  }

  // Trip 2: 日本 · Tokyo (preview)
  const trip2Id = 'trip_japan_2026';
  db.prepare(`
    INSERT INTO trips (id, name, destination, start_date, end_date, settlement_currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(trip2Id, '2026 日本东京旅行', '日本 · 东京', '2026-12-10', '2026-12-16', 'CNY', now);

  const jMembers = [
    { id: 'jm_me', name: '我', isCurrentUser: 1, color: '#3b82f6' },
    { id: 'jm_wang', name: '小王', isCurrentUser: 0, color: '#10b981' },
    { id: 'jm_amy', name: 'Amy', isCurrentUser: 0, color: '#ec4899' },
  ];
  for (const m of jMembers) {
    insertMember.run(m.id, trip2Id, m.name, m.isCurrentUser, m.color, now);
  }
}
