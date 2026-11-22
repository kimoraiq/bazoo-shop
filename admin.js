export function createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon,confirmAction}){
const brandOpts=()=>state.brands.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
const catOpts=()=>state.categories.filter(x=>x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
function calculateDiscount(original,percent){
 const base=Number(original),pct=Number(percent);
 if(!Number.isSafeInteger(base)||base<0||base>2000000000||!Number.isInteger(pct)||pct<0||pct>99)return null;
 const finalPrice=Math.round(base*(100-pct)/100);
 if(pct>0&&(base<1||finalPrice<1||finalPrice>=base))return null;
 return {original:base,percentage:pct,price:finalPrice,saved:base-finalPrice};
}
function editor(p={}){
 const existing=state.productImages.filter(x=>x.product_id===p.id).sort((a,b)=>a.sort_order-b.sort_order);
 const specs=p.specifications&&typeof p.specifications==="object"?Object.entries(p.specifications).map(([a,b])=>a+": "+b).join("\n"):"";
 const hadDiscount=Number(p.compare_at_iqd)>Number(p.price_iqd);
 const original=hadDiscount?p.compare_at_iqd:(p.price_iqd??"");
 const percent=hadDiscount?Math.round((Number(p.compare_at_iqd)-Number(p.price_iqd))*100/Number(p.compare_at_iqd)):0;
 const standaloneOffer=p.on_sale&&!hadDiscount;
 const gallery=existing.length?'<div class="admin-gallery-grid">'+existing.map((x,i)=>'<div class="admin-gallery-photo"><img src="'+safeImg(x.image_url)+'" alt="'+esc(x.alt_text||p.name)+'"><div class="admin-gallery-actions"><button type="button" data-admin-cover="'+x.id+'" title="اجعلها الصورة الرئيسية">'+icon("star",15)+'</button><button type="button" data-admin-img-up="'+x.id+'" '+(i===0?"disabled":"")+' title="تقديم الصورة">'+icon("chevron-right",15)+'</button><button type="button" data-admin-img-delete="'+x.id+'" class="danger-action" title="حذف الصورة">'+icon("x",15)+'</button></div>'+(p.image_url===x.image_url?'<small class="cover-label">الرئيسية</small>':'')+'</div>').join("")+'</div>':'<p class="subtle">ماكو صور إضافية بعد. ارفع صور المنتج حتى تظهر بمعرض التفاصيل.</p>';
 return '<div class="card admin-editor"><div class="row"><div><div class="kicker">إدارة المنتجات</div><h2>'+(p.id?"تعديل المنتج":"منتج جديد")+'</h2></div><button id="cancelEdit" class="btn outline">'+icon("arrow-right",17)+' رجوع</button></div>'
 +'<form id="adminProductForm" class="formgrid" novalidate><input type="hidden" name="id" value="'+esc(p.id||"")+'">'
 +'<label class="formgroup fullspan">اسم المنتج *<input name="name" required minlength="2" maxlength="180" class="field" value="'+esc(p.name||"")+'"></label>'
 +'<label class="formgroup">القسم *<select name="category_id" class="field" required><option value="">اختر القسم</option>'+catOpts()+'</select></label>'
 +'<label class="formgroup">العلامة التجارية<select name="brand_id" class="field"><option value="">بدون علامة</option>'+brandOpts()+'</select></label>'
 +'<div class="discount-editor fullspan"><div class="discount-editor-title">'+icon("percent",19)+' <div><strong>السعر والخصم</strong><small>أدخل السعر الأصلي ونسبة الخصم، والسعر الجديد ينحسب تلقائياً.</small></div></div>'
 +'<div class="discount-fields">'
 +'<label class="formgroup">السعر الأصلي بالدينار *<input type="number" name="original_price_iqd" id="originalPriceInput" min="0" max="2000000000" step="1" required class="field" value="'+esc(original)+'" placeholder="مثلاً 100000"></label>'
 +'<label class="formgroup">نسبة الخصم %<input type="number" name="discount_percent" id="discountPercentInput" min="0" max="99" step="1" class="field" value="'+esc(percent)+'" placeholder="مثلاً 20"></label></div>'
 +'<div class="discount-preview" id="discountPreview" role="status" aria-live="polite"></div>'
 +'<p class="discount-helper">إذا تريد السعر بدون تخفيض، خلّي الخصم 0%. الخصم ينسحب تلقائياً على سعر المتجر والعربة والطلب.</p></div>'
 +'<label class="formgroup">المخزون *<input type="number" name="stock" min="0" step="1" required class="field" value="'+esc(p.stock??0)+'"></label>'
 +'<label class="formgroup">رمز المنتج SKU<input name="sku" class="field" value="'+esc(p.sku||"")+'"></label>'
 +'<label class="formgroup fullspan">وصف المنتج<textarea name="description" class="field" rows="4">'+esc(p.description||"")+'</textarea></label>'
 +'<label class="formgroup fullspan">المواصفات <span class="form-help">كل مواصفة بسطر، مثال: اللون: أسود</span><textarea name="specifications" class="field" rows="4" placeholder="اللون: أسود&#10;الموديل: ...">'+esc(specs)+'</textarea></label>'
 +'<div class="fullspan image-editor"><div class="image-editor-heading">'+icon("image",22)+' <div><h3>صور المنتج</h3><p>ارفع حتى 8 صور جديدة دفعة وحدة، وتگدر تغيّر الصورة الرئيسية وترتيب الصور.</p></div></div>'
 +(p.id?gallery:'<p class="subtle">صور المنتج تظهر هنا بعد حفظه أول مرة.</p>')
 +'<label class="formgroup">رفع صور متعددة JPG / PNG / WEBP — 5MB للصورة<input class="field" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple></label><div id="photoUploadPreview" class="photo-upload-preview"></div>'
 +'<label class="formgroup">رابط الصورة الرئيسية (اختياري)<input name="image_url" class="field" value="'+esc(p.image_url||"")+'" placeholder="https://..."></label></div>'
 +'<label class="formgroup">نوع المنتج<select name="is_demo" class="field"><option value="false">منتج قابل للطلب</option><option value="true">نموذج للعرض فقط</option></select></label>'
 +'<label class="formgroup">النشر<select name="active" class="field"><option value="true">منشور</option><option value="false">مخفي</option></select></label>'
 +'<label class="formgroup">منتج مميز<select name="featured" class="field"><option value="false">لا</option><option value="true">نعم</option></select></label>'
 +'<label class="formgroup">إظهار بصفحة العروض بدون خصم<select name="promoted_offer" class="field"><option value="false" '+(!standaloneOffer?'selected':'')+'>لا</option><option value="true" '+(standaloneOffer?'selected':'')+'>نعم</option></select></label>'
 +'<button type="submit" class="btn primary fullspan">'+icon("check",18)+' حفظ المنتج وصوره</button></form></div>';
}

const staffScopes=[
 ["products","إدارة المنتجات","إضافة وتعديل وحذف المنتجات والصور والمخزون"],
 ["orders","إدارة الطلبات","عرض طلبات الزبائن وتغيير حالتها"],
 ["shipping","إعدادات التوصيل","تعديل الأسعار والمحافظات المفعّلة"],
 ["promos","البنرات والعروض","إدارة الإعلانات والصور الترويجية"],
 ["categories","إدارة الفئات","إضافة الفئات وتعديلها وإخفاؤها"],
 ["brands","العلامات التجارية","التحكم بالعلامات داخل المتجر"]
];
function canAccess(scope){
 return state.admin&&(state.adminRole==="owner"||state.adminRole==="full"||state.adminPermissions?.[scope]===true);
}
function roleLabel(role){return role==="owner"?"المالك الرئيسي":role==="full"?"أدمن كامل":"أدمن محدود"}
async function membersPage(){
 if(state.adminRole!=="owner")return '<div class="notice">إدارة المدراء متاحة للمالك الرئيسي فقط.</div>';
 const {data,error}=await sb.from("admin_members").select("user_id,email,role,permissions,created_at").order("created_at",{ascending:true});
 if(error)return '<div class="notice">'+esc("تعذّر تحميل حسابات الإدارة: "+error.message)+'</div>';
 state.staffMembers=data||[];
 return '<section class="staff-panel"><div class="staff-panel-head"><div><h2>المدراء والصلاحيات</h2><p>أضف أدمن كامل أو محدود، وحدد شنو يگدر يسوي داخل بازو. الحساب لازم يكون مسجل ومفعّل بالبريد أولاً.</p></div><button type="button" class="btn primary" id="addStaffMember">'+icon("user-plus",18)+' إضافة أدمن</button></div>'
 +'<div class="staff-cards">'+state.staffMembers.map(member=>{
    const owner=member.role==="owner";
    const email=member.email||(owner?state.user.email:"بريد غير مسجل");
    const granted=member.role==="limited"?staffScopes.filter(([key])=>member.permissions?.[key]===true).map(x=>x[1]):[];
    return '<article class="staff-card"><div class="staff-card-main"><span class="staff-avatar">'+icon(owner?"shield-check":"user-round",24)+'</span><div class="staff-info"><strong>'+esc(email)+'</strong><span class="staff-role '+(owner?"owner-role":"")+'">'+esc(roleLabel(member.role))+'</span></div></div>'
    +(member.role==="limited"?'<p class="staff-grants">'+(granted.length?granted.map(x=>'<span>'+esc(x)+'</span>').join(""):"بدون مهام")+'</p>':'<p class="staff-grants">'+(owner?"التحكم الكامل بالمتجر وبحسابات الإدارة":"إدارة كل أقسام المتجر، بدون صلاحية إضافة مدراء")+'</p>')
    +(!owner?'<div class="staff-actions"><button type="button" class="btn outline" data-staff-edit="'+member.user_id+'">'+icon("settings",16)+' تعديل الصلاحيات</button><button type="button" class="btn danger" data-staff-remove="'+member.user_id+'">'+icon("x",16)+' إزالة الأدمن</button></div>':'<div class="staff-owner-note">'+icon("shield-check",16)+' الحساب محمي ولا يمكن حذفه من هنا</div>')
    +'</article>';
 }).join("")+'</div></section>';
}
function memberEditor(id){
 if(state.adminRole!=="owner")return;
 const member=(state.staffMembers||[]).find(x=>x.user_id===id);
 if(member?.role==="owner")return notify("لا يمكن تعديل حساب المالك الرئيسي");
 const role=member?.role||"limited";
 const scopeChecks=staffScopes.map(([key,name,description])=>'<label class="staff-scope"><input type="checkbox" name="'+key+'" '+(member?.permissions?.[key]===true?"checked":"")+'><span class="staff-scope-title">'+icon("check-circle",17)+' '+name+'</span><small>'+description+'</small></label>').join("");
 const form='<form id="adminMemberForm" class="staff-editor-form" novalidate>'
 +'<label class="formgroup">بريد الأدمن المسجّل *<input name="email" type="email" class="field" required value="'+esc(member?.email||"")+'" '+(member?"readonly":"")+' placeholder="name@example.com"></label>'
 +'<p class="staff-note">لا تطلب كلمة مرور الموظف. خلي الشخص يسجّل حسابه بنفسه ويتأكد من بريده، وبعدها تگدر تعطيه الصلاحية.</p>'
 +'<label class="formgroup">نوع الحساب<select class="field" name="role" id="staffRoleSelect"><option value="limited" '+(role==="limited"?"selected":"")+'>أدمن محدود</option><option value="full" '+(role==="full"?"selected":"")+'>أدمن كامل</option></select></label>'
 +'<div id="staffScopeFields" '+(role==="full"?'hidden':'')+'><p class="staff-scopes-title">حدد صلاحيات الأدمن المحدود</p><div class="staff-scopes">'+scopeChecks+'</div></div>'
 +'<p class="staff-note">الأدمن الكامل يگدر يدير المتجر كله، لكنه ما يگدر يضيف مدراء أو يغيّر صلاحياتهم. هاي الصلاحية محفوظة للمالك فقط.</p>'
 +'<button type="submit" class="btn primary staff-save">'+icon("check",18)+' '+(member?"حفظ التعديلات":"إضافة الأدمن")+'</button></form>';
 openModal(member?"تعديل صلاحيات الأدمن":"إضافة أدمن جديد",form);
 const roleInput=document.querySelector("#staffRoleSelect"),fields=document.querySelector("#staffScopeFields");
 if(roleInput&&fields)roleInput.onchange=()=>{fields.hidden=roleInput.value==="full"};
}
async function saveMember(form){
 if(state.adminRole!=="owner")return notify("هذه العملية للمالك الرئيسي فقط");
 const data=new FormData(form),email=String(data.get("email")||"").trim().toLowerCase(),role=String(data.get("role")||"limited");
 const permissions=Object.fromEntries(staffScopes.map(([key])=>[key,data.has(key)]));
 if(role==="limited"&&!Object.values(permissions).some(Boolean))return notify("حدد صلاحية واحدة على الأقل للأدمن المحدود");
 const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  const {error}=await sb.rpc("admin_grant_member",{p_email:email,p_role:role,p_permissions:permissions});
  if(error)return notify("تعذّر إضافة الأدمن: "+error.message);
  closeModal();notify("تم حفظ الحساب والصلاحيات بنجاح");await render();
 }catch(e){notify("تعذّر حفظ الصلاحيات: "+e.message)}
 finally{submit.disabled=false}
}
async function revokeMember(id){
 if(state.adminRole!=="owner")return;
 const member=(state.staffMembers||[]).find(x=>x.user_id===id);
 if(!member||member.role==="owner")return;
 confirmAction("إزالة صلاحيات الأدمن","راح يرجع هذا الحساب زبون عادي فوراً. ما راح تنحذف بيانات حسابه أو طلباته.",async()=>{
  const {error}=await sb.rpc("admin_revoke_member",{p_user_id:id});
  if(error){notify("تعذّرت إزالة الصلاحية: "+error.message);return false}
  notify("تمت إزالة صلاحيات الأدمن");await render();return true;
 });
}
async function adminPage(){
const visibleTabs=[["products","المنتجات"],["orders","الطلبات"],["shipping","التوصيل"],["promos","الإعلانات"],["categories","الفئات"],["brands","العلامات التجارية"]].filter(([key])=>canAccess(key));
if(state.adminRole==="owner")visibleTabs.push(["members","المدراء والصلاحيات"]);
if(!visibleTabs.some(([key])=>key===state.adminTab))state.adminTab=visibleTabs[0]?.[0]||"products";
const tabs=visibleTabs.map(([key,title])=>'<button data-admin-tab="'+key+'" class="'+(state.adminTab===key?"active":"")+'">'+esc(title)+'</button>').join("");
let body="";
if(state.adminTab==="members")body=await membersPage();
if(state.adminTab==="products"){
if(state.editProduct){let p=state.products.find(x=>x.id===state.editProduct)||{};body=editor(p)}
else body='<button class="btn primary" id="newProduct" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> منتج جديد</button><div class="card admin-table"><table><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.products.map(p=>'<tr><td>'+esc(p.name)+'</td><td><div class="admin-price-cell"><strong>'+money(p.price_iqd)+'</strong>'+(p.compare_at_iqd>p.price_iqd?'<del>'+money(p.compare_at_iqd)+'</del><span class="admin-discount-cell">-'+Math.round((p.compare_at_iqd-p.price_iqd)*100/p.compare_at_iqd)+'%</span>':'')+'</div></td><td>'+p.stock+'</td><td>'+(p.is_demo?"تجريبي / ":"")+(p.active?"منشور":"مخفي")+'</td><td><button data-edit-product="'+p.id+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#settings"></use></svg> تعديل</button><button data-toggle-product="'+p.id+'">'+(p.active?"إخفاء":"نشر")+'</button><button class="danger-action" data-delete-product="'+p.id+'">حذف</button></td></tr>').join("")||'<tr><td colspan="5">لا توجد منتجات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="orders"){
const {data,error}=await sb.from("orders").select("id,created_at,customer_name,phone,governorate,address,note,payment_method,total_iqd,status,order_items(product_name,quantity)").order("created_at",{ascending:false}).limit(150);
body=error?'<p class="error">'+esc(error.message)+'</p>':'<div class="card admin-table"><table><thead><tr><th>الطلب</th><th>الزبون</th><th>العنوان</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>'+((data||[]).map(o=>'<tr><td>'+esc(o.id.slice(0,8))+'<br>'+new Date(o.created_at).toLocaleDateString("ar-IQ")+'</td><td>'+esc(o.customer_name)+'<br>'+esc(o.phone)+'</td><td>'+esc(o.governorate)+'<br>'+esc(o.address)+'<br>'+esc(o.note)+'</td><td>'+o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join("<br>")+'</td><td>'+money(o.total_iqd)+'</td><td><select class="field" data-status="'+o.id+'">'+[["new","جديد"],["confirmed","تم التأكيد"],["packing","تجهيز"],["shipped","بالطريق"],["delivered","مسلّم"],["cancelled","ملغي"]].map(([k,v])=>'<option value="'+k+'" '+(o.status===k?"selected":"")+'>'+v+'</option>').join("")+'</select></td></tr>').join("")||'<tr><td colspan="6">لا توجد طلبات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="shipping")body='<div class="card"><p class="subtle">كل المحافظات معطلة مبدئياً، حدّد السعر الصحيح وفعّل التوصيل.</p><div class="admin-table"><table><thead><tr><th>المحافظة</th><th>التوصيل د.ع</th><th>مفعّل</th><th>حفظ</th></tr></thead><tbody>'+state.rates.map(r=>'<tr><td>'+esc(r.governorate)+'</td><td><input class="field" type="number" min="0" step="1" id="rate-'+esc(r.governorate)+'" value="'+r.price_iqd+'"></td><td><input type="checkbox" id="enabled-'+esc(r.governorate)+'" '+(r.enabled?"checked":"")+'></td><td><button data-rate="'+esc(r.governorate)+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#check"></use></svg> حفظ</button></td></tr>').join("")+'</tbody></table></div></div>';
if(state.adminTab==="categories"||state.adminTab==="brands"){
 const table=state.adminTab,rows=table==="categories"?state.categories:state.brands;
 const type=table==="categories"?"فئة":"علامة تجارية";
 body='<div class="row" style="margin-bottom:16px"><p class="subtle">تقدر تتحكم بالإضافة والتعديل والإخفاء والحذف، والتغييرات تنعكس على المتجر.</p><button class="btn primary" data-new-taxonomy="'+table+'">'+icon("plus",18)+' إضافة '+type+'</button></div><div class="card admin-table"><table><thead><tr><th>الاسم</th><th>المعرّف</th><th>الحالة</th><th>الإدارة</th></tr></thead><tbody>'+rows.map(item=>'<tr><td>'+esc(item.name)+'</td><td>'+esc(item.slug)+'</td><td>'+(item.active?"ظاهر":"مخفي")+'</td><td><button data-edit-taxonomy="'+table+'" data-record-id="'+item.id+'">تعديل</button><button data-toggle-taxonomy="'+table+'" data-record-id="'+item.id+'">'+(item.active?"إخفاء":"إظهار")+'</button><button class="danger-action" data-delete-taxonomy="'+table+'" data-record-id="'+item.id+'">حذف</button></td></tr>').join("")+'</tbody></table></div>';
}
if(state.adminTab==="promos")body='<button id="newPromo" class="btn primary" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> إعلان جديد</button><div class="card admin-table"><table><thead><tr><th>الإعلان</th><th>المكان</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.promos.map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc(p.placement)+'</td><td>'+(p.active?"نشط":"مخفي")+'</td><td><button data-edit-promo="'+p.id+'">تعديل</button><button data-toggle-promo="'+p.id+'">'+(p.active?"إخفاء":"نشر")+'</button><button class="danger-action" data-delete-promo="'+p.id+'">حذف</button></td></tr>').join("")||'<tr><td colspan="4">لا توجد إعلانات</td></tr>')+'</tbody></table></div>';
return '<div class="page"><div class="row"><div><h1>لوحة إدارة BAZOO</h1><p class="admin-role-caption">'+esc(roleLabel(state.adminRole))+'</p></div><button class="btn outline" data-go="home"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#home"></use></svg> المتجر</button></div><div class="adminnav">'+tabs+'</div>'+body+'</div>';
}
function bindAdmin(){
const addMember=document.querySelector("#addStaffMember");if(addMember)addMember.onclick=()=>memberEditor();
document.querySelectorAll("[data-staff-edit]").forEach(b=>b.onclick=()=>memberEditor(b.dataset.staffEdit));
document.querySelectorAll("[data-staff-remove]").forEach(b=>b.onclick=()=>revokeMember(b.dataset.staffRemove));
const cancel=document.querySelector("#cancelEdit");if(cancel)cancel.onclick=()=>{state.editProduct=null;render()};
document.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=()=>removeRecord("products",b.dataset.deleteProduct,"المنتج"));
document.querySelectorAll("[data-delete-promo]").forEach(b=>b.onclick=()=>removeRecord("promotions",b.dataset.deletePromo,"الإعلان"));
document.querySelectorAll("[data-toggle-product]").forEach(b=>b.onclick=()=>toggleRecord("products",b.dataset.toggleProduct));
document.querySelectorAll("[data-toggle-promo]").forEach(b=>b.onclick=()=>toggleRecord("promotions",b.dataset.togglePromo));
document.querySelectorAll("[data-new-taxonomy]").forEach(b=>b.onclick=()=>showTaxonomyEditor(b.dataset.newTaxonomy));
document.querySelectorAll("[data-edit-taxonomy]").forEach(b=>b.onclick=()=>showTaxonomyEditor(b.dataset.editTaxonomy,b.dataset.recordId));
document.querySelectorAll("[data-toggle-taxonomy]").forEach(b=>b.onclick=()=>toggleRecord(b.dataset.toggleTaxonomy,b.dataset.recordId));
document.querySelectorAll("[data-delete-taxonomy]").forEach(b=>b.onclick=()=>removeRecord(b.dataset.deleteTaxonomy,b.dataset.recordId,b.dataset.deleteTaxonomy==="categories"?"الفئة":"العلامة التجارية"));

const imageById=id=>state.productImages.find(x=>x.id===id);
document.querySelectorAll("[data-admin-cover]").forEach(btn=>btn.onclick=async()=>{
 const img=imageById(btn.dataset.adminCover);if(!img)return;
 const {error}=await sb.from("products").update({image_url:img.image_url}).eq("id",img.product_id);
 if(error)return notify("تعذّر تغيير الصورة الرئيسية: "+error.message);
 await loadCatalog();notify("تم اختيار الصورة الرئيسية");render();
});
document.querySelectorAll("[data-admin-img-delete]").forEach(btn=>btn.onclick=()=>{
 const img=imageById(btn.dataset.adminImgDelete);if(!img)return;
 confirmAction("حذف صورة المنتج","تنحذف هذه الصورة من معرض المنتج ولا يمكن التراجع عن الحذف.",async()=>{
  const p=state.products.find(x=>x.id===img.product_id);
  const left=state.productImages.filter(x=>x.product_id===img.product_id&&x.id!==img.id).sort((a,b)=>a.sort_order-b.sort_order);
  if(p?.image_url===img.image_url){
   const {error}=await sb.from("products").update({image_url:left[0]?.image_url||null}).eq("id",img.product_id);
   if(error){notify(error.message);return false}
  }
  const {error}=await sb.from("product_images").delete().eq("id",img.id);
  if(error){notify(error.message);return false}
  await loadCatalog();notify("تم حذف الصورة من المعرض");render();return true;
 });
});
document.querySelectorAll("[data-admin-img-up]").forEach(btn=>btn.onclick=async()=>{
 const img=imageById(btn.dataset.adminImgUp);if(!img)return;
 const list=state.productImages.filter(x=>x.product_id===img.product_id).sort((a,b)=>a.sort_order-b.sort_order);
 const i=list.findIndex(x=>x.id===img.id);if(i<1)return;
 const prev=list[i-1];
 const first=await sb.from("product_images").update({sort_order:prev.sort_order}).eq("id",img.id);
 const second=await sb.from("product_images").update({sort_order:img.sort_order}).eq("id",prev.id);
 if(first.error||second.error)return notify("تعذّر إعادة ترتيب الصور");
 await loadCatalog();notify("تم تغيير ترتيب الصور");render();
});
const f=document.querySelector("#adminProductForm");if(f){
const p=state.products.find(x=>x.id===state.editProduct);
if(p)for(const key of ["category_id","brand_id","active","featured","is_demo"]){if(f.elements[key])f.elements[key].value=String(p[key]??"")}
 const originalInput=f.elements.original_price_iqd,discountInput=f.elements.discount_percent,previewRoot=f.querySelector("#discountPreview");
 const updateDiscountPreview=()=>{
  if(!previewRoot)return;
  if(!originalInput.value.trim()){previewRoot.innerHTML='<span class="discount-preview-empty">اكتب السعر الأصلي حتى تشوف سعر البيع النهائي.</span>';return}
  const calculated=calculateDiscount(originalInput.value,discountInput.value||0);
  if(!calculated){previewRoot.innerHTML='<span class="discount-preview-error">راجع السعر ونسبة الخصم. الخصم لازم يكون من 0 إلى 99% والسعر النهائي أكبر من صفر.</span>';return}
  previewRoot.innerHTML='<div class="discount-preview-prices"><span>سعر البيع بعد الخصم</span><strong>'+money(calculated.price)+'</strong></div>'
    +(calculated.percentage?'<div class="discount-preview-saving"><del>'+money(calculated.original)+'</del><span class="discount-preview-tag">خصم '+calculated.percentage+'%</span><small>وفّر '+money(calculated.saved)+'</small></div>':'<small>ماكو خصم على هذا المنتج</small>');
 };
 originalInput.addEventListener("input",updateDiscountPreview);
 discountInput.addEventListener("input",updateDiscountPreview);
 updateDiscountPreview();
 const uploader=f.elements.photos;
 if(uploader)uploader.addEventListener("change",()=>{
  const root=document.querySelector("#photoUploadPreview");if(!root)return;
  root.innerHTML="";
  Array.from(uploader.files||[]).slice(0,8).forEach(file=>{
   const url=URL.createObjectURL(file),wrap=document.createElement("div"),img=document.createElement("img");
   img.src=url;img.alt=file.name;img.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
   wrap.append(img);root.append(wrap);
  });
 });
}
document.querySelectorAll("[data-status]").forEach(el=>el.onchange=async()=>{const {error}=await sb.from("orders").update({status:el.value}).eq("id",el.dataset.status);notify(error?error.message:"تم تحديث حالة الطلب ")});
document.querySelectorAll("[data-rate]").forEach(el=>el.onclick=async()=>{const g=el.dataset.rate;const price=Number(document.getElementById("rate-"+g).value),enabled=document.getElementById("enabled-"+g).checked;if(!Number.isSafeInteger(price)||price<0)return notify("السعر غير صحيح");const {error}=await sb.from("shipping_rates").update({price_iqd:price,enabled}).eq("governorate",g);if(error)return notify(error.message);await loadCatalog();notify("تم تحديث التوصيل ");render()});
}
async function saveProduct(form){
 const f=new FormData(form),id=String(f.get("id")||"");
 const priceInfo=calculateDiscount(f.get("original_price_iqd"),f.get("discount_percent")||0);
 if(!priceInfo)return notify("تحقق من السعر الأصلي ونسبة الخصم. لازم السعر النهائي يكون أكبر من صفر والتخفيض بين 0 و99%.");
 const specs={};
 for(const line of String(f.get("specifications")||"").split("\n")){
  const i=line.indexOf(":");if(i<1)continue;
  const key=line.slice(0,i).trim(),value=line.slice(i+1).trim();
  if(key&&value)specs[key.slice(0,90)]=value.slice(0,300);
 }
 const v={name:String(f.get("name")).trim(),category_id:Number(f.get("category_id")),
  brand_id:f.get("brand_id")?Number(f.get("brand_id")):null,
  price_iqd:priceInfo.price,compare_at_iqd:priceInfo.percentage>0?priceInfo.original:null,
  stock:Number(f.get("stock")),sku:String(f.get("sku")||"").trim()||null,
  description:String(f.get("description")||""),specifications:specs,
  image_url:String(f.get("image_url")||"").trim()||null,
  active:f.get("active")==="true",featured:f.get("featured")==="true",
  on_sale:priceInfo.percentage>0||f.get("promoted_offer")==="true",is_demo:f.get("is_demo")==="true"};
 if(!v.category_id||!Number.isSafeInteger(v.price_iqd)||!Number.isSafeInteger(v.stock)||v.price_iqd<0||v.stock<0)return notify("تحقق من بيانات المنتج");
 if(v.image_url&&!/^https:\/\//.test(v.image_url))return notify("رابط الصورة لازم يكون HTTPS");
 const photos=Array.from(form.elements.photos.files||[]);
 if(photos.length>8)return notify("حد أقصى 8 صور في كل رفع");
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const uploaded=[];
  for(let i=0;i<photos.length;i++){
   const file=photos[i];
   if(file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("صيغة الصورة غير مدعومة أو حجمها أكبر من 5MB");
   btn.textContent="جاري رفع صورة "+(i+1)+" من "+photos.length;
   const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
   const path="products/"+crypto.randomUUID()+"."+ext;
   const res=await sb.storage.from("product-images").upload(path,file,{contentType:file.type});
   if(res.error)throw Error(res.error.message);
   uploaded.push(sb.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  }
  if(!v.image_url&&uploaded.length)v.image_url=uploaded[0];
  const saved=id?await sb.from("products").update(v).eq("id",id).select("*").single()
    :await sb.from("products").insert(v).select("*").single();
  if(saved.error)throw Error(saved.error.message);
  const record=saved.data;const gallery=state.productImages.filter(x=>x.product_id===record.id);
  if(uploaded.length){
   const maxOrder=gallery.reduce((n,p)=>Math.max(n,p.sort_order),-1);
   const rows=uploaded.map((url,i)=>({product_id:record.id,image_url:url,alt_text:v.name,sort_order:maxOrder+i+1}));
   const res=await sb.from("product_images").insert(rows);
   if(res.error)throw Error("تم حفظ المنتج لكن تعذّر تسجيل بعض الصور: "+res.error.message);
  }else if(!gallery.length&&v.image_url){
   const res=await sb.from("product_images").insert({product_id:record.id,image_url:v.image_url,alt_text:v.name,sort_order:0});
   if(res.error)throw Error(res.error.message);
  }
  await loadCatalog();state.editProduct=null;notify("تم حفظ المنتج ومعرض الصور");render();
 }catch(e){notify("تعذّر الحفظ: "+e.message);await loadCatalog();}
 finally{btn.disabled=false;btn.innerHTML=icon("check",18)+" حفظ المنتج وصوره";}
}
function showPromoEditor(id){
 const p=state.promos.find(x=>x.id===id)||{};
 const desk=safeImg(p.desktop_image_url||p.image_url),mobile=safeImg(p.mobile_image_url||p.desktop_image_url||p.image_url);
 const preview=(name,label,dimensions,src)=>'<label class="banner-upload-box '+name+'"><span class="banner-upload-header">'+icon("image",17)+' '+label+' <small>'+dimensions+'</small></span><span class="banner-preview '+name+'-preview" id="preview-'+name+'">'+(src?'<img src="'+src+'" alt="معاينة البنر">':icon("image",32))+'</span><span class="banner-upload-guide">تُكيّف الصورة للمقاس الثابت مع الحفاظ على جميع تفاصيل التصميم.</span><input class="field" type="file" accept="image/png,image/jpeg,image/webp" name="photo_'+name+'"></label>';
 openModal(p.id?"تعديل البنر":"إضافة بنر",'<form id="adminPromoForm" class="stack banner-editor" novalidate>'
  +'<input type="hidden" name="id" value="'+esc(p.id||"")+'">'
  +'<label class="formgroup">عنوان البنر *<input name="title" class="field" required maxlength="90" value="'+esc(p.title||"")+'"></label>'
  +'<label class="formgroup">النص التوضيحي<input name="subtitle" class="field" maxlength="170" value="'+esc(p.subtitle||"")+'"></label>'
  +'<label class="formgroup">نمط العرض<select name="artwork_only" class="field"><option value="true" '+(p.artwork_only!==false?"selected":"")+'>تصميم إعلان جاهز (الصورة تحتوي النصوص والمنتجات)</option><option value="false" '+(p.artwork_only===false?"selected":"")+'>صورة مع عنوان وزر من الموقع</option></select></label>'
  +'<label class="formgroup">منتج مرتبط بالبنر (اختياري)<select class="field" name="product_id"><option value="">بنر عام بدون منتج</option>'+state.products.filter(x=>x.active).map(x=>'<option value="'+x.id+'" '+(p.product_id===x.id?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'
  +'<div class="banner-upload-grid">'+preview("desktop","صورة اللابتوب","1440 × 480",desk)+preview("mobile","صورة الموبايل","720 × 900",mobile)+'</div>'
  +'<p class="note">ارفع البنر المصمّم النهائي من فريق التصميم، بنسختين منفصلتين. يتم الحفاظ على محتوى الصورة بالكامل داخل القياس الثابت، بدون اقتطاع النصوص أو المنتجات.</p>'
  +'<label class="formgroup">رابط داخل المتجر<select name="link_url" class="field">'+[["#/categories","كل المنتجات"],["#/offers","العروض"],["#/home","الرئيسية"],["#/cart","العربة"]].map(([v,l])=>'<option value="'+v+'" '+((p.link_url||"#/categories")===v?"selected":"")+'>'+l+'</option>').join("")+'</select></label>'
  +'<div class="formgrid"><label class="formgroup">مكان الظهور<select name="placement" class="field">'+[["home","الرئيسية"],["categories","الفئات"],["cart","العربة"]].map(([v,l])=>'<option value="'+v+'" '+((p.placement||"home")===v?"selected":"")+'>'+l+'</option>').join("")+'</select></label>'
  +'<label class="formgroup">ترتيب العرض<input type="number" name="sort_order" min="0" max="9999" class="field" value="'+esc(p.sort_order??0)+'"></label>'
  +'<label class="formgroup">الظهور<select name="active" class="field"><option value="true" '+(p.active!==false?"selected":"")+'>منشور</option><option value="false" '+(p.active===false?"selected":"")+'>مخفي</option></select></label>'
  +'<label class="formgroup">نوع البنر<select name="is_demo" class="field"><option value="false" '+(!p.is_demo?"selected":"")+'>حقيقي</option><option value="true" '+(p.is_demo?"selected":"")+'>تجريبي</option></select></label></div>'
  +'<button class="btn primary" type="submit">'+icon("upload",17)+' حفظ ونشر البنر</button></form>');
 const f=document.querySelector("#adminPromoForm");
 for(const type of ["desktop","mobile"]){
  const input=f.elements["photo_"+type];
  input.addEventListener("change",()=>{
   const file=input.files?.[0],preview=document.getElementById("preview-"+type);
   if(!file)return;
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)){notify("صيغة الصورة غير مدعومة");input.value="";return}
   const url=URL.createObjectURL(file);
   preview.innerHTML='<img alt="معاينة البنر" src="'+url+'">';
   preview.querySelector("img").addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
  });
 }
}
async function cropBanner(file,width,height){
 if(!file?.size)return null;
 if(file.size>15*1024*1024)throw Error("الصورة أكبر من 15MB");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("يُقبل JPG وPNG وWEBP فقط");
 const objectUrl=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{
   const image=new Image();
   image.onload=()=>resolve(image);image.onerror=()=>reject(Error("تعذّر قراءة الصورة"));
   image.src=objectUrl;
  });
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("المتصفح لا يدعم تجهيز الصور");
  ctx.fillStyle="#42168f";ctx.fillRect(0,0,width,height);
  const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);
  const drawW=img.naturalWidth*scale,drawH=img.naturalHeight*scale;
  ctx.drawImage(img,(width-drawW)/2,(height-drawH)/2,drawW,drawH);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error("تعذّر حفظ الصورة")),"image/jpeg",.88));
 }finally{URL.revokeObjectURL(objectUrl)}
}
async function uploadBannerPhoto(file,type){
 if(!file?.size)return null;
 const dims=type==="desktop"?[1440,480]:[720,900];
 const blob=await cropBanner(file,...dims);
 const name="promotions/"+type+"/"+crypto.randomUUID()+".jpg";
 const {error}=await sb.storage.from("product-images").upload(name,blob,{contentType:"image/jpeg"});
 if(error)throw Error(error.message);
 return sb.storage.from("product-images").getPublicUrl(name).data.publicUrl;
}
async function savePromo(form){
 const f=new FormData(form),id=f.get("id");
 const v={title:String(f.get("title")||"").trim(),subtitle:String(f.get("subtitle")||"").trim(),
  placement:String(f.get("placement")),link_url:String(f.get("link_url")),product_id:f.get("product_id")?String(f.get("product_id")):null,artwork_only:f.get("artwork_only")==="true",active:f.get("active")==="true",
  is_demo:f.get("is_demo")==="true",sort_order:Number(f.get("sort_order")||0)};
 if(!v.title){notify("اكتب عنوان البنر");return}
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 button.textContent="جاري تجهيز صور البنر...";
 try{
  const desktop=await uploadBannerPhoto(f.get("photo_desktop"),"desktop");
  const mobile=await uploadBannerPhoto(f.get("photo_mobile"),"mobile");
  const previous=state.promos.find(p=>p.id===id);
  v.desktop_image_url=desktop||previous?.desktop_image_url||previous?.image_url||null;
  v.mobile_image_url=mobile||previous?.mobile_image_url||previous?.desktop_image_url||previous?.image_url||null;
  v.image_url=v.desktop_image_url;
  if(v.placement==="home"&&!v.desktop_image_url&&!state.products.some(p=>p.id===v.product_id&&p.image_url)){notify("ارفع صورة اللابتوب أو اربط البنر بمنتج له صورة");return}
  const result=id?await sb.from("promotions").update(v).eq("id",id):await sb.from("promotions").insert(v);
  if(result.error)throw Error(result.error.message);
  closeModal();await loadCatalog();notify("تم حفظ البنر للموبايل واللابتوب");render();
 }catch(e){notify("تعذّر حفظ البنر: "+e.message)}
 finally{button.disabled=false;button.innerHTML=icon("upload",17)+" حفظ ونشر البنر"}
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

function showTaxonomyEditor(table,id){
 if(!["categories","brands"].includes(table))return;
 const cat=table==="categories";
 const rows=cat?state.categories:state.brands;
 const obj=rows.find(x=>String(x.id)===String(id))||{};
 const groups=cat?'<label class="formgroup">تابعة لقسم<select class="field" name="parent_id"><option value="">فئة رئيسية</option>'+rows.filter(x=>!x.parent_id&&x.id!==obj.id).map(x=>'<option value="'+x.id+'" '+(String(obj.parent_id)===String(x.id)?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label><label class="formgroup">الترتيب<input class="field" type="number" name="sort_order" min="0" max="9999" value="'+esc(obj.sort_order??0)+'"></label>':"";
 openModal(obj.id?"تعديل":"إضافة",'<form class="stack" id="adminTaxonomyForm"><input type="hidden" name="table" value="'+table+'"><input type="hidden" name="id" value="'+esc(obj.id||"")+'"><label class="formgroup">الاسم *<input name="name" class="field" minlength="2" maxlength="100" required value="'+esc(obj.name||"")+'"></label><label class="formgroup">معرّف بالإنجليزي (اختياري عند الإضافة)<input name="slug" class="field" pattern="[a-z0-9-]+" value="'+esc(obj.slug||"")+'"></label>'+groups+'<label class="formgroup">الظهور<select class="field" name="active"><option value="true" '+(obj.active!==false?"selected":"")+'>ظاهر</option><option value="false" '+(obj.active===false?"selected":"")+'>مخفي</option></select></label><button type="submit" class="btn primary">'+icon("check",17)+' حفظ</button></form>');
}
async function saveTaxonomy(form){
 const f=new FormData(form),table=String(f.get("table")),id=f.get("id");
 if(!["categories","brands"].includes(table))return;
 const name=String(f.get("name")||"").trim();
 const slug=String(f.get("slug")||"").trim()||("bazoo-"+(table==="brands"?"brand":"cat")+"-"+Date.now());
 if(name.length<2||!(/^[a-z0-9-]+$/.test(slug))){notify("الاسم غير صحيح أو المعرّف يحتوي رموز غير مسموحة");return}
 const data={name,slug,active:f.get("active")==="true"};
 if(table==="categories"){data.parent_id=f.get("parent_id")?Number(f.get("parent_id")):null;data.sort_order=Number(f.get("sort_order")||0);}
 const result=id?await sb.from(table).update(data).eq("id",id):await sb.from(table).insert(data);
 if(result.error){notify("تعذّر الحفظ: "+result.error.message);return}
 closeModal();await loadCatalog();notify("تم الحفظ وتحديث المتجر");render();
}
return {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo,saveTaxonomy,saveMember,toggleRecord,removeRecord};
}