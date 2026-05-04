const bcrypt = require('bcrypt');
// Require the database instance from schema.js (which ensures tables exist)
const db = require('./schema');

const seedUsers = () => {
    console.log('Starting database seed...');

const usersToSeed = [
        { username: 'alice', password: 'alice123', role: 'lead' },
        { username: 'bob', password: 'bob123', role: 'lead' },
        { username: 'carol', password: 'carol123', role: 'dev' },
        { username: 'dave', password: 'dave123', role: 'dev' }
    ];

    const insertUserStmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');

    // Prepare our SQL statements ahead of time for efficiency
    const checkUserStmt = db.prepare('SELECT id FROM users WHERE username = ?');

    // Execute the seed inside a transaction for safety and speed
    const insertMany = db.transaction((users) => {
        for (const user of users) {
            // Check if user already exists
            const existingUser = checkUserStmt.get(user.username);

            if (existingUser) {
                console.log(`[-] Skipped: User '${user.username}' already exists.`);
            } else {
                // Hash the password synchronously
                const hash = bcrypt.hashSync(user.password, 10);
                
                // Insert the new user
                insertUserStmt.run(user.username, hash, user.role);
                console.log(`[+] Created: User '${user.username}' added successfully.`);
            }
        }
    });

    try {
        insertMany(usersToSeed);
        console.log('Database seeding completed successfully.');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

// Execute the function
seedUsers();