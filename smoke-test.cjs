const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync("bundle.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("style.css","utf8");
const nodes=new Map(), handlers=new Map(), data=new Map();
function node(key){
 if(!nodes.has(key))nodes.set(key,{
  innerHTML:key==="#app"?"جاري تحميل متجر بازو...":"",
  textContent:"",value:"",hidden:false,dataset:{},style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},dispatchEvent(){},getAttribute(){return null},
  querySelector(){return node(".test-field")},
  querySelectorAll(){return []},
  setAttribute(){},focus(){},setSelectionRange(){}
 });
 return nodes.get(key);
}
const location={hash:"#/home",origin:"https://kimoraiq.github.io",pathname:"/bazoo-shop/"};
const document={
 querySelector:node,querySelectorAll(){return []},
 addEventListener(type,callback){handlers.set(type,callback)},
 hidden:false,body:{style:{}}
};
const context={
 document,location,window:{addEventListener(){},matchMedia(){return {matches:true}}},
 console,Intl,Number,JSON,URL,URLSearchParams,Headers,AbortController,
 Event:class{constructor(type){this.type=type}},
 setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},
 localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
 crypto:{randomUUID:()=> "a1a1a1a1-1234-4123-a123-123456789aaa"},
 fetch:async()=>({ok:true,status:200,text:async()=>"[]"}),
 navigator:{clipboard:{writeText:async()=>{}}}
};
(async()=>{
 vm.runInNewContext(source,context,{timeout:10000});
 assert.match(node("#app").innerHTML,/merch-slider/,"homepage not rendered");
 assert.match(node("#app").innerHTML,/home-categories/,"category circles missing");
 assert.match(node("#app").innerHTML,/brand-gallery/,"brand gallery missing");
 assert.match(html,/بكل أنحاء العراق/,"delivery wording missing");
 assert.match(css,/\.merch-slider\{height:414px/,"desktop banner must have a fixed height");
 assert.match(css,/\.merch-slider\{height:470px/,"mobile banner must have a fixed height");
 assert.match(css,/\.merch-slider\{[^}]*height:420px/,"new desktop banner height missing");
 assert.match(css,/\.merch-slider\{[^}]*height:438px/,"new mobile banner height missing");
 assert.match(source,/function productRail\(/,"one-row carousel component missing");
 assert.match(source,/data-rail-move/,"carousel controls missing");
 assert.match(source,/class="merch-picture"/,"photographic banner missing");
 assert.match(source,/async function cropBanner\(/,"desktop/mobile banner image cropping missing");
 assert.match(source,/photo_desktop/,"desktop admin file input missing");
 assert.match(source,/photo_mobile/,"mobile admin file input missing");
 assert.match(source,/product_id/,"linked banner product selection missing");
 assert.match(source,/category-thumb/,"real photo category thumbnails missing");
 assert.match(html,/bazoo8/,"asset cache bust missing");

 assert.match(source,/function confirmAction\(/,"branded confirmation dialog missing");
 assert.match(source,/function removeRecord\(/,"admin product and promo deletion missing");
 assert.match(source,/demo-price-note/,"demo price labels missing");
 assert.doesNotMatch(source,/\b(window\.)?(alert|prompt|confirm)\s*\(/,"no native browser popup APIs allowed");
 assert.equal(typeof node("#accountBtn").onclick,"function","header login action not bound");
 node("#accountBtn").onclick();
 await context.render();
 assert.equal(location.hash,"#/account","account button did not navigate");
 assert.match(node("#app").innerHTML,/authForm/,"login form not displayed");
 assert.match(node("#app").innerHTML,/data-password-toggle/,"password visibility missing");
 const click=handlers.get("click");
 assert.equal(typeof click,"function","navigation click handler missing");
 await click({target:{closest(){return {dataset:{go:"categories"}}}}});
 await context.render();
 assert.equal(location.hash,"#/categories");
 assert.match(node("#app").innerHTML,/categoryFilter/,"category page missing");
 node("#cartBtn").onclick();
 await context.render();
 assert.equal(location.hash,"#/cart");
 assert.match(node("#app").innerHTML,/عربتك فارغة/,"cart page missing");
 await click({target:{closest(){return {dataset:{go:"offers"}}}}});
 await context.render();
 assert.equal(location.hash,"#/offers");
 assert.match(node("#app").innerHTML,/عروض بازو/,"offers page missing");
 console.log("PASS BAZOO: homepage, auth, categories, cart, offers and nationwide delivery headline");
})().catch(e=>{console.error(e);process.exitCode=1});
