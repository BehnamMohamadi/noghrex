import mongoose from "mongoose";

const balanceSchema = new mongoose.Schema(
  {
    available: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    locked: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  { _id: false },
);

const walletSchema = new mongoose.Schema(
  {
    financialRevision: { type: Number, default: 0 },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    toman: { type: balanceSchema, default: () => ({}) },
    x: { type: balanceSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const Wallet = mongoose.model("Wallet", walletSchema);
