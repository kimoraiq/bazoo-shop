const fs=require("node:fs");
const assert=require("node:assert/strict");
const text=fs.readFileSync("admin.js","utf8").replace("export function createAdmin(","function createAdmin(");
const createAdmin=new Function(text+"\nreturn createAdmin;")();
const state={
 user:{email:"owner@test.invalid"},admin:true,adminRole:"owner",adminPermissions:{},
 adminTab:"members",products:[],productImages:[],promos:[],categories:[],brands:[],rates:[],staffMembers:[],
 editProduct:null
};
const members=[
 {user_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",role:"owner",email:"owner@test.invalid",permissions:{},created_at:"2026-01-01"},
 {user_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",role:"limited",email:"staff@test.invalid",permissions:{orders:true,products:false},created_at:"2026-01-02"}
];
const sb={from(table){return {
 select(){return {
  order(){return {
   then(ok,fail){return Promise.resolve({data:table==="admin_members"?members:[],error:null}).then(ok,fail)},
   limit(){return Promise.resolve({data:[],error:null})}
  }}
 }}
}}};
const app=createAdmin({
 sb,state,esc:value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
 money:n=>String(n),safeImg:url=>url,loadCatalog:async()=>{},notify:()=>{},render:async()=>{},
 openModal:()=>{},closeModal:()=>{},go:()=>{},icon:name=>"<svg data-icon='"+name+"'></svg>",confirmAction:()=>{}
});
(async()=>{
 let page=await app.adminPage();
 assert.match(page,/المسؤولون والصلاحيات/,"owner needs staff tab");
 assert.match(page,/data-staff-edit/,"owner should be able to edit other administrators");
 assert.match(page,/data-staff-remove/,"owner should be able to remove other administrators");
 assert.match(page,/الحساب محمي/,"owner account must be protected");

 state.adminRole="full";state.adminTab="products";
 page=await app.adminPage();
 assert.match(page,/المنتجات/,"full admin should see products");
 assert.match(page,/الطلبات/,"full admin should see orders");
 assert.doesNotMatch(page,/data-admin-tab="members"/,"full admin must not manage staff");

 state.adminRole="limited";state.adminPermissions={orders:true};state.adminTab="products";
 page=await app.adminPage();
 assert.equal(state.adminTab,"orders","limited admin must be redirected to permitted scope");
 assert.match(page,/data-admin-tab="orders"/,"limited admin must retain orders access");
 assert.doesNotMatch(page,/data-admin-tab="products"/,"limited admin must not see products");
 assert.doesNotMatch(page,/data-admin-tab="members"/,"limited admin must not manage staff");
 console.log("PASS BAZOO: owner, full and limited administrator views");
})().catch(e=>{console.error(e);process.exitCode=1});
