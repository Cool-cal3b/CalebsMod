import { describe, expect, it } from 'vitest';
import { filterTableRows, sortTableRows, type TableRowData } from './wiki-table-utils';

const rows: TableRowData<string>[] = [
	{ value: 'diamond', cells: ['Diamond', '3', 'All'], index: 0 },
	{ value: 'stone', cells: ['Stone', '1', 'Iron'], index: 1 },
	{ value: 'iron', cells: ['Iron', '2', 'Diamond'], index: 2 },
	{ value: 'missing', cells: ['Mystery', '—', ''], index: 3 },
];

describe('Wiki table utilities', () => {
	it('keeps a row when any column contains the query', () => {
		expect(filterTableRows(rows, 'dia').map((row) => row.value)).toEqual([
			'diamond',
			'iron',
		]);
	});

	it('returns no rows when no cell contains the query', () => {
		expect(filterTableRows(rows, 'netherite')).toEqual([]);
	});

	it('sorts numeric columns in both directions with blanks last', () => {
		expect(sortTableRows(rows, 1, 'ascending').map((row) => row.value)).toEqual([
			'stone',
			'iron',
			'diamond',
			'missing',
		]);
		expect(sortTableRows(rows, 1, 'descending').map((row) => row.value)).toEqual([
			'diamond',
			'iron',
			'stone',
			'missing',
		]);
	});

	it('sorts text without case sensitivity', () => {
		expect(sortTableRows(rows, 0, 'ascending').map((row) => row.value)).toEqual([
			'diamond',
			'iron',
			'missing',
			'stone',
		]);
	});
});
