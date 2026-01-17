import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'db/opencode.db');

const db = new Database(dbPath);

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node create-admin.js <username> <password>');
    process.exit(1);
}

const [username, password] = args;

try {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const stmt = db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);

    console.log(`✅ Admin user '${username}' created successfully (ID: ${result.lastInsertRowid})`);
} catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.error(`❌ Error: Username '${username}' already exists.`);
    } else {
        console.error('❌ Error creating user:', error.message);
    }
}
