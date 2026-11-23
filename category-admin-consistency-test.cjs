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
 row(6,"devices-games",2,true),row(7,"accessories",2),row(8,"phones",2),
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
assert.equal(visible.length,20,"Home and admin must show 19 child categories plus separate Offers tile");
assert.match(app,/function homeCategoryCollection\(/,"storefront must pull all categories from live catalog");
assert.match(app,/available\.filter\(c=>!pinned\.has\(c\.slug\)\)/,"storefront must show all categories beyond featured slots");
assert.match(app,/\[\.\.\.curated,\.\.\.remaining\]\.map\(\(item,i\)=>homeCategoryTile/,"all 24 tiles must use one unified grid");
assert.doesNotMatch(app,/bazoo-category-extra-heading|bazoo-category-relation/,"remove extra section header and any main/child captions");
assert.equal(visible.filter(x=>!x.isOffer).length,19,"All child categories should be represented in the homepage");
assert.equal(rows.length-visible.filter(x=>!x.isOffer).length,4,"Four root categories belong to main navigation, not the child gallery");
assert.equal(visible[0].slug,"offers");
assert.equal(visible[1].slug,"phones");
assert.ok(!visible.some(x=>!x.isOffer&&!x.parent_id),"Root categories must never appear in child-category galleries");
assert.equal(visible[14].slug,"vacuum-cleaners","original child-category sequence must remain intact");
assert.ok(visible.some(x=>x.slug==="devices-games"),"Games category must now appear with the rest");

// Regression: categories renamed in the admin must display that exact database name in both views.
assert.doesNotMatch(app,/homeCategoryDisplayNames/,"storefront must not override edited category names");
assert.doesNotMatch(admin,/HOME_CATEGORY_LABELS/,"admin cards must not hide the real database names");
assert.match(app,/const display=item.name;/,"storefront must read category title from live record");
assert.match(admin,/const title=item.name;/,"admin card must read title from live record");
const renamed=rows.find(x=>x.slug==="air-conditioners");
renamed.name="سبالت ومكيفات حديثة";
const updated=getHomepage(rows).find(x=>x.slug==="air-conditioners");
assert.equal(updated.name,"سبالت ومكيفات حديثة","name changes must flow into homepage catalog data");
const tileSource=extract(app,"function homeCategoryTile(","function categoryCircles(");
const tileFactory=new Function("safeImg","esc","categoryPhoto",tileSource+"\nreturn homeCategoryTile;");
const tile=tileFactory(x=>String(x),x=>String(x),()=>"<img>");
const rendered=tile(updated,0);
assert.match(rendered,/سبالت ومكيفات حديثة/,"storefront tile must show the renamed category");
assert.doesNotMatch(rendered,/>السبلت</,"old hard-coded name must not override updated DB name");
assert.match(app,/window.addEventListener\("storage"/,"storefront must listen for admin-save notifications");
assert.match(app,/window.addEventListener\("focus"/,"storefront must refresh on returning to browser tab");
assert.match(app,/visibilitychange/,"storefront must refresh when reopened");
assert.match(admin,/bazoo_catalog_revision/,"admin must notify other tabs after verified saves");

assert.match(admin,/category-extra-details/,"Parent and child relations must remain manageable in admin");
assert.match(admin,/id="homeCategoryAdminGrid"/,"Primary photo grid must have its own stable container");
assert.match(admin,/id="categoryManagerGroups"/,"All category parent relationships must remain editable");
assert.match(admin,/categoryUploadControl\(item\)/,"Each home photo must have an immediate upload button");
assert.match(admin,/offers-category-photo-input/,"Offers tile needs its own direct photo uploader");
assert.match(admin,/saveOffersCategoryImage/,"Offers upload requires independent verified save");
assert.match(app,/state\.offersCategoryCover\?\.\[0\]\?\.image_url/,"storefront must prefer the saved Offers cover");
assert.match(admin,/function categoryHomepageTiles\(/,"Search/filter must update the homepage cards");
assert.match(css,/\.home-category-admin-grid\{/,"Responsive primary grid is missing");
assert.match(css,/\.home-category-admin-card h3\{/,"Card title styling is missing");
assert.match(css,/overflow-wrap:anywhere/,"Long category names must wrap rather than clip");
assert.match(css,/\.category-extra-details>summary/,"Collapsible category heading is missing");
assert.match(index,/admin-panel\.css\?v=20261123offers46/);
assert.match(index,/admin-panel\.js\?v=20261123offers46/);
console.log("PASS BAZOO: all 19 child categories plus independently editable Offers cover; root sections remain outside gallery");
