import {status} from './ai.mjs';
export function handleMcp(msg){
 const id=msg?.id;
 const ok=result=>id===undefined?null:{jsonrpc:'2.0',id,result};
 const err=(code,message)=>id===undefined?null:{jsonrpc:'2.0',id,error:{code,message}};
 if(msg?.jsonrpc!=='2.0')return err(-32600,'Invalid JSON-RPC');
 if(msg.method==='initialize')return ok({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'hostgpt-ai',version:'0.1.0'}});
 if(msg.method==='notifications/initialized')return null;
 if(msg.method==='ping')return ok({});
 if(msg.method==='tools/list')return ok({tools:[
  {name:'ai_provider_status',description:'Read-only: show which AI providers are configured (never exposes credentials)',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'project_info',description:'Read-only: describe HostGPT AI capabilities and limitations',inputSchema:{type:'object',properties:{},additionalProperties:false}}
 ]});
 if(msg.method==='tools/call'){
   if(msg.params?.name==='ai_provider_status')return ok({content:[{type:'text',text:JSON.stringify(status())}],isError:false});
   if(msg.params?.name==='project_info')return ok({content:[{type:'text',text:'HostGPT AI starter v0.1: AI chat, GitHub browse, ZIP inspect, create PR. Hosting deployment is not yet implemented.'}],isError:false});
   return err(-32602,'Unknown tool');
 }
 return err(-32601,'Method not found');
}
