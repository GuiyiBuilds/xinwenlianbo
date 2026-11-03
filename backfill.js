// 历史补档：node backfill.js YYYYMMDD YYYYMMDD [并发数，默认 3]
// 幂等：已有 news/{date}.md 的日期直接跳过；失败日期末尾汇总，不中断整体
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getText } from './lib/http.js';
import { parseDayList, parseAbstract, parseNewsPage } from './lib/crawl.js';
import { renderMarkdown, prependCatalogue, insertReadmeLine } from './lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_DIR = path.join(__dirname, 'news');
const cataloguePath = path.join(NEWS_DIR, 'catalogue.json');
const readmePath = path.join(__dirname, 'README.md');

const [startRaw, endRaw, concRaw] = process.argv.slice(2);
const isDate = s => /^\d{8}$/.test(s);
if (!isDate(startRaw) || !isDate(endRaw) || startRaw > endRaw) {
	console.error('用法: node backfill.js 起始YYYYMMDD 结束YYYYMMDD [并发数]');
	process.exit(1);
}
const CONCURRENCY = Math.max(1, Math.min(8, Number(concRaw) || 3));

const dateList = [];
{
	const s = Number(startRaw), e = Number(endRaw);
	let d = new Date(`${startRaw.slice(0, 4)}-${startRaw.slice(4, 6)}-${startRaw.slice(6, 8)}T12:00:00Z`);
	const end = new Date(`${endRaw.slice(0, 4)}-${endRaw.slice(4, 6)}-${endRaw.slice(6, 8)}T12:00:00Z`);
	while (d <= end) {
		const key = Number(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
		if (key >= s && key <= e) dateList.push(String(key));
		d.setUTCDate(d.getUTCDate() + 1);
	}
}

const failed = [];
let done = 0;
const total = dateList.length;
const startedAt = Date.now();

async function crawlDay(date) {
	const mdPath = path.join(NEWS_DIR, `${date}.md`);
	if (fs.existsSync(mdPath)) return 'SKIP';
	const listUrl = `https://tv.cctv.com/lm/xwlb/day/${date}.shtml`;
	let html;
	try {
		html = await getText(listUrl);
	} catch {
		failed.push([date, 'list unreachable']);
		return 'MISS';
	}
	let links;
	try {
		links = parseDayList(html, listUrl);
	} catch {
		failed.push([date, 'no links']);
		return 'MISS';
	}
	let abstract;
	try {
		abstract = parseAbstract(await getText(links.abstractUrl));
	} catch {
		failed.push([date, 'abstract not ready']);
		return 'NOT_READY';
	}
	const items = [];
	for (const url of links.itemUrls) {
		try {
			const { title, content } = parseNewsPage(await getText(url));
			if (title && content) items.push({ title, content, link: url });
		} catch {
			// 单条失败跳过，不拖垮整天
		}
	}
	if (items.length === 0) {
		failed.push([date, 'no items parsed']);
		return 'FAIL';
	}
	fs.writeFileSync(mdPath, renderMarkdown({ date, abstract, items, now: Date.now() }));
	const catalogueJson = fs.existsSync(cataloguePath) ? fs.readFileSync(cataloguePath, 'utf8') : '[]';
	const newCatalogue = prependCatalogue(catalogueJson, { date, abstract });
	if (newCatalogue !== catalogueJson) fs.writeFileSync(cataloguePath, newCatalogue);
	const readme = fs.readFileSync(readmePath, 'utf8');
	const newReadme = insertReadmeLine(readme, date);
	if (newReadme !== readme) fs.writeFileSync(readmePath, newReadme);
	return 'OK';
}

// 天级并发、天内串行；单天抛错就地捕获计入 failed
await mapLimit(dateList, CONCURRENCY, async date => {
	let status;
	try {
		status = await crawlDay(date);
	} catch (err) {
		failed.push([date, err.message]);
		status = 'FAIL';
	}
	done++;
	if (status === 'OK' || done % 10 === 0 || done === total) {
		const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
		console.log(`[${done}/${total}] ${date} ${status} (${mins} min)`);
	}
});

console.log(`\nBACKFILL DONE: ${total - failed.length} ok/skip, ${failed.length} failed`);
if (failed.length) {
	console.log('FAILED DATES:');
	for (const [d, why] of failed) console.log(`  ${d}  ${why}`);
}

async function mapLimit(items, limit, fn) {
	let i = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (i < items.length) {
			const idx = i++;
			await fn(items[idx], idx);
		}
	});
	await Promise.all(workers);
}
