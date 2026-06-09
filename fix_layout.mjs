// Batch fix template layout issues for pages 2 & 3
import fs from 'fs';
import path from 'path';

const DATA_DIR = 'server/src/data';
const files = ['蛋糕.html','粉色.html','礼盒.html','派对.html','星光.html','红礼盒.html','寿桃.html','烟花.html','通用1.html','通用2.html'];
const bgImageFiles = ['红礼盒.html','寿桃.html','烟花.html','通用2.html'];
let totalFixed = 0;

for (const file of files) {
  const fp = path.join(DATA_DIR, file);
  let c = fs.readFileSync(fp, 'utf-8');
  let fixes = [];

  // FIX 1: line-height 2.2 -> 1.9
  if (c.includes('line-height: 2.2') || c.includes('line-height:2.2')) {
    c = c.replace(/line-height:\s*2\.2/g, 'line-height: 1.9');
    fixes.push('line-height');
  }

  // FIX 2: max-height + overflow for cards
  const isComplex = c.includes('.bless-card-body') && c.includes('.info-card-body');
  if (isComplex) {
    c = c.replace(/\.info-card-body\s*\{\s*padding:\s*0\s+32px\s+32px;\s*\}/, '.info-card-body { padding: 0 32px 32px; max-height: 40vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }');
    c = c.replace(/\.bless-card-body\s*\{\s*padding:\s*24px\s+28px;\s*\}/, '.bless-card-body { padding: 24px 28px; max-height: 42vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }');
    fixes.push('card-body overflow');
  } else {
    // Simple templates with overflow:hidden on info-card/bless-card
    c = c.replace(/(info-card[^{]*\{[^}]*?)overflow:\s*hidden;/g, '$1overflow-y: auto; max-height: 85vh; -webkit-overflow-scrolling: touch;');
    c = c.replace(/(bless-card[^{]*\{[^}]*?)overflow:\s*hidden;/g, '$1overflow-y: auto; max-height: 85vh; -webkit-overflow-scrolling: touch;');
    // Shared rule templates (礼盒, 星光 etc)
    if (!c.includes('max-height: 85vh')) {
      c = c.replace(/(\.info-card,\s*\.bless-card\s*\{[^}]*?)box-shadow:\s*([^;]+);/g, '$1box-shadow: $2; max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch;');
    }
    fixes.push('card overflow');
  }

  // FIX 3: Background image overlay
  if (bgImageFiles.includes(file) && !c.includes('.page::before')) {
    const ov = '\n    .page::before { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: rgba(0,0,0,0.35); }\n';
    c = c.replace('</style>', ov + '</style>');
    fixes.push('page overlay');
  }

  // FIX 4: CSS syntax error in 红礼盒
  if (file === '红礼盒.html' && c.includes('align-items: center justify-content: center')) {
    c = c.replace('align-items: center justify-content: center', 'align-items: center; justify-content: center');
    fixes.push('css syntax');
  }

  fs.writeFileSync(fp, c, 'utf-8');
  totalFixed += fixes.length;
  console.log('[' + file + '] ' + fixes.length + ' fixes: ' + fixes.join(', '));
}
console.log('\nTotal: ' + totalFixed);
