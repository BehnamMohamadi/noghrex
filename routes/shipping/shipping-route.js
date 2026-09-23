import {Router} from 'express';import {list} from '../../controllers/shipping/shipping-controller.js';const r=Router();r.get('/',list);export default r;
