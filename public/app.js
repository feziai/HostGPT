const $=s=>document.querySelector(s);
const show=(message,bad=false)=>{const box=$('#flash');box.textContent=message;box.classList.remove('hidden');box.style.borderColor=bad?'#f2ad4a':'#18bde7';};
async function api(url,opts={}){
 const res=await fetch(url,{credentials:'same-origin',...opts});let data={};try{data=await res.json();}catch{}
 if(!res.ok)throw new Error(data.error||`خطای سرور ${res.status}`);
 return data;
}
let importId=null;let messages=[];let providers={};
function toggleTab(name){
 document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.id==='tab-'+name));
 document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));
 $('#flash').classList.add('hidden');
}
for(const el of document.querySelectorAll('[data-tab]'))el.addEventListener('click',()=>toggleTab(el.dataset.tab));
for(const el of document.querySelectorAll('[data-jump]'))el.addEventListener('click',()=>toggleTab(el.dataset.jump));
function bubble(role,text){const el=document.createElement('div');el.className='bubble '+role;el.textContent=text;$('#chatMessages').append(el);el.scrollIntoView({behavior:'smooth',block:'end'});return el;}
function fillModel(){const p=$('#provider').value;$('#model').value=providers[p]?.model||'';}
$('#provider').addEventListener('change',fillModel);
async function refresh(){
 const d=await api('/api/status');providers=d.providers;
 for(const [name,id] of [['ollama-local','st-local'],['ollama-cloud','st-cloud'],['gemini','st-gemini'],['grok','st-grok'],['huggingface','st-hf']]){
  const el=$('#'+id);el.classList.toggle('yes',!!providers[name]?.configured);el.classList.toggle('no',!providers[name]?.configured);
 }
 for(const [name,isEnabled] of [['st-github',d.github],['st-mcp',d.mcp]]){$('#'+name).classList.toggle('yes',!!isEnabled);$('#'+name).classList.toggle('no',!isEnabled);}
 fillModel();
 const card=$('#connectionsList');card.replaceChildren();
 const names={'ollama-local':'Ollama Local','ollama-cloud':'Ollama Cloud',gemini:'Gemini',grok:'Grok',huggingface:'Hugging Face',openrouter:'OpenRouter',openai:'OpenAI API'};
 for(const [p,details] of Object.entries(providers))addCard(card,names[p],details.configured?'تنظیم شده':'نیازمند تنظیم',details.model||'بدون مدل');
 addCard(card,'GitHub',d.github?'توکن روی سرور موجود است':'توکن تنظیم نشده','مجوز مخزن لازم است');
 addCard(card,'MongoDB',d.mongodb?'URI تنظیم شده':'تنظیم نشده','وضعیت اتصال با دکمه تست');
 addCard(card,'MCP Read-only',d.mcp?'فعال':'غیرفعال','نیازمند MCP_ACCESS_TOKEN');
}
function addCard(container,title,sub,detail,href){
 const e=document.createElement('div');e.className='card';
 const t=document.createElement('b');t.textContent=title; e.append(t);
 const s=document.createElement('small');s.textContent=sub+' · '+(detail||'');e.append(s);
 if(href&&href.startsWith('https://github.com/')){const a=document.createElement('div');a.style.marginTop='12px';const l=document.createElement('a');l.href=href;l.target='_blank';l.rel='noopener noreferrer';l.textContent='بازکردن در GitHub';a.append(l);e.append(a);}
 container.append(e);
}
$('#loginForm').addEventListener('submit',async ev=>{
 ev.preventDefault();$('#loginError').textContent='';
 try{await api('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('#adminPassword').value})});
 $('#adminPassword').value='';$('#login').classList.add('hidden');await refresh();}
 catch(err){$('#loginError').textContent=err.message;}
});
$('#logout').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});}catch{}location.reload();});
$('#chatForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const text=$('#prompt').value.trim();if(!text)return;
 const provider=$('#provider').value,model=$('#model').value.trim();
 $('#prompt').value='';messages.push({role:'user',content:text});bubble('user',text);
 const pending=bubble('assistant','در حال دریافت پاسخ واقعی از مدل...');const btn=$('#chatForm button');btn.disabled=true;
 try{const answer=await api('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider,model,messages:messages.slice(-20)})});pending.textContent=answer.text;messages.push({role:'assistant',content:answer.text});}
 catch(err){pending.textContent='اتصال برقرار نشد: '+err.message;messages.pop();}
 finally{btn.disabled=false;}
});
$('#listmodels').addEventListener('click',async()=>{try{const d=await api('/api/ollama/models');show('مدل‌های نصب‌شده Ollama: '+(d.models.join('، ')||'هیچ مدل نصب نشده است.'));}catch(err){show(err.message,true);}});
$('#getRepos').addEventListener('click',async()=>{try{const d=await api('/api/github/repos');const container=$('#repoList');container.replaceChildren();for(const r of d.repos)addCard(container,r.full_name,r.private?'خصوصی':'عمومی','شاخه پیش‌فرض: '+r.default_branch,r.html_url);if(!d.repos.length)show('مخزنی برای این توکن وجود ندارد.');else show(d.repos.length+' مخزن دریافت شد.');}catch(err){show(err.message,true);}});
$('#getTree').addEventListener('click',async()=>{try{const params=new URLSearchParams({owner:$('#treeOwner').value.trim(),repo:$('#treeRepo').value.trim(),path:$('#treePath').value.trim()});const d=await api('/api/github/tree?'+params);$('#treeResult').textContent=d.items.map(i=>(i.type==='dir'?'📁 ':'📄 ')+i.path).join('\n')||'پوشه خالی است.';}catch(err){show(err.message,true);}});
$('#zipFile').addEventListener('change',()=>{$('#zipResult').textContent=$('#zipFile').files[0]?.name||'';importId=null;$('#zipCommit').classList.add('hidden');});
$('#inspectZip').addEventListener('click',async()=>{
 const file=$('#zipFile').files[0];if(!file)return show('ابتدا فایل ZIP را انتخاب کن.',true);
 try{show('در حال بررسی فایل ZIP...');const d=await api('/api/zip/inspect',{method:'POST',headers:{'content-type':'application/zip'},body:file});importId=d.importId;
 $('#zipResult').textContent='تعداد فایل‌ها: '+d.files.length+'\nحجم استخراج: '+d.totalBytes+' بایت\n'+d.files.map(f=>'✓ '+f.path+' ('+f.size+' B)').join('\n')+(d.skipped.length?'\n\nفایل‌های حذف‌شده از واردسازی:\n'+d.skipped.map(f=>'⚠ '+f.path).join('\n'):'');
 $('#zipCommit').classList.remove('hidden');show('ZIP بررسی شد. برای آپلود باید توکن GitHub و تایید عملیات داشته باشید.');
 }catch(err){show(err.message,true);}
});
$('#createPR').addEventListener('click',async()=>{
 if(!importId)return show('ابتدا ZIP را بررسی کن.',true);
 if(!$('#approveImport').checked)return show('برای انجام تغییر در GitHub تیک تأیید را فعال کن.',true);
 if(!confirm('ساخت شاخه و Pull Request در GitHub با فایل‌های ZIP تأیید می‌شود؟'))return;
 const btn=$('#createPR');btn.disabled=true;
 try{const d=await api('/api/github/import-pr',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({importId,owner:$('#importOwner').value.trim(),repo:$('#importRepo').value.trim(),baseBranch:$('#importBranch').value.trim(),confirm:'CREATE_BRANCH_AND_PR'})});importId=null;show('Pull Request ساخته شد: '+d.pull_request_url);$('#zipResult').textContent+='\n\nPull Request: '+d.pull_request_url;$('#zipCommit').classList.add('hidden');}
 catch(err){show(err.message+' — ممکن است شاخه ایجاد شده باشد؛ وضعیت GitHub را پیش از تلاش دوباره بررسی کن.',true);}
 finally{btn.disabled=false;}
});
$('#pingMongo').addEventListener('click',async()=>{try{$('#mongoResult').textContent=JSON.stringify(await api('/api/mongo/status'),null,2);}catch(err){show(err.message,true);}});
api('/api/auth/me').then(async r=>{if(r.authenticated){$('#login').classList.add('hidden');await refresh();}}).catch(()=>{});

async function loadToolCatalog(){try{const d=await api('/api/tools/catalog');const c=$('#toolCards');c.replaceChildren();for(const tool of d.tools){const card=document.createElement('div');card.className='card';const title=document.createElement('b');title.textContent=tool.name;const meta=document.createElement('small');meta.textContent=tool.category+' · '+tool.mode;const cmd=document.createElement('code');cmd.style.cssText='display:block;overflow-wrap:anywhere;margin-top:8px';cmd.textContent=tool.install;const link=document.createElement('a');link.href=tool.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='راهنمای رسمی ↗';link.style.cssText='display:block;margin-top:8px;color:#45d4ff';card.append(title,meta,cmd,link);c.append(card);}}catch(err){show(err.message,true);}}
for(const el of document.querySelectorAll('[data-tab="tools"]'))el.addEventListener('click',loadToolCatalog);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

const copyImagePrompt=document.querySelector("#copyImagePrompt");if(copyImagePrompt)copyImagePrompt.addEventListener("click",async()=>{const v=document.querySelector("#imagePrompt").value;if(!v.trim())return;try{await navigator.clipboard.writeText(v);copyImagePrompt.textContent="کپی شد ✓";}catch(e){copyImagePrompt.textContent="کپی ممکن نشد";}});
