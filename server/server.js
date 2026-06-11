const path = require('path');
const { createRequire } = require('module');
const crypto = require('crypto');
const { loadEnv } = require('./load-env');
loadEnv();

// Normalize AWS env variables to strip hidden Windows \r characters and quotes
if (process.env.AWS_S3_BUCKET_NAME) process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME.replace(/[^a-zA-Z0-9-.]/g, '');
if (process.env.AWS_REGION) process.env.AWS_REGION = process.env.AWS_REGION.replace(/[^a-zA-Z0-9-]/g, '');
if (process.env.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID.replace(/['"\s]/g, '');
if (process.env.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY.replace(/['"\s]/g, '');

console.log("-----------------------------------------");
console.log("🔗 S3 Bucket loaded:", process.env.AWS_S3_BUCKET_NAME || "MISSING ❌");
console.log("-----------------------------------------");

// Fix for "ReferenceError: root is not defined" in @socket.io/component-emitter
if (typeof global !== 'undefined' && !global.root) { global.root = global; }

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { compressImage, shutdown: shutdownImageWorkers } = require('./image-processor');
const pool = require('./db');
const nodemailer = require('nodemailer');
const fs = require('fs');
const BotService = require('./bot-service');
const notificationService = require('./notification-service');
const rateLimit = require('express-rate-limit');
const pgSession = require('connect-pg-simple')(session);
const setupSockets = require('./sockets');
const adminRoutes = require('./admin-routes');
const authRoutes = require('./auth-routes');
const ownerRoutes = require('./owner-routes');
const propertyRoutes = require('./property-routes');
const builderRoutes = require('./builder-routes');
const publicRoutes = require('./public-routes');
const dashboardRoutes = require('./dashboard-routes');
const referralRoutes = require('./referral-routes');
const chatRoutes = require('./chat-routes');
const chatUiRoutes = require('./chat-ui-routes');
const { getTurnstileSiteKey } = require('./captcha');
const { csrfTokenRoute, requireCsrf, ensureCsrfToken } = require('./csrf-protection');

const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { emailWorker } = require('./email-queue');
const { redisClient, hasRedisConfig } = require('./redis-cache');
const RedisSessionStore = require('./redis-session-store');
const ensurePerformanceIndexes = require('./ensure-performance-indexes');

const cors = require('cors');
const isVercelRuntime = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const isEmbeddedBackend = process.env.MATRIX_EMBEDDED_BACKEND === '1' || process.env.MATRIX_EMBEDDED_BACKEND === 'true';
const app = express();
const server = (!isVercelRuntime && !isEmbeddedBackend) ? http.createServer(app) : null;

function normalizeOrigin(value) {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function parseOriginList(value) {
    if (!value) return [];
    return value.split(',').map((entry) => normalizeOrigin(entry.trim())).filter(Boolean);
}

function parseOriginPatternList(value) {
    if (!value) return [];
    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function matchesOriginPattern(origin, pattern) {
    if (!origin || !pattern) return false;
    try {
        const { protocol, host } = new URL(origin);
        const normalizedPattern = pattern.toLowerCase();

        if (!normalizedPattern.includes('*')) {
            return origin.toLowerCase() === normalizedPattern;
        }

        const patternUrl = new URL(normalizedPattern.replace('*.', 'placeholder.'));
        if (protocol !== patternUrl.protocol) return false;

        const expectedHost = patternUrl.host.replace(/^placeholder\./, '');
        return host === expectedHost || host.endsWith(`.${expectedHost}`);
    } catch {
        return false;
    }
}

function createRequiredSecret(name) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
    if (process.env.NODE_ENV !== 'production' || isVercelRuntime) {
        const secretFile = path.join(__dirname, `.dev-${name.toLowerCase()}`);
        try {
            if (fs.existsSync(secretFile)) {
                const storedSecret = fs.readFileSync(secretFile, 'utf8').trim();
                if (storedSecret) return storedSecret;
            }
            const generated = crypto.randomBytes(32).toString('hex');
            fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
            return generated;
        } catch {
            return crypto.randomBytes(32).toString('hex');
        }
    }
    throw new Error(`Missing required environment variable: ${name}`);
}

const allowedOrigins = new Set([
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...parseOriginList(process.env.FRONTEND_ORIGIN),
    ...parseOriginList(process.env.NEXT_PUBLIC_API_BASE_URL),
    ...parseOriginList(process.env.NEXT_PUBLIC_FRONTEND_URL),
    ...parseOriginList(process.env.AUTH0_BASE_URL),
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
]);

const allowedOriginPatterns = [
    ...parseOriginPatternList(process.env.CORS_ORIGIN_PATTERNS),
    ...parseOriginPatternList(process.env.FRONTEND_ORIGIN_PATTERNS)
];

if (process.env.NODE_ENV !== 'production') {
    allowedOriginPatterns.push(
        'https://*.ngrok-free.dev',
        'https://*.ngrok.app',
        'https://*.ngrok.io'
    );
}

if (process.env.AWS_S3_BUCKET_NAME && process.env.AWS_REGION) {
    allowedOrigins.add(`https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`);
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    return allowedOriginPatterns.some((pattern) => matchesOriginPattern(origin, pattern));
}

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalized = normalizeOrigin(origin);
        if (normalized && isOriginAllowed(normalized)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
};

// Allow CORS only for approved frontend origins.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

const io = server ? new Server(server, {
    cors: {
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            const normalized = normalizeOrigin(origin);
            if (normalized && isOriginAllowed(normalized)) return callback(null, true);
            return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
        },
        credentials: true
    },
    maxHttpBufferSize: 2e6 // 2MB limit for WebSocket payloads to prevent DoS
}) : null;

// Allow configuring the frontend repository path via .env for separate repositories
const configuredFrontendPath = process.env.FRONTEND_PATH ? path.resolve(process.env.FRONTEND_PATH) : null;
const legacyFrontendPath = path.join(__dirname, '../frontend');
let FRONTEND_PATH = path.join(__dirname, '..');

if (configuredFrontendPath && fs.existsSync(path.join(configuredFrontendPath, 'app'))) {
    FRONTEND_PATH = configuredFrontendPath;
} else if (fs.existsSync(path.join(legacyFrontendPath, 'app'))) {
    FRONTEND_PATH = legacyFrontendPath;
}

const embeddedFrontendPackagePath = path.join(FRONTEND_PATH, 'package.json');
const shouldBootstrapEmbeddedFrontend = !isVercelRuntime && !isEmbeddedBackend && fs.existsSync(embeddedFrontendPackagePath);
const LEGACY_VIEWS_PATH = path.join(__dirname, '../views');

let nextHandle = null;
let isNextReady = false;
if (shouldBootstrapEmbeddedFrontend) {
    try {
        const frontendRequire = createRequire(embeddedFrontendPackagePath);
        const next = frontendRequire('next');
        const nextApp = next({
            dev: process.env.NODE_ENV !== 'production',
            dir: FRONTEND_PATH
        });
        nextHandle = nextApp.getRequestHandler();
        nextApp.prepare()
            .then(() => {
                isNextReady = true;
                console.log(`Next frontend mounted from ${FRONTEND_PATH}`);
            })
            .catch((err) => {
                console.error('Next frontend prepare failed:', err.message);
                nextHandle = null;
            });
    } catch (err) {
        console.error('Next frontend bootstrap skipped:', err.message);
    }
} else {
    console.log('Embedded Next frontend disabled for this runtime.');
}

const LEGACY_EJS_PATHS = new Set([]);

const LEGACY_EJS_PREFIXES = [
    '/visits/approve',
    '/notifications/'
];

const LEGACY_EJS_VIEWS = new Set([]);

function isLegacyEjsPath(pathname) {
    return LEGACY_EJS_PATHS.has(pathname) || LEGACY_EJS_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isLegacyEjsView() {
    return false;
}

// Ensure all local upload directories exist on server startup to prevent ENOENT crashes
const localUploadsDir = path.join(FRONTEND_PATH, 'public/uploads/');
if (!fs.existsSync(localUploadsDir)) fs.mkdirSync(localUploadsDir, { recursive: true });

const localKycDir = path.join(__dirname, 'kyc_uploads');
if (!fs.existsSync(localKycDir)) fs.mkdirSync(localKycDir, { recursive: true });

const localVaultDir = path.join(__dirname, 'vault_uploads');
if (!fs.existsSync(localVaultDir)) fs.mkdirSync(localVaultDir, { recursive: true });

// Trust the reverse proxy (Nginx/Load Balancer) to correctly identify HTTPS protocol
app.set('trust proxy', 1);
app.set('views', LEGACY_VIEWS_PATH);
app.engine('ejs', require('ejs').__express);
app.set('view engine', 'ejs');

// Support the same backend prefix locally and on Vercel.
app.use((req, res, next) => {
    const backendPrefix = '/svc/server';
    const currentUrl = String(req.url || '');

    if (currentUrl === backendPrefix || currentUrl.startsWith(`${backendPrefix}/`)) {
        const rewrittenUrl = currentUrl.slice(backendPrefix.length) || '/';
        req.url = rewrittenUrl;
        req.originalUrl = rewrittenUrl;
    }

    next();
});

// Ensure Express recognizes HTTPS even if Nginx is missing the X-Forwarded-Proto header
app.use((req, res, next) => {
    if (process.env.AUTH0_BASE_URL && process.env.AUTH0_BASE_URL.startsWith('https')) {
        req.headers['x-forwarded-proto'] = 'https';
    }
    next();
});

// --- Middleware: Security, Performance & Logging ---
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https:',
                ...Array.from(allowedOrigins)
            ],
            fontSrc: ["'self'", 'data:', 'https:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                ...(isProduction ? [] : ["'unsafe-eval'"]),
                'https:'
            ],
            connectSrc: [
                "'self'",
                'ws:',
                'wss:',
                'https:',
                ...Array.from(allowedOrigins)
            ],
            formAction: ["'self'", ...Array.from(allowedOrigins)],
            frameSrc: ["'self'", 'https://www.google.com', 'https://www.youtube.com']
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // Keep relaxed for external media tiles/CDN assets
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(compression()); // GZIP responses for faster loading

app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = normalizeOrigin(req.get('origin')) || normalizeOrigin(req.get('referer'));
    if (origin && !isOriginAllowed(origin)) {
        return res.status(403).send('Blocked by origin policy.');
    }

    next();
});

// HTTP request logger (skipping local static files to keep console clean)
app.use(morgan('dev', {
    skip: function (req, res) {
        const url = req.originalUrl.toLowerCase();
        // Skip static assets and automated bot scanners to keep logs clean
        return url.startsWith('/uploads/') || 
               url.startsWith('/assets/') || 
               url.includes('sw.js') || 
               url.includes('/api/v1/') || 
               url.includes('.php') || 
               url.includes('wp-') ||
               url.includes('.ini') ||
               url.includes('.env') ||
               url.includes('.git');
    }
}));

// Serve static files from public directory
// --- Serve the frontend ---
// This will serve your existing HTML, JS, and CSS files from the 'public' directory
app.use((req, res, next) => {
    // Catch accidental double-prefixing of S3 URLs by old templates
    if (req.url.includes('/uploads/http')) {
        const match = req.url.match(/\/uploads\/(https?:\/.*)/);
        if (match && match[1]) {
            let actualUrl = match[1].replace(/^(https?:)\/([^\/])/, '$1//$2');
            return res.redirect(301, actualUrl);
        }
    }
    // S3 Fallback Interceptor: Redirect legacy local requests to S3 seamlessly
    if (process.env.AWS_S3_BUCKET_NAME) {
        if (req.url.startsWith('/uploads/properties/') || req.url.startsWith('/uploads/projects/') || req.url.startsWith('/uploads/logos/') || req.url.startsWith('/uploads/profiles/') || req.url.startsWith('/uploads/covers/')) {
            const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com${req.url.replace('/uploads', '')}`;
            return res.redirect(301, s3Url);
        }
    }
    // Broad fix for severely corrupted image URLs (e.g. /%22/uploads/file.jpg/%22/r/n)
    if (req.url.includes('/uploads/') && (req.url.includes('%22') || req.url.includes('"') || req.url.includes('/r/n') || req.url.includes('%0D%0A'))) {
        const match = req.url.match(/\/uploads\/([^/%"'\?]+)/);
        if (match && match[1]) {
            req.url = '/uploads/' + match[1].replace(/\\r\\n|\r|\n/g, '').trim();
            req.originalUrl = req.url; // Overwrite originalUrl so the 404 logger doesn't log the garbage
        }
    }
    next();
});
app.use(express.static(path.join(FRONTEND_PATH, 'public')));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Email Config
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const hasAuth0RuntimeConfig = Boolean(
    process.env.AUTH0_BASE_URL &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_ISSUER_BASE_URL
);

const auth0Config = hasAuth0RuntimeConfig ? {
    authRequired: false,
    auth0Logout: true,
    routes: { 
        login: false,
        logout: false, // Disable default logout route to allow custom confirmation page
        callback: '/auth0/callback-sync' // Explicitly set the callback path
    },
    secret: createRequiredSecret('AUTH0_SECRET'),
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    authorizationParams: {
        response_mode: 'form_post'
    }
} : null;

const requestedSessionStore = String(process.env.SESSION_STORE || '').trim().toLowerCase();
const wantsRedisSessionStore = requestedSessionStore === 'redis';
const usePostgresSessionStore = !wantsRedisSessionStore && (process.env.NODE_ENV === 'production' || requestedSessionStore === 'postgres');
const sessionStore = wantsRedisSessionStore
    ? new RedisSessionStore({
        client: redisClient,
        prefix: 'sess:',
        ttlSeconds: 60 * 60 * 24 * 30
    })
    : usePostgresSessionStore
        ? new pgSession({
            pool: pool,
            tableName: 'session'
        })
        : new session.MemoryStore();

const sessionMiddleware = session({
    store: sessionStore,
    secret: createRequiredSecret('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false, // Best practice: don't save uninitialized sessions
    rolling: true, // Reset cookie expiration on every request
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.AUTH0_BASE_URL && process.env.AUTH0_BASE_URL.startsWith('https'), // Disable secure cookies if using HTTP IP address
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000 // 1 hour default inactivity timeout
    }
});
app.use(sessionMiddleware);
if (wantsRedisSessionStore) {
    console.warn('Using Redis session store.');
} else if (hasRedisConfig) {
    console.warn('Redis cache configured, but session store remains unchanged because SESSION_STORE is not set to redis.');
} else if (!usePostgresSessionStore) {
    console.warn('Using in-memory session store for local development.');
}
if (auth0Config) {
    try {
        const { auth } = require('express-openid-connect');
        app.use(auth(auth0Config));
    } catch (error) {
        console.warn(
            'Auth0 middleware disabled because express-openid-connect failed to load:',
            error && error.message ? error.message : error
        );
    }
} else {
    console.warn('Auth0 middleware disabled because required environment variables are missing.');
}

app.get('/api/csrf-token', csrfTokenRoute);

app.use((req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = function patchedSend(body) {
        const contentType = String(res.getHeader('Content-Type') || '');
        const looksLikeHtml = typeof body === 'string' && (
            contentType.includes('text/html') ||
            /^\s*<!doctype html/i.test(body) ||
            /^\s*<html/i.test(body)
        );

        if (looksLikeHtml && !body.includes('/js/csrf-guard.js')) {
            ensureCsrfToken(req, res);
            const scriptTag = '\n<script src="/js/csrf-guard.js" defer></script>\n';
            body = body.includes('</body>') ? body.replace('</body>', `${scriptTag}</body>`) : `${body}${scriptTag}`;
        }

        return originalSend(body);
    };
    next();
});

function isCsrfExemptPath(pathname) {
    return pathname === '/auth0/callback-sync';
}

app.use((req, res, next) => {
    if (isCsrfExemptPath(req.path || req.originalUrl || '')) return next();
    return requireCsrf(req, res, next);
});

function shouldProxyToNext(req) {
    const pathname = req.path || '/';
    if (!['GET', 'HEAD'].includes(req.method)) return false;
    if (pathname.startsWith('/_next/')) return true;
    if (isLegacyEjsPath(pathname)) return false;

    const excludedPrefixes = [
        '/api/',
        '/admin/',
        '/auth0/login',
        '/auth0/sync',
        '/auth0/callback-sync',
        '/chat/',
        '/socket.io/',
        '/uploads/',
        '/assets/',
        '/js/',
        '/css/',
        '/sounds/',
        '/fonts/',
        '/admin/export/',
        '/admin/kyc-file/',
        '/verify-email/',
        '/vault/file/'
    ];
    const excludedExact = new Set([
        '/api',
        '/admin',
        '/chat',
        '/socket.io',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
        '/manifest.json',
        '/manifest.webmanifest',
        '/health',
        '/api/health',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png'
    ]);

    if (excludedExact.has(pathname)) return false;
    if (excludedPrefixes.some(prefix => pathname.startsWith(prefix))) return false;
    if (pathname.startsWith('/__nextjs_font/')) return true;
    if (path.extname(pathname)) return false;

    const accept = req.headers.accept || '';
    return accept.includes('text/html') || accept.includes('*/*') || accept === '';
}

async function renderWithNext(req, res, next) {
    if (!shouldProxyToNext(req)) return next();
    try {
        if (!nextHandle) {
            res.setHeader('x-matrix-renderer', 'next-unavailable');
            return res.status(503).type('html').send(`
                <!doctype html>
                <html>
                  <head><title>MatrixSpaces frontend unavailable</title></head>
                  <body style="font-family:system-ui;margin:3rem;line-height:1.5">
                    <h1>MatrixSpaces frontend is not running</h1>
                    <p>Install frontend dependencies and build the Next app, then restart backend.</p>
                  </body>
                </html>
            `);
        }
        if (!isNextReady) {
            res.setHeader('x-matrix-renderer', 'next-initializing');
            return res.status(503).type('html').send(`
                <!doctype html>
                <html>
                  <head><title>MatrixSpaces frontend initializing</title></head>
                  <body style="font-family:system-ui;margin:3rem;line-height:1.5">
                    <h1>Frontend is starting</h1>
                    <p>Next.js is still initializing. Refresh in a few seconds.</p>
                  </body>
                </html>
            `);
        }
        res.setHeader('x-matrix-renderer', 'next');
        return nextHandle(req, res);
    } catch (err) {
        console.error(`Next frontend render failed for ${req.originalUrl}:`, err.message);
        res.setHeader('x-matrix-renderer', 'next-error');
        return res.status(503).type('html').send(`
            <!doctype html>
            <html>
              <head><title>MatrixSpaces frontend unavailable</title></head>
              <body style="font-family:system-ui;margin:3rem;line-height:1.5">
                <h1>MatrixSpaces frontend is not running</h1>
                <p>Next.js could not handle this request. Check frontend build/runtime logs.</p>
              </body>
            </html>
        `);
    }
}

app.use(renderWithNext);

function nextPathForRender(view, req, locals = {}) {
    const viewPath = String(view || '').replace(/\\/g, '/');
    const directMap = {
        'index': '/',
        'search': '/search',
        'login': '/login',
        'login-2fa': '/login/2fa',
        'logout-confirm': '/logout',
        'forgot-password': '/forgot-password',
        'partner-signup': '/partner-signup',
        'select-role': '/auth0/select-role',
        'auth-error': '/auth-error',
        'complete-profile': '/complete-profile',
        'edit-profile': '/edit-profile',
        'profile': '/profile',
        'avatar-studio': '/avatar-studio',
        'wallet': '/wallet',
        'vault': '/vault',
        'my-visits': '/my-visits',
        'visit-approve': locals.visit && locals.visit.id ? `/visits/approve/${locals.visit.id}` : '/visits/approve',
        'notifications': '/notifications',
        'setup-2fa': '/user/2fa/setup',
        'list-property': '/list-property',
        'agent-dashboard': '/agent',
        'admin-dashboard': '/admin',
        'builder-dashboard': '/builder',
        'owner-dashboard': '/owner',
        'external-sales-dashboard': '/external-sales',
        'corporate-dashboard': '/corporate',
        'chat-inbox': '/messages',
        'chat-window': req.params && req.params.convId ? `/messages/${req.params.convId}` : '/messages',
        'property-conversations': '/property-conversations',
        'Property': req.params && req.params.id ? `/property/${req.params.id}` : '/search',
        'property-sale': req.params && req.params.id ? `/property/${req.params.id}` : '/sale-properties',
        'recommended': '/recommended',
        'favorites': '/favorites',
        'recently-viewed': '/recently-viewed',
        'premium-properties': '/premium-properties',
        'sale-listings': '/sale-properties',
        'newly-added': '/newly-added',
        'compare': '/compare',
        'requirements': '/requirements',
        'portfolio': locals.agent && locals.agent.username ? `/${locals.agent.username}` : '/partners',
        'about': '/about',
        'privacy': '/privacy',
        'privacy-policy': '/privacy-policy',
        'terms': '/terms',
        'terms-conditions': '/terms-conditions',
        'services': '/services',
        'valuation': '/valuation',
        'sell-rent': '/sell-rent',
        'partners': '/partners',
        'contact': '/contact',
        'report': '/report',
        'error': req.originalUrl || '/'
    };
    if (directMap[viewPath]) return directMap[viewPath];
    return `/${viewPath.replace(/\.ejs$/, '')}`;
}

app.use((req, res, next) => {
    const renderEjs = res.render.bind(res);
    res.render = function renderNextFallback(view, locals, callback) {
        if (typeof locals === 'function') {
            callback = locals;
            locals = {};
        }

        if (typeof callback === 'function') {
            const html = '';
            return callback(null, html);
        }

        if (res.headersSent) return;
        const resolvedLocals = locals || {};
        res.setHeader('x-matrix-renderer', 'render-redirect');
        const targetPath = nextPathForRender(view, req, resolvedLocals);
        const query = new URLSearchParams();
        if (resolvedLocals.error) query.set('error', String(resolvedLocals.error));
        if (resolvedLocals.message) query.set('message', String(resolvedLocals.message));
        if (resolvedLocals.tab) query.set('tab', String(resolvedLocals.tab));
        if (resolvedLocals.refCode) query.set('ref', String(resolvedLocals.refCode));
        const targetWithQuery = query.size > 0 ? `${targetPath}${targetPath.includes('?') ? '&' : '?'}${query.toString()}` : targetPath;
        const status = req.method === 'GET' || req.method === 'HEAD' ? 302 : 303;
        return res.redirect(status, targetWithQuery);
    };
    next();
});

// Make user object available to all views
app.use(async (req, res, next) => {
    // Add S3 asset helper to make URLs available in all EJS templates
    res.locals.assetUrl = (filePath) => {
        return `/assets/${filePath}`; // Fallback to local for development
    };
    
    res.locals.s3BaseUrl = process.env.AWS_S3_BUCKET_NAME ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/` : '/uploads/';
    res.locals.turnstileSiteKey = getTurnstileSiteKey();

    if (req.session.user) {
        // Make username empty until name is filled
        if (!req.session.user.name && req.session.user.username) {
            req.session.user.username = ''; 
        }
        // Ensure display_name is available to show name instead of username in header
        req.session.user.display_name = req.session.user.name || req.session.user.username || 'User';
    }

    res.locals.user = req.session.user || null;
    res.locals.isRemembered = req.session && req.session.cookie && req.session.cookie.originalMaxAge > 86400000;
    res.locals.compareList = req.session.compareList || [];
    res.locals.message = (req.query.login === 'success' && req.session.user) ? `Welcome back, ${req.session.user.username}!` : null;
    res.locals.notifications = [];
    res.locals.chatUnreadCount = 0;
    res.locals.totalUnreadCount = 0;
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    const isApiRequest = req.path === '/api/user' || req.path === '/api/csrf-token' || req.path.startsWith('/api/') || wantsJson;
    if (req.session.user) {
        try {
            if (isApiRequest) {
                return next();
            }
            const notifs = await pool.query(
                'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
                [req.session.user.id]
            );
            res.locals.notifications = notifs.rows;

            // Count unread chat messages using the new schema
            const chatCountRes = await pool.query(
                `SELECT COALESCE(SUM(
                    CASE 
                        WHEN owner_id = $1::int THEN unread_count_owner 
                        ELSE unread_count_buyer 
                    END
                ), 0) as count 
                 FROM property_conversations 
                 WHERE (owner_id = $1::int OR buyer_id = $1::int) AND NOT ($1::int = ANY(COALESCE(deleted_by, '{}'::int[])))`,
                [req.session.user.id]
            );
            res.locals.chatUnreadCount = parseInt(chatCountRes.rows[0].count, 10) || 0;

            // Count total unread notifications for the global counter
            const totalRes = await pool.query(
                "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
                [req.session.user.id]
            );
            res.locals.totalUnreadCount = parseInt(totalRes.rows[0].count, 10) || 0;
        } catch(e) {
            console.error("Error fetching header data:", e);
        }

        // Fetch Agent/Broker global rating for their header
        if (['builder', 'broker', 'external_sales'].includes(req.session.user.role)) {
            try {
                const ratingRes = await pool.query('SELECT AVG(rating) as rating, COUNT(id) as review_count FROM user_reviews WHERE target_user_id = $1', [req.session.user.id]);
                res.locals.user.rating = ratingRes.rows[0].rating ? Number(ratingRes.rows[0].rating).toFixed(1) : null;
                res.locals.user.review_count = ratingRes.rows[0].review_count || 0;
            } catch(e) { /* user_reviews table might not exist yet */ }
        }
    }
    next();
});

// File Upload Config & Validation
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed."));
};

const docFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only images and PDF files are allowed for documents."));
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(FRONTEND_PATH, 'public/uploads/');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const hasS3UploadConfig = Boolean(process.env.AWS_S3_BUCKET_NAME && process.env.AWS_REGION);
const s3Config = { region: process.env.AWS_REGION };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}
const s3Client = new S3Client(s3Config);

// Ensure root folders explicitly exist in the AWS S3 Console
const initS3Folders = async () => {
    if (!hasS3UploadConfig) return;
    const folders = ['properties/', 'logos/', 'vault/', 'kyc/'];
    for (const folder of folders) {
        try { await s3Client.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: folder, Body: Buffer.from('') })); } 
        catch (e) { /* Safe to ignore if permissions block empty object creation */ }
    }
};
initS3Folders();

const localPropertyStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(FRONTEND_PATH, 'public/uploads/'));
    },
    filename: (req, file, cb) => {
        const folder = file.fieldname === 'company_logo' ? 'logos' : 'properties';
        cb(null, `${folder}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
});
const s3PropertyStorage = hasS3UploadConfig ? multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
        const folder = file.fieldname === 'company_logo' ? 'logos' : 'properties';
        cb(null, `${folder}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
}) : localPropertyStorage;
const upload = multer({ storage: s3PropertyStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// KYC File Upload (Secure storage)
const localKycStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, localKycDir);
    },
    filename: (req, file, cb) => {
        const userId = (req.session && req.session.user) ? req.session.user.id : 'anonymous';
        cb(null, `${userId}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
});
const kycStorage = hasS3UploadConfig ? multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
        const userId = (req.session && req.session.user) ? req.session.user.id : 'anonymous';
        cb(null, `kyc/${userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
}) : localKycStorage;
const uploadKyc = multer({ storage: kycStorage, fileFilter: docFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Vault File Upload (User's personal secure documents)
const localVaultStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, localVaultDir);
    },
    filename: (req, file, cb) => {
        const userId = (req.session && req.session.user) ? req.session.user.id : 'anonymous';
        cb(null, `${userId}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
});
const vaultS3Storage = hasS3UploadConfig ? multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
        const userId = (req.session && req.session.user) ? req.session.user.id : 'anonymous';
        cb(null, `vault/${userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')}`);
    }
}) : localVaultStorage;
const uploadVault = multer({ storage: vaultS3Storage, fileFilter: docFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Rate Limiters

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: "Too many attempts from this IP, please try again after 15 minutes",
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Increased limit to prevent 429 errors during testing
    message: { error: "Too many OTP requests from this IP, please try again later." },
});

const whatsappOtpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minute window
    max: 100, // Increased limit to prevent 429 errors during testing
    message: { error: "Too many WhatsApp OTP requests from this IP, please try again later." },
});

