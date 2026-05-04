// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

// Import route handlers
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');

// Initialize the Express application
const app = express();

// --- Middleware ---

// Enable CORS
app.use(cors());

// Parse incoming JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Optional but recommended: cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- Routes ---

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// --- Error Handling ---

// Catch-all 404 handler for undefined routes
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Generic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({ error: message });
});

// --- Server Setup ---

app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ error: message });
});

// Export the app, but DON'T listen here
module.exports = app;