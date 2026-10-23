import { FoodOrder } from '../../orders/models/order.model.js';
import { CANCELLED_ORDER_STATUSES } from '../../orders/services/order.helpers.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate =(value, endOfDay = false) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid date filter');
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) d.setUTCHours(23, 59, 59, 999);
    return d;
};

/**
 * Donations collected from orders (pricing.donation > 0).
 * - collected: delivered orders (money is the platform's)
 * - pending:   placed/in-progress, not yet delivered or cancelled
 * - refunded:  cancelled orders (donation returned with the order)
 */
export async function getDonationReport({ from, to, status, search, page = 1, limit = 20 } = {}) {
    const fromDate = parseDate(from);
    const toDate = parseDate(to, true);
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

    const base = { 'pricing.donation': { $gt: 0 } };
    if (fromDate || toDate) {
        base.createdAt = {};
        if (fromDate) base.createdAt.$gte = fromDate;
        if (toDate) base.createdAt.$lte = toDate;
    }

    const bucketOf = {
        $switch: {
            branches: [
                { case: { $eq: ['$orderStatus', 'delivered'] }, then: 'collected' },
                { case: { $in: ['$orderStatus', CANCELLED_ORDER_STATUSES] }, then: 'refunded' },
                { case: { $eq: ['$orderStatus', 'pending_payment'] }, then: 'unpaid' },
            ],
            default: 'pending',
        },
    };

    const listMatch = { ...base };
    const wantedStatus = String(status || '').toLowerCase();
    if (wantedStatus === 'collected') listMatch.orderStatus = 'delivered';
    else if (wantedStatus === 'refunded') listMatch.orderStatus = { $in: CANCELLED_ORDER_STATUSES };
    else if (wantedStatus === 'pending') {
        listMatch.orderStatus = { $nin: ['delivered', 'pending_payment', ...CANCELLED_ORDER_STATUSES] };
    }
    const q = String(search || '').trim();
    if (q) listMatch.orderId = { $regex: escapeRegex(q), $options: 'i' };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [summaryRows, trendRows, total, rows] = await Promise.all([
        FoodOrder.aggregate([
            { $match: base },
            {
                $group: {
                    _id: bucketOf,
                    amount: { $sum: '$pricing.donation' },
                    count: { $sum: 1 },
                    today: { $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, '$pricing.donation', 0] } },
                    month: { $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, '$pricing.donation', 0] } },
                },
            },
        ]),
        FoodOrder.aggregate([
            { $match: { ...base, orderStatus: 'delivered' } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    amount: { $sum: '$pricing.donation' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
        ]),
        FoodOrder.countDocuments(listMatch),
        FoodOrder.find(listMatch)
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .select('orderId orderStatus pricing.donation pricing.total createdAt customerName customerPhone restaurantId userId')
            .populate('restaurantId', 'restaurantName')
            .lean(),
    ]);

    const bucket = (name) => summaryRows.find((r) => r._id === name) || {};
    const collected = bucket('collected');
    const summary = {
        totalCollected: round2(collected.amount),
        collectedOrders: collected.count || 0,
        collectedToday: round2(collected.today),
        collectedThisMonth: round2(collected.month),
        averageDonation: collected.count ? round2(collected.amount / collected.count) : 0,
        pendingAmount: round2(bucket('pending').amount),
        pendingOrders: bucket('pending').count || 0,
        refundedAmount: round2(bucket('refunded').amount),
        refundedOrders: bucket('refunded').count || 0,
    };

    return {
        summary,
        daily: trendRows.map((r) => ({ date: r._id, amount: round2(r.amount), orders: r.count })).reverse(),
        donations: rows.map((o) => ({
            id: o._id,
            orderId: o.orderId || String(o._id),
            amount: round2(o.pricing?.donation),
            orderTotal: round2(o.pricing?.total),
            orderStatus: o.orderStatus,
            status: o.orderStatus === 'delivered'
                ? 'collected'
                : CANCELLED_ORDER_STATUSES.includes(o.orderStatus)
                    ? 'refunded'
                    : o.orderStatus === 'pending_payment' ? 'unpaid' : 'pending',
            customerName: o.customerName || '',
            customerPhone: o.customerPhone || '',
            restaurantName: o.restaurantId?.restaurantName || '',
            createdAt: o.createdAt,
        })),
        pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) || 1 },
    };
}
