import mongoose from 'mongoose';

const foodOtherAppSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        subtitle: {
            type: String,
            trim: true
        },
        iconUrl: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        playStoreLink: {
            type: String,
            trim: true
        },
        appStoreLink: {
            type: String,
            trim: true
        },
        sortOrder: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        collection: 'food_other_apps',
        timestamps: true
    }
);

foodOtherAppSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodOtherApp = mongoose.model('FoodOtherApp', foodOtherAppSchema);
