import { Router } from 'express';
import { Trade } from '../../../models/silver/online/trade-model.js';
import { AppError } from '../../../errors/app-error.js';
import { getPublicOnlinePrice } from '../../../controllers/silver/online/online-price-controller.js';
import { createOnlineQuote, getOnlineQuote, executeOnlineTrade, getMyOnlineTrades } from '../../../controllers/silver/online/online-trade-controller.js';
import { authenticate } from '../../../middlewares/auth.js';
import { validate } from '../../../middlewares/validate.js';
import { createQuoteSchema, executeTradeSchema } from '../../../validations/silver/online/online-trade-validation.js';
const router = Router();
router.get('/price', getPublicOnlinePrice);
router.post('/quotes', authenticate, validate(createQuoteSchema), createOnlineQuote);
router.get('/quotes/:id', authenticate, getOnlineQuote);
router.post('/trades', authenticate, validate(executeTradeSchema), executeOnlineTrade);
router.get('/trades', authenticate, getMyOnlineTrades);
router.get('/trade-status/:quoteId', authenticate, async(req,res)=>{
  const trade=await Trade.findOne({quoteId:req.params.quoteId,userId:req.user.id}).lean();
  res.json({status:'success',data:{trade}});
});
router.get('/trades/:id', authenticate, async(req,res)=>{
  const trade=await Trade.findOne({_id:req.params.id,userId:req.user.id}).lean();
  if(!trade)throw new AppError('معامله پیدا نشد.',404,'TRADE_NOT_FOUND');
  res.json({status:'success',data:{trade}});
});
export default router;
