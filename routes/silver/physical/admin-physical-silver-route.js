import { Router } from 'express';
import { authenticate,authorize } from '../../../middlewares/auth.js';
import { validate } from '../../../middlewares/validate.js';
import { createProduct,updateProduct,setPrice,adjustInventory } from '../../../controllers/silver/physical/physical-controller.js';
import { productSchema,productUpdateSchema,priceSchema,inventorySchema } from '../../../validations/silver/physical/physical-validation.js';
const router=Router();router.use(authenticate,authorize('admin'));
router.post('/products',validate(productSchema),createProduct);router.patch('/products/:id',validate(productUpdateSchema),updateProduct);router.put('/price',validate(priceSchema),setPrice);router.post('/products/:id/inventory/adjustments',validate(inventorySchema),adjustInventory);
export default router;
