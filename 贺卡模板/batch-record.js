#!/usr/bin/env node
'use strict';

const path = require('path');
const { recordCard, extractScreenOrder, parseArgs } = require('./record-card-mobile');

const TEMPLATES = [
  'birthday-card-13-employee-warm-image',
  'birthday-card-14-executive-night-image',
  'birthday-card-15-executive-private-banquet',
  'birthday-card-16-executive-honor-gallery',
  'birthday-card-17-executive-time-archive'
];

async function main() {
  const args = parseArgs(process.argv);
  const provided = args.__provided;
  const baseDir = __dirname;

  const name = String(args.name || '').trim() || '王总';
  const message = String(args.message || '').trim() || '祝您生日快乐，事业长青，生活明亮从容。';

  const results = [];

  for (const tpl of TEMPLATES) {
    const cardDir = path.join(baseDir, tpl);
    const outFile = path.resolve(baseDir, 'output', `${tpl}-mobile.mp4`);

    let screenOrder = extractScreenOrder(cardDir);
    if (!screenOrder || !screenOrder.length) {
      screenOrder = ['cover', 'name', 'imprint', 'compass', 'wish', 'message', 'final'];
    }

    try {
      await recordCard({
        cardDir,
        outFile,
        name,
        message,
        screenOrder,
        options: {
          ...args,
          'max-size-mb': args['max-size-mb'] || '2',
          compact: true
        }
      });
      results.push({ template: tpl, status: '成功', file: outFile });
    } catch (err) {
      console.error(`\n模板 ${tpl} 录制失败：${err.message}`);
      results.push({ template: tpl, status: '失败', error: err.message });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('批量录制结果汇总：');
  for (const r of results) {
    console.log(`  ${r.status === '成功' ? '✓' : '✗'} ${r.template} → ${r.status}`);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
