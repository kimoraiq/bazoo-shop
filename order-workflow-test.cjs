const assert=require("node:assert/strict");
const fs=require("node:fs");
const adminSource=fs.readFileSync("admin.js","utf8").replace("export function createAdmin(","function createAdmin(");
const appSource=fs.readFileSync("app.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const html=fs.readFileSync("index.html","utf8");
const createAdmin=new Function(adminSource+"\nreturn createAdmin;")();
const order={
 id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",created_at:"2026-11-22T12:00:00Z",
 customer_name:"عميل تجريبي",phone:"07700000000",governorate:"بغداد",
 address:"عنوان تجريبي لأغراض الاختبار",note:"يرجى توخي الحذر",
 payment_method:"cod",subtotal_iqd:80000,shipping_iqd:5000,total_iqd:85000,
 status:"new",
 order_items:[{id:12,product_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 product_name:"حاسوب محمول تجريبي",quantity:1,unit_price_iqd:80000,line_total_iqd:80000,status:"new"}]
};
const state={admin:true,adminRole:"owner",adminTab:"orders",adminPermissions:{},
 user:{email:"owner@example.invalid"},products:[{id:order.order_items[0].product_id,name:"حاسوب محمول تجريبي",image_url:"https://example.invalid/test.webp"}],
 productImages:[],categories:[],brands:[],promos:[],rates:[],editProduct:null,orderFilter:"all"};
const updates=[],notices=[];let renders=0;
const sb={from(table){
 return {
  select(){return {order(){return {limit(){return Promise.resolve({data:[order],error:null})}}}}},
  update(payload){
   return {eq(column,value){
    if(column==="id"||column==="order_id")return this;
    return this;
   },select(){return this},async single(){
    updates.push({table,payload});
    if(table==="orders"){
     order.status=payload.status;
     order.order_items.forEach(i=>i.status=payload.status);
     return {data:{id:order.id,status:payload.status},error:null};
    }
    if(table==="order_items"){
     order.order_items[0].status=payload.status;
     return {data:{id:12,status:payload.status},error:null};
    }
    return {data:null,error:{message:"Unexpected table"}};
   }};
  }
 };
}};
const controls={
 order:{dataset:{orderStatus:order.id,savedStatus:"new"},value:"packing",disabled:false},
 item:{dataset:{orderId:order.id,orderItemStatus:"12",savedStatus:"new"},value:"shipped",disabled:false}
};
global.document={
 querySelectorAll(sel){
  if(sel==="[data-order-status]")return [controls.order];
  if(sel==="[data-order-item-status]")return [controls.item];
  return [];
 },
 querySelector(sel){return null},
 getElementById(){return null}
};
global.window={matchMedia:()=>({matches:true})};
const api=createAdmin({
 sb,state,esc:x=>String(x??"").replaceAll('"',"&quot;"),
 money:x=>Number(x).toLocaleString("en-US")+" د.ع",safeImg:x=>x,
 icon:name=>"<svg data-icon='"+name+"'></svg>",
 loadCatalog:async()=>{},notify:m=>notices.push(m),render:async()=>{renders++},
 openModal:()=>{},closeModal:()=>{},go:()=>{},confirmAction:()=>{}
});
(async()=>{
 const page=await api.adminPage();
 assert.match(page,/مركز متابعة الطلبات/);
 assert.match(page,/data-order-status="/);
 assert.match(page,/data-order-item-status="12"/);
 assert.match(page,/href="#\/product\/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"/,"Product link must use actual purchased product ID");
 assert.match(page,/data-copy-order-product=/,"Order line should allow link copying");
 assert.match(page,/قيد التجهيز/,"Packing status must be offered");
 assert.match(page,/07700000000/);
 api.bindAdmin();
 assert.equal(typeof controls.order.onchange,"function");
 await controls.order.onchange();
 assert.equal(order.status,"packing");
 assert.equal(order.order_items[0].status,"packing","Bulk status should synchronize every item");
 assert.equal(controls.order.dataset.savedStatus,"packing");
 controls.item.dataset.savedStatus="packing";
 await controls.item.onchange();
 assert.equal(order.order_items[0].status,"shipped");
 assert.equal(order.status,"packing","Individual product status should not overwrite full order");
 assert.deepEqual(updates.map(x=>x.table),["orders","order_items"]);
 assert.equal(renders,2);
 assert.match(appSource,/order_items\(id,product_id,product_name,quantity,unit_price_iqd,line_total_iqd,status\)/,"Customer needs live product statuses");
 assert.match(appSource,/tracking-steps/,"Customer tracking timeline missing");
 assert.match(appSource,/data-copy-order-product/,"Customer copy link handler missing");
 assert.match(css,/\.orders-console-hero\{/,"Premium admin order layout missing");
 assert.match(css,/\.customer-order-card\{/,"Premium customer order layout missing");
 assert.match(html,/bundle\.js\?v=20\d{6}[a-z0-9-]+/,"Must publish updated order assets");
 console.log("PASS BAZOO: order status, item status, direct product links and customer tracking");
})().catch(err=>{console.error(err);process.exitCode=1});
