import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

/**
 * 性别转换：将中文或各种格式转换为 male/female
 */
const convertGender = (value) => {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  if (v === '男' || v === 'male' || v === 'm') return 'male';
  if (v === '女' || v === 'female' || v === 'f') return 'female';
  return value;
};

/**
 * 解析日期为 YYYY-MM-DD 格式
 */
const parseDate = (value) => {
  if (!value) return null;
  
  // Excel日期数字格式
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return formatDateLocal(date);
  }
  
  // 字符串日期
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return formatDateLocal(date);
  }
  
  return null;
};

/**
 * 将日期格式化为 YYYY-MM-DD（使用本地时区，避免 toISOString 的 UTC 偏移问题）
 * 例如: 1990/1/1 → "1990-01-01"，而不是因 UTC-8 变成 "1989-12-31"
 */
const formatDateLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 解析Excel/CSV文件，返回员工数据数组
 * 支持 UTF-8 和 GBK 编码的 CSV 文件（Windows 中文版 Excel 默认导出 GBK 编码）
 * @param {string} filePath - 文件在磁盘上的实际路径
 * @param {string} [originalName] - 原始文件名（用于检测文件类型，因 multer 临时文件无扩展名）
 */
export const parseEmployeeExcel = (filePath, originalName) => {
  // 优先使用原始文件名判断类型（multer临时文件没有扩展名）
  const nameToCheck = originalName || filePath;
  const ext = path.extname(nameToCheck).toLowerCase();
  let workbook;

  if (ext === '.csv') {
    // CSV 文件：先检测编码，GBK 文件需要用 iconv-lite 解码
    const buffer = fs.readFileSync(filePath);
    const isUtf8 = isValidUtf8(buffer);
    let content = isUtf8
      ? buffer.toString('utf-8')
      : iconv.decode(buffer, 'gbk');
    // 去除 UTF-8 BOM（\uFEFF），避免第一个列名匹配失败
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    console.log(`[导入] CSV编码检测: ${isUtf8 ? 'UTF-8' : 'GBK/GB2312'}, 去BOM: ${content.charCodeAt(0) !== 0xFEFF}`);
    workbook = xlsx.read(content, { type: 'string' });
  } else {
    // Excel 文件：xlsx/xls 内置编码处理
    workbook = xlsx.readFile(filePath);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  return data.map(row => ({
    name: row['姓名'] || row['name'],
    gender: convertGender(row['性别'] || row['gender']),
    birthday: parseDate(row['生日'] || row['birthday']),
    phone: String(row['手机号'] || row['phone'] || '').trim(),
    department: row['部门'] || row['department'] || '',
    position: row['职位'] || row['position'] || ''
  }));
};

/**
 * 检测 buffer 是否为合法 UTF-8 编码
 * 如果包含非法 UTF-8 字节序列，则判定为 GBK
 */
const isValidUtf8 = (buffer) => {
  try {
    const decoded = Buffer.from(buffer.toString('utf-8'));
    // 检查是否有替换字符（U+FFFD），表示解码失败
    return !decoded.toString('utf-8').includes('\uFFFD');
  } catch {
    return false;
  }
};

/**
 * 验证员工数据格式
 */
export const validateEmployee = (emp) => {
  const errors = [];
  
  if (!emp.name) errors.push('姓名不能为空');
  if (!emp.gender) errors.push('性别不能为空');
  if (!emp.birthday) errors.push('生日不能为空');
  if (!emp.phone || emp.phone.length < 11) errors.push('手机号格式不正确');
  
  return errors;
};