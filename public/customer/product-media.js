const demos={'DEMO-FINE-01':'fine-01','DEMO-FINE-02':'fine-02','DEMO-BOLD-01':'bold-01','DEMO-BOLD-02':'bold-02','DEMO-BAR-01':'bar-01','DEMO-BAR-02':'bar-02'};
export function productImages(product){
 const images=product.images||[],key=demos[product.sku];
 const legacy=images.length===1&&/\/(jewelry-delicate|jewelry-bold|silver-hero)\.png(?:[?#].*)?$/.test(images[0]);
 // Only replace the original demo artwork; actual and administrator-uploaded photos win.
 return key&&product.imageKind!=='actual'&&legacy?['/assets/product-'+key+'.webp']:images;
}

export const productPath=p=>'product/'+encodeURIComponent(p.slug||p._id);
