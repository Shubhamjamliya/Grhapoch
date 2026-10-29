import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const rangeSchema = z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    fee: z.number().min(0)
});

const feeSettingsUpsertSchema = z.object({
    deliveryFee: z.number().min(0).nullable().optional(),
    deliveryFeeRanges: z.array(rangeSchema).optional(),
    freeDeliveryUpTo: z.number().min(0).nullable().optional(),
    freeDeliveryThreshold: z.number().min(0).nullable().optional(),
    platformFee: z.number().min(0).nullable().optional(),
    packagingFee: z.number().min(0).nullable().optional(),
    donationEnabled: z.boolean().optional(),
    donationAmounts: z.array(z.number().int().min(1).max(1000)).max(10).optional(),
    donationDefaultAmount: z.number().min(0).max(1000).nullable().optional(),
    deliveryTipEnabled: z.boolean().optional(),
    deliveryTipAmounts: z.array(z.number().int().min(1).max(500)).max(10).optional(),
    deliveryTipDefaultAmount: z.number().min(0).max(500).nullable().optional(),
    gstRate: z.number().min(0).max(100).nullable().optional(),
    gstOnDeliveryFee: z.number().min(0).max(100).nullable().optional(),
    gstOnPlatformFee: z.number().min(0).max(100).nullable().optional(),
    gstOnPackagingFee: z.number().min(0).max(100).nullable().optional(),
    deliveryBonusAmount: z.number().min(0).nullable().optional(),
    dispatchRadiusExpansionEnabled: z.boolean().optional(),
    dispatchRadiusTiers: z.array(z.number().min(0)).optional(),
    isActive: z.boolean().optional()
});

export const validateFeeSettingsUpsertDto = (body) => {
    const normalized = {
        deliveryFee:
            body?.deliveryFee === null
                ? null
                : body?.deliveryFee !== undefined
                    ? Number(body.deliveryFee)
                    : undefined,
        deliveryFeeRanges: Array.isArray(body?.deliveryFeeRanges)
            ? body.deliveryFeeRanges.map((r) => ({
                min: Number(r?.min),
                max: Number(r?.max),
                fee: Number(r?.fee)
            }))
            : undefined,
        freeDeliveryUpTo:
            body?.freeDeliveryUpTo === null
                ? null
                : body?.freeDeliveryUpTo !== undefined
                    ? Number(body.freeDeliveryUpTo)
                    : undefined,
        freeDeliveryThreshold:
            body?.freeDeliveryThreshold === null
                ? null
                : body?.freeDeliveryThreshold !== undefined
                    ? Number(body.freeDeliveryThreshold)
                    : undefined,
        platformFee:
            body?.platformFee === null ? null : body?.platformFee !== undefined ? Number(body.platformFee) : undefined,
        packagingFee:
            body?.packagingFee === null ? null : body?.packagingFee !== undefined ? Number(body.packagingFee) : undefined,
        donationEnabled: body?.donationEnabled !== undefined ? Boolean(body.donationEnabled) : undefined,
        donationAmounts: Array.isArray(body?.donationAmounts) ? body.donationAmounts.map((v) => Number(v)) : undefined,
        donationDefaultAmount:
            body?.donationDefaultAmount === null ? null : body?.donationDefaultAmount !== undefined ? Number(body.donationDefaultAmount) : undefined,
        deliveryTipEnabled: body?.deliveryTipEnabled !== undefined ? Boolean(body.deliveryTipEnabled) : undefined,
        deliveryTipAmounts: Array.isArray(body?.deliveryTipAmounts) ? body.deliveryTipAmounts.map((v) => Number(v)) : undefined,
        deliveryTipDefaultAmount:
            body?.deliveryTipDefaultAmount === null ? null : body?.deliveryTipDefaultAmount !== undefined ? Number(body.deliveryTipDefaultAmount) : undefined,
        gstRate:
            body?.gstRate === null ? null : body?.gstRate !== undefined ? Number(body.gstRate) : undefined,
        gstOnDeliveryFee:
            body?.gstOnDeliveryFee === null ? null : body?.gstOnDeliveryFee !== undefined ? Number(body.gstOnDeliveryFee) : undefined,
        gstOnPlatformFee:
            body?.gstOnPlatformFee === null ? null : body?.gstOnPlatformFee !== undefined ? Number(body.gstOnPlatformFee) : undefined,
        gstOnPackagingFee:
            body?.gstOnPackagingFee === null ? null : body?.gstOnPackagingFee !== undefined ? Number(body.gstOnPackagingFee) : undefined,
        deliveryBonusAmount:
            body?.deliveryBonusAmount === null ? null : body?.deliveryBonusAmount !== undefined ? Number(body.deliveryBonusAmount) : undefined,
        dispatchRadiusExpansionEnabled:
            body?.dispatchRadiusExpansionEnabled !== undefined ? Boolean(body.dispatchRadiusExpansionEnabled) : undefined,
        dispatchRadiusTiers: Array.isArray(body?.dispatchRadiusTiers) ? body.dispatchRadiusTiers.map(Number) : undefined,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined
    };

    const result = feeSettingsUpsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    // Validate ranges: min < max, non-overlapping after sorting
    const ranges = Array.isArray(result.data.deliveryFeeRanges) ? result.data.deliveryFeeRanges : undefined;
    if (ranges) {
        const sorted = [...ranges].sort((a, b) => a.min - b.min);
        for (const r of sorted) {
            if (r.min >= r.max) {
                throw new ValidationError('Each range must have min less than max');
            }
        }
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const cur = sorted[i];
            if (cur.min < prev.max) {
                throw new ValidationError('Delivery fee ranges must not overlap');
            }
        }
        result.data.deliveryFeeRanges = sorted;
    }

    if (
        Array.isArray(result.data.donationAmounts) &&
        result.data.donationDefaultAmount != null &&
        !result.data.donationAmounts.includes(result.data.donationDefaultAmount)
    ) {
        throw new ValidationError('Default donation amount must be one of the donation presets');
    }

    if (
        Array.isArray(result.data.deliveryTipAmounts) &&
        result.data.deliveryTipDefaultAmount != null &&
        !result.data.deliveryTipAmounts.includes(result.data.deliveryTipDefaultAmount)
    ) {
        throw new ValidationError('Default delivery tip amount must be one of the delivery tip presets');
    }

    return result.data;
};