// --- SOCKET.IO ---
// Share Express session with Socket.IO so socket.request.session is populated
if (!isVercelRuntime) {
    io.engine.use(sessionMiddleware);
    setupSockets(io);
    notificationService.initialize(io);
} else {
    console.log('Socket.IO bootstrap disabled for Vercel runtime.');
}

// --- ROUTES ---
// Handle favicon requests to prevent 404 errors in logs
app.get('/favicon.ico', (req, res) => res.status(204).send());

// Handle missing Service Worker (sw.js) to prevent 404 errors in logs
app.get(/sw\.js$/, (req, res) => {
    res.type('application/javascript');
    res.send('// Dummy Service Worker to satisfy browser PWA checks');
});

// Handle robots.txt to prevent 404 errors in logs
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /");
});

// Handle vulnerability scanner bots gracefully to prevent processing overhead
app.all([/^\/iams\/api\//, /^\/api\/v1\//, /\.php$/, /^\/wp-/, /\.ini$/, /\.env$/, /\.git/], (req, res) => {
    res.status(404).send('Not Found');
});

// POST /compare/toggle
app.post('/compare/toggle', (req, res) => {
    const { propertyId } = req.body;
    
    if (!propertyId) {
        return res.status(400).json({ success: false, message: 'Property ID is required' });
    }

    // Initialize compare array in session if it doesn't exist
    if (!req.session.compareList) {
        req.session.compareList = [];
    }

    // Check if it's already in the list
    const index = req.session.compareList.indexOf(String(propertyId));
    let added = false;

    if (index === -1) {
        // Limit to 4 properties
        if (req.session.compareList.length >= 4) {
            return res.json({ success: false, message: 'You can only compare up to 4 properties at a time.' });
        }
        
        // Add to list
        req.session.compareList.push(String(propertyId));
        added = true;
    } else {
        // Remove from list
        req.session.compareList.splice(index, 1);
        added = false;
    }

    res.json({ success: true, added });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    const redirectTarget = '/';
    if (!req.session) {
        return res.json({ success: true, redirectTo: redirectTarget });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout session destroy error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true, redirectTo: redirectTarget });
    });
});

