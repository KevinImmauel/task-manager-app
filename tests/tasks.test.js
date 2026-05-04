const request = require('supertest');
const app = require('../app');

describe('Tasks API', () => {
    let authCookie;
    let createdTaskId;

    // Log in before running task tests to get a valid session cookie
    beforeAll(async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ username: 'alice', password: 'alice123' });
        
        // Extract the cookie array from the response headers
        authCookie = response.headers['set-cookie'];
    });

    test('GET /api/tasks - without auth returns 401', async () => {
        const response = await request(app).get('/api/tasks');
        expect(response.status).toBe(401);
    });

    test('POST /api/tasks - creates a task and returns it', async () => {
        const newTask = {
            title: 'Test Jest Task',
            description: 'Automated test task',
            priority: 'high',
            assigned_to: 1
        };

        const response = await request(app)
            .post('/api/tasks')
            .set('Cookie', authCookie) // Inject the session cookie
            .send(newTask);

        expect(response.status).toBe(201);
        expect(response.body.title).toBe(newTask.title);
        expect(response.body.status).toBe('todo'); // Default status
        
        // Save ID for the PATCH test
        createdTaskId = response.body.id; 
    });

    test('GET /api/tasks - returns an array of tasks', async () => {
        const response = await request(app)
            .get('/api/tasks')
            .set('Cookie', authCookie);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('PATCH /api/tasks/:id/move - changes task status', async () => {
        const response = await request(app)
            .patch(`/api/tasks/${createdTaskId}/move`)
            .set('Cookie', authCookie)
            .send({ status: 'in_progress' });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.status).toBe('in_progress');

        // Verify the change persisted
        const verifyResponse = await request(app)
            .get('/api/tasks')
            .set('Cookie', authCookie);
            
        const updatedTask = verifyResponse.body.find(t => t.id === createdTaskId);
        expect(updatedTask.status).toBe('in_progress');
    });
});