import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const windowMs = config.rateLimitWindowMinutes * 60 * 1000;

export const apiRateLimiter = rateLimit({
    windowMs,
    // Dev UX: local UI can generate lots of background API calls (location, polling, etc).
    // Keep production strict, but avoid blocking local development.
    max: config.nodeEnv === 'development' ? Math.max(config.rateLimitMaxRequests, 2000) : config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user && req.user.userId) {
            return req.user.userId.toString();
        }
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip;
        return ip;
    },
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000;

/** Stricter rate limit for auth routes (OTP, login, refresh, logout). Applied in addition to global limiter. */
export const authRateLimiter = rateLimit({
    windowMs: authWindowMs,
    // Dev UX: login/otp testing can be frequent. Keep production strict (e.g. 30), 
    // but relax local development to avoid 429 when testing flows.
    max: config.nodeEnv === 'development' ? Math.max(config.authRateLimitMax, 100) : config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip;
        return ip;
    },
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});


/**
 * Strict limit for endpoints that move money (wallet top-up, withdrawal requests, cash deposits,
 * payment verification). Applied AFTER authentication so it counts per user, in addition to the
 * global limiter. A normal person never comes near this; a script hammering a payout endpoint does.
 */
export const moneyRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: config.nodeEnv === 'development' ? 200 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user && req.user.userId) return `money:${req.user.userId.toString()}`;
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        return `money:${forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip}`;
    },
    message: {
        success: false,
        message: 'Too many payment requests. Please wait a few minutes and try again.'
    }
});

// ---------------------------------------------------------------------------------------
// Global per-IP limiter (ported from the legacy backend)
// ---------------------------------------------------------------------------------------

const normalizeIp = (ip) => String(ip || '').trim().replace(/^::ffff:/i, '');

/** Real client address behind nginx (X-Forwarded-For chain, then X-Real-IP, then the socket). */
const clientIp = (req) => {
    const forwarded = normalizeIp(String(req.headers['x-forwarded-for'] || '').split(',')[0]);
    const realIp = normalizeIp(req.headers['x-real-ip']);
    const direct = normalizeIp(req.ip || req.socket?.remoteAddress);
    return forwarded || realIp || direct || 'unknown';
};

const requestPath = (req) => String(req.originalUrl || req.url || '').split('?')[0];

/**
 * Requests the global limiter never counts: they are high-volume, cached or required for the
 * apps to work, so limiting them would only lock real users out. Auth, uploads and money
 * endpoints keep their own stricter limiters.
 */
export const shouldSkipGlobalRateLimit = (req) => {
    if (req.method === 'OPTIONS') return true;

    const path = requestPath(req);

    // Session maintenance and health checks
    if (/^(\/api)?\/v1\/(food\/)?auth\/(me|refresh-token|logout)(\/|$)/.test(path)) return true;
    if (/^(\/api)?\/v1\/health/.test(path)) return true;

    // Payment gateway callbacks come from the provider's servers, not from users
    if (/^(\/api)?\/v1\/payments\/webhook/.test(path)) return true;

    if (req.method === 'GET') {
        // Cached public config / banners — requested on every screen
        if (/\/public(\/|$)/.test(path)) return true;
        // Service-area detection runs on every location update
        if (/\/zones\/(detect|nearby)/.test(path)) return true;
        // Cached restaurant catalogue and dining listings
        if (/\/food\/restaurant\/restaurants/.test(path)) return true;
        if (/\/food\/dining\/(categories|restaurants)\/public/.test(path)) return true;
        // Search runs on every keystroke
        if (/\/food\/search\//.test(path)) return true;
    }

    return false;
};

/** Layer 1 — one generous ceiling per client IP for the whole API. Disabled with RATE_LIMIT_ENABLED=false. */
export const globalApiRateLimiter = config.rateLimitEnabled === false
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs,
        max: config.nodeEnv === 'development' ? Math.max(config.globalRateLimitMax, 5000) : config.globalRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `ip:${clientIp(req)}`,
        skip: shouldSkipGlobalRateLimit,
        handler: (req, res, _next, options) => {
            const resetTime = req.rateLimit?.resetTime;
            const retryAfterSeconds = Math.max(
                1,
                resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : Math.ceil((options.windowMs || 60000) / 1000)
            );
            res.setHeader('Retry-After', String(retryAfterSeconds));
            res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later.',
                retryAfterSeconds
            });
        },
        validate: { trustProxy: false, xForwardedForHeader: false, ip: false }
    });
