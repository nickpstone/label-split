import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {cellsFor,inkBounds,splitPdf,MM} from '../src/pdf.js';
test('Australia Post layout follows the left column in reading order',()=>{
 assert.deepEqual(cellsFor(595,842,'post'),[{x:0,y:0,width:297.5,height:421},{x:0,y:421,width:297.5,height:421}]);
 assert.equal(cellsFor(595,842,'four').length,4);
});
test('blank cells are skipped while barcode-like artwork is retained',()=>{
 const data=new Uint8ClampedArray(100*100*4).fill(255);
 assert.equal(inkBounds({data,width:100,height:100},{x:0,y:0,width:100,height:100}),null);
 for(let y=20;y<80;y++)for(let x=20;x<45;x++){let i=(y*100+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 assert.deepEqual(inkBounds({data,width:100,height:100},{x:0,y:0,width:100,height:100}),{x:20,y:20,width:25,height:60});
});
test('export preserves order and exact printer dimensions for selected labels',async()=>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);
 doc.addPage([595,842]).drawText('Top label',{x:20,y:750,font});
 doc.addPage([595,842]).drawText('Second page',{x:20,y:750,font});
 const bytes=await doc.save();
 const labels=[{pageIndex:1,box:{left:10,bottom:430,right:290,top:830}},{pageIndex:0,box:{left:10,bottom:430,right:290,top:830}}];
 const output=await PDFDocument.load(await splitPdf(bytes,labels));
 assert.equal(output.getPageCount(),2);
 for(const page of output.getPages()){assert.ok(Math.abs(page.getWidth()-100*MM)<.001);assert.ok(Math.abs(page.getHeight()-150*MM)<.001);}
 assert.equal((await PDFDocument.load(await splitPdf(bytes,labels.slice(0,1),{width:102,height:152,margin:0}))).getPageCount(),1);
 await assert.rejects(()=>splitPdf(bytes,[]),/at least one/);
 await assert.rejects(()=>splitPdf(bytes,labels,{width:NaN,height:150,margin:2}),/dimensions/);
});
