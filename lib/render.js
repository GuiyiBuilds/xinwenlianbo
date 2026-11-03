// 产物渲染：markdown 文档、catalogue.json 前插、README 目录行插入（均幂等）
export function renderMarkdown({ date, abstract, items, now = Date.now() }) {
	let body = '';
	for (const { title, content, link } of items) {
		body += `### ${title}\n\n${content}\n\n[查看原文](${link})\n\n`;
	}
	return `# 《新闻联播》 (${date})\n\n## 新闻摘要\n\n${abstract}\n\n## 详细新闻\n\n${body}---\n\n(更新时间戳: ${now})\n`;
}

export function prependCatalogue(jsonText, entry) {
	const list = JSON.parse(jsonText || '[]');
	if (!Array.isArray(list)) throw new Error('catalogue.json 顶层数组缺失');
	if (list[0] && list[0].date === entry.date) return jsonText;
	list.unshift({ date: entry.date, abstract: entry.abstract });
	return JSON.stringify(list);
}

export function insertReadmeLine(readmeText, date) {
	const line = `- [${date}](./news/${date}.md)`;
	if (readmeText.includes(line)) return readmeText;
	const marker = '<!-- INSERT -->';
	if (!readmeText.includes(marker)) throw new Error('README 缺少 <!-- INSERT --> 标记');
	return readmeText.replace(marker, `${marker}\n${line}`);
}