// GET /api/logout (for direct browser navigation)
app.get('/api/logout', (req, res) => {
    if (!req.session) return res.redirect('/');
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.redirect('/');
    });
});

// POST /user/:id/review - Agent/Broker Review
app.post('/user/:id/review', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized. Please log in to leave a review.');
    }

    const targetUserId = req.params.id;
    const reviewerId = req.session.user.id;
    const { rating, comment, property_id } = req.body;

    try {
        await pool.query(
            'INSERT INTO user_reviews (target_user_id, reviewer_id, rating, comment) VALUES ($1, $2, $3, $4)',
            [targetUserId, reviewerId, rating, comment]
        );
        res.redirect(property_id ? `/property/${property_id}` : 'back');
    } catch (error) {
        console.error('Error submitting agent review:', error);
        res.status(500).send('An error occurred while submitting your review.');
    }
});

// --- Static Pages ---
app.get('/about', (req, res) => {
    res.render('about', { user: req.session.user });
});

app.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy', { user: req.session.user });
});

app.get('/terms-conditions', (req, res) => {
    res.render('terms-conditions', { user: req.session.user });
});

app.get('/services', (req, res) => {
    res.render('services', { user: req.session.user });
});

app.get('/services/valuation', (req, res) => {
    res.render('valuation', { user: req.session.user });
});

