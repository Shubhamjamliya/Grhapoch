import { FoodOtherApp } from '../models/otherApp.model.js';
import { saveImageFile, deleteStoredFile } from '../../../../services/storage.service.js';

const APP_ICON_FOLDER = 'food/other-apps';

/**
 * List all other apps (Admin view). Sorted by sortOrder ascending.
 */
export const listOtherApps = async () => {
    return FoodOtherApp.find()
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
};

/**
 * Get active other apps (Public view). Sorted by sortOrder ascending.
 */
export const getPublicOtherApps = async () => {
    return FoodOtherApp.find({ isActive: true })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
};

/**
 * Get next sortOrder for a new app item.
 */
const getNextSortOrder = async () => {
    const last = await FoodOtherApp.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

/**
 * Create a new other app item from file + metadata.
 * @param {{ buffer: Buffer }} file - Multer file
 * @param {{ title: string, subtitle?: string, playStoreLink?: string, appStoreLink?: string }} meta
 */
export const createOtherApp = async (file, meta) => {
    if (!file?.buffer) {
        throw new Error('App icon image file is required');
    }
    const title = (meta?.title || '').trim();
    if (!title) {
        throw new Error('Title / App name is required');
    }

    const saved = await saveImageFile(file, APP_ICON_FOLDER);
    const sortOrder = await getNextSortOrder();

    const doc = await FoodOtherApp.create({
        title,
        subtitle: (meta?.subtitle || '').trim() || undefined,
        iconUrl: saved.url,
        publicId: saved.path,
        playStoreLink: (meta?.playStoreLink || '').trim() || undefined,
        appStoreLink: (meta?.appStoreLink || '').trim() || undefined,
        sortOrder,
        isActive: true
    });

    return doc.toObject();
};

/**
 * Update an existing app item.
 * @param {string} id
 * @param {{ file?: { buffer: Buffer }, title?: string, subtitle?: string, playStoreLink?: string, appStoreLink?: string }} payload
 */
export const updateOtherApp = async (id, payload) => {
    const doc = await FoodOtherApp.findById(id);
    if (!doc) {
        return null;
    }

    const updates = {};

    if (payload?.file?.buffer) {
        try {
            if (doc.publicId) {
                await deleteStoredFile(doc.publicId).catch(() => {});
            }
            const saved = await saveImageFile(payload.file, APP_ICON_FOLDER);
            updates.iconUrl = saved.url;
            updates.publicId = saved.path;
        } catch {
            throw new Error('Image upload failed');
        }
    }

    if (payload?.title !== undefined) {
        updates.title = String(payload.title).trim();
    }
    if (payload?.subtitle !== undefined) {
        updates.subtitle = String(payload.subtitle).trim();
    }
    if (payload?.playStoreLink !== undefined) {
        updates.playStoreLink = String(payload.playStoreLink).trim();
    }
    if (payload?.appStoreLink !== undefined) {
        updates.appStoreLink = String(payload.appStoreLink).trim();
    }

    if (Object.keys(updates).length === 0) {
        return doc.toObject();
    }

    const updated = await FoodOtherApp.findByIdAndUpdate(id, updates, { new: true }).lean();
    return updated;
};

/**
 * Delete app item and associated stored image.
 */
export const deleteOtherApp = async (id) => {
    const doc = await FoodOtherApp.findById(id);
    if (!doc) {
        return { deleted: false };
    }
    if (doc.publicId) {
        try {
            await deleteStoredFile(doc.publicId);
        } catch {
            // ignore cleanup error
        }
    }
    await doc.deleteOne();
    return { deleted: true };
};

/**
 * Toggle isActive state.
 */
export const toggleOtherAppStatus = async (id) => {
    const doc = await FoodOtherApp.findById(id);
    if (!doc) return null;
    const isActive = !doc.isActive;
    const updated = await FoodOtherApp.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
    return updated;
};

/**
 * Update sortOrder.
 */
export const updateOtherAppOrder = async (id, order) => {
    const num = Number(order);
    if (Number.isNaN(num)) return null;
    const updated = await FoodOtherApp.findByIdAndUpdate(id, { sortOrder: num }, { new: true }).lean();
    return updated;
};
