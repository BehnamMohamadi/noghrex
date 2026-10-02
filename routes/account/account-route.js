import { Router } from 'express';
import { getMe, updateMe } from '../../controllers/account/account-controller.js';
import { validate } from '../../middlewares/validate.js';
import { updateAccountSchema } from '../../validations/account/account-validation.js';
import { authenticate } from '../../middlewares/auth.js';
import { deactivateAccount } from '../../services/account/account-service.js';
import mongoose from 'mongoose';
import { User } from '../../models/account/user-model.js';
import { PhysicalProduct } from '../../models/silver/physical/product-model.js';
import { listProducts } from '../../services/silver/physical/physical-product-service.js';
import { AppError } from '../../errors/app-error.js';

const router = Router();

router.use(authenticate);
router.get('/favorites', async (req,res) => {
  const user=await User.findById(req.user.id).select('favoriteProductIds').lean();
  res.json({status:'success',data:{products:await listProducts(req.query,user.favoriteProductIds||[])}});
});
router.put('/favorites/:id', async (req,res) => {
  if(!mongoose.isObjectIdOrHexString(req.params.id))throw new AppError('شناسه محصول معتبر نیست.',400,'INVALID_PRODUCT_ID');
  if(!await PhysicalProduct.exists({_id:req.params.id,active:true}))throw new AppError('محصول پیدا نشد.',404,'PRODUCT_NOT_FOUND');
  const user=await User.findOneAndUpdate({_id:req.user.id,$or:[{'favoriteProductIds.99':{$exists:false}},{favoriteProductIds:req.params.id}]},{$addToSet:{favoriteProductIds:req.params.id}},{new:true}).select('favoriteProductIds');
  if(!user)throw new AppError('حداکثر ۱۰۰ محصول را می‌توان ذخیره کرد.',409,'FAVORITES_LIMIT');
  res.json({status:'success',data:{favoriteProductIds:user.favoriteProductIds}});
});
router.delete('/favorites/:id', async (req,res) => {
  const user=await User.findByIdAndUpdate(req.user.id,{$pull:{favoriteProductIds:req.params.id}},{new:true}).select('favoriteProductIds');
  res.json({status:'success',data:{favoriteProductIds:user.favoriteProductIds}});
});
router.get('/', getMe);
router.delete('/', async (req, res) => res.json({ status: 'success', data: { user: await deactivateAccount(req.user.id) } }));
router.patch('/', validate(updateAccountSchema), updateMe);

export default router;