app.get('/services/sell-rent', (req, res) => {
    res.render('sell-rent', { user: req.session.user });
});

// Places autocomplete endpoint (used by valuation/search UIs).
// Added on backend because many pages are served via :3000 where Next API routes are not mounted.
app.get('/api/places/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 2) return res.json({ places: [] });

        const toPlaces = (rows) => rows
            .map((row) => {
                if (!row || !row.display_name || !row.lat || !row.lon) return null;
                return {
                    display_name: String(row.display_name),
                    lat: String(row.lat),
                    lon: String(row.lon),
                    type: row.type ? String(row.type) : undefined
                };
            })
            .filter(Boolean);

        let places = [];

        // Primary provider: Photon
        try {
            const photonParams = new URLSearchParams({
                q,
                limit: '8',
                lang: 'en',
                lat: '28.6139',
                lon: '77.2090'
            });
            const photonResp = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, {
                headers: {
                    Accept: 'application/json',
                    'Accept-Language': 'en'
                }
            });
            if (photonResp.ok) {
                const payload = await photonResp.json();
                const features = Array.isArray(payload?.features) ? payload.features : [];
                places = features
                    .filter((f) => {
                        const cc = f?.properties?.countrycode;
                        return !cc || String(cc).toUpperCase() === 'IN';
                    })
                    .map((f) => {
                        const coords = f?.geometry?.coordinates;
                        const props = f?.properties || {};
                        if (!Array.isArray(coords) || coords.length < 2) return null;
                        const parts = [props.name, props.street, props.district, props.city, props.county, props.state, props.country]
                            .map((p) => (p ? String(p).trim() : ''))
                            .filter(Boolean);
                        const display_name = parts.join(', ');
                        if (!display_name) return null;
                        return {
                            display_name,
                            lat: String(coords[1]),
                            lon: String(coords[0]),
                            type: props.osm_value || props.osm_key
                        };
                    })
                    .filter(Boolean);
            }
        } catch (_) {}

        // Fallback provider: Nominatim
        if (!places.length) {
            try {
                const nomParams = new URLSearchParams({
                    q,
                    format: 'jsonv2',
                    addressdetails: '1',
                    limit: '8',
                    countrycodes: 'in'
                });
                const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?${nomParams.toString()}`, {
                    headers: {
                        Accept: 'application/json',
                        'Accept-Language': 'en'
                    }
                });
                if (nomResp.ok) {
                    const rows = await nomResp.json();
                    places = toPlaces(Array.isArray(rows) ? rows : []);
                }
            } catch (_) {}
        }

        // Final static fallback so UI never stays empty.
        if (!places.length) {
            const staticLocalities = [
                { display_name: 'Connaught Place, New Delhi, India', lat: '28.6315', lon: '77.2167', type: 'suburb' },
                { display_name: 'Saket, New Delhi, India', lat: '28.5245', lon: '77.2066', type: 'suburb' },
                { display_name: 'Nehru Place, New Delhi, India', lat: '28.5494', lon: '77.2513', type: 'commercial' },
                { display_name: 'Noida Sector 18, Noida, Uttar Pradesh, India', lat: '28.5708', lon: '77.3260', type: 'suburb' },
                { display_name: 'Noida Sector 62, Noida, Uttar Pradesh, India', lat: '28.6304', lon: '77.3722', type: 'suburb' },
                { display_name: 'Cyber City, Gurugram, Haryana, India', lat: '28.4949', lon: '77.0896', type: 'commercial' },
                { display_name: 'Indiranagar, Bengaluru, Karnataka, India', lat: '12.9784', lon: '77.6408', type: 'suburb' },
                { display_name: 'Koramangala, Bengaluru, Karnataka, India', lat: '12.9352', lon: '77.6245', type: 'suburb' },
                { display_name: 'Bandra, Mumbai, Maharashtra, India', lat: '19.0544', lon: '72.8406', type: 'suburb' },
                { display_name: 'Andheri, Mumbai, Maharashtra, India', lat: '19.1136', lon: '72.8697', type: 'suburb' },
                { display_name: 'Gachibowli, Hyderabad, Telangana, India', lat: '17.4435', lon: '78.3772', type: 'suburb' }
            ];
            const needle = q.toLowerCase();
            places = staticLocalities.filter((p) => p.display_name.toLowerCase().includes(needle)).slice(0, 8);
        }

        return res.json({ places });
    } catch (error) {
        console.error('Places API error:', error?.message || error);
        return res.status(500).json({ places: [] });
    }
});

app.get('/api/places/nearby', async (req, res) => {
    try {
        const lat = Number(req.query.lat ?? req.query.latitude);
        const lon = Number(req.query.lon ?? req.query.lng ?? req.query.longitude);
        const radius = Number(req.query.radius ?? 10000);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ places: [] });
        }

        const safeRadius = Math.min(Math.max(Math.round(radius), 250), 10000);
        const query = `
            [out:json][timeout:12];
            (
              nwr(around:${safeRadius},${lat},${lon})["amenity"~"restaurant|cafe|bank|hospital|school|parking|fuel|pharmacy|cinema"];
              nwr(around:${safeRadius},${lat},${lon})["shop"~"supermarket|mall|convenience"];
              nwr(around:${safeRadius},${lat},${lon})["public_transport"];
              nwr(around:${safeRadius},${lat},${lon})["railway"="station"];
            );
            out center 40;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: new URLSearchParams({ data: query })
        });

        if (!response.ok) return res.json({ places: [] });
        const payload = await response.json().catch(() => ({}));
        const places = Array.isArray(payload?.elements)
            ? payload.elements
                .map((item) => ({
                    id: item.id,
                    name: item?.tags?.name || item?.tags?.amenity || item?.tags?.shop || item?.tags?.railway || 'Nearby place',
                    lat: item.lat ?? item?.center?.lat,
                    lon: item.lon ?? item?.center?.lon,
                    category: item?.tags?.amenity || item?.tags?.shop || item?.tags?.railway || item?.tags?.public_transport || 'place'
                }))
                .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
            : [];

        return res.json({ places });
    } catch (error) {
        console.error('Nearby places API error:', error?.message || error);
        return res.json({ places: [] });
    }
});

