import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, 'opencode.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export function initDB() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Create default admin if not exists
    const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hashedPassword);
        console.log('Admin user created (username: admin, password: admin123)');
    }
}

export default db;
