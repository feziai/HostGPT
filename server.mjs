import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,extname} from 'node:path';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {e,configured} from './lib/env.mjs';
import {status,chat,localModels} from './lib/ai.mjs';
import {repositories,directory,importPR} from './lib/github.mjs';
import {parseZip} from './lib/zip.mjs';
import {handleMcp} from './lib/mcp.mjs';

if(!configured('ADMIN_PASSWORD') || e('ADMIN_PASSWORD').length<14) {
 console.error('Set a NEW strong ADMIN_PASSWORD (at least 14 chars) in a local .env before starting.');process.exit(1);
}
const host=e('HOST','127.0.0.1');
if(host!=='127.0.0.1'&&host!=='localhost'&&host!=='::1'&&e('COOKIE_SECURE')!=='1') {
 console.error('For publicly reachable instances, require HTTPS reverse proxy and COOKIE_SECURE=1.');process.exit(1);
}
const port=Number(e('PORT','3000'));
const publicDir=resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const sessions=new Map();
const attempts=new Map();
const imports=new Map();
const now=()=>Date.now();
const sha=str=>createHash('sha256').update(String(str)).digest();
const eq=(a,b)=>timingSafeEqual(sha(a),sha(b));
function json(res,code,data){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function fail(res,code,message){json(res,code,{error:message});}
function cookie(req,name){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return value?.slice(name.length+1)||'';}
function session(req){const id=cookie(req,'fezi_session'),s=sessions.get(id);if(!s)return null;if(s.expires<now()){sessions.delete(id);return null;}return s;}
function setSessionCookie(res,id,age){const attrs=['fezi_session='+id,'Path=/','HttpOnly','SameSite=Strict','Max-Age='+age];if(e('COOKIE_SECURE')==='1')attrs.push('Secure');res.setHeader('Set-Cookie',attrs.join('; '));}
function originAllowed(req){
 const origin=req.headers.origin;
 if(!origin)return true;
 const directHost=req.headers.host;
 if(!directHost)return false;
 return origin==='http://'+directHost || origin==='https://'+directHost;
}
async function body(req,max=40000){
 let size=0;const parts=[];
 for await(const part of req){size+=part.length;if(size>max)throw Object.assign(new Error('حجم درخواست بیش از حد مجاز است.'),{status:413});parts.push(part);}
 return Buffer.concat(parts);
}
async function bodyJSON(req,max){try{return JSON.parse((await body(req,max)).toString('utf8'));}catch(e){if(e.status)throw e;throw Object.assign(new Error('JSON نامعتبر است.'),{status:400});}}
function guard(req,res){if(!session(req)){fail(res,401,'ابتدا وارد شوید.');return false;}return true;}
function limits(req){const ip=req.socket.remoteAddress||'unknown',key=ip+':'+(req.url||'').split('?')[0],curr=attempts.get(key)||{count:0,reset:now()+60000};if(curr.reset<now()){curr.count=0;curr.reset=now()+60000;}curr.count++;attempts.set(key,curr);return curr.count<=(req.url==='/api/chat'?15:60);}
function cleanup(){for(const [k,v] of sessions)if(v.expires<now())sessions.delete(k);for(const [k,v] of attempts)if(v.reset<now())attempts.delete(k);for(const [k,v] of imports)if(v.expires<now())imports.delete(k);}
async function serveStatic(req,res,url){
 const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(!/^[\w./-]+$/.test(rel)||rel.split('/').includes('..'))return fail(res,404,'Not found');
 const full=resolve(join(publicDir,rel));
 if(!full.startsWith(publicDir+'/'))return fail(res,404,'Not found');
 let file;
 try{const s=await stat(full);if(!s.isFile()||s.size>5*1024*1024)throw new Error();file=await readFile(full);}catch{return fail(res,404,'Not found');}
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'}[extname(full)]||'application/octet-stream';
 res.writeHead(200,{'content-type':mime,'cache-control':mime.startsWith('text/html')?'no-store':'public, max-age=300'});res.end(file);
}
async function handle(req,res){
 // Security headers; external scripts and inline dynamic code are intentionally disabled.
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(!limits(req))return fail(res,429,'درخواست‌های زیاد؛ کمی بعد تلاش کنید.');
 if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&!originAllowed(req))return fail(res,403,'مبدأ درخواست مجاز نیست.');
 const url=new URL(req.url||'/', 'http://localhost');
 try{
  if(req.method==='GET' && url.pathname==='/api/health')return json(res,200,{ok:true,project:'HostGPT AI',version:'0.1.0'});
  if(req.method==='GET' && url.pathname==='/api/auth/me')return json(res,200,{authenticated:Boolean(session(req))});
  if(req.method==='POST' && url.pathname==='/api/auth/login'){
   const data=await bodyJSON(req,800);
   const key=req.socket.remoteAddress||'local';const a=attempts.get('login:'+key)||{count:0,reset:now()+15*60000};
   if(a.reset<now()){a.count=0;a.reset=now()+15*60000;}
   if(a.count>=6)return fail(res,429,'تلاش‌های ورود زیاد است؛ بعداً تلاش کنید.');
   if(!eq(data.password||'',e('ADMIN_PASSWORD'))){a.count++;attempts.set('login:'+key,a);return fail(res,401,'رمز عبور نامعتبر است.');}
   attempts.delete('login:'+key);
   const id=randomBytes(32).toString('hex');sessions.set(id,{expires:now()+8*3600000});setSessionCookie(res,id,8*3600);
   return json(res,200,{ok:true});
  }
  if(req.method==='POST' && url.pathname==='/api/auth/logout'){
   sessions.delete(cookie(req,'fezi_session'));setSessionCookie(res,'',0);return json(res,200,{ok:true});
  }
  if(url.pathname==='/mcp' && req.method==='POST'){
   if(!configured('MCP_ACCESS_TOKEN'))return fail(res,503,'MCP برای این نسخه فعال نشده است.');
   if(!eq((req.headers.authorization||'').replace(/^Bearer\s+/i,''),e('MCP_ACCESS_TOKEN')))return fail(res,401,'MCP unauthorized');
   const msg=await bodyJSON(req,15000),response=handleMcp(msg);
   if(response===null){res.writeHead(202);return res.end();}
   return json(res,200,response);
  }
  if(url.pathname.startsWith('/api/') && !guard(req,res))return;
  if(req.method==='GET' && url.pathname==='/api/status')return json(res,200,{providers:status(),github:configured('GITHUB_TOKEN'),mongodb:configured('MONGODB_URI'),mcp:configured('MCP_ACCESS_TOKEN'),version:'0.1.0'});
  if(req.method==='GET' && url.pathname==='/api/tools/catalog')return json(res,200,{tools:JSON.parse(await readFile(resolve(fileURLToPath(new URL('./data/tools.json',import.meta.url))),'utf8'))});
  if(req.method==='GET' && url.pathname==='/api/ollama/models')return json(res,200,{models:await localModels()});
  if(req.method==='POST' && url.pathname==='/api/chat'){
   const query=await bodyJSON(req,30000);
   return json(res,200,await chat(query));
  }
  if(req.method==='GET' && url.pathname==='/api/github/repos')return json(res,200,{repos:await repositories()});
  if(req.method==='GET' && url.pathname==='/api/github/tree')return json(res,200,{items:await directory({owner:url.searchParams.get('owner'),repo:url.searchParams.get('repo'),path:url.searchParams.get('path')||''})});
  if(req.method==='POST' && url.pathname==='/api/zip/inspect'){
   const contentType=req.headers['content-type']||'';
   if(!contentType.startsWith('application/zip')&&!contentType.startsWith('application/octet-stream'))return fail(res,415,'فرمت درخواست باید ZIP باشد.');
   const raw=await body(req,9*1024*1024),parsed=parseZip(raw);
   const id=randomBytes(20).toString('hex');imports.set(id,{...parsed,expires:now()+20*60000});
   return json(res,200,{importId:id,files:parsed.files.map(({path,size})=>({path,size})),skipped:parsed.skipped,totalBytes:parsed.totalBytes,expiresMinutes:20});
  }
  if(req.method==='POST' && url.pathname==='/api/github/import-pr'){
   const params=await bodyJSON(req,2000);
   if(params.confirm!=='CREATE_BRANCH_AND_PR')return fail(res,400,'تأیید عملیات الزامی است.');
   const imp=imports.get(params.importId);
   if(!imp||imp.expires<now())return fail(res,404,'فایل ZIP منقضی شده؛ دوباره بارگذاری کنید.');
   // Consume ID before remote operation to prevent double-submit and duplicate PRs.
   imports.delete(params.importId);
   return json(res,200,await importPR({owner:params.owner,repo:params.repo,baseBranch:params.baseBranch,files:imp.files}));
  }
  if(req.method==='GET' && url.pathname==='/api/mongo/status'){
   if(!configured('MONGODB_URI'))return json(res,200,{configured:false,connected:false});
   try{const {MongoClient}=await import('mongodb');const client=new MongoClient(e('MONGODB_URI'),{serverSelectionTimeoutMS:3500});await client.connect();await client.db('admin').command({ping:1});await client.close();return json(res,200,{configured:true,connected:true});}
   catch{return json(res,200,{configured:true,connected:false,message:'اتصال ناموفق؛ مجوز، دسترسی شبکه یا نصب پکیج mongodb را بررسی کنید.'});}
  }
  if(url.pathname.startsWith('/api/')||url.pathname==='/mcp')return fail(res,404,'API not found');
  if(req.method==='GET')return await serveStatic(req,res,url);
  return fail(res,405,'Method not allowed');
 }catch(err){
  const code=err.status|| (err.name==='TimeoutError'?504:400);
  // Do not return upstream HTTP response bodies, request bodies or secrets.
  const safe=String(err.message||'خطای ناشناخته').slice(0,250);
  return fail(res,code, safe);
 }
}
const server=http.createServer(handle);
server.listen(port,host,()=>console.log(`HostGPT AI starter at http://${host}:${port} — local / protected`));
setInterval(cleanup,5*60000).unref();
