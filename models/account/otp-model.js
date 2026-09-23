import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true, index: true },
    purpose: {
      type: String,
      enum: ["signup", "forgot_password", "financial_action"],
      required: true,
      index: true,
    },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    signupTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phoneNumber: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ phoneNumber: 1, purpose: 1 }, { unique: true });

export const OtpVerification = mongoose.model("OtpVerification", otpSchema);
