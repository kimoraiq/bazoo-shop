const assert=require("node:assert/strict"),fs=require("node:fs");
const app=fs.readFileSync("app.js","utf8");
const admin=fs.readFileSync("admin-panel.js","utf8");
const css=fs.readFileSync("admin-panel.css","utf8");

assert.match(app,/p\.is_demo\?[\s\S]*?معاينة التفاصيل/,"demo product cards should open detail preview instead of buying");
assert.match(app,/if\(p\?\.is_demo\)return notify\(/,"demo products must not enter the basket");
assert.match(app,/\.filter\(x=>x\.p&&!x\.p\.is_demo&&x\.qty>0\)/,"stale saved demo items must be ignored");
assert.match(app,/توجد منتجات تجريبية في السلة؛ لا يمكن تأكيد شرائها/,"checkout must reject preview items");
assert.match(app,/نموذج للعرض فقط/,"detail page must label preview-only products");
assert.match(admin,/function demoManagerPanel\(/,"the administration dashboard must provide a dedicated demo manager");
assert.match(admin,/data-action="delete-demo-products"/,"demo manager must expose one-click cleanup with confirmation");
assert.match(admin,/customConfirm\("سيتم حذف جميع المنتجات التجريبية/,"bulk demo deletion must always require a confirmation");
assert.match(admin,/\.delete\(\)\.eq\("is_demo",true\)\.select\("id,is_demo"\)/,"bulk delete must be constrained to is_demo=true");
assert.match(admin,/\.select\("id"\)\.eq\("is_demo",true\)/,"bulk deletion must verify its scope and result");
assert.match(css,/\.demo-manager-panel\{/,"demo cleanup must be visible and styled");
console.log("PASS preview-only products and confirm-first demo-only cleanup");
