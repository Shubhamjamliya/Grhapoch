/**
 * Push notification diagnostics for one restaurant or delivery partner.
 *
 * Shows every registered push token (app vs browser) and sends a REAL test
 * "new order" push through the same urgent path used for new orders, printing
 * Firebase's verdict for each token.
 *
 * Usage (from the Backend folder, on the server):
 *   node scripts/check-push.js restaurant <phone-or-id>
 *   node scripts/check-push.js delivery   <phone-or-id>
 *   add --no-send to only list tokens
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { sendUrgentOrderNotificationToOwner } from '../src/core/notifications/voip.service.js';

const [, , kindArg, lookup, ...flags] = process.argv;
const kind = String(kindArg || '').toLowerCase();
const noSend = flags.includes('--no-send');

const TYPES = {
    restaurant: { model: FoodRestaurant, ownerType: 'RESTAURANT', phoneFields: ['ownerPhone', 'primaryContactNumber', 'ownerPhoneDigits', 'ownerPhoneLast10'], name: 'restaurantName' },
    delivery: { model: FoodDeliveryPartner, ownerType: 'DELIVERY_PARTNER', phoneFields: ['phone'], name: 'name' },
};

const tail = (t) => `...${String(t || '').slice(-10)}`;

async function main() {
    const type = TYPES[kind];
    if (!type || !lookup) {
        console.log('Usage: node scripts/check-push.js <restaurant|delivery> <phone-or-id> [--no-send]');
        process.exit(1);
    }

    console.log(`Firebase project (server): ${config.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || '(from service account)'}`);
    try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
        console.log(`Service account project:   ${sa.project_id || '(not set in env)'}`);
    } catch {
        console.log('Service account project:   INVALID JSON in FIREBASE_SERVICE_ACCOUNT');
    }

    await connectDB();

    let doc = null;
    if (mongoose.isValidObjectId(lookup)) doc = await type.model.findById(lookup).lean();
    if (!doc) {
        const last10 = String(lookup).replace(/\D/g, '').slice(-10);
        doc = await type.model.findOne({
            $or: type.phoneFields.flatMap((f) => [
                { [f]: lookup },
                ...(last10 ? [{ [f]: { $regex: new RegExp(`${last10}$`) } }] : []),
            ]),
        }).lean();
    }
    if (!doc) {
        console.log(`\nNo ${kind} found for "${lookup}".`);
        return;
    }

    const web = doc.fcmTokens || [];
    const app = doc.fcmTokenMobile || [];
    const devices = doc.pushDevices || [];
    console.log(`\n${kind.toUpperCase()}: ${doc[type.name] || '(no name)'}  id=${doc._id}`);
    console.log(`Browser tokens (fcmTokens):    ${web.length}`);
    web.forEach((t) => console.log(`   web  ${tail(t)}`));
    console.log(`App tokens (fcmTokenMobile):   ${app.length}`);
    app.forEach((t) => console.log(`   app  ${tail(t)}`));
    console.log(`Registered devices:            ${devices.length}`);
    devices.forEach((d) => console.log(`   ${d.pushPlatform}/${d.devicePlatform}  fcm=${d.fcmToken ? tail(d.fcmToken) : '-'}  voip=${d.voipToken ? tail(d.voipToken) : '-'}  lastSeen=${d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : '-'}`));

    if (app.length === 0 && !devices.some((d) => d.pushPlatform === 'mobile')) {
        console.log('\n>>> NO APP TOKEN: the Flutter app has never registered this account. App pushes cannot be delivered.');
    }

    if (noSend) return;

    console.log('\nSending test "new order" push...');
    const res = await sendUrgentOrderNotificationToOwner({
        ownerType: type.ownerType,
        ownerId: String(doc._id),
        payload: {
            title: 'Test: New order received',
            body: 'Push diagnostics test. If you see this, notifications work.',
            sound: 'default',
            data: { type: 'new_order', orderId: 'push-test', orderMongoId: 'push-test' },
        },
    });

    const rows = [...(res?.fcm?.results || []), ...(res?.voip?.results || [])];
    if (!rows.length) console.log('Nothing was sent (no tokens).');
    for (const r of rows) {
        const source = app.includes(r.token) ? 'app' : web.includes(r.token) ? 'web' : 'device';
        console.log(`   ${r.ok ? 'OK    ' : 'FAILED'} ${source} ${tail(r.token)}${r.ok ? '' : `  -> ${r.error}`}`);
    }
    console.log('\nSee [PUSH-ORDER] lines above for the plain-English reason of any failure.');
}

main()
    .catch((e) => console.error('Diagnostics crashed:', e?.message || e))
    .finally(async () => {
        await disconnectDB().catch(() => {});
        process.exit(0);
    });
