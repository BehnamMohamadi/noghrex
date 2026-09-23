import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { createBankAccountSchema } from '../../validations/bank-account/bank-account-validation.js';
import { listMine, createMine, setDefault, deactivate } from '../../controllers/bank-account/bank-account-controller.js';
const router=Router(); router.use(authenticate);
router.get('/',listMine); router.post('/',validate(createBankAccountSchema),createMine);
router.patch('/:id/default',setDefault); router.delete('/:id',deactivate);
export default router;
