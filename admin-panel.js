/* BAZOO administration rebuild v1: isolated, permission checked, single-submit, read-after-write. */
import { createClient } from "./client.js";
const db=createClient("https://kgghxcxaqmuypcdwubhr.supabase.co","sb_publishable_TZKy9nGrNFu1KqZqBpsw3Q_x17cq1qy");
const byId=id=>document.getElementById(id);
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>new Intl.NumberFormat("en-US").format(Number(n)||0)+" د.ع";
const safeUrl=url=>/^https:\/\//i.test(String(url||""))?html(url):"";
const SCOPE={overview:"لوحة التحكم",products:"المنتجات",orders:"الطلبات",shipping:"التوصيل",promos:"الإعلانات",categories:"الفئات",brands:"العلامات التجارية",members:"المسؤولون"};
const ICON={overview:"home",products:"package",orders:"clipboard",shipping:"truck",promos:"sparkles",categories:"grid",brands:"tag",members:"user-round"};
const STATUS={new:"جديد",confirmed:"تم التأكيد",packing:"قيد التجهيز",shipped:"قيد التوصيل",delivered:"تم التسليم",cancelled:"ملغي"};
const state={user:null,role:null,permissions:{},tab:"products",records:{},busy:false,loading:false,adminVerified:false,draftKey:"",categorySearch:"",categoryMissingOnly:false,categoryExtrasOpen:false};
let bootPromise=null;
function glyph(name,cls="ui-icon"){return '<svg class="'+cls+'" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>'}
const ICON_ACTION={edit:"settings",new:"plus",toggle:"eye",delete:"x",close:"x"};
const HOME_CATEGORY_ORDER=["offers","phones","screens","tablets","devices-games","laptops","headphones","smart-watches","heaters","washing-machines","refrigerators","air-conditioners","cookers","cooking-appliances","vacuum-cleaners","perfumes"];
const HOME_CATEGORY_LABELS={"devices-games":"الألعاب","refrigerators":"ثلاجات","air-conditioners":"السبلت","washing-machines":"الغسالات والمجففات"};

