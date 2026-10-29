import mongoose from 'mongoose';

const deliveryFeeRangeSchema = new mongoose.Schema(
    {
        min: { type: Number, required: true, min: 0 },
        max: { type: Number, required: true, min: 0 },
        fee: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const feeSettingsSchema = new mongoose.Schema(
    {
        // No defaults here; admin must explicitly configure values.
        deliveryFee: { type: Number, min: 0 },
        deliveryFeeRanges: { type: [deliveryFeeRangeSchema], default: [] },
        freeDeliveryUpTo: { type: Number, min: 0 },
        freeDeliveryThreshold: { type: Number, min: 0 },
        platformFee: { type: Number, min: 0 },
        packagingFee: { type: Number, min: 0 },
        // Donation: admin-configured preset amounts. Customer picks one; selecting none is not
        // allowed — a default preset is always pre-selected and charged.
        donationEnabled: { type: Boolean, default: false },
        donationAmounts: { type: [Number], default: [] },
        donationDefaultAmount: { type: Number, min: 0, max: 1000 },
        // Delivery tip: admin-configured preset amounts. Same mandatory-selection rule as donation.
        deliveryTipEnabled: { type: Boolean, default: false },
        deliveryTipAmounts: { type: [Number], default: [] },
        deliveryTipDefaultAmount: { type: Number, min: 0, max: 500 },
        gstRate: { type: Number, min: 0, max: 100 },
        gstOnDeliveryFee: { type: Number, min: 0, max: 100, default: 0 },
        gstOnPlatformFee: { type: Number, min: 0, max: 100, default: 0 },
        gstOnPackagingFee: { type: Number, min: 0, max: 100, default: 0 },
        deliveryBonusAmount: { type: Number, min: 0, default: 0 },
        dispatchRadiusExpansionEnabled: { type: Boolean, default: true },
        dispatchRadiusTiers: { type: [Number], default: [2, 4, 6, 8, 15] },
        globalRestaurantCommission: { type: Number, min: 0, default: 0 },
        globalGstOnItem: { type: Number, min: 0, max: 100, default: 0 },
        globalGstOnCommission: { type: Number, min: 0, max: 100, default: 18 },
        globalPaymentGatewayFee: { type: Number, min: 0, max: 100, default: 2 },
        globalTcs: { type: Number, min: 0, max: 100, default: 1 },
        applyGlobalTaxes: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'payment_fee_settings', timestamps: true }
);

feeSettingsSchema.index({ isActive: 1, createdAt: -1 });

export const FoodFeeSettings = mongoose.model('FoodFeeSettings', feeSettingsSchema);


