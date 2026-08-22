const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const URLS = [
  'https://www.wetest.vip/page/cloudflare/address_v4.html',
  'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const outputFile = path.join(__dirname, '优选IP.txt');

// 1. 初始化，保证文件存在
if (!fs.existsSync(outputFile)) {
  fs.writeFileSync(outputFile, '', 'utf8');
}

async function runWorkflow() {
  console.log("工作流开始运行...");

  // 2. 读取现有文件构建去重集合
  const existingKeys = new Set();
  const fileContent = fs.readFileSync(outputFile, 'utf8');
  fileContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      const key = trimmed.split('#')[0]; // 取 IP:PORT 部分
      existingKeys.add(key);
    }
  });

  const newEntries = [];

  // 3. 抓取与解析页面
  for (const url of URLS) {
    try {
      console.log(`正在请求页面: ${url}`);
      
      // 模拟标准浏览器请求头
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const rows = $('table tbody tr');

      console.log(`在 ${url} 中查找到 ${rows.length} 行表格记录`);

      rows.each((index, element) => {
        const tds = $(element).find('td');
        if (tds.length >= 6) {
          const isp = $(tds[0]).text().trim() || '通用';          // 第1列：线路名称 (如 移动/联通/电信)
          let ip = $(tds[1]).text().trim();                    // 第2列：优选地址 (IP)
          const line = $(tds[5]).text().trim() || '未知';      // 第6列：数据中心 (如 HKG/LAX)
          const port = '443';                                  // 默认端口

          if (ip) {
            // IPv6 加上 []
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
      });

    } catch (err) {
      console.error(`抓取 [${url}] 出错:`, err.message);
    }
  }

  // 4. 追加保存
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
