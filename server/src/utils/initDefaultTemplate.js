// 模板种子工具 - 将预设模板文件导入数据库
// 支持自动发现：src/data/ 下新增的 HTML 文件会自动入库，无需手动添加清单
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 已知模板清单：提供详细的元数据（名称、描述、匹配规则）
// 如果文件在此清单中，使用清单中的元数据；否则自动从文件名生成
// 注意：旧模板已清理，此清单保留为空，新模板通过 import-new-templates.js 脚本导入
const TEMPLATE_MANIFEST = [
];

// 旧名称 → 新名称的映射（一次性数据库迁移，保持记录 ID 不变）
// 保留历史迁移记录，确保旧数据库能正确过渡
const NAME_MIGRATION = {
  // 最早期的英文名称 → 中文名称
  '青年女性模板':        '珊瑚·青春女',
  '青年男性模板':        '青蓝·青春男',
  '壮年女性模板':        '樱花·轻熟女',
  '壮年男性模板':        '天蓝·轻熟男',
  '中年女性模板':        '紫韵·雅致女',
  '中年男性模板':        '沉稳·雅致男',
  '金色通用模板':        '喜庆·通用',
  '粉色女性模板':        '粉甜·女性',
  '蓝色男性模板':        '蔚蓝·男性',
  '金色通用模板(详细版)': '金辉·通用',
  '生日邀请函模板':      '烟花邀请',
  'mb2':                 '赛博风格',
  'mb3':                 '缤纷派对',
  'mb4':                 '经典邀请函',
  'mb4shotao':           '简约邀请函',
  'mb5lihe':             '礼盒邀请函',
  'mb6yanhua':           '烟花邀请函'
};

/**
 * 从文件名自动生成模板元数据
 * 例如: "my-cool-template.html" → { name: "my-cool-template", description: "自动发现的模板: my-cool-template", match_gender: "all" }
 */
const generateMetaFromFilename = (filename) => {
  const nameWithoutExt = path.basename(filename, '.html');
  return {
    name: nameWithoutExt,
    description: `自动发现的模板: ${nameWithoutExt}`,
    match_gender: 'all'
  };
};

const initDefaultTemplate = async () => {
  let created = 0, updated = 0, skipped = 0, failed = 0;

  // 第一步：构建文件名 → 元数据的映射
  const manifestMap = new Map();
  for (const entry of TEMPLATE_MANIFEST) {
    manifestMap.set(entry.file, entry);
  }

  // 第二步：扫描 src/data/ 目录，发现所有 HTML 文件
  let allHtmlFiles = [];
  try {
    const dirEntries = await fs.readdir(DATA_DIR);
    allHtmlFiles = dirEntries.filter(f => f.endsWith('.html'));
  } catch (err) {
    console.error(`[模板] 无法读取目录 ${DATA_DIR}:`, err.message);
    return;
  }

  if (allHtmlFiles.length === 0) {
    console.log('[模板] src/data/ 目录为空，跳过模板初始化');
    return;
  }

  // 第三步：合并清单 —— 已知模板用清单元数据，新文件自动生成元数据
  const allEntries = [];
  for (const file of allHtmlFiles) {
    if (manifestMap.has(file)) {
      allEntries.push(manifestMap.get(file));
    } else {
      const autoMeta = generateMetaFromFilename(file);
      allEntries.push({ file, ...autoMeta });
      console.log(`[模板] 发现新文件（自动入库）: ${file}`);
    }
  }

  // 第四步：一次性名称迁移（旧名称 → 新名称，保持记录 ID 不变）
  for (const [oldName, newName] of Object.entries(NAME_MIGRATION)) {
    try {
      const oldRecord = await Template.findOne({ where: { name: oldName } });
      if (oldRecord) {
        const newRecord = await Template.findOne({ where: { name: newName } });
        if (!newRecord) {
          await oldRecord.update({ name: newName });
          console.log(`[模板] 名称迁移: ${oldName} → ${newName}`);
        }
      }
    } catch (err) {
      console.warn(`[模板] 名称迁移失败: ${oldName} → ${newName}:`, err.message);
    }
  }

  // 第五步：逐个处理入库（幂等 upsert：按名称查找，有则更新，无则创建）
  for (const entry of allEntries) {
    try {
      const filePath = path.join(DATA_DIR, entry.file);
      const htmlContent = await fs.readFile(filePath, 'utf-8');

      // 按名称查找已有模板
      const existing = await Template.findOne({ where: { name: entry.name } });

      if (existing) {
        // 内容无变化则跳过
        if (existing.html_content === htmlContent) {
          skipped++;
          continue;
        }
        await existing.update({
          html_content: htmlContent,
          // 同时更新描述和匹配规则（以清单为准）
          description: entry.description || existing.description,
          match_gender: entry.match_gender || existing.match_gender,
          match_age_min: entry.match_age_min || null,
          match_age_max: entry.match_age_max || null
        });
        updated++;
        console.log(`[模板] 已更新: ${entry.name}`);
      } else {
        await Template.create({
          name: entry.name,
          description: entry.description || '',
          match_gender: entry.match_gender || 'all',
          match_age_min: entry.match_age_min || null,
          match_age_max: entry.match_age_max || null,
          html_content: htmlContent,
          is_active: true
        });
        created++;
        console.log(`[模板] 已创建: ${entry.name}`);
      }
    } catch (err) {
      failed++;
      console.error(`[模板] ${entry.name} 处理失败:`, err.message);
    }
  }

  console.log(`[模板] 初始化完成 - 新建:${created} 更新:${updated} 跳过:${skipped} 失败:${failed}`);
};

export default initDefaultTemplate;
