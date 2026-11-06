import {inflateRawSync} from 'node:zlib';

const MAX_ENTRIES=160, MAX_TOTAL=6*1024*1024, MAX_FILE=2*1024*1024;
const PRIVATE_FILE=/(^|\/)(?:\.git|node_modules|\.ssh|\.aws|\.next|\.venv|vendor|\.idea)(\/|$)/i;
function safeName(name) {
  if(!name || name.length>240 || name.startsWith('/') || name.includes('\\') || name.includes('\0') || /^[A-Za-z]:/.test(name))return false;
  if(name.split('/').some(part=>part==='..'||part==='.'||part==='')) return false;
  if(/[\x00-\x1f]/.test(name))return false;
  return true;
}
function ignore(name){
 if(PRIVATE_FILE.test(name))return true;
 const leaf=name.split('/').at(-1).toLowerCase();
 return /^\.env(?:\..*)?$/.test(leaf)&&leaf!=='.env.example' || /^\.npmrc$|^id_rsa$|^id_ed25519$|^credentials\.json$|^\.pypirc$/.test(leaf);
}
function crc32(buffer){
 let crc=0xffffffff;
 for (const b of buffer) {crc^=b; for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
export function parseZip(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length<22||buffer.length>9*1024*1024)throw new Error('فایل ZIP معتبر نیست یا بیش از حد بزرگ است.');
 let eocd=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd===-1)throw new Error('ساختار ZIP یافت نشد.');
 if(buffer.readUInt16LE(eocd+4)||buffer.readUInt16LE(eocd+6))throw new Error('ZIP چندبخشی پشتیبانی نمی‌شود.');
 const count=buffer.readUInt16LE(eocd+10),off=buffer.readUInt32LE(eocd+16);
 if(count>MAX_ENTRIES||count===0||off>buffer.length)throw new Error('تعداد فایل‌ها یا جدول ZIP نامعتبر است.');
 let pos=off,total=0;
 const files=[], skipped=[], paths=new Set();
 for(let i=0;i<count;i++){
  if(pos+46>buffer.length || buffer.readUInt32LE(pos)!==0x02014b50)throw new Error('ZIP خراب است (central directory).');
  const flags=buffer.readUInt16LE(pos+8),method=buffer.readUInt16LE(pos+10),checksum=buffer.readUInt32LE(pos+16);
  const compressed=buffer.readUInt32LE(pos+20),uncompressed=buffer.readUInt32LE(pos+24);
  const nlen=buffer.readUInt16LE(pos+28),elen=buffer.readUInt16LE(pos+30),clen=buffer.readUInt16LE(pos+32);
  const ext=buffer.readUInt32LE(pos+38),local=buffer.readUInt32LE(pos+42);
  if(pos+46+nlen+elen+clen>buffer.length)throw new Error('ZIP خراب است (record length).');
  const name=buffer.subarray(pos+46,pos+46+nlen).toString('utf8');
  pos+=46+nlen+elen+clen;
  if(name.endsWith('/'))continue;
  if(!safeName(name))throw new Error('مسیر خطرناک یا نامعتبر در ZIP وجود دارد.');
  if(paths.has(name))throw new Error('مسیر تکراری در ZIP وجود دارد.');paths.add(name);
  const unixMode=(ext>>>16)&0xffff;
  if((unixMode&0xf000)===0xa000 || ((unixMode&0xf000)!==0 && (unixMode&0xf000)!==0x8000))throw new Error('لینک یا فایل غیرعادی در ZIP مجاز نیست.');
  if(flags&1 || (flags&0x40) || ![0,8].includes(method))throw new Error('رمزگذاری یا فشرده‌سازی ناشناخته پشتیبانی نمی‌شود.');
  if(ignore(name)){skipped.push({path:name,reason:'فایل احتمالا محرمانه یا وابستگی'});continue;}
  total+=uncompressed;
  if(uncompressed>MAX_FILE||total>MAX_TOTAL||compressed===0&&uncompressed>0||uncompressed>compressed*120+1024) throw new Error('حجم استخراج یا نسبت فشرده‌سازی بیش از حد مجاز است.');
  if(local+30>buffer.length || buffer.readUInt32LE(local)!==0x04034b50)throw new Error('ZIP خراب است (local header).');
  const ln=buffer.readUInt16LE(local+26),le=buffer.readUInt16LE(local+28);
  const start=local+30+ln+le;
  if(start+compressed>buffer.length)throw new Error('ZIP خراب است (data).');
  const chunk=buffer.subarray(start,start+compressed);
  let data;
  try{data=method===0?Buffer.from(chunk):inflateRawSync(chunk,{maxOutputLength:MAX_FILE+1});}catch{throw new Error('استخراج فایل ZIP ناموفق بود.');}
  if(data.length!==uncompressed||crc32(data)!==checksum)throw new Error('خطا در صحت محتوا یا CRC فایل ZIP.');
  files.push({path:name,size:uncompressed,data});
 }
 if(files.length===0)throw new Error('فایل قابل واردکردن در ZIP پیدا نشد.');
 return {files,skipped,totalBytes:total};
}
