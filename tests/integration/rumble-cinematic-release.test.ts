import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRumble,rumbleDevMiddleware } from '../../build/rumble-release.mjs';

for(const method of ['GET','HEAD'])test('dev cinematic response has video MIME: '+method,async()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const headers=new Map<string,string>();
  let body:Buffer|undefined;
  const response={statusCode:0,setHeader:(name:string,value:string)=>headers.set(name,value),end:(bytes:Buffer|undefined)=>{body=bytes;}};
  await rumbleDevMiddleware(root)({method,url:'/play/rumble/video/loft-rumble-intro-d07190fd.mp4'},response,()=>assert.fail('Approved film must be served'));
  assert.equal(response.statusCode,200);
  assert.equal(headers.get('Content-Type'),'video/mp4');
  if(method==='HEAD')assert.equal(body,undefined);
  else assert.equal(createHash('sha256').update(body!).digest('hex'),'d07190fd9a8aa74f4e3e9da2e04249450f9f535fedf76b99f0376c6980c73036');
});

for(const cinematic of [true,false])test('background pause menu respects cinematic blocking: '+cinematic,async()=>{
  const html:string=(await import('node:module')).createRequire(import.meta.url)('../../prototypes/loft-rumble/tests/realtime-page.cjs').realtimePage();
  const source=html.match(/function showMenu\(open\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source);
  const menu={hidden:true,open:false,showModal(){this.open=true;}};
  let paused=false;
  const context={s:{demo:true,cinematic},menu,setPaused:(on:boolean)=>{paused=on;},
    menuToggle:{setAttribute(){}},document:{getElementById:()=>({focus(){}})}};
  runInNewContext(source+'\nshowMenu(true);',context);
  assert.equal(menu.open,!cinematic);
  assert.equal(menu.hidden,cinematic);
  assert.equal(paused,!cinematic);
});

test('public route ships the complete approved film and cinematic entry dependencies',async()=>{
  const output=await mkdtemp(join(tmpdir(),'rumble-cinematic-'));
  const root=fileURLToPath(new URL('../../',import.meta.url));
  try{
    await publishRumble(root,output);
    const route=join(output,'play/rumble');
    const film=await readFile(join(route,'video/loft-rumble-intro-d07190fd.mp4'));
    assert.deepEqual(film,await readFile(join(root,'prototypes/loft-rumble/video/loft-rumble-intro-d07190fd.mp4')));
    assert.equal(createHash('sha256').update(film).digest('hex'),
      'd07190fd9a8aa74f4e3e9da2e04249450f9f535fedf76b99f0376c6980c73036');
    const data=await readFile(join(route,'rumble-cinematic-data.js'),'utf8');
    assert.equal(runInNewContext(data+'\nLoftRumbleCinematicData.source;'),'video/loft-rumble-intro-d07190fd.mp4');
    const html=await readFile(join(route,'index.html'),'utf8');
    for(const name of ['rumble-cinematic.js','rumble-cinematic-data.js','rumble-cinematic.css']){
      assert.ok(html.includes(name));assert.ok((await readFile(join(route,name))).length>0);
    }
  }finally{await rm(output,{recursive:true,force:true});}
});
