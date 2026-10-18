import { PDFDocument, degrees } from 'pdf-lib';
export const MM = 72 / 25.4;
export const LAYOUTS = {
  'post': { name: 'Australia Post · 2 on the left', columns: 2, rows: 2, leftOnly: true },
  'two': { name: '2 labels · full-width halves', columns: 1, rows: 2 },
  'four': { name: '4 labels · 2 × 2 grid', columns: 2, rows: 2 },
  'one': { name: '1 label · whole page', columns: 1, rows: 1 },
};
export function cellsFor(width, height, layout) {
  const config = LAYOUTS[layout];
  if (!config) throw new Error('Choose a supported sheet layout.');
  const cells = [];
  for (let row = 0; row < config.rows; row++) {
    for (let column = 0; column < (config.leftOnly ? 1 : config.columns); column++) {
      cells.push({ x: column * width / config.columns, y: row * height / config.rows,
        width: width / config.columns, height: height / config.rows });
    }
  }
  return cells;
}
// Detect the printed artwork only. Export embeds the original PDF, never this raster.
export function inkBounds(image, cell) {
  const { data, width, height } = image;
  const x0 = Math.max(0, Math.floor(cell.x)), y0 = Math.max(0, Math.floor(cell.y));
  const x1 = Math.min(width, Math.ceil(cell.x + cell.width)), y1 = Math.min(height, Math.ceil(cell.y + cell.height));
  let left=x1, top=y1, right=-1, bottom=-1, count=0;
  for (let y=y0; y<y1; y++) for (let x=x0; x<x1; x++) {
    const i=(y*width+x)*4;
    if (data[i+3] > 20 && Math.min(data[i],data[i+1],data[i+2]) < 235) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;
    }
  }
  if (count < 30 || right-left < 10 || bottom-top < 10) return null;
  return { x:left, y:top, width:right-left+1, height:bottom-top+1 };
}
export async function splitPdf(bytes, labels, { width=100, height=150, margin=2 } = {}) {
  if (!labels.length) throw new Error('Select at least one label.');
  if (![width,height,margin].every(Number.isFinite) || width<30 || height<30 || width>300 || height>300 || margin<0 || margin>10)
    throw new Error('Paper dimensions must be 30–300 mm and margins 0–10 mm.');
  const source = await PDFDocument.load(bytes);
  const result = await PDFDocument.create();
  for (const label of labels) {
    const page = source.getPage(label.pageIndex);
    const { left,bottom,right,top } = label.box;
    const embedded = await result.embedPage(page, { left,bottom,right,top });
    const w=width*MM, h=height*MM, inset=margin*MM;
    const rotate=embedded.width>embedded.height;
    const ew=rotate?embedded.height:embedded.width, eh=rotate?embedded.width:embedded.height;
    const scale=Math.min((w-inset*2)/ew,(h-inset*2)/eh);
    const output=result.addPage([w,h]);
    const dw=embedded.width*scale, dh=embedded.height*scale;
    output.drawPage(embedded, rotate ? {x:(w-dh)/2+dh,y:(h-dw)/2,width:dw,height:dh,rotate:degrees(90)}
      : {x:(w-dw)/2,y:(h-dh)/2,width:dw,height:dh});
  }
  result.setTitle('Shipping labels');result.setCreator('Label Split');
  return result.save();
}
