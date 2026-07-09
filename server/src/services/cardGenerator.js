// 贺卡生成服务
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 格式化生日为中文日期字符串
 * 将 "1990-06-15" 格式的日期转为 "6月15日"
 * @param {string} dateStr - DATEONLY 格式日期字符串 (YYYY-MM-DD)
 * @returns {string} 中文格式的月日
 */
const formatBirthday = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch {
    return dateStr; // 解析失败时返回原始字符串
  }
};

/**
 * 根据模板和员工信息生成个性化贺卡
 * @param {object} template - 模板对象
 * @param {object} employee - 员工对象
 * @param {object} options - 可选参数
 * @param {string} options.videoPath - 视频文件路径（可选，如果提供则嵌入视频播放器）
 */
export const generateCard = async (template, employee, options = {}) => {
  try {
    const { videoPath = null } = options;
    
    // 读取模板HTML内容
    let html = template.html_content;
    
    // 生成祝福语（简化版本，实际可更复杂）
    const blessing = template.default_blessing?.content || [
      `生日快乐！愿你永远开心如意！`,
      `祝你生日快乐，身体健康，工作顺利！`,
      `愿你的每一天都充满阳光和欢笑！`,
      `生日快乐！愿你心想事成，万事如意！`
    ][Math.floor(Math.random() * 4)];

    // 当前日期信息
    const now = new Date();

    // 条件性生成部门/职位行：空值时不显示
    const dept = employee.department || '';
    const pos = employee.position || '';
    let deptBlock = '';
    if (dept || pos) {
      const deptText = dept && pos ? `${dept} · ${pos}` : dept || pos;
      deptBlock = `<div class="info-dept anim-item anim-d3">${deptText}</div>`;
    }

    // 替换占位符
    const senderName = config.senderName || '公司工会';
    const companyName = config.companyName || senderName;
    const logoUrl = config.logoUrl || '';
    const musicUrl = '/music/music.mp3'; // 背景音乐URL
    
    const replacements = {
      '{{name}}': employee.name,
      '{{deptBlock}}': deptBlock,
      '{{department}}': dept,
      '{{position}}': pos,
      '{{birthday}}': formatBirthday(employee.birthday),
      '{{sender}}': senderName,
      '{{company}}': companyName,
      '{{logo_url}}': logoUrl,
      '{{blessing}}': blessing,
      '{{title}}': `${employee.name}的生日贺卡`,
      '{{year}}': now.getFullYear().toString(),
      '{{month}}': (now.getMonth() + 1).toString(),
      '{{day}}': now.getDate().toString(),
      '{{music_url}}': musicUrl
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replaceAll(placeholder, value);
    }

    // 替换相对音乐路径为绝对路径（贺卡从 /card/{id} 提供服务，相对路径无法解析）
    html = html.replaceAll('../music/music.mp3', musicUrl);

    // 替换 base64 内联音乐为服务器 URL（兼容旧版导入脚本内联的 base64 数据）
    html = html.replace(/data:audio\/mpeg;base64,[A-Za-z0-9+/=]+/g, musicUrl);

    // 替换 logo 相对路径为内联 data URI（避免 HTTP 请求延迟，确保第一屏就显示 logo）
    const logoDataUri = await (async () => {
      try {
        const logoPath = path.join(__dirname, '..', 'data', 'logo.svg');
        const logoData = await fs.readFile(logoPath);
        return `data:image/svg+xml;base64,${logoData.toString('base64')}`;
      } catch {
        return '/logo/logo.svg';
      }
    })();
    html = html.replaceAll('../logo.svg', logoDataUri);

    // 后处理：移除仅含分隔符"·"的空部门/职位行（兼容未使用 deptBlock 占位符的模板）
    html = html.replace(/<div\s[^>]*>\s*·\s*<\/div>/g, '');

    // 如果有视频，嵌入视频播放器
    if (videoPath) {
      const videoUrl = `${config.baseUrl}/videos/${path.basename(videoPath)}`;
      const videoPlayerHtml = `
        <div id="video-player" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;transition:opacity 0.8s ease;flex-direction:column;">
          <video id="birthday-video" playsinline style="max-width:100%;max-height:100%;object-fit:contain;">
            <source src="${videoUrl}" type="video/mp4">
            您的浏览器不支持视频播放
          </video>
          <div id="play-overlay" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;background:rgba(255,255,255,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity 0.3s;">
            <div style="width:0;height:0;border-top:20px solid transparent;border-bottom:20px solid transparent;border-left:32px solid #fff;margin-left:6px;"></div>
          </div>
          <button id="close-video" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;z-index:10000;">×</button>
        </div>
        <script>
          (function() {
            var player = document.getElementById('video-player');
            var video = document.getElementById('birthday-video');
            var closeBtn = document.getElementById('close-video');
            var playOverlay = document.getElementById('play-overlay');

            function hidePlayer() {
              video.pause();
              player.style.opacity = '0';
              setTimeout(function() { player.style.display = 'none'; }, 800);
            }

            function tryPlay() {
              var p = video.play();
              if (p !== undefined) {
                p.then(function() {
                  playOverlay.style.display = 'none';
                }).catch(function() {
                  playOverlay.style.display = 'flex';
                });
              }
            }

            playOverlay.addEventListener('click', function(e) {
              e.stopPropagation();
              tryPlay();
            });

            video.addEventListener('click', function() {
              if (video.paused) { tryPlay(); } else { video.pause(); playOverlay.style.display = 'flex'; }
            });

            closeBtn.addEventListener('click', hidePlayer);
            video.addEventListener('ended', hidePlayer);
            video.addEventListener('error', function() { setTimeout(hidePlayer, 2000); });

            tryPlay();
          })();
        </script>
      `;
      // 在 </body> 前插入视频播放器
      html = html.replace('</body>', `${videoPlayerHtml}\n</body>`);
    }

    // 生成唯一ID
    const cardId = uuidv4();
    
    // 保存HTML文件
    const filePath = path.join(config.cardsDir, `${cardId}.html`);
    await fs.writeFile(filePath, html, 'utf-8');
    
    return {
      cardId,
      cardUrl: `${config.baseUrl}/card/${cardId}`
    };
  } catch (error) {
    console.error('贺卡生成失败:', error);
    throw error;
  }
};
