export interface WikiLink {
	id: string;
	fragment: string;
}

export function resolveWikiLink(href: string, currentId: string, documentIds: ReadonlySet<string>): WikiLink | null {
	try {
		const url = new URL(href, `https://wiki.invalid/${currentId}.md`);
		if (url.origin !== 'https://wiki.invalid' || url.search) return null;
		const match = url.pathname.match(/^\/([^/]+)\.md$/);
		if (!match || !documentIds.has(match[1])) return null;
		return { id: match[1], fragment: decodeURIComponent(url.hash.slice(1)) };
	} catch {
		return null;
	}
}
