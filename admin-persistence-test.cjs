const assert=require("node:assert/strict");
const fs=require("node:fs");
const adminSource=fs.readFileSync("admin.js","utf8").replace("export function createAdmin(","function createAdmin(");
const createAdmin=new Function(adminSource+"\nreturn createAdmin;")();
const state={admin:true,adminRole:"owner",adminTab:"products",adminPermissions:{},
 user:{email:"owner@example.invalid"},products:[{id:"product-1",name:"منتج",active:true,price_iqd:100000,stock:2}],
 productImages:[],categories:[],brands:[],promos:[],rates:[],editProduct:null};
const notices=[];
let refreshes=0;
function emptyWrite(){
 return {
  eq(){return this},
  select(){return this},
  single(){return Promise.resolve({data:null,error:null})}
 };
}
const sb={from(){return {
  update(){return emptyWrite()},
  delete(){return emptyWrite()}
}}};
const api=createAdmin({
 sb,state,esc:x=>String(x??""),money:x=>String(x),safeImg:x=>x,
 loadCatalog:async()=>{refreshes++},notify:message=>notices.push(message),
 render:async()=>{},openModal:()=>{},closeModal:()=>{},go:()=>{},
 icon:name=>name,confirmAction:(_title,_body,callback)=>callback()
});
(async()=>{
 await api.toggleRecord("products","product-1");
 assert.equal(state.products[0].active,true,"No affected row should never change the UI state");
 assert.equal(refreshes,0,"Failed row updates must not refresh or report saved");
 assert.match(notices.at(-1),/تعذّر تغيير حالة النشر/);
 assert.doesNotMatch(notices.at(-1),/تم نشر|تم إخفاء/);
 const ok=await api.removeRecord("products","product-1","المنتج");
 assert.equal(refreshes,0,"Failed deletions must never trigger a success refresh");
 assert.match(notices.at(-1),/تعذّر الحذف/);
 assert.match(adminSource,/f\.onsubmit=event=>/,"Product editor must bind submit directly");
 assert.match(adminSource,/event\.stopPropagation\(\)/,"Product submit must not be shadowed by document listeners");
 assert.match(adminSource,/sb\.from\("promotions"\)\.update\(v\)\.eq\("id",id\)\.select\("id"\)\.single\(\)/,"Promotion updates must return a verified row");
 assert.match(adminSource,/sb\.from\("shipping_rates"\)\.update\(\{price_iqd:price,enabled\}\)\.eq\("governorate",g\)\.select/,"Shipping updates must return a verified row");
 console.log("PASS: no silent success on denied writes; admin product form has its own submit handler");
})().catch(error=>{console.error(error);process.exitCode=1});
