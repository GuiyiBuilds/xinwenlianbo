// CCTV 新闻联播页面解析器：锚点正则 + div 平衡扫描，零第三方依赖
const ENTITIES = {
	'&nbsp;': ' ',
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&middot;': '·',
	'&mdash;': '—',
	'&ndash;': '–',
	'&hellip;': '…',
	'&ldquo;': '“',
	'&rdquo;': '”',
	'&lsquo;': '‘',
	'&rsquo;': '’',
	'&times;': '×',
};

export function decodeEntities(s) {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&[a-zA-Z]+;/g, name => ENTITIES[name] ?? name);
}

const stripTags = s => decodeEntities(s.replace(/<[^>]*>/g, ''));

// 从 <div id="..."> 开始做开闭标签平衡扫描，返回该 div 的内部 HTML
export function extractDivById(html, id) {
	const m = html.match(new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i'));
	if (!m) return null;
	const innerStart = m.index + m[0].length;
	const tokens = html.slice(innerStart).match(/<div\b[^>]*>|<\/div>/gi);
	let depth = 1;
	let pos = innerStart;
	for (const t of tokens) {
		const at = html.indexOf(t, pos);
		if (t.startsWith('</')) {
			depth--;
			if (depth === 0) return html.slice(innerStart, at);
		} else {
			depth++;
		}
		pos = at + t.length;
	}
	return null;
}

// 列表页：提取全部节目链接（VIDE*.shtml），规范化为绝对 https，去重保序
export function parseDayList(html, baseUrl) {
	const seen = new Set();
	const links = [];
	for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) {
		const raw = m[1].trim();
		if (!/VIDE\w+\.shtml/i.test(raw)) continue;
		const u = new URL(raw, baseUrl);
		u.protocol = 'https:';
		const abs = u.toString();
		if (seen.has(abs)) continue;
		seen.add(abs);
		links.push(abs);
	}
	if (links.length === 0) throw new Error('day list has no program links');
	return { abstractUrl: links[0], itemUrls: links.slice(1) };
}

// 完整版页面：nrjianjie_shadow 下 ul > li 第一个 p 即本期摘要
export function parseAbstract(html) {
	const anchor = html.indexOf('nrjianjie_shadow');
	if (anchor < 0) throw new Error('abstract block nrjianjie_shadow not found');
	const m = html.slice(anchor).match(/<ul[^>]*>[\s\S]*?<li[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
	if (!m) throw new Error('abstract paragraph not found under nrjianjie_shadow');
	let text = decodeEntities(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''))
		.replace(/\r/g, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (!text) throw new Error('abstract text is empty');
	text = text
		.replaceAll('；', '；\n\n')
		.replaceAll('：', '：\n\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return text;
}

// 新闻页：playingVideo 内 div.tit 为标题，div#content_area 为正文
export function parseNewsPage(html) {
	const pvStart = html.indexOf('class="playingVideo"');
	const pcIdx = html.indexOf('class="playingCon"');
	if (pvStart < 0 || pcIdx < 0 || pcIdx < pvStart) throw new Error('playingVideo region not found');
	const tm = html.slice(pvStart, pcIdx).match(/<div\s+class="tit"[^>]*>([\s\S]*?)<\/div>/i);
	if (!tm) throw new Error('title div.tit not found');
	const title = stripTags(tm[1]).replace('[视频]', '').replace(/\s+/g, ' ').trim();

	const contentHtml = extractDivById(html, 'content_area');
	if (contentHtml == null) throw new Error('div#content_area not found');
	const content = decodeEntities(contentHtml
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<p[^>]*>/gi, '')
		.replace(/<\/?(?!(?:strong|b|em|i)\b)[a-z][^>]*>/gi, ''))
		.replace(/\r/g, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (!content) throw new Error('news body is empty');
	return { title, content };
}
