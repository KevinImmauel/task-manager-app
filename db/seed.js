const bcrypt = require('bcrypt');
const db = require('./schema');

const seedData = () => {
    console.log('Starting database seed...');

    const usersToSeed = [
        { username: 'admin_eve', password: 'password123', role: 'management' },
        { username: 'manager_mike', password: 'password123', role: 'management' },
        { username: 'lead_alice', password: 'password123', role: 'lead' },
        { username: 'lead_bob', password: 'password123', role: 'lead' },
        { username: 'lead_charlie', password: 'password123', role: 'lead' },
        { username: 'dev_dave', password: 'password123', role: 'dev' },
        { username: 'dev_diana', password: 'password123', role: 'dev' },
        { username: 'dev_dan', password: 'password123', role: 'dev' },
        { username: 'dev_danny', password: 'password123', role: 'dev' },
        { username: 'dev_daisy', password: 'password123', role: 'dev' }
    ];

    const projectsToSeed = [
        { name: 'Alpha Redesign', description: 'Overhaul the main marketing site', created_by: 'lead_alice' },
        { name: 'Beta Backend', description: 'Rewrite the API in Rust', created_by: 'lead_bob' },
        { name: 'Gamma Mobile App', description: 'React Native mobile app MVP', created_by: 'lead_charlie' },
        { name: 'Delta Analytics', description: 'Internal dashboard for metrics', created_by: 'manager_mike' },
        { name: 'Epsilon SEO', description: 'Search engine optimization fixes', created_by: 'lead_alice' },
        { name: 'Zeta Security Audit', description: 'Address pentest vulnerabilities', created_by: 'admin_eve' }
    ];

    const taskCategories = ['Frontend', 'Backend', 'Design', 'QA', 'DevOps', 'Security', 'Research'];
    const priorities = ['low', 'medium', 'high'];
    const statuses = ['todo', 'in_progress', 'in_review', 'done'];

    const insertUserStmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const checkUserStmt = db.prepare('SELECT id, username, role FROM users WHERE username = ?');
    
    db.transaction(() => {
        // --- 1. Seed Users ---
        console.log('Seeding Users...');
        for (const user of usersToSeed) {
            const existingUser = checkUserStmt.get(user.username);
            if (!existingUser) {
                const hash = bcrypt.hashSync(user.password, 10);
                insertUserStmt.run(user.username, hash, user.role);
            }
        }
        
        // Load all users into memory for easy access
        const allUsers = db.prepare('SELECT id, username, role FROM users').all();
        const userMap = {};
        const devs = [];
        allUsers.forEach(u => {
            userMap[u.username] = u.id;
            if (u.role === 'dev') devs.push(u.id);
        });

        // --- 2. Seed Projects ---
        console.log('Seeding Projects...');
        const insertProjectStmt = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)');
        const insertProjectAssigneeStmt = db.prepare('INSERT INTO project_assignees (project_id, user_id) VALUES (?, ?)');
        
        const projectIds = [];

        for (const proj of projectsToSeed) {
            const existingProj = db.prepare('SELECT id FROM projects WHERE name = ?').get(proj.name);
            let projectId;
            
            if (!existingProj) {
                const info = insertProjectStmt.run(proj.name, proj.description, userMap[proj.created_by]);
                projectId = info.lastInsertRowid;
                projectIds.push(projectId);

                // Assign random devs to the project (2 to 4 devs per project)
                const numDevs = Math.floor(Math.random() * 3) + 2;
                const shuffledDevs = devs.sort(() => 0.5 - Math.random());
                const assignedDevs = shuffledDevs.slice(0, numDevs);
                
                for (const devId of assignedDevs) {
                    insertProjectAssigneeStmt.run(projectId, devId);
                }
                
                // Also assign the creator if they are a lead
                if (proj.created_by.startsWith('lead_')) {
                    insertProjectAssigneeStmt.run(projectId, userMap[proj.created_by]);
                }
            } else {
                projectIds.push(existingProj.id);
            }
        }

        // --- 3. Seed Tasks ---
        console.log('Seeding Tasks...');
        const insertTaskStmt = db.prepare(`
            INSERT INTO tasks (title, description, category, priority, status, project_id, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertTaskAssigneeStmt = db.prepare('INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)');

        // Only insert tasks if we just created new projects (to avoid duplicating tasks on every run)
        if (projectIds.length > 0) {
            projectIds.forEach((projectId, idx) => {
                // Get devs assigned to this project
                const projectUsers = db.prepare('SELECT user_id FROM project_assignees WHERE project_id = ?').all(projectId).map(row => row.user_id);
                
                // 5 to 10 tasks per project
                const numTasks = Math.floor(Math.random() * 6) + 5;
                
                for (let i = 0; i < numTasks; i++) {
                    const title = `Task ${i+1} for Project ${idx+1}`;
                    const desc = `Detailed description for task ${i+1}. Needs to be completed soon.`;
                    const category = taskCategories[Math.floor(Math.random() * taskCategories.length)];
                    const priority = priorities[Math.floor(Math.random() * priorities.length)];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    // Pick a random creator (from the leads)
                    const creatorId = userMap['lead_alice']; // just default to alice for dummy data

                    const taskInfo = insertTaskStmt.run(title, desc, category, priority, status, projectId, creatorId);
                    const taskId = taskInfo.lastInsertRowid;

                    // Assign to 1 or 2 project users
                    if (projectUsers.length > 0) {
                        const numAssignees = Math.floor(Math.random() * 2) + 1;
                        const shuffledUsers = projectUsers.sort(() => 0.5 - Math.random());
                        const assignedToTask = shuffledUsers.slice(0, numAssignees);
                        
                        for (const userId of assignedToTask) {
                            insertTaskAssigneeStmt.run(taskId, userId);
                        }
                    }
                }
            });
        }
    })();

    console.log('Database seeding completed successfully.');
};

seedData();