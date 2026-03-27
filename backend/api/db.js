// Uses the built-in node:sqlite module (Node.js v22+)
// Disable the experimental warning via --no-warnings flag or accept it
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'aspira.db');
let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // Enable WAL mode for better performance
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password TEXT,
      provider TEXT DEFAULT 'email',
      provider_id TEXT,
      industry TEXT,
      experience TEXT,
      is_pro INTEGER DEFAULT 0,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT DEFAULT 'voice',
      level TEXT DEFAULT 'junior',
      tech_stack TEXT,
      questions TEXT,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      soft_skills_score INTEGER DEFAULT 0,
      tech_skills_score INTEGER DEFAULT 0,
      feedback TEXT,
      transcript TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id)
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      personal_details TEXT,
      summary TEXT,
      experiences TEXT,
      education TEXT,
      skills TEXT,
      template TEXT DEFAULT 'minimalist',
      theme TEXT DEFAULT 'classic-black',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      skill TEXT,
      questions TEXT,
      answers TEXT,
      score INTEGER,
      total INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'applied',
      location TEXT,
      salary TEXT,
      notes TEXT,
      applied_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ats_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resume_name TEXT NOT NULL,
      job_role TEXT NOT NULL,
      score INTEGER NOT NULL,
      analysis_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('✅ Database initialized');

  // Safe migration: add new profile fields if they don't exist
  try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN skills TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN github_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN linkedin_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN portfolio_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN location TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN current_title TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN full_name TEXT"); } catch (e) {}
  try { db.exec("UPDATE users SET full_name = name WHERE full_name IS NULL"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN naukri_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN internshala_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN glassdoor_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN wellfound_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN indeed_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN google_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN otta_url TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN ziprecruiter_url TEXT"); } catch (e) {}

  try { db.exec("ALTER TABLE resumes ADD COLUMN theme TEXT DEFAULT 'classic-black'"); } catch (e) {}

  try { db.exec("ALTER TABLE applications ADD COLUMN job_type TEXT DEFAULT 'full-time'"); } catch (e) {}
  try { db.exec("ALTER TABLE applications ADD COLUMN work_mode TEXT DEFAULT 'remote'"); } catch (e) {}
}

module.exports = { getDb, initDb };
