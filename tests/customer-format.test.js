import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatAmount} from '../public/customer/amount-format.js';
import {productImages} from '../public/customer/product-media.js';
test('amount grouping accepts Persian and Arabic digits without rounding or hiding invalid input',()=>{
 for(const v of ['1000000','۱۰۰۰۰۰۰','١٠٠٠٠٠٠','۱٬۰۰۰٬۰۰۰'])assert.equal(formatAmount(v),'1,000,000');
 assert.equal(formatAmount('۱۲۳۴٫۵۰۰'),'1,234.500');
 assert.equal(formatAmount('1234.'),'1,234.');
 assert.equal(formatAmount(''),'');
 assert.equal(formatAmount('1x00'),'1x00');
 assert.equal(formatAmount('9007199254740993'),'9,007,199,254,740,993');
});
test('demo catalog gets six distinct images without overriding actual or custom photos',()=>{
 const urls=['FINE-01','FINE-02','BOLD-01','BOLD-02','BAR-01','BAR-02'].map(sku=>productImages({sku:'DEMO-'+sku,images:['http://localhost:3000/assets/silver-hero.png']})[0]);
 assert.equal(new Set(urls).size,6);
 const actual={sku:'DEMO-FINE-01',imageKind:'actual',images:['/assets/jewelry-delicate.png']};
 assert.deepEqual(productImages(actual),actual.images);
 const custom={sku:'DEMO-FINE-01',images:['/uploads/real-photo.webp']};
 assert.deepEqual(productImages(custom),custom.images);
});
