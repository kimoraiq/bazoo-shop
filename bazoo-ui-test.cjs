const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ui=fs.readFileSync("bazoo-ui.js","utf8");
const css=fs.readFileSync("bazoo-ui.css","utf8");
const shop=fs.readFileSync("index.html","utf8");
const admin=fs.readFileSync("admin.html","utf8");
const app=fs.readFileSync("app.js","utf8");
const dashboard=fs.readFileSync("admin-panel.js","utf8");
new Function(ui);
assert.match(shop,/bazoo-ui\.css\?v=20261123ui41/);
assert.match(shop,/bazoo-ui\.js\?v=20261123ui41/);
assert.match(admin,/bazoo-ui\.css\?v=20261123ui41/);
assert.match(admin,/bazoo-ui\.js\?v=20261123ui41/);
assert.match(ui,/select\.dispatchEvent\(new Event\("change",\s*\{\s*bubbles:\s*true/,"custom selection must trigger existing save handlers");
assert.match(ui,/select\.selectedIndex = index/,"custom selection must preserve native form values");
assert.match(ui,/MutationObserver/,"new selects in dynamic modals must be enhanced");
assert.match(ui,/role", "listbox"/,"dropdowns must have listbox semantics");
assert.match(ui,/role", "combobox"/,"trigger must be keyboard accessible");
assert.match(ui,/بحث في الخيارات/,"long lists need a search field");
assert.match(ui,/event\.key === "Escape"/,"popup must support Escape");
assert.match(css,/\.bz-select-popover/,"shared popup style missing");
assert.match(css,/\.bz-select-trigger/,"shared trigger style missing");
assert.match(css,/#modalBackdrop\.modal-backdrop/,"storefront modal styling missing");
assert.match(css,/#toast\.toast/,"branded toast styling missing");
assert.doesNotMatch(app+"\n"+dashboard,/(?:window\.)?(?:alert|confirm|prompt)\s*\(/,"native browser alerts are forbidden in site code");

class Node {
 constructor(tag){
  this.tagName=tag.toUpperCase();
  this.nodeType=1;this.children=[];this.childNodes=this.children;
  this.parentNode=null;this.attributes={};this.listeners={};
  this.className="";this.style={};this.dataset={};this.disabled=false;
  this.hidden=false;this.tabIndex=0;this.textContent="";
 }
 get classList(){
  const node=this;
  return {
   contains(n){return node.className.split(/\s+/).includes(n)},
   add(n){if(!this.contains(n))node.className=(node.className+" "+n).trim()},
   remove(n){node.className=node.className.split(/\s+/).filter(x=>x!==n).join(" ")},
   toggle(n,force){const present=this.contains(n);
    if(force===undefined)force=!present;
    if(force)this.add(n);else this.remove(n);
    return force;
   }
  };
 }
 append(...nodes){nodes.forEach(node=>this.appendChild(node))}
 appendChild(node){
  if(node.parentNode)node.remove();
  this.children.push(node);node.parentNode=this;return node;
 }
 insertBefore(node,before){
  if(node.parentNode)node.remove();
  const at=this.children.indexOf(before);
  if(at<0)throw Error("missing insert anchor");
  this.children.splice(at,0,node);node.parentNode=this;return node;
 }
 remove(){if(this.parentNode){const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);this.parentNode=null}}
 setAttribute(n,v){this.attributes[n]=String(v)}
 getAttribute(n){return this.attributes[n]??null}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
 dispatchEvent(ev){ev.target=this;for(const fn of this.listeners[ev.type]||[])fn(ev);return true}
 contains(other){return other===this||this.children.some(n=>n.contains?.(other))}
 closest(sel){if(sel==="label")return this.parentNode?.tagName==="LABEL"?this.parentNode:null;return null}
 getBoundingClientRect(){return{left:220,right:480,top:45,bottom:95,width:260,height:50}}
 get scrollHeight(){return 190}
 get isConnected(){return !!this.parentNode||this.tagName==="BODY"}
 focus(){document.activeElement=this}
}
const label=new Node("label");
label.childNodes=[{nodeType:3,textContent:"القسم الرئيسي"}];
const select=new Node("select");
select.options=[{textContent:"كل الأقسام",value:"",disabled:false},{textContent:"أجهزة كهربائية",value:"1",disabled:false},{textContent:"إلكترونيات",value:"2",disabled:false}];
select.selectedIndex=0;
Object.defineProperty(select,"value",{get(){return this.options[this.selectedIndex]?.value??""},set(v){const idx=this.options.findIndex(x=>x.value===v);this.selectedIndex=idx}});
select.matches=(selector)=>selector==="select";
label.appendChild(select);
const callbacks={};
const document={
 readyState:"loading",
 body:new Node("body"),
 documentElement:{clientWidth:1100},
 activeElement:null,
 createElement:(tag)=>new Node(tag),
 querySelectorAll:(selector)=>{
  if(selector==="select:not(.bz-native-select)")return select.classList.contains("bz-native-select")?[]:[select];
  if(selector==="select.bz-native-select")return select.classList.contains("bz-native-select")?[select]:[];
  return [];
 },
 addEventListener:(key,fn)=>(callbacks[key]??=[]).push(fn)
};
const window={innerHeight:800,requestAnimationFrame:fn=>fn(),addEventListener(){}};
const eventFactory=class{constructor(type,data={}){this.type=type;this.bubbles=data.bubbles}};
const mockObserver=class{observe(){}};
vm.runInNewContext(ui,{document,window,MutationObserver:mockObserver,Event:eventFactory,console});
for(const f of callbacks.DOMContentLoaded||[])f();
assert.ok(select.classList.contains("bz-native-select"),"native dropdown must be visually replaced");
assert.equal(label.children[0].className,"bz-select");
const trigger=label.children[0].children[1];
assert.equal(trigger.getAttribute("role"),"combobox");
assert.equal(trigger.type,"button");
assert.equal(trigger.children[0].textContent,"كل الأقسام");
trigger.dispatchEvent({type:"click"});
const panel=document.body.children.at(-1);
assert.equal(panel.getAttribute("role"),"listbox","brand popup should be rendered through the shared portal");
const list=panel.children.find(x=>x.className==="bz-select-list");
assert.equal(list.children.length,3);
let changed=0;select.addEventListener("change",()=>changed++);
list.children[1].dispatchEvent({type:"click"});
assert.equal(select.value,"1","clicking custom choice must update underlying form field");
assert.equal(changed,1,"the existing page must receive exactly one native change event");
assert.equal(trigger.children[0].textContent,"أجهزة كهربائية");
assert.equal(document.body.children.length,0,"popup closes after choosing an option");
select.disabled=true;
window.BAZOO_UI.refresh();
assert.equal(trigger.disabled,true,"disabled real controls also disable custom buttons");
assert.equal(select.getAttribute("aria-hidden"),"true","hidden select should not duplicate screenreader focus");
console.log("PASS BAZOO UI: no native dropdowns in store/admin, keyboard popup, dynamic enhancement and actual form value changes");
