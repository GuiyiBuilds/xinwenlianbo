import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseDayList, parseAbstract, parseNewsPage } from '../lib/crawl.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = name => readFileSync(path.join(dir, 'fixtures', name), 'utf8');

test('parseDayList: first link is the full program page', () => {
	const { abstractUrl, itemUrls } = parseDayList(load('fixture-day-list.html'), 'https://tv.cctv.com/lm/xwlb/day/20261102.shtml');
	assert.match(abstractUrl, /VIDEm0XBlaxRD5vLt1inOnSj261102\.shtml$/);
	assert.ok(itemUrls.length >= 10, `item urls: ${itemUrls.length}`);
});

test('parseDayList: items start with the first news story', () => {
	const { itemUrls } = parseDayList(load('fixture-day-list.html'), 'https://tv.cctv.com/lm/xwlb/day/20261102.shtml');
	assert.match(itemUrls[0], /VIDEr2Jg8LMdq1vttKo83NLJ261102\.shtml$/);
});

test('parseDayList: urls are absolute https and deduplicated', () => {
	const { abstractUrl, itemUrls } = parseDayList(load('fixture-day-list.html'), 'http://tv.cctv.com/lm/xwlb/day/20261102.shtml');
	const all = [abstractUrl, ...itemUrls];
	for (const u of all) assert.ok(u.startsWith('https://tv.cctv.com/'), u);
	assert.equal(new Set(all).size, all.length);
});

test('parseAbstract: holds the program summary with line breaks', () => {
	const text = parseAbstract(load('fixture-abstract.html'));
	assert.ok(text.includes('本期节目主要内容'), text.slice(0, 80));
	assert.ok(text.includes('习近平'));
	assert.ok(text.includes('\n\n'));
});

test('parseNewsPage: strips the video prefix from the title', () => {
	const { title } = parseNewsPage(load('fixture-news.html'));
	assert.equal(title, '应习近平邀请 加蓬总统将访华');
});

test('parseNewsPage: body is paragraph text without raw p tags', () => {
	const { content } = parseNewsPage(load('fixture-news.html'));
	assert.ok(content.includes('央视网消息'), content.slice(0, 80));
	assert.ok(!/<p[\s>]/i.test(content));
});

test('parseNewsPage: multiple paragraphs are split by blank lines', () => {
	const html = `<div class="playingVideo"><div class="tit">[视频]测试标题</div></div><div class="playingCon"></div>
	<div id="content_area"><p>第一段正文</p><p>第二段正文</p></div>`;
	const { title, content } = parseNewsPage(html);
	assert.equal(title, '测试标题');
	assert.equal(content, '第一段正文\n\n第二段正文');
});
