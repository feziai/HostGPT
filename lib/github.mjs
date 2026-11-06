import {e,configured} from './env.mjs';
const api='https://api.github.com';
const validPart=s=>typeof s==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(s)&&s!=='.'&&s!=='..';
const validBranch=s=>typeof s==='string'&&/^[A-Za-z0-9_./-]{1,130}$/.test(s)&&!s.startsWith('/')&&!s.endsWith('/')&&!s.includes('..')&&!s.includes('//');
export async function gh(path,{method='GET',body}={}){
 if(!configured('GITHUB_TOKEN'))throw new Error('توکن GitHub هنوز روی سرور تنظیم نشده است.');
 const res=await fetch(api+path,{method,headers:{Authorization:'Bearer '+e('GITHUB_TOKEN'),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok)throw new Error('خطای GitHub HTTP '+res.status+' — مجوز یا نام مخزن/شاخه را بررسی کنید.');
 return data;
}
export async function repositories(){
 const repos=await gh('/user/repos?sort=updated&per_page=100&affiliation=owner%2Ccollaborator%2Corganization_member');
 return repos.map(r=>({full_name:r.full_name,private:r.private,default_branch:r.default_branch,html_url:r.html_url,updated_at:r.updated_at}));
}
export async function directory({owner,repo,path=''}){
 if(!validPart(owner)||!validPart(repo)||path.includes('..')||path.startsWith('/')||path.includes('\\')||path.length>300)throw new Error('مسیر یا مخزن نامعتبر است.');
 const pieces=path?'/'+path.split('/').map(encodeURIComponent).join('/'):'';
 const d=await gh(`/repos/${owner}/${repo}/contents${pieces}`);
 const items=Array.isArray(d)?d:[d];
 return items.map(x=>({name:x.name,path:x.path,type:x.type,size:x.size,download_url:x.download_url}));
}
export async function importPR({owner,repo,baseBranch,files}){
 if(!validPart(owner)||!validPart(repo)||!validBranch(baseBranch))throw new Error('نام مخزن یا شاخه نامعتبر است.');
 if(!files?.length||files.length>160)throw new Error('فهرست فایل نامعتبر است.');
 const root=`/repos/${owner}/${repo}`;
 const ref=await gh(root+'/git/ref/heads/'+baseBranch.split('/').map(encodeURIComponent).join('/'));
 const sha=ref.object.sha;
 const baseCommit=await gh(root+'/git/commits/'+sha);
 const tree=[];
 for(const file of files){
   const blob=await gh(root+'/git/blobs',{method:'POST',body:{content:file.data.toString('base64'),encoding:'base64'}});
   tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
 }
 const newTree=await gh(root+'/git/trees',{method:'POST',body:{base_tree:baseCommit.tree.sha,tree}});
 const commit=await gh(root+'/git/commits',{method:'POST',body:{message:'Import project ZIP via HostGPT AI',tree:newTree.sha,parents:[sha]}});
 const branch='fezi-import-'+Date.now();
 await gh(root+'/git/refs',{method:'POST',body:{ref:'refs/heads/'+branch,sha:commit.sha}});
 const pr=await gh(root+'/pulls',{method:'POST',body:{title:'Import ZIP via HostGPT AI',head:branch,base:baseBranch,body:'Generated from an approved ZIP upload. Review all changes before merging.'}});
 return {branch,sha:commit.sha,pull_request_url:pr.html_url,number:pr.number};
}
