import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cardNumber: { type: String, required: true, trim: true },
    iban: { type: String, required: true, trim: true, uppercase: true },
    bankName: { type: String, required: true, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bankAccountSchema.index({ userId: 1, cardNumber: 1 }, { unique: true });
bankAccountSchema.index({ userId: 1, iban: 1 }, { unique: true });

export const BankAccount = mongoose.model("BankAccount", bankAccountSchema);
