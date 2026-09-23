import express from 'express';
import { fileURLToPath } from 'node:url';
import adminPanelRoutes from './routes/admin/admin-panel-route.js';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { csrfGuard } from './middlewares/security.js';
import paymentRoutes from './routes/payment/payment-route.js';
import { refundRoutes, adminRefundRoutes } from './routes/refund/refund-route.js';
import adminReportRoutes from './routes/admin/admin-report-route.js';
import adminUserRoutes from './routes/admin/admin-user-route.js';
import withdrawalFailureRoutes from './routes/admin/withdrawal-failure-route.js';
import adminCatalogRoutes from './routes/admin/admin-catalog-route.js';
import { env } from './config/env.js';
import accountRoutes from './routes/account/account-route.js';
import authRoutes from './routes/auth/auth-route.js';
import kycRoutes from './routes/kyc/kyc-route.js';
import bankAccountRoutes from './routes/bank-account/bank-account-route.js';
import adminKycBankRoutes from './routes/admin/admin-kyc-bank-route.js';
import walletRoutes from './routes/wallet/wallet-route.js';
import depositRoutes from './routes/deposit/deposit-route.js';
import withdrawalRoutes from './routes/withdrawal/withdrawal-route.js';
import settingsRoutes from './routes/settings/settings-route.js';
import adminFinancialRoutes from './routes/admin/admin-financial-route.js';
import onlineSilverRoutes from './routes/silver/online/online-silver-route.js';
import adminOnlineSilverRoutes from './routes/silver/online/admin-online-silver-route.js';
import adminSystemAlertRoutes from './routes/admin/admin-system-alert-route.js';
import physicalSilverRoutes from './routes/silver/physical/physical-silver-route.js';
import adminPhysicalSilverRoutes from './routes/silver/physical/admin-physical-silver-route.js';
import addressRoutes from './routes/address/address-route.js';
import shippingRoutes from './routes/shipping/shipping-route.js';
import adminShippingRoutes from './routes/shipping/admin-shipping-route.js';
import checkoutRoutes from './routes/checkout/checkout-route.js';
import orderRoutes from './routes/order/order-route.js';
import adminOrderRoutes from './routes/order/admin-order-route.js';
import { notFound, errorHandler } from './middlewares/error-handler.js';

export const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(csrfGuard);
app.get('/', (req, res) => res.redirect('/admin/'));
app.use('/admin', express.static(fileURLToPath(new URL('./public/admin/', import.meta.url)), { maxAge: 0 }));
app.use('/api/admin/panel', adminPanelRoutes);

app.get('/api/health', (req, res) => res.status(200).json({ status: 'success', service: 'noghrex-backend' }));
app.use('/api/account', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/admin/refunds', adminRefundRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/users', adminUserRoutes);
app.use('/api/admin/withdrawals', withdrawalFailureRoutes);
app.use('/api/admin', adminCatalogRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/account/kyc', kycRoutes);
app.use('/api/account/bank-accounts', bankAccountRoutes);
app.use('/api/admin', adminKycBankRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/wallet/deposits', depositRoutes);
app.use('/api/wallet/withdrawals', withdrawalRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin', adminFinancialRoutes);
app.use('/api/silver/online', onlineSilverRoutes);
app.use('/api/admin/silver/online', adminOnlineSilverRoutes);
app.use('/api/admin/system', adminSystemAlertRoutes);
app.use('/api/silver/physical', physicalSilverRoutes);
app.use('/api/admin/silver/physical', adminPhysicalSilverRoutes);
app.use('/api/account/addresses', addressRoutes);
app.use('/api/shipping-methods', shippingRoutes);
app.use('/api/admin/shipping-methods', adminShippingRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);

app.use(notFound);
app.use(errorHandler);
