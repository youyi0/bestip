const fs = require('fs');
const path = require('path');

//wetest.vip 的底层 JSON API 接口
const API_URLS = [
  'https://www.wetest.vip/api/cloudflare/address_v4',
  'https://www.wetest.vip/api/cloudflare/address_v6'
];

// 如果 API 路径有变化，亦可兼容常规页面数据提取
const PAGE_URLS = [
  'https://www.wetest.vip/page/cloudflare/address_v4.html',
  'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const outputFile = path.join(__dirname, '优选IP.txt');

// 确保输出文件存在
if (!fs.existsSync(outputFile)) {
  fs.writeFileSync(outputFile, '', 'utf8');
}

async function fetchFromApi(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
}

async function runWorkflow() {
  console.log("工作流开始运行...");

  // 1. 读取已存在的 IP 列表，用于去重
  const existingKeys = new Set();
  const fileContent = fs.readFileSync(outputFile, 'utf8');
  fileContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      const key = trimmed.split('#')[0]; // 取 IP:端口 部分
      existingKeys.add(key);
    }
  });

  const newEntries = [];

  // 2. 尝试从 API 接口直接获取数据
  for (const url of API_URLS) {
    console.log(`正在请求 API: ${url}`);
    const resData = await fetchFromApi(url);

    if (resData && (Array.isArray(resData) || Array.isArray(resData.data))) {
      const list = Array.isArray(resData) ? resData : resData.data;
      
      for (const item of list) {
        let ip = item.ip || item.address;
        let port = item.port || '443';
        let line = item.line || item.datacenter || '未知';
        let isp = item.isp || item.operator || '通用';

        if (ip) {
          if (ip.includes(':') && !ip.startsWith('[')) {
            ip = `[${ip}]`;
          }
          const key = `${ip}:${port}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            newEntries.push(`${ip}:${port}#${isp}-${line}`);
          }
        }
      }
    }
  }

  // 3. 追加写入文件
  if (newEntries.length > 0) {
    const currentText = fs.readFileSync(outputFile, 'utf8').trim();
    const prefix = currentText.length > 0 ? '\n' : '';
    fs.appendFileSync(outputFile, prefix + newEntries.join('\n'), 'utf8');
    console.log(`成功追加 ${newEntries.length} 条全新 IP！`);
  } else {
    console.log("未发现新的未重复 IP 地址。");
  }
}

runWorkflow();
