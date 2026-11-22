// Behavioral regression test for the rebuilt admin panel without real customer records.
const assert=require("node:assert/strict"),fs=require("node:fs");
let source=fs.readFileSync("admin-panel.js","utf8");
source=source.replace('import { createClient } from "./client.js";',"");
const store={
 products:[{id:"p1",name:"منتج قديم",category_id:2,price_iqd:100000,compare_at_iqd:null,stock:5,description:"",sku:null,brand_id:null,image_url:null,active:true,featured:false,on_sale:false,is_demo:false,specifications:{}}],
 categories:[{id:1,name:"أجهزة",parent_id:null,sort_order:0,active:true},{id:2,name:"هواتف",parent_id:1,sort_order:1,active:true}],
 brands:[],product_images:[],promotions:[],shipping_rates:[{governorate:"بغداد",price_iqd:4000,enabled:true}],orders:[{id:"o1",status:"new",order_items:[{id:12,order_id:"o1",status:"new"}]}],
 order_items:[{id:12,order_id:"o1",status:"new"}]
};
class Query{
 constructor(table){this.table=table;this.method="get";this.filter={};this.body=null}
 select(){return this}
 order(){return this}
 limit(){return this}
 eq(name,val){this.filter[name]=val;return this}
 update(obj){this.method="update";this.body=obj;return this}
 insert(obj){this.method="insert";this.body=obj;return this}
 delete(){this.method="delete";return this}
 async execute(){
  const data=store[this.table];assert.ok(data,"unknown table "+this.table);
  let matches=data.filter(row=>Object.entries(this.filter).every(([k,v])=>String(row[k])===String(v)));
  if(this.method==="update"){matches.forEach(x=>Object.assign(x,this.body))}
  if(this.method==="insert"){const entry={id:"new-p1",...this.body};data.push(entry);matches=[entry]}
  if(this.method==="delete"){matches.forEach(row=>data.splice(data.indexOf(row),1))}
  return {data:matches.map(x=>({...x})),error:null};
 }
 async single(){const r=await this.execute();return {data:r.data[0]||null,error:r.data[0]?null:{message:"No rows"}}}
 async maybeSingle(){const r=await this.execute();return {data:r.data[0]||null,error:null}}
 then(resolve,reject){return this.execute().then(resolve,reject)}
}
const api={auth:{getUser:async()=>({data:{user:{id:"owner1",email:"owner@example.invalid"}},error:null})},
 rpc:async name=>name==="my_admin_access"?{data:{user_id:"owner1",role:"owner",permissions:{}},error:null}:{data:{},error:null},
 from:table=>new Query(table),storage:{from(){throw Error("Unexpected storage upload")}}};
const elements=new Map();
function node(id){
 if(!elements.has(id))elements.set(id,{id,innerHTML:"",textContent:"",hidden:id==="overlay"||id==="alert",disabled:false,className:"",style:{},
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},scrollIntoView(){}});
 return elements.get(id);
}
const document={getElementById:node,addEventListener(){},body:{style:{}},createElement(){throw Error("Unexpected image creation")}};
const window={addEventListener(){}};
const sessionStorage={getItem(){return null},setItem(){},removeItem(){}};
class FormData{
 constructor(form){this.values=form.values||{}}
 get(k){return this.values[k]??null}
 has(k){return Object.hasOwn(this.values,k)}
}
const factory=new Function("createClient","document","window","sessionStorage","FormData","crypto","Image",source+
 "\nreturn {bootPromise,state,onSubmit,saveOrder,renderContent};");
const admin=factory(()=>api,document,window,sessionStorage,FormData,{randomUUID:()=>"test-id"},function(){});
function form(values){
 const button={disabled:false};
 return {id:"productForm",values,dataset:{},matches:()=>true,querySelector(s){
  if(s==='[type="submit"]')return button;
  if(s==='[name="coverPhoto"]'||s==='[name="photos"]')return {files:[]};
  return null;
 }};
}
(async()=>{
 await admin.bootPromise;
 assert.equal(admin.state.adminVerified,true,"owner must pass server-side permission check");
 assert.match(node("content").innerHTML,/إدارة المنتجات/,"real admin screen did not render");
 const values={id:"p1",name:"منتج محدث",category_id:"2",brand_id:"",price:"100000",discount:"20",stock:"7",sku:"ITEM1",
  active:"true",featured:"false",is_demo:"false",on_sale:"true",description:"وصف",specs:"اللون: أسود"};
 let f=form(values),prevented=false;
 await admin.onSubmit({target:f,preventDefault(){prevented=true},stopPropagation(){}});
 assert.equal(prevented,true,"submit must not navigate or refresh the browser");
 assert.equal(store.products[0].price_iqd,80000,"discount must save in DB");
 assert.equal(store.products[0].stock,7,"stock must save in DB");
 assert.equal(store.products[0].name,"منتج محدث","product name must save in DB");
 assert.match(node("alert").textContent,/تم حفظ المنتج/);
 assert.equal(node("alert").className,"alert success");
 node("overlay").hidden=false;
 f=form({...values,price:"-400"});
 await admin.onSubmit({target:f,preventDefault(){},stopPropagation(){}});
 assert.equal(store.products[0].price_iqd,80000,"bad save must never replace valid data");
 assert.equal(node("overlay").hidden,false,"failed editor must remain open");
 assert.equal(node("alert").className,"alert error");
 const control={dataset:{order:"o1",current:"new"},value:"packing"};
 await admin.saveOrder(control);
 assert.equal(store.orders[0].status,"packing","order status write must persist");
 console.log("PASS BAZOO new admin: owner verified, actual product write/readback, failed saves retained, status write verified");
})().catch(error=>{console.error(error);process.exitCode=1});
