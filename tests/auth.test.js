const request = require('supertest');
const app = require('../app');

describe('Authentication API', () => {
    
    test('POST /api/auth/login - valid credentials returns 200 and sets session cookie', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'alice',
                password: 'alice123'
            });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.user.username).toBe('alice');
        
        // Verify that express-session set a cookie
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toMatch(/connect\.sid/);
    });

    test('POST /api/auth/login - invalid password returns 401', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'alice',
                password: 'wrongpassword'
            });

        expect(response.status).toBe(401);
        expect(response.body.error).toBeDefined();
    });

    test('GET /api/auth/me - without login returns 401', async () => {
        const response = await request(app).get('/api/auth/me');
        
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/Not logged in/);
    });
});