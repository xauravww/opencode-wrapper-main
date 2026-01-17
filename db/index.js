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
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync(adminPass, 10);
        db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hashedPassword);
        console.log(`Admin user created (username: ${adminUser})`);
    }
}

export default db;
