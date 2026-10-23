import { FoodBusinessSettings } from '../models/businessSettings.model.js';
import { sendResponse } from '../../../../utils/response.js';
import { uploadGenericImage, uploadFileBuffer } from '../../../../services/upload.service.js';

const POWER_SCANNING_DEFAULT = {
    user: { themeColor: '#FA0272', fontFamily: 'Poppins' },
    restaurant: { themeColor: '#2563EB', fontFamily: 'Poppins' },
    delivery: { themeColor: '#00B761', fontFamily: 'Poppins' }
};

const POWER_SCANNING_FONT_OPTIONS = [
    'Poppins', 'Outfit', 'Inter', 'Roboto', 'Montserrat',
    'Nunito', 'Open Sans', 'Lato', 'Manrope', 'Raleway',
    'Merriweather', 'Playfair Display', 'Ubuntu', 'Rubik', 'Work Sans'
];

const normalizeHexColor = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
};

const normalizeFontFamily = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    return POWER_SCANNING_FONT_OPTIONS.includes(raw) ? raw : fallback;
};

const normalizeOrderAcceptanceMinutes = (value, fallback = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(1, Math.min(20, Math.round(numeric)));
};

const buildPowerScanningPayload = (payload = {}, existing = POWER_SCANNING_DEFAULT) => ({
    user: {
        themeColor: normalizeHexColor(payload?.user?.themeColor, existing?.user?.themeColor || POWER_SCANNING_DEFAULT.user.themeColor),
        fontFamily: normalizeFontFamily(payload?.user?.fontFamily, existing?.user?.fontFamily || POWER_SCANNING_DEFAULT.user.fontFamily)
    },
    restaurant: {
        themeColor: normalizeHexColor(payload?.restaurant?.themeColor, existing?.restaurant?.themeColor || POWER_SCANNING_DEFAULT.restaurant.themeColor),
        fontFamily: normalizeFontFamily(payload?.restaurant?.fontFamily, existing?.restaurant?.fontFamily || POWER_SCANNING_DEFAULT.restaurant.fontFamily)
    },
    delivery: {
        themeColor: normalizeHexColor(payload?.delivery?.themeColor, existing?.delivery?.themeColor || POWER_SCANNING_DEFAULT.delivery.themeColor),
        fontFamily: normalizeFontFamily(payload?.delivery?.fontFamily, existing?.delivery?.fontFamily || POWER_SCANNING_DEFAULT.delivery.fontFamily)
    }
});

const ensurePowerScanningOnSettings = (settingsDocOrPlain = null) => {
    const current = settingsDocOrPlain || {};
    const normalized = buildPowerScanningPayload(
        current?.powerScanning || {},
        current?.powerScanning || POWER_SCANNING_DEFAULT
    );
    return {
        ...current,
        powerScanning: normalized
    };
};

export async function getBusinessSettings(req, res, next) {
    try {
        let settings = await FoodBusinessSettings.findOne().lean();
        if (!settings) {
            // Create default settings if none exist
            settings = await FoodBusinessSettings.create({
                companyName: 'CityFood',
                email: 'admin@tuggo.com'
            });
        }
        return sendResponse(res, 200, 'Business settings fetched successfully', ensurePowerScanningOnSettings(settings?.toObject?.() || settings));
    } catch (error) {
        next(error);
    }
}

