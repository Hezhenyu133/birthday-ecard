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
  // ── 4页全屏翻页贺卡模板 ──
  {
    file: '蛋糕.html',
    name: '蛋糕',
    description: '蛋糕主题贺卡，含蜡烛动画与许愿互动，温馨浪漫风格',
    match_gender: 'all'
  },
  {
    file: '粉色.html',
    name: '粉色',
    description: '粉色浪漫主题贺卡，含玫瑰花瓣飘落与蛋糕动画，适合女性员工',
    match_gender: 'female'
  },
  {
    file: '礼盒.html',
    name: '礼盒',
    description: '礼盒惊喜主题贺卡，含礼盒打开动画与彩带特效，喜庆大方',
    match_gender: 'all'
  },
  {
    file: '派对.html',
    name: '派对',
    description: '生日派对主题贺卡，含气球海洋与庆祝彩带动画，活泼欢快',
    match_gender: 'all'
  },
  {
    file: '星光.html',
    name: '星光',
    description: '星光璀璨主题贺卡，含大星星闪烁与夜空动画，简约温馨',
    match_gender: 'all'
  },
  {
    file: '红礼盒.html',
    name: '红礼盒',
    description: '红金喜庆礼盒主题贺卡，中国风浓郁，适合重要节日与长辈',
    match_gender: 'all'
  },
  {
    file: '寿桃.html',
    name: '寿桃',
    description: '寿桃祝寿主题贺卡，传统中式寿宴风格，适合年长员工',
    match_gender: 'all'
  },
  {
    file: '烟花.html',
    name: '烟花',
    description: '烟花绚烂主题贺卡，含全屏烟花绽放动画，华丽喜庆',
    match_gender: 'all'
  },
  {
    file: '通用1.html',
    name: '通用1',
    description: '简约通用贺卡（风格一），清新淡雅，含蛋糕与祝福文字',
    match_gender: 'all'
  },
  {
    file: '通用2.html',
    name: '通用2',
    description: '华丽通用贺卡（风格二），金色装饰与烟花背景，高端大气',
    match_gender: 'all'
  },
  {
    file: '通用3.html',
    name: '通用3',
    description: '高级质感贺卡（风格三），暗色调+金色点缀，含粒子特效与自动翻页，内嵌实景照片与背景音乐',
    match_gender: 'all'
  }
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
