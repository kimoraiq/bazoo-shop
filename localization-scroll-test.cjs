const fs=require("node:fs");
const assert=require("node:assert/strict");
const app=fs.readFileSync("app.js","utf8");
const admin=fs.readFileSync("admin.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const client=fs.readFileSync("client.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const sources={app,admin,html,client};

for(const [name,source] of Object.entries(sources)){
 const colloquial=/ماكو|تگدر|يگدر|گدرنا|ميگابايت|اختار|نشتغل|بيك|بالطريق|(?<![\u0621-\u064A])راح(?![\u0621-\u064A])/;
 assert.doesNotMatch(source,colloquial,"Iraqi dialect detected in "+name);
}
assert.doesNotMatch(app,/تسوّق بكل سوفة/,"Erroneous translation of راحة");
assert.match(app,/تسوّق بكل راحة/,"Formal Arabic greeting should remain grammatical");
assert.match(html,/من بازو إلى باب منزلك/,"Formal Arabic delivery headline missing");
assert.doesNotMatch(html,/href="#\/admin"/,"Admin access must not appear publicly in footer");
assert.match(app,/let pendingScroll=null/,"Navigation scroll state is missing");
assert.match(app,/function scrollToContent\(/,"Page auto scroll is missing");
assert.match(app,/scrollIntoView\(\{behavior:reduced\?"auto":"smooth"/,"Scroll should respect reduced-motion preferences");
assert.match(app,/window\.addEventListener\("hashchange",\(\)=>/,"Browser back/forward navigation must also scroll");
assert.match(app,/go\("categories","#categoryResults"\)/,"Catalog search should scroll to its matching results");
assert.match(app,/go\("categories","#catalogFilters"\)/,"Category navigation should scroll to the filter area");
assert.match(app,/pendingScroll="#adminTabContent"/,"Admin tab switching should scroll to selected content");
assert.match(admin,/id="adminTabContent"/,"Admin scroll destination missing");
assert.match(css,/scroll-margin-top:120px/,"Sticky header offset missing");
assert.match(css,/prefers-reduced-motion:reduce/,"Reduced-motion support missing");
assert.match(html,/bundle\.js\?v=20\d{6}[a-z0-9-]+/,"The updated JS and CSS should bust browser caches");
console.log("PASS BAZOO: full formal-Arabic copy and accessible smooth navigation scroll");