export async function updateBusinessSettings(req, res, next) {
    try {
        // Safer data parsing that handles both JSON and multipart/form-data
        let data = {};
        try {
            if (req.body.data) {
                data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } else {
                data = req.body;
            }
        } catch (err) {
            return res.status(400).json({ success: false, message: 'Invalid data format' });
        }

        const { 
            companyName, email, phoneCountryCode, phoneNumber, address, state, pincode, region,
            supportEmail, supportPhone, supportHours, fssai, gstin, onlinePaymentOnly, maxCodAmount,
            maintenanceMode, customerRegistration, restaurantRegistration, deliveryRegistration
        } = data;

        // Ensure string inputs for validation to prevent crashes from non-string values
        const s_companyName = String(companyName || "").trim();
        const s_email = String(email || "").trim();
        const s_phoneNumber = String(phoneNumber || "").trim();
        const s_address = String(address || "").trim();
        const s_state = String(state || "").trim();
        const s_pincode = String(pincode || "").trim();
        const s_supportEmail = String(supportEmail || "").trim();
        const s_supportPhone = String(supportPhone || "").trim();
        const s_supportHours = String(supportHours || "").trim();
        const s_fssai = String(fssai || "").trim();
        const s_gstin = String(gstin || "").trim();

        // Validation (only if field is provided for partial updates)
        if (companyName !== undefined && (!s_companyName || s_companyName.length < 2 || s_companyName.length > 50)) {
            return res.status(400).json({ success: false, message: 'Company name must be between 2 and 50 characters' });
        }
        if (email !== undefined && (!s_email || s_email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s_email))) {
            return res.status(400).json({ success: false, message: 'Invalid email address (max 100 characters)' });
        }
        if (phoneNumber !== undefined && (!s_phoneNumber || !/^\d{7,15}$/.test(s_phoneNumber))) {
            return res.status(400).json({ success: false, message: 'Invalid phone number (7-15 digits required)' });
        }
        if (s_address && s_address.length > 250) {
            return res.status(400).json({ success: false, message: 'Address is too long (max 250 characters)' });
        }
        if (s_state && s_state.length > 50) {
            return res.status(400).json({ success: false, message: 'State name is too long (max 50 characters)' });
        }
        if (s_pincode && !/^\d{4,10}$/.test(s_pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid pincode (4-10 digits required)' });
        }
        if (s_supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s_supportEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid support email address' });
        }

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = new FoodBusinessSettings();
        }

        if (s_companyName) settings.companyName = s_companyName;
        if (s_email) settings.email = s_email;
        if (phoneCountryCode || s_phoneNumber) {
            settings.phone = {
                countryCode: String(phoneCountryCode || settings.phone?.countryCode || '+91').trim(),
                number: s_phoneNumber || settings.phone?.number || ''
            };
        }
        if (address !== undefined) settings.address = s_address;
        if (state !== undefined) settings.state = s_state;
        if (pincode !== undefined) settings.pincode = s_pincode;
        if (region) settings.region = String(region).trim();
        
        if (supportEmail !== undefined) settings.supportEmail = s_supportEmail;
        if (supportPhone !== undefined) settings.supportPhone = s_supportPhone;
        if (supportHours !== undefined) settings.supportHours = s_supportHours;
        if (fssai !== undefined) settings.fssai = s_fssai;
        if (gstin !== undefined) settings.gstin = s_gstin;
        
        if (onlinePaymentOnly !== undefined) {
            settings.onlinePaymentOnly = Boolean(onlinePaymentOnly === 'true' || onlinePaymentOnly === true);
        }
        
        if (maxCodAmount !== undefined) {
            settings.maxCodAmount = Number(maxCodAmount) || 0;
        }

        if (maintenanceMode !== undefined) {
            settings.maintenanceMode = Boolean(maintenanceMode === 'true' || maintenanceMode === true);
        }
        if (customerRegistration !== undefined) {
            settings.customerRegistration = Boolean(customerRegistration === 'true' || customerRegistration === true);
        }
        if (restaurantRegistration !== undefined) {
            settings.restaurantRegistration = Boolean(restaurantRegistration === 'true' || restaurantRegistration === true);
        }
        if (deliveryRegistration !== undefined) {
            settings.deliveryRegistration = Boolean(deliveryRegistration === 'true' || deliveryRegistration === true);
        }

        // Handle file uploads
        if (req.files?.logo) {
            const logoUrl = await uploadGenericImage(req.files.logo[0].buffer, 'business/logos');
            settings.logo = { url: logoUrl, publicId: null };
        } else if (data.logo) {
            settings.logo = { url: String(data.logo).trim(), publicId: null };
        }

        if (req.files?.userLogo) {
            const userLogoUrl = await uploadGenericImage(req.files.userLogo[0].buffer, 'business/logos');
            settings.userLogo = { url: userLogoUrl, publicId: null };
        } else if (data.userLogo !== undefined) {
            settings.userLogo = { url: String(data.userLogo || '').trim(), publicId: null };
        }

        if (req.files?.restaurantLogo) {
            const restaurantLogoUrl = await uploadGenericImage(req.files.restaurantLogo[0].buffer, 'business/logos');
            settings.restaurantLogo = { url: restaurantLogoUrl, publicId: null };
        } else if (data.restaurantLogo !== undefined) {
            settings.restaurantLogo = { url: String(data.restaurantLogo || '').trim(), publicId: null };
        }

        if (req.files?.deliveryLogo) {
            const deliveryLogoUrl = await uploadGenericImage(req.files.deliveryLogo[0].buffer, 'business/logos');
            settings.deliveryLogo = { url: deliveryLogoUrl, publicId: null };
        } else if (data.deliveryLogo !== undefined) {
            settings.deliveryLogo = { url: String(data.deliveryLogo || '').trim(), publicId: null };
        }

        if (req.files?.favicon) {
            const faviconUrl = await uploadGenericImage(req.files.favicon[0].buffer, 'business/favicons');
            settings.favicon = { url: faviconUrl, publicId: null };
        } else if (data.favicon) {
            settings.favicon = { url: String(data.favicon).trim(), publicId: null };
        }

        if (req.files?.termsAndConditionsPdf) {
            const pdfFile = req.files.termsAndConditionsPdf[0];
            const pdfUrl = await uploadFileBuffer(pdfFile.buffer, 'business/legal', {
                fileName: pdfFile.originalname,
                format: 'pdf'
            });
            settings.termsAndConditionsPdf = { url: pdfUrl, publicId: null };
        } else if (data.termsAndConditionsPdf) {
            settings.termsAndConditionsPdf = { url: String(data.termsAndConditionsPdf).trim(), publicId: null };
        }

        await settings.save();
        return sendResponse(res, 200, 'Business settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
}

export async function updateBusinessToggles(req, res, next) {
    try {
        const {
            onlinePaymentOnly,
            maxCodAmount,
            maintenanceMode,
            customerRegistration,
            restaurantRegistration,
            deliveryRegistration,
        } = req.body || {};

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = await FoodBusinessSettings.create({
                companyName: 'CityFood',
                email: 'admin@tuggo.com',
            });
        }

        if (onlinePaymentOnly !== undefined) {
            settings.onlinePaymentOnly = Boolean(onlinePaymentOnly);
        }
        if (maxCodAmount !== undefined) {
            settings.maxCodAmount = Number(maxCodAmount) || 0;
        }
        if (maintenanceMode !== undefined) {
            settings.maintenanceMode = Boolean(maintenanceMode);
        }
        if (customerRegistration !== undefined) {
            settings.customerRegistration = Boolean(customerRegistration);
        }
        if (restaurantRegistration !== undefined) {
            settings.restaurantRegistration = Boolean(restaurantRegistration);
        }
        if (deliveryRegistration !== undefined) {
            settings.deliveryRegistration = Boolean(deliveryRegistration);
        }

        await settings.save();
        const payload = settings.toObject ? settings.toObject() : settings;
        return sendResponse(res, 200, 'Toggle settings updated successfully', payload);
    } catch (error) {
        next(error);
    }
}