// Handle Apple Touch Icons to prevent 404s
app.get('/apple-touch-icon.png', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'public/assets/icon.png'));
});
app.get('/apple-touch-icon-precomposed.png', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'public/assets/icon.png'));
});

// Handle missing default avatar to prevent 404s
app.get('/assets/default-avatar.png', (req, res) => {
    res.redirect('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png');
});

// --- Profile Picture Upload Route ---
const avatarUpload = multer({ storage: storage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/user/avatar/upload', avatarUpload.single('avatar'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }
    if (!req.file) {
        return res.redirect('/profile?error=No file uploaded');
    }

    try {
        // Compress and resize the avatar using worker thread (non-blocking)
        await compressImage(req.file.path, {
            resize: { width: 400, height: 400, fit: 'cover' },
            formatOptions: { quality: 90 }
        });

        const avatarUrl = '/uploads/' + req.file.filename;

        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.session.user.id]);
        req.session.user.avatar_url = avatarUrl; // Update session immediately

        res.redirect('/profile?message=Avatar updated successfully');
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.redirect('/profile?error=Could not process image');
    }
});

app.use('/', authRoutes(uploadKyc, transporter, authLimiter, otpLimiter, whatsappOtpLimiter));
app.use('/', publicRoutes());
app.use('/', dashboardRoutes(uploadVault, upload));
app.use('/', referralRoutes());
app.use('/builder', builderRoutes(upload, uploadKyc));

