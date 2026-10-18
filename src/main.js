import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cellsFor, inkBounds, splitPdf, LAYOUTS } from './pdf.js';
import './style.css';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
const $=s=>document.querySelector(s);
const icon=(name)=>({upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',file:'<path d="M14 3H5v18h14V8zm0 0v5h5M8 13h8m-8 4h6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',download:'<path d="M12 3v13m-4-4 4 4 4-4M4 17v4h16v-4"/>',print:'<path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z"/>',check:'<path d="m5 12 4 4L19 6"/>'}[name]||'');
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
let preferences={size:'100x150',margin:'2',layout:'post'};
try { preferences={...preferences,...JSON.parse(localStorage.getItem('label-split-settings')||'{}')}; } catch {}
let state={bytes:null,doc:null,labels:[],selected:new Set(),fileName:'',busy:false,output:null,version:0};
let outputUrl=null;
$('#app').innerHTML=`
<header class="topbar"><a class="brand" href="/" aria-label="Label Split home"><img src="/icon.svg" width="32" height="32" alt="">Label Split</a><span class="private-note">${svg('lock')} Files stay in your browser</span></header>
<main><div class="intro"><div><h1>From sheet to shipping label.</h1><p>Drop in your PDF. Get one label per page, ready for your printer.</p></div><button class="text-button" id="help" aria-expanded="false">Printing tips <span aria-hidden="true">↗</span></button></div>
<aside id="tips" class="tips" hidden><strong>For a clean print</strong><p>Choose your label printer, set its paper size to match the output, and use <b>Actual size / 100%</b>. Turn off “Fit to page”, headers, and footers. Download the PDF if your browser cannot print custom paper sizes.</p></aside>
<div class="workbench"><section class="setup" aria-label="File and printer settings">
<div class="step-heading"><span>1</span><h2>Your shipping sheet</h2></div>
<input id="file" type="file" accept="application/pdf,.pdf" hidden><button id="dropzone" class="dropzone">${svg('upload')}<strong>Choose a PDF</strong><span>or drag and drop it here</span><small>PDF files · up to 50 MB</small></button>
<div class="file-card" id="file-card" hidden>${svg('file')}<div><strong id="filename"></strong><span id="file-detail"></span></div><button id="replace" class="text-button">Replace</button></div>
<div class="settings"><div class="step-heading"><span>2</span><h2>Set up your labels</h2></div>
<label for="layout">Source sheet layout</label><select id="layout">${Object.entries(LAYOUTS).map(([id,v])=>`<option value="${id}">${v.name}</option>`).join('')}</select><p class="field-note">For your Australia Post sheets, use “2 on the left”. Empty label spaces are skipped.</p>
<label for="size">Label paper size</label><select id="size"><option value="100x150">100 × 150 mm</option><option value="101.6x152.4">4 × 6 inches (101.6 × 152.4 mm)</option><option value="102x152">102 × 152 mm</option><option value="custom">Custom size</option></select>
<div id="custom-size" class="custom-size" hidden><label>Width (mm)<input id="width" type="number" min="30" max="300" value="100"></label><label>Height (mm)<input id="height" type="number" min="30" max="300" value="150"></label></div>
<label for="margin">Printer margin</label><select id="margin"><option value="0">No margin</option><option value="1">1 mm</option><option value="2">2 mm · recommended</option><option value="3">3 mm</option><option value="5">5 mm</option></select><p class="field-note">Labels fit inside the page without stretching or cutting off the barcode.</p></div>
<div class="remember">${svg('check')} Printer settings remembered on this device</div>
</section>
<section class="preview" aria-label="Label preview"><div class="preview-heading"><div><span class="preview-dot" id="preview-dot"></span><h2 id="preview-title">Your labels will appear here</h2></div><span id="paper-badge">100 × 150 mm</span></div>
<div id="empty-preview" class="empty-preview"><div class="paper-demo" aria-hidden="true"><div class="sheet"><i></i><i></i></div><span>${svg('arrow')}</span><div class="label-stack"><i></i><i></i></div></div><h3>A page for every parcel.</h3><p>We separate the labels, remove the extra paper,<br>and keep the original artwork sharp.</p><div class="format-note">Built for Australia Post A4 shipping sheets</div></div>
<div id="status" class="status" role="status" aria-live="polite" hidden></div><div id="error" class="error" role="alert" hidden></div>
<div id="results" hidden><div class="selection-bar"><span id="selection-count"></span><button class="text-button" id="select-all">Select all</button></div><div id="labels" class="label-grid"></div></div>
<div class="export-bar"><div><strong id="export-title">Ready when you are</strong><span id="export-subtitle">Choose a PDF to get started.</span></div><div class="export-actions"><button id="download" class="secondary" disabled>${svg('download')} Download PDF</button><button id="print" class="primary" disabled>${svg('print')} Print labels</button></div></div>
</section></div><footer><span>No uploads. No account needed to process your files.</span><span>Made for the daily dispatch.</span></footer></main>`;
for(const name of ['size','layout','margin']) if([...$('#'+name).options].some(o=>o.value===preferences[name])) $('#'+name).value=preferences[name];
function settings(){const size=$('#size').value;const [width,height]=size==='custom'?[Number($('#width').value),Number($('#height').value)]:size.split('x').map(Number);return{width,height,margin:Number($('#margin').value)};}
function savePreferences(){try{localStorage.setItem('label-split-settings',JSON.stringify({size:$('#size').value,layout:$('#layout').value,margin:$('#margin').value,width:$('#width').value,height:$('#height').value}));}catch{}}
if(preferences.width)$('#width').value=preferences.width;if(preferences.height)$('#height').value=preferences.height;
function syncPaper(){const p=settings();$('#custom-size').hidden=$('#size').value!=='custom';$('#paper-badge').textContent=`${p.width} × ${p.height} mm`;document.documentElement.style.setProperty('--paper-ratio',`${p.width}/${p.height}`);document.documentElement.style.setProperty('--paper-padding',`${p.margin/p.width*100}%`);}
syncPaper();
function status(message){$('#status').hidden=!message;$('#status').textContent=message;}
function error(message){$('#error').hidden=!message;$('#error').textContent=message;}
function invalidate(){state.version++;state.output=null;if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl=null;}}
function updateSelection(){for(const name of ['layout','size','margin','width','height','replace','dropzone','select-all'])$('#'+name).disabled=state.busy;const n=state.selected.size;$('#selection-count').textContent=`${n} of ${state.labels.length} labels selected`;$('#preview-title').textContent=state.labels.length?`${state.labels.length} labels found`:'Your labels will appear here';$('#preview-dot').classList.toggle('ready',state.labels.length>0);$('#export-title').textContent=n?`${n} label${n===1?'':'s'} ready`:'Ready when you are';$('#export-subtitle').textContent=n?'One label per page. Print at 100% scale.':'Choose a PDF and select your labels.';for(const name of ['download','print'])$('#'+name).disabled=state.busy||!n;$('#select-all').textContent=n===state.labels.length?'Deselect all':'Select all';}
async function readFile(file){if(!file)return;if(state.busy)return;error('');if(file.size>50*1024*1024){error('This PDF is too large. Choose a file smaller than 50 MB.');return;}state.busy=true;let changedDocument=false;updateSelection();status('Opening your PDF…');try{
 const bytes=new Uint8Array(await file.arrayBuffer());if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw new Error('Please choose a PDF file.');
 const doc=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
 if(doc.numPages>200){await doc.destroy();throw new Error('Please split batches larger than 200 source pages into smaller PDFs.');}
 if(state.doc)await state.doc.destroy();state.doc=doc;state.bytes=bytes;changedDocument=true;state.fileName=file.name;$('#filename').textContent=file.name;$('#file-detail').textContent=`${doc.numPages} source page${doc.numPages===1?'':'s'} · ${(file.size/1024).toFixed(0)} KB`;$('#file-card').hidden=false;$('#dropzone').hidden=true;await inspect();
 }catch(e){if(changedDocument){state.labels=[];state.selected.clear();$('#results').hidden=true;}error(e.name==='PasswordException'?'This PDF is password protected. Save an unlocked copy and try again.':e.message||'Could not open this PDF. Try downloading it again.');}finally{state.busy=false;status('');updateSelection();$('#file').value='';}}
async function inspect(){invalidate();state.labels=[];state.selected.clear();$('#labels').replaceChildren();$('#results').hidden=true;$('#empty-preview').hidden=true;const layout=$('#layout').value;let skipped=0;
 for(let pageIndex=0;pageIndex<state.doc.numPages;pageIndex++){
  status(`Finding labels on page ${pageIndex+1} of ${state.doc.numPages}…`);const page=await state.doc.getPage(pageIndex+1);const viewport=page.getViewport({scale:1.5,rotation:0});
  if(layout==='post'&&(Math.abs(viewport.width/1.5-595)>12||Math.abs(viewport.height/1.5-842)>12))throw new Error('This is not a portrait A4 sheet. Choose another source layout, then try again.');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport,background:'white'}).promise;const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);if(layout==='post'&&inkBounds(pixels,{x:viewport.width/2,y:0,width:viewport.width/2,height:viewport.height})){throw new Error('This sheet also has content on the right. Choose the 4-label grid or another source layout.');}
  for(const cell of cellsFor(viewport.width,viewport.height,layout)){
   const bounds=inkBounds(pixels,cell);if(!bounds){skipped++;continue;}
   const pad=2*viewport.scale;const x=Math.max(cell.x,bounds.x-pad),y=Math.max(cell.y,bounds.y-pad);const r=Math.min(cell.x+cell.width,bounds.x+bounds.width+pad),b=Math.min(cell.y+cell.height,bounds.y+bounds.height+pad);
   const [left,top]=viewport.convertToPdfPoint(x,y),[right,bottom]=viewport.convertToPdfPoint(r,b);
   const thumb=document.createElement('canvas');const scale=Math.min(350/(r-x),450/(b-y));thumb.width=Math.ceil((r-x)*scale);thumb.height=Math.ceil((b-y)*scale);thumb.getContext('2d').drawImage(canvas,x,y,r-x,b-y,0,0,thumb.width,thumb.height);
   const id=state.labels.length;state.labels.push({id,pageIndex,box:{left,bottom,right,top},thumbnail:thumb.toDataURL('image/png')});state.selected.add(id);
  }
  canvas.width=0;canvas.height=0;page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!state.labels.length)throw new Error('No labels found in this layout. Choose a different source layout or another PDF.');
 for(const label of state.labels){const card=document.createElement('label');card.className='label-card';card.innerHTML=`<div class="label-card-heading"><span><input type="checkbox" checked aria-label="Include label ${label.id+1}"> Label ${label.id+1}</span><small>Source page ${label.pageIndex+1}</small></div><div class="label-paper"><img alt="Preview of label ${label.id+1}" src="${label.thumbnail}"></div>`;card.querySelector('input').addEventListener('change',e=>{if(state.busy){e.target.checked=state.selected.has(label.id);return;}e.target.checked?state.selected.add(label.id):state.selected.delete(label.id);card.classList.toggle('excluded',!e.target.checked);invalidate();updateSelection();});$('#labels').append(card);}
 $('#results').hidden=false;$('#empty-preview').hidden=true;if(skipped)$('#file-detail').textContent+=` · ${skipped} empty space${skipped===1?'':'s'} skipped`;updateSelection();
}
$('#dropzone').onclick=$('#replace').onclick=()=>$('#file').click();$('#file').onchange=e=>readFile(e.target.files[0]);
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{e.preventDefault();if(!state.busy)$('#dropzone').classList.add('dragging');});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('#dropzone').classList.remove('dragging');});document.addEventListener('drop',e=>{e.preventDefault();$('#dropzone').classList.remove('dragging');if(e.dataTransfer.files.length!==1){error('Choose one PDF at a time.');return;}readFile(e.dataTransfer.files[0]);});
$('#help').onclick=()=>{const open=$('#tips').hidden;$('#tips').hidden=!open;$('#help').setAttribute('aria-expanded',String(open));};
for(const name of ['size','margin','width','height'])$('#'+name).onchange=()=>{syncPaper();savePreferences();invalidate();};
$('#layout').onchange=async()=>{savePreferences();if(!state.doc||state.busy)return;state.busy=true;error('');updateSelection();try{await inspect();}catch(e){state.labels=[];state.selected.clear();error(e.message);}finally{state.busy=false;status('');updateSelection();}};
$('#select-all').onclick=()=>{const all=state.selected.size===state.labels.length;state.selected=new Set(all?[]:state.labels.map(l=>l.id));$('#labels').querySelectorAll('input').forEach(i=>{i.checked=!all;i.closest('.label-card').classList.toggle('excluded',all);});invalidate();updateSelection();};
async function output(){if(!state.output)state.output=await splitPdf(state.bytes,state.labels.filter(l=>state.selected.has(l.id)),settings());return state.output;}
async function exportFile(print){if(state.busy||!state.selected.size)return;const printWindow=print?window.open('about:blank','_blank'):null;state.busy=true;error('');updateSelection();status('Preparing your label pages…');try{const bytes=await output();if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));if(print){const win=printWindow;if(!win){throw new Error('Your browser blocked the print window. Allow pop-ups for this site, or download the PDF to print.');}win.location.href=outputUrl;status('PDF opened. Use its Print button and choose Actual size / 100%.');}else{const a=document.createElement('a');a.href=outputUrl;a.download=state.fileName.replace(/\.pdf$/i,'')+'-labels.pdf';a.click();status('Your printer-ready PDF has been downloaded.');}}catch(e){if(printWindow)printWindow.close();error(e.message);}finally{state.busy=false;updateSelection();}}
$('#download').onclick=()=>exportFile(false);$('#print').onclick=()=>exportFile(true);