// ---- ported from legacy backend ----
export async function getPowerScanningSettings(req, res, next) {
    try {
        let settings = await FoodBusinessSettings.findOne().lean();
        if (!settings) {
            settings = await FoodBusinessSettings.create({
                companyName: 'Grhapoch',
                email: 'admin@grhapoch.com'
            });
        }
        const payload = buildPowerScanningPayload(settings?.powerScanning || {}, settings?.powerScanning || POWER_SCANNING_DEFAULT);
        return sendResponse(res, 200, 'Power scanning settings fetched successfully', payload);
    } catch (error) {
        next(error);
    }
}

export async function updatePowerScanningSettings(req, res, next) {
    try {
        const payload = req.body || {};
        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = new FoodBusinessSettings({
                companyName: 'Grhapoch',
                email: 'admin@grhapoch.com'
            });
        }

        settings.powerScanning = buildPowerScanningPayload(payload, settings.powerScanning || POWER_SCANNING_DEFAULT);
        await settings.save();

        return sendResponse(res, 200, 'Power scanning settings updated successfully', settings.powerScanning);
    } catch (error) {
        next(error);
    }
}

export async function getOrderAcceptanceSettings(req, res, next) {
    try {
        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = await FoodBusinessSettings.create({
                companyName: 'Grhapoch',
                email: 'admin@grhapoch.com'
            });
        }

        const minutes = normalizeOrderAcceptanceMinutes(settings.orderAcceptanceTimeMinutes);
        if (settings.orderAcceptanceTimeMinutes !== minutes) {
            settings.orderAcceptanceTimeMinutes = minutes;
            await settings.save();
        }

        return sendResponse(res, 200, 'Order acceptance settings fetched successfully', {
            orderAcceptanceTimeMinutes: minutes,
            acceptanceWindowSeconds: minutes * 60
        });
    } catch (error) {
        next(error);
    }
}

export async function updateOrderAcceptanceSettings(req, res, next) {
    try {
        const rawMinutes = req.body?.orderAcceptanceTimeMinutes;
        const numeric = Number(rawMinutes);
        if (!Number.isFinite(numeric)) {
            return res.status(400).json({ success: false, message: 'Order acceptance time is required' });
        }

        const minutes = Math.round(numeric);
        if (minutes < 1 || minutes > 20) {
            return res.status(400).json({ success: false, message: 'Order acceptance time must be between 1 and 20 minutes' });
        }

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = new FoodBusinessSettings();
        }

        settings.orderAcceptanceTimeMinutes = minutes;
        await settings.save();

        return sendResponse(res, 200, 'Order acceptance settings updated successfully', {
            orderAcceptanceTimeMinutes: minutes,
            acceptanceWindowSeconds: minutes * 60
        });
    } catch (error) {
        next(error);
    }
}
