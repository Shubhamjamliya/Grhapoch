import { existsSync, readFileSync } from 'fs';
import http2 from 'http2';
import jwt from 'jsonwebtoken';
import { resolve } from 'path';
import { FoodUser } from '../users/user.model.js';
import { FoodRestaurant } from '../../modules/food/restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodAdmin } from '../admin/admin.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendPushNotification } from './firebase.service.js';

const OWNER_MODELS = {
    USER: FoodUser,
    RESTAURANT: FoodRestaurant,
    DELIVERY_PARTNER: FoodDeliveryPartner,
    ADMIN: FoodAdmin,
};

const APNS_AUTHORITY = {
    production: 'https://api.push.apple.com',
    sandbox: 'https://api.sandbox.push.apple.com',
};

let cachedApnsClient = null;
let cachedApnsClientMode = null;

const sanitizeString = (value) => String(value ?? '').trim().replace(/^["']|["']$/g, '');

const getOwnerModel = (ownerType) => {
    const normalized = String(ownerType || '').trim().toUpperCase();
    if (['ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(normalized)) return FoodAdmin;
    return OWNER_MODELS[normalized] || null;
};

const normalizeTokenList = (tokens = []) => {
    const normalized = [...new Set((Array.isArray(tokens) ? tokens : [tokens]).map(sanitizeString).filter(Boolean))];
    return normalized.slice(-20);
};

const normalizeVoipTopic = (topic) => {
    const normalized = sanitizeString(topic);
    if (!normalized) return '';
    return normalized.endsWith('.voip') ? normalized : `${normalized}.voip`;
};

const getVoipTopic = (ownerType) => {
    const normalizedOwnerType = String(ownerType || '').trim().toUpperCase();
    const baseTopic = normalizedOwnerType === 'RESTAURANT'
        ? sanitizeString(config.apnsVoipTopicRestaurant || process.env.APNS_VOIP_TOPIC_RESTAURANT || process.env.APNS_TOPIC_RESTAURANT)
        : normalizedOwnerType === 'DELIVERY_PARTNER'
            ? sanitizeString(config.apnsVoipTopicDelivery || process.env.APNS_VOIP_TOPIC_DELIVERY || process.env.APNS_TOPIC_DELIVERY)
            : '';

    const fallbackTopic = sanitizeString(config.apnsVoipTopic || process.env.APNS_VOIP_TOPIC || process.env.APNS_TOPIC);
    const resolvedTopic = normalizeVoipTopic(baseTopic || fallbackTopic);
    if (!resolvedTopic) {
        throw new Error(`APNS VoIP topic is not configured for ${normalizedOwnerType || 'UNKNOWN'} and no fallback APNS_VOIP_TOPIC is set.`);
    }
    return resolvedTopic;
};

const getApnsAuthority = () => {
    const useProduction = String(config.apnsProduction ?? process.env.APNS_PRODUCTION ?? 'true').toLowerCase() === 'true';
    return useProduction ? APNS_AUTHORITY.production : APNS_AUTHORITY.sandbox;
};

let apnsJwtToken = null;
let apnsJwtTokenExpiry = 0;

const getApnsJwtToken = () => {
    const now = Math.floor(Date.now() / 1000);
    if (apnsJwtToken && apnsJwtTokenExpiry > now) {
        return apnsJwtToken;
    }

    const teamId = sanitizeString(process.env.APNS_TEAM_ID);
    const keyId = sanitizeString(process.env.APNS_KEY_ID);
    const keyPathValue = sanitizeString(process.env.APNS_VOIP_P8_PATH || process.env.APNS_AUTH_KEY_PATH);

    if (!teamId || !keyId || !keyPathValue) {
        throw new Error('APNS_TEAM_ID, APNS_KEY_ID, and APNS_VOIP_P8_PATH must be set in .env for token-based APNs.');
    }

    // Try absolute path first, then relative to cwd, then relative stripping "Backend"
    const candidatePaths = [
        keyPathValue,
        resolve(process.cwd(), keyPathValue),
        resolve(process.cwd(), keyPathValue.replace(/^Backend[\\/]/i, ''))
    ];
    const keyPath = candidatePaths.find((candidate) => existsSync(candidate));
    if (!keyPath) {
        throw new Error(`APNS Auth Key (.p8) not found. Tried: ${candidatePaths.join(', ')}`);
    }

    const privateKey = readFileSync(keyPath, 'utf8');

    apnsJwtToken = jwt.sign(
        {
            iss: teamId,
            iat: now,
        },
        privateKey,
        {
            algorithm: 'ES256',
            header: {
                alg: 'ES256',
                kid: keyId,
            },
        }
    );
    apnsJwtTokenExpiry = now + 3000; // valid for 50 mins
    return apnsJwtToken;
};

const getApnsClient = () => {
    const authority = getApnsAuthority();
    if (cachedApnsClient && cachedApnsClientMode === authority) {
        return cachedApnsClient;
    }

    const client = http2.connect(authority);
    client.on('error', (error) => {
        logger.warn(`APNS VoIP client error: ${error?.message || error}`);
    });
    client.on('close', () => {
        if (cachedApnsClient === client) {
            cachedApnsClient = null;
            cachedApnsClientMode = null;
        }
    });

    cachedApnsClient = client;
    cachedApnsClientMode = authority;
    return client;
};

const parsePushDevices = (doc) => (Array.isArray(doc?.pushDevices) ? doc.pushDevices : []);

export const logVoipConfigurationWarnings = () => {
    const restaurantTopic = normalizeVoipTopic(config.apnsVoipTopicRestaurant || process.env.APNS_VOIP_TOPIC_RESTAURANT || process.env.APNS_TOPIC_RESTAURANT);
    const deliveryTopic = normalizeVoipTopic(config.apnsVoipTopicDelivery || process.env.APNS_VOIP_TOPIC_DELIVERY || process.env.APNS_TOPIC_DELIVERY);
    const fallbackTopic = normalizeVoipTopic(config.apnsVoipTopic || process.env.APNS_VOIP_TOPIC || process.env.APNS_TOPIC);

    if (!restaurantTopic && !fallbackTopic) {
        logger.warn('[VoIP] Restaurant topic is missing. Set APNS_VOIP_TOPIC_RESTAURANT for the restaurant wrapper or APNS_VOIP_TOPIC as fallback.');
    }

    if (!deliveryTopic && !fallbackTopic) {
        logger.warn('[VoIP] Delivery topic is missing. Set APNS_VOIP_TOPIC_DELIVERY for the delivery wrapper or APNS_VOIP_TOPIC as fallback.');
    }

    if (restaurantTopic || deliveryTopic || fallbackTopic) {
        logger.info(`[VoIP] APNs topic readiness: restaurant=${restaurantTopic || fallbackTopic || 'missing'} delivery=${deliveryTopic || fallbackTopic || 'missing'} user=optional`);
    }
};

export const listOwnerUrgentPushTargets = async ({ ownerType, ownerId } = {}) => {
    if (!ownerType || !ownerId) return { iosVoipTokens: [], fcmTokens: [] };
    const model = getOwnerModel(ownerType);
    if (!model) return { iosVoipTokens: [], fcmTokens: [] };

    const doc = await model.findById(ownerId).select('pushDevices fcmTokens fcmTokenMobile').lean();
    if (!doc) return { iosVoipTokens: [], fcmTokens: [], ownerFound: false };

    const pushDevices = parsePushDevices(doc);
    const iosVoipTokens = normalizeTokenList(
        pushDevices
            .filter((device) => device?.devicePlatform === 'ios' && device?.pushPlatform === 'mobile')
            .map((device) => device?.voipToken)
    );

    const iosFcmTokens = normalizeTokenList(
        pushDevices
            .filter((device) => device?.devicePlatform === 'ios' && device?.fcmToken)
            .map((device) => device?.fcmToken)
    );

    const androidFcmTokens = normalizeTokenList(
        pushDevices
            .filter((device) => device?.devicePlatform !== 'ios' && device?.fcmToken)
            .map((device) => device?.fcmToken)
    );

    const legacyFcmTokens = normalizeTokenList([
        ...(Array.isArray(doc.fcmTokens) ? doc.fcmTokens : []),
        ...(Array.isArray(doc.fcmTokenMobile) ? doc.fcmTokenMobile : []),
    ]);

    // Merge Android FCM tokens from both pushDevices and top-level token arrays (deduplicated)
    const allAndroidFcmTokens = normalizeTokenList([
        ...androidFcmTokens,
        ...legacyFcmTokens,
    ]);

    logger.info(`[VoIP-Trace] Fetched DB tokens for ${ownerType}:${ownerId} -> VoIP(iOS): ${iosVoipTokens.length}, FCM(iOS): ${iosFcmTokens.length}, FCM(Android): ${allAndroidFcmTokens.length}`);

    // Split by origin for diagnostics: browser (web push) vs native app (Flutter).
    const webTokens = normalizeTokenList(Array.isArray(doc.fcmTokens) ? doc.fcmTokens : []);
    const appTokens = normalizeTokenList([
        ...(Array.isArray(doc.fcmTokenMobile) ? doc.fcmTokenMobile : []),
        ...pushDevices
            .filter((device) => device?.pushPlatform === 'mobile' && device?.fcmToken)
            .map((device) => device?.fcmToken),
    ]);

    return {
        ownerFound: true,
        iosVoipTokens,
        iosFcmTokens,
        androidFcmTokens: allAndroidFcmTokens,
        fcmTokens: allAndroidFcmTokens,
        webTokens,
        appTokens,
    };
};

export const sendVoipPushNotification = async (tokens, payload = {}, options = {}) => {
    const uniqueTokens = normalizeTokenList(tokens);
    if (!uniqueTokens.length) {
        return { successCount: 0, failureCount: 0, results: [] };
    }

    const client = getApnsClient();
    const topic = getVoipTopic(options.ownerType);

    const apsAlertTitle = sanitizeString(payload.title || payload.notification?.title || 'New order request');
    const apsAlertBody = sanitizeString(payload.body || payload.notification?.body || 'You have a new order request.');
    const orderIdentifier = sanitizeString(payload.orderId || payload.data?.orderId || payload.orderMongoId || payload.data?.orderMongoId || payload.id || '');

    const bodyPayload = {
        aps: {
            alert: {
                title: apsAlertTitle,
                body: apsAlertBody,
            },
            sound: payload.sound || 'default',
            'content-available': 1,
        },
        ...((payload.data && typeof payload.data === 'object') ? payload.data : {}),
        type: sanitizeString(payload.type || payload.data?.type || 'voip_ring'),
        title: apsAlertTitle,
        body: apsAlertBody,
        orderId: orderIdentifier,
        orderMongoId: orderIdentifier,
        // Standard CallKit / flutter_callkit_incoming required fields:
        id: orderIdentifier,
        nameCaller: apsAlertTitle,
        callerName: apsAlertTitle,
        handle: apsAlertBody,
        textAccept: 'Accept',
        textDecline: 'Decline',
        duration: 45000,
        extra: {
            orderId: orderIdentifier,
            ...((payload.data && typeof payload.data === 'object') ? payload.data : {}),
        },
    };

    logger.info(`[VoIP-Background-Call-Trace] 📞 Preparing VoIP Background Push | Target: ${options.ownerType || 'UNKNOWN'} | Devices: ${uniqueTokens.length} | Topic: ${topic} | APNs Host: ${getApnsAuthority()} | Payload: ${JSON.stringify(bodyPayload)}`);

    const results = await Promise.all(uniqueTokens.map((token) => new Promise((resolveResult) => {
        const apnsHeaders = {
            ':method': 'POST',
            ':path': `/3/device/${token}`,
            'apns-topic': topic,
            'apns-push-type': 'voip',
            'apns-priority': '10',
            'apns-expiration': '0',
            'content-type': 'application/json',
            'authorization': `bearer ${getApnsJwtToken()}`,
        };

        const req = client.request(apnsHeaders);

        let responseBody = '';
        let statusCode = 0;
        let responseHeaders = {};

        req.setEncoding('utf8');
        req.on('response', (headers) => {
            statusCode = Number(headers[':status'] || 0);
            responseHeaders = headers;
        });
        req.on('data', (chunk) => {
            responseBody += chunk;
        });
        req.on('end', () => {
            const apnsId = responseHeaders['apns-id'] || 'n/a';
            if (statusCode >= 200 && statusCode < 300) {
                logger.info(`[VoIP-Background-Call-Trace] ✅ Apple APNs Accepted [${statusCode} OK] | apns-id: ${apnsId} | Token: ...${token.slice(-6)} | Topic: ${topic} | Push dispatched to iPhone for Background Ringing.`);
                resolveResult({ token, ok: true, apnsId, response: responseBody || 'ok' });
                return;
            }
            logger.warn(`[VoIP-Background-Call-Trace] ❌ Apple APNs Rejected [${statusCode}] | apns-id: ${apnsId} | Token: ...${token.slice(-6)} | Topic: ${topic} | Error: ${responseBody}`);
            resolveResult({
                token,
                ok: false,
                remove: statusCode === 400 || statusCode === 410,
                error: responseBody || `APNS send failed (${statusCode || 'unknown'})`,
            });
        });
        req.on('error', (error) => {
            logger.error(`[VoIP-Background-Call-Trace] 💥 APNs Request Error for token ...${token.slice(-6)}: ${error?.message || error}`);
            resolveResult({ token, ok: false, remove: false, error: error?.message || String(error) });
        });
        req.end(JSON.stringify(bodyPayload));
    })));

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;
    logger.info(`[VoIP-Background-Call-Trace] 📊 VoIP Batch Summary: ${successCount} successful deliveries, ${failureCount} failed.`);
    return { successCount, failureCount, results };
};

export const sendVoipNotificationToOwner = async ({ ownerType, ownerId, payload } = {}) => {
    const { iosVoipTokens } = await listOwnerUrgentPushTargets({ ownerType, ownerId });

    if (!iosVoipTokens.length) {
        return {
            voip: {
                successCount: 0,
                failureCount: 0,
                results: [],
                skipped: true,
                reason: 'No iOS VoIP tokens registered for this account.',
            },
        };
    }

    return {
        voip: await sendVoipPushNotification(iosVoipTokens, payload, { ownerType }),
    };
};

const PUSH_LOG = '[PUSH-ORDER]';
const tokenTail = (token) => `...${String(token || '').slice(-8)}`;

// Plain-English hints for the FCM errors that explain "push sent but nothing arrived".
const explainFcmError = (message = '') => {
    const m = String(message).toUpperCase();
    if (m.includes('UNREGISTERED') || m.includes('NOT_FOUND') || m.includes('REQUESTED ENTITY WAS NOT FOUND')) {
        return 'token is dead (app uninstalled, data cleared, or token refreshed) - the app must register a fresh token';
    }
    if (m.includes('SENDER_ID_MISMATCH') || m.includes('SENDERID MISMATCH')) {
        return 'the app was built with a DIFFERENT Firebase project than the server credentials';
    }
    if (m.includes('THIRD_PARTY_AUTH_ERROR')) {
        return 'APNs key/certificate missing or invalid in Firebase console (iOS)';
    }
    if (m.includes('INVALID_ARGUMENT')) {
        return 'invalid token format or invalid message payload';
    }
    if (m.includes('QUOTA_EXCEEDED')) return 'FCM rate limit hit';
    if (m.includes('UNAVAILABLE') || m.includes('INTERNAL')) return 'temporary FCM outage, retry later';
    return 'see FCM error above';
};

export const sendUrgentOrderNotificationToOwner = async ({ ownerType, ownerId, payload } = {}) => {
    const {
        iosVoipTokens = [],
        iosFcmTokens = [],
        androidFcmTokens,
        fcmTokens,
        ownerFound,
        webTokens = [],
        appTokens = [],
    } = await listOwnerUrgentPushTargets({ ownerType, ownerId });
    const responses = {
        voip: { successCount: 0, failureCount: 0, results: [] },
        iosFcm: { successCount: 0, failureCount: 0, results: [] },
        fcm: { successCount: 0, failureCount: 0, results: [] },
    };

    const who = `${ownerType}:${ownerId}`;
    const ctx = `event=${payload?.data?.type || payload?.type || 'n/a'} order=${payload?.data?.orderId || payload?.orderId || 'n/a'}`;

    logger.info(`[VoIP-Trace] Initiating Urgent Push for ${who}`);
    logger.info(
        `${PUSH_LOG} ${who} ${ctx} | registered tokens: app(Flutter)=${appTokens.length} web(browser)=${webTokens.length} iosVoip=${iosVoipTokens.length} iosFcm=${iosFcmTokens.length}`
    );

    if (ownerFound === false) {
        logger.warn(`${PUSH_LOG} ${who} ${ctx} | NOT SENT: account not found in database.`);
        return responses;
    }

    if (appTokens.length === 0) {
        logger.warn(
            `${PUSH_LOG} ${who} ${ctx} | NO APP TOKEN: the Flutter app has never registered a push token for this account, so the APP CANNOT receive this notification (browser may still get it). ` +
            `Fix in the app: the WebView JS handler "getFcmToken" must return the Firebase token, then open the app while logged in.`
        );
    }

    const standardFcmTokens = androidFcmTokens && androidFcmTokens.length > 0 ? androidFcmTokens : fcmTokens;
    const skippedIosFcm = iosFcmTokens.filter((t) => !(standardFcmTokens || []).includes(t));
    if (skippedIosFcm.length > 0 && iosVoipTokens.length === 0) {
        logger.warn(
            `${PUSH_LOG} ${who} ${ctx} | ${skippedIosFcm.length} iPhone FCM token(s) are NOT used by the urgent path and no VoIP token exists - iPhone app gets nothing.`
        );
    }

    if (iosVoipTokens.length === 0 && (!standardFcmTokens || standardFcmTokens.length === 0)) {
        logger.warn(`${PUSH_LOG} ${who} ${ctx} | NOT SENT: no push tokens at all for this account (neither app nor browser registered).`);
        return responses;
    }

    if (iosVoipTokens.length > 0) {
        try {
            responses.voip = await sendVoipPushNotification(iosVoipTokens, payload, { ownerType });
        } catch (error) {
            logger.warn(`VoIP push failed for ${who} - ${error?.message || error}`);
            logger.warn(`${PUSH_LOG} ${who} ${ctx} | VoIP send crashed: ${error?.message || error} (check APNS_* env config).`);
        }
    }

    if (standardFcmTokens && standardFcmTokens.length > 0) {
        try {
            responses.fcm = await sendPushNotification(standardFcmTokens, payload);
            for (const result of responses.fcm.results || []) {
                const source = appTokens.includes(result.token) ? 'app' : webTokens.includes(result.token) ? 'web' : 'unknown';
                if (result.ok) {
                    logger.info(`${PUSH_LOG} ${who} ${ctx} | FCM OK -> ${source} token ${tokenTail(result.token)} (accepted by Firebase; if nothing shows on the device, the device/app side is not displaying it)`);
                } else {
                    logger.warn(
                        `${PUSH_LOG} ${who} ${ctx} | FCM FAILED -> ${source} token ${tokenTail(result.token)}: ${result.error} => ${explainFcmError(result.error)}`
                    );
                }
            }
            logger.info(`${PUSH_LOG} ${who} ${ctx} | FCM summary: ok=${responses.fcm.successCount} failed=${responses.fcm.failureCount}`);
        } catch (error) {
            logger.warn(`Android FCM fallback failed for ${who} - ${error?.message || error}`);
            logger.error(
                `${PUSH_LOG} ${who} ${ctx} | FCM NOT SENT: ${error?.message || error} (usually missing/invalid Firebase service-account credentials or project id on the server).`
            );
        }
    }

    return responses;
};

export const sendUrgentOrderNotificationsToOwners = async (targets = [], payload = {}) => {
    const results = [];
    for (const target of Array.isArray(targets) ? targets : []) {
        if (!target?.ownerType || !target?.ownerId) continue;
        results.push(await sendUrgentOrderNotificationToOwner({ ownerType: target.ownerType, ownerId: target.ownerId, payload }));
    }
    return results;
};
