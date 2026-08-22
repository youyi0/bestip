const fs = require('fs');
const path = require('path');

const URLS = [
  'https://www.wetest.vip/page/cloudflare/address_v4.html',
  'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const OUTPUT_FILE = path.join(__dirname, '优选IP.txt');

// 匹配 HTML 表格内容的正则（IP, 端口, 线路, 运营商）
function parseHTML(html) {
  const results = [];
  // 匹配 <tr> 内包含的 <td> 节点内容
  const rowRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    let ip = match[1].replace(/<[^>]+>/g, '').trim();
    let port = match[2].replace(/<[^>]+>/g, '').trim() || '443';
    let line = match[3].replace(/<[^>]+>/g, '').trim(); // 线路/数据中心
    let isp = match[4].replace(/<[^>]+>/g, '').trim();  // 运营商（移动/联通/电信）

    if (ip) {
      // IPv6 加上中括号处理
      if (ip.includes(':') && !ip.startsWith('[')) {
        ip = `[${ip}]`;
      }
      results.push({
        key: `${ip}:${port}`, // 用于去重校验的唯一标识
        lineStr: `${ip}:${port}#${isp}-${line}`
      });
    }
  }
  return results;
}

async function main() {
  // 1. 读取已存在的 txt 文件，建立去重 Set
  const existingKeys = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    const fileContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    fileContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        const key = trimmed.split('#')[0]; // 获取 IP:端口 部分
        existingKeys.add(key);
      }
    });
  }

  const newEntries = [];

  // 2. 抓取网页并解析
  for (const url of URLS) {
    try {
      console.log(`正在抓取: ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!res.ok) continue;
      
      const html = await res.text();
      const parsed = parseHTML(html);

      parsed.forEach(item => {
        // 去重判断
        if (!existingKeys.has(item.key)) {
          existingKeys.add(item.key);
          newEntries.push(item.lineStr);
        }
      });
    } catch (err) {
      console.error(`请求失败 [${url}]:`, err.message);
    }
  }

  // 3. 追加写入文件
  if (newEntries.length > 0) {
    const appendContent = (fs.existsSync(OUTPUT_FILE) && fs.readFileSync(OUTPUT_FILE, 'utf-8').length > 0 ? '\n' : '') + newEntries.join('\n');
    fs.appendFileSync(OUTPUT_FILE, appendContent, 'utf-8');
    console.log(`成功追加 ${newEntries.length} 条全新优选 IP！`);
  } else {
    console.log('未发现新的未重复 IP 地址。');
  }
}

main();
