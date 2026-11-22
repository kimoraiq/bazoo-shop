const fs=require("node:fs");
const assert=require("node:assert/strict");
const admin=fs.readFileSync("admin.js","utf8");
const app=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("style.css","utf8");
assert.match(admin,/name="coverPhoto"/,"Product cover file picker missing");
assert.doesNotMatch(admin,/name="image_url"/,"Product cover still editable as a URL");
assert.match(admin,/await uploadProductImage\(mainFile\)/,"Main cover image is not uploaded through optimizer");
assert.match(admin,/await uploadProductImage\(photos\[i\]\)/,"Gallery photos are not uploaded through optimizer");
assert.match(admin,/await prepareBannerPhoto\(file,type\)/,"Banners must use the same optimized pipeline");
assert.match(admin,/blob\.size>MAX_BANNER_BYTES/,"Banner output must be limited to 1 MiB");
assert.match(admin,/optimized\.size>MAX_IMAGE_BYTES/,"Product output size must be verified");
assert.match(admin,/const MAX_BANNER_BYTES=1024\*1024/,"Banner cap must be 1 MiB");
assert.match(admin,/compressSiteImage\(composited,dims\[0\],dims\[1\],MAX_BANNER_BYTES\)/,"Banners must use independent 1 MiB optimization");
assert.match(admin,/sb\.storage\.from\("promo-images"\)\.upload/,"Banner uploads must use separate promo-images bucket");
assert.match(admin,/sb\.storage\.from\("product-images"\)\.upload/,"Product uploads must retain 15 KiB product-images bucket");

assert.match(admin,/class="media-size-ok"/,"Compressed image preview missing");
assert.match(app,/Always prefer the explicitly selected cover/,"Main cover must appear first across gallery and cards");
assert.match(css,/\.main-photo-picker\{/,"Branded image picker styling missing");
assert.match(html,/productfix24/,"Image upload release cache version missing");

const from=admin.indexOf("const MAX_IMAGE_BYTES=15*1024;");
const to=admin.indexOf("function editor(p={})",from);
assert.ok(from>-1&&to>from,"Image optimization implementation missing");
const code=admin.slice(from,to);
let maxCanvasWidth=0;
const fakeURL={createObjectURL:()=>"blob:mock",revokeObjectURL:()=>{}};
class MockImage{
 set src(v){this.naturalWidth=2400;this.naturalHeight=1600;Promise.resolve().then(()=>this.onload())}
}
const fakeDocument={
 createElement(type){
  assert.equal(type,"canvas");
  return {
   width:0,height:0,
   getContext(){return {
    clearRect(){},drawImage(){},fillRect(){},fillStyle:null,
    get globalCompositeOperation(){return "source-over"},set globalCompositeOperation(v){}
   }},
   toBlob(callback,type,quality){
    maxCanvasWidth=Math.max(maxCanvasWidth,this.width);
    const bytes=Math.ceil(this.width*this.height*(quality||.3)*.41)+180;
    callback({type:type==="image/webp"?"image/webp":"image/jpeg",size:bytes});
   }
  };
 }
};
const uploaded=[];
const fakeSB={storage:{from(bucket){
 assert.equal(bucket,"product-images");
 return {
  upload:async(path,file,options)=>{
   uploaded.push({path,size:file.size,type:options.contentType});
   assert.ok(file.size<=15*1024,"Storage upload larger than 15 KiB");
   return {error:null};
  },
  getPublicUrl:path=>({data:{publicUrl:"https://example.invalid/"+path}})
 };
}}};
const fakeCrypto={randomUUID:()=>"deadc0de-aaaa-4bbb-bccc-000000000001"};
const helpers=new Function("URL","Image","document","sb","crypto","esc",code+"\nreturn {compressSiteImage,optimizedImage,uploadProductImage,MAX_IMAGE_BYTES};")(fakeURL,MockImage,fakeDocument,fakeSB,fakeCrypto,x=>x);
(async()=>{
 const largeFile={type:"image/jpeg",size:2*1024*1024};
 const compressed=await helpers.compressSiteImage(largeFile);
 assert.ok(compressed.size<=15360,"Compression did not achieve 15 KiB limit");
 assert.equal(compressed.type,"image/webp");
 assert.ok(maxCanvasWidth<=1400,"Image size not bounded before compression");
 const biggerBudget=await helpers.compressSiteImage(largeFile,1440,480,1024*1024);
 assert.ok(biggerBudget.size<=1024*1024,"Banner conversion exceeds 1 MiB");
 assert.ok(biggerBudget.size>15360,"Banner conversion should not overcompress at the old 15 KiB limit");
 const alreadySmallBanner={type:"image/jpeg",size:270000};
 assert.equal(await helpers.compressSiteImage(alreadySmallBanner,1440,480,1024*1024),alreadySmallBanner,"A banner smaller than 1 MiB should retain original quality");

 const small={type:"image/png",size:9000};
 assert.equal(await helpers.compressSiteImage(small),small,"Small images should not be recompressed");
 await assert.rejects(()=>helpers.compressSiteImage({type:"image/gif",size:100000}),/JPG/);
 await assert.rejects(()=>helpers.compressSiteImage({type:"image/jpeg",size:26*1024*1024}),/25/);
 const url=await helpers.uploadProductImage(largeFile);
 assert.match(url,/products\/deadc0de/);
 assert.equal(uploaded.length,1);
 assert.ok(uploaded[0].size<=15360);
 console.log("PASS BAZOO: products capped at 15 KiB, promotional banners capped at 1 MiB");
})().catch(e=>{console.error(e);process.exitCode=1});
