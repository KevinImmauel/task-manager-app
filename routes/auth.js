const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/schema');

const router = express.Router();


router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        
        req.session.userId = user.id;

        return res.json({ 
            ok: true, 
            user: { 
                id: user.id, 
                username: user.username 
            } 
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/logout', (req, res) => {
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out' });
        }
        
        
        res.clearCookie('connect.sid'); 
        
        return res.json({ ok: true });
    });
});


router.get('/me', (req, res) => {
    
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        
        const stmt = db.prepare('SELECT id, username FROM users WHERE id = ?');
        const user = stmt.get(req.session.userId);

        if (!user) {
            
            return res.status(401).json({ error: 'User no longer exists' });
        }

        return res.json({ user });

    } catch (error) {
        console.error('Get /me error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;