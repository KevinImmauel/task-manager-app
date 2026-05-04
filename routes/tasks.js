const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/tasks — Get all tasks with aggregated assignees
router.get('/', (req, res) => {
    try {
        const query = `
            SELECT 
                t.*,
                c.username AS creator_username,
                GROUP_CONCAT(u.username, ', ') AS assignees
            FROM tasks t
            LEFT JOIN users c ON t.created_by = c.id
            LEFT JOIN task_assignees ta ON t.id = ta.task_id
            LEFT JOIN users u ON ta.user_id = u.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `;
        const tasks = db.prepare(query).all();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/tasks — Restrict to Leads, handle category and multiple assignees
router.post('/', (req, res) => {
    try {
        if (req.session.role !== 'lead') {
            return res.status(403).json({ error: 'Only Team Leads can assign tasks' });
        }

        const { title, description, category, priority, assigned_to } = req.body;
        
        if (!title || !category) {
            return res.status(400).json({ error: 'Title and Category are required' });
        }

        // Execute inside a transaction
        const insertTask = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO tasks (title, description, category, priority, created_by)
                VALUES (?, ?, ?, ?, ?)
            `);
            const info = stmt.run(
                title, 
                description || null, 
                category, 
                priority || 'medium', 
                req.session.userId
            );
            const taskId = info.lastInsertRowid;

            // Handle multiple assignees (assigned_to should be an array of user IDs)
            if (assigned_to && assigned_to.length > 0) {
                const assignStmt = db.prepare('INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)');
                for (const userId of assigned_to) {
                    assignStmt.run(taskId, userId);
                }
            }
            return taskId;
        });

        const newTaskId = insertTask();
        const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newTaskId);
        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/tasks/:id/move — Role-based workflow enforcement
// PATCH /api/tasks/:id/move — Strict Role-based workflow enforcement
router.patch(['/:id/move', '/:id/status'], (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body;
        const userRole = req.session.role;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        // DEV RULES: Can only move forward to progress or review
        if (userRole === 'dev') {
            if (!['in_progress', 'in_review'].includes(status)) {
                return res.status(403).json({ error: 'Devs can only move tasks to In Progress or Ask for Review' });
            }
        } 
        // LEAD RULES: Cannot do dev work. Can only complete tasks (or move back to todo)
        else if (userRole === 'lead') {
            if (['in_progress', 'in_review'].includes(status)) {
                return res.status(403).json({ error: 'Leads cannot start progress or put tasks in review' });
            }
        }

        const stmt = db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const info = stmt.run(status, taskId);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ ok: true, status });
    } catch (error) {
        console.error('Error moving task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/tasks/:id — Keep your existing logic
router.delete('/:id', (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.session.userId;

        const task = db.prepare('SELECT created_by FROM tasks WHERE id = ?').get(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden: You can only delete tasks you created' });
        }

        db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        res.json({ ok: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;