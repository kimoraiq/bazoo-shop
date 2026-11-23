const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync("app.js","utf8");
const admin=fs.readFileSync("admin-panel.js","utf8");
const css=fs.readFileSync("admin-panel.css","utf8");
const index=fs.readFileSync("admin.html","utf8");
function orderFrom(src,token){
 const m=src.match(new RegExp("const "+token+"=\\[([\\s\\S]*?)\\];"));
 assert.ok(m,"Missing category order: "+token);
 return JSON.parse("["+m[1]+"]");
}
const storefrontOrder=orderFrom(app,"homeCategoryOrder");
const adminOrder=orderFrom(admin,"HOME_CATEGORY_ORDER");
assert.deepEqual(adminOrder,storefrontOrder,"Admin category ordering must match the storefront exactly");
const row=(id,slug,parent_id=null,active=true)=>({id,slug,name:slug,parent_id,active,show_on_home:true,sort_order:id,image_url:null});
const rows=[
 row(1,"appliances"),row(2,"electronics"),row(3,"stationery"),row(24,"perfumes"),
 row(4,"home-appliances",1),row(5,"installation",1),row(17,"refrigerators",1),row(18,"washing-machines",1),
 row(19,"air-conditioners",1),row(20,"cookers",1),row(21,"cooking-appliances",1),row(22,"vacuum-cleaners",1),row(23,"heaters",1),
 row(6,"devices-games",2,false),row(7,"accessories",2),row(8,"phones",2),
 row(11,"smart-watches",2),row(12,"headphones",2),row(13,"laptops",2),row(14,"tablets",2),row(15,"screens",2),
 row(9,"office-supplies",3),row(10,"school-supplies",3)
];
assert.equal(rows.length,23,"Representative database has 23 records");
function extract(src,start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"Could not isolate "+start);
 return src.slice(a,b);
}
const ancestors=extract(admin,"function categoryAncestors(","function categoryPath(");
const home=extract(admin,"function homepageCategoryRecords(","function homepageCategoryCard(");
const factory=new Function("HOME_CATEGORY_ORDER",ancestors+"\n"+home+"\nreturn homepageCategoryRecords;");
const getHomepage=factory(adminOrder);
const visible=getHomepage(rows);
assert.equal(visible.length,15,"Homepage and admin must agree on 15 displayed tiles with inactive games hidden");
assert.equal(visible.filter(x=>!x.isOffer).length,14,"15 tiles include the separate Offers tile, not a database category");
assert.equal(rows.length-visible.filter(x=>!x.isOffer).length,9,"There should be 9 extra database records in a separate panel");
assert.equal(visible[0].slug,"offers");
assert.equal(visible[1].slug,"phones");
assert.equal(visible.at(-1).slug,"perfumes");
assert.ok(!visible.some(x=>x.slug==="devices-games"),"Hidden category must stay hidden");
assert.match(admin,/category-extra-details/,"Other database records must be in a collapsible section");
assert.match(admin,/id="homeCategoryAdminGrid"/,"Primary photo grid must have its own stable container");
assert.match(admin,/id="categoryManagerGroups"/,"Other categories must remain editable");
assert.match(admin,/categoryUploadControl\(item\)/,"Each home photo must have an immediate upload button");
assert.match(admin,/data-tab="promos"/,"Offers tile must route to promotions management");
assert.match(admin,/function categoryHomepageTiles\(/,"Search/filter must update the homepage cards");
assert.match(css,/\.home-category-admin-grid\{/,"Responsive primary grid is missing");
assert.match(css,/\.home-category-admin-card h3\{/,"Card title styling is missing");
assert.match(css,/overflow-wrap:anywhere/,"Long category names must wrap rather than clip");
assert.match(css,/\.category-extra-details>summary/,"Collapsible category heading is missing");
assert.match(index,/admin-panel\.css\?v=20261123catadmin43/);
assert.match(index,/admin-panel\.js\?v=20261123catadmin43/);
console.log("PASS BAZOO admin consistent: 15 homepage cards + 9 extra records, exact matching order, photos, no clipped category titles");
