const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("client.js","utf8").replace("export function createClient(","function createClient(");
const storage=new Map([["bazoo-auth-session",JSON.stringify({
 access_token:"old-token",refresh_token:"old-refresh",expires_at:Math.floor(Date.now()/1000)-30
})]]);
const localStorage={
 getItem:key=>storage.get(key)||null,
 setItem:(key,val)=>storage.set(key,val),
 removeItem:key=>storage.delete(key)
};
let refreshes=0,reads=0;
const fetch=async(url,opts)=>{
 if(url.includes("grant_type=refresh_token")){
  refreshes++;
  await new Promise(resolve=>setTimeout(resolve,15));
  return {ok:true,status:200,text:async()=>JSON.stringify({
   access_token:"new-token",refresh_token:"new-refresh",expires_in:3600
  })};
 }
 if(url.includes("/rest/v1/")){
  reads++;
  assert.equal(opts.headers.get("Authorization"),"Bearer new-token");
  return {ok:true,status:200,text:async()=>"[]"};
 }
 throw Error("Unexpected URL "+url);
};
const make=new Function("localStorage","fetch","Headers","AbortController","setTimeout","clearTimeout",source+"\nreturn createClient;")(
 localStorage,fetch,Headers,AbortController,setTimeout,clearTimeout
);
const db=make("https://bazoo.test","sb_publishable_test");
const events=[];
db.auth.onAuthStateChange(event=>events.push(event));
(async()=>{
 const results=await Promise.all(Array.from({length:8},()=>db.from("products").select("*")));
 assert.equal(results.length,8);
 assert.equal(reads,8);
 assert.equal(refreshes,1,"All concurrent requests must share one refresh");
 assert.deepEqual(events,["TOKEN_REFRESHED"],"Refresh must never masquerade as a new login or logout");
 assert.equal(JSON.parse(storage.get("bazoo-auth-session")).refresh_token,"new-refresh");
 console.log("PASS: one token refresh for 8 concurrent data requests; editor session preserved");
})().catch(err=>{console.error(err);process.exitCode=1});
