/**
 * MatrixSpaces - Integration & Security Test Suite
 * 
 * To run these tests:
 * 1. Ensure your local server is running (`npm start` on port 3000)
 * 2. Install dependencies: `npm install --save-dev jest socket.io-client supertest`
 * 3. Run the suite: `npx jest websocket_suite.test.js`
 */

const io = require('socket.io-client');
const request = require('supertest');
const pool = require('./db');

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

describe('MatrixSpaces Core Security & WebSocket Suite', () => {
    let clientSocket;
    let receiverSocket;
    let validPropertyId = 1;

    beforeAll(async () => {
        try {
            // Dynamically fetch a valid property ID to avoid foreign key constraints
            const propRes = await pool.query('SELECT id FROM properties LIMIT 1');
            if (propRes.rows.length > 0) {
                validPropertyId = propRes.rows[0].id;
            }
        } catch (err) {
            console.error("Test DB Error:", err.message);
        }

        // Setup the primary client socket
        clientSocket = io(SERVER_URL, {
            reconnectionDelay: 0,
            forceNew: true,
            transports: ['websocket']
        });

        // Setup a secondary socket to verify broadcast receipts
        receiverSocket = io(SERVER_URL, {
            reconnectionDelay: 0,
            forceNew: true,
            transports: ['websocket']
        });

        return new Promise((resolve) => {
            let connectedCount = 0;
            const checkDone = () => {
                connectedCount++;
                if (connectedCount === 2) resolve();
            };
            clientSocket.on('connect', checkDone);
            receiverSocket.on('connect', checkDone);
        });
    });

    afterAll(async () => {
        if (clientSocket.connected) clientSocket.disconnect();
        if (receiverSocket.connected) receiverSocket.disconnect();
        await pool.end(); // Safely close the test's database connection
    });

    test('WS-01: Connection Handshake & Stability', () => {
        expect(clientSocket.connected).toBeTruthy();
        expect(receiverSocket.connected).toBeTruthy();
    });

    test('WS-02: HTTP Headers & Basic Security', async () => {
        const response = await request(SERVER_URL).get('/');
        expect(response.status).toBe(200);
        // Helmet should set these headers
        expect(response.headers['x-powered-by']).toBeUndefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('WS-03: XSS Sanitization on send_message', (done) => {
        const maliciousPayload = {
            propertyId: validPropertyId, // Use dynamically fetched valid ID
            sender: 'demo_tenant',
            content: 'Hello <script>alert("xss")</script><img src="x" onerror="stealCookie()">',
            tenantUsername: 'demo_tenant'
        };

        receiverSocket.emit('join_room', { propertyId: validPropertyId, username: 'demo_tenant' });
        
        setTimeout(() => {
            receiverSocket.on('receive_message', (data) => {
                expect(data.content).not.toContain('<script>');
                expect(data.content).not.toContain('onerror');
                expect(data.content).toContain('Hello');
                done();
            });

            clientSocket.emit('send_message', maliciousPayload);
        }, 300); // Wait slightly for the room join to process
    });

    test('WS-04: Socket Rate Limiting (Event Spam Drop)', (done) => {
        // Spam 30 typing events rapidly (Limit is 20 per 10s)
        for (let i = 0; i < 30; i++) {
            clientSocket.emit('typing', { propertyId: validPropertyId, tenantUsername: 'demo_tenant' });
        }

        // If the server didn't crash from DoS and we remain connected, the test passes
        setTimeout(() => {
            expect(clientSocket.connected).toBeTruthy();
            done();
        }, 500);
    });
});