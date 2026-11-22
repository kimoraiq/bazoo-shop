/* BAZOO administration rebuild v1: isolated, permission checked, single-submit, read-after-write. */
import { createClient } from "./client.js";
const db=createClient("https://kgghxcxaqmuypcdwubhr.supabase.co","sb_publishable_TZKy9nGrNFu1KqZqBpsw3Q_x17cq1qy");
const byId=id=>document.getElementById(id);
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("en-US").format(Number(n)||0)+" د.ع";
const safeUrl=url=>/^https:\/\//i.test(String(url||""))?html(url):"";
const SCOPE={products:"المنتجات",orders:"الطلبات",shipping:"التوصيل",promos:"الإعلانات",categories:"الفئات",brands:"العلامات التجارية",members:"المسؤولون"};
const ICON={products:"▦",orders:"▤",shipping:"▣",promos:"✦",categories:"▧",brands:"◈",members:"♙"};
const STATUS={new:"جديد",confirmed:"تم التأكيد",packing:"قيد التجهيز",shipped:"قيد التوصيل",delivered:"تم التسليم",cancelled:"ملغي"};
const state={user:null,role:null,permissions:{},tab:"products",records:{},busy:false,loading:false,adminVerified:false,draftKey:""};
let bootPromise=null;
function alertUser(message,type="error"){
 const node=byId("alert");node.textContent=String(message);node.className="alert "+type;node.hidden=false;
 node.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function clearAlert(){byId("alert").hidden=true}
function can(scope){return !!state.user&&(state.role==="owner"||state.role==="full"||state.permissions[scope]===true)}
function tabKeys(){return Object.keys(SCOPE).filter(key=>key==="members"?state.role==="owner":can(key))}
function renderNav(){
 const nav=byId("nav");const tabs=tabKeys();
 if(!tabs.includes(state.tab))state.tab=tabs[0]||"products";
 nav.innerHTML=tabs.map(key=>'<button type="button" class="nav-button '+(state.tab===key?"active":"")+'" data-tab="'+key+'"><span class="nav-icon">'+ICON[key]+'</span>'+SCOPE[key]+'</button>').join("");
 byId("userLabel").textContent=state.user?.email||"غير مسجّل";
 byId("signOut").hidden=!state.user;
}
function title(text){byId("pageTitle").textContent=text}
function field(label,name,value="",attrs="",extra=""){
 return '<label class="field">'+html(label)+'<input class="input" name="'+name+'" value="'+html(value)+'" '+attrs+'>'+extra+'</label>';
}
function selectField(label,name,opts,current,attrs=""){
 return '<label class="field">'+html(label)+'<select class="input" name="'+name+'" '+attrs+'>'+opts.map(x=>'<option value="'+html(x[0])+'" '+(String(current??"")===String(x[0])?"selected":"")+'>'+html(x[1])+'</option>').join("")+'</select></label>';
}
function textField(label,name,value="",rows=3){return '<label class="field full">'+html(label)+'<textarea class="input" name="'+name+'" rows="'+rows+'">'+html(value)+'</textarea></label>'}
function formFooter(label="حفظ التعديلات"){
 return '<div class="form-actions full"><button type="submit" class="button">'+label+'</button><button type="button" class="button secondary" data-action="close">إلغاء</button></div>';
}
function booleanSelect(label,name,value=true){return selectField(label,name,[["true","نعم"],["false","لا"]],Boolean(value)?"true":"false")}
function makeForm(id,contents){return '<form id="'+id+'" class="form-grid" novalidate>'+contents+'</form>'}
function openDialog(heading,body,draftId=null){
 byId("dialogTitle").textContent=heading;byId("dialogBody").innerHTML=body;
 byId("overlay").hidden=false;
 document.body.style.overflow="hidden";
 state.draftKey=draftId&&state.user?"bazoo-manage-draft:"+state.user.id+":"+draftId:"";
 if(state.draftKey)restoreDraft();
 const first=byId("dialogBody").querySelector('input:not([type="hidden"]),select,textarea');
 if(first)first.focus({preventScroll:true});
}
function closeDialog(){
 byId("overlay").hidden=true;byId("dialogBody").innerHTML="";document.body.style.overflow="";state.draftKey="";
}
function saveDraft(){
 if(!state.draftKey)return;
 const form=byId("dialogBody").querySelector("form");if(!form)return;
 try{
  const fields={};
  for(const el of form.querySelectorAll("input,select,textarea")){
   if(!el.name||["hidden","file","password"].includes(el.type))continue;
   fields[el.name]=el.type==="checkbox"?el.checked:el.value;
  }
  sessionStorage.setItem(state.draftKey,JSON.stringify(fields));
 }catch(e){}
}
function restoreDraft(){
 try{
  const raw=sessionStorage.getItem(state.draftKey);if(!raw)return;
  const fields=JSON.parse(raw);
  const form=byId("dialogBody").querySelector("form");if(!form)return;
  for(const el of form.querySelectorAll("input,select,textarea")){
   if(!el.name||["hidden","file","password"].includes(el.type)||!Object.prototype.hasOwnProperty.call(fields,el.name))continue;
   if(el.type==="checkbox")el.checked=Boolean(fields[el.name]);else el.value=String(fields[el.name]);
  }
 }catch(e){}
}
function clearDraft(){if(state.draftKey){try{sessionStorage.removeItem(state.draftKey)}catch(e){}}}
function same(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
 const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&same(a[k],b[k]));
}
async function verifyRow(table,column,id,expected){
 const {data,error}=await db.from(table).select("*").eq(column,id).single();
 if(error||!data)throw Error("تعذّر التحقق من قاعدة البيانات: "+(error?.message||"السجل غير موجود"));
 for(const [key,value] of Object.entries(expected||{}))if(!same(data[key],value))throw Error("البيانات المحفوظة لم تطابق حقل "+key);
 return data;
}
async function read(table,order=null){
 let q=db.from(table).select("*");
 if(order)q=q.order(order);
 const {data,error}=await q;
 if(error)throw Error("فشل تحميل "+(SCOPE[table]||table)+": "+error.message);
 return data||[];
}
async function reload(){
 if(state.loading)return;
 state.loading=true;byId("refresh").disabled=true;
 try{
  if(!state.adminVerified)throw Error("لم يتم التحقق من صلاحية المسؤول.");
  const tab=state.tab;
  if(tab==="products"){const [products,categories,brands,images]=await Promise.all([read("products","created_at"),read("categories","sort_order"),read("brands","name"),read("product_images","sort_order")]);Object.assign(state.records,{products,categories,brands,images});}
  else if(tab==="orders"){
   const {data,error}=await db.from("orders").select("*,order_items(*)").order("created_at",{ascending:false}).limit(150);
   if(error)throw Error(error.message);state.records.orders=data||[];
  }
  else if(tab==="promos"){const [promotions,products]=await Promise.all([read("promotions","sort_order"),read("products","created_at")]);Object.assign(state.records,{promotions,products});}
  else if(tab==="shipping")state.records.shipping=await read("shipping_rates","governorate");
  else if(tab==="categories")state.records.categories=await read("categories","sort_order");
  else if(tab==="brands")state.records.brands=await read("brands","name");
  else if(tab==="members")state.records.members=await read("admin_members","created_at");
  renderContent();
 }catch(err){alertUser(err.message);byId("content").innerHTML='<section class="empty-state">'+html(err.message)+'</section>';}
 finally{state.loading=false;byId("refresh").disabled=false}
}
function action(kind,table,id,label,cls="secondary"){return '<button type="button" class="button mini '+cls+'" data-action="'+kind+'" data-table="'+table+'" data-id="'+html(id)+'">'+label+'</button>'}
function imageCell(url){return url&&safeUrl(url)?'<img class="image-thumb" src="'+safeUrl(url)+'" alt="صورة المنتج" loading="lazy">':'—'}
function productRows(){
 return (state.records.products||[]).map(p=>'<tr><td>'+imageCell(p.image_url)+'</td><td><strong>'+html(p.name)+'</strong><div class="help">'+html(p.sku||"بدون رمز")+'</div></td><td>'+money(p.price_iqd)+(p.compare_at_iqd>p.price_iqd?'<div class="help"><del>'+money(p.compare_at_iqd)+'</del></div>':'')+'</td><td>'+html(p.stock)+'</td><td><span class="tag '+(p.active?"":"off")+'">'+(p.active?"منشور":"مخفي")+'</span></td><td><div class="cell-actions">'+action("edit","products",p.id,"تعديل")+action("toggle","products",p.id,p.active?"إخفاء":"نشر")+action("delete","products",p.id,"حذف","danger")+'</div></td></tr>').join("");
}
function table(columns,body){return '<div class="surface table-wrap"><table class="data-table"><thead><tr>'+columns.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table></div>'}
function renderProducts(){
 const rows=state.records.products||[];
 return '<div class="cards"><div class="stat"><small>عدد المنتجات</small><strong>'+rows.length+'</strong></div><div class="stat"><small>المنتجات المنشورة</small><strong>'+rows.filter(x=>x.active).length+'</strong></div><div class="stat"><small>المنتجات المخفية</small><strong>'+rows.filter(x=>!x.active).length+'</strong></div><div class="stat"><small>العروض الفعّالة</small><strong>'+rows.filter(x=>x.on_sale).length+'</strong></div></div>'+
 '<div class="section-head"><div><h2>إدارة المنتجات</h2><p>إضافة منتج أو تغيير السعر والخصم والصور والمخزون</p></div><button type="button" class="button" data-action="new" data-table="products">إضافة منتج</button></div>'+
 table(["الصورة","الاسم","السعر","المخزون","الحالة","الإجراءات"],productRows()||'<tr><td colspan="6">لا توجد منتجات بعد.</td></tr>');
}
function renderTaxonomy(tableName){
 const rows=state.records[tableName]||[],heading=SCOPE[tableName];
 return '<div class="section-head"><div><h2>'+heading+'</h2><p>إضافة وتعديل وتصنيف العناصر</p></div><button type="button" class="button" data-action="new" data-table="'+tableName+'">إضافة '+(tableName==="brands"?"علامة تجارية":"فئة")+'</button></div>'+
 table(["الاسم","المعرّف","الحالة","الإجراءات"],rows.map(p=>'<tr><td>'+html(p.name)+'</td><td>'+html(p.slug||"")+'</td><td><span class="tag '+(p.active?"":"off")+'">'+(p.active?"ظاهر":"مخفي")+'</span></td><td><div class="cell-actions">'+action("edit",tableName,p.id,"تعديل")+action("toggle",tableName,p.id,p.active?"إخفاء":"إظهار")+action("delete",tableName,p.id,"حذف","danger")+'</div></td></tr>').join("")||'<tr><td colspan="4">لا توجد عناصر.</td></tr>');
}
function renderShipping(){
 const rows=state.records.shipping||[];
 return '<div class="section-head"><div><h2>أسعار التوصيل</h2><p>تحقق قاعدة البيانات من كل تعديل قبل ظهور رسالة النجاح</p></div></div>'+
 table(["المحافظة","رسوم التوصيل","مفعل","حفظ"],rows.map((r,i)=>'<tr><td>'+html(r.governorate)+'</td><td colspan="3"><form class="inline-save shipping-row" data-governorate="'+html(r.governorate)+'"><input name="price" class="input" type="number" min="0" step="1" required value="'+Number(r.price_iqd||0)+'" aria-label="سعر توصيل '+html(r.governorate)+'"><label><input type="checkbox" name="enabled" '+(r.enabled?"checked":"")+'> متاح</label><button class="button mini" type="submit">حفظ</button></form></td></tr>').join(""));
}
function orderChoices(current){return Object.entries(STATUS).map(([v,l])=>'<option value="'+v+'" '+(v===current?"selected":"")+'>'+l+'</option>').join("")}
function ordersRender(){
 const rows=state.records.orders||[];
 const statusBadge=s=>'<span class="tag '+html(s||"")+'">'+html(STATUS[s]||s||"")+'</span>';
 return '<div class="cards"><div class="stat"><small>جميع الطلبات</small><strong>'+rows.length+'</strong></div><div class="stat"><small>طلبات جديدة</small><strong>'+rows.filter(o=>o.status==="new").length+'</strong></div><div class="stat"><small>قيد التجهيز</small><strong>'+rows.filter(o=>o.status==="packing").length+'</strong></div><div class="stat"><small>تم التسليم</small><strong>'+rows.filter(o=>o.status==="delivered").length+'</strong></div></div>'+
 '<div class="section-head"><div><h2>متابعة الطلبات</h2><p>تغيير حالة الطلب بالكامل أو حالة أي منتج على حدة</p></div></div>'+
 (rows.map(o=>{
  const items=o.order_items||[];
  return '<article class="order-card"><div class="order-top"><div><h3>طلب '+html(o.id.slice(0,8).toUpperCase())+' — '+html(o.customer_name)+'</h3><small>'+html(new Date(o.created_at).toLocaleString("ar-IQ"))+' • '+html(o.phone)+'</small></div><div>'+statusBadge(o.status)+' <strong>'+money(o.total_iqd)+'</strong></div></div>'+
   '<div class="order-body"><div><p><strong>المحافظة: </strong>'+html(o.governorate)+'</p><p><strong>العنوان: </strong>'+html(o.address)+'</p><p><strong>الدفع: </strong>'+html(o.payment_method==="cod"?"عند الاستلام":"واتساب")+'</p><p><strong>الملاحظات: </strong>'+html(o.note||"—")+'</p></div><div class="order-products">'+items.map(i=>'<div class="order-line"><span>'+html(i.product_name)+' <small>× '+Number(i.quantity)+'</small><div><a href="./index.html#/product/'+encodeURIComponent(i.product_id||"")+'" target="_blank" rel="noopener">فتح المنتج</a></div></span><select class="input order-item-status" aria-label="حالة المنتج" data-order="'+html(o.id)+'" data-item="'+html(i.id)+'" data-current="'+html(i.status)+'">'+orderChoices(i.status)+'</select></div>').join("")+'</div></div>'+
   '<div class="order-controls"><strong>حالة الطلب:</strong><select class="input order-status" data-order="'+html(o.id)+'" data-current="'+html(o.status)+'">'+orderChoices(o.status)+'</select><span class="help">يحفظ التغيير مباشرةً بعد التحقق من قاعدة البيانات</span></div></article>';
 }).join("")||'<section class="empty-state">لا توجد طلبات حتى الآن.</section>');
}
function renderPromos(){
 const rows=state.records.promotions||[];
 return '<div class="section-head"><div><h2>الإعلانات واللافتات</h2><p>صور الهاتف والحاسوب مع رابط اختياري للمنتج</p></div><button class="button" data-action="new" data-table="promotions">إضافة إعلان</button></div>'+
 table(["الصورة","العنوان","المكان","الحالة","الإجراءات"],rows.map(x=>'<tr><td>'+imageCell(x.desktop_image_url||x.image_url)+'</td><td>'+html(x.title)+'</td><td>'+html(x.placement)+'</td><td><span class="tag '+(x.active?"":"off")+'">'+(x.active?"نشط":"مخفي")+'</span></td><td><div class="cell-actions">'+action("edit","promotions",x.id,"تعديل")+action("toggle","promotions",x.id,x.active?"إخفاء":"نشر")+action("delete","promotions",x.id,"حذف","danger")+'</div></td></tr>').join("")||'<tr><td colspan="5">لا توجد إعلانات.</td></tr>');
}
function renderMembers(){
 const members=state.records.members||[];
 return '<div class="section-head"><div><h2>حسابات الإدارة</h2><p>المالك الرئيسي فقط يمكنه منح صلاحيات المسؤولين</p></div><button class="button" data-action="new" data-table="members">إضافة مسؤول</button></div>'+
 table(["البريد الإلكتروني","الدور","الإجراءات"],members.map(m=>'<tr><td>'+html(m.email||"—")+'</td><td>'+html(m.role==="owner"?"المالك الرئيسي":m.role==="full"?"صلاحيات كاملة":"صلاحيات محدودة")+'</td><td>'+(m.role==="owner"?"محمي":'<div class="cell-actions">'+action("edit","members",m.user_id,"تعديل")+action("delete","members",m.user_id,"إزالة","danger")+'</div>')+'</td></tr>').join(""));
}
function renderContent(){
 renderNav();title(SCOPE[state.tab]||"لوحة الإدارة");
 let body="";
 if(state.tab==="products")body=renderProducts();
 else if(state.tab==="orders")body=ordersRender();
 else if(state.tab==="shipping")body=renderShipping();
 else if(state.tab==="promos")body=renderPromos();
 else if(state.tab==="categories"||state.tab==="brands")body=renderTaxonomy(state.tab);
 else if(state.tab==="members")body=renderMembers();
 byId("content").innerHTML=body;
}
function catalogOptions(table,selected=null){
 const list=state.records[table]||[];
 return [["","— اختر —"],...list.map(x=>[String(x.id),x.name])];
}
function findRecord(table,id){
 const source=table==="promotions"?"promotions":table;
 return (state.records[source]||[]).find(x=>String(x.id)===String(id))||{};
}
function showProduct(id){
 const p=id?findRecord("products",id):{};
 const original=p.compare_at_iqd>p.price_iqd?p.compare_at_iqd:(p.price_iqd??"");
 const percentage=p.compare_at_iqd>p.price_iqd?Math.round((p.compare_at_iqd-p.price_iqd)*100/p.compare_at_iqd):0;
 const spec=p.specifications&&typeof p.specifications==="object"?Object.entries(p.specifications).map(x=>x[0]+": "+x[1]).join("\n"):"";
 const options=catalogOptions("categories").filter(([key])=>!key||(state.records.categories||[]).find(x=>String(x.id)===key)?.parent_id);
 openDialog(id?"تعديل المنتج":"إضافة منتج",makeForm("productForm",
  field("اسم المنتج *","name",p.name||"",'required minlength="2" maxlength="180"')+
  selectField("الفئة *","category_id",options,p.category_id,'required')+
  selectField("العلامة التجارية","brand_id",catalogOptions("brands"),p.brand_id)+
  field("السعر الأصلي (د.ع) *","price",original,'type="number" required min="1" step="1"')+
  field("الخصم (%)","discount",percentage,'type="number" min="0" max="99" step="1"')+
  field("الكمية في المخزون *","stock",p.stock??0,'type="number" required min="0" step="1"')+
  field("رمز المنتج","sku",p.sku||"")+
  booleanSelect("منشور","active",p.active!==false)+
  booleanSelect("منتج مميز","featured",p.featured===true)+
  booleanSelect("عرض خاص","on_sale",p.on_sale===true)+
  booleanSelect("نموذج للعرض فقط","is_demo",p.is_demo===true)+
  textField("الوصف","description",p.description||"")+
  textField("المواصفات: اكتب المفتاح: القيمة لكل سطر","specs",spec)+
  '<label class="field">الصورة الرئيسية<input name="coverPhoto" type="file" class="input" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">ضغط تلقائي إلى 15 كيلوبايت؛ الصورة القديمة محفوظة ما لم ترفع صورة جديدة.</span></label>'+
  '<label class="field">صور إضافية<input name="photos" type="file" class="input" multiple accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حتى 8 صور إضافية، 15 كيلوبايت للصورة.</span></label>'+
  '<input type="hidden" name="id" value="'+html(p.id||"")+'">'+formFooter("حفظ المنتج")
 ),"product:"+String(p.id||"new"));
}
function showTaxonomy(table,id){
 const p=id?findRecord(table,id):{};
 const cat=table==="categories";
 const main=cat?selectField("الفئة الرئيسية","parent_id",[["","فئة رئيسية"],...(state.records.categories||[]).filter(x=>!x.parent_id&&String(x.id)!==String(p.id)).map(x=>[String(x.id),x.name])],p.parent_id):"";
 openDialog(id?"تعديل "+SCOPE[table]:"إضافة "+SCOPE[table],makeForm("taxonomyForm",
 field("الاسم *","name",p.name||"",'required minlength="2" maxlength="100"')+
 field("المعرّف بالإنجليزية","slug",p.slug||"",'pattern="[a-z0-9-]*"')+main+
 (cat?field("الترتيب","sort_order",p.sort_order||0,'type="number" min="0"'): "")+
 booleanSelect("ظاهر","active",p.active!==false)+
 '<input type="hidden" name="id" value="'+html(p.id||"")+'"><input type="hidden" name="table" value="'+table+'">'+formFooter()
 ),table+":"+String(p.id||"new"));
}
function showPromo(id){
 const p=id?findRecord("promotions",id):{};
 const choices=(state.records.products||[]).map(x=>[String(x.id),x.name]);
 openDialog(id?"تعديل الإعلان":"إضافة إعلان",makeForm("promoForm",
 field("عنوان الإعلان *","title",p.title||"",'required maxlength="90"')+
 field("النص التوضيحي","subtitle",p.subtitle||"")+
 selectField("مكان العرض","placement",[["home","الرئيسية"],["categories","الفئات"],["cart","العربة"]],p.placement||"home")+
 selectField("ربط بمنتج","product_id",[["","بدون منتج"],...choices],p.product_id)+
 selectField("الوجهة","link_url",[["#/categories","جميع المنتجات"],["#/offers","العروض"],["#/home","الرئيسية"],["#/cart","العربة"]],p.link_url||"#/categories")+
 field("الترتيب","sort_order",p.sort_order||0,'type="number" min="0"')+
 booleanSelect("منشور","active",p.active!==false)+
 booleanSelect("صورة جاهزة تحتوي التصميم","artwork_only",p.artwork_only!==false)+
 booleanSelect("إعلان تجريبي","is_demo",p.is_demo===true)+
 '<label class="field">صورة الحاسوب (1440 × 480)<input name="desktop" class="input" type="file" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حد أقصى 1 ميغابايت بعد الضغط</span></label>'+
 '<label class="field">صورة الهاتف (720 × 900)<input name="mobile" class="input" type="file" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حد أقصى 1 ميغابايت بعد الضغط</span></label>'+
 '<input type="hidden" name="id" value="'+html(p.id||"")+'">'+formFooter("حفظ الإعلان")
 ),"promo:"+String(p.id||"new"));
}
function showMember(id){
 const member=id?findRecord("members",id):{};
 const scopes=Object.entries(SCOPE).filter(([k])=>k!=="members");
 openDialog(id?"تعديل صلاحيات المسؤول":"إضافة مسؤول",makeForm("memberForm",
 field("البريد الإلكتروني المسجل والمؤكد *","email",member.email||"", 'type="email" required '+(member.user_id?"readonly":""))+
 selectField("الرتبة","role",[["full","مسؤول بصلاحيات كاملة"],["limited","مسؤول محدود"]],member.role||"limited")+
 '<div class="full"><p class="help">اختر الصلاحيات المسموحة للمسؤول المحدود. لا يمكن تغيير حساب المالك الرئيسي.</p><div class="staff-permissions">'+scopes.map(([k,label])=>'<label><input type="checkbox" name="scope_'+k+'" '+(member.permissions?.[k]?"checked":"")+'> '+label+'</label>').join("")+'</div></div>'+
 formFooter("حفظ صلاحيات المسؤول")
 ),"member:"+String(id||"new"));
}
async function requestSave(table,record,id){
 let query=id?db.from(table).update(record).eq("id",id):db.from(table).insert(record);
 const {data,error}=await query.select("*").single();
 if(error||!data)throw Error(error?.message||"لم يتم تأكيد التعديل");
 return verifyRow(table,"id",data.id,record);
}
function numeric(value,description,limit=2000000000){
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>limit)throw Error("القيمة غير صحيحة: "+description);return n;
}
function extractSpec(value){
 const result={};
 for(const line of String(value||"").split("\n")){
  const n=line.indexOf(":");if(n<1)continue;
  const a=line.slice(0,n).trim(),b=line.slice(n+1).trim();
  if(a&&b)result[a.slice(0,90)]=b.slice(0,300);
 }
 return result;
}
async function shrinkImage(file,maxBytes=15360,canvasWidth=1400,canvasHeight=1400){
 if(!file||!file.size)return null;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("نوع الصورة غير مدعوم.");
 if(file.size>25*1024*1024)throw Error("حجم الملف الأصلي يجب أن يكون أقل من 25 ميغابايت.");
 if(file.size<=maxBytes&&maxBytes===15360)return file;
 const src=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("تعذّر قراءة الصورة"));img.src=src});
  const w=img.naturalWidth,h=img.naturalHeight;
  if(!w||!h||w*h>55000000)throw Error("أبعاد الصورة غير مدعومة.");
  const base=Math.min(1,canvasWidth/w,canvasHeight/h);
  const cvs=document.createElement("canvas"),ctx=cvs.getContext("2d");
  if(!ctx)throw Error("المتصفح لا يدعم ضغط الصور");
  for(const zoom of [1,.78,.60,.45,.32,.22,.15,.1,.07,.04]){
   cvs.width=Math.max(1,Math.round(w*base*zoom));cvs.height=Math.max(1,Math.round(h*base*zoom));
   ctx.clearRect(0,0,cvs.width,cvs.height);ctx.drawImage(img,0,0,cvs.width,cvs.height);
   for(const quality of [.82,.62,.42,.25,.12]){
    const blob=await new Promise(resolve=>cvs.toBlob(resolve,"image/webp",quality));
    if(blob?.size&&blob.size<=maxBytes)return blob;
   }
  }
  throw Error("تعذّر ضغط الصورة إلى الحجم المحدد. حاول استخدام صورة أبسط.");
 }finally{URL.revokeObjectURL(src)}
}
async function upload(file,bucket,folder,bytes,w,h){
 const blob=await shrinkImage(file,bytes,w,h);
 if(!blob)return null;
 const ext=blob.type==="image/webp"?"webp":blob.type==="image/png"?"png":"jpg";
 const path=folder+"/"+crypto.randomUUID()+"."+ext;
 const {error}=await db.storage.from(bucket).upload(path,blob,{contentType:blob.type});
 if(error)throw Error("فشل رفع الصورة: "+error.message);
 return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
async function saveProduct(form){
 const f=new FormData(form),id=String(f.get("id")||""),name=String(f.get("name")||"").trim();
 if(name.length<2||name.length>180)throw Error("اسم المنتج يجب أن يتكون من حرفين على الأقل.");
 const cat=numeric(f.get("category_id"),"الفئة");
 if(!cat)throw Error("يرجى اختيار فئة للمنتج.");
 const original=numeric(f.get("price"),"السعر");
 const percent=numeric(f.get("discount")||0,"الخصم",99);
 if(original<1)throw Error("السعر يجب أن يكون أكبر من صفر.");
 const discounted=Math.round(original*(100-percent)/100);
 if(discounted<1)throw Error("السعر بعد الخصم غير صحيح.");
 const current=id?findRecord("products",id):{};
 const record={name,category_id:cat,brand_id:f.get("brand_id")?numeric(f.get("brand_id"),"العلامة التجارية"):null,
  description:String(f.get("description")||""),sku:String(f.get("sku")||"").trim()||null,
  price_iqd:discounted,compare_at_iqd:percent>0?original:null,stock:numeric(f.get("stock"),"المخزون"),
  specifications:extractSpec(f.get("specs")),active:f.get("active")==="true",
  featured:f.get("featured")==="true",on_sale:percent>0||f.get("on_sale")==="true",
  is_demo:f.get("is_demo")==="true",image_url:current.image_url||null};
 const cover=form.querySelector('[name="coverPhoto"]').files?.[0];
 const files=Array.from(form.querySelector('[name="photos"]').files||[]);
 if(files.length>8)throw Error("يسمح برفع ثماني صور إضافية فقط.");
 // The database record is committed before optional images. A failed upload
 // is reported as a partial save, never mistaken for a rejected product save.
 const row=await requestSave("products",record,id);
 try{
  if(cover){
   const url=await upload(cover,"product-images","products",15360,1400,1400);
   const {data,error}=await db.from("products").update({image_url:url}).eq("id",row.id).select("id").single();
   if(error||!data)throw Error(error?.message||"تعذّر تحديث صورة المنتج");
   await verifyRow("products","id",row.id,{image_url:url});
  }
  for(let i=0;i<files.length;i++){
   const url=await upload(files[i],"product-images","products",15360,1400,1400);
   const {error}=await db.from("product_images").insert({product_id:row.id,image_url:url,sort_order:100+i,alt_text:name});
   if(error)throw Error(error.message);
  }
 }catch(err){throw Error("تم حفظ بيانات المنتج في قاعدة البيانات، لكن تعذّر إكمال الصور: "+err.message)}
 return "تم حفظ المنتج والتحقق من بياناته في قاعدة البيانات.";
}
async function saveTaxonomy(form){
 const f=new FormData(form),table=String(f.get("table")),id=String(f.get("id")||"");
 if(!["categories","brands"].includes(table)||!can(table))throw Error("صلاحية غير متاحة.");
 const name=String(f.get("name")||"").trim();
 if(name.length<2)throw Error("اسم الفئة أو العلامة قصير جداً.");
 const slug=String(f.get("slug")||"").trim()||"bazoo-"+Date.now();
 if(!/^[a-z0-9-]+$/.test(slug))throw Error("المعرّف يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشرطة فقط.");
 const record={name,slug,active:f.get("active")==="true"};
 if(table==="categories"){record.parent_id=f.get("parent_id")?numeric(f.get("parent_id"),"الأب"):null;record.sort_order=numeric(f.get("sort_order")||0,"الترتيب");}
 await requestSave(table,record,id);
 return "تم حفظ "+SCOPE[table]+" والتحقق منها.";
}
async function savePromo(form){
 const f=new FormData(form),id=String(f.get("id")||"");
 const title=String(f.get("title")||"").trim();if(!title)throw Error("عنوان الإعلان مطلوب.");
 const p=id?findRecord("promotions",id):{};
 const record={title,subtitle:String(f.get("subtitle")||""),placement:String(f.get("placement")||"home"),
  link_url:String(f.get("link_url")||"#/categories"),product_id:f.get("product_id")?String(f.get("product_id")):null,
  sort_order:numeric(f.get("sort_order")||0,"ترتيب الإعلان"),active:f.get("active")==="true",
  artwork_only:f.get("artwork_only")==="true",is_demo:f.get("is_demo")==="true",
  desktop_image_url:p.desktop_image_url||null,mobile_image_url:p.mobile_image_url||null,image_url:p.image_url||null};
 const desktop=form.querySelector('[name="desktop"]').files?.[0];
 const mobile=form.querySelector('[name="mobile"]').files?.[0];
 if(desktop)record.desktop_image_url=await upload(desktop,"promo-images","promotions/desktop",1024*1024,1440,480);
 if(mobile)record.mobile_image_url=await upload(mobile,"promo-images","promotions/mobile",1024*1024,720,900);
 record.image_url=record.desktop_image_url||p.image_url||null;
 if(record.placement==="home"&&!record.image_url&&!record.product_id)throw Error("يحتاج إعلان الصفحة الرئيسية إلى صورة أو منتج مرتبط.");
 await requestSave("promotions",record,id);
 return "تم حفظ الإعلان والتحقق من البيانات والصور.";
}
async function saveShipping(form){
 const gov=form.dataset.governorate,price=numeric(new FormData(form).get("price"),"سعر التوصيل");
 const enabled=new FormData(form).has("enabled");
 const {data,error}=await db.from("shipping_rates").update({price_iqd:price,enabled}).eq("governorate",gov).select("governorate").single();
 if(error||!data)throw Error(error?.message||"لم يتم تحديث سعر التوصيل");
 await verifyRow("shipping_rates","governorate",gov,{price_iqd:price,enabled});
 return "تم حفظ توصيل محافظة "+gov+" والتحقق منه.";
}
async function saveMember(form){
 if(state.role!=="owner")throw Error("هذه الصلاحية للمالك فقط.");
 const data=new FormData(form),email=String(data.get("email")||"").trim().toLowerCase();
 const role=String(data.get("role")||"limited");
 const permissions={};for(const key of Object.keys(SCOPE))if(key!=="members")permissions[key]=data.has("scope_"+key);
 if(role==="limited"&&!Object.values(permissions).some(Boolean))throw Error("اختر صلاحية واحدة على الأقل للمسؤول المحدود.");
 const res=await db.rpc("admin_grant_member",{p_email:email,p_role:role,p_permissions:permissions});
 if(res.error)throw Error(res.error.message);
 const check=await db.from("admin_members").select("email,role,permissions").eq("email",email).single();
 if(check.error||!check.data||check.data.role!==role)throw Error("لم تتأكد صلاحيات هذا الحساب.");
 return "تم حفظ صلاحيات المسؤول في قاعدة البيانات.";
}
async function toggleRecord(table,id){
 if(!can(table==="promotions"?"promos":table))throw Error("ليس لديك صلاحية هذا القسم");
 const p=findRecord(table,id);
 if(!p.id)throw Error("السجل غير موجود");
 const expected=!p.active;
 const {data,error}=await db.from(table).update({active:expected}).eq("id",id).select("id").single();
 if(error||!data)throw Error(error?.message||"تعذّر تعديل حالة النشر.");
 await verifyRow(table,"id",id,{active:expected});
 return "تم تعديل حالة النشر بنجاح والتحقق منها.";
}
async function deleteRecord(table,id){
 if(table==="members"){
  if(state.role!=="owner")throw Error("هذه العملية للمالك فقط.");
  const res=await db.rpc("admin_revoke_member",{p_user_id:id});
  if(res.error)throw Error(res.error.message);
  const check=await db.from("admin_members").select("user_id").eq("user_id",id).maybeSingle();
  if(check.error||check.data)throw Error("لم يتأكد إلغاء الصلاحية.");
  return "تم سحب صلاحية المسؤول.";
 }
 if(!can(table==="promotions"?"promos":table))throw Error("ليس لديك صلاحية الحذف.");
 const {data,error}=await db.from(table).delete().eq("id",id).select("id").single();
 if(error||!data)throw Error(error?.message||"لم يتأكد حذف السجل");
 const test=await db.from(table).select("id").eq("id",id).maybeSingle();
 if(test.error||test.data)throw Error("لم تتأكد إزالة السجل.");
 return "تم حذف العنصر من قاعدة البيانات.";
}
async function saveOrder(control){
 const id=control.dataset.order, item=control.dataset.item;
 if(!can("orders"))throw Error("ليس لديك صلاحية تعديل الطلب");
 const table=item?"order_items":"orders";
 const status=control.value;
 const current=control.dataset.current;
 if(status===current)return "";
 if(current==="cancelled")throw Error("لا يمكن إعادة تفعيل طلب ملغي.");
 // Restrict API writes to a single status column; server triggers handle stock/line sync.
 let q=db.from(table).update({status});
 q=q.eq("id",item||id);
 if(item)q=q.eq("order_id",id);
 const {data,error}=await q.select("id,status").single();
 if(error||!data||data.status!==status)throw Error(error?.message||"فشل تحديث حالة الطلب في قاعدة البيانات.");
 await verifyRow(table,"id",item||id,{status});
 return "تم تحديث الحالة إلى "+STATUS[status]+" والتحقق منها.";
}
function customConfirm(message,action){
 openDialog("تأكيد العملية",'<div class="full"><p>'+html(message)+'</p><div class="form-actions"><button type="button" class="button danger" id="confirmAction">تأكيد</button><button type="button" class="button secondary" data-action="close">إلغاء</button></div></div>');
 byId("confirmAction").onclick=async()=>{
  const button=byId("confirmAction");button.disabled=true;
  try{
   const message=await action();closeDialog();alertUser(message,"success");await reload();
  }catch(error){alertUser(error.message);button.disabled=false}
 };
}
async function authenticate(){
 const user=await db.auth.getUser();
 if(user.error||!user.data?.user){state.user=null;state.adminVerified=false;renderLogin();return}
 state.user=user.data.user;
 const access=await db.rpc("my_admin_access");
 if(access.error||!access.data||String(access.data.user_id)!==String(state.user.id)||!["owner","full","limited"].includes(access.data.role)){
  state.adminVerified=false;state.role=null;renderLogin("هذا الحساب لا يملك صلاحية إدارة مثبتة في قاعدة البيانات.");
  return;
 }
 state.role=access.data.role;state.permissions=access.data.permissions||{};state.adminVerified=true;
 renderNav();await reload();
}
function renderLogin(message=""){
 title("تسجيل دخول المسؤول");
 byId("nav").innerHTML="";
 byId("content").innerHTML='<section class="auth-wrap surface"><h2>تسجيل الدخول إلى إدارة بازو</h2><p class="help">تستخدم هذه اللوحة حساب Supabase المسجّل والمخول فقط، ولا تعتمد على صلاحيات محفوظة في المتصفح.</p>'+
 (message?'<p class="notice-line">'+html(message)+'</p>':"")+
 '<form id="loginForm" class="form-grid">'+field("البريد الإلكتروني","email",state.user?.email||"",'type="email" required')+field("كلمة المرور","password","",'type="password" required')+formFooter("تسجيل الدخول")+'</form></section>';
 renderNav();
}
async function onSubmit(event){
 const form=event.target;
 if(!form?.matches||!form.matches("form"))return;
 event.preventDefault();event.stopPropagation();
 // HTMLFormElement controls with name="id" can shadow form.id in browsers.
 // Read the actual form attribute, never its named property.
 const formType=form.getAttribute("id")||"";
 if(form.dataset.pending==="true")return;
 const button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;form.dataset.pending="true";
 clearAlert();
 try{
  let result="";
  if(formType==="loginForm"){
   const data=new FormData(form),auth=await db.auth.signInWithPassword({email:String(data.get("email")||"").trim(),password:String(data.get("password")||"")});
   if(auth.error)throw Error(auth.error.message);
   await authenticate();alertUser("تم تسجيل الدخول والتحقق من الصلاحيات.","success");
  }else{
   if(!state.adminVerified)throw Error("انتهت صلاحيات الجلسة، سجّل الدخول مرة أخرى.");
   if(formType==="productForm")result=await saveProduct(form);
   else if(formType==="taxonomyForm")result=await saveTaxonomy(form);
   else if(formType==="promoForm")result=await savePromo(form);
   else if(formType==="memberForm")result=await saveMember(form);
   else if(form.matches(".shipping-row"))result=await saveShipping(form);
   else throw Error("النموذج غير معروف");
   clearDraft();closeDialog();alertUser(result,"success");await reload();
  }
 }catch(error){console.error("BAZOO admin save",error);alertUser("تعذّر الحفظ: "+(error?.message||"خطأ غير معروف")+". لم تُغلق نافذة التعديل.","error");}
 finally{form.dataset.pending="false";if(button)button.disabled=false}
}
document.addEventListener("submit",onSubmit,true);
document.addEventListener("input",event=>{if(event.target.closest("#dialogBody form"))saveDraft()},true);
document.addEventListener("change",async event=>{
 const control=event.target;
 if(!control.matches(".order-status,.order-item-status")){if(control.closest("#dialogBody form"))saveDraft();return}
 const previous=control.dataset.current;control.disabled=true;clearAlert();
 try{
  const msg=await saveOrder(control);if(msg){alertUser(msg,"success");await reload()}
 }catch(err){control.value=previous;alertUser("تعذّر الحفظ: "+err.message)}
 finally{control.disabled=false}
},true);
document.addEventListener("click",async event=>{
 const node=event.target.closest("[data-action],[data-tab]");
 if(!node)return;
 if(node.dataset.tab){
  if(!can(node.dataset.tab)&&node.dataset.tab!=="members")return alertUser("هذه الصلاحية غير مفعّلة.");
  state.tab=node.dataset.tab;clearAlert();await reload();return;
 }
 const actionName=node.dataset.action,table=node.dataset.table,id=node.dataset.id;
 if(actionName==="close"){closeDialog();return}
 if(actionName==="new"||actionName==="edit"){
  if(table==="products")showProduct(actionName==="new"?null:id);
  else if(table==="promotions")showPromo(actionName==="new"?null:id);
  else if(table==="brands"||table==="categories")showTaxonomy(table,actionName==="new"?null:id);
  else if(table==="members")showMember(actionName==="new"?null:id);
  return;
 }
 if(actionName==="toggle"){
  node.disabled=true;
  try{const msg=await toggleRecord(table,id);alertUser(msg,"success");await reload()}
  catch(error){alertUser("تعذّر الحفظ: "+error.message)}
  finally{node.disabled=false}
 }
 if(actionName==="delete")customConfirm("سيُحذف العنصر المحدد نهائياً. هل أنت متأكد؟",()=>deleteRecord(table,id));
});
byId("closeDialog").onclick=closeDialog;
byId("overlay").addEventListener("click",event=>{if(event.target===byId("overlay"))closeDialog()});
byId("refresh").onclick=async()=>{clearAlert();await reload()};
byId("signOut").onclick=async()=>{await db.auth.signOut();state.user=null;state.adminVerified=false;state.role=null;closeDialog();renderLogin();alertUser("تم تسجيل الخروج.","success")};
window.addEventListener("keydown",event=>{if(event.key==="Escape"&&!byId("overlay").hidden)closeDialog()});
bootPromise=authenticate().catch(err=>{console.error("BAZOO startup",err);renderLogin();alertUser("تعذّر الاتصال بخدمة الإدارة: "+err.message)});