app.use('/admin', adminRoutes(upload, transporter));
app.use('/owner', ownerRoutes(upload));
app.use('/property', propertyRoutes(upload, transporter));
app.use('/chat', chatRoutes);
app.use('/messages', chatUiRoutes);

// 404 Catch-All Middleware - placed after all valid routes
app.use((req, res, next) => {
    const error = new Error(`Route Not Found: ${req.originalUrl}`);
    error.status = 404;
    next(error); // Pass the error to the global handler below
});

// Global Error Handlers
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    if (statusCode !== 404) {
        console.error("Unhandled Error:", err.stack || err.message);
    }
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(statusCode).json({ 
            status: 'error',
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: isDevelopment ? err.message : 'An unexpected error occurred.' 
        });
    } else {
        const message = statusCode === 404 ? 'Page Not Found' : 'Server Error';
        const details = isDevelopment && err.stack ? `<pre>${String(err.stack).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))}</pre>` : '';
        res.status(statusCode).type('html').send(`
            <!doctype html>
            <html>
              <head><title>${statusCode} ${message}</title></head>
              <body style="font-family:system-ui;margin:3rem;line-height:1.5">
                <h1>${message}</h1>
                ${details}
              </body>
            </html>
        `);
    }
});

// --- Start the server ---
const PORT = process.env.PORT || 3000;
ensurePerformanceIndexes().catch((error) => {
    console.warn('[DB] Performance index bootstrap warning:', error.message);
});
if (process.env.NODE_ENV !== 'test' && !isVercelRuntime && !isEmbeddedBackend) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Running on ${PORT}`);
        if (process.env.AUTH0_BASE_URL && process.env.AUTH0_BASE_URL.includes('localhost')) {
            console.log('\x1b[33m%s\x1b[0m', "WARNING: AUTH0_BASE_URL is set to localhost. Auth0 Signup/Login will fail on phones/ngrok.");
            console.log('\x1b[33m%s\x1b[0m', "FIX: Update AUTH0_BASE_URL in .env to your ngrok URL (e.g. https://xyz.ngrok-free.app)");
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\nError: Port ${PORT} is already in use.`);
            console.error(`To fix this, run: npx kill-port ${PORT}`);
            console.error(`Or start with a different port: $env:PORT=${parseInt(PORT) + 1}; node server.js`);
            process.exit(1);
        } else {
            throw err;
        }
    });
}

// --- Graceful Shutdown ---
const gracefulShutdown = () => {
    console.log('Received kill signal, shutting down gracefully...');
    shutdownImageWorkers(); // Terminate image processing worker threads
    if (emailWorker) emailWorker.close();
    if (redisClient) redisClient.quit();
    const closePoolAndExit = () => {
        pool.end(() => {
            console.log('Database connection pool closed.');
            process.exit(0);
        });
    };
    if (server) {
        server.close(() => {
            console.log('Closed out remaining HTTP connections.');
            closePoolAndExit();
        });
    } else {
        closePoolAndExit();
    }
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export the Express app directly so Vercel can treat this file as a request handler.
module.exports = app;
module.exports.app = app;
module.exports.server = server;
