import { describe, expect, it } from 'vitest';
import { resolveWikiLink } from './wiki-links';

const documents = new Set(['all-worlds', 'overworld', 'dimensional-doors-guide']);

describe('resolveWikiLink', () => {
	it('resolves links between documents and heading fragments', () => {
		expect(resolveWikiLink('overworld.md', 'all-worlds', documents)).toEqual({ id: 'overworld', fragment: '' });
		expect(resolveWikiLink('./dimensional-doors-guide.md#before-entering-a-rift', 'all-worlds', documents))
			.toEqual({ id: 'dimensional-doors-guide', fragment: 'before-entering-a-rift' });
		expect(resolveWikiLink('#how-many-worlds-are-there', 'all-worlds', documents))
			.toEqual({ id: 'all-worlds', fragment: 'how-many-worlds-are-there' });
	});

	it('leaves external and unavailable links to the browser', () => {
		expect(resolveWikiLink('https://example.com/guide', 'all-worlds', documents)).toBeNull();
		expect(resolveWikiLink('missing.md', 'all-worlds', documents)).toBeNull();
	});
});
