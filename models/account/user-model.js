import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true, trim: true, maxlength: 80 },
  lastname: { type: String, required: true, trim: true, maxlength: 100 },
  phoneNumber: { type: String, required: true, unique: true, index: true },
  phoneVerifiedAt: { type: Date, default: null },
  email: { type: String, trim: true, lowercase: true, default: null },
  password: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0, min: 0 },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  accountStatus: {
    type: String,
    enum: ['active', 'deactivated', 'suspended'],
    default: 'active',
    index: true
  },
  deactivationReason: {
    type: String,
    enum: ['user_deactivated', 'admin_deactivated', 'security', 'other'],
    default: null
  },
  deactivationNote: { type: String, trim: true, maxlength: 500, default: null },
  deactivatedAt: { type: Date, default: null },
  deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, toJSON: { transform(_doc, value) { delete value.password; delete value.tokenVersion; return value; } } });

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
