const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/projects — Get projects based on user role
router.get('/', (req, res) => {
    try {
        const userId = req.session.userId;
        const userRole = req.session.role;

        let query = '';
        let projects = [];

        if (userRole === 'dev') {
            // Devs only see projects they are assigned to
            query = `
                SELECT p.*, c.username AS creator_username
                FROM projects p
                JOIN project_assignees pa ON p.id = pa.project_id
                LEFT JOIN users c ON p.created_by = c.id
                WHERE pa.user_id = ?
                ORDER BY p.created_at DESC
            `;
            projects = db.prepare(query).all(userId);
        } else {
            // Leads and Management see all projects
            query = `
                SELECT p.*, c.username AS creator_username
                FROM projects p
                LEFT JOIN users c ON p.created_by = c.id
                ORDER BY p.created_at DESC
            `;
            projects = db.prepare(query).all();
        }

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/projects — Create a project
router.post('/', (req, res) => {
    try {
        if (req.session.role === 'dev') {
            return res.status(403).json({ error: 'Devs cannot create projects' });
        }

        const { name, description, assigned_to } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const insertProject = db.transaction(() => {
            const stmt = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)');
            const info = stmt.run(name, description || null, req.session.userId);
            const projectId = info.lastInsertRowid;

            if (assigned_to && assigned_to.length > 0) {
                const assignStmt = db.prepare('INSERT INTO project_assignees (project_id, user_id) VALUES (?, ?)');
                for (const userId of assigned_to) {
                    assignStmt.run(projectId, userId);
                }
            }
            return projectId;
        });

        const newProjectId = insertProject();
        const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(newProjectId);
        res.status(201).json(newProject);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/projects/:id/users — Get users assigned to a project
router.get('/:id/users', (req, res) => {
    try {
        const projectId = req.params.id;
        
        const query = `
            SELECT u.id, u.username
            FROM users u
            JOIN project_assignees pa ON u.id = pa.user_id
            WHERE pa.project_id = ?
        `;
        const users = db.prepare(query).all(projectId);
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching project users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/projects/:id — Allow any authenticated user (devs included) to delete a project
router.delete('/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        
        const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
        res.json({ ok: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
