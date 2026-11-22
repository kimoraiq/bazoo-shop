/* BAZOO media limits: 15 KiB product photos, 1 MiB separate banners */
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
    if(!headers.has("Content-Type") && !(typeof Blob!=="undefined" && options.body instanceof Blob) && !(typeof FormData!=="undefined" && options.body instanceof FormData))headers.set("Content-Type","application/json");
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
function createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon,confirmAction}){
const brandOpts=()=>state.brands.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
const catOpts=()=>state.categories.filter(x=>x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
function calculateDiscount(original,percent){
 const base=Number(original),pct=Number(percent);
 if(!Number.isSafeInteger(base)||base<0||base>2000000000||!Number.isInteger(pct)||pct<0||pct>99)return null;
 const finalPrice=Math.round(base*(100-pct)/100);
 if(pct>0&&(base<1||finalPrice<1||finalPrice>=base))return null;
 return {original:base,percentage:pct,price:finalPrice,saved:base-finalPrice};
}

/* Every newly uploaded BAZOO photo must be <= 15 KiB (15360 bytes). */
const MAX_IMAGE_BYTES=15*1024;
const MAX_BANNER_BYTES=1024*1024; // One mebibyte per desktop/mobile banner
const MAX_ORIGINAL_BYTES=25*1024*1024;
const optimizedImages=new WeakMap();
function humanKb(bytes){return (bytes/1024).toFixed(1)+" كيلوبايت"}
async function compressSiteImage(file,maxWidth=1400,maxHeight=1400,maxBytes=MAX_IMAGE_BYTES){
 if(!file||!file.size)throw Error("الصورة فارغة أو غير صالحة");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("الصورة لازم تكون JPG أو PNG أو WEBP");
 if(file.size>MAX_ORIGINAL_BYTES)throw Error("حجم الصورة الأصلية أكبر من 25 ميگابايت");
 if(file.size<=maxBytes)return file;
 const originalURL=URL.createObjectURL(file);
 try{
  const source=await new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(Error("تعذّرت قراءة الصورة، جرّب صورة ثانية"));
   img.src=originalURL;
  });
  const ow=source.naturalWidth||source.width,oh=source.naturalHeight||source.height;
  if(!ow||!oh||ow*oh>50000000)throw Error("دقة الصورة كبيرة جداً أو غير صالحة");
  const initial=Math.min(1,maxWidth/ow,maxHeight/oh);
  const baseW=Math.max(1,Math.round(ow*initial)),baseH=Math.max(1,Math.round(oh*initial));
  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("المتصفح لا يدعم ضغط الصور");
  const encode=(quality,type)=>new Promise((resolve,reject)=>{
   canvas.toBlob(blob=>blob?resolve(blob):reject(Error("تعذّر تجهيز الصورة")),type,quality);
  });
  const scales=[1,.82,.67,.54,.43,.34,.27,.21,.16,.12,.09,.07,.05,.035];
  for(const scale of scales){
   canvas.width=Math.max(1,Math.round(baseW*scale));
   canvas.height=Math.max(1,Math.round(baseH*scale));
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(source,0,0,canvas.width,canvas.height);
   let type="image/webp";
   let draft=await encode(.35,type);
   if(draft.type!=="image/webp"){
    type="image/jpeg";
    ctx.globalCompositeOperation="destination-over";
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation="source-over";
    draft=await encode(.35,type);
   }
   let lowQuality=.35,highQuality=.88;
   if(draft.size>maxBytes){
    draft=await encode(.12,type);
    if(draft.size>maxBytes)continue;
    lowQuality=.12;
    highQuality=.35;
   }
   let best=draft;
   for(let k=0;k<5;k++){
    const quality=(lowQuality+highQuality)/2;
    const candidate=await encode(quality,type);
    if(candidate.size<=maxBytes){
     best=candidate;lowQuality=quality;
    }else highQuality=quality;
   }
   if(best.size<=maxBytes)return best;
  }
  throw Error("ما گدرنا نضغط الصورة للحجم المحدد. جرّب صورة أبسط أو بدقة أقل.");
 }finally{URL.revokeObjectURL(originalURL)}
}
function optimizedImage(file,maxWidth=1400,maxHeight=1400){
 if(!optimizedImages.has(file))optimizedImages.set(file,compressSiteImage(file,maxWidth,maxHeight));
 return optimizedImages.get(file);
}
function imageExtension(blob){
 return blob.type==="image/webp"?"webp":blob.type==="image/png"?"png":"jpg";
}
async function uploadProductImage(file){
 const optimized=await optimizedImage(file);
 if(optimized.size>MAX_IMAGE_BYTES)throw Error("الصورة المضغوطة تجاوزت 15 كيلوبايت");
 const ext=imageExtension(optimized);
 const path="products/"+crypto.randomUUID()+"."+ext;
 const res=await sb.storage.from("product-images").upload(path,optimized,{contentType:optimized.type,cacheControl:"31536000"});
 if(res.error)throw Error(res.error.message);
 return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
function previewMediaUpload(file,target,showBytes=true){
 if(!file||!target)return;
 target.innerHTML='<span class="media-compress-progress">جاري ضغط الصورة إلى 15 كيلوبايت...</span>';
 optimizedImage(file).then(blob=>{
  if(!target.isConnected)return;
  const url=URL.createObjectURL(blob);
  target.innerHTML='<img alt="معاينة الصورة بعد الضغط" src="'+url+'">'+(showBytes?'<span class="media-size-ok">جاهزة للرفع • '+humanKb(blob.size)+'</span>':'');
  const img=target.querySelector("img");
  img?.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
 }).catch(err=>{if(target.isConnected)target.innerHTML='<span class="media-size-error">'+esc(err.message)+'</span>'});
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
 +'<div class="fullspan image-editor"><div class="image-editor-heading">'+icon("image",22)+' <div><h3>صور المنتج</h3><p>كل صورة تنضغط تلقائياً إلى 15 كيلوبايت أو أقل قبل رفعها.</p></div></div>'
 +'<div class="main-photo-editor"><div class="main-photo-heading"><strong>'+icon("image",18)+' الصورة الرئيسية للمنتج *</strong><small>ارفع الصورة من جهازك، مو رابط. تگدر تبدّلها بأي وقت.</small></div>'
 +'<div class="main-photo-preview" id="mainPhotoPreview">'+(safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="الصورة الرئيسية الحالية"><span class="media-existing-label">الصورة الحالية</span>':'<span class="empty-media-preview">'+icon("image",28)+' اختر الصورة الرئيسية</span>')+'</div>'
 +'<label class="main-photo-picker">'+icon("upload",17)+' <span>اختيار صورة رئيسية من الجهاز</span><input type="file" name="coverPhoto" accept="image/jpeg,image/png,image/webp" aria-label="اختيار الصورة الرئيسية للمنتج"></label></div>'
 +(p.id?gallery:'<p class="subtle">الصور الإضافية تظهر هنا بعد حفظ المنتج.</p>')
 +'<label class="formgroup">صور إضافية (حتى 8 صور) — تُضغط تلقائياً إلى 15 كيلوبايت<input class="field" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple></label><div id="photoUploadPreview" class="photo-upload-preview"></div>'
 +'<p class="media-upload-advice">حدّ الصور 15 كيلوبايت صارم، لذلك بعض الصور عالية التفاصيل والبنرات قد تقل دقتها بشكل ملحوظ بعد الضغط.</p></div>'
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
 const mainInput=f.elements.coverPhoto;
 if(mainInput)mainInput.addEventListener("change",()=>{
  const file=mainInput.files?.[0],target=document.querySelector("#mainPhotoPreview");
  if(file&&target)previewMediaUpload(file,target);
 });
 const uploader=f.elements.photos;
 if(uploader)uploader.addEventListener("change",()=>{
  const root=document.querySelector("#photoUploadPreview");if(!root)return;
  root.innerHTML="";
  const files=Array.from(uploader.files||[]);
  if(files.length>8){notify("الحد الأقصى 8 صور إضافية");return}
  files.forEach((file)=>{
   const tile=document.createElement("div");
   tile.className="compressed-photo-tile";
   root.append(tile);
   previewMediaUpload(file,tile);
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
  image_url:state.products.find(p=>p.id===id)?.image_url||null,
  active:f.get("active")==="true",featured:f.get("featured")==="true",
  on_sale:priceInfo.percentage>0||f.get("promoted_offer")==="true",is_demo:f.get("is_demo")==="true"};
 if(!v.category_id||!Number.isSafeInteger(v.price_iqd)||!Number.isSafeInteger(v.stock)||v.price_iqd<0||v.stock<0)return notify("تحقق من بيانات المنتج");
 const mainFile=form.elements.coverPhoto?.files?.[0]||null;
 const photos=Array.from(form.elements.photos.files||[]);
 if(photos.length>8)return notify("الحد الأقصى 8 صور إضافية");
 if(!mainFile&&!v.image_url)return notify("ارفع صورة رئيسية من جهازك حتى تحفظ المنتج");
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const newlyUploaded=[];
  if(mainFile){
   btn.textContent="جاري ضغط ورفع الصورة الرئيسية...";
   v.image_url=await uploadProductImage(mainFile);
   newlyUploaded.push(v.image_url);
  }
  for(let i=0;i<photos.length;i++){
   btn.textContent="جاري ضغط ورفع صورة "+(i+1)+" من "+photos.length;
   const photoURL=await uploadProductImage(photos[i]);
   newlyUploaded.push(photoURL);
  }
  const saved=id?await sb.from("products").update(v).eq("id",id).select("*").single()
    :await sb.from("products").insert(v).select("*").single();
  if(saved.error)throw Error(saved.error.message);
  const record=saved.data;
  const gallery=state.productImages.filter(x=>x.product_id===record.id);
  const existingURLs=new Set(gallery.map(x=>x.image_url));
  if(!gallery.length&&record.image_url&&!newlyUploaded.includes(record.image_url))newlyUploaded.unshift(record.image_url);
  const additions=newlyUploaded.filter(url=>!existingURLs.has(url));
  if(additions.length){
   const maxOrder=gallery.reduce((n,p)=>Math.max(n,p.sort_order),-1);
   const rows=additions.map((url,i)=>({product_id:record.id,image_url:url,alt_text:v.name,sort_order:maxOrder+i+1}));
   const res=await sb.from("product_images").insert(rows);
   if(res.error)throw Error("تم حفظ المنتج لكن تعذّر تسجيل بعض الصور: "+res.error.message);
  }
  await loadCatalog();state.editProduct=null;notify("تم حفظ المنتج وصوره بعد ضغطها إلى 15 كيلوبايت");render();
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
  +'<p class="note">ارفع البنر المصمّم النهائي من فريق التصميم، بنسختين منفصلتين. تنضغط كل صورة بنر تلقائياً إلى 1 ميگابايت كحد أقصى مع الحفاظ على جودة التصميم قدر الإمكان. صور المنتجات تبقى 15 كيلوبايت.</p>'
  +'<label class="formgroup">رابط داخل المتجر<select name="link_url" class="field">'+[["#/categories","كل المنتجات"],["#/offers","العروض"],["#/home","الرئيسية"],["#/cart","العربة"]].map(([v,l])=>'<option value="'+v+'" '+((p.link_url||"#/categories")===v?"selected":"")+'>'+l+'</option>').join("")+'</select></label>'
  +'<div class="formgrid"><label class="formgroup">مكان الظهور<select name="placement" class="field">'+[["home","الرئيسية"],["categories","الفئات"],["cart","العربة"]].map(([v,l])=>'<option value="'+v+'" '+((p.placement||"home")===v?"selected":"")+'>'+l+'</option>').join("")+'</select></label>'
  +'<label class="formgroup">ترتيب العرض<input type="number" name="sort_order" min="0" max="9999" class="field" value="'+esc(p.sort_order??0)+'"></label>'
  +'<label class="formgroup">الظهور<select name="active" class="field"><option value="true" '+(p.active!==false?"selected":"")+'>منشور</option><option value="false" '+(p.active===false?"selected":"")+'>مخفي</option></select></label>'
  +'<label class="formgroup">نوع البنر<select name="is_demo" class="field"><option value="false" '+(!p.is_demo?"selected":"")+'>حقيقي</option><option value="true" '+(p.is_demo?"selected":"")+'>تجريبي</option></select></label></div>'
  +'<button class="btn primary" type="submit">'+icon("upload",17)+' حفظ ونشر البنر</button></form>');
 const f=document.querySelector("#adminPromoForm");
 for(const type of ["desktop","mobile"]){
  const input=f.elements["photo_"+type];
  input.addEventListener("change",async()=>{
   const file=input.files?.[0],preview=document.getElementById("preview-"+type);
   if(!file||!preview)return;
   preview.innerHTML='<span class="media-compress-progress">جاري ضغط البنر...</span>';
   try{
    const optimized=await prepareBannerPhoto(file,type);
    if(input.files?.[0]!==file||!preview.isConnected)return;
    const url=URL.createObjectURL(optimized);
    preview.innerHTML='<img alt="معاينة البنر المضغوط" src="'+url+'"><span class="media-size-ok">بعد الضغط: '+humanKb(optimized.size)+'</span>';
    preview.querySelector("img")?.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});
   }catch(err){
    if(input.files?.[0]!==file)return;
    preview.innerHTML='<span class="media-size-error">'+esc(err.message)+'</span>';
    notify(err.message);
   }
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
const preparedBanners=new WeakMap();
function prepareBannerPhoto(file,type){
 if(!file?.size)return Promise.resolve(null);
 if(!preparedBanners.has(file)){
  const dims=type==="desktop"?[1440,480]:[720,900];
  preparedBanners.set(file,(async()=>{
   const composited=await cropBanner(file,...dims);
   return await compressSiteImage(composited,dims[0],dims[1],MAX_BANNER_BYTES);
  })());
 }
 return preparedBanners.get(file);
}
async function uploadBannerPhoto(file,type){
 if(!file?.size)return null;
 const blob=await prepareBannerPhoto(file,type);
 if(blob.size>MAX_BANNER_BYTES)throw Error("حجم البنر تجاوز 1 ميگابايت بعد الضغط");
 const name="promotions/"+type+"/"+crypto.randomUUID()+"."+imageExtension(blob);
 const {error}=await sb.storage.from("promo-images").upload(name,blob,{contentType:blob.type,cacheControl:"31536000"});
 if(error)throw Error(error.message);
 return sb.storage.from("promo-images").getPublicUrl(name).data.publicUrl;
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
const state={catalogFailure:false,products:[],productImages:[],categories:[],brands:[],rates:[],promos:[],cart:{},favs:[],galleryIndex:0,user:null,admin:false,adminRole:null,adminPermissions:{},route:"home",category:"",brand:"",q:"",promoIndex:0,checkoutPending:false,selectedGovernorate:"",adminTab:"products",editProduct:null};
try{state.cart=JSON.parse(localStorage.getItem("bazoo_cart_v2")||"{}")||{};state.favs=JSON.parse(localStorage.getItem("bazoo_favs_v2")||"[]")||[]}catch(e){}
if(Array.isArray(state.cart)||typeof state.cart!=="object")state.cart={};
if(!Array.isArray(state.favs))state.favs=[];
function persist(){try{localStorage.setItem("bazoo_cart_v2",JSON.stringify(state.cart));localStorage.setItem("bazoo_favs_v2",JSON.stringify(state.favs))}catch(e){};$("#cartBadge").textContent=Object.values(state.cart).reduce((s,n)=>s+Number(n||0),0)||""}
function notify(msg){const x=$("#toast");x.textContent=msg;x.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>x.classList.remove("show"),3800)}
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
 for(const field of fields){
  if(field.disabled||field.type==="hidden"||field.type==="file")continue;
  const value=String(field.value||"").trim();
  const label=field.closest("label")?.textContent?.trim()?.slice(0,65)||"الحقل";
  if(field.required&&!value){notify("يرجى تعبئة: "+label);field.focus();return false}
  if(!value)continue;
  if(field.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){notify("يرجى كتابة بريد إلكتروني صحيح");field.focus();return false}
  if(field.minLength>0&&value.length<field.minLength){notify("القيمة قصيرة في: "+label);field.focus();return false}
  if(field.maxLength>0&&value.length>field.maxLength){notify("القيمة طويلة في: "+label);field.focus();return false}
  if(field.pattern&&!(new RegExp("^(?:"+field.pattern+")$")).test(value)){notify("صيغة البيانات غير صحيحة في: "+label);field.focus();return false}
  if(field.type==="number"&&(Number.isNaN(Number(value))||(field.min!==""&&Number(value)<Number(field.min))||(field.max!==""&&Number(value)>Number(field.max)))){notify("أدخل رقماً صحيحاً في: "+label);field.focus();return false}
 }
 return true;
}
function go(route){location.hash="#/"+route;if(location.hash==="#/"+route)render();if(route.startsWith("product/"))window.scrollTo?.({top:0,behavior:"instant"})}
function catName(id){return state.categories.find(x=>x.id===id)?.name||"منتج"}
function brandName(id){return state.brands.find(x=>x.id===id)?.name||""}
const activeProducts=()=>state.products.filter(p=>{
 if(!p.active)return false;
 const c=state.categories.find(x=>x.id===p.category_id),b=state.brands.find(x=>x.id===p.brand_id);
 const parent=c?.parent_id?state.categories.find(x=>x.id===c.parent_id):null;
 return (!c||c.active)&&(!parent||parent.active)&&(!b||b.active);
});
function filterProducts({category=state.category,brand=state.brand,q=state.q,onSale=false}={}){
 const descendants=category?state.categories.filter(c=>String(c.parent_id)===String(category)).map(c=>c.id):[];
 return activeProducts().filter(p=>{
 const matchCat=!category||String(p.category_id)===String(category)||descendants.some(id=>String(id)===String(p.category_id));
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
function productGrid(ps){return ps.length?'<div class="grid-products">'+ps.map(productCard).join("")+'</div>':'<div class="notice">ماكو منتجات منشورة بهذا القسم حالياً. راح تظهر المنتجات هنا من يضيفها فريق بازو </div>'}
function productRail(products,id){
 if(!products.length)return homeEmpty("منتجات جديدة قريباً","رح تظهر منتجات هذا القسم مباشرة من يرفعها الفريق.","package");
 return '<div class="rail-container" data-rail="'+id+'"><button class="rail-arrow rail-back" data-rail-move="1" data-rail-id="'+id+'" aria-label="منتجات سابقة">'+icon("chevron-right",22)+'</button><div class="rail-scroll" data-rail-track="'+id+'" tabindex="0" aria-label="مرر لاستعراض بقية المنتجات">'+products.map(productCard).join("")+'</div><button class="rail-arrow rail-next attention" data-rail-move="-1" data-rail-id="'+id+'" aria-label="اسحب لرؤية بقية المنتجات">'+icon("chevron-left",22)+'</button></div>';
}
function railSection(id,kicker,title,products,route){
 if(!products.length)return '';
 return '<section class="home-section home-rail-section"><div class="rail-heading"><div><div class="kicker">'+esc(kicker)+'</div><h2>'+esc(title)+'</h2></div><button class="section-link" '+(route==='offers'?'data-go="offers"':route==='categories'?'data-go="categories"':'data-main-cat="'+esc(route)+'"')+'>استكشف المزيد '+icon("arrow-left",16)+'</button></div>'+productRail(products,id)+'</section>';
}

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
 if(promos.length)return promos.map(p=>{
  const linked=state.products.find(x=>x.id===p.product_id&&x.active);
  return {title:p.title,subtitle:p.subtitle,demo:!!p.is_demo||!!linked?.is_demo,artworkOnly:!!p.artwork_only,
   desktop:p.desktop_image_url||p.image_url||linked?.image_url,mobile:p.mobile_image_url||p.desktop_image_url||p.image_url||linked?.image_url,
   productId:linked?.id||null,
   route:/^#\/(home|categories|offers|cart)$/.test(p.link_url||"")?p.link_url.slice(2):"categories",
   cta:linked?"اكتشف المنتج":"تسوّق الآن"};
 });
 const photo=state.products.find(p=>p.active&&p.featured&&safeImg(p.image_url))?.image_url||null;
 return [{title:"تسوّق بسهولة من BAZOO",subtitle:"كل ما يحتاجه البيت من الإلكترونيات والأجهزة والقرطاسية. اختار اللي يعجبك.",desktop:photo,mobile:photo,demo:!state.products.some(p=>!p.is_demo),route:"categories",cta:"اكتشف المنتجات"}];
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
  +'<div class="merch-content">'+(slide.demo?'<span class="merch-demo-stamp">بانر تجريبي</span>':'')
  +'<span class="merch-eyebrow">'+icon("sparkles",17)+' اختيارات BAZOO</span><h1>'+esc(slide.title)+'</h1>'
  +'<p>'+esc(slide.subtitle||"")+'</p><div class="hero-buttons"><button class="btn accent" '+action+'>'+esc(slide.cta||"تسوّق الآن")+' '+icon("arrow-left",17)+'</button></div></div></div>';
 return inner+'<div class="slider-controls"><button data-slide="-1" aria-label="العرض السابق">'+icon("chevron-right",18)+'</button>'
  +'<div class="slider-dots" aria-label="شرائح العروض">'+slides.map((p,i)=>'<button data-slide-to="'+i+'" class="'+(idx===i?'active':'')+'" aria-label="العرض '+(i+1)+'" aria-current="'+(idx===i?'true':'false')+'"></button>').join("")+'</div>'
  +'<button data-slide="1" aria-label="العرض التالي">'+icon("chevron-left",18)+'</button></div>';
}
function categoryCircles(){
 const list=state.categories.length?state.categories.filter(c=>c.active&&c.parent_id).map(c=>({id:c.id,slug:c.slug,name:c.name})):homeCategoryDefaults.map(c=>({...c,id:null}));
 return '<div class="home-categories compact-categories">'+list.map(c=>'<button class="round-category" '+(c.id?'data-cat="'+c.id+'"':'data-go="categories"')+'><span class="category-circle">'+icon(slugIcons[c.slug]||"grid",24)+'</span><span class="category-name">'+esc(c.name)+'</span></button>').join("")+'</div>';
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
 const catProducts=slug=>{const c=state.categories.find(x=>x.slug===slug);if(!c)return [];const children=state.categories.filter(x=>x.parent_id===c.id).map(x=>x.id);return products.filter(p=>p.category_id===c.id||children.includes(p.category_id))};
 return '<div class="home-main"><section class="merch-slider alt-'+(state.promoIndex%3)+'" id="heroSlider" aria-label="العروض الرئيسية">'+drawHero()+'</section>'
 +'<section class="home-section"><div class="rail-heading"><div><div class="kicker">اكتشف الأقسام</div><h2>تسوّق حسب الفئة</h2></div></div>'+categoryCircles()+'</section>'
 +railSection("offers","اختيارات خاصة","أفضل العروض",offers,"offers")
 +railSection("featured","مختارة لك","منتجات مميزة",featured.length?featured:products.slice(0,9),"categories")
 +railSection("electrical","كل ما يحتاجه البيت","الأجهزة الكهربائية",catProducts("appliances"),"appliances")
 +railSection("tech","تقنيات حديثة","الإلكترونيات",catProducts("electronics"),"electronics")
 +railSection("study","للشغل والدراسة","القرطاسية",catProducts("stationery"),"stationery")
 +'<section class="home-section">'+sectionHead("اختار العلامة اللي تثق بيها","العلامات التجارية")+brandGallery()+'</section>'
 +'<section class="benefits home-benefits"><div class="benefit"><i>'+icon("truck",25)+'</i><div><strong>توصيل لكل العراق</strong><small>حسب أجور المحافظة</small></div></div><div class="benefit"><i>'+icon("package",25)+'</i><div><strong>منتجات متنوعة</strong><small>الفريق يحدّثها باستمرار</small></div></div><div class="benefit"><i>'+icon("shield-check",25)+'</i><div><strong>طلب آمن</strong><small>مع متابعة حالة الطلب</small></div></div><div class="benefit"><i>'+icon("headphones",25)+'</i><div><strong>تسوق بكل سهولة</strong><small>من الموبايل والكمبيوتر</small></div></div></section></div>';
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
 const rows=cartEntries();

 return '<div class="page"><h1>عربة التسوّق <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#shopping-bag"></use></svg></h1><p class="subtle">راجع المنتجات قبل تأكيد الطلب</p>'+(!rows.length?'<div class="notice"><h2>عربتك فارغة حالياً</h2><button class="btn accent" data-go="categories">ابدأ التسوق</button></div>':'<div class="two-col"><section class="card"><h2 class="sectiontitle">المنتجات ('+rows.length+')</h2>'+rows.map(({p,qty})=>'<div class="cartrow"><div class="cartpic">'+(safeImg(p.image_url)?'<img src="'+safeImg(p.image_url)+'" alt="'+esc(p.name)+'">':placeholder)+'</div><div><strong>'+esc(p.name)+'</strong><p class="cost">'+money(p.price_iqd)+'</p><div class="qty"><button data-qty="'+p.id+'" data-step="-1"><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#minus"></use></svg></button>'+qty+'<button data-qty="'+p.id+'" data-step="1" '+(qty>=p.stock?"disabled":"")+'><svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#plus"></use></svg></button></div></div><button class="btn danger" data-remove="'+p.id+'">حذف</button></div>').join("")+'</section><aside class="card"><h2 class="sectiontitle">ملخص الطلب</h2><div class="row summaryline"><span>مجموع المنتجات</span><strong>'+money(subtotal())+'</strong></div><div class="formgroup province-field"><span>محافظة التوصيل</span><input id="cartGovernorate" type="hidden" value=""><button type="button" class="province-trigger" data-province-context="cart">'+icon("map-pin",20)+' <span id="cartProvinceLabel">اختار المحافظة</span>'+icon("chevron-left",18)+'</button></div><div class="row summaryline"><span>التوصيل</span><strong id="shippingPrice">اختر المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="grandTotal">'+money(subtotal())+' + التوصيل</strong></div><button class="btn accent" id="toCheckout" style="width:100%;margin-top:19px">متابعة الطلب <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button><p class="note">تأكيد الطلب يتطلب حساباً مسجّلاً. الدفع عند الاستلام أو التنسيق عبر واتساب. المنتجات التجريبية للمعاينة فقط.</p></aside></div>')+'<section class="section">'+sectionHead("قد يعجبك أيضاً","منتجات مشابهة")+productGrid(activeProducts().filter(p=>!state.cart[p.id]).slice(0,4))+'</section>'+promoFrame("cart")+'</div>';
}
function checkout(){if(!cartEntries().length)return cart();if(!state.user){state.checkoutPending=true;return authView("أكمل التسجيل أو الدخول حتى تأكد طلبك");}

 return '<div class="page"><h1>تأكيد الطلب</h1><p class="subtle">تأكد من معلوماتك والتوصيل قبل إرسال طلبك</p><div class="two-col"><form class="card" id="orderForm"><div class="formgrid"><label class="formgroup">الاسم الكامل *<input name="customer_name" required minlength="2" maxlength="120" class="field" autocomplete="name"></label><label class="formgroup">رقم الهاتف * (11 رقم)<input name="phone" class="field" inputmode="numeric" autocomplete="tel" required pattern="07[0-9]{9}" minlength="11" maxlength="11" placeholder="07XXXXXXXXX"></label><div class="formgroup province-field"><span>المحافظة *</span><input name="governorate" type="hidden" id="orderGovernorate" value=""><button type="button" class="province-trigger" data-province-context="order">'+icon("map-pin",20)+' <span id="orderProvinceLabel">اختار المحافظة</span>'+icon("chevron-left",18)+'</button></div><div class="formgroup"><span>طريقة الدفع *</span><div class="payment-choices"><label><input type="radio" name="payment" value="cod" checked><span>'+icon("wallet",20)+' الدفع عند الاستلام</span></label><label><input type="radio" name="payment" value="whatsapp"><span>'+icon("credit-card",20)+' التنسيق للدفع عبر واتساب</span></label></div></div><label class="formgroup fullspan">العنوان الكامل وأقرب نقطة دالة *<textarea class="field" name="address" minlength="8" maxlength="500" required placeholder="المنطقة، الزقاق، رقم الدار، أقرب نقطة دالة"></textarea></label><label class="formgroup fullspan">ملاحظات (اختياري)<textarea name="note" class="field" maxlength="1000"></textarea></label></div><p class="note">الطلب يُحفظ في النظام بعد تأكيدك. خيار واتساب يعني تنسيق الدفع مع الفريق وليس دفعاً إلكترونياً فورياً.</p><button class="btn accent" type="submit">تأكيد الطلب وحفظه <svg class="svg-icon" aria-hidden="true"><use href="./icons.svg#arrow-left"></use></svg></button></form><aside class="card"><h2 class="sectiontitle">تفاصيل طلبك</h2>'+cartEntries().map(({p,qty})=>'<div class="row summaryline"><span>'+esc(p.name)+' × '+qty+'</span><strong>'+money(p.price_iqd*qty)+'</strong></div>').join("")+'<div class="row summaryline"><strong>المنتجات</strong><strong>'+money(subtotal())+'</strong></div><div class="row summaryline"><span>أجور التوصيل</span><strong id="checkoutShip">اختار المحافظة</strong></div><div class="row summaryline"><b>المجموع</b><strong id="checkoutTotal">'+money(subtotal())+' + التوصيل</strong></div></aside></div></div>';
}
function authView(title="حسابك في بازو"){
 return '<section class="page auth-page"><div class="auth-shell"><div class="auth-form-panel"><a class="auth-back" href="#/home">'+icon("arrow-right",16)+' رجوع للمتجر</a><div class="auth-symbol">'+icon("user-round",29)+'</div><div class="auth-heading"><span class="kicker">BAZOO MEMBERS</span><h1>'+esc(title)+'</h1><p class="subtle">سجّل دخولك حتى تتابع طلباتك، أو أنشئ حساب جديد خلال لحظات.</p></div><div class="auth-tabs" role="group" aria-label="نوع الدخول"><button type="button" class="active" data-auth-mode="login">'+icon("log-in",18)+' تسجيل الدخول</button><button type="button" data-auth-mode="signup">'+icon("user-plus",18)+' حساب جديد</button></div><form id="authForm" class="stack"><input type="hidden" name="mode" value="login"><label class="formgroup auth-signup-field hidden">الاسم الكامل<span class="input-icon">'+icon("user",19)+'<input type="text" name="full_name" class="field" minlength="2" maxlength="100" autocomplete="name" placeholder="اسمك الكامل"></span></label><label class="formgroup">البريد الإلكتروني<span class="input-icon">'+icon("mail",19)+'<input type="email" name="email" class="field" required autocomplete="email" placeholder="example@email.com" dir="ltr"></span></label><label class="formgroup">كلمة المرور<span class="input-icon auth-password">'+icon("lock",19)+'<input type="password" name="password" class="field" required minlength="6" autocomplete="current-password" placeholder="أدخل كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><label class="formgroup auth-signup-field hidden">تأكيد كلمة المرور<span class="input-icon auth-password">'+icon("shield-check",19)+'<input type="password" name="confirm_password" class="field" minlength="6" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور" dir="ltr"><button type="button" class="password-toggle" data-password-toggle="confirm_password" aria-label="إظهار كلمة المرور">'+icon("eye",19)+'</button></span></label><button type="button" class="forgot-link" id="resetPassword">نسيت كلمة المرور؟</button><button type="submit" class="btn primary auth-submit">'+icon("log-in",19)+' تسجيل الدخول</button></form><p id="authMessage" class="auth-feedback" role="status" aria-live="polite"></p><div class="auth-footnote">'+icon("shield-check",17)+' بيانات حسابك محمية بنظام Supabase Auth</div></div><aside class="auth-art"><div class="auth-art-orbit one"></div><div class="auth-art-orbit two"></div><div class="auth-art-content"><div class="auth-art-logo">'+icon("shopping-bag",52)+'</div><div class="auth-art-kicker">مرحباً بيك في BAZOO</div><h2>كل اختياراتك،<br>في مكان واحد.</h2><p>تسوّق براحتك، احفظ طلباتك، وتابع كل جديد من بازو.</p><div class="auth-benefit">'+icon("package",20)+' تتبع الطلبات من حسابك</div><div class="auth-benefit">'+icon("shield-check",20)+' تسجيل آمن وسهل</div><div class="auth-benefit">'+icon("shopping-cart",20)+' عربة تسوّق متزامنة مع جهازك</div></div></aside></div></section>';
}
async function account(){if(!state.user)return authView();const {data,error}=await sb.from("orders").select("id,created_at,status,subtotal_iqd,shipping_iqd,total_iqd,governorate,payment_method,order_items(product_name,quantity,unit_price_iqd)").order("created_at",{ascending:false}).limit(60);return '<div class="page"><div class="row"><div><h1>حسابي وطلباتي</h1><p class="user-info">'+esc(state.user.email)+'</p></div><button class="btn outline" id="signOut">تسجيل خروج</button></div><div class="section"><h2>طلباتي</h2>'+(error?'<p class="error">تعذر تحميل الطلبات</p>':!(data||[]).length?'<div class="notice">ما عندك طلبات بعد. تگدر تتصفح المنتجات وتطلب من المتجر.</div>':data.map(o=>'<div class="order"><div class="row"><div><strong class="orderid">'+esc(o.id.slice(0,8).toUpperCase())+'</strong><p class="subtle">'+new Date(o.created_at).toLocaleDateString("ar-IQ")+' — '+esc(o.governorate)+'</p></div><span class="status">'+esc(label[o.status]||o.status)+'</span></div><p>'+o.order_items.map(i=>esc(i.product_name)+' × '+i.quantity).join('، ')+'</p><strong class="cost">'+money(o.total_iqd)+'</strong></div>').join(""))+'</div>'+'</div>'}

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
 +(p.is_demo?'<p class="demo-alert">'+icon("circle-alert",19)+' هذا منتج تجريبي للمعاينة فقط ولا يمكن تأكيد شراءه.</p>':'')
 +'<div class="stock-indicator">'+icon(p.stock>0?"check-circle":"circle-alert",18)+(p.stock>0?"متوفر بالمخزون":"غير متوفر حالياً")+'</div>'
 +'<p class="detail-description">'+esc(p.description||"تظهر تفاصيل المنتج هنا بعد إضافتها من إدارة بازو.")+'</p>'
 +'<div class="detail-actions"><button class="btn accent" data-add="'+p.id+'" '+(p.stock<1?'disabled':'')+'>'+icon("shopping-bag",20)+' أضف للعربة</button><button class="btn outline" data-fav="'+p.id+'">'+icon("heart",18)+' المفضلة</button></div>'
 +'<div class="detail-delivery">'+icon("truck",20)+' من بازو لباب بيتك، بكل أنحاء العراق. أجور التوصيل تظهر قبل تأكيد الطلب.</div>'
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
 if(!state.user){state.admin=false;state.adminRole=null;state.adminPermissions={};renderCategoryNav();return}
 const {data,error}=await sb.from("admin_members").select("user_id,role,permissions").eq("user_id",state.user.id).maybeSingle();
 state.admin=!error&&!!data;
 state.adminRole=state.admin?data.role:null;
 state.adminPermissions=state.admin&&data.permissions&&typeof data.permissions==="object"?data.permissions:{};
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
async function loadCatalog(){
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
 let failed=false;
 results.forEach((out,i)=>{
  if(out.status==="fulfilled")state[requests[i][0]]=out.value;
  else {failed=true;console.warn("BAZOO catalog:",out.reason);}
 });
 state.catalogFailure=failed;renderCategoryNav();
 return !failed;
}
async function refreshAuth(){const {data}=await sb.auth.getUser();state.user=data?.user||null;await checkAdmin()}
async function submitOrder(f){
 const d=new FormData(f),p=String(d.get("phone")).trim();
 if(cartEntries().some(x=>x.p.is_demo))return notify("توجد منتجات تجريبية في السلة؛ لا يمكن تأكيد شرائها.");
 if(!/^07[0-9]{9}$/.test(p))return notify("رقم الهاتف لازم يكون 11 رقم ويبدأ بـ 07");
 const governorate=String(d.get("governorate"));if(!state.rates.some(x=>x.governorate===governorate&&x.enabled))return notify("التوصيل غير متوفر لهذه المحافظة حالياً");
 const items=cartEntries().map(({p,qty})=>({id:p.id,quantity:qty}));if(!items.length)return notify("العربة فارغة");
 const btn=f.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="جارٍ حفظ الطلب...";
 const {data,error}=await sb.rpc("place_order",{p_items:items,p_name:d.get("customer_name"),p_phone:p,p_governorate:governorate,p_address:d.get("address"),p_note:d.get("note")||"",p_payment_method:d.get("payment")});
 btn.disabled=false;btn.innerHTML="تأكيد الطلب وحفظه "+icon("arrow-left",18);
 if(error){notify("ما تم حفظ الطلب: "+error.message);await loadCatalog();return}
 state.cart={};state.checkoutPending=false;persist();await loadCatalog();notify("تم حفظ طلبك بنجاح ");go("account");openModal("تم تأكيد طلبك",'<p>استلمنا طلبك داخل النظام بنجاح.</p><p>رقم الطلب: <strong>'+esc(data)+'</strong></p><p class="subtle">تگدر تتابع حالة الطلب من صفحة حسابك. إذا اخترت التنسيق عبر واتساب، راح تحتاج تتواصل ويا المتجر بعد إضافة رقم التواصل الرسمي.</p><button class="btn primary" id="doneOrder">مشاهدة طلباتي</button>');$("#doneOrder").onclick=closeModal;
}
function openProvincePicker(context){
 const current=context==="cart"?"cart":"order";
 const enabled=new Map(state.rates.filter(x=>x.enabled).map(x=>[x.governorate,x.price_iqd]));
 const items=govs.map(g=>'<button type="button" class="province-item" data-pick-province="'+esc(g)+'" data-province-target="'+current+'" '+(!enabled.has(g)?'disabled':'')+'><span class="province-name">'+icon("map-pin",16)+' '+esc(g)+'</span><span class="province-rate">'+(enabled.has(g)?money(enabled.get(g)):"الأجور قيد التحديد")+'</span></button>').join("");
 openModal("اختيار محافظة التوصيل",'<div class="province-sheet"><p>نوصل لجميع محافظات العراق. المحافظات التي لم تُحدد أجورها بعد تظهر هنا لحين اعتمادها من فريق بازو.</p><div class="province-search">'+icon("search",18)+'<input id="provinceSearch" placeholder="ابحث عن محافظة..." autocomplete="off" aria-label="ابحث عن محافظة"></div><div class="province-list">'+items+'</div></div>');
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
 const s=$(sel);if(!s)return;s.addEventListener("change",()=>{const rate=state.rates.find(x=>x.governorate===s.value&&x.enabled);const label=document.querySelector(s.id==="cartGovernorate"?"#cartProvinceLabel":"#orderProvinceLabel");if(label)label.textContent=s.value||"اختار المحافظة";$(ship).textContent=rate?money(rate.price_iqd):"اختر محافظة متاحة";$(total).textContent=rate?money(subtotal()+rate.price_iqd):money(subtotal())+" + التوصيل"});
}
const {adminPage,bindAdmin,saveProduct,showPromoEditor,savePromo,saveTaxonomy,saveMember}=createAdmin({sb,state,esc,money,safeImg,loadCatalog,notify,render,openModal,closeModal,go,icon,confirmAction});
async function render(){
 const hash=decodeURIComponent(location.hash.replace(/^#\/?/,""))||"home";const parts=hash.split("/");const route=parts[0]||"home";state.route=route;
 document.querySelectorAll("#bottomNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 document.querySelectorAll("#categoryNav button").forEach(x=>x.classList.toggle("active",x.dataset.go===route));
 let content="";
 if(route==="home")content=home();else if(route==="categories")content=categories();else if(route==="offers")content=offers();else if(route==="brands")content=brandsPage();else if(route==="product"){state.galleryIndex=0;content=productDetailsPage(parts[1]||"");}else if(route==="favorites")content=favoritesPage();else if(route==="cart")content=cart();else if(route==="checkout")content=checkout();else if(route==="account")content=await account();else if(route==="market")content=market();else if(route==="admin")content=state.admin?await adminPage():'<div class="page"><div class="notice">هذه الصفحة مخصصة لفريق إدارة بازو فقط. <a href="#/account">انتقل للحساب</a></div></div>';else content=home();
 if(state.route!==route)return;
 if(state.catalogFailure)content='<div class="connection-notice" role="alert">'+icon("circle-alert",20)+' <span>تعذّر الاتصال بقاعدة بيانات بازو. تأكد من الإنترنت ثم أعد المحاولة.</span> <button class="btn outline" id="retryCatalog">'+icon("refresh",16)+' إعادة المحاولة</button></div>'+content;
 $("#app").innerHTML=content;$("#app").querySelectorAll("form").forEach(f=>f.noValidate=true);
 if(route==="cart"){const g=$("#cartGovernorate");if(g){g.value=state.selectedGovernorate;g.addEventListener("change",()=>state.selectedGovernorate=g.value);}shippingBind("#cartGovernorate","#shippingPrice","#grandTotal");if(g)g.dispatchEvent(new Event("change"))}
 if(route==="checkout"){const g=$("#orderGovernorate");if(g)g.value=state.selectedGovernorate;shippingBind("#orderGovernorate","#checkoutShip","#checkoutTotal");g?.dispatchEvent(new Event("change"))}
 if(route==="admin")bindAdmin();
}
document.addEventListener("click",async e=>{
 const b=e.target.closest("button,[data-detail]");if(!b)return;
 if(b.dataset.provinceContext){openProvincePicker(b.dataset.provinceContext);return}
 if(b.dataset.pickProvince){chooseProvince(b.dataset.pickProvince,b.dataset.provinceTarget);return}
 if(b.dataset.go){if($("#modal").classList.contains("show"))closeModal();go(b.dataset.go);return}
 if(b.dataset.mainCat){const c=state.categories.find(x=>x.slug===b.dataset.mainCat);state.category=c?String(c.id):"";state.brand="";state.q="";go("categories");return}
 if(b.dataset.brand){state.brand=b.dataset.brand;state.category="";state.q="";go("categories");return}
 if(b.dataset.cat){state.category=b.dataset.cat;state.brand="";state.q="";go("categories");return}
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
 if(b.id==="toCheckout"){if(cartEntries().some(x=>x.p.is_demo)){openModal("طلب تجريبي للمعاينة",'<p class="subtle">العربة تحتوي على نماذج عرض وأسعار توضيحية. يمكنك تجربة الإضافة والتصفح، لكن تأكيد الشراء متاح للمنتجات الحقيقية فقط.</p><button class="btn primary" data-go="categories">استعرض المنتجات</button>');return}if(!$("#cartGovernorate").value)return notify("اختار المحافظة حتى نحسب التوصيل");state.selectedGovernorate=$("#cartGovernorate").value;go("checkout");return}
 if(b.id==="retryCatalog"){await loadCatalog();render();return}
 if(b.id==="resetPassword"){const email=$('#authForm input[name="email"]')?.value.trim();if(!email)return notify("اكتب البريد الإلكتروني أولاً");const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"#/account"});notify(error?error.message:"إذا البريد مسجل، راح توصلك رسالة إعادة تعيين كلمة المرور");return}
 if(b.id==="signOut"){await sb.auth.signOut();state.user=null;state.admin=false;state.adminRole=null;state.adminPermissions={};renderCategoryNav();notify("تم تسجيل الخروج");go("home");return}
 if(b.dataset.adminTab){state.adminTab=b.dataset.adminTab;state.editProduct=null;render();return}
 if(b.dataset.editProduct){state.editProduct=b.dataset.editProduct;render();return}
 if(b.id==="newProduct"){state.editProduct="new";render();return}
 if(b.dataset.editPromo){showPromoEditor(b.dataset.editPromo);return}
 if(b.id==="newPromo"){showPromoEditor("new");return}
});
document.addEventListener("change",e=>{if(e.target.id==="categoryFilter"){state.category=e.target.value;render()}if(e.target.id==="brandFilter"){state.brand=e.target.value;render()}});
let searchDebounce;document.addEventListener("input",e=>{
 if(e.target.id==="provinceSearch"){const q=e.target.value.trim();document.querySelectorAll(".province-item").forEach(x=>x.hidden=!x.textContent.includes(q));return}
 if(e.target.id==="filterSearch"){clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>{state.q=e.target.value;const old=document.activeElement?.selectionStart;render();const x=$("#filterSearch");x?.focus();if(typeof old==="number")x?.setSelectionRange(old,old)},400)}});
document.addEventListener("submit",async e=>{const id=e.target.id;if(id==="searchForm"){e.preventDefault();state.q=$("#searchBox").value.trim();state.category="";state.brand="";go("categories");return}if(!["authForm","orderForm","adminProductForm","adminPromoForm","adminTaxonomyForm","adminMemberForm"].includes(id))return;e.preventDefault();if(!validateSiteForm(e.target))return;if(id==="authForm")await authSubmit(e.target);if(id==="orderForm")await submitOrder(e.target);if(id==="adminProductForm")await saveProduct(e.target);if(id==="adminPromoForm")await savePromo(e.target);if(id==="adminTaxonomyForm")await saveTaxonomy(e.target);if(id==="adminMemberForm")await saveMember(e.target)});
$("#accountBtn").onclick=()=>go("account");$("#cartBtn").onclick=()=>go("cart");$("#favoritesBtn").onclick=()=>go("favorites");$("#year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.dataset.detail){e.preventDefault();detail(e.target.dataset.detail)}});
window.addEventListener("hashchange",render);
setInterval(()=>{if(state.route!=="home"||document.hidden||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const hero=$("#heroSlider");if(!hero)return;state.promoIndex=(state.promoIndex+1)%storefrontSlides().length;hero.innerHTML=drawHero();hero.className="merch-slider alt-"+(state.promoIndex%3)},7000);
sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT"){setTimeout(async()=>{await refreshAuth();if(["account","admin","checkout"].includes(state.route))render()},0)}});
persist();
render();
(async()=>{try{await refreshAuth();await loadCatalog();await render()}catch(error){console.error("BAZOO startup error:",error);state.catalogFailure=true;await render()}})();

