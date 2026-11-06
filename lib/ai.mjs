import { e, configured } from './env.mjs';
export function status() {
  return {
    'ollama-local': {configured:true,model:e('OLLAMA_LOCAL_MODEL','qwen2.5-coder:7b'),kind:'local/free'},
    'ollama-cloud':{configured:configured('OLLAMA_CLOUD_API_KEY') && configured('OLLAMA_CLOUD_MODEL'),model:e('OLLAMA_CLOUD_MODEL'),kind:'remote/terms-apply'},
    'huggingface':{configured:configured('HF_TOKEN'),model:e('HF_MODEL','Qwen/Qwen2.5-Coder-7B-Instruct'),kind:'remote/token-and-availability'},
    'openrouter':{configured:configured('OPENROUTER_API_KEY'),model:e('OPENROUTER_MODEL','qwen/qwen3-coder:free'),kind:'remote/free-tier-terms'},
    'openai':{configured:configured('OPENAI_API_KEY'),model:e('OPENAI_MODEL','gpt-4.1-mini'),kind:'remote/potential-cost'},
    gemini:{configured:configured('GEMINI_API_KEY'),model:e('GEMINI_MODEL','gemini-2.5-flash'),kind:'remote/terms-apply'},
    grok:{configured:configured('XAI_API_KEY'),model:e('XAI_MODEL','grok-4.7'),kind:'remote/potential-cost'}
  };
}
async function postJSON(url, payload, headers={}) {
  const response = await fetch(url, {method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  const raw=await response.text();
  let data={}; try{data=JSON.parse(raw)}catch{}
  if (!response.ok) throw new Error('پاسخ ناموفق از سرویس هوش مصنوعی (HTTP '+response.status+'). تنظیمات مدل و کلید را بررسی کن.');
  return data;
}
const normalizeMessages = messages => {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length>24) throw new Error('تعداد پیام‌ها نامعتبر است.');
  const result = messages.map(m=>({role:m.role,content:String(m.content||'')}));
  if (result.some(m=>!['system','user','assistant'].includes(m.role)||m.content.length>12000)) throw new Error('محتوای پیام نامعتبر است.');
  if (result.reduce((n,m)=>n+m.content.length,0)>24000) throw new Error('تاریخچه گفتگو بیش از حد طولانی است.');
  return result;
};
function safeModel(input,fallback){const model=input||fallback;if(!/^[A-Za-z0-9_.:+\/-]{1,100}$/.test(model)) throw new Error('شناسه مدل نامعتبر است.');return model;}
export async function chat({provider='ollama-local', model, messages}) {
 const items=normalizeMessages(messages);
 const opts=status();
 if (!opts[provider] || !opts[provider].configured) throw new Error('این ارائه‌دهنده هنوز روی سرور پیکربندی نشده است.');
 const activeModel=safeModel(model,opts[provider].model);
 if(provider==='ollama-local'||provider==='ollama-cloud') {
   // Fixed server configuration, not user supplied URLs: prevents SSRF by model prompts.
   const base=provider==='ollama-cloud'?'https://ollama.com':e('OLLAMA_LOCAL_URL','http://127.0.0.1:11434').replace(/\/$/,'');
   const auth=provider==='ollama-cloud'?{Authorization:'Bearer '+e('OLLAMA_CLOUD_API_KEY')}:{ };
   const res=await postJSON(base+'/api/chat',{model:activeModel,messages:items,stream:false},auth);
   return {text:String(res.message?.content||'').trim()||'مدل پاسخی برنگرداند.',model:activeModel,provider};
 }
 if(provider==='huggingface'||provider==='openrouter'||provider==='openai') {
   const endpoint=provider==='huggingface'?'https://router.huggingface.co/v1/chat/completions':provider==='openrouter'?'https://openrouter.ai/api/v1/chat/completions':'https://api.openai.com/v1/chat/completions';
   const token=provider==='huggingface'?e('HF_TOKEN'):provider==='openrouter'?e('OPENROUTER_API_KEY'):e('OPENAI_API_KEY');
   const result=await postJSON(endpoint,{model:activeModel,messages:items,stream:false,max_tokens:1600},{Authorization:'Bearer '+token});
   return {text:String(result.choices?.[0]?.message?.content||'').trim()||'مدل پاسخی برنگرداند.',model:activeModel,provider};
 }
 if(provider==='gemini') {
   const system=items.filter(m=>m.role==='system').map(m=>m.content).join('\n');
   const contents=items.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
   const body={contents,...(system?{systemInstruction:{parts:[{text:system}]}}:{})};
   const res=await postJSON('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(activeModel)+':generateContent',body,{'x-goog-api-key':e('GEMINI_API_KEY')});
   return {text:(res.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim()||'پاسخ متنی دریافت نشد.',model:activeModel,provider};
 }
 if(provider==='grok') {
   const input=items.map(m=>({role:m.role,content:m.content}));
   const res=await postJSON('https://api.x.ai/v1/responses',{model:activeModel,input,store:false},{Authorization:'Bearer '+e('XAI_API_KEY')});
   const text=(res.output||[]).filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('\n').trim();
   return {text:text||res.output_text||'پاسخ متنی دریافت نشد.',model:activeModel,provider};
 }
 throw new Error('سرویس ناشناخته است.');
}
export async function localModels(){
 const url=e('OLLAMA_LOCAL_URL','http://127.0.0.1:11434').replace(/\/$/,'')+'/api/tags';
 const res=await fetch(url,{signal:AbortSignal.timeout(3000)});
 if(!res.ok)throw new Error('Ollama در دسترس نیست.');
 const data=await res.json();return (data.models||[]).map(m=>m.name);
}
