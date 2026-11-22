export function createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon,confirmAction}){
const brandOpts=()=>state.brands.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
const catOpts=()=>state.categories.filter(x=>x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
function editor(p={}){
return '<div class="card"><div class="row"><h2>'+ (p.id?"تعديل":"إضافة")+' منتج</h2><button id="cancelEdit" class="btn outline"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-right"></use></svg> رجوع</button></div><form id="adminProductForm" class="formgrid"><input type="hidden" name="id" value="'+esc(p.id||"")+'"><label class="formgroup fullspan">اسم المنتج *<input name="name" required minlength="2" maxlength="180" class="field" value="'+esc(p.name||"")+'"></label><label class="formgroup">القسم *<select name="category_id" class="field" required><option value="">اختر القسم</option>'+catOpts()+'</select></label><label class="formgroup">العلامة التجارية<select name="brand_id" class="field"><option value="">بدون علامة</option>'+brandOpts()+'</select></label><label class="formgroup">السعر بالدينار *<input type="number" name="price_iqd" min="0" step="1" required class="field" value="'+esc(p.price_iqd??"")+'"></label><label class="formgroup">السعر قبل العرض<input type="number" name="compare_at_iqd" min="0" step="1" class="field" value="'+esc(p.compare_at_iqd??"")+'"></label><label class="formgroup">المخزون *<input type="number" name="stock" min="0" step="1" required class="field" value="'+esc(p.stock??0)+'"></label><label class="formgroup">رمز المنتج SKU<input name="sku" class="field" value="'+esc(p.sku||"")+'"></label><label class="formgroup fullspan">الوصف<textarea name="description" class="field">'+esc(p.description||"")+'</textarea></label><label class="formgroup fullspan">رابط الصورة (HTTPS) أو ارفع صورة<input name="image_url" class="field" value="'+esc(p.image_url||"")+'"></label><label class="formgroup fullspan">صورة JPG / PNG / WEBP — 5MB كحد أقصى<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" class="field"></label><label class="formgroup">نوع المنتج<select name="is_demo" class="field"><option value="false">منتج حقيقي قابل للطلب</option><option value="true">تجريبي للعرض فقط</option></select></label><label class="formgroup">النشر<select name="active" class="field"><option value="true">منشور</option><option value="false">مخفي</option></select></label><label class="formgroup">مميز<select name="featured" class="field"><option value="false">لا</option><option value="true">نعم</option></select></label><label class="formgroup">عرض<select name="on_sale" class="field"><option value="false">لا</option><option value="true">نعم</option></select></label><button type="submit" class="btn primary fullspan"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#check"></use></svg> حفظ المنتج</button></form></div>';
}
async function adminPage(){
const tabs=[["products","المنتجات"],["orders","الطلبات"],["shipping","التوصيل"],["promos","الإعلانات"],["categories","الفئات"],["brands","العلامات التجارية"]].map(([key,text])=>'<button data-admin-tab="'+key+'" class="'+(state.adminTab===key?"active":"")+'">'+text+'</button>').join("");
let body="";
if(state.adminTab==="products"){
if(state.editProduct){let p=state.products.find(x=>x.id===state.editProduct)||{};body=editor(p)}
else body='<button class="btn primary" id="newProduct" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> منتج جديد</button><div class="card admin-table"><table><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.products.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+money(p.price_iqd)+'</td><td>'+p.stock+'</td><td>'+(p.is_demo?"تجريبي / ":"")+(p.active?"منشور":"مخفي")+'</td><td><button data-edit-product="'+p.id+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#settings"></use></svg> تعديل</button><button data-toggle-product="'+p.id+'">'+(p.active?"إخفاء":"نشر")+'</button><button class="danger-action" data-delete-product="'+p.id+'">حذف</button></td></tr>').join("")||'<tr><td colspan="5">لا توجد منتجات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="orders"){
const {data,error}=await sb.from("orders").select("id,created_at,customer_name,phone,governorate,address,note,payment_method,total_iqd,status,order_items(product_name,quantity)").order("created_at",{ascending:false}).limit(150);
body=error?'<p class="error">'+esc(error.message)+'</p>':'<div class="card admin-table"><table><thead><tr><th>الطلب</th><th>الزبون</th><th>العنوان</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>'+((data||[]).map(o=>'<tr><td>'+esc(o.id.slice(0,8))+'<br>'+new Date(o.created_at).toLocaleDateString("ar-IQ")+'</td><td>'+esc(o.customer_name)+'<br>'+esc(o.phone)+'</td><td>'+esc(o.governorate)+'<br>'+esc(o.address)+'<br>'+esc(o.note)+'</td><td>'+o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join("<br>")+'</td><td>'+money(o.total_iqd)+'</td><td><select class="field" data-status="'+o.id+'">'+[["new","جديد"],["confirmed","تم التأكيد"],["packing","تجهيز"],["shipped","بالطريق"],["delivered","مسلّم"],["cancelled","ملغي"]].map(([k,v])=>'<option value="'+k+'" '+(o.status===k?"selected":"")+'>'+v+'</option>').join("")+'</select></td></tr>').join("")||'<tr><td colspan="6">لا توجد طلبات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="shipping")body='<div class="card"><p class="subtle">كل المحافظات معطلة مبدئياً، حدّد السعر الصحيح وفعّل التوصيل.</p><div class="admin-table"><table><thead><tr><th>المحافظة</th><th>التوصيل د.ع</th><th>مفعّل</th><th>حفظ</th></tr></thead><tbody>'+state.rates.map(r=>'<tr><td>'+esc(r.governorate)+'</td><td><input class="field" type="number" min="0" step="1" id="rate-'+esc(r.governorate)+'" value="'+r.price_iqd+'"></td><td><input type="checkbox" id="enabled-'+esc(r.governorate)+'" '+(r.enabled?"checked":"")+'></td><td><button data-rate="'+esc(r.governorate)+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#check"></use></svg> حفظ</button></td></tr>').join("")+'</tbody></table></div></div>';
if(state.adminTab==="promos")body='<button id="newPromo" class="btn primary" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> إعلان جديد</button><div class="card admin-table"><table><thead><tr><th>الإعلان</th><th>المكان</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.promos.map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc(p.placement)+'</td><td>'+(p.active?"نشط":"مخفي")+'</td><td><button data-edit-promo="'+p.id+'">تعديل</button><button data-toggle-promo="'+p.id+'">'+(p.active?"إخفاء":"نشر")+'</button><button class="danger-action" data-delete-promo="'+p.id+'">حذف</button></td></tr>').join("")||'<tr><td colspan="4">لا توجد إعلانات</td></tr>')+'</tbody></table></div>';
return '<div class="page"><div class="row"><h1>لوحة إدارة BAZOO</h1><button class="btn outline" data-go="home"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#home"></use></svg> المتجر</button></div><div class="adminnav">'+tabs+'</div>'+body+'</div>';
}
function bindAdmin(){
const cancel=document.querySelector("#cancelEdit");if(cancel)cancel.onclick=()=>{state.editProduct=null;render()};
document.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=()=>removeRecord("products",b.dataset.deleteProduct,"المنتج"));
document.querySelectorAll("[data-delete-promo]").forEach(b=>b.onclick=()=>removeRecord("promotions",b.dataset.deletePromo,"الإعلان"));
document.querySelectorAll("[data-toggle-product]").forEach(b=>b.onclick=()=>toggleRecord("products",b.dataset.toggleProduct));
document.querySelectorAll("[data-toggle-promo]").forEach(b=>b.onclick=()=>toggleRecord("promotions",b.dataset.togglePromo));
const f=document.querySelector("#adminProductForm");if(f){
const p=state.products.find(x=>x.id===state.editProduct);
if(p)for(const key of ["category_id","brand_id","active","featured","on_sale","is_demo"]){if(f.elements[key])f.elements[key].value=String(p[key]??"")}
}
document.querySelectorAll("[data-status]").forEach(el=>el.onchange=async()=>{const {error}=await sb.from("orders").update({status:el.value}).eq("id",el.dataset.status);notify(error?error.message:"تم تحديث حالة الطلب ")});
document.querySelectorAll("[data-rate]").forEach(el=>el.onclick=async()=>{const g=el.dataset.rate;const price=Number(document.getElementById("rate-"+g).value),enabled=document.getElementById("enabled-"+g).checked;if(!Number.isSafeInteger(price)||price<0)return notify("السعر غير صحيح");const {error}=await sb.from("shipping_rates").update({price_iqd:price,enabled}).eq("governorate",g);if(error)return notify(error.message);await loadCatalog();notify("تم تحديث التوصيل ");render()});
}
async function saveProduct(form){
const f=new FormData(form),id=f.get("id");
const v={name:String(f.get("name")).trim(),category_id:Number(f.get("category_id")),brand_id:f.get("brand_id")?Number(f.get("brand_id")):null,price_iqd:Number(f.get("price_iqd")),compare_at_iqd:f.get("compare_at_iqd")!==""?Number(f.get("compare_at_iqd")):null,stock:Number(f.get("stock")),sku:String(f.get("sku")||"").trim()||null,description:String(f.get("description")||""),image_url:String(f.get("image_url")||"").trim()||null,active:f.get("active")==="true",featured:f.get("featured")==="true",on_sale:f.get("on_sale")==="true",is_demo:f.get("is_demo")==="true"};
if(!v.category_id||!Number.isSafeInteger(v.price_iqd)||!Number.isSafeInteger(v.stock)||v.price_iqd<0||v.stock<0)return notify("تحقق من بيانات المنتج");
if(v.image_url&&!/^https:\/\//.test(v.image_url))return notify("الصورة لازم تكون HTTPS");
try{
const file=f.get("photo");if(file?.size){if(file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("الصورة غير مدعومة أو أكبر من 5MB");const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];const filename=crypto.randomUUID()+"."+ext;const {error}=await sb.storage.from("product-images").upload(filename,file,{contentType:file.type});if(error)throw error;v.image_url=sb.storage.from("product-images").getPublicUrl(filename).data.publicUrl}
const r=id?await sb.from("products").update(v).eq("id",id):await sb.from("products").insert(v);if(r.error)throw r.error;
await loadCatalog();state.editProduct=null;notify("تم حفظ المنتج ");render();
}catch(e){notify("فشل حفظ المنتج: "+e.message)}
}
function showPromoEditor(id){
const p=state.promos.find(x=>x.id===id)||{};
openModal(p.id?"تعديل الإعلان":"إعلان جديد",'<form id="adminPromoForm" class="stack"><input type="hidden" name="id" value="'+esc(p.id||"")+'"><label class="formgroup">عنوان الإعلان<input name="title" class="field" required value="'+esc(p.title||"")+'"></label><label class="formgroup">تفاصيل<input name="subtitle" class="field" value="'+esc(p.subtitle||"")+'"></label><label class="formgroup">رابط صورة HTTPS<input name="image_url" class="field" value="'+esc(p.image_url||"")+'"></label><label class="formgroup">رابط داخلي مثل #/offers<input name="link_url" class="field" value="'+esc(p.link_url||"")+'"></label><label class="formgroup">المكان<select name="placement" class="field"><option value="home">الرئيسية</option><option value="categories">الفئات</option><option value="cart">العربة</option></select></label><label class="formgroup">الحالة<select name="active" class="field"><option value="true">مفعّل</option><option value="false">مخفي</option></select></label><button class="btn primary">حفظ</button></form>');
const form=document.querySelector("#adminPromoForm");if(p.id){form.elements.placement.value=p.placement;form.elements.active.value=String(p.active)}
}
async function savePromo(form){
const f=new FormData(form),id=f.get("id");const v={title:String(f.get("title")).trim(),subtitle:String(f.get("subtitle")||""),image_url:String(f.get("image_url")||"").trim()||null,link_url:String(f.get("link_url")||"").trim()||null,placement:f.get("placement"),active:f.get("active")==="true"};
if(v.image_url&&!/^https:\/\//.test(v.image_url))return notify("رابط الصورة لازم HTTPS");
if(v.link_url&&!/^#\/(home|categories|offers|cart)$/.test(v.link_url))return notify("الرابط يجب يكون داخلي");
const r=id?await sb.from("promotions").update(v).eq("id",id):await sb.from("promotions").insert(v);if(r.error)return notify(r.error.message);
closeModal();await loadCatalog();notify("تم حفظ الإعلان ");render();
}

async function toggleRecord(table,id){
 const source=table==="products"?state.products:table==="promotions"?state.promos:table==="categories"?state.categories:state.brands;
 const item=source.find(x=>String(x.id)===String(id));if(!item)return;
 const {error}=await sb.from(table).update({active:!item.active}).eq("id",id);
 if(error){notify("تعذّر تغيير حالة النشر: "+error.message);return}
 await loadCatalog();notify(item.active?"تم إخفاء العنصر":"تم نشر العنصر");render();
}
function removeRecord(table,id,title){
 confirmAction("حذف "+title,"هل تريد حذف هذا العنصر من قاعدة البيانات؟ لا يمكن التراجع عن عملية الحذف. إذا كانت الفئة مرتبطة بمنتجات، استخدم إخفاء بدل الحذف.",async()=>{
  const {error}=await sb.from(table).delete().eq("id",id);
  if(error){notify("تعذّر الحذف: "+error.message);return false}
  await loadCatalog();notify("تم حذف "+title);render();return true;
 });
}
return {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo,toggleRecord,removeRecord};
}