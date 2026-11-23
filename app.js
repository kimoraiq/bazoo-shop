import { createClient } from "./client.js";
import { createAdmin } from "./admin.js";
const sb=createClient("https://kgghxcxaqmuypcdwubhr.supabase.co","sb_publishable_TZKy9nGrNFu1KqZqBpsw3Q_x17cq1qy",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("en-US").format(Number(n)||0)+" د.ع";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeImg=s=>/^https:\/\//i.test(String(s||""))?esc(s):"";
const icon=(name,size=20,cls="")=>'<svg class="svg-icon '+cls+'" width="'+size+'" height="'+size+'" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>';
const placeholder='<div class="placeholder"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#image"></use></svg></div>';
const label={new:"جديد",confirmed:"تم التأكيد",packing:"قيد التجهيز",shipped:"قيد التوصيل",delivered:"تم التسليم",cancelled:"ملغي"};
const govs=["بغداد","البصرة","نينوى","أربيل","السليمانية","دهوك","صلاح الدين","الأنبار","كركوك","ديالى","بابل","كربلاء","النجف","واسط","ميسان","ذي قار","المثنى","القادسية"];
const state={catalogFailure:false,products:[],productImages:[],categories:[],brands:[],rates:[],promos:[],cart:{},favs:[],galleryIndex:0,user:null,admin:false,adminRole:null,adminPermissions:{},authLoaded:false,authError:"",route:"home",section:"",category:"",brand:"",q:"",promoIndex:0,checkoutPending:false,selectedGovernorate:"",adminTab:"products",editProduct:null};
try{state.cart=JSON.parse(localStorage.getItem("bazoo_cart_v2")||"{}")||{};state.favs=JSON.parse(localStorage.getItem("bazoo_favs_v2")||"[]")||[]}catch(e){}
if(Array.isArray(state.cart)||typeof state.cart!=="object")state.cart={};
if(!Array.isArray(state.favs))state.favs=[];
function persist(){try{localStorage.setItem("bazoo_cart_v2",JSON.stringify(state.cart));localStorage.setItem("bazoo_favs_v2",JSON.stringify(state.favs))}catch(e){};$("#cartBadge").textContent=Object.values(state.cart).reduce((s,n)=>s+Number(n||0),0)||""}
function notify(msg){
 const message=String(msg||"");
 if(state.route==="admin"&&/^(تم|تعذّر|لم |حُفظ|خطأ)/.test(message)){
  state.adminFeedback=message;
  const panel=$("#adminSaveFeedback");
  if(panel){panel.hidden=false;panel.textContent=message;panel.classList.toggle("admin-save-failure",/^(تعذّر|لم |خطأ)/.test(message))}
 }
 const x=$("#toast");x.textContent=message;x.classList.add("show");
 clearTimeout(notify.timer);
 notify.timer=setTimeout(()=>x.classList.remove("show"),5000);
}
function openModal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modalBody").querySelectorAll("form").forEach(f=>f.noValidate=true);$("#modal").classList.add("show");$("#modalBackdrop").classList.add("show");document.body.style.overflow="hidden"}
function closeModal(){$("#modal").classList.remove("show");$("#modalBackdrop").classList.remove("show");document.body.style.overflow=""}
$("#closeModal").onclick=closeModal;$("#modalBackdrop").onclick=closeModal;document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

function confirmAction(title,description,callback){
 openModal(title,'<div class="confirm-shell"><div class="confirm-graphic">'+icon("circle-alert",34)+'</div><p class="subtle">'+esc(description)+'</p><div class="confirm-actions"><button class="btn outline" type="button" id="cancelSiteDialog">إلغاء</button><button class="btn danger" type="button" id="confirmSiteDialog">'+icon("check",17)+' تأكيد الإجراء</button></div></div>');
 $("#cancelSiteDialog").onclick=closeModal;
 $("#confirmSiteDialog").onclick=async()=>{
  const btn=$("#confirmSiteDialog");btn.disabled=true;
  try{const ok=await callback();if(ok!==false)closeModal();}
  catch(e){notify("تعذّر تنفيذ العملية: "+e.message)}
  finally{btn.disabled=false}
 };
}
function validateSiteForm(form){
 const fields=Array.from(form.querySelectorAll("input,select,textarea"));
 const fail=(field,message)=>{
  const box=form.querySelector("#productSaveStatus");
  if(box){
   box.hidden=false;
   box.className="product-save-status fullspan product-status-error";
   box.textContent=message;
   box.scrollIntoView?.({behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth",block:"nearest"});
  }
  notify(message);
  field.focus?.();
  return false;
 };
 for(const field of fields){
  if(field.disabled||field.type==="hidden"||field.type==="file")continue;
  const value=String(field.value||"").trim();
  const label=field.closest("label")?.textContent?.trim()?.slice(0,65)||"الحقل";
  if(field.required&&!value)return fail(field,"يرجى تعبئة: "+label);
  if(!value)continue;
  if(field.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return fail(field,"يرجى إدخال بريد إلكتروني صحيح.");
  if(field.minLength>0&&value.length<field.minLength)return fail(field,"القيمة قصيرة في: "+label);
  if(field.maxLength>0&&value.length>field.maxLength)return fail(field,"القيمة طويلة في: "+label);
  if(field.pattern&&!(new RegExp("^(?:"+field.pattern+")$")).test(value))return fail(field,"صيغة البيانات غير صحيحة في: "+label);
  if(field.type==="number"&&(Number.isNaN(Number(value))||(field.min!==""&&Number(value)<Number(field.min))||(field.max!==""&&Number(value)>Number(field.max))))return fail(field,"أدخل رقماً صحيحاً في: "+label);
 }
 return true;
}
let pendingScroll=null;
function scrollToContent(selector="#app"){
 const target=document.querySelector(selector)||document.querySelector("#app");
 if(!target)return;
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 if(target.scrollIntoView)target.scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});
 else window.scrollTo?.({top:0,behavior:reduced?"auto":"smooth"});
}
function go(route,target="#app"){
 if(route==="admin"){window.location.assign("./admin.html");return}
 pendingScroll=target;
 const next="#/"+route;
 if(location.hash!==next)location.hash=next;
 else render();
}
function catName(id){return state.categories.find(x=>x.id===id)?.name||"منتج"}
function brandName(id){return state.brands.find(x=>x.id===id)?.name||""}
function categoryChain(id){
 const chain=[],seen=new Set();
 let cur=state.categories.find(c=>String(c.id)===String(id));
 for(let i=0;cur&&i<15&&!seen.has(String(cur.id));i++){
  chain.push(cur);seen.add(String(cur.id));
  cur=state.categories.find(c=>String(c.id)===String(cur.parent_id));
 }
 return chain;
}
function descendantIds(id){
 const ids=new Set([String(id)]),stack=[String(id)];
 for(let step=0;stack.length&&step<200;step++){
  const parent=stack.pop();
  state.categories.filter(c=>String(c.parent_id)===parent).forEach(c=>{
   if(!ids.has(String(c.id))){ids.add(String(c.id));stack.push(String(c.id))}
  });
 }
 return ids;
}
const activeProducts=()=>state.products.filter(p=>{
 if(!p.active)return false;
 const b=state.brands.find(x=>x.id===p.brand_id);
 return categoryChain(p.category_id).every(c=>c.active)&&(!b||b.active);
});
function filterProducts({category=state.category||state.section,brand=state.brand,q=state.q,onSale=false}={}){
 const descendants=category?descendantIds(category):null;
 return activeProducts().filter(p=>{
 const matchCat=!category||descendants.has(String(p.category_id));
 return matchCat&&(!brand||String(p.brand_id)===String(brand))&&(!onSale||p.on_sale||(p.compare_at_iqd>p.price_iqd))&&(!q||(p.name+" "+p.description+" "+brandName(p.brand_id)).toLowerCase().includes(q.toLowerCase()));
 });
}
function sectionHead(kicker,title,subtitle=""){return '<div class="section-head"><div><div class="kicker">'+esc(kicker)+'</div><h2>'+esc(title)+'</h2>'+(subtitle?'<p class="subtle">'+esc(subtitle)+'</p>':'')+'</div></div>'}

function imagesForProduct(p){
 const gallery=state.productImages.filter(img=>img.product_id===p.id).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.image_url).filter(safeImg);
 // Always prefer the explicitly selected cover, regardless of gallery order.
 return [...new Set([...(safeImg(p.image_url)?[p.image_url]:[]),...gallery])];
}
function productCard(p){
 const img=imagesForProduct(p)[0]||"",off=p.compare_at_iqd>p.price_iqd&&p.compare_at_iqd>0?Math.round(100*(p.compare_at_iqd-p.price_iqd)/p.compare_at_iqd):0;
 return '<article class="product bazoo-product-card'+(p.is_demo?' demo-product':'')+'">'
 +'<div class="prodimage"><button type="button" class="product-photo-link" data-detail="'+p.id+'" aria-label="عرض تفاصيل '+esc(p.name)+'">'+(img?'<img src="'+safeImg(img)+'" loading="lazy" alt="'+esc(p.name)+'">':placeholder)+'</button>'
 +(off?'<span class="tag sale-tag">خصم '+off+'%</span>':p.featured?'<span class="tag sale-tag">مميز</span>':'')
 +'<button type="button" class="card-favorite heart '+(state.favs.includes(p.id)?'on':'')+'" data-fav="'+p.id+'" aria-label="إضافة للمفضلة">'+icon("heart",19)+'</button></div>'
 +'<div class="prodinfo"><div class="product-meta">'+esc(brandName(p.brand_id)||catName(p.category_id))+(p.is_demo?'<span class="demo-pill">تجريبي</span>':'')+'</div>'
 +'<button type="button" class="product-title-link" data-detail="'+p.id+'">'+esc(p.name)+'</button>'
 +'<div class="price-row"><strong class="cost">'+money(p.price_iqd)+'</strong>'+(off?'<span class="old">'+money(p.compare_at_iqd)+'</span>':'')+'</div>'
 +(p.is_demo?'<div class="demo-price-note">سعر للعرض فقط</div>':'')
 +'<div class="product-card-actions"><button class="btn primary card-cart-btn" data-add="'+p.id+'" '+(p.stock<1?'disabled':'')+'>'+icon("shopping-bag",17)+(p.stock<1?' غير متوفر':' أضف للعربة')+'</button></div></div></article>';
}
function productGrid(ps){return ps.length?'<div class="grid-products">'+ps.map(productCard).join("")+'</div>':'<div class="notice">لا توجد منتجات منشورة في هذا القسم حالياً. ستظهر المنتجات هنا فور إضافتها من فريق بازو. </div>'}
function productRail(products,id){
 if(!products.length)return homeEmpty("منتجات جديدة قريباً","ستظهر منتجات هذا القسم فور إضافتها من فريق المتجر.","package");
 return '<div class="rail-container" data-rail="'+id+'"><button class="rail-arrow rail-back" data-rail-move="1" data-rail-id="'+id+'" aria-label="منتجات سابقة">'+icon("chevron-right",22)+'</button><div class="rail-scroll" data-rail-track="'+id+'" tabindex="0" aria-label="مرر لاستعراض بقية المنتجات">'+products.map(productCard).join("")+'</div><button class="rail-arrow rail-next attention" data-rail-move="-1" data-rail-id="'+id+'" aria-label="اسحب لرؤية بقية المنتجات">'+icon("chevron-left",22)+'</button></div>';
}
function railSection(id,kicker,title,products,route){
 if(!products.length)return '';
 return '<section class="home-section home-rail-section"><div class="rail-heading"><div><div class="kicker">'+esc(kicker)+'</div><h2>'+esc(title)+'</h2></div><button class="section-link" '+(route==='offers'?'data-go="offers"':route==='categories'?'data-go="categories"':'data-main-cat="'+esc(route)+'"')+'>استكشف المزيد '+icon("arrow-left",16)+'</button></div>'+productRail(products,id)+'</section>';
}

function promoFrame(place){const x=state.promos.filter(p=>p.active&&p.placement===place);if(!x.length)return "";const p=x[state.promoIndex%x.length];return '<div class="promo-frame">'+(p.image_url&&safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="'+esc(p.title)+'">':'')+'<h2>'+esc(p.title)+'</h2><p class="subtle">'+esc(p.subtitle)+'</p>'+(p.link_url?.startsWith("#/")?'<a href="'+esc(p.link_url)+'" class="btn accent">اكتشف المزيد</a>':'')+(x.length>1?'<div class="row" style="margin-top:15px"><button class="btn outline" data-slide="-1">السابق</button><span>'+((state.promoIndex%x.length)+1)+' / '+x.length+'</span><button class="btn outline" data-slide="1">التالي</button></div>':'')+'</div>'}

const slugIcons={"home-appliances":"building","installation":"plug","devices-games":"laptop","accessories":"headphones","phones":"smartphone","office-supplies":"clipboard","school-supplies":"book-open","smart-watches":"clock","headphones":"headphones","laptops":"laptop","tablets":"smartphone","screens":"image","mobile-phones":"smartphone","refrigerators":"building","washing-machines":"settings","air-conditioners":"settings","cookers":"plug","cooking-appliances":"package","vacuum-cleaners":"settings","heaters":"sparkles"};
const slugEmoji={"smart-watches":"⌚","headphones":"🎧","laptops":"💻","tablets":"📱","screens":"📺","mobile-phones":"📱","refrigerators":"🧊","washing-machines":"🧺","air-conditioners":"❄️","cookers":"🍳","cooking-appliances":"🍟","vacuum-cleaners":"🧹","heaters":"♨️","home-appliances":"🏠","installation":"🔌","devices-games":"🎮","accessories":"🎧","phones":"📱","office-supplies":"📁","school-supplies":"📚"};
const homeCategoryDefaults=[
 {name:"أجهزة منزلية",slug:"home-appliances"},{name:"مواد تأسيس",slug:"installation"},
 {name:"أجهزة وألعاب",slug:"devices-games"},{name:"ملحقات",slug:"accessories"},
 {name:"هواتف",slug:"phones"},{name:"مواد مكتبية",slug:"office-supplies"},{name:"مواد دراسية",slug:"school-supplies"}
];
const defaultSlides=[
 {title:"تسوّق بكل راحة،",accent:"واختر ما يناسب ذوقك.",subtitle:"أجهزة كهربائية وإلكترونيات وقرطاسية في مكان واحد. اكتشف أقسامنا واختر ما تحتاج إليه.",icon:"shopping-bag",extra:"laptop",secondary:"smartphone",route:"categories",cta:"اكتشف المنتجات"},
 {title:"كل ما يحتاج إليه منزلك،",accent:"أصبح أقرب إليك.",subtitle:"اكتشف الأجهزة المنزلية ومستلزمات التأسيس من العلامات التجارية التي تبحث عنها.",icon:"building",extra:"plug",secondary:"package",slug:"appliances",cta:"تسوّق الأجهزة"},
 {title:"للعمل والدراسة",accent:"وأوقات الترفيه.",subtitle:"من الهواتف والملحقات إلى الأجهزة والألعاب والقرطاسية؛ خيارات متنوعة في مكان واحد.",icon:"laptop",extra:"headphones",secondary:"book-open",slug:"electronics",cta:"استكشف الإلكترونيات"}
];
function storefrontSlides(){
 const promos=state.promos.filter(p=>p.active&&p.placement==="home");
 if(promos.length)return promos.map(p=>{
  const linked=state.products.find(x=>x.id===p.product_id&&x.active);
  return {title:p.title,subtitle:p.subtitle,demo:!!p.is_demo||!!linked?.is_demo,artworkOnly:!!p.artwork_only,
   desktop:p.desktop_image_url||p.image_url||linked?.image_url,mobile:p.mobile_image_url||p.desktop_image_url||p.image_url||linked?.image_url,
   productId:linked?.id||null,
   route:/^#\/(home|categories|offers|cart)$/.test(p.link_url||"")?p.link_url.slice(2):"categories",
   cta:linked?"اكتشف المنتج":"تسوّق الآن"};
 });
 const photo=state.products.find(p=>p.active&&p.featured&&safeImg(p.image_url))?.image_url||null;
 return [{title:"تسوّق بسهولة من BAZOO",subtitle:"كل ما يحتاج إليه المنزل من الإلكترونيات والأجهزة والقرطاسية. اختر ما يناسبك.",desktop:photo,mobile:photo,demo:!state.products.some(p=>!p.is_demo),route:"categories",cta:"اكتشف المنتجات"}];
}
function drawHero(){
 const slides=storefrontSlides(),idx=((state.promoIndex%slides.length)+slides.length)%slides.length,slide=slides[idx];
 const desktop=safeImg(slide.desktop),mobile=safeImg(slide.mobile);
 const picture=desktop?'<picture class="merch-picture">'+(mobile?'<source media="(max-width: 600px)" srcset="'+mobile+'">':'')+'<img src="'+desktop+'" alt="'+esc(slide.title)+'" loading="eager" decoding="async"></picture>':'';
 const action=slide.productId?'data-detail="'+esc(slide.productId)+'"':'data-go="'+esc(slide.route||"categories")+'"';
 const galleryArtwork=picture&&slide.artworkOnly;
 const inner=galleryArtwork?
  '<div class="merch-slider-inner photo-layout final-banner">'+picture+'<button type="button" class="banner-artwork-link" '+action+' aria-label="'+esc(slide.title)+'"></button></div>':
  '<div class="merch-slider-inner '+(picture?'photo-layout':'plain-layout')+'">'+picture+(picture?'<div class="merch-scrim"></div>':'')
  +'<div class="merch-content">'+(slide.demo?'<span class="merch-demo-stamp">إعلان تجريبي</span>':'')
  +'<span class="merch-eyebrow">'+icon("sparkles",17)+' خيارات BAZOO</span><h1>'+esc(slide.title)+'</h1>'
  +'<p>'+esc(slide.subtitle||"")+'</p><div class="hero-buttons"><button class="btn accent" '+action+'>'+esc(slide.cta||"تسوّق الآن")+' '+icon("arrow-left",17)+'</button></div></div></div>';
 return inner+'<div class="slider-controls"><button data-slide="-1" aria-label="العرض السابق">'+icon("chevron-right",18)+'</button>'
  +'<div class="slider-dots" aria-label="شرائح العروض">'+slides.map((p,i)=>'<button data-slide-to="'+i+'" class="'+(idx===i?'active':'')+'" aria-label="العرض '+(i+1)+'" aria-current="'+(idx===i?'true':'false')+'"></button>').join("")+'</div>'
  +'<button data-slide="1" aria-label="العرض التالي">'+icon("chevron-left",18)+'</button></div>';
}
function categoryPhoto(c){
 const src=safeImg(c.image_url);
 if(src)return '<img class="category-thumb" src="'+src+'" alt="'+esc(c.name)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
 // For new categories, reuse actual product photographs until an admin uploads a dedicated cover.
 const ids=c.id?descendantIds(c.id):null;
 const product=ids?activeProducts().find(p=>ids.has(String(p.category_id))&&safeImg(p.image_url)):null;
 if(product)return '<img class="category-thumb" src="'+safeImg(product.image_url)+'" alt="'+esc(c.name)+'" loading="lazy" decoding="async">';
 return '<span class="category-image-missing" aria-label="لا توجد صورة لهذا التصنيف">'+icon("image",22)+'</span>';
}
function activeCategoriesOnHome(){
 const list=state.categories.filter(c=>c.active&&c.parent_id&&c.show_on_home!==false&&categoryChain(c.id).every(x=>x.active));
 const group=slug=>list.filter(c=>categoryChain(c.id).some(p=>p.slug===slug));
 const order=(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"ar");
 return [...group("electronics").sort(order),...group("appliances").sort(order),...group("stationery").sort(order),
 ...list.filter(c=>!["electronics","appliances","stationery"].some(slug=>categoryChain(c.id).some(p=>p.slug===slug))).sort(order)];
}
// Curated BAZOO homepage category order follows the approved 2 x 8 visual reference.
// Presentation order is independent from the real parent_id hierarchy in Supabase.
// A visible tile always navigates using that category's real database ID.
const homeCategoryOrder=[
 "offers","phones","screens","tablets","devices-games","laptops","headphones","smart-watches",
 "heaters","washing-machines","refrigerators","air-conditioners",
 "cookers","cooking-appliances","vacuum-cleaners","perfumes"
];
const homeCategoryDisplayNames={
 "devices-games":"الألعاب","refrigerators":"ثلاجات",
 "air-conditioners":"السبلت","washing-machines":"الغسالات والمجففات"
};
function categoryCircles(){
 const available=state.categories.filter(c=>c.active&&c.show_on_home!==false&&categoryChain(c.id).every(ancestor=>ancestor.active));
 const categoryBySlug=new Map(available.map(c=>[c.slug,c]));
 const tiles=homeCategoryOrder.map((slug,index)=>{
  if(slug==="offers"){
   const promo=state.promos.find(p=>p.active&&(p.desktop_image_url||p.image_url));
   const cover=safeImg(promo?.desktop_image_url||promo?.image_url);
   const visual=cover?'<img class="bazoo-category-image" src="'+cover+'" alt="العروض المميزة" loading="lazy" decoding="async">':'<span class="bazoo-offer-logo"><span class="bazoo-offer-mark">BAZOO</span><strong>عروض</strong><small>مميزة</small></span>';
   return '<a class="bazoo-category-tile bazoo-category-offers" href="#/offers" aria-label="العروض المميزة" data-position="'+index+'"><span class="bazoo-category-circle">'+visual+'</span><strong class="bazoo-category-title">العروض المميزة</strong></a>';
  }
  const category=categoryBySlug.get(slug);
  if(!category)return "";
  const display=homeCategoryDisplayNames[slug]||category.name;
  return '<a class="bazoo-category-tile" href="#/categories/'+encodeURIComponent(category.id)+'" data-category-id="'+category.id+'" data-parent-id="'+esc(category.parent_id??"")+'" data-position="'+index+'" aria-label="تسوق '+esc(display)+'"><span class="bazoo-category-circle">'+categoryPhoto(category)+'</span><strong class="bazoo-category-title">'+esc(display)+'</strong></a>';
 }).join("");
 return '<div class="bazoo-category-heading"><div><span class="bazoo-category-kicker">اكتشف منتجاتنا</span><h2>تسوّق حسب الفئة</h2></div><a href="#/categories" class="bazoo-category-all">جميع الفئات '+icon("arrow-left",15)+'</a></div>'+
 '<div class="bazoo-category-scroller" aria-label="التصنيفات" tabindex="0"><div class="bazoo-category-grid" role="navigation" aria-label="تسوّق حسب الفئة">'+tiles+'</div></div>';
}
function homeEmpty(title,description,iconName="package"){
 return '<div class="home-empty"><div><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div><span class="home-empty-icon">'+icon(iconName,40)+'</span></div>';
}
function brandGallery(){
 const fallback=["جورنجي","DLC","LG","توشيبا","هايسنس","ميديا","نوال","TCL","بوش","رويال","كرين","برو","كينود","سوني","سامسونج","أبل","ريلمي","أوبو","تكنو","هونر","شاومي"];
 const list=state.brands.length?state.brands.filter(b=>b.active):fallback.map(name=>({name,id:null}));
 return '<div class="brand-gallery">'+list.map(b=>'<button class="brand-chip" '+(b.id?'data-brand="'+b.id+'"':'data-go="categories"')+'>'+icon("tag",15)+'<strong>'+esc(b.name)+'</strong></button>').join("")+'</div>';
}
function home(){
 const products=activeProducts();
 const offers=products.filter(p=>p.on_sale||(p.compare_at_iqd!=null&&p.compare_at_iqd>p.price_iqd));
 const featured=products.filter(p=>p.featured);
 const catProducts=slug=>{const c=state.categories.find(x=>x.slug===slug);if(!c)return [];const ids=descendantIds(c.id);return products.filter(p=>ids.has(String(p.category_id)))};
 return '<div class="home-main"><section class="merch-slider alt-'+(state.promoIndex%3)+'" id="heroSlider" aria-label="العروض الرئيسية">'+drawHero()+'</section>'
 +'<section class="home-section bazoo-category-explorer" id="homeCategoryExplorer" aria-label="تسوّق حسب الفئة">'+categoryCircles()+'</section>'
 +railSection("offers","خيارات خاصة","أفضل العروض",offers,"offers")
 +railSection("featured","مختارة لك","منتجات مميزة",featured.length?featured:products.slice(0,9),"categories")
 +railSection("electrical","كل ما يحتاج إليه المنزل","الأجهزة الكهربائية",catProducts("appliances"),"appliances")
 +railSection("tech","تقنيات حديثة","الإلكترونيات",catProducts("electronics"),"electronics")
 +railSection("study","للعمل والدراسة","القرطاسية",catProducts("stationery"),"stationery")
 +'<section class="home-section">'+sectionHead("اختر العلامة التجارية التي تثق بها","العلامات التجارية")+brandGallery()+'</section>'
 +'<section class="benefits home-benefits"><div class="benefit"><i>'+icon("truck",25)+'</i><div><strong>توصيل إلى جميع أنحاء العراق</strong><small>وفق رسوم التوصيل لكل محافظة</small></div></div><div class="benefit"><i>'+icon("package",25)+'</i><div><strong>منتجات متنوعة</strong><small>الفريق يحدّثها باستمرار</small></div></div><div class="benefit"><i>'+icon("shield-check",25)+'</i><div><strong>طلب آمن</strong><small>مع متابعة حالة الطلب</small></div></div><div class="benefit"><i>'+icon("headphones",25)+'</i><div><strong>تسوّق بكل سهولة</strong><small>عبر الهاتف والحاسوب</small></div></div></section></div>';
}
function brandsPage(){
 return '<div class="page"><div class="section-head"><div><div class="kicker">BRANDS AT BAZOO</div><h1>العلامات التجارية</h1><p class="subtle">اختر العلامة التجارية لعرض منتجاتها المتوفرة في المتجر.</p></div></div>'+brandGallery()+'</div>';
}
function favoritesPage(){
 const products=activeProducts().filter(p=>state.favs.includes(p.id));
 return '<div class="page"><h1>المفضلة</h1><p class="subtle">منتجاتك المحفوظة على هذا الجهاز</p>'+productGrid(products)+'</div>';
}
function filters(){
 const roots=state.categories.filter(c=>c.active&&!c.parent_id);
 const root=roots.find(c=>String(c.id)===String(state.section));
 const children=root?state.categories.filter(c=>c.active&&c.parent_id&&String(c.id)!==String(root.id)&&categoryChain(c.id).some(x=>String(x.id)===String(root.id))&&categoryChain(c.id).every(x=>x.active)):[];
 children.sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),"ar"));
 const options=children.map(c=>{
  const trail=categoryChain(c.id).slice(0,-1).reverse().filter(x=>String(x.id)!==String(root.id));
  const name=trail.length?trail.map(x=>x.name).join(" / ")+" / "+c.name:c.name;
  return '<option value="'+c.id+'" '+(String(c.id)===String(state.category)?'selected':'')+'>'+esc(name)+'</option>';
 }).join("");
 return '<div class="filter-panel bazoo-catalog-filters">'
 +'<label>القسم الرئيسي<select id="categoryFilter" aria-label="القسم الرئيسي"><option value="">جميع الأقسام</option>'+roots.map(c=>'<option value="'+c.id+'" '+(String(c.id)===String(state.section)?'selected':'')+'>'+esc(c.name)+'</option>').join("")+'</select></label>'
 +'<label>الفئة<select id="subcategoryFilter" aria-label="الفئة التابعة للقسم" '+(!root||!children.length?'disabled':'')+'><option value="">'+(!root?'اختر القسم أولاً':children.length?'كل فئات '+esc(root.name):'لا توجد فئات فرعية')+'</option>'+options+'</select></label>'
 +'<label>العلامة التجارية<select id="brandFilter" aria-label="العلامة التجارية"><option value="">كل العلامات</option>'+state.brands.filter(b=>b.active).map(b=>'<option value="'+b.id+'" '+(String(b.id)===String(state.brand)?'selected':'')+'>'+esc(b.name)+'</option>').join("")+'</select></label>'
 +'<label>بحث عن منتج<input class="field" id="filterSearch" aria-label="بحث عن منتج" value="'+esc(state.q)+'" placeholder="اسم المنتج أو العلامة التجارية..."></label></div>';
}
function categories(){
 const selected=state.categories.find(c=>String(c.id)===String(state.category||state.section));
 const childCats=selected?state.categories.filter(c=>c.active&&String(c.parent_id)===String(selected.id)):[];
 const title=selected?selected.name:"الفئات والعلامات التجارية";
 const breadcrumbs=selected?'<div class="category-breadcrumb"><a href="#/home">الرئيسية</a>'+icon("chevron-left",14)+'<a href="#/categories">جميع المنتجات</a>'+categoryChain(selected.id).reverse().map(c=>icon("chevron-left",14)+'<span>'+esc(c.name)+'</span>').join("")+'</div>':"";
 return '<div class="page category-results-page">'+breadcrumbs+'<h1>'+esc(title)+'</h1><p class="subtle">'+(selected?"استكشف المنتجات المرتبطة بهذا التصنيف والتصنيفات التابعة له.":"حدد القسم أو العلامة التجارية لعرض المنتجات المناسبة.")+'</p>'
 +(childCats.length?'<div class="category-child-links">'+childCats.map(c=>'<a href="#/categories/'+encodeURIComponent(c.id)+'" class="category-child-chip">'+categoryPhoto(c)+'<span>'+esc(c.name)+'</span></a>').join("")+'</div>':"")
 +promoFrame("categories")+'<div id="catalogFilters">'+filters()+'</div>'
 +'<div class="section" id="categoryResults">'+sectionHead("المنتجات",selected?"منتجات "+selected.name:"اكتشف المنتجات")
 +productGrid(filterProducts())+'</div></div>';
}
function offers(){return '<div class="page"><h1>عروض بازو <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#percent"></use></svg></h1><p class="subtle">المنتجات المختارة للتخفيضات والعروض من قبل الفريق</p>'+productGrid(filterProducts({category:"",brand:"",q:"",onSale:true}))+'</div>'}
function market(){return '<div class="page"><div class="notice" style="margin:45px auto;max-width:600px"><div class="empty-illustration"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#store"></use></svg></div><h1>أضف متجرك</h1><p>سيتوفر هذا القسم قريباً. نعمل على تقديم تجربة مميزة لأصحاب المتاجر.</p><button class="btn primary" data-go="home">الرجوع للرئيسية</button></div></div>'}
function cartEntries(){return Object.entries(state.cart).map(([id,qty])=>({p:state.products.find(p=>p.id===id),qty:Number(qty)})).filter(x=>x.p&&x.qty>0)}
function subtotal(){return cartEntries().reduce((s,x)=>s+x.p.price_iqd*x.qty,0)}
function cart(){
 const rows=cartEntries();

 return '<div class="page"><h1>عربة التسوّق <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#shopping-bag"></use></svg></h1><p class="subtle">راجع المنتجات قبل تأكيد الطلب.</p>'+(!rows.length?'<div class="notice"><h2>سلة التسوق فارغة حالياً.</h2><button class="btn accent" data-go="categories">ابدأ التسوق</button></div>':'<div class="two-col"><section class="card"><h2 class="sectiontitle">المنتجات ('+rows.length+')</h2>'+rows.map(({p,qty})=>'<div class="cartrow"><div class="cartpic">'+(safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="'+esc(p.name)+'">':placeholder)+'</div><div><strong>'+esc(p.name)+'</strong><p class="cost">'+money(p.price_iqd)+'</p><div class="qty"><button data-qty="'+p.id+'" data-step="-1"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#minus"></use></svg></button>'+qty+'<button data-qty="'+p.id+'" data-step="1" '+(qty>=p.stock?"disabled":"")+'><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg></button></div></div><button class="btn danger" data-remove="'+p.id+'">حذف</button></div>').join("")+'</section><aside class="card"><h2 class="sectiontitle">ملخص الطلب</h2><div class="row summaryline"><span>مجموع المنتجات</span><strong>'+money(subtotal())+'</strong></div><div class="formgroup province-field"><span>محافظة التوصيل</span><input id="cartGovernorate" type="hidden" value=""><button type="button" class="province-trigger" data-province-context="cart">'+icon("map-pin",20)+' <span id="cartProvinceLabel">اختر المحافظة</span>'+icon("chevron-left",18)+'</button></div><div class="row summaryline"><span>التوصيل</span><strong id="shippingPrice">اختر المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="grandTotal">'+money(subtotal())+' + التوصيل</strong></div><button class="btn accent" id="toCheckout" style="width:100%;margin-top:19px">متابعة الطلب <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button><p class="note">يتطلب تأكيد الطلب حساباً مسجلاً. يتوفر الدفع عند الاستلام أو التنسيق عبر واتساب. المنتجات التجريبية مخصصة للعرض فقط.</p></aside></div>')+'<section class="section">'+sectionHead("قد يعجبك أيضاً","منتجات مشابهة")+productGrid(activeProducts().filter(p=>!state.cart[p.id]).slice(0,4))+'</section>'+promoFrame("cart")+'</div>';
}
function checkout(){if(!cartEntries().length)return cart();if(!state.user){state.checkoutPending=true;return authView("أكمل التسجيل أو سجّل الدخول لتأكيد طلبك.");}

 return '<div class="page"><h1>تأكيد الطلب</h1><p class="subtle">تحقق من معلوماتك وتفاصيل التوصيل قبل إرسال طلبك.</p><div class="two-col"><form class="card" id="orderForm"><div class="formgrid"><label class="formgroup">الاسم الكامل *<input name="customer_name" required minlength="2" maxlength="120" class="field" autocomplete="name"></label><label class="formgroup">رقم الهاتف * (11 رقم)<input name="phone" class="field" inputmode="numeric" autocomplete="tel" required pattern="07[0-9]{9}" minlength="11" maxlength="11" placeholder="07XXXXXXXXX"></label><div class="formgroup province-field"><span>المحافظة *</span><input name="governorate" type="hidden" id="orderGovernorate" value=""><button type="button" class="province-trigger" data-province-context="order">'+icon("map-pin",20)+' <span id="orderProvinceLabel">اختر المحافظة</span>'+icon("chevron-left",18)+'</button></div><div class="formgroup"><span>طريقة الدفع *</span><div class="payment-choices"><label><input type="radio" name="payment" value="cod" checked><span>'+icon("wallet",20)+' الدفع عند الاستلام</span></label><label><input type="radio" name="payment" value="whatsapp"><span>'+icon("credit-card",20)+' التنسيق للدفع عبر واتساب</span></label></div></div><label class="formgroup fullspan">العنوان الكامل وأقرب معلم *<textarea class="field" name="address" minlength="8" maxlength="500" required placeholder="المنطقة، الشارع، رقم المنزل، وأقرب معلم"></textarea></label><label class="formgroup fullspan">ملاحظات (اختياري)<textarea name="note" class="field" maxlength="1000"></textarea></label></div><p class="note">يُحفظ الطلب في النظام بعد تأكيده. يشير خيار واتساب إلى التنسيق مع فريق المتجر، وليس إلى دفع إلكتروني فوري.</p><button class="btn accent" type="submit">تأكيد الطلب وحفظه <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button></form><aside class="card"><h2 class="sectiontitle">تفاصيل طلبك</h2>'+cartEntries().map(({p,qty})=>'<div class="row summaryline"><span>'+esc(p.name)+' × '+qty+'</span><strong>'+money(p.price_iqd*qty)+'</strong></div>').join("")+'<div class="row summaryline"><strong>المنتجات</strong><strong>'+money(subtotal())+'</strong></div><div class="row summaryline"><span>أجور التوصيل</span><strong id="checkoutShip">اختر المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="checkoutTotal">'+money(subtotal())+' + التوصيل</strong></div></aside></div></div>';
}
function authView(title="حسابك في بازو"){
 return '<section class="page auth-page"><div class="auth-shell"><div class="auth-form-panel"><a class="auth-back" href="#/home">'+icon("arrow-right",16)+' رجوع للمتجر</a><div class="auth-symbol">'+icon("user-round",29)+'</div><div class="auth-heading"><span class="kicker">BAZOO MEMBERS</span><h1>'+esc(title)+'</h1><p class="subtle">سجّل الدخول لمتابعة طلباتك، أو أنشئ حساباً جديداً خلال لحظات.</p></div><div class="auth-tabs" role="group" aria-label="نوع الدخول"><button type="button" class="active" data-auth-mode="login">'+icon("log-in",18)+' تسجيل الدخول</button><button type="button" data-auth-mode="signup">'+icon("user-plus",18)+' حساب جديد</button></div><form id="authForm" class="stack"><input type="hidden" name="mode" value="login"><label class="formgroup auth-signup-field hidden">الاسم الكامل<span class="input-icon">'+icon("user",19)+'<input type="text" name="full_name" class="field" minlength="2" maxlength="100" autocomplete="name" placeholder="اسمك الكامل"></span></label><label class="formgroup">البريد الإلكتروني<span class="input-icon">'+icon("mail",19)+'<input type="email" name="email" class="field" required autocomplete="email" placeholder="example@email.com" dir="ltr"></span></label><label class="formgroup">كلمة المرور<span class="input-icon auth-password">'+icon("lock",19)+'<input type="password" name="password" class="field" required minlength="6" autocomplete="current-password" placeholder="أدخل كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><label class="formgroup auth-signup-field hidden">تأكيد كلمة المرور<span class="input-icon auth-password">'+icon("shield-check",19)+'<input type="password" name="confirm_password" class="field" minlength="6" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="confirm_password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><button type="button" class="forgot-link" id="resetPassword">نسيت كلمة المرور؟</button><button type="submit" class="btn primary auth-submit">'+icon("log-in",19)+' تسجيل الدخول</button></form><p id="authMessage" class="auth-feedback" role="status" aria-live="polite"></p><div class="auth-footnote">'+icon("shield-check",17)+' بيانات حسابك محمية بنظام Supabase Auth</div></div><aside class="auth-art"><div class="auth-art-orbit one"></div><div class="auth-art-orbit two"></div><div class="auth-art-content"><div class="auth-art-logo">'+icon("shopping-bag",52)+'</div><div class="auth-art-kicker">مرحباً بك في BAZOO</div><h2>جميع خياراتك،<br>في مكان واحد.</h2><p>تسوّق بسهولة، واحتفظ بطلباتك، وتابع أحدث المنتجات من بازو.</p><div class="auth-benefit">'+icon("package",20)+' تتبع الطلبات من حسابك</div><div class="auth-benefit">'+icon("shield-check",20)+' تسجيل آمن وسهل</div><div class="auth-benefit">'+icon("shopping-cart",20)+' سلة تسوق محفوظة على جهازك</div></div></aside></div></section>';
}

/* Order history and individual product tracking — customer experience. */
const trackingSteps=["new","confirmed","packing","shipped","delivered"];
const orderDateTime=value=>new Date(value).toLocaleString("ar-IQ",{timeZone:"Asia/Baghdad",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
function customerOrderTimeline(status){
 if(status==="cancelled")return '<div class="tracking-cancelled">'+icon("circle-alert",18)+' تم إلغاء الطلب</div>';
 const position=trackingSteps.indexOf(status);
 return '<div class="tracking-steps" aria-label="مراحل متابعة الطلب">'+trackingSteps.map((key,i)=>'<div class="tracking-step '+(i<position?'completed':i===position?'current':'')+'">'
  +'<span class="tracking-step-dot">'+(i<position?icon("check",13):String(i+1))+'</span><span>'+esc(label[key])+'</span></div>').join("")+'</div>';
}
function customerOrderLine(item,order){
 const product=state.products.find(p=>p.id===item.product_id);
 const cover=product?.image_url&&safeImg(product.image_url)?'<img src="'+safeImg(product.image_url)+'" alt="'+esc(item.product_name)+'" loading="lazy">':icon("package",27);
 const link=item.product_id?'<a href="#/product/'+encodeURIComponent(item.product_id)+'" class="order-product-link">'+icon("arrow-up-right",16)+' عرض المنتج</a><button type="button" data-copy-order-product="'+esc(item.product_id)+'" class="order-copy-link">'+icon("clipboard",15)+' نسخ الرابط</button>':'<small class="order-product-unavailable">المنتج غير متوفر حالياً</small>';
 return '<article class="customer-order-line"><div class="customer-order-cover">'+cover+'</div>'
 +'<div class="customer-order-line-info"><strong>'+esc(item.product_name)+'</strong>'
 +'<small>الكمية: '+Number(item.quantity)+' × '+money(item.unit_price_iqd)+'</small>'
 +'<div class="order-product-links">'+link+'</div></div>'
 +'<div class="customer-order-line-aside"><span class="order-state-badge state-'+esc(item.status||order.status)+'">'+esc(label[item.status||order.status]||"قيد المتابعة")+'</span>'
 +'<strong>'+money(Number(item.unit_price_iqd)*Number(item.quantity))+'</strong></div></article>';
}
function customerOrderCard(order){
 const items=Array.isArray(order.order_items)?order.order_items:[];
 const payment=order.payment_method==="cod"?"الدفع عند الاستلام":"التنسيق عبر واتساب";
 return '<article class="customer-order-card"><header class="customer-order-top"><div><span>طلب رقم '+esc(String(order.id).slice(0,8).toUpperCase())+'</span>'
 +'<h3>تفاصيل الطلب</h3><p>'+icon("clock",15)+' '+esc(orderDateTime(order.created_at))+' · '+esc(order.governorate)+'</p></div>'
 +'<span class="order-state-badge state-'+esc(order.status)+'">'+esc(label[order.status]||"قيد المتابعة")+'</span></header>'
 +customerOrderTimeline(order.status)
 +'<div class="customer-order-items-heading">'+icon("package",17)+' المنتجات المطلوبة <span>'+items.length+'</span></div>'
 +'<div class="customer-order-lines">'+items.map(item=>customerOrderLine(item,order)).join("")+'</div>'
 +'<footer class="customer-order-footer"><div class="customer-order-receipt"><span>المنتجات <strong>'+money(order.subtotal_iqd)+'</strong></span>'
 +'<span>التوصيل <strong>'+money(order.shipping_iqd)+'</strong></span><span>طريقة الدفع <strong>'+payment+'</strong></span></div>'
 +'<div class="customer-order-total"><small>إجمالي الطلب</small><strong>'+money(order.total_iqd)+'</strong></div></footer></article>';
}
async function account(){
 if(!state.user)return authView();
 const {data,error}=await sb.from("orders").select("id,created_at,status,subtotal_iqd,shipping_iqd,total_iqd,governorate,payment_method,order_items(id,product_id,product_name,quantity,unit_price_iqd,line_total_iqd,status)").order("created_at",{ascending:false}).limit(60);
 const orders=data||[];
 return '<div class="page customer-orders-page">'
 +'<div class="customer-account-head"><div><span class="customer-account-kicker">'+icon("shopping-bag",17)+' حساب بازو</span><h1>طلباتي ومتابعة الشحن</h1>'
 +'<p class="user-info">'+esc(state.user.email||"")+'</p></div><div class="customer-account-buttons"><button type="button" class="btn outline" id="refreshMyOrders">'+icon("refresh",17)+' تحديث الطلبات</button><button class="btn outline" id="signOut">'+icon("arrow-left",17)+' تسجيل الخروج</button></div></div>'
 +'<div class="customer-orders-intro"><div>'+icon("truck",22)+'</div><p>تابع كل طلب ومنتجاته خطوة بخطوة. يتم تحديث الحالات من إدارة المتجر، ويمكنك الضغط على «تحديث الطلبات» للاطلاع على آخر التغييرات.</p></div>'
 +'<div class="customer-orders-list">'+(error?'<div class="orders-empty"><h3>تعذّر تحميل الطلبات</h3><p>'+esc(error.message||"يرجى إعادة المحاولة.")+'</p></div>'
 :!orders.length?'<div class="orders-empty">'+icon("shopping-bag",34)+'<h3>ليس لديك طلبات بعد</h3><p>اكتشف منتجات بازو وابدأ طلبك الأول.</p><button type="button" class="btn primary" data-go="categories">استكشف المنتجات</button></div>'
 :orders.map(customerOrderCard).join(""))+'</div></div>';
}

function productDetailsPage(id){
 const p=state.products.find(x=>x.id===id&&x.active);
 if(!p)return '<section class="page"><div class="notice">المنتج غير متوفر. <button class="btn primary" data-go="categories">استكشف المنتجات</button></div></section>';
 const photos=imagesForProduct(p),main=photos[0],specs=p.specifications&&typeof p.specifications==="object"&&!Array.isArray(p.specifications)?Object.entries(p.specifications):[];
 const sale=p.compare_at_iqd>p.price_iqd;
 const thumbs=photos.map((src,i)=>'<button class="gallery-thumb '+(!i?'active':'')+'" type="button" data-gallery-index="'+i+'" aria-label="اعرض الصورة '+(i+1)+'" aria-pressed="'+(!i)+'"><img src="'+safeImg(src)+'" alt="الصورة '+(i+1)+'"></button>').join("");
 const related=activeProducts().filter(x=>x.id!==p.id&&x.category_id===p.category_id).slice(0,8);
 return '<section class="page product-page"><nav class="product-breadcrumb"><button data-go="home">الرئيسية</button>'+icon("chevron-left",15)+'<button data-go="categories">'+esc(catName(p.category_id))+'</button>'+icon("chevron-left",15)+'<span>'+esc(p.name)+'</span></nav>'
 +'<div class="product-detail-grid"><div class="gallery-panel"><div class="gallery-main">'+(main?'<img id="productPrimaryPhoto" src="'+safeImg(main)+'" alt="'+esc(p.name)+'">':placeholder)
 +(p.is_demo?'<span class="gallery-demo">نموذج للمعاينة</span>':'')+'</div>'
 +(photos.length>1?'<div class="gallery-controls"><button type="button" data-gallery-step="-1" aria-label="الصورة السابقة">'+icon("chevron-right",19)+'</button><span id="galleryCounter">1 / '+photos.length+'</span><button type="button" data-gallery-step="1" aria-label="الصورة التالية">'+icon("chevron-left",19)+'</button></div><div class="gallery-thumbs">'+thumbs+'</div>':'')+'</div>'
 +'<div class="product-detail-info"><span class="product-kicker">'+esc(brandName(p.brand_id)||catName(p.category_id))+'</span><h1>'+esc(p.name)+'</h1>'
 +'<div class="detail-price-block"><strong>'+money(p.price_iqd)+'</strong>'+(sale?'<del>'+money(p.compare_at_iqd)+'</del><span class="detail-discount-badge">خصم '+Math.round((p.compare_at_iqd-p.price_iqd)*100/p.compare_at_iqd)+'%</span>':'')+'</div>'
 +(p.is_demo?'<p class="demo-alert">'+icon("circle-alert",19)+' هذا منتج تجريبي للعرض فقط، ولا يمكن إتمام شرائه.</p>':'')
 +'<div class="stock-indicator">'+icon(p.stock>0?"check-circle":"circle-alert",18)+(p.stock>0?"متوفر في المخزون":"غير متوفر حالياً")+'</div>'
 +'<p class="detail-description">'+esc(p.description||"تظهر تفاصيل المنتج هنا بعد إضافتها من إدارة بازو.")+'</p>'
 +'<div class="detail-actions"><button class="btn accent" data-add="'+p.id+'" '+(p.stock<1?'disabled':'')+'>'+icon("shopping-bag",20)+' أضف للعربة</button><button class="btn outline" data-fav="'+p.id+'">'+icon("heart",18)+' المفضلة</button></div>'
 +'<div class="detail-delivery">'+icon("truck",20)+' من بازو إلى باب منزلك في جميع أنحاء العراق. تظهر رسوم التوصيل قبل تأكيد الطلب.</div>'
 +'</div></div>'
 +(specs.length?'<section class="detail-specs"><h2>المواصفات</h2><div class="spec-table">'+specs.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div></section>':'')
 +(related.length?'<section class="home-rail-section product-related"><div class="rail-heading"><h2>منتجات مشابهة</h2><button class="section-link" data-go="categories">استكشف المزيد '+icon("arrow-left",16)+'</button></div>'+productRail(related,"related")+'</section>':'')+'</section>';
}
function changeGallery(index){
 const page=document.querySelector(".product-page");if(!page)return;
 const id=decodeURIComponent(location.hash.split("/")[2]||"");
 const p=state.products.find(x=>x.id===id);if(!p)return;
 const photos=imagesForProduct(p);if(!photos.length)return;
 const next=(index+photos.length)%photos.length;
 const photo=document.querySelector("#productPrimaryPhoto");if(photo)photo.src=safeImg(photos[next]);
 const counter=document.querySelector("#galleryCounter");if(counter)counter.textContent=(next+1)+" / "+photos.length;
 document.querySelectorAll(".gallery-thumb").forEach((b,i)=>{b.classList.toggle("active",i===next);b.setAttribute("aria-pressed",String(i===next));});
 state.galleryIndex=next;
}
function detail(id){go("product/"+id);}
function add(id){const p=state.products.find(x=>x.id===id);if(!p||p.stock<=0)return notify("المنتج غير متوفر");const qty=Number(state.cart[id]||0);if(qty>=p.stock)return notify("لقد وصلت إلى الحد المتوفر من المخزون.");state.cart[id]=Math.min(99,qty+1);persist();notify("تمت إضافة المنتج إلى سلة التسوق. ")}
function updateQty(id,delta){const p=state.products.find(x=>x.id===id);if(!p)return;const qty=Number(state.cart[id]||0)+delta;if(qty<=0)delete state.cart[id];else state.cart[id]=Math.min(qty,p.stock,99);persist();render()}
function toggleFav(id){state.favs=state.favs.includes(id)?state.favs.filter(x=>x!==id):[...state.favs,id];persist();render()}
function authMode(mode){
 const f=$("#authForm");if(!f)return;
 f.elements.mode.value=mode;
 f.querySelector("button[type=submit]").innerHTML=mode==="signup"?icon("user-plus",19)+" إنشاء الحساب":icon("log-in",19)+" تسجيل الدخول";
 f.querySelector("input[name=password]").autocomplete=mode==="signup"?"new-password":"current-password";
 f.querySelector("input[name=full_name]").required=mode==="signup";
 f.querySelector("input[name=confirm_password]").required=mode==="signup";
 document.querySelectorAll(".auth-signup-field").forEach(el=>el.classList.toggle("hidden",mode!=="signup"));
 document.querySelectorAll("[data-auth-mode]").forEach(x=>{x.classList.toggle("active",x.dataset.authMode===mode);x.setAttribute("aria-pressed",String(x.dataset.authMode===mode))});
 const reset=$("#resetPassword");if(reset)reset.classList.toggle("hidden",mode==="signup");
 const feedback=$("#authMessage");if(feedback)feedback.textContent="";
}
async function authSubmit(f){
 const data=new FormData(f),email=data.get("email").trim(),password=data.get("password"),mode=data.get("mode");
 if(mode==="signup"&&password!==data.get("confirm_password")){const message=$("#authMessage");if(message){message.textContent="كلمتا المرور غير متطابقتين. يرجى التحقق من إدخالهما.";message.classList.add("error")}return}
 const button=f.querySelector("button[type=submit]");button.disabled=true;
 try{const res=mode==="signup"?await sb.auth.signUp({email,password,options:{data:{full_name:String(data.get("full_name")||"").trim()}}}):await sb.auth.signInWithPassword({email,password});if(res.error)throw res.error;
 if(mode==="signup"&&!res.data.session){$("#authMessage").textContent="أُرسل رابط تأكيد إلى بريدك الإلكتروني. يرجى تأكيد حسابك ثم تسجيل الدخول.";return}
 notify(mode==="signup"?"تم إنشاء الحساب":"تم تسجيل الدخول");
 await refreshAuth();go(state.checkoutPending?"checkout":"account");
 }catch(e){$("#authMessage").textContent="تعذّر تسجيل الدخول: "+e.message}finally{button.disabled=false}
}

async function checkAdmin(){
 // Always ask the server to identify the logged-in user from its verified JWT.
 // Do not infer permissions from email, local storage or stale page state.
 const account=state.user;
 state.admin=false;
 state.adminRole=null;
 state.adminPermissions={};
 state.authError="";
 if(!account?.id){renderCategoryNav();return}
 const userId=account.id;
 try{
  const {data,error}=await sb.rpc("my_admin_access");
  if(state.user?.id!==userId)return;
  if(!error&&data&&String(data.user_id)===String(userId)&&
      ["owner","full","limited"].includes(data.role)){
   state.admin=true;
   state.adminRole=data.role;
   state.adminPermissions=data.permissions&&typeof data.permissions==="object"?data.permissions:{};
  }else if(error){
   // Allow the previous self-row lookup as a compatibility fallback.
   const direct=await sb.from("admin_members").select("user_id,role,permissions").eq("user_id",userId).maybeSingle();
   if(state.user?.id!==userId)return;
   if(!direct.error&&direct.data&&String(direct.data.user_id)===String(userId)&&
      ["owner","full","limited"].includes(direct.data.role)){
    state.admin=true;
    state.adminRole=direct.data.role;
    state.adminPermissions=direct.data.permissions&&typeof direct.data.permissions==="object"?direct.data.permissions:{};
   }else state.authError=direct.error?.message||error.message||"تعذّر تحميل صلاحيات حساب المسؤول.";
  }
 }catch(err){
  if(state.user?.id===userId)state.authError=err.message||"تعذّر التحقق من صلاحيات المسؤول.";
 }
 renderCategoryNav();
}
function renderCategoryNav(){
 const root=document.querySelector("#categoryNav");if(!root)return;
 const main=state.categories.filter(c=>c.active&&!c.parent_id);
 if(!main.length)return;
 const links=(state.admin?'<button type="button" class="category-nav-link admin-top-action" data-go="admin" aria-label="افتح لوحة الإدارة">'+icon("shield-check",18)+' <span class="admin-button-label">لوحة الإدارة</span></button>':"")
  +'<button class="category-nav-link" data-go="home">'+icon("home",18)+' الرئيسية</button><button class="category-nav-link" data-go="categories">'+icon("grid",18)+' الكل</button>'
  +main.map(c=>'<button class="category-nav-link" data-cat="'+c.id+'">'+icon(c.slug==="appliances"?"plug":c.slug==="electronics"?"laptop":c.slug==="stationery"?"book-open":"grid",18)+' '+esc(c.name)+'</button>').join("")
  +'<button class="category-nav-link" data-go="brands">'+icon("tag",18)+' العلامات التجارية</button><button class="category-nav-link" data-go="offers">'+icon("percent",18)+' العروض</button><button class="category-nav-link nav-admin-entry" data-go="market">'+icon("store",18)+' أضف متجرك</button>';
 root.innerHTML=links;
}
let catalogLoadVersion=0;
async function loadCatalog(){
 const thisLoad=++catalogLoadVersion;
 const requests=[
  ["categories",()=>sb.from("categories").select("*").order("sort_order")],
  ["brands",()=>sb.from("brands").select("*").order("name")],
  ["products",()=>sb.from("products").select("*").order("created_at",{ascending:false})],
  ["productImages",()=>sb.from("product_images").select("*").order("sort_order")],
  ["rates",()=>sb.from("shipping_rates").select("*").order("governorate")],
  ["promos",()=>sb.from("promotions").select("*").order("sort_order")]
 ];
 const results=await Promise.allSettled(requests.map(async ([name,request])=>{
  const result=await request();
  if(result.error)throw Error(name+": "+result.error.message);
  return result.data||[];
 }));
 if(thisLoad!==catalogLoadVersion)return false; // A newer load must never be overwritten by stale responses.
 let failed=false;
 results.forEach((out,i)=>{
  if(out.status==="fulfilled")state[requests[i][0]]=out.value;
  else {failed=true;console.warn("BAZOO catalog:",out.reason);}
 });
 state.catalogFailure=failed;renderCategoryNav();
 return !failed;
}
async function refreshAuth(){
 state.authLoaded=false;
 try{
  const {data,error}=await sb.auth.getUser();
  state.user=data?.user||null;
  await checkAdmin();
  if(error)state.authError=error.message||"تعذّر التحقق من جلسة تسجيل الدخول.";
 }catch(err){
  state.user=null;state.admin=false;state.adminRole=null;state.adminPermissions={};
  state.authError=err.message||"تعذّر الاتصال بخدمة تسجيل الدخول.";
 }finally{state.authLoaded=true}
}
async function submitOrder(f){
 const d=new FormData(f),p=String(d.get("phone")).trim();
 if(cartEntries().some(x=>x.p.is_demo))return notify("توجد منتجات تجريبية في السلة؛ لا يمكن تأكيد شرائها.");
 if(!/^07[0-9]{9}$/.test(p))return notify("يجب أن يتكون رقم الهاتف من 11 رقماً وأن يبدأ بـ 07.");
 const governorate=String(d.get("governorate"));if(!state.rates.some(x=>x.governorate===governorate&&x.enabled))return notify("التوصيل غير متوفر لهذه المحافظة حالياً");
 const items=cartEntries().map(({p,qty})=>({id:p.id,quantity:qty}));if(!items.length)return notify("العربة فارغة");
 const btn=f.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="جارٍ حفظ الطلب...";
 const {data,error}=await sb.rpc("place_order",{p_items:items,p_name:d.get("customer_name"),p_phone:p,p_governorate:governorate,p_address:d.get("address"),p_note:d.get("note")||"",p_payment_method:d.get("payment")});
 btn.disabled=false;btn.innerHTML="تأكيد الطلب وحفظه "+icon("arrow-left",18);
 if(error){notify("تعذّر حفظ الطلب: "+error.message);await loadCatalog();return}
 state.cart={};state.checkoutPending=false;persist();await loadCatalog();notify("تم حفظ طلبك بنجاح ");go("account");openModal("تم تأكيد طلبك",'<p>استلمنا طلبك داخل النظام بنجاح.</p><p>رقم الطلب: <strong>'+esc(data)+'</strong></p><p class="subtle">يمكنك متابعة حالة الطلب من صفحة حسابك. إذا اخترت التنسيق عبر واتساب، فيمكنك التواصل مع المتجر بعد توفير رقم التواصل الرسمي.</p><button class="btn primary" id="doneOrder">مشاهدة طلباتي</button>');$("#doneOrder").onclick=closeModal;
}
function openProvincePicker(context){
 const current=context==="cart"?"cart":"order";
 const enabled=new Map(state.rates.filter(x=>x.enabled).map(x=>[x.governorate,x.price_iqd]));
 const items=govs.map(g=>'<button type="button" class="province-item" data-pick-province="'+esc(g)+'" data-province-target="'+current+'" '+(!enabled.has(g)?'disabled':'')+'><span class="province-name">'+icon("map-pin",16)+' '+esc(g)+'</span><span class="province-rate">'+(enabled.has(g)?money(enabled.get(g)):"الأجور قيد التحديد")+'</span></button>').join("");
 openModal("اختيار محافظة التوصيل",'<div class="province-sheet"><p>نوفر التوصيل إلى جميع محافظات العراق. المحافظات التي لم تُحدد أجور توصيلها بعد ستظهر إلى حين اعتمادها من فريق بازو.</p><div class="province-search">'+icon("search",18)+'<input id="provinceSearch" placeholder="ابحث عن محافظة..." autocomplete="off" aria-label="ابحث عن محافظة"></div><div class="province-list">'+items+'</div></div>');
}
function chooseProvince(name,context){
 const input=document.querySelector(context==="cart"?"#cartGovernorate":"#orderGovernorate");
 if(!input)return;
 input.value=name;state.selectedGovernorate=name;
 const label=document.querySelector(context==="cart"?"#cartProvinceLabel":"#orderProvinceLabel");
 if(label)label.textContent=name;
 input.dispatchEvent(new Event("change",{bubbles:true}));
 closeModal();
}
function shippingBind(sel,ship,total){
 const s=$(sel);if(!s)return;s.addEventListener("change",()=>{const rate=state.rates.find(x=>x.governorate===s.value&&x.enabled);const label=document.querySelector(s.id==="cartGovernorate"?"#cartProvinceLabel":"#orderProvinceLabel");if(label)label.textContent=s.value||"اختر المحافظة";$(ship).textContent=rate?money(rate.price_iqd):"اختر محافظة متاحة";$(total).textContent=rate?money(subtotal()+rate.price_iqd):money(subtotal())+" + التوصيل"});
}
const {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo,saveTaxonomy,saveMember}=createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon,confirmAction});
async function render(){
 const hash=decodeURIComponent(location.hash.replace(/^#\/?/,""))||"home";const parts=hash.split("/");const route=parts[0]||"home";state.route=route;
 if(route==="categories"&&parts[1]){
  const selected=state.categories.find(c=>String(c.id)===String(parts[1]));
  if(selected){
   const root=categoryChain(selected.id).at(-1);
   state.section=root?String(root.id):"";
   state.category=selected.parent_id?String(selected.id):"";
  }else{state.section="";state.category="";}
 }else if(route==="categories"){
  // Returning to the unfiltered catalog (including browser Back) clears stale section/child choices.
  state.section="";state.category="";
 }
 if(route==="admin"){window.location.replace("./admin.html");return;}
 document.querySelectorAll("#bottomNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 document.querySelectorAll("#categoryNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 let content="";
 if(route==="home")content=home();else if(route==="categories")content=categories();else if(route==="offers")content=offers();else if(route==="brands")content=brandsPage();else if(route==="product"){state.galleryIndex=0;content=productDetailsPage(parts[1]||"");}else if(route==="favorites")content=favoritesPage();else if(route==="cart")content=cart();else if(route==="checkout")content=checkout();else if(route==="account")content=await account();else if(route==="market")content=market();else if(route==="admin")content=state.admin?await adminPage():'<div class="page"><div class="notice admin-access-notice"><h2>التحقق من حساب المسؤول</h2>'
 +(state.authLoaded?'<p>'+(state.user?'الحساب المسجّل حالياً: <strong>'+esc(state.user.email||"غير معروف")+'</strong>. ':'لا توجد جلسة تسجيل دخول نشطة. ')
 +(state.authError?'تعذّر التحقق من الصلاحيات: '+esc(state.authError):state.user?'لم يتم العثور على صلاحيات إدارة لهذا الحساب. تأكد من استخدام حساب المالك الرئيسي.':'يرجى تسجيل الدخول بحساب المالك الرئيسي.')+'</p>':'<p>جارٍ التحقق من تسجيل الدخول وصلاحيات الإدارة...</p>')
 +'<div class="admin-access-actions"><button class="btn primary" data-go="account">'+(state.user?'إدارة الحساب':'تسجيل الدخول')+'</button>'
 +'<button class="btn outline" id="retryAdminAccess" type="button">إعادة التحقق من الصلاحيات</button></div></div></div>';else content=home();
 if(state.route!==route)return;
 if(state.catalogFailure)content='<div class="connection-notice" role="alert">'+icon("circle-alert",20)+' <span>تعذّر الاتصال بقاعدة بيانات بازو. تأكد من الإنترنت ثم أعد المحاولة.</span> <button class="btn outline" id="retryCatalog">'+icon("refresh",16)+' إعادة المحاولة</button></div>'+content;
 $("#app").innerHTML=content;$("#app").querySelectorAll("form").forEach(f=>f.noValidate=true);
 if(pendingScroll){const destination=pendingScroll;pendingScroll=null;scrollToContent(destination)}
 if(route==="cart"){const g=$("#cartGovernorate");if(g){g.value=state.selectedGovernorate;g.addEventListener("change",()=>state.selectedGovernorate=g.value);}shippingBind("#cartGovernorate","#shippingPrice","#grandTotal");if(g)g.dispatchEvent(new Event("change"))}
 if(route==="checkout"){const g=$("#orderGovernorate");if(g)g.value=state.selectedGovernorate;shippingBind("#orderGovernorate","#checkoutShip","#checkoutTotal");g?.dispatchEvent(new Event("change"))}
 if(route==="admin")bindAdmin();
}
document.addEventListener("click",async e=>{
 const b=e.target.closest('button,[data-detail],a[href^="#/"]');if(!b)return;
 if(b.tagName==="A"&&b.getAttribute("href")?.startsWith("#/")){
  e.preventDefault();
  const dest=decodeURIComponent(b.getAttribute("href").slice(2));
  if(dest.startsWith("categories/")){
   const selected=state.categories.find(c=>String(c.id)===dest.slice("categories/".length));
   const root=selected?categoryChain(selected.id).at(-1):null;
   state.section=root?String(root.id):"";
   state.category=selected?.parent_id?String(selected.id):"";
   state.brand="";state.q="";
  }else if(dest==="categories"){state.section="";state.category="";state.brand="";state.q="";}
  go(dest,dest.startsWith("categories/")?"#categoryResults":"#app");
  return;
 }
 if(b.id==="refreshMyOrders"){await render();notify("تم تحديث عرض الطلبات.");return}
 if(b.dataset.copyOrderProduct){
  const url=location.origin+location.pathname+"#/product/"+encodeURIComponent(b.dataset.copyOrderProduct);
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
   else{const temp=document.createElement("textarea");temp.value=url;temp.style.position="fixed";temp.style.opacity="0";document.body.append(temp);temp.select();if(!document.execCommand("copy"))throw Error("copy failed");temp.remove();}
   notify("تم نسخ رابط المنتج.");
  }catch(e){notify("تعذّر نسخ الرابط؛ يمكنك فتح صفحة المنتج ونسخ عنوانها من المتصفح.");}
  return;
 }
 if(b.dataset.provinceContext){openProvincePicker(b.dataset.provinceContext);return}
 if(b.dataset.pickProvince){chooseProvince(b.dataset.pickProvince,b.dataset.provinceTarget);return}
 if(b.dataset.go){if($("#modal").classList.contains("show"))closeModal();if(b.dataset.go==="categories"){state.section="";state.category="";state.brand="";state.q="";}if(b.dataset.go==="admin"){await refreshAuth();if(!state.admin){notify("يرجى تسجيل الدخول بحساب مسؤول المتجر ثم إعادة المحاولة.");go("account");return}}go(b.dataset.go);return}
 if(b.dataset.mainCat){const c=state.categories.find(x=>x.slug===b.dataset.mainCat);state.section=c?String(c.id):"";state.category="";state.brand="";state.q="";go(c?"categories/"+encodeURIComponent(c.id):"categories","#catalogFilters");return}
 if(b.dataset.brand){state.brand=b.dataset.brand;state.section="";state.category="";state.q="";go("categories","#catalogFilters");return}
 if(b.dataset.cat){const selected=state.categories.find(c=>String(c.id)===String(b.dataset.cat));const root=selected?categoryChain(selected.id).at(-1):null;state.section=root?String(root.id):"";state.category=selected?.parent_id?String(selected.id):"";state.brand="";state.q="";go("categories/"+encodeURIComponent(b.dataset.cat),"#categoryResults");return}
 if(b.dataset.galleryIndex!==undefined){changeGallery(Number(b.dataset.galleryIndex));return}
 if(b.dataset.galleryStep){changeGallery((state.galleryIndex||0)+Number(b.dataset.galleryStep));return}
 if(b.dataset.add){add(b.dataset.add);return}
 if(b.dataset.detail){detail(b.dataset.detail);return}
 if(b.dataset.fav){toggleFav(b.dataset.fav);return}
 if(b.dataset.qty){updateQty(b.dataset.qty,Number(b.dataset.step));return}
 if(b.dataset.remove){delete state.cart[b.dataset.remove];persist();render();return}
 if(b.dataset.railMove){const rail=document.querySelector('[data-rail-track="'+b.dataset.railId+'"]');if(rail){const amount=Math.max(240,rail.clientWidth*.78);rail.scrollBy({left:Number(b.dataset.railMove)*amount,behavior:"smooth"});b.closest(".rail-container")?.classList.add("rail-visited")}return}
 if(b.dataset.slideTo!==undefined){state.promoIndex=Number(b.dataset.slideTo);const el=$("#heroSlider");if(el){el.innerHTML=drawHero();el.className="merch-slider alt-"+(state.promoIndex%3)}return}
 if(b.dataset.slide){state.promoIndex=Math.max(0,state.promoIndex+Number(b.dataset.slide));const hero=$("#heroSlider");if(hero){hero.innerHTML=drawHero();hero.className="merch-slider alt-"+(state.promoIndex%3)}else render();return}
 if(b.dataset.authMode){authMode(b.dataset.authMode);return}
 if(b.dataset.passwordToggle){const input=document.querySelector('#authForm input[name="'+b.dataset.passwordToggle+'"]');if(input){const show=input.type==="password";input.type=show?"text":"password";b.innerHTML=icon(show?"eye-off":"eye",19);b.setAttribute("aria-label",show?"إخفاء كلمة المرور":"إظهار كلمة المرور")}return}
 if(b.id==="toCheckout"){if(cartEntries().some(x=>x.p.is_demo)){openModal("طلب تجريبي للمعاينة",'<p class="subtle">تحتوي سلة التسوق على منتجات تجريبية بأسعار توضيحية. يمكنك تصفحها، لكن تأكيد الشراء متاح للمنتجات الفعلية فقط.</p><button class="btn primary" data-go="categories">استعرض المنتجات</button>');return}if(!$("#cartGovernorate").value)return notify("يرجى اختيار المحافظة لحساب رسوم التوصيل.");state.selectedGovernorate=$("#cartGovernorate").value;go("checkout");return}
 if(b.id==="retryCatalog"){await loadCatalog();render();return}
 if(b.id==="retryAdminAccess"){b.disabled=true;try{await refreshAuth();await loadCatalog();await render()}finally{b.disabled=false}return}
 if(b.id==="resetPassword"){const email=$('#authForm input[name="email"]')?.value.trim();if(!email)return notify("يرجى إدخال البريد الإلكتروني أولاً.");const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"#/account"});notify(error?error.message:"إذا كان البريد الإلكتروني مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.");return}
 if(b.id==="signOut"){await sb.auth.signOut();state.user=null;state.admin=false;state.adminRole=null;state.adminPermissions={};renderCategoryNav();notify("تم تسجيل الخروج");go("home");return}
 if(b.dataset.adminTab){state.adminTab=b.dataset.adminTab;state.editProduct=null;pendingScroll="#adminTabContent";render();return}
 if(b.dataset.editProduct){state.editProduct=b.dataset.editProduct;pendingScroll="#adminTabContent";render();return}
 if(b.id==="newProduct"){state.editProduct="new";pendingScroll="#adminTabContent";render();return}
 if(b.dataset.editPromo){showPromoEditor(b.dataset.editPromo);return}
 if(b.id==="newPromo"){showPromoEditor("new");return}
});
document.addEventListener("change",e=>{
 if(e.target.id==="categoryFilter"){
  state.section=e.target.value;state.category="";
  go(state.section?"categories/"+encodeURIComponent(state.section):"categories","#catalogFilters");
  return;
 }
 if(e.target.id==="subcategoryFilter"){
  state.category=e.target.value;
  go(state.category?"categories/"+encodeURIComponent(state.category):state.section?"categories/"+encodeURIComponent(state.section):"categories","#catalogFilters");
  return;
 }
 if(e.target.id==="brandFilter"){state.brand=e.target.value;render()}
});
let searchDebounce;document.addEventListener("input",e=>{
 if(e.target.id==="provinceSearch"){const q=e.target.value.trim();document.querySelectorAll(".province-item").forEach(x=>x.hidden=!x.textContent.includes(q));return}
 if(e.target.id==="filterSearch"){clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>{state.q=e.target.value;const old=document.activeElement?.selectionStart;render();const x=$("#filterSearch");x?.focus();if(typeof old==="number")x?.setSelectionRange(old,old)},400)}});
// Prevent browser navigation for every admin form, even if a later handler errors.
document.addEventListener("submit",e=>{
 const id=e.target?.id||"";
 if(id==="searchForm"||id==="authForm"||id==="orderForm"||id.startsWith("admin"))e.preventDefault();
},true);
document.addEventListener("submit",async e=>{
 const form=e.target,id=form?.id||"";
 if(id==="searchForm"){e.preventDefault();state.q=$("#searchBox").value.trim();state.section="";state.category="";state.brand="";go("categories","#categoryResults");return}
 if(!["authForm","orderForm","adminProductForm","adminPromoForm","adminTaxonomyForm","adminMemberForm"].includes(id))return;
 e.preventDefault();
 if(form.dataset?.saveInProgress==="true")return;
 if(!validateSiteForm(form))return;
 if(form.dataset)form.dataset.saveInProgress="true";
 try{
  if(id==="authForm")await authSubmit(form);
  else if(id==="orderForm")await submitOrder(form);
  else if(id==="adminProductForm")await saveProduct(form);
  else if(id==="adminPromoForm")await savePromo(form);
  else if(id==="adminTaxonomyForm")await saveTaxonomy(form);
  else if(id==="adminMemberForm")await saveMember(form);
 }catch(error){
  console.error("BAZOO save error:",error);
  notify("تعذّر إتمام الحفظ: "+(error?.message||"حدث خطأ غير متوقع."));
 }finally{if(form.dataset)delete form.dataset.saveInProgress}
});
$("#accountBtn").onclick=()=>go("account");$("#cartBtn").onclick=()=>go("cart");$("#favoritesBtn").onclick=()=>go("favorites");$("#year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.dataset.detail){e.preventDefault();detail(e.target.dataset.detail)}});
window.addEventListener("hashchange",()=>{if(!pendingScroll)pendingScroll="#app";render()});
setInterval(()=>{if(state.route!=="home"||document.hidden||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const hero=$("#heroSlider");if(!hero)return;state.promoIndex=(state.promoIndex+1)%storefrontSlides().length;hero.innerHTML=drawHero();hero.className="merch-slider alt-"+(state.promoIndex%3)},7000);
sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT"){setTimeout(async()=>{await refreshAuth();if(["account","admin","checkout"].includes(state.route))render()},0)}});
persist();
render();
(async()=>{try{await refreshAuth();await loadCatalog();await render()}catch(error){console.error("BAZOO startup error:",error);state.catalogFailure=true;await render()}})();