const SUBTITLE={overview:"تابع أداء المتجر، واختصر وقت الإدارة من مساحة عمل واحدة.",products:"كل منتجات بازو وأسعارها ومخزونها في مكان واحد.",orders:"تابع كل طلب وغيّر حالة الطلب أو المنتج بسهولة.",shipping:"تحكّم في أجور التوصيل وتوفّر الخدمة لكل محافظة.",promos:"أنشئ لافتات جذابة ووحّد تجربة التسوّق.",categories:"رتّب أقسام المتجر وخصّص تجربة تصفّح المنتجات.",brands:"نظّم العلامات التجارية المتاحة في بازو.",members:"امنح فريقك الصلاحيات اللازمة بدون تعريض بيانات المتجر للخطر."};
function alertUser(message,type="error"){
 const node=byId("alert");
 node.textContent=String(message);node.className="alert "+type;node.hidden=false;
 if(typeof node.scrollIntoView==="function")node.scrollIntoView({block:"nearest",behavior:"smooth"});
 const stack=byId("toastStack");
 if(stack&&typeof stack.appendChild==="function"){
  const toast=document.createElement("div");
  toast.className="toast-item "+type;
  toast.innerHTML='<span class="toast-symbol">'+glyph(type==="success"?"check-circle":"circle-alert")+'</span><span>'+html(message)+'</span><button class="toast-close" type="button" aria-label="إغلاق التنبيه">×</button>';
  toast.querySelector("button").onclick=()=>toast.remove();
  stack.appendChild(toast);
  setTimeout(()=>{if(toast.isConnected){toast.classList.add("is-leaving");setTimeout(()=>toast.remove(),280)}},5100);
  if(stack.children.length>4)stack.firstElementChild?.remove();
 }
}
function clearAlert(){byId("alert").hidden=true}
function can(scope){return !!state.user&&state.adminVerified&&(scope==="overview"||state.role==="owner"||state.role==="full"||state.permissions[scope]===true)}
function tabKeys(){return Object.keys(SCOPE).filter(key=>key==="members"?state.role==="owner":can(key))}
function renderNav(){
 const nav=byId("nav"),tabs=tabKeys();
 if(!tabs.includes(state.tab))state.tab=tabs[0]||"overview";
 nav.innerHTML=tabs.map(key=>'<button type="button" class="nav-button '+(state.tab===key?"active":"")+'" data-tab="'+key+'" '+(state.tab===key?'aria-current="page"':'')+'><span class="nav-icon">'+glyph(ICON[key])+'</span><span>'+SCOPE[key]+'</span></button>').join("");
 byId("userLabel").textContent=state.user?.email||"غير مسجّل";
 byId("signOut").hidden=!state.user;
 if(byId("roleLabel"))byId("roleLabel").textContent=state.role==="owner"?"المالك الرئيسي":state.role==="full"?"مسؤول كامل الصلاحيات":state.role==="limited"?"مسؤول المتجر":"حساب الإدارة";
}
function title(text){
 byId("pageTitle").textContent=text;
 if(byId("breadcrumbCurrent"))byId("breadcrumbCurrent").textContent=text;
 if(byId("pageSubtitle"))byId("pageSubtitle").textContent=SUBTITLE[state.tab]||"مساحة عمل متكاملة لإدارة متجر بازو.";
 document.title=text+" | BAZOO بازو";
}
function field(label,name,value="",attrs="",extra=""){
 return '<label class="field">'+html(label)+'<input class="input" name="'+name+'" value="'+html(value)+'" '+attrs+'>'+extra+'</label>';
}
function selectField(label,name,opts,current,attrs=""){
 return '<label class="field">'+html(label)+'<select class="input" name="'+name+'" '+attrs+'>'+opts.map(x=>'<option value="'+html(x[0])+'" '+(String(current??"")===String(x[0])?"selected":"")+'>'+html(x[1])+'</option>').join("")+'</select></label>';
}
function textField(label,name,value="",rows=3){return '<label class="field full">'+html(label)+'<textarea class="input" name="'+name+'" rows="'+rows+'">'+html(value)+'</textarea></label>'}
function formFooter(label="حفظ التعديلات"){
 return '<div class="form-actions full"><button type="submit" class="button">'+glyph("check-circle")+label+'</button><button type="button" class="button secondary" data-action="close">إلغاء</button></div>';
}
function sectionHeading(heading,note="",symbol="settings"){return '<div class="form-section-title">'+glyph(symbol)+'<span>'+html(heading)+'</span>'+(note?'<small>'+html(note)+'</small>':'')+'</div>'}
function booleanSelect(label,name,value=true){return selectField(label,name,[["true","نعم"],["false","لا"]],Boolean(value)?"true":"false")}
function makeForm(id,contents){return '<form id="'+id+'" class="form-grid" novalidate>'+contents+'</form>'}
function openDialog(heading,body,draftId=null){
 byId("dialogTitle").textContent=heading;
 byId("dialogBody").innerHTML=body;
 const isDelete=heading.includes("حذف")||heading.includes("تأكيد");
 if(byId("overlay").dataset)byId("overlay").dataset.variant=isDelete?"danger":"default";
 const iconName=isDelete?"circle-alert":heading.includes("منتج")?"package":heading.includes("إعلان")?"sparkles":heading.includes("مسؤول")?"user-plus":heading.includes("فئة")?"grid":"settings";
 if(byId("dialogIcon"))byId("dialogIcon").innerHTML=glyph(iconName);
 if(byId("dialogEyebrow"))byId("dialogEyebrow").textContent=isDelete?"تأكيد إجراء إداري":"BAZOO • إدارة المتجر";
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
  if(tab==="overview"){
    const [p,o,ad]=await Promise.all([
     can("products")?read("products","created_at"):Promise.resolve([]),
     can("orders")?read("orders","created_at"):Promise.resolve([]),
     can("promos")?read("promotions","sort_order"):Promise.resolve([])
    ]);
    state.records.overview={products:p,orders:o,promos:ad};
  }
  else if(tab==="products"){const [products,categories,brands,images]=await Promise.all([read("products","created_at"),read("categories","sort_order"),read("brands","name"),read("product_images","sort_order")]);Object.assign(state.records,{products,categories,brands,images});}
  else if(tab==="orders"){
   const {data,error}=await db.from("orders").select("*,order_items(*)").order("created_at",{ascending:false}).limit(150);
   if(error)throw Error(error.message);state.records.orders=data||[];
  }
  else if(tab==="promos"){const [promotions,products]=await Promise.all([read("promotions","sort_order"),read("products","created_at")]);Object.assign(state.records,{promotions,products});}
  else if(tab==="shipping")state.records.shipping=await read("shipping_rates","governorate");
  else if(tab==="categories"){
    const [categories,settings]=await Promise.all([read("categories","sort_order"),read("storefront_settings","key")]);
    state.records.categories=categories;
    state.records.offersCategoryCover=settings.find(x=>x.key==="offers_category_cover")?.image_url||null;
  }
  else if(tab==="brands")state.records.brands=await read("brands","name");
  else if(tab==="members")state.records.members=await read("admin_members","created_at");
  renderContent();
 }catch(err){alertUser(err.message);byId("content").innerHTML='<section class="empty-state">'+html(err.message)+'</section>';}
 finally{state.loading=false;byId("refresh").disabled=false}
}
function action(kind,table,id,label,cls="secondary"){return '<button type="button" class="button mini '+cls+'" data-action="'+kind+'" data-table="'+table+'" data-id="'+html(id)+'">'+glyph(ICON_ACTION[kind]||"settings")+label+'</button>'}
function imageCell(url){return url&&safeUrl(url)?'<img class="image-thumb" src="'+safeUrl(url)+'" alt="صورة المنتج" loading="lazy">':'—'}
function productRows(){
 return (state.records.products||[]).map(p=>'<tr data-filter-text="'+html((p.name+" "+(p.sku||"")).toLowerCase())+'"><td>'+imageCell(p.image_url)+'</td><td><strong>'+html(p.name)+'</strong><div class="help">'+html(p.sku||"بدون رمز")+'</div></td><td>'+money(p.price_iqd)+(p.compare_at_iqd>p.price_iqd?'<div class="help"><del>'+money(p.compare_at_iqd)+'</del></div>':'')+'</td><td>'+html(p.stock)+'</td><td><span class="tag '+(p.active?"":"off")+'">'+(p.active?"منشور":"مخفي")+'</span></td><td><div class="cell-actions">'+action("edit","products",p.id,"تعديل")+action("toggle","products",p.id,p.active?"إخفاء":"نشر")+action("delete","products",p.id,"حذف","danger")+'</div></td></tr>').join("");
}
function table(columns,body){return '<div class="surface table-wrap"><table class="data-table"><thead><tr>'+columns.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table></div>'}
function statCard(label,num,ico,note=""){
 return '<div class="stat"><div class="stat-head"><small>'+html(label)+'</small><span class="stat-icon">'+glyph(ico)+'</span></div><strong>'+html(String(num))+'</strong><div class="stat-foot">'+html(note)+'</div></div>';
}
function renderOverview(){
 const data=state.records.overview||{},products=data.products||[],orders=data.orders||[],promos=data.promos||[];
 const total=orders.filter(o=>o.status==="delivered").reduce((sum,o)=>sum+Number(o.total_iqd||0),0);
 const items=[
  can("products")?statCard("إجمالي المنتجات",products.length,"package","المنتجات المسجّلة"):null,
  can("orders")?statCard("الطلبات الجديدة",orders.filter(o=>o.status==="new").length,"shopping-bag","تحتاج إلى المتابعة"):null,
  can("orders")?statCard("طلبات تم تسليمها",orders.filter(o=>o.status==="delivered").length,"check-circle","طلبات مكتملة"):null,
  can("promos")?statCard("إعلانات نشطة",promos.filter(p=>p.active).length,"sparkles","اللافتات المنشورة"):null
 ].filter(Boolean).join("");
 const links=[
  ["products","إدارة المنتجات","الأسعار والمخزون والتفاصيل","package"],
  ["orders","متابعة الطلبات","إتمام التجهيز والتوصيل","clipboard"],
  ["promos","إدارة الإعلانات","اللافتات والعروض","sparkles"],
  ["categories","تنظيم الفئات","الأقسام والفئات الفرعية","grid"],
  ["shipping","إعدادات التوصيل","رسوم المحافظات","truck"],
  ["members","صلاحيات المسؤولين","أعضاء فريق المتجر","user-round"]
 ].filter(x=>x[0]==="members"?state.role==="owner":can(x[0]));
 return '<div class="overview-welcome"><span class="overview-welcome-icon">'+glyph("sparkles")+'</span><div><strong>مرحباً بك في مركز إدارة بازو</strong><p>نظرة واحدة على المتجر، وكل ما تحتاج إليه لإدارته بكفاءة.</p></div></div>'
 +'<div class="cards">'+(items||statCard("مساحة العمل","BAZOO","home","أهلاً بعودتك"))+'</div>'
 +(can("orders")?'<div class="section-head"><div><h2>إجمالي المبيعات المسلّمة</h2><p>إجمالي قيمة الطلبات التي وصلت إلى حالة «تم التسليم»</p></div><span class="tag delivered">مكتملة</span></div><div class="surface overview-revenue"><strong>'+money(total)+'</strong><span>مبيعات الطلبات المكتملة فقط</span></div>':"")
 +'<div class="section-head"><div><h2>اختصارات الإدارة</h2><p>انتقل مباشرة إلى القسم المطلوب</p></div></div>'
 +'<div class="overview-actions">'+links.map(([key,label,desc,ico])=>'<button class="overview-link" type="button" data-tab="'+key+'"><span class="overview-link-icon">'+glyph(ico)+'</span><span><strong>'+label+'</strong><small>'+desc+'</small></span><span class="link-arrow">'+glyph("arrow-left")+'</span></button>').join("")+'</div>';
}
function renderProducts(){
 const rows=state.records.products||[];
 return '<div class="cards">'+statCard("إجمالي المنتجات",rows.length,"package","كل المنتجات المسجلة")
 +statCard("المنتجات المنشورة",rows.filter(x=>x.active).length,"check-circle","تظهر في المتجر")
 +statCard("المنتجات المخفية",rows.filter(x=>!x.active).length,"eye-off","غير ظاهرة للعملاء")
 +statCard("العروض الحالية",rows.filter(x=>x.on_sale).length,"percent","منتجات ضمن العروض")+'</div>'
 +'<div class="section-head"><div><h2>إدارة المنتجات</h2><p>تحكّم بالأسماء والصور والأسعار والخصومات والمخزون</p></div><div class="section-tools"><label class="search-box">'+glyph("search")+'<input type="search" class="input" id="productSearch" placeholder="ابحث عن منتج أو رمز..." aria-label="بحث في المنتجات"></label><button type="button" class="button" data-action="new" data-table="products">'+glyph("plus")+'إضافة منتج</button></div></div>'
 +table(["الصورة","الاسم","السعر","المخزون","الحالة","الإجراءات"],productRows()||'<tr><td colspan="6">لا توجد منتجات بعد.</td></tr>');
}
function categoryAncestors(category,list){
 const result=[],visited=new Set([String(category.id)]);
 let node=category;
 for(let depth=0;node?.parent_id&&depth<12;depth++){
  const parent=list.find(c=>String(c.id)===String(node.parent_id));
  if(!parent||visited.has(String(parent.id)))break;
  visited.add(String(parent.id));result.unshift(parent);node=parent;
 }
 return result;
}
function categoryPath(category,list){return [...categoryAncestors(category,list).map(c=>c.name),category.name].join(" / ")}
function categoryImageBlock(category,isRoot=false){
 const src=category.image_url&&safeUrl(category.image_url)?safeUrl(category.image_url):"";
 return '<span class="category-image-box '+(isRoot?"category-image-root":"")+'">'+
 (src?'<img src="'+src+'" alt="صورة '+html(category.name)+'" loading="lazy" decoding="async">':
 '<span class="category-no-image">'+glyph("image")+'<small>بلا صورة</small></span>')+'</span>';
}
function categoryUploadControl(category){
 return '<label class="category-upload-button" title="رفع أو تغيير صورة '+html(category.name)+'">'+
 glyph("image")+'<span>'+(category.image_url?"تغيير الصورة":"رفع صورة")+'</span>'+
 '<input type="file" class="category-photo-input" data-category-id="'+html(category.id)+'" accept="image/png,image/jpeg,image/webp" aria-label="رفع صورة '+html(category.name)+'">'+
 '</label>';
}
function categoryCard(category,rows,isRoot=false){
 const branch=categoryAncestors(category,rows);
 const parent=branch[branch.length-1];
 const groupName=isRoot?"قسم رئيسي":parent?"يتبع: "+parent.name:"فئة فرعية";
 const hasImage=Boolean(category.image_url&&safeUrl(category.image_url));
 return '<article class="category-manager-card '+(isRoot?"category-manager-root":"")+'" data-category-id="'+html(category.id)+'">'+
 categoryImageBlock(category,isRoot)+
 '<div class="category-manager-info"><div class="category-manager-name">'+html(category.name)+'</div>'+
 '<div class="category-manager-meta">'+html(groupName)+'</div>'+
 '<div class="category-manager-badges"><span class="category-mini-status '+(hasImage?"has-image":"missing-image")+'">'+(hasImage?"الصورة مرفوعة":"تحتاج صورة")+'</span>'+
 (category.active?'<span class="category-mini-status">ظاهر</span>':'<span class="category-mini-status muted">مخفي</span>')+
 (category.show_on_home?'<span class="category-mini-status">بالرئيسية</span>':'')+'</div></div>'+
 '<div class="category-manager-actions">'+categoryUploadControl(category)+
 '<button type="button" class="category-edit-button" data-action="edit" data-table="categories" data-id="'+html(category.id)+'">'+glyph("settings")+'تعديل</button>'+
 '</div></article>';
}
function homepageCategoryRecords(rows){
 const active=rows.filter(row=>row.parent_id&&row.active&&row.show_on_home!==false&&categoryAncestors(row,rows).every(parent=>parent.active));
 const bySlug=new Map(active.map(row=>[row.slug,row]));
 const curated=HOME_CATEGORY_ORDER.map(slug=>slug==="offers"?{slug,name:"العروض المميزة",isOffer:true}:bySlug.get(slug)).filter(Boolean);
 const pinned=new Set(HOME_CATEGORY_ORDER);
 const extras=active.filter(row=>!pinned.has(row.slug)).sort((a,b)=>{
  const aRoot=!a.parent_id,bRoot=!b.parent_id;
  if(aRoot!==bRoot)return aRoot?-1:1;
  const ap=categoryAncestors(a,rows).map(x=>x.name).join(" / ");
  const bp=categoryAncestors(b,rows).map(x=>x.name).join(" / ");
  return ap.localeCompare(bp,"ar")||Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"ar");
 });
 return [...curated,...extras].map((row,position)=>({...row,position}));
}
function homepageCategoryCard(item,rows){
 if(item.isOffer){
  const image=state.records.offersCategoryCover;
  const img=image&&safeUrl(image)?'<img class="offer-cover-preview" src="'+safeUrl(image)+'" alt="صورة العروض المميزة" loading="lazy">':glyph("sparkles")+'<b>BAZOO</b>';
  const picker='<label class="category-upload-button" title="رفع صورة العروض المميزة">'+glyph("image")+'<span>'+(image?"تغيير الصورة":"رفع صورة")+'</span>'+
   '<input type="file" class="offers-category-photo-input" accept="image/png,image/jpeg,image/webp" aria-label="رفع صورة العروض المميزة"></label>';
  return '<article class="home-category-admin-card offer-category-admin" data-home-position="'+item.position+'">'+
   '<div class="home-category-admin-image offer-image">'+img+'</div>'+
   '<span class="home-category-admin-position">رقم '+(item.position+1)+' بالرئيسية</span>'+
   '<h3>العروض المميزة</h3><p>صورة مستقلة عن البنرات والإعلانات</p>'+
   '<div class="home-category-admin-actions">'+picker+
   '<button class="category-edit-button" type="button" data-tab="promos">'+glyph("settings")+'الإعلانات</button></div></article>';
 }
 const title=HOME_CATEGORY_LABELS[item.slug]||item.name;
 const parent=categoryAncestors(item,rows).at(-1);
 return '<article class="home-category-admin-card" data-home-position="'+item.position+'" data-category-id="'+html(item.id)+'">'+
 '<div class="home-category-admin-image">'+categoryImageBlock(item)+'</div>'+
 '<span class="home-category-admin-position">رقم '+(item.position+1)+' بالرئيسية</span>'+
 '<h3>'+html(title)+'</h3>'+
 '<p>'+html(parent?"تابعة لـ "+parent.name:"قسم مستقل")+'</p>'+
 '<div class="home-category-admin-actions">'+categoryUploadControl(item)+
 '<button class="category-edit-button" type="button" data-action="edit" data-table="categories" data-id="'+html(item.id)+'">'+glyph("settings")+'تعديل</button></div></article>';
}
function categorySortValue(category,rows){
 const branch=[...categoryAncestors(category,rows),category];
 return branch.map(x=>String(x.sort_order??0).padStart(5,"0")).join(".")+"."+String(category.name);
}
function categoryManagerGroups(){
 const rows=state.records.categories||[];
 const roots=rows.filter(c=>!c.parent_id||!rows.some(x=>String(x.id)===String(c.parent_id)))
  .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"ar"));
 const query=state.categorySearch.trim().toLocaleLowerCase("ar");
 const missingOnly=state.categoryMissingOnly;
 let count=0;
 const groups=roots.map(root=>{
  const descendants=rows.filter(c=>String(c.id)!==String(root.id)&&categoryAncestors(c,rows).some(x=>String(x.id)===String(root.id)));
  descendants.sort((a,b)=>categorySortValue(a,rows).localeCompare(categorySortValue(b,rows),"ar"));
  const rootMatches=!query||[root.name,root.slug].some(v=>String(v||"").toLocaleLowerCase("ar").includes(query));
  const matched=descendants.filter(c=>
   (!missingOnly||!c.image_url)&&
   (rootMatches||[categoryPath(c,rows),c.slug].some(v=>String(v||"").toLocaleLowerCase("ar").includes(query)))
  );
  const rootMissing=missingOnly&&!root.image_url;
  if((query&&!rootMatches&&!matched.length)||(missingOnly&&!rootMissing&&!matched.length))return "";
  count+=matched.length+1;
  const photoCount=descendants.filter(c=>Boolean(c.image_url)).length;
  return '<section class="category-manager-group" data-parent-category="'+html(root.id)+'">'+
  '<div class="category-group-head">'+categoryCard(root,rows,true)+
  '<div class="category-group-toolbar"><span>'+descendants.length+' فئة تابعة • '+photoCount+' لديها صور</span>'+
  '<button type="button" class="button mini secondary" data-action="new-category-child" data-id="'+html(root.id)+'">'+glyph("plus")+'إضافة فئة لهذا القسم</button></div></div>'+
  '<div class="category-group-caption"><span>'+glyph("grid")+'الفئات التابعة لـ '+html(root.name)+'</span>'+
  '<span>'+matched.length+' فئة ظاهرة</span></div>'+
  (matched.length?'<div class="category-manager-grid">'+matched.map(c=>categoryCard(c,rows)).join("")+'</div>':
  '<div class="category-group-empty">لا توجد فئات فرعية مطابقة هنا.</div>')+
  '</section>';
 }).filter(Boolean);
 return groups.length?groups.join(""):'<div class="category-manager-empty">'+glyph("search")+'لا توجد فئات مطابقة للبحث أو التصفية.</div>';
}
function renderTaxonomy(tableName){
 if(tableName!=="categories"){
  const rows=state.records[tableName]||[];
  return '<div class="section-head"><div><h2>'+SCOPE[tableName]+'</h2><p>إضافة العلامات التجارية وتعديلها</p></div>'+
  '<button type="button" class="button" data-action="new" data-table="brands">'+glyph("plus")+'إضافة علامة تجارية</button></div>'+
  table(["الاسم","المعرّف","الحالة","الإجراءات"],rows.map(p=>
   '<tr><td><strong>'+html(p.name)+'</strong></td><td>'+html(p.slug||"")+'</td><td><span class="tag '+(p.active?"":"off")+'">'+(p.active?"ظاهر":"مخفي")+'</span></td>'+
   '<td><div class="cell-actions">'+action("edit","brands",p.id,"تعديل")+action("toggle","brands",p.id,p.active?"إخفاء":"إظهار")+action("delete","brands",p.id,"حذف","danger")+'</div></td></tr>').join("")||
   '<tr><td colspan="4">لا توجد علامات تجارية.</td></tr>');
 }
 const rows=state.records.categories||[];
 const featured=homepageCategoryRecords(rows);
 const homeCount=featured.filter(x=>!x.isOffer).length;
 const roots=rows.filter(x=>!x.parent_id).length;
 const missing=featured.filter(x=>x.isOffer?!state.records.offersCategoryCover:!x.image_url).length;
 return '<div class="category-manager category-manager-v2">'+
 '<div class="category-manager-intro"><div><h2>صور فئات الصفحة الرئيسية</h2>'+
 '<p>نفس العناصر ونفس ترتيب المتجر. صورة كل فئة تنرفع من بطاقتها مباشرة، بدون اختلاط بالأقسام الأخرى.</p></div>'+
 '<button type="button" class="button" data-action="new" data-table="categories">'+glyph("plus")+'إضافة قسم أو فئة</button></div>'+
 '<div class="category-manager-stats"><span>'+glyph("image")+featured.length+' عنصراً بالرئيسية</span>'+
 '<span>'+glyph("grid")+rows.length+' قسم وفئة بقاعدة البيانات</span>'+
 '<span class="'+(missing?"needs-photo":"")+'">'+glyph("image")+missing+' صورة ناقصة بالرئيسية</span></div>'+
 '<div class="category-manager-help">'+glyph("info")+
 '<div><strong>توضيح:</strong> تظهر الفئات الفرعية فقط في هذه الشبكة، أما الأقسام الرئيسية فتبقى في شريط الأقسام وفي إدارة الهيكل بالأسفل. صورة «العروض المميزة» ترفعها من بطاقتها هنا.</div></div>'+
 '<div class="category-manager-tools"><label class="category-search">'+glyph("search")+
 '<input type="search" class="input" id="categoryManagerSearch" placeholder="ابحث عن فئة أو قسم..." autocomplete="off" value="'+html(state.categorySearch)+'" aria-label="البحث في الفئات"></label>'+
 '<label class="category-filter-missing"><input id="categoryMissingOnly" type="checkbox" '+(state.categoryMissingOnly?"checked":"")+'><span>اعرض الصور الناقصة فقط</span></label></div>'+
 '<section class="category-home-section"><div class="category-home-section-head"><h3>الفئات الظاهرة في الرئيسية <small>('+featured.length+')</small></h3>'+
 '<span>ترتيب العرض من اليمين إلى اليسار</span></div>'+
 '<div id="homeCategoryAdminGrid" class="home-category-admin-grid">'+categoryHomepageTiles()+'</div></section>'+
 '<details class="category-extra-details" id="categoryExtraDetails" '+(state.categoryExtrasOpen?"open":"")+'>'+
 '<summary><span>'+glyph("folder")+'إدارة الهيكل الرئيسي والفئات التابعة</span>'+
 '<span class="category-extra-count">'+roots+' أقسام رئيسية '+glyph("chevron-down")+'</span></summary>'+
 '<div id="categoryManagerGroups">'+categoryManagerGroups()+'</div></details></div>';
}
function categoryHomepageTiles(){
 const rows=state.records.categories||[];
 const query=state.categorySearch.trim().toLocaleLowerCase("ar");
 const filtered=homepageCategoryRecords(rows).filter(item=>{
  if(state.categoryMissingOnly&&(item.isOffer?Boolean(state.records.offersCategoryCover):Boolean(item.image_url)))return false;
  if(!query)return true;
  const names=[item.name,item.slug,HOME_CATEGORY_LABELS[item.slug],
   ...(item.isOffer?[]:categoryAncestors(item,rows).map(x=>x.name))];
  return names.some(x=>String(x||"").toLocaleLowerCase("ar").includes(query));
 });
 return filtered.length?filtered.map(x=>homepageCategoryCard(x,rows)).join(""):
 '<div class="category-manager-empty">لا توجد فئات مطابقة للبحث.</div>';
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
 if(state.tab==="overview")body=renderOverview();
 else if(state.tab==="products")body=renderProducts();
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
 const options=catalogOptions("categories").filter(([key])=>!key||(state.records.categories||[]).find(x=>String(x.id)===key)?.parent_id)
   .map(([key,name])=>[key,key?categoryPath((state.records.categories||[]).find(x=>String(x.id)===key),state.records.categories||[]):name]);
 openDialog(id?"تعديل المنتج":"إضافة منتج",makeForm("productForm",
  sectionHeading("البيانات الأساسية","تعريف المنتج وتصنيفه","package")+
  field("اسم المنتج *","name",p.name||"",'required minlength="2" maxlength="180"')+
  selectField("الفئة *","category_id",options,p.category_id,'required')+
  selectField("العلامة التجارية","brand_id",catalogOptions("brands"),p.brand_id)+
  sectionHeading("التسعير والمخزون","الأسعار بالدينار العراقي","percent")+
  field("السعر الأصلي (د.ع) *","price",original,'type="number" required min="1" step="1"')+
  field("الخصم (%)","discount",percentage,'type="number" min="0" max="99" step="1"')+
  field("الكمية في المخزون *","stock",p.stock??0,'type="number" required min="0" step="1"')+
  field("رمز المنتج","sku",p.sku||"")+
  sectionHeading("خيارات النشر","تحكّم في ظهور المنتج للعملاء","eye")+
  booleanSelect("منشور","active",p.active!==false)+
  booleanSelect("منتج مميز","featured",p.featured===true)+
  booleanSelect("عرض خاص","on_sale",p.on_sale===true)+
  booleanSelect("نموذج للعرض فقط","is_demo",p.is_demo===true)+
  sectionHeading("التفاصيل والمواصفات","اجعل وصف المنتج أكثر وضوحاً","clipboard")+
  textField("الوصف","description",p.description||"")+
  textField("المواصفات: اكتب المفتاح: القيمة لكل سطر","specs",spec)+
  sectionHeading("صور المنتج","رفع مباشر مع ضغط تلقائي","image")+
  '<label class="field file-picker"><span>الصورة الرئيسية</span><span class="file-preview" data-file-preview="coverPhoto">'+(p.image_url&&safeUrl(p.image_url)?'<img src="'+safeUrl(p.image_url)+'" alt="الصورة الحالية للمنتج">':glyph("image")+'<small>معاينة الصورة هنا</small>')+'</span><input name="coverPhoto" type="file" class="input" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">ضغط تلقائي إلى 15 كيلوبايت؛ تبقى الصورة القديمة إذا لم ترفع بديلاً.</span></label>'+
  '<label class="field file-picker"><span>صور إضافية</span><span class="file-preview file-preview-multiple" data-file-preview="photos">'+glyph("image")+'<small>رفع مجموعة الصور</small></span><input name="photos" type="file" class="input" multiple accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حتى 8 صور إضافية، 15 كيلوبايت للصورة.</span></label>'+
  '<input type="hidden" name="id" value="'+html(p.id||"")+'">'+formFooter("حفظ المنتج")
 ),"product:"+String(p.id||"new"));
}
function showTaxonomy(table,id,parentId=null){
 const p=id?findRecord(table,id):(parentId?{parent_id:parentId}:{});
 const cat=table==="categories";
 const rows=state.records.categories||[];
 const eligible=rows.filter(x=>String(x.id)!==String(p.id)&&!categoryAncestors(x,rows).some(a=>String(a.id)===String(p.id)));
 const main=cat?selectField("يتبع إلى التصنيف الرئيسي","parent_id",[["","قسم رئيسي مستقل"],...eligible.map(x=>[String(x.id),categoryPath(x,rows)])],p.parent_id):"";
 openDialog(id?"تعديل "+SCOPE[table]:"إضافة "+SCOPE[table],makeForm("taxonomyForm",
 sectionHeading("بيانات "+SCOPE[table],"تنظيم القسم وعلاقته بالأقسام الأخرى","grid")+
 field("الاسم *","name",p.name||"",'required minlength="2" maxlength="100"')+
 field("المعرّف بالإنجليزية","slug",p.slug||"",'pattern="[a-z0-9-]*"')+main+
 (cat?field("ترتيب الظهور","sort_order",p.sort_order??0,'type="number" min="0"'): "")+
 booleanSelect("ظاهر في المتجر","active",p.active!==false)+
 (cat?booleanSelect("إظهاره في الصفحة الرئيسية","show_on_home",p.show_on_home!==false):"")+
 (cat?sectionHeading("صورة التصنيف","تظهر داخل دائرة على الصفحة الرئيسية","image")+
 '<label class="field file-picker full"><span>صورة التصنيف (PNG / JPEG / WEBP)</span><span class="file-preview category-cover-preview" data-file-preview="categoryPhoto">'+(p.image_url&&safeUrl(p.image_url)?'<img src="'+safeUrl(p.image_url)+'" alt="صورة التصنيف الحالية">':glyph("image")+'<small>اختر صورة واضحة للمنتج أو القسم</small>')+'</span><input name="categoryPhoto" class="input" type="file" accept="image/png,image/jpeg,image/webp"><span class="upload-hint">تُرفع مباشرة من جهازك وتُضغط تلقائياً إلى 15 كيلوبايت.</span></label>':"")+
 '<input type="hidden" name="id" value="'+html(p.id||"")+'"><input type="hidden" name="table" value="'+table+'">'+formFooter()
 ),table+":"+String(p.id||"new"));
}
function showPromo(id){
 const p=id?findRecord("promotions",id):{};
 const choices=(state.records.products||[]).map(x=>[String(x.id),x.name]);
 openDialog(id?"تعديل الإعلان":"إضافة إعلان",makeForm("promoForm",
 sectionHeading("معلومات الإعلان","محتوى اللافتة ووجهة الانتقال","sparkles")+
 field("عنوان الإعلان *","title",p.title||"",'required maxlength="90"')+
 field("النص التوضيحي","subtitle",p.subtitle||"")+
 selectField("مكان العرض","placement",[["home","الرئيسية"],["categories","الفئات"],["cart","العربة"]],p.placement||"home")+
 selectField("ربط بمنتج","product_id",[["","بدون منتج"],...choices],p.product_id)+
 selectField("الوجهة","link_url",[["#/categories","جميع المنتجات"],["#/offers","العروض"],["#/home","الرئيسية"],["#/cart","العربة"]],p.link_url||"#/categories")+
 field("الترتيب","sort_order",p.sort_order||0,'type="number" min="0"')+
 sectionHeading("إعدادات الظهور","تحكّم في حالة العرض","eye")+
 booleanSelect("منشور","active",p.active!==false)+
 booleanSelect("صورة جاهزة تحتوي التصميم","artwork_only",p.artwork_only!==false)+
 booleanSelect("إعلان تجريبي","is_demo",p.is_demo===true)+
 sectionHeading("الصور الإعلانية","نسخة للحاسوب ونسخة للهاتف","image")+
 '<label class="field file-picker">صورة الحاسوب (1440 × 480)<span class="file-preview file-preview-banner" data-file-preview="desktop">'+(p.desktop_image_url&&safeUrl(p.desktop_image_url)?'<img src="'+safeUrl(p.desktop_image_url)+'" alt="الإعلان الحالي للحاسوب">':glyph("image")+'<small>تصميم الحاسوب</small>')+'</span><input name="desktop" class="input" type="file" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حد أقصى 1 ميغابايت بعد الضغط</span></label>'+
 '<label class="field file-picker">صورة الهاتف (720 × 900)<span class="file-preview file-preview-banner" data-file-preview="mobile">'+(p.mobile_image_url&&safeUrl(p.mobile_image_url)?'<img src="'+safeUrl(p.mobile_image_url)+'" alt="الإعلان الحالي للهاتف">':glyph("image")+'<small>تصميم الهاتف</small>')+'</span><input name="mobile" class="input" type="file" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حد أقصى 1 ميغابايت بعد الضغط</span></label>'+
 '<input type="hidden" name="id" value="'+html(p.id||"")+'">'+formFooter("حفظ الإعلان")
 ),"promo:"+String(p.id||"new"));
}
function showMember(id){
 const member=id?findRecord("members",id):{};
 const scopes=Object.entries(SCOPE).filter(([k])=>k!=="members");
 openDialog(id?"تعديل صلاحيات المسؤول":"إضافة مسؤول",makeForm("memberForm",
 sectionHeading("حساب المسؤول","إدارة آمنة وصلاحيات محددة","shield-check")+
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
async function saveCategoryImage(input){
 if(!can("categories"))throw Error("هذه الصلاحية غير مفعّلة لحسابك.");
 const id=String(input.dataset.categoryId||"");
 const category=findRecord("categories",id);
 if(!category.id)throw Error("الفئة المحددة غير موجودة، حدّث البيانات.");
 const image=input.files?.[0];
 if(!image)return "";
 if(input.dataset.pending==="true")return "";
 input.dataset.pending="true";
 const picker=input.closest(".category-upload-button");
 if(picker)picker.classList.add("is-uploading");
 const card=input.closest(".category-manager-card");
 if(card)card.classList.add("is-saving");
 try{
  clearAlert();
  const url=await upload(image,"product-images","categories",15360,650,650);
  if(!url)throw Error("تعذّر قراءة الصورة المحددة.");
  // Save only the image: do not overwrite the category name, hierarchy or home visibility.
  await requestSave("categories",{image_url:url},id);
  alertUser("تم رفع صورة «"+category.name+"» وحفظها بنجاح.","success");
  await reload();
  return url;
 }finally{
  input.dataset.pending="false";
  if(picker)picker.classList.remove("is-uploading");
  if(card)card.classList.remove("is-saving");
  input.value="";
 }
}
async function saveTaxonomy(form){
 const f=new FormData(form),table=String(f.get("table")),id=String(f.get("id")||"");
 if(!["categories","brands"].includes(table)||!can(table))throw Error("صلاحية غير متاحة.");
 const name=String(f.get("name")||"").trim();
 if(name.length<2)throw Error("اسم الفئة أو العلامة قصير جداً.");
 const slug=String(f.get("slug")||"").trim()||"bazoo-"+Date.now();
 if(!/^[a-z0-9-]+$/.test(slug))throw Error("المعرّف يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشرطة فقط.");
 const record={name,slug,active:f.get("active")==="true"};
 if(table==="categories"){
  const rows=state.records.categories||[];
  const parentId=f.get("parent_id")?numeric(f.get("parent_id"),"القسم الرئيسي"):null;
  if(parentId){
   const parent=rows.find(x=>String(x.id)===String(parentId));
   if(!parent)throw Error("التصنيف الرئيسي غير موجود.");
   if(String(parentId)===String(id)||categoryAncestors(parent,rows).some(x=>String(x.id)===String(id)))throw Error("لا يمكن ربط تصنيف بنفسه أو بأحد تصنيفاته الفرعية.");
  }
  record.parent_id=parentId;
  record.sort_order=numeric(f.get("sort_order")||0,"الترتيب");
  record.show_on_home=f.get("show_on_home")==="true";
  record.image_url=id?findRecord("categories",id).image_url||null:null;
  const image=form.querySelector('[name="categoryPhoto"]')?.files?.[0];
  if(image)record.image_url=await upload(image,"product-images","categories",15360,650,650);
 }
 await requestSave(table,record,id);
 return table==="categories"?"تم حفظ التصنيف وربطه بالقسم الصحيح وظهوره في المتجر.":"تم حفظ العلامة التجارية والتحقق منها.";
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
 openDialog("تأكيد الحذف",
  '<div class="dialog-confirm"><span class="dialog-confirm-icon">'+glyph("circle-alert")+'</span><div><p>'+html(message)+'</p><small>لا يمكن التراجع عن هذا الإجراء بعد تأكيده.</small></div></div>'+
  '<div class="form-actions"><button type="button" class="button danger" id="confirmAction">'+glyph("check-circle")+'تأكيد الحذف</button><button type="button" class="button secondary" data-action="close">إلغاء</button></div>');
 byId("confirmAction").onclick=async()=>{
  const button=byId("confirmAction");button.disabled=true;
  try{
   const result=await action();closeDialog();alertUser(result,"success");await reload();
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
 byId("content").innerHTML='<section class="auth-wrap surface"><img class="auth-mark" src="./%D8%A8%D8%A7%D8%B2%D9%88%20%D8%A7%D9%81%D9%82%D9%8A.png" alt="شعار بازو"><h2>مرحباً بك في إدارة بازو</h2><p class="help">سجّل الدخول إلى حساب المسؤول المصرّح له للتحكم بمتجرك بأمان.</p>'+
 (message?'<p class="notice-line">'+html(message)+'</p>':"")+
 '<form id="loginForm" class="form-grid" novalidate>'+field("البريد الإلكتروني","email",state.user?.email||"",'type="email" required')+field("كلمة المرور","password","",'type="password" required')+formFooter("تسجيل الدخول")+'</form></section>';
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
   const data=new FormData(form);
   const email=String(data.get("email")||"").trim(),password=String(data.get("password")||"");
   if(!email||!password)throw Error("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
   const auth=await db.auth.signInWithPassword({email,password});
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
document.addEventListener("toggle",event=>{
 if(event.target?.id==="categoryExtraDetails")state.categoryExtrasOpen=event.target.open;
},true);
document.addEventListener("input",event=>{
 if(event.target.id==="categoryManagerSearch"){
  state.categorySearch=String(event.target.value||"");
  const container=byId("categoryManagerGroups");
  if(container)container.innerHTML=categoryManagerGroups();
  const homeGrid=byId("homeCategoryAdminGrid");
  if(homeGrid)homeGrid.innerHTML=categoryHomepageTiles();
  return;
 }
 if(event.target.id==="productSearch"){
  const term=String(event.target.value||"").trim().toLowerCase();
  for(const row of document.querySelectorAll(".data-table tbody tr[data-filter-text]"))row.hidden=!!term&&!row.dataset.filterText.includes(term);
  return;
 }
 if(event.target.closest("#dialogBody form"))saveDraft();
},true);
function updateFilePreview(input){
 if(!input?.files)return;
 const preview=input.closest(".file-picker")?.querySelector(".file-preview");
 if(!preview)return;
 const files=Array.from(input.files);
 if(!files.length)return;
 const first=files[0],url=URL.createObjectURL(first);
 preview.innerHTML='<img alt="معاينة الصورة المرفوعة" src="'+url+'"><small>'+html(files.length>1?files.length+" صور محددة":first.name)+'</small>';
 preview.querySelector("img")?.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
}

document.addEventListener("change",async event=>{
 const control=event.target;
 if(control.id==="categoryMissingOnly"){
  state.categoryMissingOnly=Boolean(control.checked);
  const container=byId("categoryManagerGroups");
  if(container)container.innerHTML=categoryManagerGroups();
  const homeGrid=byId("homeCategoryAdminGrid");
  if(homeGrid)homeGrid.innerHTML=categoryHomepageTiles();
  return;
 }
 if(control.matches?.(".category-photo-input")){
  try{await saveCategoryImage(control)}
  catch(error){console.error("BAZOO category photo",error);alertUser("تعذّر حفظ الصورة: "+(error?.message||"خطأ غير معروف"))}
  return;
 }
 if(!control.matches(".order-status,.order-item-status")){
  if(control.type==="file"&&control.closest("#dialogBody"))updateFilePreview(control);
  if(control.closest("#dialogBody form"))saveDraft();return
 }
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
  if(node.dataset.tab==="members"?state.role!=="owner":!can(node.dataset.tab))return alertUser("هذه الصلاحية غير مفعّلة.");
  state.tab=node.dataset.tab;
  const sidebar=byId("adminSidebar"),backdrop=byId("sidebarBackdrop"),toggle=byId("menuToggle");
  if(sidebar?.classList)sidebar.classList.remove("mobile-open");
  if(backdrop)backdrop.hidden=true;
  if(toggle)toggle.setAttribute?.("aria-expanded","false");
  clearAlert();await reload();return;
 }
 const actionName=node.dataset.action,table=node.dataset.table,id=node.dataset.id;
 if(actionName==="close"){closeDialog();return}
 if(actionName==="new-category-child"){
  if(!can("categories"))return alertUser("هذه الصلاحية غير مفعّلة.");
  showTaxonomy("categories",null,id);return;
 }
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
function closeMobileMenu(){
 const sidebar=byId("adminSidebar"),backdrop=byId("sidebarBackdrop"),toggle=byId("menuToggle");
 sidebar?.classList?.remove("mobile-open");
 if(backdrop)backdrop.hidden=true;
 toggle?.setAttribute?.("aria-expanded","false");
}
function toggleMobileMenu(){
 const sidebar=byId("adminSidebar"),backdrop=byId("sidebarBackdrop"),toggle=byId("menuToggle");
 const opening=!sidebar?.classList?.contains("mobile-open");
 sidebar?.classList?.toggle("mobile-open",opening);
 if(backdrop)backdrop.hidden=!opening;
 toggle?.setAttribute?.("aria-expanded",String(opening));
}
byId("menuToggle")?.addEventListener?.("click",toggleMobileMenu);
byId("sidebarBackdrop")?.addEventListener?.("click",closeMobileMenu);
byId("overlay").addEventListener("click",event=>{if(event.target===byId("overlay"))closeDialog()});
byId("refresh").onclick=async()=>{clearAlert();await reload()};
byId("signOut").onclick=async()=>{await db.auth.signOut();state.user=null;state.adminVerified=false;state.role=null;closeDialog();renderLogin();alertUser("تم تسجيل الخروج.","success")};
window.addEventListener("keydown",event=>{if(event.key==="Escape"&&!byId("overlay").hidden)closeDialog()});
bootPromise=authenticate().catch(err=>{console.error("BAZOO startup",err);renderLogin();alertUser("تعذّر الاتصال بخدمة الإدارة: "+err.message)});
