const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const app=fs.readFileSync("app.js","utf8");
const bundle=fs.readFileSync("bundle.js","utf8");
const css=fs.readFileSync("style.css","utf8");
function part(start,end){
 const i=app.indexOf(start),j=app.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,"Source section not found: "+start);
 return app.slice(i,j);
}
const state={
 categories:[
  {id:1,name:"أجهزة كهربائية",parent_id:null,active:true,sort_order:1},
  {id:2,name:"إلكترونيات",parent_id:null,active:true,sort_order:2},
  {id:3,name:"قرطاسية",parent_id:null,active:true,sort_order:3},
  {id:8,name:"الموبايلات",parent_id:2,active:true,sort_order:1},
  {id:13,name:"لابتوبات",parent_id:2,active:true,sort_order:2},
  {id:30,name:"كفرات هواتف",parent_id:8,active:true,sort_order:3},
  {id:17,name:"ثلاجات",parent_id:1,active:true,sort_order:1},
  {id:18,name:"غسالات",parent_id:1,active:true,sort_order:2},
  {id:9,name:"مواد مكتبية",parent_id:3,active:true,sort_order:1}
 ],
 products:[
  {id:"phone",category_id:8,brand_id:null,active:true,name:"Phone",description:""},
  {id:"laptop",category_id:13,brand_id:null,active:true,name:"Laptop",description:""},
  {id:"case",category_id:30,brand_id:null,active:true,name:"Case",description:""},
  {id:"fridge",category_id:17,brand_id:null,active:true,name:"Fridge",description:""}
 ],
 brands:[],section:"",category:"",brand:"",q:""
};
const js=[part("function categoryChain(","function filterProducts("),part("function filterProducts(","function sectionHead("),part("function filters(){","function categories(){")].join("\n");
const ctx={state,console};
vm.runInNewContext("const esc=x=>String(x);const brandName=()=>'';"+js+"\nthis.subject={filters,filterProducts};",ctx);
const {filters,filterProducts}=ctx.subject;
const sectionOptions=filters().match(/<select id="categoryFilter"[^>]*>([\s\S]*?)<\/select>/)?.[1]||"";
assert.match(sectionOptions,/أجهزة كهربائية/);
assert.match(sectionOptions,/إلكترونيات/);
assert.doesNotMatch(sectionOptions,/الموبايلات|لابتوبات|ثلاجات/,"the main section selector must list roots only");
assert.match(filters(),/id="subcategoryFilter"[^>]*disabled/,"subcategory requires selecting a parent section");
state.section="2";
const electronics=filters();
const childOptions=electronics.match(/<select id="subcategoryFilter"[^>]*>([\s\S]*?)<\/select>/)?.[1]||"";
assert.match(childOptions,/الموبايلات/);
assert.match(childOptions,/لابتوبات/);
assert.match(childOptions,/كفرات هواتف/,"multi-level descendants must stay discoverable");
assert.doesNotMatch(childOptions,/ثلاجات|غسالات/,"foreign-category names must never appear");
assert.deepEqual(Array.from(filterProducts(),x=>x.id).sort(),["case","laptop","phone"]);
state.category="8";
assert.match(filters(),/<option value="8" selected>/);
assert.deepEqual(Array.from(filterProducts(),x=>x.id).sort(),["case","phone"]);
state.section="1";state.category="";
assert.deepEqual(Array.from(filterProducts(),x=>x.id),["fridge"]);
state.section="";state.category="";
assert.equal(filterProducts().length,4,"all categories should work without choosing a department");
assert.match(app,/state\.section=root\?String\(root\.id\)/,"direct links must restore the root section");
assert.match(app,/state\.category=selected\.parent_id\?String\(selected\.id\)/,"direct links must restore child selection");
assert.match(app,/if\(e\.target\.id==="subcategoryFilter"\)/,"subcategory changes must trigger routing");
assert.match(bundle,/id="subcategoryFilter"/,"compiled storefront must include subcategory selector");
assert.match(css,/\.category-results-page \.filter-panel\.bazoo-catalog-filters/,"brand-aligned filter styling missing");
console.log("PASS BAZOO catalog: root department, dependent child categories, nested products, and permalink filter restoration");
