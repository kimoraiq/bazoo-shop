const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync("bundle.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("style.css","utf8");
assert.match(css,/BAZOO unified identity header/,"unified header style missing");
assert.match(css,/\.header\{\s*background:#fff!important/,"main header must be white edge to edge");
assert.match(css,/\.header \.brand\{[\s\S]*?background:transparent!important/,"logo must not have its own chip");
assert.match(css,/\.header \.brand img\{[\s\S]*?object-fit:contain!important/,"horizontal brand must retain natural proportions");
assert.match(css,/\.header \.search\{[\s\S]*?background:#f8f5fc!important/,"search must harmonize with the new header");
assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.header \.brand\{[\s\S]*?order:1/,"mobile brand should be in the first row");
assert.doesNotMatch(css,/BAZOO identity ribbon/,"detached ribbon styling must be removed");
assert.match(css,/BAZOO purple category navigation/,"purple nav styling missing");
assert.match(css,/\.category-topbar\{\s*background:#5822af!important/,"category nav should use BAZOO purple");
assert.match(css,/\.category-nav-link \.svg-icon\{color:#fff!important/,"category icons should be white");
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
 assert.match(html,/%D8%A8%D8%A7%D8%B2%D9%88%20%D8%A7%D9%81%D9%82%D9%8A.png/,"horizontal BAZOO logo not selected");
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
 assert.match(source,/compact-categories/,"compact SVG categories missing");
 assert.match(html,/purplenav15/,"asset cache bust missing");

 assert.match(source,/function productDetailsPage\(/,"product details page missing");
 assert.match(source,/function changeGallery\(/,"multi-photo gallery interactions missing");
 assert.match(source,/function imagesForProduct\(/,"product photos are not linked");
 assert.match(source,/product_images/,"Supabase product image table not queried");
 assert.match(source,/function openProvincePicker\(/,"branded province picker missing");
 assert.match(source,/artworkOnly/,"finished banner artwork display missing");
 assert.match(source,/function cropBanner\(/,"admin image preparation missing");
 assert.match(source,/name="photos"/,"multiple admin photos upload missing");
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
