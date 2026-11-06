import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseZip} from '../lib/zip.mjs';
import {deflateRawSync} from 'node:zlib';
// Self-contained ZIP fixture creator for unit tests.
function crc32(buf){let x=0xffffffff;for(const b of buf){x^=b;for(let i=0;i<8;i++)x=(x>>>1)^((x&1)?0xedb88320:0);}return (x^0xffffffff)>>>0;}
function makeZip(name,content){
 const n=Buffer.from(name),c=Buffer.from(content),z=deflateRawSync(c),crc=crc32(c);
 const loc=Buffer.alloc(30);loc.writeUInt32LE(0x04034b50,0);loc.writeUInt16LE(20,4);loc.writeUInt16LE(8,8);loc.writeUInt32LE(crc,14);loc.writeUInt32LE(z.length,18);loc.writeUInt32LE(c.length,22);loc.writeUInt16LE(n.length,26);
 const cen=Buffer.alloc(46);cen.writeUInt32LE(0x02014b50,0);cen.writeUInt16LE(20,4);cen.writeUInt16LE(20,6);cen.writeUInt16LE(8,10);cen.writeUInt32LE(crc,16);cen.writeUInt32LE(z.length,20);cen.writeUInt32LE(c.length,24);cen.writeUInt16LE(n.length,28);cen.writeUInt32LE((0o100644<<16)>>>0,38);
 const off=loc.length+n.length+z.length;const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(cen.length+n.length,12);end.writeUInt32LE(off,16);
 return Buffer.concat([loc,n,z,cen,n,end]);
}
test('can parse safe ZIP',()=>{const r=parseZip(makeZip('src/app.js','console.log(42)'));assert.equal(r.files.length,1);assert.equal(r.files[0].data.toString(),'console.log(42)');});
test('rejects ZIP path traversal',()=>assert.throws(()=>parseZip(makeZip('../secrets.txt','x')),/مسیر خطرناک/));
test('skips .env secrets',()=>assert.throws(()=>parseZip(makeZip('.env','SECRET')),/قابل واردکردن/));
test('rejects broken data',()=>{const z=makeZip('good.txt','hello');z[40]^=0xff;assert.throws(()=>parseZip(z));});
