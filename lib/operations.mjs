// Pure, offline-verifiable operation planner. Never performs a remote write.
const name=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/;
const safePath=(s)=>typeof s==='string'&&s.length<=350&&s.length>0&&!s.startsWith('/')&&!s.includes('\\')&&!s.split('/').some(x=>!x||x==='.'||x==='..'||x==='.git');
export function validateGithubChange(change){
 if(!change||!['create','update','delete','move'].includes(change.action))throw Error('invalid action');
 if(!safePath(change.path))throw Error('unsafe path');
 if(change.action==='move'&&!safePath(change.destination))throw Error('unsafe destination');
 if(['update','delete','move'].includes(change.action)&&!(/^[0-9a-f]{40}$/.test(change.expectedSha||'')))throw Error('missing optimistic concurrency SHA');
 if(['create','update'].includes(change.action)&&typeof change.content!=='string')throw Error('missing content');
 if((change.content||'').length>1_000_000)throw Error('file exceeds safe single-operation limit');
 return {action:change.action,path:change.path,destination:change.destination||null,bytes:Buffer.byteLength(change.content||'','utf8')};
}
export function planGithubBatch({owner,repo,branch,changes}){
 if(!name.test(owner||'')||!name.test(repo||''))throw Error('invalid repository');
 if(typeof branch!=='string'||!branch||branch.startsWith('/')||branch.includes('..')||branch.includes('\\'))throw Error('invalid branch');
 if(!Array.isArray(changes)||changes.length<1||changes.length>160)throw Error('batch size must be 1..160');
 const files=changes.map(validateGithubChange), paths=new Set();
 for(const f of files){if(paths.has(f.path))throw Error('duplicate file path');paths.add(f.path)}
 return {repository:`${owner}/${repo}`,branch,mode:'DRY_RUN',requiresApproval:true,operations:files,totalBytes:files.reduce((s,x)=>s+x.bytes,0)};
}
export function planHostAction(action){
 const allowed=['health','disk','memory','cpu','logs','backup-plan','restore-plan','restart-plan','deploy-plan','ssl-check','dns-check','uptime','ports','service-status','env-audit','git-sync-plan','rollback-plan','resource-estimate','security-audit'];
 if(!action||!allowed.includes(action.type))throw Error('unsupported host action');
 const host=action.host;
 if(typeof host!=='string'||host.length>253||!/^[a-z0-9.-]+$/i.test(host)||host.includes('..'))throw Error('invalid hostname');
 return {type:action.type,host,mode:'DRY_RUN',requiresApproval:!['health','disk','memory','cpu','ssl-check','dns-check','uptime','ports','service-status','resource-estimate'].includes(action.type)};
}
