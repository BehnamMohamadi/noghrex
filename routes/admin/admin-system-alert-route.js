import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { listAlerts, resolveSystemAlert } from '../../controllers/admin/system-alert-controller.js';
const router=Router(); router.use(authenticate,authorize('admin')); router.get('/alerts',listAlerts); router.patch('/alerts/:id/resolve',resolveSystemAlert); export default router;
