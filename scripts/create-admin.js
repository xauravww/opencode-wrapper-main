import { User } from '../db/mongo.js';
import { initDB } from '../db/index.js';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node scripts/create-admin.js <username> <password>');
    process.exit(1);
}

const [username, password] = args;

(async () => {
    try {
        await initDB();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.findOneAndUpdate(
            { username },
            { password_hash: hashedPassword },
            { upsert: true, returnDocument: 'after' }
        );

        console.log(`✅ Admin user '${username}' created/updated in MongoDB`);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
    } finally {
        process.exit();
    }
})();
