const fs = require('fs');
const path = require('path');

const URLS = [
  'https://www.wetest.vip/page/cloudflare/address_v4.html',
  'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const outputFile = path.join(__dirname, '优选IP.txt');

// 保证文件存在
if (!fs.existsSync(outputFile)) {
  fs.writeFileSync(outputFile, '', 'utf8');
}

// 完全按照原代码获取值解析值的正则逻辑提取
function 获取值解析值(html) {
  const 结果列表 = [];
  // 匹配 HTML 页面中的 <tr>...</tr> 结构
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    // 提取 <td> 中的纯文本
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      // 替换掉 html 标签（如 <span> 等），保留纯文本
      const text = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(text);
    }

    // 原代码要求至少 4 列数据 [IP, 端口, 线路, 运营商]
    if (cells.length >= 4) {
      let ip = cells[0];
      let port = cells[1] || '443';
      let line = cells[2] || '';
      let isp = cells[3] || '';

      // 过滤掉表头信息，校验是否为 IP 格式
      const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
      const isIPv6 = ip.includes(':') && /[a-fA-F0-9]/.test(ip);

      if (isIPv4 || isIPv6) {
        if (isIPv6 && !ip.startsWith('[')) {
          ip = `[${ip}]`;
        }
        
        // 按照要求拼装格式：ip:端口#运营商-isp
        结果列表.push({
          key: `${ip}:${port}`,
          formatted: `${ip}:${port}#${isp}-${line}`
        });
      }
    }
  }
  return 结果列表;
}

async function runWorkflow() {
  console.log("工作流开始运行...");

  // 1. 读取现有文件做去重校验
  const existingKeys = new Set();
  const fileContent = fs.readFileSync(outputFile, 'utf8');
  fileContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      const key = trimmed.split('#')[0]; // 提取 IP:端口 部分
      existingKeys.add(key);
    }
  });

  const newEntries = [];

  // 2. 依次 fetch 抓取 v4 和 v6 页面
  for (const url of URLS) {
    try {
      console.log(`正在请求原 HTML 页面: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        console.error(`请求失败 [${url}], 状态码: ${res.status}`);
        continue;
      }

      const html = await res.text();
      const items = 获取值解析值(html);
      console.log(`从 ${url} 提取到 ${items.length} 条 IP`);

      for (const item of items) {
        if (!existingKeys.has(item.key)) {
          existingKeys.add(item.key);
          newEntries.push(item.formatted);
        }
      }
    } catch (err) {
      console.error(`抓取异常 [${url}]:`, err.message);
    }
  }

  // 3. 追加保存至 优选IP.txt
  if (newEntries.length > 0) {
    const currentText = fs.readFileSync(outputFile, 'utf8').trim();
    const prefix = currentText.length > 0 ? '\n' : '';
    fs.appendFileSync(outputFile, prefix + newEntries.join('\n'), 'utf8');
    console.log(`成功追加 ${newEntries.length} 条新 IP！`);
  } else {
    console.log("未发现新的未重复 IP 地址。");
  }
}

runWorkflow();
