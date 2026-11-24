import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';

const toFinite = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
};

// Ray-casting point-in-polygon for lat/lng polygons.
const isPointInPolygon = (lat, lng, polygon) => {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        const intersect =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};

const getZoneRadiusKm = (zone) => {
    if (!zone?.isRadiusEnabled) return null;
    const radius = toFinite(zone?.serviceRadius);
    if (radius === null || radius < 0) return null;
    return zone.unit === 'miles' ? radius * 1.60934 : radius;
};

const isPointWithinZoneRadius = (lat, lng, zone) => {
    const centerLat = toFinite(zone?.centerPoint?.latitude);
    const centerLng = toFinite(zone?.centerPoint?.longitude);
    const radiusKm = getZoneRadiusKm(zone);
    if (centerLat === null || centerLng === null || radiusKm === null) return false;
    return getDistanceKm(lat, lng, centerLat, centerLng) <= radiusKm;
};

const doesZoneServePoint = (lat, lng, zone) => {
    if (zone?.isRadiusEnabled) {
        return isPointWithinZoneRadius(lat, lng, zone);
    }

    const coords = Array.isArray(zone?.coordinates) ? zone.coordinates : [];
    if (coords.length >= 3) {
        return isPointInPolygon(lat, lng, coords);
    }

    return false;
};

/**
 * A point is serviceable if at least one approved restaurant's own delivery
 * radius covers it — this is the source of truth now, independent of zones.
 */
const isServedByAnyRestaurant = async (lat, lng) => {
    try {
        const nearby = await FoodRestaurant.aggregate([
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'distanceMeters',
                    maxDistance: 20 * 1000, // matches the max allowed deliveryRadiusKm
                    spherical: true,
                    query: { status: 'approved' }
                }
            },
            { $project: { distanceMeters: 1, deliveryRadiusKm: 1 } }
        ]);
        return nearby.some((r) => {
            const radiusKm = Number.isFinite(r.deliveryRadiusKm) ? r.deliveryRadiusKm : 5;
            return (r.distanceMeters / 1000) <= radiusKm;
        });
    } catch {
        return false;
    }
};

/** GET /zones/detect?lat=..&lng=.. */
export const detectZonePublicController = async (req, res, next) => {
    try {
        const lat = toFinite(req.query.lat);
        const lng = toFinite(req.query.lng);
        if (lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'lat and lng are required' });
        }

        const zones = await FoodZone.find({ isActive: true }).lean();
        let radiusBlockedZone = null;

        for (const zone of zones) {
            if (doesZoneServePoint(lat, lng, zone)) {
                return res.status(200).json({
                    success: true,
                    message: 'Zone detected',
                    data: { status: 'IN_SERVICE', zoneId: zone._id, zone }
                });
            }

            if (!radiusBlockedZone && zone?.isRadiusEnabled) {
                const coords = Array.isArray(zone?.coordinates) ? zone.coordinates : [];
                if (coords.length >= 3 && isPointInPolygon(lat, lng, coords) && !isPointWithinZoneRadius(lat, lng, zone)) {
                    radiusBlockedZone = zone;
                }
            }
        }

        // No zone covers this point — fall back to restaurant-radius serviceability
        // so the app doesn't block customers just because no zone was ever drawn here.
        if (await isServedByAnyRestaurant(lat, lng)) {
            return res.status(200).json({
                success: true,
                message: 'Served by nearby restaurant',
                data: { status: 'IN_SERVICE', zoneId: null, zone: null }
            });
        }

        if (radiusBlockedZone) {
            return res.status(200).json({
                success: true,
                message: 'Outside service radius',
                data: { status: 'OUT_OF_RADIUS', zoneId: null, zone: radiusBlockedZone }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Out of service zone',
            data: { status: 'OUT_OF_ZONE', zoneId: null, zone: null }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/public - list active zones for onboarding/selects */
export const listZonesPublicController = async (_req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates centerPoint serviceRadius isRadiusEnabled createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Zones fetched successfully',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/nearby - list zones for hotspot/nearby visualization */
export const listZonesNearbyPublicController = async (req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates centerPoint serviceRadius isRadiusEnabled createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Nearby zones fetched',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};
