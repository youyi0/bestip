const fs = require('fs');
const path = require('path');

const urls = [
    'https://www.wetest.vip/page/cloudflare/address_v4.html',
    'https://www.wetest.vip/page/cloudflare/address_v6.html'
];

const outputFile = path.join(__dirname, '优选IP.txt');

// 确保输出文件存在
if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, '', 'utf8');
}

// 简单的 DOM 表格解析器（替换 cheerio，无需 npm i）
function parseTableHTML(html) {
    const list = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

    while ((trMatch = trRegex.exec(html)) !== null) {
        const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells = [];
        let tdMatch;

        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
            const text = tdMatch[1].replace(/<[^>]+>/g, '').trim();
            cells.push(text);
        }

        // 提取 [IP, 端口, 线路, 运营商]
        if (cells.length >= 4) {
            let ip = cells[0];
            let port = cells[1] || '443';
            let line = cells[2] || '';
            let isp = cells[3] || '';

            // 过滤表头，仅匹配合法 IP
            const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
            const isIPv6 = ip.includes(':') && /[a-fA-F0-9]/.test(ip);

            if (isIPv4 || isIPv6) {
                if (isIPv6 && !ip.startsWith('[')) {
                    ip = `[${ip}]`;
                }
                list.push({
                    key: `${ip}:${port}`,
                    formatted: `${ip}:${port}#${isp}-${line}`
                });
            }
        }
    }
    return list;
}

async function runWorkflow() {
    try {
        console.log("工作流开始运行...");

        // 读取已存在的 IP 列表（根据 ip:port 进行去重）
        const existingKeys = new Set();
        if (fs.existsSync(outputFile)) {
            const content = fs.readFileSync(outputFile, 'utf8');
            const lines = content.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line) {
                    const key = line.split('#')[0];
                    existingKeys.add(key);
                }
            }
        }

        const newEntries = [];

        // 抓取并解析数据
        for (const url of urls) {
            console.log(`Fetching: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`请求失败: ${response.status}`);
                continue;
            }

            const html = await response.text();
            const items = parseTableHTML(html);

            for (const item of items) {
                if (!existingKeys.has(item.key)) {
                    existingKeys.add(item.key);
                    newEntries.push(item.formatted);
                }
            }
        }

        // 追加到 优选IP.txt
        if (newEntries.length > 0) {
            const fileData = fs.readFileSync(outputFile, 'utf8').trim();
            const prefix = fileData.length > 0 ? '\n' : '';
            fs.appendFileSync(outputFile, prefix + newEntries.join('\n'), 'utf8');
            console.log(`成功追加 ${newEntries.length} 条全新 IP！`);
        } else {
            console.log("未发现新的未重复 IP 地址。");
        }

    } catch (error) {
        console.error("运行出错:", error);
    }
}

// 执行主程序
runWorkflow();
