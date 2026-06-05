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
const TEMPLATE_MANIFEST = [
  // ── 简约版（按年龄段 + 性别） ──
  {
    file: 'shanhu-female.html',
    name: '珊瑚·青春女',
    description: '珊瑚粉橘风格，适合18-30岁女性员工',
    match_gender: 'female',
    match_age_min: 18,
    match_age_max: 30
  },
  {
    file: 'qinglan-male.html',
    name: '青蓝·青春男',
    description: '青蓝科技风格，适合18-30岁男性员工',
    match_gender: 'male',
    match_age_min: 18,
    match_age_max: 30
  },
  {
    file: 'yinghua-female.html',
    name: '樱花·轻熟女',
    description: '粉红浪漫风格，适合31-45岁女性员工',
    match_gender: 'female',
    match_age_min: 31,
    match_age_max: 45
  },
  {
    file: 'tianlan-male.html',
    name: '天蓝·轻熟男',
    description: '天蓝清新风格，适合31-45岁男性员工',
    match_gender: 'male',
    match_age_min: 31,
    match_age_max: 45
  },
  {
    file: 'ziyun-female.html',
    name: '紫韵·雅致女',
    description: '紫色优雅风格，适合46-65岁女性员工',
    match_gender: 'female',
    match_age_min: 46,
    match_age_max: 65
  },
  {
    file: 'chenwen-male.html',
    name: '沉稳·雅致男',
    description: '深蓝沉稳风格，适合46-65岁男性员工',
    match_gender: 'male',
    match_age_min: 46,
    match_age_max: 65
  },
  {
    file: 'xiqing.html',
    name: '喜庆·通用',
    description: '金色喜庆风格，适合所有员工（兜底模板）',
    match_gender: 'all'
  },
  // ── 蛋糕版（含 SVG 蛋糕 + 蜡烛字母动画） ──
  {
    file: 'fense-female.html',
    name: '粉甜·女性',
    description: '粉色浪漫蛋糕风格，适合女性员工',
    match_gender: 'female'
  },
  {
    file: 'lanse-male.html',
    name: '蔚蓝·男性',
    description: '蓝色简洁蛋糕风格，适合男性员工',
    match_gender: 'male'
  },
  {
    file: 'jinhui.html',
    name: '金辉·通用',
    description: '金色精致蛋糕风格，包含部门职位信息，适合所有员工',
    match_gender: 'all'
  },
  // ── 邀请函 ──
  {
    file: 'yaoqing.html',
    name: '烟花邀请',
    description: '烟花动画风格的生日邀请函（不含占位符）',
    match_gender: 'all'
  }
];

// 旧名称 → 新名称的映射（一次性数据库迁移，保持记录 ID 不变）
const NAME_MIGRATION = {
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
  '生日邀请函模板':      '烟花邀请'
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
