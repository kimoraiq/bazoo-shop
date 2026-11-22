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
assert.match(css,/BAZOO MOBILE HEADER v17/,"balanced phone header style missing");
assert.match(css,/grid-template-columns:112px minmax\(0,1fr\) 112px!important/,"balanced three-zone phone header must have matching side widths");
assert.match(css,/grid-template-areas:"brand delivery actions" "search search search"/,"mobile header should place search on its own row");
assert.match(css,/\.header \.brand\{[\s\S]*?width:112px!important/,"mobile logo should fit the phone header");
assert.match(css,/\.header #cartBtn\{[\s\S]*?background:#5822af!important/,"cart should use BAZOO purple");
assert.match(css,/\.header \.search button\{[\s\S]*?background:#5822af!important/,"mobile search button should use BAZOO purple");
assert.match(css,/BAZOO mobile bottom dock/,"branded bottom navigation is missing");
assert.match(css,/\.bottomnav\{[\s\S]*?background:linear-gradient\(115deg,#51209e/,"bottom dock should be purple");
assert.match(css,/\.bottomnav button.active::before\{[\s\S]*?background:#ff9b53/,"active page should have orange indicator");
assert.match(html,/class="delivery-desktop">إلى جميع أنحاء العراق/,"desktop delivery caption must read naturally");
assert.match(html,/class="delivery-mobile">داخل العراق/,"mobile delivery copy missing");
assert.match(css,/Explicit delivery visibility across breakpoints/,"delivery responsive caption guard missing");
assert.match(css,/\.header \.delivery-note \.delivery-desktop\{display:block!important\}/,"desktop delivery visible");
assert.match(css,/\.header \.delivery-note \.delivery-mobile\{display:none!important\}/,"mobile delivery hidden on desktop");
assert.match(css,/@media\(max-width:600px\)\{\s*\.header \.delivery-note \.delivery-desktop\{display:none!important\}\s*\.header \.delivery-note \.delivery-mobile\{display:block!important\}/,"desktop delivery hidden on mobile");
assert.match(css,/BAZOO purple category navigation/,"purple nav styling missing");
assert.match(css,/\.category-topbar\{\s*background:#5822af!important/,"category nav should use BAZOO purple");
assert.match(css,/\.category-nav-link \.svg-icon\{color:#fff!important/,"category icons should be white");
const nodes=new Map(), handlers=new Map(), data=new Map();
const scrollCalls=[];
function node(key){
 if(!nodes.has(key))nodes.set(key,{
  innerHTML:key==="#app"?"جاري تحميل متجر بازو...":"",
  textContent:"",value:"",hidden:false,dataset:{},style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},dispatchEvent(){},getAttribute(){return null},
  scrollIntoView(options){scrollCalls.push({key,options})},
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
 assert.match(html,/إلى جميع أنحاء العراق/,"correct nationwide delivery text missing");
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
 assert.match(html,/bundle\.js\?v=20\d{6}[a-z0-9-]+/,"asset cache bust missing");

 assert.match(source,/function productDetailsPage\(/,"product details page missing");
 assert.match(source,/function changeGallery\(/,"multi-photo gallery interactions missing");
 assert.match(source,/function imagesForProduct\(/,"product photos are not linked");
 assert.match(source,/product_images/,"Supabase product image table not queried");
 assert.match(source,/function openProvincePicker\(/,"branded province picker missing");
 assert.match(source,/artworkOnly/,"finished banner artwork display missing");
 assert.match(source,/function cropBanner\(/,"admin image preparation missing");
 assert.match(source,/name="photos"/,"multiple admin photos upload missing");
 assert.match(source,/function canAccess\(scope\)/,"permission-aware admin navigation missing");
 assert.match(source,/function membersPage\(/,"staff management page missing");
 assert.match(source,/admin_grant_member/,"owner-only staff grant RPC missing");
 assert.match(source,/admin_revoke_member/,"owner-only staff removal RPC missing");
 assert.match(source,/function saveMember\(/,"staff form save handler missing");
 assert.match(css,/BAZOO staff control center/,"staff permissions design missing");
 assert.match(source,/function confirmAction\(/,"branded confirmation dialog missing");
 assert.match(source,/function removeRecord\(/,"admin product and promo deletion missing");
 assert.match(source,/demo-price-note/,"demo price labels missing");
 assert.doesNotMatch(source,/\b(window\.)?(alert|prompt|confirm)\s*\(/,"no native browser popup APIs allowed");
 assert.equal(typeof node("#accountBtn").onclick,"function","header login action not bound");
 node("#accountBtn").onclick();
 await context.render();
 assert.equal(location.hash,"#/account","account button did not navigate");
 assert.match(node("#app").innerHTML,/authForm/,"login form not displayed");
 assert.ok(scrollCalls.some(v=>v.key==="#app"&&v.options.behavior==="auto"),"route navigation should scroll to main content and respect reduced-motion preference");
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
 assert.match(node("#app").innerHTML,/سلة التسوق فارغة/,"cart page missing");
 await click({target:{closest(){return {dataset:{go:"offers"}}}}});
 await context.render();
 assert.equal(location.hash,"#/offers");
 assert.match(node("#app").innerHTML,/عروض بازو/,"offers page missing");
 const formSubmit=handlers.get("submit");
 assert.equal(typeof formSubmit,"function","search navigation form handler missing");
 node("#searchBox").value="هاتف";
 await formSubmit({target:{id:"searchForm"},preventDefault(){}});
 await context.render();
 assert.equal(location.hash,"#/categories","search should navigate to the catalog");
 assert.equal(scrollCalls.at(-1).key,"#categoryResults","search should scroll directly to catalog results");
 await click({target:{closest(){return {dataset:{cat:"123"}}}}});
 await context.render();
 assert.equal(scrollCalls.at(-1).key,"#catalogFilters","category navigation should scroll to filter controls");
 assert.match(node("#app").innerHTML,/id="catalogFilters"/,"catalog anchor missing");
 assert.match(node("#app").innerHTML,/id="categoryResults"/,"search results anchor missing");

 console.log("PASS BAZOO: homepage, auth, categories, cart, offers and nationwide delivery headline");
})().catch(e=>{console.error(e);process.exitCode=1});
