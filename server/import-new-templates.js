import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { sequelize } from './src/config/database.js';
import Template from './src/models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 5 个新模板目录
const TEMPLATE_DIRS = [
  'birthday-card-13-employee-warm-image',
  'birthday-card-14-executive-night-image',
  'birthday-card-15-executive-private-banquet',
  'birthday-card-16-executive-honor-gallery',
  'birthday-card-17-executive-time-archive'
];

const BASE_DIR = path.join(__dirname, 'src', 'data');

/**
 * 将模板目录转换为 standalone HTML
 * - 内联 CSS
 * - 内联 JS
 * - 图片转 base64
 */
async function convertToStandalone(templateDir) {
  const dirPath = path.join(BASE_DIR, templateDir);
  const indexPath = path.join(dirPath, 'index.html');
  const cssPath = path.join(dirPath, 'style.css');
  const jsPath = path.join(dirPath, 'script.js');

  // 读取文件
  let html = await fs.readFile(indexPath, 'utf-8');
  const css = await fs.readFile(cssPath, 'utf-8');
  const js = await fs.readFile(jsPath, 'utf-8');

  // 内联 CSS
  html = html.replace(
    /<link[^>]*href=["']style\.css["'][^>]*>/,
    `<style>\n${css}\n</style>`
  );

  // 内联 JS
  html = html.replace(
    /<script[^>]*src=["']script\.js["'][^>]*><\/script>/,
    `<script>\n${js}\n</script>`
  );

  // 转换图片为 base64
  const imgRegex = /src=["'](assets\/[^"']+)["']/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const imgPath = path.join(dirPath, match[1]);
    try {
      const imgData = await fs.readFile(imgPath);
      const ext = path.extname(imgPath).toLowerCase();
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      const mimeType = mimeTypes[ext] || 'image/png';
      const base64 = imgData.toString('base64');
      html = html.replace(match[0], `src="data:${mimeType};base64,${base64}"`);
    } catch (err) {
      console.warn(`   无法读取图片: ${imgPath}`);
    }
  }

  // 音乐文件不内联为 base64，保留 {{music_url}} 占位符和 ../music/music.mp3 路径
  // cardGenerator.js 会在生成贺卡时替换为 /music/music.mp3（由静态路由提供服务）
  console.log(`   ✓ 保留音乐占位符（由贺卡生成服务替换）`);

  return html;
}

/**
 * 复制模板封面图到静态目录，返回可访问的URL路径
 */
async function copyCoverImage(templateDir, templateId) {
  const coverPath = path.join(BASE_DIR, templateDir, 'assets', 'generated', '01-cover-bg.png');
  const previewDir = path.join(__dirname, 'uploads', 'template-previews');
  try {
    await fs.mkdir(previewDir, { recursive: true });
    const destPath = path.join(previewDir, `template-${templateId}-cover.png`);
    await fs.copyFile(coverPath, destPath);
    return `/template-previews/template-${templateId}-cover.png`;
  } catch {
    console.warn(`   无法复制封面图: ${coverPath}`);
    return null;
  }
}

/**
 * 从目录名推断模板元数据
 */
function inferMetadata(dirName) {
  const metadata = {
    'birthday-card-13-employee-warm-image': {
      name: '温馨员工版',
      description: '温暖色调的员工生日贺卡',
      employee_level: 'employee',
      match_gender: 'all',
      page_count: 4
    },
    'birthday-card-14-executive-night-image': {
      name: '夜景高管版',
      description: '夜景风格的高管生日贺卡',
      employee_level: 'management',
      match_gender: 'all',
      page_count: 4
    },
    'birthday-card-15-executive-private-banquet': {
      name: '私宴高管版',
      description: '私宴风格的高管生日贺卡',
      employee_level: 'management',
      match_gender: 'all',
      page_count: 7
    },
    'birthday-card-16-executive-honor-gallery': {
      name: '荣誉画廊高管版',
      description: '荣誉画廊风格的高管生日贺卡',
      employee_level: 'management',
      match_gender: 'all',
      page_count: 7
    },
    'birthday-card-17-executive-time-archive': {
      name: '时光档案高管版',
      description: '时光档案风格的高管生日贺卡',
      employee_level: 'management',
      match_gender: 'all',
      page_count: 7
    }
  };

  return metadata[dirName] || {
    name: dirName,
    description: '贺卡模板',
    employee_level: 'all',
    match_gender: 'all',
    page_count: 4
  };
}

async function main() {
  console.log('=== 模板导入脚本 ===\n');

  try {
    // 1. 清空现有模板（先解除发送记录的外键引用，再删除模板）
    console.log('1. 清空现有模板...');
    await sequelize.query('UPDATE send_records SET template_id = NULL WHERE template_id IS NOT NULL');
    await Template.destroy({ where: {} });
    console.log('   ✓ 已清空\n');

    // 2. 导入新模板
    console.log('2. 导入新模板...');
    for (const dirName of TEMPLATE_DIRS) {
      console.log(`   处理: ${dirName}`);

      const htmlContent = await convertToStandalone(dirName);
      const metadata = inferMetadata(dirName);

      const template = await Template.create({
        name: metadata.name,
        description: metadata.description,
        employee_level: metadata.employee_level,
        match_gender: metadata.match_gender,
        page_count: metadata.page_count,
        html_content: htmlContent,
        is_active: true
      });

      // 复制封面图到静态目录
      const previewUrl = await copyCoverImage(dirName, template.id);
      if (previewUrl) {
        await template.update({ preview_image: previewUrl });
      }

      console.log(`   ✓ ${metadata.name} (${(htmlContent.length / 1024).toFixed(1)} KB, 封面图: ${previewUrl ? '有' : '无'})\n`);
    }

    // 3. 统计
    const count = await Template.count();
    console.log(`3. 完成！共导入 ${count} 个模板\n`);

    // 4. 提示
    console.log('注意: server/src/data/ 中的旧模板文件仍会在服务器重启时被自动导入');
    console.log('如需永久删除旧模板，请手动删除 server/src/data/ 目录中的 HTML 文件');

  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  }

  await sequelize.close();
}

main();
