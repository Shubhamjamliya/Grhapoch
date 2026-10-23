import mongoose from 'mongoose';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodAddon } from '../../restaurant/models/foodAddon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

/** The app rounds discounted prices to whole rupees, so allow ₹1 of rounding difference per unit. */
const PRICE_TOLERANCE = 1;

function toObjectIds(ids = []) {
  return [...new Set(ids)]
    .map((id) => String(id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

/** Catalogue price of a food item (variant price when a size is chosen). */
function resolveBasePrice(foodDoc, rawItem) {
  const variantId = String(rawItem?.variantId || '').trim();
  const variants = Array.isArray(foodDoc?.variants) ? foodDoc.variants : [];

  if (variantId) {
    const variant = variants.find((entry) => String(entry?._id) === variantId);
    if (!variant) {
      throw new ValidationError(`${foodDoc.name} is no longer available in the selected size`);
    }
    return Number(variant.price) || 0;
  }

  if (variants.length > 0) {
    throw new ValidationError(`Please select a size for ${foodDoc.name}`);
  }
  return Number(foodDoc.price) || 0;
}

/**
 * Same rule the customer app uses when it puts an item in the cart: the best of the
 * item-specific discount, the first matching price rule and the restaurant-wide discount.
 * Returns the whole-rupee price the customer should pay.
 */
export function computeDiscountedPrice(restaurant, itemId, basePrice) {
  let bestAmount = 0;
  let bestValue = 0;
  let bestIsFlat = false;

  const itemDiscount = (restaurant?.itemDiscounts || []).find((d) => String(d.itemId) === String(itemId));
  if (itemDiscount) {
    const value = Number(itemDiscount.discountValue) || 0;
    const isFlat = String(itemDiscount.discountType || '').toUpperCase() === 'FLAT';
    const amount = isFlat ? value : (basePrice * value) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = value;
      bestIsFlat = isFlat;
    }
  }

  const rule = (restaurant?.discountRules || []).find((r) => {
    const limit = Number(r.conditionValue);
    if (r.conditionType === 'PRICE_ABOVE' && basePrice > limit) return true;
    if (r.conditionType === 'PRICE_BELOW' && basePrice < limit) return true;
    return false;
  });
  if (rule) {
    const value = Number(rule.discountValue) || 0;
    const amount = (basePrice * value) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = value;
      bestIsFlat = false;
    }
  }

  const globalDiscount = Number(restaurant?.discount || 0);
  if (globalDiscount > 0) {
    const amount = (basePrice * globalDiscount) / 100;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestValue = globalDiscount;
      bestIsFlat = false;
    }
  }

  if (bestValue <= 0) return basePrice;
  return Math.round(bestIsFlat ? Math.max(0, basePrice - bestValue) : basePrice * (1 - bestValue / 100));
}

/**
 * Checks every cart line against the catalogue. The price the client sends must never be
 * lower than the price the restaurant's menu and discounts allow; unknown, unapproved or
 * unavailable items are rejected.
 *
 * @returns {{ serverSubtotal: number, totalQuantity: number }}
 */
export async function verifyOrderCartPrices(restaurantId, rawItems = []) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) throw new ValidationError('At least one item required');
  if (!mongoose.Types.ObjectId.isValid(String(restaurantId))) {
    throw new ValidationError('Restaurant not found');
  }

  const rId = new mongoose.Types.ObjectId(String(restaurantId));
  const itemIds = toObjectIds(items.map((item) => item.itemId || item.id));

  const [restaurant, foodDocs, addonDocs] = await Promise.all([
    FoodRestaurant.findById(rId).select('itemDiscounts discountRules discount').lean(),
    itemIds.length
      ? FoodItem.find({ restaurantId: rId, _id: { $in: itemIds }, approvalStatus: 'approved' }).lean()
      : [],
    itemIds.length
      ? FoodAddon.find({
          restaurantId: rId,
          _id: { $in: itemIds },
          isDeleted: { $ne: true },
          approvalStatus: 'approved',
          isAvailable: true,
          published: { $ne: null },
        })
          .select('_id published')
          .lean()
      : [],
  ]);

  const foodById = new Map(foodDocs.map((doc) => [String(doc._id), doc]));
  const addonById = new Map(addonDocs.map((doc) => [String(doc._id), doc]));

  let serverSubtotal = 0;
  let totalQuantity = 0;

  for (const rawItem of items) {
    const itemId = String(rawItem?.itemId || rawItem?.id || '').trim();
    const quantity = Math.max(1, Math.floor(Number(rawItem?.quantity) || 1));
    const label = String(rawItem?.name || 'An item');

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw new ValidationError('One or more cart items are invalid');
    }

    let expectedPrice;
    const foodDoc = foodById.get(itemId);
    if (foodDoc) {
      if (foodDoc.isAvailable === false) {
        throw new ValidationError(`${foodDoc.name} is currently unavailable`);
      }
      expectedPrice = computeDiscountedPrice(restaurant, itemId, resolveBasePrice(foodDoc, rawItem));
    } else {
      const addon = addonById.get(itemId)?.published;
      if (!addon) {
        throw new ValidationError(`${label} is no longer available from this restaurant`);
      }
      expectedPrice = Number(addon.price) || 0;
    }

    const clientPrice = Number(rawItem?.price);
    if (!Number.isFinite(clientPrice) || clientPrice < expectedPrice - PRICE_TOLERANCE) {
      throw new ValidationError(`The price of ${label} has changed. Please refresh your cart and try again.`);
    }

    serverSubtotal += expectedPrice * quantity;
    totalQuantity += quantity;
  }

  return { serverSubtotal, totalQuantity };
}
