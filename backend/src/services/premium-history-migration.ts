import { PaymentOrderModel } from '../models/payment-order.model.js';
import { UserModel } from '../models/user.model.js';

// Additive and restartable. Never writes expiry, trial, role or learning data.
export async function migratePremiumHistory(dryRun = true) {
  let candidates = 0;
  let updated = 0;
  const users = UserModel.find({ hasEverPurchasedPremium: { $ne: true } })
    .select('premiumExpiresAt +premiumReceipts').lean().cursor();
  for await (const user of users) {
    const purchased = user.premiumReceipts?.some(receipt => receipt.orderCode != null)
      || Boolean(await PaymentOrderModel.exists({ userId: user._id, status: 'PAID' }));
    if (!purchased) continue;
    candidates++;
    if (!dryRun) {
      const result = await UserModel.updateOne({ _id: user._id, hasEverPurchasedPremium: { $ne: true } },
        { $set: { hasEverPurchasedPremium: true } });
      updated += result.modifiedCount;
    }
  }
  const unknownHistory = await UserModel.countDocuments({
    premiumExpiresAt: { $ne: null }, hasEverPurchasedPremium: { $ne: true },
    'premiumReceipts.0': { $exists: false },
  });
  return { dryRun, candidates, updated, unknownHistory };
}
