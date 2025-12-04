import assert from 'node:assert';
import { describe, it } from 'node:test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const API_BASE = 'http://localhost:3001/api';
const JWT_SECRET = 'ai_health_secret_key_2024_secure';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '../data/users.json');

const userEmail = `test_${Date.now()}@example.com`;
const userPass = 'Test@1234';
const userNick = 'TestUser';
let authToken = '';

describe('Authentication System Tests', async () => {

    it('should register a new user', async () => {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userEmail,
                password: userPass,
                nick: userNick
            })
        });
        const data = await res.json();
        if(res.status !== 201) console.error(data);
        assert.strictEqual(res.status, 201);
    });

    it('should login successfully immediately', async () => {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, password: userPass })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.ok(data.token);
        authToken = data.token;
    });

    it('should access protected profile', async () => {
        const res = await fetch(`${API_BASE}/user/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.email, userEmail);
    });

    it('should save assessment to profile', async () => {
        const mockAssessment = {
            date: new Date().toISOString(),
            scores: { A: 60, B: 30 },
            results: { A: '是', B: '否' },
            mainTypes: ['A']
        };

        const res = await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ assessment: mockAssessment })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);

        // Verify it was saved
        const getRes = await fetch(`${API_BASE}/user/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const getData = await getRes.json();
        assert.deepStrictEqual(getData.profile.assessment, mockAssessment);
    });
});
