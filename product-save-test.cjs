const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("admin.js","utf8").replace("export function createAdmin(","function createAdmin(");
class FakeFormData{
 constructor(form){this.values=form.data}
 get(name){return this.values[name]??null}
 has(name){return Object.hasOwn(this.values,name)}
}
const createAdmin=new Function("FormData",source+"\nreturn createAdmin;")(FakeFormData);
const state={
 admin:true,adminRole:"owner",adminPermissions:{},adminTab:"products",editProduct:null,
 user:{email:"owner@example.invalid"},products:[{id:"p-1",name:"منتج تجريبي",category_id:4,price_iqd:100000,compare_at_iqd:null,stock:10,image_url:"https://example.invalid/cover.webp"}],
 productImages:[],categories:[{id:4,name:"أجهزة منزلية",parent_id:1}],brands:[],rates:[],promos:[]
};
const writes=[],messages=[];
const q=(table,op,payload)=>({
 eq(){return this},
 select(){return this},
 single:async()=>{
  if(table!=="products")throw Error("Unexpected table "+table);
  let record;
  if(op==="insert"){
   record={...payload,id:"p-2"};
   state.products.push(record);
  }else{
   record=state.products.find(p=>p.id===currentId);
   if(!record)throw Error("Unknown product id "+currentId);
   Object.assign(record,payload);
  }
  writes.push({table,op,payload});
  return {data:{...record},error:null};
 },
 then(resolve,reject){
  const val={data:[],error:null};
  return Promise.resolve(val).then(resolve,reject);
 }
});
let currentId="p-1";
const sb={
 from(table){return {
  select(){return {
   eq(column,value){this.key=column;this.id=value;return this},
   async single(){
    if(table!=="products")return {data:null,error:{message:"Unexpected table"}};
    return {data:{...state.products.find(p=>String(p.id)===String(this.id))},error:null};
   }
  }},
  update(payload){return q(table,"update",payload)},
  insert(payload){return q(table,"insert",payload)}
 }}
};
let reloads=0,rendered=0;
const api=createAdmin({
 sb,state,esc:x=>String(x??""),money:x=>String(x),safeImg:x=>x,
 loadCatalog:async()=>{reloads++},notify:x=>messages.push(String(x)),
 render:async()=>{rendered++},openModal:()=>{},closeModal:()=>{},go:()=>{},
 icon:(name)=>'<svg data-icon="'+name+'"></svg>',confirmAction:()=>{}
});
function form(data,files=[]){
 const alert={hidden:true,className:"",textContent:"",scrollIntoView(){}};
 const button={disabled:false,textContent:"",innerHTML:""};
 const quick={disabled:false};
 const id={value:data.id||""};
 const elements={
  id,original_price_iqd:{value:data.original_price_iqd||""},
  discount_percent:{value:data.discount_percent??""},
  promoted_offer:{value:data.promoted_offer??"false"},
  coverPhoto:{files},photos:{files:[]}
 };
 const form={
  data,elements,
  querySelector(selector){
   if(selector==="button[type=\"submit\"]")return button;
   if(selector==="#productSaveStatus")return alert;
   if(selector==="#saveDiscountOnly")return quick;
   return null;
  }
 };
 return {...form,button,alert};
}
(async()=>{
 // Existing product: changing discount must not require re-uploading the existing image.
 const edit=form({id:"p-1",name:"منتج تجريبي",category_id:"4",stock:"10",original_price_iqd:"100000",discount_percent:"20",active:"true"});
 await api.saveProduct(edit);
 assert.equal(state.products.find(p=>p.id==="p-1").price_iqd,80000);
 assert.equal(state.products.find(p=>p.id==="p-1").compare_at_iqd,100000);
 assert.equal(state.products.find(p=>p.id==="p-1").image_url,"https://example.invalid/cover.webp");
 assert.equal(edit.alert.hidden,true,"Valid edit should not display an error");
 // Independent discount edit must only touch pricing fields.
 const discount=form({id:"p-1",original_price_iqd:"100000",discount_percent:"35",promoted_offer:"false"});
 await api.saveDiscountOnly(discount);
 assert.equal(state.products.find(p=>p.id==="p-1").price_iqd,65000);
 assert.equal(state.products.find(p=>p.id==="p-1").compare_at_iqd,100000);
 assert.equal(discount.alert.hidden,false);
 assert.match(discount.alert.textContent,/تم حفظ السعر/);
 // New product should save as a normal record even when no image was chosen.
 const create=form({id:"",name:"منتج جديد",category_id:"4",stock:"5",original_price_iqd:"75000",discount_percent:"10",active:"true"});
 await api.saveProduct(create);
 assert.equal(state.products.find(p=>p.id==="p-2").price_iqd,67500);
 assert.equal(state.products.find(p=>p.id==="p-2").image_url,null);
 assert.ok(reloads>=2);
 assert.ok(rendered>=2);
 // If uploading a selected file fails AFTER the product write, show a partial-success warning.
 currentId="p-1";
 const badPhoto=form({id:"p-1",name:"منتج تجريبي",category_id:"4",stock:"10",original_price_iqd:"100000",discount_percent:"15",active:"true"},[{type:"image/gif",size:100000}]);
 await api.saveProduct(badPhoto);
 assert.equal(state.products.find(p=>p.id==="p-1").price_iqd,85000,"Image failure must not roll back discount edit");
 assert.match(badPhoto.alert.textContent,/حُفظ المنتج والسعر والخصم/);
 assert.equal(badPhoto.button.disabled,false,"Save button must be re-enabled after failure");
 // An invalid standalone percent must not write.
 const n=writes.length;
 await api.saveDiscountOnly(form({id:"p-1",original_price_iqd:"100000",discount_percent:"120"}));
 assert.equal(writes.length,n);
 console.log("PASS: product create, price updates, independent discount save, and image failure isolation");
})().catch(e=>{console.error(e);process.exitCode=1});