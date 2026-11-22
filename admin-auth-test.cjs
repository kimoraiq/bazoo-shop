const fs=require("node:fs");
const assert=require("node:assert/strict");
const client=fs.readFileSync("client.js","utf8").replace("export function createClient(","function createClient(");
const app=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const ownerId="8f89417c-8a77-4c19-bfb1-5b1dd5e43296";
const requests=[];
const local={getItem(name){
 if(name==="bazoo-auth-session")return JSON.stringify({
  access_token:"test-owner-token",refresh_token:"test-refresh-token",
  expires_at:Math.floor(Date.now()/1000)+2000
 });
 return null;
},setItem(){},removeItem(){}};
const apiFetch=async (url,options)=>{
 requests.push({url,authorization:new Headers(options.headers).get("Authorization")});
 if(url.endsWith("/auth/v1/user"))return {ok:true,status:200,text:async()=>JSON.stringify({id:ownerId,email:"noone07710@gmail.com"})};
 if(url.endsWith("/rest/v1/rpc/my_admin_access"))return {ok:true,status:200,text:async()=>JSON.stringify({user_id:ownerId,role:"owner",authenticated:true,permissions:{},can_manage_products:true})};
 throw Error("Unexpected endpoint: "+url);
};
const createClient=new Function("localStorage","fetch","Headers","AbortController","setTimeout","clearTimeout",client+"\nreturn createClient;")(
 local,apiFetch,Headers,AbortController,setTimeout,clearTimeout
);
(async()=>{
 const sb=createClient("https://example.invalid","sb_publishable_test");
 const user=await sb.auth.getUser();
 assert.equal(user.error,null);
 assert.equal(user.data.user.id,ownerId);
 const rpc=await sb.rpc("my_admin_access");
 assert.equal(rpc.error,null);
 assert.equal(rpc.data.role,"owner");
 assert.equal(rpc.data.user_id,user.data.user.id);
 assert.equal(rpc.data.can_manage_products,true);
 assert.equal(requests.length,2);
 assert.ok(requests.every(x=>x.authorization==="Bearer test-owner-token"),"The verified user's token must be attached to every authorization request");
 assert.match(app,/sb\.rpc\("my_admin_access"\)/,"Admin permission check must consult database-side verified JWT role");
 assert.match(app,/String\(data\.user_id\)===String\(userId\)/,"Reject access responses for a mismatched session");
 assert.match(app,/authLoaded:false/,"Loading state must prevent premature denial while auth is pending");
 assert.match(app,/الحساب المسجّل حالياً/,"Show signed-in account for permission troubleshooting");
 assert.match(app,/retryAdminAccess/,"Retry authorization should remain available");
 assert.match(html,/safesave27/,"Front-end must use fresh CSS and JS cache versions");
 console.log("PASS: owner JWT forwarded to server for direct role verification and inline diagnostics");
})().catch(e=>{console.error(e);process.exitCode=1});