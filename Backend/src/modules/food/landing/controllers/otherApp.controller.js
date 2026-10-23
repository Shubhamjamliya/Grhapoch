import {
    listOtherApps,
    createOtherApp,
    updateOtherApp,
    deleteOtherApp,
    toggleOtherAppStatus,
    updateOtherAppOrder
} from '../services/otherApp.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

/** Normalize item for frontend response */
const toItem = (doc) => {
    if (!doc) return doc;
    const { sortOrder, iconUrl, ...rest } = doc;
    return { ...rest, iconUrl, imageUrl: iconUrl, order: sortOrder };
};

export const listOtherAppsController = async (req, res, next) => {
    try {
        const data = await listOtherApps();
        const items = data.map(toItem);
        return sendResponse(res, 200, 'Other apps fetched successfully', { items });
    } catch (error) {
        next(error);
    }
};

export const createOtherAppController = async (req, res, next) => {
    try {
        const file = req.file;
        const title = (req.body?.title || '').trim();
        const subtitle = (req.body?.subtitle || '').trim();
        const playStoreLink = (req.body?.playStoreLink || '').trim();
        const appStoreLink = (req.body?.appStoreLink || '').trim();

        if (!file) {
            throw new ValidationError('App icon image file is required');
        }
        if (!title) {
            throw new ValidationError('App title is required');
        }

        const created = await createOtherApp(file, {
            title,
            subtitle,
            playStoreLink,
            appStoreLink
        });
        return sendResponse(res, 201, 'Other app item created successfully', toItem(created));
    } catch (error) {
        next(error);
    }
};

export const updateOtherAppController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('App item id is required');
        }

        const payload = {
            file: req.file,
            title: req.body?.title !== undefined ? req.body.title : undefined,
            subtitle: req.body?.subtitle !== undefined ? req.body.subtitle : undefined,
            playStoreLink: req.body?.playStoreLink !== undefined ? req.body.playStoreLink : undefined,
            appStoreLink: req.body?.appStoreLink !== undefined ? req.body.appStoreLink : undefined
        };

        const updated = await updateOtherApp(id, payload);
        if (!updated) {
            return sendResponse(res, 404, 'Other app item not found', null);
        }
        return sendResponse(res, 200, 'Other app item updated successfully', toItem(updated));
    } catch (error) {
        next(error);
    }
};

export const deleteOtherAppController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('App item id is required');
        }
        const result = await deleteOtherApp(id);
        return sendResponse(
            res,
            200,
            result.deleted ? 'Other app item deleted' : 'Other app item not found',
            result
        );
    } catch (error) {
        next(error);
    }
};

export const toggleOtherAppStatusController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('App item id is required');
        }
        const updated = await toggleOtherAppStatus(id);
        if (!updated) {
            return sendResponse(res, 404, 'Other app item not found', null);
        }
        return sendResponse(res, 200, 'Other app status updated', toItem(updated));
    } catch (error) {
        next(error);
    }
};

export const updateOtherAppOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = req.body?.order;
        if (!id) {
            throw new ValidationError('App item id is required');
        }
        if (order === undefined || order === null) {
            throw new ValidationError('order is required');
        }
        const num = Number(order);
        if (Number.isNaN(num)) {
            throw new ValidationError('order must be a number');
        }
        const updated = await updateOtherAppOrder(id, num);
        if (!updated) {
            return sendResponse(res, 404, 'Other app item not found', null);
        }
        return sendResponse(res, 200, 'Other app order updated', toItem(updated));
    } catch (error) {
        next(error);
    }
};
