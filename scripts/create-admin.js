import { AdminUser } from '../db/mongo.js';
import { initDB } from '../db/index.js';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node create-admin.js <username> <password>');
    process.exit(1);
}

const [username, password] = args;

(async () => {
    try {
        await initDB();
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new AdminUser({
            username,
            password_hash: hashedPassword
        });

        await newUser.save();
        console.log(`✅ Admin user '${username}' created successfully in MongoDB`);
    } catch (error) {
        if (error.code === 11000) {
            console.error(`❌ Error: Username '${username}' already exists.`);
        } else {
            console.error('❌ Error creating user:', error.message);
        }
    } finally {
        process.exit();
    }
})();
