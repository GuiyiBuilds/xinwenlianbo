// 基于 Node 内置 fetch 的文本抓取：超时 + 指数退避重试
export async function getText(url, { retries = 3, timeoutMs = 20000 } = {}) {
	let lastErr;
	for (let attempt = 1; attempt <= retries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, {
				headers: {
					'accept': 'text/html, */*; q=0.01',
					'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
					'cache-control': 'no-cache',
					'pragma': 'no-cache',
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
					'referer': url,
				},
				redirect: 'follow',
				signal: controller.signal,
			});
			if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
			return await res.text();
		} catch (err) {
			lastErr = err;
			if (attempt < retries) {
				const delayMs = 1000 * attempt;
				console.warn(`RETRY ${url} 第 ${attempt} 次失败（${err.message}），${delayMs}ms 后重试`);
				await new Promise(r => setTimeout(r, delayMs));
			}
		} finally {
			clearTimeout(timer);
		}
	}
	throw lastErr;
}
