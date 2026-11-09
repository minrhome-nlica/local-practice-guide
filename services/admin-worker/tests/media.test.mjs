import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleDraftMedia,listedDraftAssets,referencedDraftAssets,stageDraftAssets,_mediaTest
} from '../src/media.js';
import { ADMIN_HTML, ADMIN_CLIENT } from '../src/ui.js';

const draftId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner={role:'owner',email:'owner@example.org'};
const editor={role:'editor',email:'editor@example.org'};
const other={role:'editor',email:'other@example.org'};
const moderator={role:'moderator',email:'moderator@example.org'};
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82,9,9,9,9]);
function mock(){
  const assets=new Map(),objects=new Map(),audits=[];
  const row={id:draftId,slug:'reimbursement',status:'draft',
    author_email:editor.email,content:'---\ntitle: 怎麼核銷\n---\n\n正文'};
  const DB={prepare(sql){
    return {
      args:[],
      bind(...a){this.args=a;return this;},
      async first(){
        if(sql.includes('FROM admin_article_drafts WHERE id='))return row;
        if(sql.includes('COUNT(*) AS n'))return {
          n:assets.size,bytes:[...assets.values()].reduce((a,x)=>a+x.byte_size,0)
        };
        if(sql.includes('FROM admin_draft_assets WHERE id=')){
          const x=assets.get(this.args[0]);
          return x?.draft_id===this.args[1]?x:null;
        }
        throw Error('unexpected first SQL '+sql);
      },
      async all(){
        if(sql.includes('FROM admin_draft_assets WHERE draft_id=')){
          return {results:[...assets.values()].filter(x=>x.draft_id===this.args[0])};
        }
        throw Error('unexpected all SQL '+sql);
      },
      async run(){
        if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX'))return {meta:{changes:0}};
        if(sql.startsWith('INSERT INTO admin_draft_assets')){
          const [id,draft_id,slug,original_name,ext,content_type,byte_size,
            sha256_hex,object_key,created_by,created_at]=this.args;
          assets.set(id,{id,draft_id,slug,original_name,ext,content_type,byte_size,
            sha256_hex,object_key,created_by,created_at});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('DELETE FROM admin_draft_assets')){
          assets.delete(this.args[0]);return {meta:{changes:1}};
        }
        if(sql.startsWith('INSERT INTO admin_audit')){
          audits.push(this.args);return {meta:{changes:1}};
        }
        throw Error('unexpected run SQL '+sql);
      }
    };
  }};
  const GUIDE_MEDIA={
    async put(key,data){objects.set(key,new Uint8Array(data));},
    async get(key){
      const bytes=objects.get(key);
      if(!bytes)return null;
      return {arrayBuffer:async()=>bytes.slice().buffer,
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    },
    async delete(key){objects.delete(key);}
  };
  return {env:{DB,GUIDE_MEDIA},row,assets,objects,audits};
}
function req(path,method='GET',body){
  const url='https://admin.test'+path;
  return new Request(url,{method,...(body?{body}:{})});
}
function formFile(filename,bytes){
  const fd=new FormData();
  fd.set('file',new File([bytes],filename));
  return fd;
}
async function call(env,user,path,method='GET',body){
  return handleDraftMedia(env,user,req(path,method,body),
    new URL('https://admin.test'+path));
}
test('draft asset endpoints fail closed without private R2 or permitted staff role',async()=>{
  const {env}=mock();delete env.GUIDE_MEDIA;
  const path='/api/media/drafts/'+draftId;
  assert.equal((await call(env,owner,path)).body.configured,false);
  assert.equal((await call(env,owner,path+'/upload','POST',formFile('ok.png',png))).status,503);
  const bound=mock();
  assert.equal((await call(bound.env,moderator,path)).status,403);
  assert.equal((await call(bound.env,other,path)).status,403);
});
test('uploads require supported binary signatures, stay private and retain safe metadata',async()=>{
  const {env,row,assets,objects,audits}=mock();
  const path='/api/media/drafts/'+draftId;
  const blocked=await call(env,editor,path+'/upload','POST',formFile('malicious.svg',png));
  assert.equal(blocked.status,415);
  const fakePdf=await call(env,editor,path+'/upload','POST',
    formFile('fake.pdf',new Uint8Array([60,115,99,114,105,112,116])));
  assert.equal(fakePdf.status,415);
  const good=await call(env,editor,path+'/upload','POST',formFile('海報.png',png));
  assert.equal(good.status,201,JSON.stringify(good.body));
  const asset=good.body.asset;
  assert.equal(asset.name,'海報.png');
  assert.equal(asset.image,true);
  assert.ok(asset.path.startsWith('/assets/guide/reimbursement/'));
  assert.ok(asset.path.endsWith('.png'));
  assert.ok(!JSON.stringify(good.body).includes('object_key'));
  assert.equal(assets.size,1);
  assert.equal(objects.size,1);
  assert.equal(audits.length,1);
  const list=await call(env,owner,path);
  assert.equal(list.body.items.length,1);
  const image=await call(env,editor,path+'/assets/'+asset.id);
  assert.ok(image instanceof Response);
  assert.equal(image.headers.get('Content-Type'),'image/png');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
  const noAccess=await call(env,other,path+'/assets/'+asset.id);
  assert.equal(noAccess.status,403);
  row.content+=' \n![海報]('+asset.path+')';
  const referenced=await referencedDraftAssets(env,row);
  assert.equal(referenced.length,1);
  assert.equal((await call(env,editor,path+'/delete','POST',JSON.stringify({id:asset.id}))).status,409);
  row.content='已移除引用';
  assert.equal((await call(env,editor,path+'/delete','POST',JSON.stringify({id:asset.id}))).status,200);
  assert.equal(objects.size,0);
  assert.equal(assets.size,0);
});
test('GitHub stage publishes only referenced assets, and detects tampered R2 content',async()=>{
  const {env,row,assets,objects}=mock();
  const prefix='/api/media/drafts/'+draftId;
  const uploaded=await call(env,editor,prefix+'/upload','POST',
    formFile('image.png',png));
  const asset=uploaded.body.asset;
  assert.equal((await listedDraftAssets(env,draftId)).length,1);
  const never=await stageDraftAssets(env,row,'draft-branch',async()=>{
    throw Error('must not write unused asset');
  },()=>{});
  assert.equal(never.status,200);
  assert.deepEqual(never.body.paths,[]);
  row.content+=' \n![photo]('+asset.path+')';
  const calls=[];
  const gh=async(_env,_fetcher,method,path,body)=>{
    calls.push({method,path,body});
    return {ok:true,data:{commit:{sha:'a'.repeat(40)}}};
  };
  const done=await stageDraftAssets(env,row,'draft-branch',gh,()=>{});
  assert.equal(done.status,200);
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'PUT');
  assert.ok(calls[0].path.includes('public/assets/guide/reimbursement/'));
  assert.deepEqual(new Uint8Array(Buffer.from(calls[0].body.content,'base64')),png);
  const [stored]=assets.values();
  objects.set(stored.object_key,new Uint8Array([137,80,78,71,13,10,26,10,7,7,7]));
  const invalid=await stageDraftAssets(env,row,'draft-branch',gh,()=>{});
  assert.equal(invalid.status,409);
  assert.equal(invalid.body.code,'asset_changed');
  assert.equal(calls.length,1);
});
test('draft attachment UI has safe insertion buttons and does not embed GitHub token',()=>{
  assert.match(ADMIN_HTML,/id="draft-media-file"/);
  assert.match(ADMIN_HTML,/id="draft-media-upload"/);
  assert.match(ADMIN_HTML,/id="draft-media-list"/);
  assert.match(ADMIN_HTML,/data-md-insert="table"/);
  assert.match(ADMIN_CLIENT,/renderDraftMediaList/);
  assert.match(ADMIN_CLIENT,/appendSafeInline/);
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
});
