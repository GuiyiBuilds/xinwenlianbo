// 入口：node index.js [YYYYMMDD]
// 产物：news/{date}.md + news/catalogue.json + README.md 目录行（三产物幂等）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getText } from './lib/http.js';
import { parseDayList, parseAbstract, parseNewsPage } from './lib/crawl.js';
import { renderMarkdown, prependCatalogue, insertReadmeLine } from './lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argDate = process.argv[2];
if (argDate && !/^\d{8}$/.test(argDate)) {
	console.error(`日期参数格式应为 YYYYMMDD，收到: ${argDate}`);
	process.exit(1);
}
const pad = n => String(n).padStart(2, '0');
const date = argDate ?? (() => {
	const d = new Date();
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
})();

const NEWS_DIR = path.join(__dirname, 'news');
const mdPath = path.join(NEWS_DIR, `${date}.md`);
const cataloguePath = path.join(NEWS_DIR, 'catalogue.json');
const readmePath = path.join(__dirname, 'README.md');
const listUrl = `https://tv.cctv.com/lm/xwlb/day/${date}.shtml`;

// 幂等门禁：当天已归档则直接跳过（定时任务重跑零写入）
if (fs.existsSync(mdPath)) {
	console.log(`SKIP ${date} 已存在 ${path.basename(mdPath)}，无需更新`);
	process.exit(0);
}

// 列表页缺失（未播出/节假日）→ 干净退出，不挂红定时任务
let html;
try {
	html = await getText(listUrl);
} catch (err) {
	console.log(`MISS ${date} 列表页不可达（${err.message}），按无节目处理`);
	process.exit(0);
}
let links;
try {
	links = parseDayList(html, listUrl);
} catch {
	console.log(`MISS ${date} 列表页无节目链接（可能未播出），按无节目处理`);
	process.exit(0);
}
console.log(`LIST ${date}: 摘要页 + ${links.itemUrls.length} 条新闻`);

let abstract;
try {
	abstract = parseAbstract(await getText(links.abstractUrl));
} catch (err) {
	// 完整版页面骨架先上线、摘要后填充：空摘要 = 当日内容未上齐，干净退出留给下次重跑
	if (/abstract text is empty/.test(err.message)) {
		console.log(`NOT_READY ${date} 完整版摘要尚未上架（央视页面半更新），稍后自动重跑`);
		process.exit(0);
	}
	throw err; // 选择器失配 → loud fail，带堆栈定位页面漂移
}

const items = [];
for (const url of links.itemUrls) {
	try {
		const { title, content } = parseNewsPage(await getText(url));
		if (title && content) items.push({ title, content, link: url });
	} catch (err) {
		console.warn(`WARN 单条新闻解析失败: ${url} (${err.message})`);
	}
}
if (items.length === 0) {
	console.error(`FAIL ${date} 无任何可解析的新闻条目（页面结构可能已变化）`);
	process.exit(1);
}

fs.writeFileSync(mdPath, renderMarkdown({ date, abstract, items, now: Date.now() }));
console.log(`WROTE ${path.relative(__dirname, mdPath)}（${items.length} 条）`);

const catalogueJson = fs.existsSync(cataloguePath) ? fs.readFileSync(cataloguePath, 'utf8') : '[]';
const newCatalogue = prependCatalogue(catalogueJson, { date, abstract });
if (newCatalogue !== catalogueJson) {
	fs.writeFileSync(cataloguePath, newCatalogue);
	console.log('WROTE news/catalogue.json');
}

const readme = fs.readFileSync(readmePath, 'utf8');
const newReadme = insertReadmeLine(readme, date);
if (newReadme !== readme) {
	fs.writeFileSync(readmePath, newReadme);
	console.log('WROTE README.md 目录');
}

console.log(`DONE ${date}`);
