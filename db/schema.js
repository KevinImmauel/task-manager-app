const Database = require('better-sqlite3');
const path = require('path');

// Resolve the path to the database file (this ensures it works regardless of where you start the app)
const dbPath = path.join(__dirname, 'tasks.db');

// Open the database (it will be created if it doesn't exist)
const db = new Database(dbPath, { verbose: console.log }); // Remove verbose in production if you don't want SQL logged

// Enable foreign key constraints (SQLite disables them by default)
db.pragma('foreign_keys = ON');

// Create the tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        assigned_to INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );
`);

console.log('Database schema initialized successfully.');

module.exports = db;