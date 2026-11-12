import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, prependCatalogue, insertReadmeLine } from '../lib/render.js';

const sample = {
	date: '20261102',
	abstract: '本期节目主要内容：\n\n1.新闻一；\n\n2.新闻二',
	items: [
		{ title: '新闻一', content: '正文一段\n\n正文二段', link: 'https://tv.cctv.com/a.shtml' },
	],
};

test('renderMarkdown: document holds title abstract items and timestamp', () => {
	const md = renderMarkdown(sample);
	assert.ok(md.includes('# 《新闻联播》 (20261102)'));
	assert.ok(md.includes('## 新闻摘要'));
	assert.ok(md.includes('## 详细新闻'));
	assert.ok(md.includes('### 新闻一'));
	assert.ok(md.includes('[查看原文](https://tv.cctv.com/a.shtml)'));
	assert.ok(md.includes('(更新时间戳:'));
});

test('renderMarkdown: detailed-news section carries an item-count hint line', () => {
	const md = renderMarkdown(sample);
	const section = md.slice(md.indexOf('## 详细新闻'));
	assert.ok(section.includes('> 以下为当日全部新闻正文，共 1 条，按 ### 小标题分节。'));
	const two = renderMarkdown({ ...sample, items: [...sample.items, { title: '新闻二', content: '正文', link: 'https://tv.cctv.com/b.shtml' }] });
	assert.ok(two.includes('共 2 条'));
});

test('prependCatalogue: newest entry lands first', () => {
	const out = JSON.parse(prependCatalogue('[]', { date: '20261102', abstract: 'a' }));
	assert.equal(out[0].date, '20261102');
	const out2 = JSON.parse(prependCatalogue(JSON.stringify([{ date: '20261101', abstract: 'b' }]), { date: '20261102', abstract: 'a' }));
	assert.equal(out2[0].date, '20261102');
	assert.equal(out2[1].date, '20261101');
});

test('prependCatalogue: same date returns byte-identical text', () => {
	const existing = JSON.stringify([{ date: '20261102', abstract: 'a' }]);
	assert.equal(prependCatalogue(existing, { date: '20261102', abstract: 'a' }), existing);
});

test('prependCatalogue: duplicate date anywhere in the list is rejected', () => {
	const existing = JSON.stringify([
		{ date: '20261103', abstract: 'x' },
		{ date: '20261102', abstract: 'a' },
		{ date: '20261101', abstract: 'b' },
	]);
	assert.equal(prependCatalogue(existing, { date: '20261102', abstract: 'a' }), existing);
});

test('insertReadmeLine: adds one line after the marker', () => {
	const readme = '# t\n\n<!-- INSERT -->\n';
	const out = insertReadmeLine(readme, '20261102');
	assert.ok(out.includes('- [20261102](./news/20261102.md)'));
	assert.ok(out.indexOf('<!-- INSERT -->') < out.indexOf('- [20261102]'));
});

test('insertReadmeLine: same date keeps the readme unchanged', () => {
	const readme = '# t\n\n<!-- INSERT -->\n- [20261102](./news/20261102.md)\n';
	assert.equal(insertReadmeLine(readme, '20261102'), readme);
});

test('insertReadmeLine: missing marker throws', () => {
	assert.throws(() => insertReadmeLine('# t\n', '20261102'), /INSERT/);
});
