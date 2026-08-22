const fs = require('fs');
const path = require('path');

const URLS = [
  'https://www.wetest.vip/page/cloudflare/address_v4.html',
  'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const OUTPUT_FILE = path.join(__dirname, '优选IP.txt');

// 1. 初始化，确保文件必然存在（防止后续 git add 报错）
if (!fs.existsSync(OUTPUT_FILE)) {
  fs.writeFileSync(OUTPUT_FILE, '', 'utf-8');
}

// 2. 正则解析 HTML 中的表格，提取 IP、端口、线路和运营商
function parseHTML(html) {
  const results = [];
  const rowRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    let ip = match[1].replace(/<[^>]+>/g, '').trim();
    let port = match[2].replace(/<[^>]+>/g, '').trim() || '443';
    let line = match[3].replace(/<[^>]+>/g, '').trim(); // 线路/机房
    let isp = match[4].replace(/<[^>]+>/g, '').trim();  // 运营商（移动/联通/电信）

    if (ip) {
      // 如果是 IPv6 且未包含中括号，自动包裹 []
      if (ip.includes(':') && !ip.startsWith('[')) {
        ip = `[${ip}]`;
      }
      results.push({
        key: `${ip}:${port}`, // 去重用的唯一标志
        lineStr: `${ip}:${port}#${isp}-${line}`
      });
    }
  }
  return results;
}

async function main() {
  // 3. 读取现有文件中的记录建立 Set 去重
  const existingKeys = new Set();
  const fileContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
  fileContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      const key = trimmed.split('#')[0];
      existingKeys.add(key);
    }
  });

  const newEntries = [];

  // 4. 遍历抓取两个网页
  for (const url of URLS) {
    try {
      console.log(`正在抓取: ${url}`);
      const res = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        }
      });
      if (!res.ok) {
        console.error(`请求响应错误: ${res.status}`);
        continue;
      }
      
      const html = await res.text();
      const parsed = parseHTML(html);

      parsed.forEach(item => {
        if (!existingKeys.has(item.key)) {
          existingKeys.add(item.key);
          newEntries.push(item.lineStr);
        }
      });
    } catch (err) {
      console.error(`抓取失败 [${url}]:`, err.message);
    }
  }

  // 5. 追加写入新节点数据
  if (newEntries.length > 0) {
    const prefix = fs.readFileSync(OUTPUT_FILE, 'utf-8').trim().length > 0 ? '\n' : '';
    fs.appendFileSync(OUTPUT_FILE, prefix + newEntries.join('\n'), 'utf-8');
    console.log(`成功追加 ${newEntries.length} 条全新 IP 数据！`);
  } else {
    console.log('未发现新的未重复 IP 地址。');
  }
}

main();
