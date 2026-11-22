const assert=require("node:assert/strict");
const fs=require("node:fs");
const admin=fs.readFileSync("admin.js","utf8").replace("export function createAdmin(","function createAdmin(");
const app=fs.readFileSync("app.js","utf8");
const createAdmin=new Function(admin+"\nreturn createAdmin;")();

const state={
 user:{email:"owner@example.invalid"},admin:true,adminRole:"owner",adminPermissions:{},
 adminTab:"products",editProduct:null,
 products:[{id:"prod-example-1",name:"منتج اختبار",price_iqd:100000,stock:2,active:true}],
 productImages:[],categories:[],brands:[],rates:[],promos:[]
};
let redraws=0;
const controls={
 tab:{dataset:{adminTab:"orders"}},
 edit:{dataset:{editProduct:"prod-example-1"}},
 newProduct:{dataset:{}}
};
global.document={
 querySelectorAll(selector){
  if(selector==="[data-admin-tab]")return [controls.tab];
  if(selector==="[data-edit-product]")return [controls.edit];
  return [];
 },
 querySelector(selector){
  if(selector==="#newProduct")return controls.newProduct;
  return null;
 }
};
const appAdmin=createAdmin({
 state,sb:{},esc:x=>String(x),money:x=>String(x),safeImg:x=>x,
 icon:name=>name,loadCatalog:async()=>{},notify:()=>{},render:()=>{redraws++},
 openModal:()=>{},closeModal:()=>{},go:()=>{},confirmAction:()=>{}
});
appAdmin.bindAdmin();
const ev={stopPropagation(){this.stopped=true},stopped:false};
assert.equal(typeof controls.tab.onclick,"function","Admin tabs must bind a direct click handler");
assert.equal(typeof controls.edit.onclick,"function","Product edit buttons must bind a direct click handler");
assert.equal(typeof controls.newProduct.onclick,"function","New product button must bind a direct click handler");
controls.tab.onclick(ev);
assert.equal(state.adminTab,"orders");
assert.equal(state.editProduct,null);
controls.edit.onclick(ev);
assert.equal(state.adminTab,"products");
assert.equal(state.editProduct,"prod-example-1");
controls.newProduct.onclick(ev);
assert.equal(state.editProduct,"new");
assert.equal(redraws,3);
assert.equal(ev.stopped,true,"Direct admin click handlers should prevent double routing");
assert.match(app,/b\.dataset\.go==="admin"\)\{await refreshAuth\(\)/,"Entering administration should revalidate the active user");
assert.match(app,/id="retryAdminAccess"/,"Admin access retry action missing");
assert.match(app,/b\.id==="retryAdminAccess"/,"Admin access retry must be actionable");
console.log("PASS: admin tabs and product editing respond to clicks, session access revalidated");
