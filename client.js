/**
 * BAZOO minimal native Supabase HTTP client.
 * Eliminates the third-party JS CDN dependency.
 * Uses Supabase Auth, PostgREST, RPC and Storage with the publishable key only.
 */
export function createClient(baseUrl, publishableKey) {
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
      if(!res.ok)throw new Error(res.error?.message||"انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.");
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
      if(!response.ok)return {data:null,error:{message:data?.message||data?.msg||data?.error_description||data?.error||("خطأ في الاتصال، الرمز: "+response.status),status:response.status},ok:false,status:response.status};
      return {data,error:null,ok:true,status:response.status};
    }catch(error){return {data:null,error:{message:error.name==="AbortError"?"انتهت مهلة الاتصال بقاعدة البيانات":error.message||"تعذّر الاتصال بالخادم."},ok:false,status:0}}
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
      if(this.one&&!data&&!this.maybe)return {data:null,error:{message:"لم يتم العثور على السجل."}};
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
