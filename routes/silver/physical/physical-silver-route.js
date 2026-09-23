import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { validate } from '../../../middlewares/validate.js';
import { listProducts,getProduct,getPrice,getCart,addCartItem,setCartItem,clearCart } from '../../../controllers/silver/physical/physical-controller.js';
import { addCartSchema,setCartSchema } from '../../../validations/silver/physical/physical-validation.js';
const router=Router();
router.get('/price',getPrice);router.get('/products',listProducts);router.get('/products/:id',getProduct);
router.get('/cart',authenticate,getCart);router.post('/cart/items',authenticate,validate(addCartSchema),addCartItem);router.patch('/cart/items/:productId',authenticate,validate(setCartSchema),setCartItem);router.delete('/cart',authenticate,clearCart);
export default router;
