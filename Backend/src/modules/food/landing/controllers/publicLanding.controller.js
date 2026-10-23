import { getPublicGourmetRestaurants } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { getPublicOtherApps } from '../services/otherApp.service.js';
import { getPublicHomePromotionBanners } from '../services/homePromotionBanner.service.js';
import TopBanner from '../models/topBanner.model.js';
import AdBanner from '../models/adBanner.model.js';
import { isFeatureEnabled } from '../../admin/services/featureSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { FoodDiningBanner } from '../models/diningBanner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { sendResponse } from '../../../../utils/response.js';
import mongoose from 'mongoose';

/** Public hero banners for user home: active only, sorted, with linkedRestaurants populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        let docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'linkedRestaurantIds',
                select: '_id restaurantName slug area city rating cuisines profileImage pureVegRestaurant zoneId',
                model: 'FoodRestaurant'
            })
            .lean();

        if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
            const targetZone = String(zoneId);
            docs = (docs || []).filter(banner => {
                const linked = banner.linkedRestaurantIds || [];
                if (linked.length === 0) return true;
                return linked.some(r => String(r.zoneId || '') === targetZone);
            });
        }

        const banners = (docs || []).map((b) => {
            const { linkedRestaurantIds, ...rest } = b;
            return {
                ...rest,
                linkedRestaurants: Array.isArray(linkedRestaurantIds) ? linkedRestaurantIds : [],
                imageUrl: b.imageUrl
            };
        });
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const query = { isActive: true };
        if (zoneId) {
            query.$or = [
                { zoneId: String(zoneId) },
                { zoneId: { $in: [null, ""] } },
                { zoneId: { $exists: false } }
            ];
        }
        const docs = await FoodUnder250Banner.find(query).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicDiningBannersController = async (req, res, next) => {
    try {
        const docs = await FoodDiningBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Dining banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};


export const getPublicGourmetController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const docs = await getPublicGourmetRestaurants();
        let restaurants = (docs || [])
            .filter((d) => d && d.restaurant && d.restaurant._id)
            .map((d) => ({
                ...d.restaurant,
                _id: d.restaurant._id,
                mongoId: d.restaurant._id,
                restaurantId: d.restaurant._id,
                zoneId: d.restaurant.zoneId,
                priority: d.priority,
                restaurant: d.restaurant
            }));
        
        if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
            restaurants = restaurants.filter(r => String(r.zoneId?._id || r.zoneId || '') === String(zoneId));
        }
        
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const settings = await getLandingSettings();
        const ids = settings?.recommendedRestaurantIds || [];
        let recommendedRestaurants = [];
        if (Array.isArray(ids) && ids.length > 0 && zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
            const zoneObjId = new mongoose.Types.ObjectId(zoneId);
            const validIds = ids
                .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
                .map((id) => new mongoose.Types.ObjectId(id));

            if (validIds.length > 0) {
                recommendedRestaurants = await FoodRestaurant.find({
                    _id: { $in: validIds },
                    status: 'approved',
                    $or: [
                        { zoneId: zoneObjId },
                        { zoneId: String(zoneId) }
                    ]
                })
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant zoneId')
                .lean();
            }
        }
        const payload = {
            ...settings,
            recommendedRestaurantIds: ids,
            recommendedRestaurants
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};

export const getPublicTopBannersController = async (req, res, next) => {
    try {
        const docs = await TopBanner.find({ isActive: true }).sort('order').lean();
        
        const isAdEnabled = await isFeatureEnabled('banner_advertising', false);
        let mappedAds = [];
        if (isAdEnabled) {
            const now = new Date();
            const activeAds = await AdBanner.find({
                status: 'approved',
                paymentStatus: 'paid',
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();

            mappedAds = activeAds.map(ad => ({
                _id: ad._id,
                image: ad.image,
                order: 999,
                isActive: true,
                isAd: true,
                targetType: ad.targetType,
                targetId: ad.targetId || (ad.targetType === 'restaurant' && ad.requesterType === 'FoodRestaurant' ? ad.requesterId.toString() : ''),
                targetUrl: ad.targetUrl,
                startDate: ad.startDate,
                endDate: ad.endDate,
                createdAt: ad.createdAt,
                updatedAt: ad.updatedAt
            }));
        }

        return sendResponse(res, 200, 'Top banners fetched', { banners: docs, ads: mappedAds });
    } catch (error) {
        next(error);
    }
};

export const getPublicHomePromotionBannersController = async (req, res, next) => {
    try {
        const banners = await getPublicHomePromotionBanners();
        return sendResponse(res, 200, 'Home promotion banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicOtherAppsController = async (req, res, next) => {
    try {
        const docs = await getPublicOtherApps();
        const items = docs.map(({ sortOrder, iconUrl, ...rest }) => ({
            ...rest,
            iconUrl,
            imageUrl: iconUrl,
            order: sortOrder
        }));
        return sendResponse(res, 200, 'Other apps fetched', { items });
    } catch (error) {
        next(error);
    }
};
