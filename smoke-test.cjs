// Zero-dependency browser boot smoke test.
// Prevents regression to the infinite "loading" screen on GitHub Pages.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("bundle.js","utf8");
const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector,{
    innerHTML: selector==="#app" ? "جاري تحميل متجر بازو..." : "",
    textContent:"",value:"",hidden:false,dataset:{},style:{},
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},querySelectorAll(){return []},
    setAttribute(){},getAttribute(){return null},
    focus(){},setSelectionRange(){},
  });
  return nodes.get(selector);
}
const hash = { hash:"#/home", origin:"https://kimoraiq.github.io", pathname:"/bazoo-shop/" };
const memory = new Map();
const document = {
  querySelector:node,
  querySelectorAll(){return []},
  addEventListener(){},
  hidden:false, visibilityState:"visible",
  body:{style:{}}
};
const context={
  document,location:hash,
  window:{addEventListener(){},matchMedia(){return {matches:true}}},
  console,Intl,Number,JSON,URL,URLSearchParams,Headers,AbortController,
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
  crypto:{randomUUID:()=> "a1a1a1a1-1234-4123-a123-123456789aaa"},
  fetch:async()=>({ok:true,status:200,text:async()=>"[]"}),
  navigator:{clipboard:{writeText:async()=>{}}},
};
vm.runInNewContext(source,context,{timeout:8000});
const home=node("#app").innerHTML;
assert(!home.includes("جاري تحميل متجر بازو"),"home never rendered");
assert(home.includes("merch-slider"),"hero slider missing");
assert(home.includes("home-categories"),"round category row missing");
assert(home.includes("brand-gallery"),"brand gallery missing");
context.location.hash="#/account";
Promise.resolve(context.render()).then(()=>{
  const account=node("#app").innerHTML;
  assert(account.includes("auth-shell"),"account form missing");
  assert(account.includes("data-password-toggle"),"password toggle missing");
  console.log("BAZOO boot and account smoke tests passed");
}).catch(e=>{console.error(e);process.exitCode=1});
