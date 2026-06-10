const fs = require('fs');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const publicRoutes = [
    '/', '/login', '/terms', '/privacy', '/forgot-password',
    '/premium-properties', '/sale-properties', '/newly-added', '/compare'
];

const protectedCommonRoutes = [
    '/profile', '/edit-profile', '/favorites', '/recently-viewed',
    '/my-chats', '/visits', '/notifications', '/vault', '/avatar-studio'
];

// Test accounts for each role
const testAccounts = [
    { role: 'admin', username: 'demo_admin', password: 'Demo@User123', dashboard: '/admin' },
    { role: 'support', username: 'demo_support', password: 'Demo@User123', dashboard: '/admin' },
    { role: 'owner', username: 'demo_owner', password: 'Demo@User123', dashboard: '/owner' },
    { role: 'dealer', username: 'demo_dealer', password: 'Demo@User123', dashboard: '/dealer' },
    { role: 'agent', username: 'demo_agent', password: 'Demo@User123', dashboard: '/agent' },
    { role: 'corporate', username: 'demo_corporate', password: 'Demo@User123', dashboard: '/corporate' },
    { role: 'corporate_user', username: 'demo_corp_user', password: 'Demo@User123', dashboard: '/corporate' },
    { role: 'external_sales', username: 'demo_sales', password: 'Demo@User123', dashboard: '/external-sales' },
    { role: 'tenant', username: 'demo_tenant', password: 'Demo@User123', dashboard: '/' }
];

let output = `Starting comprehensive availability tests for ${baseUrl}...\n\n`;
let passed = 0;
let failed = 0;

function log(msg, isError = false) {
    if (isError) console.error(msg);
    else console.log(msg);
    output += msg + '\n';
}

class TestClient {
    constructor() {
        this.cookie = '';
    }

    async request(method, route, body = null) {
        const options = {
            method,
            redirect: 'manual', // Prevent auto-redirect to capture cookies
            headers: {}
        };
        if (this.cookie) {
            options.headers['Cookie'] = this.cookie;
        }
        if (body) {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.body = new URLSearchParams(body).toString();
        }

        const res = await fetch(`${baseUrl}${route}`, options);
        
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            this.cookie = setCookie.split(';')[0]; // Store the session cookie
        }
        return res;
    }
}

async function runTests() {
    log('--- 1. PUBLIC ROUTES ---');

    for (const route of publicRoutes) {
        try {
            const response = await fetch(`${baseUrl}${route}`);
            if (response.ok) {
                log(`✅ [PASS] ${route} - Status: ${response.status}`);
                passed++;
            } else {
                log(`❌ [FAIL] ${route} - Status: ${response.status}`, true);
                failed++;
            }
        } catch (error) {
            log(`❌ [FAIL] ${route} - Error: ${error.message}`, true);
            failed++;
        }
    }

    log('\n--- 2. AUTHENTICATED ROLES & DASHBOARDS ---');
    
    for (const account of testAccounts) {
        log(`\nTesting Role: ${account.role.toUpperCase()}`);
        
        if (account.username.startsWith('YOUR_')) {
            log(`⚠️  Skipped - Missing credentials in test script.`);
            continue;
        }

        const client = new TestClient();
        try {
            // 1. Perform Login
            const loginRes = await client.request('POST', '/login', { username: account.username, password: account.password });
            
            if (loginRes.status === 302) {
                log(`✅ [PASS] Login successful - Redirected to ${loginRes.headers.get('location')}`);
                passed++;
                
                // 2. Test Expected Dashboard
                const dashRes = await client.request('GET', account.dashboard);
                if (dashRes.status === 200 || dashRes.status === 302) {
                    log(`✅ [PASS] Dashboard (${account.dashboard}) loaded correctly`);
                    passed++;
                } else {
                    log(`❌ [FAIL] Dashboard failed - Status: ${dashRes.status}`, true);
                    failed++;
                }

                // 3. Test Common Protected Routes for this role
                for (const route of protectedCommonRoutes) {
                    const routeRes = await client.request('GET', route);
                    // Accept 200 (OK) or 302 (Expected redirects on some routes)
                    if (routeRes.status === 200 || routeRes.status === 302) {
                        log(`✅ [PASS] Protected Route ${route} accessible`);
                        passed++;
                    } else {
                        log(`❌ [FAIL] Protected Route ${route} failed - Status: ${routeRes.status}`, true);
                        failed++;
                    }
                }

            } else {
                log(`❌ [FAIL] Login failed for ${account.username} - Status: ${loginRes.status} (Check credentials)`, true);
                failed++;
            }
        } catch (error) {
            log(`❌ [FAIL] Error testing role ${account.role} - ${error.message}`, true);
            failed++;
        }
    }

    const summary = `\n=================================\nTest Summary: ${passed} Passed, ${failed} Failed.\n=================================`;
    log(summary);

    fs.writeFileSync('test-results.txt', output, 'utf8');
    console.log('Detailed results exported to test-results.txt');

    process.exit(failed > 0 ? 1 : 0);
}

runTests();