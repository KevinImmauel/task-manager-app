const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all task routes
router.use(requireAuth);

// GET /api/tasks — Get all tasks with optional filtering
router.get('/', (req, res) => {
    try {
        const { status, assigned_to, priority } = req.query;
        
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];

        // Dynamically build the WHERE clause based on provided filters
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (assigned_to) {
            query += ' AND assigned_to = ?';
            params.push(assigned_to);
        }
        if (priority) {
            query += ' AND priority = ?';
            params.push(priority);
        }

        // Order by newest first
        query += ' ORDER BY created_at DESC';

        const tasks = db.prepare(query).all(...params);
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/tasks — Create a new task
router.post('/', (req, res) => {
    try {
        const { title, description, priority, assigned_to } = req.body;
        const created_by = req.session.userId;

        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const stmt = db.prepare(`
            INSERT INTO tasks (title, description, priority, assigned_to, created_by)
            VALUES (?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            title, 
            description || null, 
            priority || 'medium', 
            assigned_to || null, 
            created_by
        );

        // Fetch and return the newly created task
        const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/tasks/:id — Update any fields on a task
router.patch('/:id', (req, res) => {
    try {
        const taskId = req.params.id;
        const updates = req.body;
        
        // Prevent ID manipulation
        delete updates.id;
        delete updates.created_by;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        // Dynamically build the UPDATE query
        const setClauses = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            params.push(value);
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        params.push(taskId); // for the WHERE clause

        const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        
        const info = db.prepare(query).run(...params);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/tasks/:id/move (and /status for frontend compatibility) — Update just the status
router.patch(['/:id/move', '/:id/status'], (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const stmt = db.prepare(`
            UPDATE tasks 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);

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

// DELETE /api/tasks/:id — Delete a task (only if owned by the user)
router.delete('/:id', (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.session.userId;

        // First, check if the task exists and verify ownership
        const task = db.prepare('SELECT created_by FROM tasks WHERE id = ?').get(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden: You can only delete tasks you created' });
        }

        // Perform the deletion
        db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        
        res.json({ ok: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;