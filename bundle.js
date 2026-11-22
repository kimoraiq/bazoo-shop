/* BAZOO browser bundle */
/**
 * BAZOO minimal native Supabase HTTP client.
 * Eliminates the third-party JS CDN dependency.
 * Uses Supabase Auth, PostgREST, RPC and Storage with the publishable key only.
 */
function createClient(baseUrl, publishableKey) {
  const base=String(baseUrl).replace(/\/$/,"");
  const storageKey="bazoo-auth-session";
  const listeners=new Set();
  let session=null;
  try{const s=JSON.parse(localStorage.getItem(storageKey)||"null");if(s?.access_token&&s?.refresh_token)session=s;}catch(e){}
  const save=()=>{try{session?localStorage.setItem(storageKey,JSON.stringify(session)):localStorage.removeItem(storageKey);}catch(e){}};
  const emit=(event)=>listeners.forEach(fn=>{try{fn(event,session)}catch(e){console.warn("Auth callback error",e)}});
  const getToken=async()=>{
    if(!session?.access_token)return null;
    const expires=Number(session.expires_at||0);
    if(!expires||expires>Date.now()/1000+60)return session.access_token;
    try{
      const res=await rawFetch("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:session.refresh_token})},false);
      if(!res.ok)throw new Error(res.error?.message||"Session expired");
      setSession(res.data);
      return session?.access_token||null;
    }catch(e){session=null;save();emit("SIGNED_OUT");return null}
  };
  const setSession=data=>{
    if(!data?.access_token)return;
    session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
    save();emit("SIGNED_IN");
  };
  const rawFetch=async(path,options={},authorize=true)=>{
    const headers=new Headers(options.headers||{});
    headers.set("apikey",publishableKey);
    if(!headers.has("Content-Type") && !(options.body instanceof Blob) && !(options.body instanceof FormData))headers.set("Content-Type","application/json");
    if(authorize){const token=await getToken();if(token)headers.set("Authorization","Bearer "+token)}
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),10000);
    try{
      const response=await fetch(base+path,{...options,headers,signal:ctrl.signal,mode:"cors",cache:"no-store"});
      const txt=await response.text();
      let data=null;try{data=txt?JSON.parse(txt):null}catch(e){data=txt||null}
      if(!response.ok)return {data:null,error:{message:data?.message||data?.msg||data?.error_description||data?.error||("HTTP "+response.status),status:response.status},ok:false,status:response.status};
      return {data,error:null,ok:true,status:response.status};
    }catch(error){return {data:null,error:{message:error.name==="AbortError"?"انتهت مهلة الاتصال بقاعدة البيانات":error.message||"تعذر الاتصال"},ok:false,status:0}}
    finally{clearTimeout(timeout)}
  };
  const auth={
    async getUser(){
      const token=await getToken();
      if(!token)return {data:{user:null},error:null};
      const r=await rawFetch("/auth/v1/user",{method:"GET"});
      if(r.error&&r.error.status===401){session=null;save();}
      return {data:{user:r.data||null},error:r.error};
    },
    async signInWithPassword({email,password}){
      const r=await rawFetch("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})},false);
      if(r.ok)setSession(r.data);
      return {data:r.data||{session:null,user:null},error:r.error};
    },
    async signUp({email,password,options={}}){
      const r=await rawFetch("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:options.data||{}})},false);
      if(r.ok&&r.data?.access_token)setSession(r.data);
      return {data:{user:r.data?.user||r.data||null,session:r.data?.access_token?r.data:null},error:r.error};
    },
    async signOut(){
      const token=session?.access_token;
      session=null;save();emit("SIGNED_OUT");
      if(token)await rawFetch("/auth/v1/logout",{method:"POST",headers:{Authorization:"Bearer "+token}},false);
      return {error:null};
    },
    async resetPasswordForEmail(email,{redirectTo}={}){
      const query=redirectTo?"?redirect_to="+encodeURIComponent(redirectTo):"";
      const r=await rawFetch("/auth/v1/recover"+query,{method:"POST",body:JSON.stringify({email})},false);
      return {data:r.data,error:r.error};
    },
    onAuthStateChange(callback){listeners.add(callback);return {data:{subscription:{unsubscribe(){listeners.delete(callback)}}}};}
  };
  class Query{
    constructor(table){this.table=table;this.params=new URLSearchParams();this.method="GET";this.body=undefined;this.one=false;this.maybe=false;this.returnRows=false;}
    select(fields="*"){this.params.set("select",fields);if(this.method!=="GET")this.returnRows=true;return this;}
    order(field,{ascending=true}={}){this.params.set("order",field+"."+(ascending?"asc":"desc"));return this;}
    limit(n){this.params.set("limit",String(n));return this;}
    eq(field,value){this.params.set(field,"eq."+String(value));return this;}
    insert(body){this.method="POST";this.body=body;return this;}
    update(body){this.method="PATCH";this.body=body;return this;}
    delete(){this.method="DELETE";return this;}
    single(){this.one=true;return this;}
    maybeSingle(){this.one=true;this.maybe=true;return this;}
    async execute(){
      const headers={};
      if(this.returnRows)headers.Prefer="return=representation";
      const q=this.params.toString();
      const r=await rawFetch("/rest/v1/"+encodeURIComponent(this.table)+(q?"?"+q:""),{method:this.method,headers,body:this.body===undefined?undefined:JSON.stringify(this.body)});
      if(r.error){if(this.maybe&&r.status===406)return {data:null,error:null};return {data:null,error:r.error}}
      const data=this.one?(Array.isArray(r.data)?(r.data[0]||null):r.data):r.data;
      if(this.one&&!data&&!this.maybe)return {data:null,error:{message:"Row not found"}};
      return {data,error:null};
    }
    then(resolve,reject){return this.execute().then(resolve,reject)}
  }
  const from=table=>new Query(table);
  const rpc=async(name,args)=>{
    const r=await rawFetch("/rest/v1/rpc/"+encodeURIComponent(name),{method:"POST",body:JSON.stringify(args||{})});
    return {data:r.data,error:r.error};
  };
  const storage={
    from(bucket){return {
      async upload(filename,file,{contentType}={}){
        const path="/storage/v1/object/"+encodeURIComponent(bucket)+"/"+filename.split("/").map(encodeURIComponent).join("/");
        const r=await rawFetch(path,{method:"POST",body:file,headers:{"Content-Type":contentType||file.type||"application/octet-stream"}});
        return {data:r.data,error:r.error};
      },
      getPublicUrl(filename){
        return {data:{publicUrl:base+"/storage/v1/object/public/"+encodeURIComponent(bucket)+"/"+filename.split("/").map(encodeURIComponent).join("/")}}
      }
    }}
  };
  return {auth,from,rpc,storage};
}

;
function createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon}){
const brandOpts=()=>state.brands.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
const catOpts=()=>state.categories.filter(x=>x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
function editor(p={}){
return '<div class="card"><div class="row"><h2>'+ (p.id?"تعديل":"إضافة")+' منتج</h2><button id="cancelEdit" class="btn outline"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-right"></use></svg> رجوع</button></div><form id="adminProductForm" class="formgrid"><input type="hidden" name="id" value="'+esc(p.id||"")+'"><label class="formgroup fullspan">اسم المنتج *<input name="name" required minlength="2" maxlength="180" class="field" value="'+esc(p.name||"")+'"></label><label class="formgroup">القسم *<select name="category_id" class="field" required><option value="">اختر القسم</option>'+catOpts()+'</select></label><label class="formgroup">العلامة التجارية<select name="brand_id" class="field"><option value="">بدون علامة</option>'+brandOpts()+'</select></label><label class="formgroup">السعر بالدينار *<input type="number" name="price_iqd" min="0" step="1" required class="field" value="'+esc(p.price_iqd??"")+'"></label><label class="formgroup">السعر قبل العرض<input type="number" name="compare_at_iqd" min="0" step="1" class="field" value="'+esc(p.compare_at_iqd??"")+'"></label><label class="formgroup">المخزون *<input type="number" name="stock" min="0" step="1" required class="field" value="'+esc(p.stock??0)+'"></label><label class="formgroup">رمز المنتج SKU<input name="sku" class="field" value="'+esc(p.sku||"")+'"></label><label class="formgroup fullspan">الوصف<textarea name="description" class="field">'+esc(p.description||"")+'</textarea></label><label class="formgroup fullspan">رابط الصورة (HTTPS) أو ارفع صورة<input name="image_url" class="field" value="'+esc(p.image_url||"")+'"></label><label class="formgroup fullspan">صورة JPG / PNG / WEBP — 5MB كحد أقصى<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" class="field"></label><label class="formgroup">النشر<select name="active" class="field"><option value="true">منشور</option><option value="false">مخفي</option></select></label><label class="formgroup">مميز<select name="featured" class="field"><option value="false">لا</option><option value="true">نعم</option></select></label><label class="formgroup">عرض<select name="on_sale" class="field"><option value="false">لا</option><option value="true">نعم</option></select></label><button type="submit" class="btn primary fullspan"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#check"></use></svg> حفظ المنتج</button></form></div>';
}
async function adminPage(){
const tabs=[["products","المنتجات"],["orders","الطلبات"],["shipping","التوصيل"],["promos","الإعلانات"]].map(([key,text])=>'<button data-admin-tab="'+key+'" class="'+(state.adminTab===key?"active":"")+'">'+text+'</button>').join("");
let body="";
if(state.adminTab==="products"){
if(state.editProduct){let p=state.products.find(x=>x.id===state.editProduct)||{};body=editor(p)}
else body='<button class="btn primary" id="newProduct" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> منتج جديد</button><div class="card admin-table"><table><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.products.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+money(p.price_iqd)+'</td><td>'+p.stock+'</td><td>'+(p.active?"منشور":"مخفي")+'</td><td><button data-edit-product="'+p.id+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#settings"></use></svg> تعديل</button></td></tr>').join("")||'<tr><td colspan="5">لا توجد منتجات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="orders"){
const {data,error}=await sb.from("orders").select("id,created_at,customer_name,phone,governorate,address,note,payment_method,total_iqd,status,order_items(product_name,quantity)").order("created_at",{ascending:false}).limit(150);
body=error?'<p class="error">'+esc(error.message)+'</p>':'<div class="card admin-table"><table><thead><tr><th>الطلب</th><th>الزبون</th><th>العنوان</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>'+((data||[]).map(o=>'<tr><td>'+esc(o.id.slice(0,8))+'<br>'+new Date(o.created_at).toLocaleDateString("ar-IQ")+'</td><td>'+esc(o.customer_name)+'<br>'+esc(o.phone)+'</td><td>'+esc(o.governorate)+'<br>'+esc(o.address)+'<br>'+esc(o.note)+'</td><td>'+o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join("<br>")+'</td><td>'+money(o.total_iqd)+'</td><td><select class="field" data-status="'+o.id+'">'+[["new","جديد"],["confirmed","تم التأكيد"],["packing","تجهيز"],["shipped","بالطريق"],["delivered","مسلّم"],["cancelled","ملغي"]].map(([k,v])=>'<option value="'+k+'" '+(o.status===k?"selected":"")+'>'+v+'</option>').join("")+'</select></td></tr>').join("")||'<tr><td colspan="6">لا توجد طلبات بعد</td></tr>')+'</tbody></table></div>';
}
if(state.adminTab==="shipping")body='<div class="card"><p class="subtle">كل المحافظات معطلة مبدئياً، حدّد السعر الصحيح وفعّل التوصيل.</p><div class="admin-table"><table><thead><tr><th>المحافظة</th><th>التوصيل د.ع</th><th>مفعّل</th><th>حفظ</th></tr></thead><tbody>'+state.rates.map(r=>'<tr><td>'+esc(r.governorate)+'</td><td><input class="field" type="number" min="0" step="1" id="rate-'+esc(r.governorate)+'" value="'+r.price_iqd+'"></td><td><input type="checkbox" id="enabled-'+esc(r.governorate)+'" '+(r.enabled?"checked":"")+'></td><td><button data-rate="'+esc(r.governorate)+'"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#check"></use></svg> حفظ</button></td></tr>').join("")+'</tbody></table></div></div>';
if(state.adminTab==="promos")body='<button id="newPromo" class="btn primary" style="margin-bottom:16px"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> إعلان جديد</button><div class="card admin-table"><table><thead><tr><th>الإعلان</th><th>المكان</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>'+(state.promos.map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc(p.placement)+'</td><td>'+(p.active?"نشط":"مخفي")+'</td><td><button data-edit-promo="'+p.id+'">تعديل</button></td></tr>').join("")||'<tr><td colspan="4">لا توجد إعلانات</td></tr>')+'</tbody></table></div>';
return '<div class="page"><div class="row"><h1>لوحة إدارة BAZOO</h1><button class="btn outline" data-go="home"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#home"></use></svg> المتجر</button></div><div class="adminnav">'+tabs+'</div>'+body+'</div>';
}
function bindAdmin(){
const cancel=document.querySelector("#cancelEdit");if(cancel)cancel.onclick=()=>{state.editProduct=null;render()};
const f=document.querySelector("#adminProductForm");if(f){
const p=state.products.find(x=>x.id===state.editProduct);
if(p)for(const key of ["category_id","brand_id","active","featured","on_sale"]){if(f.elements[key])f.elements[key].value=String(p[key]??"")}
}
document.querySelectorAll("[data-status]").forEach(el=>el.onchange=async()=>{const {error}=await sb.from("orders").update({status:el.value}).eq("id",el.dataset.status);notify(error?error.message:"تم تحديث حالة الطلب ")});
document.querySelectorAll("[data-rate]").forEach(el=>el.onclick=async()=>{const g=el.dataset.rate;const price=Number(document.getElementById("rate-"+g).value),enabled=document.getElementById("enabled-"+g).checked;if(!Number.isSafeInteger(price)||price<0)return notify("السعر غير صحيح");const {error}=await sb.from("shipping_rates").update({price_iqd:price,enabled}).eq("governorate",g);if(error)return notify(error.message);await loadCatalog();notify("تم تحديث التوصيل ");render()});
}
async function saveProduct(form){
const f=new FormData(form),id=f.get("id");
const v={name:String(f.get("name")).trim(),category_id:Number(f.get("category_id")),brand_id:f.get("brand_id")?Number(f.get("brand_id")):null,price_iqd:Number(f.get("price_iqd")),compare_at_iqd:f.get("compare_at_iqd")!==""?Number(f.get("compare_at_iqd")):null,stock:Number(f.get("stock")),sku:String(f.get("sku")||"").trim()||null,description:String(f.get("description")||""),image_url:String(f.get("image_url")||"").trim()||null,active:f.get("active")==="true",featured:f.get("featured")==="true",on_sale:f.get("on_sale")==="true"};
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
return {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo};
}
;


const sb=createClient("https://kgghxcxaqmuypcdwubhr.supabase.co","sb_publishable_TZKy9nGrNFu1KqZqBpsw3Q_x17cq1qy",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("en-US").format(Number(n)||0)+" د.ع";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeImg=s=>/^https:\/\//i.test(String(s||""))?esc(s):"";
const icon=(name,size=20,cls="")=>'<svg class="svg-icon '+cls+'" width="'+size+'" height="'+size+'" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>';
const placeholder='<div class="placeholder"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#image"></use></svg></div>';
const label={new:"جديد",confirmed:"تم التأكيد",packing:"قيد التجهيز",shipped:"بالطريق",delivered:"تم التسليم",cancelled:"ملغي"};
const govs=["بغداد","البصرة","نينوى","أربيل","السليمانية","دهوك","صلاح الدين","الأنبار","كركوك","ديالى","بابل","كربلاء","النجف","واسط","ميسان","ذي قار","المثنى","القادسية"];
const state={catalogFailure:false,products:[],categories:[],brands:[],rates:[],promos:[],cart:{},favs:[],user:null,admin:false,route:"home",category:"",brand:"",q:"",promoIndex:0,checkoutPending:false,selectedGovernorate:"",adminTab:"products",editProduct:null};
try{state.cart=JSON.parse(localStorage.getItem("bazoo_cart_v2")||"{}")||{};state.favs=JSON.parse(localStorage.getItem("bazoo_favs_v2")||"[]")||[]}catch(e){}
if(Array.isArray(state.cart)||typeof state.cart!=="object")state.cart={};
if(!Array.isArray(state.favs))state.favs=[];
function persist(){try{localStorage.setItem("bazoo_cart_v2",JSON.stringify(state.cart));localStorage.setItem("bazoo_favs_v2",JSON.stringify(state.favs))}catch(e){};$("#cartBadge").textContent=Object.values(state.cart).reduce((s,n)=>s+Number(n||0),0)||""}
function notify(msg){const x=$("#toast");x.textContent=msg;x.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>x.classList.remove("show"),3800)}
function openModal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").classList.add("show");$("#modalBackdrop").classList.add("show");document.body.style.overflow="hidden"}
function closeModal(){$("#modal").classList.remove("show");$("#modalBackdrop").classList.remove("show");document.body.style.overflow=""}
$("#closeModal").onclick=closeModal;$("#modalBackdrop").onclick=closeModal;document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
function go(route){location.hash="#/"+route;if(location.hash==="#/"+route)render()}
function catName(id){return state.categories.find(x=>x.id===id)?.name||"منتج"}
function brandName(id){return state.brands.find(x=>x.id===id)?.name||""}
const activeProducts=()=>state.products.filter(p=>p.active);
function filterProducts({category=state.category,brand=state.brand,q=state.q,onSale=false}={}){
 const descendants=category?state.categories.filter(c=>String(c.parent_id)===String(category)).map(c=>c.id):[];
 return activeProducts().filter(p=>{
 const matchCat=!category||String(p.category_id)===String(category)||descendants.some(id=>String(id)===String(p.category_id));
 return matchCat&&(!brand||String(p.brand_id)===String(brand))&&(!onSale||p.on_sale||(p.compare_at_iqd>p.price_iqd))&&(!q||(p.name+" "+p.description+" "+brandName(p.brand_id)).toLowerCase().includes(q.toLowerCase()));
 });
}
function sectionHead(kicker,title,subtitle=""){return '<div class="section-head"><div><div class="kicker">'+esc(kicker)+'</div><h2>'+esc(title)+'</h2>'+(subtitle?'<p class="subtle">'+esc(subtitle)+'</p>':'')+'</div></div>'}
function productCard(p){
 const photo=safeImg(p.image_url);
 return '<article class="product"><div class="prodimage" data-detail="'+p.id+'" role="button" tabindex="0" aria-label="تفاصيل '+esc(p.name)+'">'+(photo?'<img src="'+photo+'" loading="lazy" alt="'+esc(p.name)+'">':placeholder)+(p.on_sale?'<span class="tag">عرض</span>':p.featured?'<span class="tag">مميز</span>':'')+'</div><div class="prodinfo"><small>'+esc(brandName(p.brand_id)||catName(p.category_id))+'</small><h3>'+esc(p.name)+'</h3><div><strong class="cost">'+money(p.price_iqd)+'</strong>'+(p.compare_at_iqd>p.price_iqd?'<span class="old">'+money(p.compare_at_iqd)+'</span>':'')+'</div><div class="prodfoot"><button class="btn primary" data-add="'+p.id+'" '+(p.stock<1?'disabled':'')+'>'+(p.stock<1?'نفد المخزون':'<svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg> أضف للعربة')+'</button><button class="heart '+(state.favs.includes(p.id)?"on":"")+'" data-fav="'+p.id+'" aria-label="المفضلة">'+icon('heart',19)+'</button></div></div></article>';
}
function productGrid(ps){return ps.length?'<div class="grid-products">'+ps.map(productCard).join("")+'</div>':'<div class="notice">ماكو منتجات منشورة بهذا القسم حالياً. راح تظهر المنتجات هنا من يضيفها فريق بازو </div>'}
function promoFrame(place){const x=state.promos.filter(p=>p.active&&p.placement===place);if(!x.length)return "";const p=x[state.promoIndex%x.length];return '<div class="promo-frame">'+(p.image_url&&safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="'+esc(p.title)+'">':'')+'<h2>'+esc(p.title)+'</h2><p class="subtle">'+esc(p.subtitle)+'</p>'+(p.link_url?.startsWith("#/")?'<a href="'+esc(p.link_url)+'" class="btn accent">اكتشف المزيد</a>':'')+(x.length>1?'<div class="row" style="margin-top:15px"><button class="btn outline" data-slide="-1">السابق</button><span>'+((state.promoIndex%x.length)+1)+' / '+x.length+'</span><button class="btn outline" data-slide="1">التالي</button></div>':'')+'</div>'}

const slugIcons={"home-appliances":"building","installation":"plug","devices-games":"laptop","accessories":"headphones","phones":"smartphone","office-supplies":"clipboard","school-supplies":"book-open"};
const homeCategoryDefaults=[
 {name:"أجهزة منزلية",slug:"home-appliances"},{name:"مواد تأسيس",slug:"installation"},
 {name:"أجهزة وألعاب",slug:"devices-games"},{name:"إكسسوارات",slug:"accessories"},
 {name:"هواتف",slug:"phones"},{name:"مواد مكتبية",slug:"office-supplies"},{name:"مواد دراسية",slug:"school-supplies"}
];
const defaultSlides=[
 {title:"تسوّق براحة،",accent:"واختار على ذوقك.",subtitle:"أجهزة كهربائية وإلكترونيات وقرطاسية في مكان واحد. اكتشف أقسامنا واختار اللي تحتاجه.",icon:"shopping-bag",extra:"laptop",secondary:"smartphone",route:"categories",cta:"اكتشف المنتجات"},
 {title:"كل اللي يحتاجه بيتك،",accent:"صار أقرب إلك.",subtitle:"استكشف الأجهزة المنزلية ومواد التأسيس من العلامات التجارية اللي تبحث عنها.",icon:"building",extra:"plug",secondary:"package",slug:"appliances",cta:"تسوّق الأجهزة"},
 {title:"للشغل، الدراسة",accent:"وأوقات الترفيه.",subtitle:"من الهواتف والإكسسوارات إلى الأجهزة والألعاب والقرطاسية. اختيارات متنوّعة بمكان واحد.",icon:"laptop",extra:"headphones",secondary:"book-open",slug:"electronics",cta:"استكشف الإلكترونيات"}
];
function storefrontSlides(){
 const promos=state.promos.filter(p=>p.active&&p.placement==="home");
 return promos.length?promos.map(p=>({
  title:p.title,accent:"",subtitle:p.subtitle,image:p.image_url,icon:"shopping-bag",
  extra:"package",secondary:"tag",route:/^#\/(home|categories|offers|cart)$/.test(p.link_url||"")?p.link_url.slice(2):"categories",
  cta:"استكشف المزيد"
 })):defaultSlides;
}
function drawHero(){
 const slides=storefrontSlides();const index=((state.promoIndex%slides.length)+slides.length)%slides.length;const slide=slides[index];
 const button=slide.slug?'<button class="btn accent" data-main-cat="'+esc(slide.slug)+'">'+esc(slide.cta)+' '+icon("arrow-left",17)+'</button>':'<button class="btn accent" data-go="'+esc(slide.route||"categories")+'">'+esc(slide.cta)+' '+icon("arrow-left",17)+'</button>';
 const visual=slide.image&&safeImg(slide.image)?'<img class="merch-photo" src="'+safeImg(slide.image)+'" alt="'+esc(slide.title)+'" loading="eager">':
 '<div class="merch-illustration"><div class="merch-primary-card">'+icon(slide.icon,126)+'</div><div class="merch-floating one">'+icon(slide.extra,42)+'</div><div class="merch-floating two">'+icon(slide.secondary,42)+'</div></div>';
 return '<div class="merch-slider-inner"><div class="merch-content"><span class="merch-eyebrow">'+icon("sparkles",17)+' اكتشف عالم BAZOO</span><h1>'+esc(slide.title)+(slide.accent?'<br><b>'+esc(slide.accent)+'</b>':'')+'</h1><p>'+esc(slide.subtitle||"")+'</p><div class="hero-buttons">'+button+'<button class="btn ghost" data-go="offers">تصفح العروض</button></div></div><div class="merch-visual"><div class="merch-orbit"></div>'+visual+'</div></div><div class="slider-controls"><button data-slide="-1" aria-label="الشريحة السابقة">'+icon("chevron-right",18)+'</button><div class="slider-dots" aria-label="شرائح العروض">'+slides.map((p,i)=>'<button data-slide-to="'+i+'" class="'+(index===i?'active':'')+'" aria-label="الشريحة '+(i+1)+'" aria-current="'+(index===i?'true':'false')+'"></button>').join("")+'</div><button data-slide="1" aria-label="الشريحة التالية">'+icon("chevron-left",18)+'</button></div>';
}
function categoryCircles(){
 const list=homeCategoryDefaults.map(d=>{
  const found=state.categories.find(c=>c.slug===d.slug&&c.active);
  return {...d,id:found?.id,icon:slugIcons[d.slug]||"grid"};
 });
 return '<div class="home-categories">'+list.map(c=>'<button class="round-category" '+(c.id?'data-cat="'+c.id+'"':'data-go="categories"')+'><span class="category-circle">'+icon(c.icon,56)+'</span><span class="category-name">'+esc(c.name)+'</span></button>').join("")+'</div>';
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
 const fresh=activeProducts().slice(0,10);
 const sales=activeProducts().filter(p=>p.on_sale||(p.compare_at_iqd!=null&&p.compare_at_iqd>p.price_iqd)).slice(0,10);
 const featured=activeProducts().filter(p=>p.featured).slice(0,10);
 const recommendations=featured.length?featured:fresh;
 return '<div class="home-main"><section class="merch-slider alt-'+(state.promoIndex%3)+'" id="heroSlider" aria-label="بنر المتجر المتبدّل">'+drawHero()+'</section>'
 +'<section class="home-section">'+sectionHead("اكتشف الأقسام","تسوّق حسب الفئة") + categoryCircles()+'</section>'
 +'<section class="home-section home-products"><div class="row" style="align-items:end;gap:12px">'+sectionHead("منتجات مختارة من الفريق","أفضل العروض")+'<button class="section-link" data-go="offers">عرض كل العروض '+icon("arrow-left",16)+'</button></div>'
 +(sales.length?productGrid(sales):homeEmpty("العروض قيد التجهيز","رح تظهر هنا المنتجات المخفّضة فور نشرها من فريق بازو.","percent"))+'</section>'
 +'<section class="home-section"><div class="category-feature-strip"><div class="feature-strip-item"><div><h3>الأجهزة الكهربائية</h3><p>أجهزة للبيت ومواد تأسيس</p><button class="btn outline" data-main-cat="appliances">تسوّق القسم '+icon("arrow-left",17)+'</button></div><span class="art">'+icon("plug",52)+'</span></div><div class="feature-strip-item"><div><h3>عالم الإلكترونيات</h3><p>أجهزة، ألعاب، هواتف وإكسسوارات</p><button class="btn outline" data-main-cat="electronics">تسوّق القسم '+icon("arrow-left",17)+'</button></div><span class="art">'+icon("laptop",52)+'</span></div></div></section>'
 +'<section class="home-section home-products"><div class="row" style="align-items:end;gap:12px">'+sectionHead("المنتجات الأحدث","مختارات BAZOO")+'<button class="section-link" data-go="categories">كل المنتجات '+icon("arrow-left",16)+'</button></div>'
 +(recommendations.length?productGrid(recommendations):homeEmpty("قريباً منتجات جديدة","المنتجات الفعلية ستظهر هنا بمجرد إضافتها من لوحة الإدارة.","shopping-bag"))+'</section>'
 +'<section class="home-section">'+sectionHead("اختار العلامة اللي تثق بيها","تسوّق حسب العلامة التجارية") +brandGallery()+'</section>'
 +'<section class="benefits home-benefits"><div class="benefit"><i>'+icon("truck",25)+'</i><div><strong>التوصيل لكل العراق</strong><small>أجور التوصيل تظهر عند الطلب</small></div></div><div class="benefit"><i>'+icon("package",25)+'</i><div><strong>مخزون حقيقي</strong><small>حسب المنتجات المنشورة</small></div></div><div class="benefit"><i>'+icon("shield-check",25)+'</i><div><strong>حسابات آمنة</strong><small>حماية بيانات الزبائن</small></div></div><div class="benefit"><i>'+icon("headphones",25)+'</i><div><strong>تجربة تسوّق سهلة</strong><small>من الهاتف أو الكمبيوتر</small></div></div></section>'
 +'</div>';
}
function brandsPage(){
 return '<div class="page"><div class="section-head"><div><div class="kicker">BRANDS AT BAZOO</div><h1>العلامات التجارية</h1><p class="subtle">اختار العلامة التجارية لعرض منتجاتها الموجودة بالمتجر.</p></div></div>'+brandGallery()+'</div>';
}
function favoritesPage(){
 const products=activeProducts().filter(p=>state.favs.includes(p.id));
 return '<div class="page"><h1>المفضلة</h1><p class="subtle">منتجاتك المحفوظة على هذا الجهاز</p>'+productGrid(products)+'</div>';
}
function filters(){return '<div class="filter-panel"><label>القسم<select id="categoryFilter"><option value="">كل الأقسام</option>'+state.categories.filter(c=>c.active).map(c=>'<option value="'+c.id+'" '+(String(c.id)===String(state.category)?"selected":"")+'>'+(c.parent_id?"— ":"")+esc(c.name)+'</option>').join("")+'</select></label><label>العلامة التجارية<select id="brandFilter"><option value="">كل العلامات</option>'+state.brands.filter(b=>b.active).map(b=>'<option value="'+b.id+'" '+(String(b.id)===String(state.brand)?"selected":"")+'>'+esc(b.name)+'</option>').join("")+'</select></label><label>بحث عن منتج<input class="field" id="filterSearch" value="'+esc(state.q)+'" placeholder="اسم المنتج أو الماركة..."></label></div>'}
function categories(){return '<div class="page"><h1>الفئات والعلامات التجارية</h1><p class="subtle">حدد القسم أو العلامة التجارية حتى تطلعلك المنتجات المناسبة</p>'+promoFrame("categories")+filters()+'<div class="section">'+sectionHead("المنتجات","اكتشف المنتجات")+productGrid(filterProducts())+'</div></div>'}
function offers(){return '<div class="page"><h1>عروض بازو <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#percent"></use></svg></h1><p class="subtle">المنتجات المختارة للتخفيضات والعروض من قبل الفريق</p>'+productGrid(filterProducts({category:"",brand:"",q:"",onSale:true}))+'</div>'}
function market(){return '<div class="page"><div class="notice" style="margin:45px auto;max-width:600px"><div class="empty-illustration"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#store"></use></svg></div><h1>أضف متجرك</h1><p>قريباً سيتاح هذا القسم. نشتغل على تجربة مميزة لأصحاب المتاجر.</p><button class="btn primary" data-go="home">الرجوع للرئيسية</button></div></div>'}
function cartEntries(){return Object.entries(state.cart).map(([id,qty])=>({p:state.products.find(p=>p.id===id),qty:Number(qty)})).filter(x=>x.p&&x.qty>0)}
function subtotal(){return cartEntries().reduce((s,x)=>s+x.p.price_iqd*x.qty,0)}
function cart(){
 const rows=cartEntries();const options=state.rates.filter(x=>x.enabled);
 const shippingOptions='<option value="">اختار المحافظة</option>'+govs.map(g=>'<option value="'+esc(g)+'" '+(options.find(x=>x.governorate===g)?'':'disabled')+'>'+esc(g)+(options.find(x=>x.governorate===g)?"":" — التوصيل غير متاح حالياً")+'</option>').join("");
 return '<div class="page"><h1>عربة التسوّق <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#shopping-bag"></use></svg></h1><p class="subtle">راجع المنتجات قبل تأكيد الطلب</p>'+(!rows.length?'<div class="notice"><h2>عربتك فارغة حالياً</h2><button class="btn accent" data-go="categories">ابدأ التسوق</button></div>':'<div class="two-col"><section class="card"><h2 class="sectiontitle">المنتجات ('+rows.length+')</h2>'+rows.map(({p,qty})=>'<div class="cartrow"><div class="cartpic">'+(safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="'+esc(p.name)+'">':placeholder)+'</div><div><strong>'+esc(p.name)+'</strong><p class="cost">'+money(p.price_iqd)+'</p><div class="qty"><button data-qty="'+p.id+'" data-step="-1"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#minus"></use></svg></button>'+qty+'<button data-qty="'+p.id+'" data-step="1" '+(qty>=p.stock?"disabled":"")+'><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg></button></div></div><button class="btn danger" data-remove="'+p.id+'">حذف</button></div>').join("")+'</section><aside class="card"><h2 class="sectiontitle">ملخص الطلب</h2><div class="row summaryline"><span>مجموع المنتجات</span><strong>'+money(subtotal())+'</strong></div><label class="formgroup" style="margin:15px 0">المحافظة لحساب التوصيل<select id="cartGovernorate" class="field">'+shippingOptions+'</select></label><div class="row summaryline"><span>التوصيل</span><strong id="shippingPrice">اختر المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="grandTotal">'+money(subtotal())+' + التوصيل</strong></div><button class="btn accent" id="toCheckout" style="width:100%;margin-top:19px">متابعة الطلب <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button><p class="note">تأكيد الطلب يتطلب حساباً مسجّلاً. الدفع عند الاستلام أو التنسيق عبر واتساب.</p></aside></div>')+'<section class="section">'+sectionHead("قد يعجبك أيضاً","منتجات مشابهة")+productGrid(activeProducts().filter(p=>!state.cart[p.id]).slice(0,4))+'</section>'+promoFrame("cart")+'</div>';
}
function checkout(){if(!cartEntries().length)return cart();if(!state.user){state.checkoutPending=true;return authView("أكمل التسجيل أو الدخول حتى تأكد طلبك");}
 const selected=state.rates.filter(x=>x.enabled);
 return '<div class="page"><h1>تأكيد الطلب</h1><p class="subtle">تأكد من معلوماتك والتوصيل قبل إرسال طلبك</p><div class="two-col"><form class="card" id="orderForm"><div class="formgrid"><label class="formgroup">الاسم الكامل *<input name="customer_name" required minlength="2" maxlength="120" class="field" autocomplete="name"></label><label class="formgroup">رقم الهاتف * (11 رقم)<input name="phone" class="field" inputmode="numeric" autocomplete="tel" required pattern="07[0-9]{9}" minlength="11" maxlength="11" placeholder="07XXXXXXXXX"></label><label class="formgroup">المحافظة *<select name="governorate" id="orderGovernorate" class="field" required><option value="">اختر المحافظة</option>'+govs.map(g=>'<option value="'+esc(g)+'" '+(selected.some(x=>x.governorate===g)?"":"disabled")+'>'+esc(g)+(selected.some(x=>x.governorate===g)?"":" — غير مفعّلة")+'</option>').join("")+'</select></label><label class="formgroup">طريقة الدفع *<select name="payment" class="field" required><option value="cod">الدفع عند الاستلام</option><option value="whatsapp">التنسيق عبر واتساب للدفع الإلكتروني</option></select></label><label class="formgroup fullspan">العنوان الكامل وأقرب نقطة دالة *<textarea class="field" name="address" minlength="8" maxlength="500" required placeholder="المنطقة، الزقاق، رقم الدار، أقرب نقطة دالة"></textarea></label><label class="formgroup fullspan">ملاحظات (اختياري)<textarea name="note" class="field" maxlength="1000"></textarea></label></div><p class="note">الطلب يُحفظ في النظام بعد تأكيدك. خيار واتساب يعني تنسيق الدفع مع الفريق وليس دفعاً إلكترونياً فورياً.</p><button class="btn accent" type="submit">تأكيد الطلب وحفظه <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button></form><aside class="card"><h2 class="sectiontitle">تفاصيل طلبك</h2>'+cartEntries().map(({p,qty})=>'<div class="row summaryline"><span>'+esc(p.name)+' × '+qty+'</span><strong>'+money(p.price_iqd*qty)+'</strong></div>').join("")+'<div class="row summaryline"><strong>المنتجات</strong><strong>'+money(subtotal())+'</strong></div><div class="row summaryline"><span>أجور التوصيل</span><strong id="checkoutShip">اختار المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="checkoutTotal">'+money(subtotal())+' + التوصيل</strong></div></aside></div></div>';
}
function authView(title="حسابك في بازو"){
 return '<section class="page auth-page"><div class="auth-shell"><div class="auth-form-panel"><a class="auth-back" href="#/home">'+icon("arrow-right",16)+' رجوع للمتجر</a><div class="auth-symbol">'+icon("user-round",29)+'</div><div class="auth-heading"><span class="kicker">BAZOO MEMBERS</span><h1>'+esc(title)+'</h1><p class="subtle">سجّل دخولك حتى تتابع طلباتك، أو أنشئ حساب جديد خلال لحظات.</p></div><div class="auth-tabs" role="group" aria-label="نوع الدخول"><button type="button" class="active" data-auth-mode="login">'+icon("log-in",18)+' تسجيل الدخول</button><button type="button" data-auth-mode="signup">'+icon("user-plus",18)+' حساب جديد</button></div><form id="authForm" class="stack"><input type="hidden" name="mode" value="login"><label class="formgroup auth-signup-field hidden">الاسم الكامل<span class="input-icon">'+icon("user",19)+'<input type="text" name="full_name" class="field" minlength="2" maxlength="100" autocomplete="name" placeholder="اسمك الكامل"></span></label><label class="formgroup">البريد الإلكتروني<span class="input-icon">'+icon("mail",19)+'<input type="email" name="email" class="field" required autocomplete="email" placeholder="example@email.com" dir="ltr"></span></label><label class="formgroup">كلمة المرور<span class="input-icon auth-password">'+icon("lock",19)+'<input type="password" name="password" class="field" required minlength="6" autocomplete="current-password" placeholder="أدخل كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><label class="formgroup auth-signup-field hidden">تأكيد كلمة المرور<span class="input-icon auth-password">'+icon("shield-check",19)+'<input type="password" name="confirm_password" class="field" minlength="6" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="confirm_password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><button type="button" class="forgot-link" id="resetPassword">نسيت كلمة المرور؟</button><button type="submit" class="btn primary auth-submit">'+icon("log-in",19)+' تسجيل الدخول</button></form><p id="authMessage" class="auth-feedback" role="status" aria-live="polite"></p><div class="auth-footnote">'+icon("shield-check",17)+' بيانات حسابك محمية بنظام Supabase Auth</div></div><aside class="auth-art"><div class="auth-art-orbit one"></div><div class="auth-art-orbit two"></div><div class="auth-art-content"><div class="auth-art-logo">'+icon("shopping-bag",52)+'</div><div class="auth-art-kicker">مرحباً بيك في BAZOO</div><h2>كل اختياراتك،<br>في مكان واحد.</h2><p>تسوّق براحتك، احفظ طلباتك، وتابع كل جديد من بازو.</p><div class="auth-benefit">'+icon("package",20)+' تتبع الطلبات من حسابك</div><div class="auth-benefit">'+icon("shield-check",20)+' تسجيل آمن وسهل</div><div class="auth-benefit">'+icon("shopping-cart",20)+' عربة تسوّق متزامنة مع جهازك</div></div></aside></div></section>';
}
async function account(){if(!state.user)return authView();const {data,error}=await sb.from("orders").select("id,created_at,status,subtotal_iqd,shipping_iqd,total_iqd,governorate,payment_method,order_items(product_name,quantity,unit_price_iqd)").order("created_at",{ascending:false}).limit(60);return '<div class="page"><div class="row"><div><h1>حسابي وطلباتي</h1><p class="user-info">'+esc(state.user.email)+'</p></div><button class="btn outline" id="signOut">تسجيل خروج</button></div><div class="section"><h2>طلباتي</h2>'+(error?'<p class="error">تعذر تحميل الطلبات</p>':!(data||[]).length?'<div class="notice">ما عندك طلبات بعد. تگدر تتصفح المنتجات وتطلب من المتجر.</div>':data.map(o=>'<div class="order"><div class="row"><div><strong class="orderid">'+esc(o.id.slice(0,8).toUpperCase())+'</strong><p class="subtle">'+new Date(o.created_at).toLocaleDateString("ar-IQ")+' — '+esc(o.governorate)+'</p></div><span class="status">'+esc(label[o.status]||o.status)+'</span></div><p>'+o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join('، ')+'</p><strong class="cost">'+money(o.total_iqd)+'</strong></div>').join(""))+'</div>'+(state.admin?'<button class="btn primary" data-go="admin">لوحة إدارة المتجر</button>':'')+'</div>'}
function detail(id){const p=state.products.find(x=>x.id===id);if(!p)return;openModal(p.name,'<div style="margin-top:18px">'+(safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" style="width:100%;max-height:320px;object-fit:contain;background:#f6f1fa;border-radius:14px" alt="'+esc(p.name)+'">':placeholder)+'<p class="subtle">'+esc(catName(p.category_id))+' — '+esc(brandName(p.brand_id))+'</p><h3 class="cost">'+money(p.price_iqd)+'</h3><p style="line-height:1.9;white-space:pre-wrap">'+esc(p.description||"لا يوجد وصف إضافي حالياً")+'</p><p class="subtle">المتوفر: '+p.stock+'</p><button class="btn primary" id="detailAdd" '+(p.stock<1?"disabled":"")+'>إضافة للعربة</button></div>');$("#detailAdd").onclick=()=>{add(p.id);closeModal()}}
function add(id){const p=state.products.find(x=>x.id===id);if(!p||p.stock<=0)return notify("المنتج غير متوفر");const qty=Number(state.cart[id]||0);if(qty>=p.stock)return notify("وصلت للكمية المتوفرة بالمخزون");state.cart[id]=Math.min(99,qty+1);persist();notify("تمت إضافة المنتج للعربة ")}
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
 if(mode==="signup"&&password!==data.get("confirm_password")){const message=$("#authMessage");if(message){message.textContent="كلمات المرور غير متطابقة. تأكد من الكتابة.";message.classList.add("error")}return}
 const button=f.querySelector("button[type=submit]");button.disabled=true;
 try{const res=mode==="signup"?await sb.auth.signUp({email,password,options:{data:{full_name:String(data.get("full_name")||"").trim()}}}):await sb.auth.signInWithPassword({email,password});if(res.error)throw res.error;
 if(mode==="signup"&&!res.data.session){$("#authMessage").textContent="انرسل رابط تأكيد للبريد الإلكتروني. فعّل حسابك من الإيميل، وبعدها سجّل دخول.";return}
 notify(mode==="signup"?"تم إنشاء الحساب":"تم تسجيل الدخول");
 await refreshAuth();go(state.checkoutPending?"checkout":"account");
 }catch(e){$("#authMessage").textContent="تعذر الدخول: "+e.message}finally{button.disabled=false}
}

async function checkAdmin(){
 if(!state.user){state.admin=false;return}
 const {data,error}=await sb.from("admin_members").select("user_id").eq("user_id",state.user.id).maybeSingle();
 state.admin=!error&&!!data;
}
async function loadCatalog(){
 const requests=[
  ["categories",()=>sb.from("categories").select("*").order("sort_order")],
  ["brands",()=>sb.from("brands").select("*").order("name")],
  ["products",()=>sb.from("products").select("*").order("created_at",{ascending:false})],
  ["rates",()=>sb.from("shipping_rates").select("*").order("governorate")],
  ["promos",()=>sb.from("promotions").select("*").order("sort_order")]
 ];
 const results=await Promise.allSettled(requests.map(async ([name,request])=>{
  const result=await request();
  if(result.error)throw Error(name+": "+result.error.message);
  return result.data||[];
 }));
 let failed=false;
 results.forEach((out,i)=>{
  if(out.status==="fulfilled")state[requests[i][0]]=out.value;
  else {failed=true;console.warn("BAZOO catalog:",out.reason);}
 });
 state.catalogFailure=failed;
 return !failed;
}
async function refreshAuth(){const {data}=await sb.auth.getUser();state.user=data?.user||null;await checkAdmin()}
async function submitOrder(f){
 const d=new FormData(f),p=String(d.get("phone")).trim();
 if(!/^07[0-9]{9}$/.test(p))return notify("رقم الهاتف لازم يكون 11 رقم ويبدأ بـ 07");
 const governorate=String(d.get("governorate"));if(!state.rates.some(x=>x.governorate===governorate&&x.enabled))return notify("التوصيل غير متوفر لهذه المحافظة حالياً");
 const items=cartEntries().map(({p,qty})=>({id:p.id,quantity:qty}));if(!items.length)return notify("العربة فارغة");
 const btn=f.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="جارٍ حفظ الطلب...";
 const {data,error}=await sb.rpc("place_order",{p_items:items,p_name:d.get("customer_name"),p_phone:p,p_governorate:governorate,p_address:d.get("address"),p_note:d.get("note")||"",p_payment_method:d.get("payment")});
 btn.disabled=false;btn.innerHTML="تأكيد الطلب وحفظه "+icon("arrow-left",18);
 if(error){notify("ما تم حفظ الطلب: "+error.message);await loadCatalog();return}
 state.cart={};state.checkoutPending=false;persist();await loadCatalog();notify("تم حفظ طلبك بنجاح ");go("account");openModal("تم تأكيد طلبك",'<p>استلمنا طلبك داخل النظام بنجاح.</p><p>رقم الطلب: <strong>'+esc(data)+'</strong></p><p class="subtle">تگدر تتابع حالة الطلب من صفحة حسابك. إذا اخترت التنسيق عبر واتساب، راح تحتاج تتواصل ويا المتجر بعد إضافة رقم التواصل الرسمي.</p><button class="btn primary" id="doneOrder">مشاهدة طلباتي</button>');$("#doneOrder").onclick=closeModal;
}
function shippingBind(sel,ship,total){
 const s=$(sel);if(!s)return;s.addEventListener("change",()=>{const rate=state.rates.find(x=>x.governorate===s.value&&x.enabled);$(ship).textContent=rate?money(rate.price_iqd):"اختر محافظة متاحة";$(total).textContent=rate?money(subtotal()+rate.price_iqd):money(subtotal())+" + التوصيل"});
}
const {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo}=createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon});
async function render(){
 const hash=decodeURIComponent(location.hash.replace(/^#\/?/,""))||"home";const parts=hash.split("/");const route=parts[0]||"home";state.route=route;
 document.querySelectorAll("#bottomNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 document.querySelectorAll("#categoryNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 let content="";
 if(route==="home")content=home();else if(route==="categories")content=categories();else if(route==="offers")content=offers();else if(route==="brands")content=brandsPage();else if(route==="favorites")content=favoritesPage();else if(route==="cart")content=cart();else if(route==="checkout")content=checkout();else if(route==="account")content=await account();else if(route==="market")content=market();else if(route==="admin")content=state.admin?await adminPage():'<div class="page"><div class="notice">هذه الصفحة مخصصة لفريق إدارة بازو فقط. <a href="#/account">انتقل للحساب</a></div></div>';else content=home();
 if(state.route!==route)return;
 if(state.catalogFailure)content='<div class="connection-notice" role="alert">'+icon("circle-alert",20)+' <span>تعذّر الاتصال بقاعدة بيانات بازو. تأكد من الإنترنت ثم أعد المحاولة.</span> <button class="btn outline" id="retryCatalog">'+icon("refresh",16)+' إعادة المحاولة</button></div>'+content;
 $("#app").innerHTML=content;
 if(route==="cart"){const g=$("#cartGovernorate");if(g){g.value=state.selectedGovernorate;g.addEventListener("change",()=>state.selectedGovernorate=g.value);g.dispatchEvent(new Event("change"))}shippingBind("#cartGovernorate","#shippingPrice","#grandTotal")}
 if(route==="checkout"){const g=$("#orderGovernorate");if(g){g.value=state.selectedGovernorate;g.dispatchEvent(new Event("change"))}shippingBind("#orderGovernorate","#checkoutShip","#checkoutTotal");g?.dispatchEvent(new Event("change"))}
 if(route==="admin")bindAdmin();
}
document.addEventListener("click",async e=>{
 const b=e.target.closest("button,[data-detail]");if(!b)return;
 if(b.dataset.go){go(b.dataset.go);return}
 if(b.dataset.mainCat){const c=state.categories.find(x=>x.slug===b.dataset.mainCat);state.category=c?String(c.id):"";state.brand="";state.q="";go("categories");return}
 if(b.dataset.brand){state.brand=b.dataset.brand;state.category="";state.q="";go("categories");return}
 if(b.dataset.cat){state.category=b.dataset.cat;state.brand="";state.q="";go("categories");return}
 if(b.dataset.add){add(b.dataset.add);return}
 if(b.dataset.detail){detail(b.dataset.detail);return}
 if(b.dataset.fav){toggleFav(b.dataset.fav);return}
 if(b.dataset.qty){updateQty(b.dataset.qty,Number(b.dataset.step));return}
 if(b.dataset.remove){delete state.cart[b.dataset.remove];persist();render();return}
 if(b.dataset.slideTo!==undefined){state.promoIndex=Number(b.dataset.slideTo);const el=$("#heroSlider");if(el){el.innerHTML=drawHero();el.className="merch-slider alt-"+(state.promoIndex%3)}return}
 if(b.dataset.slide){state.promoIndex=Math.max(0,state.promoIndex+Number(b.dataset.slide));const hero=$("#heroSlider");if(hero){hero.innerHTML=drawHero();hero.className="merch-slider alt-"+(state.promoIndex%3)}else render();return}
 if(b.dataset.authMode){authMode(b.dataset.authMode);return}
 if(b.dataset.passwordToggle){const input=document.querySelector('#authForm input[name="'+b.dataset.passwordToggle+'"]');if(input){const show=input.type==="password";input.type=show?"text":"password";b.innerHTML=icon(show?"eye-off":"eye",19);b.setAttribute("aria-label",show?"إخفاء كلمة المرور":"إظهار كلمة المرور")}return}
 if(b.id==="toCheckout"){if(!$("#cartGovernorate").value)return notify("اختار المحافظة حتى نحسب التوصيل");state.selectedGovernorate=$("#cartGovernorate").value;go("checkout");return}
 if(b.id==="retryCatalog"){await loadCatalog();render();return}
 if(b.id==="resetPassword"){const email=$('#authForm input[name="email"]')?.value.trim();if(!email)return notify("اكتب البريد الإلكتروني أولاً");const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"#/account"});notify(error?error.message:"إذا البريد مسجل، راح توصلك رسالة إعادة تعيين كلمة المرور");return}
 if(b.id==="signOut"){await sb.auth.signOut();state.user=null;state.admin=false;notify("تم تسجيل الخروج");go("home");return}
 if(b.dataset.adminTab){state.adminTab=b.dataset.adminTab;state.editProduct=null;render();return}
 if(b.dataset.editProduct){state.editProduct=b.dataset.editProduct;render();return}
 if(b.id==="newProduct"){state.editProduct="new";render();return}
 if(b.dataset.editPromo){showPromoEditor(b.dataset.editPromo);return}
 if(b.id==="newPromo"){showPromoEditor("new");return}
});
document.addEventListener("change",e=>{if(e.target.id==="categoryFilter"){state.category=e.target.value;render()}if(e.target.id==="brandFilter"){state.brand=e.target.value;render()}});
let searchDebounce;document.addEventListener("input",e=>{if(e.target.id==="filterSearch"){clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>{state.q=e.target.value;const old=document.activeElement?.selectionStart;render();const x=$("#filterSearch");x?.focus();if(typeof old==="number")x?.setSelectionRange(old,old)},400)}});
document.addEventListener("submit",async e=>{const id=e.target.id;if(id==="searchForm"){e.preventDefault();state.q=$("#searchBox").value.trim();state.category="";state.brand="";go("categories");return}if(!["authForm","orderForm","adminProductForm","adminPromoForm"].includes(id))return;e.preventDefault();if(id==="authForm")await authSubmit(e.target);if(id==="orderForm")await submitOrder(e.target);if(id==="adminProductForm")await saveProduct(e.target);if(id==="adminPromoForm")await savePromo(e.target)});
$("#accountBtn").onclick=()=>go("account");$("#cartBtn").onclick=()=>go("cart");$("#favoritesBtn").onclick=()=>go("favorites");$("#year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.dataset.detail){e.preventDefault();detail(e.target.dataset.detail)}});
window.addEventListener("hashchange",render);
setInterval(()=>{if(state.route!=="home"||document.hidden||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const hero=$("#heroSlider");if(!hero)return;state.promoIndex=(state.promoIndex+1)%storefrontSlides().length;hero.innerHTML=drawHero();hero.className="merch-slider alt-"+(state.promoIndex%3)},7000);
sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT"){setTimeout(async()=>{await refreshAuth();if(["account","admin","checkout"].includes(state.route))render()},0)}});
persist();
render();
(async()=>{try{await refreshAuth();await loadCatalog();await render()}catch(error){console.error("BAZOO startup error:",error);state.catalogFailure=true;await render()}})();

