/**
 * 心跳追踪服务
 * 
 * 通过写入/读取 JSON 文件来追踪各服务的运行状态。
 * 监控服务通过检查心跳时间戳判断发送服务是否存活。
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 心跳文件目录：server/heartbeats/
const heartbeatsDir = path.join(__dirname, '..', '..', 'heartbeats');

/**
 * 确保心跳目录存在
 */
const ensureDir = async () => {
  await fs.mkdir(heartbeatsDir, { recursive: true });
};

/**
 * 写入心跳时间戳到指定文件
 * @param {string} filename - 心跳文件名（如 'sender.json'）
 */
const writeHeartbeat = async (filename) => {
  await ensureDir();
  const filePath = path.join(heartbeatsDir, filename);
  const data = { last_beat: new Date().toISOString() };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

/**
 * 读取心跳文件，返回时间戳
 * @param {string} filename - 心跳文件名
 * @returns {Promise<string|null>} ISO 时间戳，文件不存在则返回 null
 */
const readHeartbeat = async (filename) => {
  try {
    const filePath = path.join(heartbeatsDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.last_beat || null;
  } catch {
    return null;
  }
};

// ========== 发送服务心跳 ==========

/**
 * 初始化发送服务心跳（启动时调用，仅在心跳文件不存在时写入）
 * 避免服务首次启动时因无心跳文件而显示为 unhealthy
 */
export const initSenderHeartbeat = async () => {
  const existing = await readHeartbeat('sender.json');
  if (!existing) {
    await writeHeartbeat('sender.json');
    console.log('[心跳] 发送服务初始心跳已写入');
  }
};

/**
 * 更新发送服务心跳（每次成功执行发送任务后调用）
 */
export const updateSenderHeartbeat = async () => {
  await writeHeartbeat('sender.json');
  console.log('[心跳] 发送服务心跳已更新');
};

/**
 * 获取发送服务的最后心跳时间
 * @returns {Promise<string|null>} ISO 时间戳
 */
export const getSenderHeartbeat = async () => {
  return await readHeartbeat('sender.json');
};

// ========== 监控服务心跳 ==========

/**
 * 更新监控服务心跳
 */
export const updateMonitorHeartbeat = async () => {
  await writeHeartbeat('monitor.json');
};

/**
 * 获取监控服务的最后心跳时间
 * @returns {Promise<string|null>} ISO 时间戳
 */
export const getMonitorHeartbeat = async () => {
  return await readHeartbeat('monitor.json');
};
