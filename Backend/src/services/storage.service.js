import axios from 'axios';
import { uploadGenericImage } from './upload.service.js';

/**
 * Thin compatibility layer over upload.service.js so features ported from the
 * old backend (banners, other apps, bulk upload) keep their saveImageFile API
 * while storing through the new local/Cloudinary upload pipeline.
 */

export const saveImageBuffer = async (buffer, folder = 'misc') => {
    const url = await uploadGenericImage(buffer, folder);
    return { url, path: null };
};

export const saveImageFile = async (file, folder = 'misc') => {
    if (!file?.buffer) {
        throw new Error('Image file is required');
    }
    return saveImageBuffer(file.buffer, folder);
};

// Stored files are flat and managed by upload.service.js; nothing to remove per-record.
export const deleteStoredFile = async () => {};

export const isHostedUploadUrl = (url) => /\/uploads\//i.test(String(url || ''));

export const saveImageFromUrl = async (imageUrl, folder = 'misc') => {
    const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        maxContentLength: 10 * 1024 * 1024
    });
    return saveImageBuffer(Buffer.from(response.data), folder);
};
