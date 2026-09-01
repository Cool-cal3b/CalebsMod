export type SortDirection = 'ascending' | 'descending';

export interface TableRowData<T> {
	value: T;
	cells: string[];
	index: number;
}

const collator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: 'base',
});

export function filterTableRows<T>(rows: TableRowData<T>[], query: string): TableRowData<T>[] {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return rows;
	return rows.filter((row) =>
		row.cells.some((cell) => cell.toLocaleLowerCase().includes(normalized)),
	);
}

export function sortTableRows<T>(
	rows: TableRowData<T>[],
	column: number | null,
	direction: SortDirection,
): TableRowData<T>[] {
	if (column === null) return rows;

	return [...rows].sort((left, right) => {
		const leftValue = left.cells[column]?.trim() ?? '';
		const rightValue = right.cells[column]?.trim() ?? '';
		const leftBlank = leftValue === '' || leftValue === '—';
		const rightBlank = rightValue === '' || rightValue === '—';

		if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;

		const leftNumber = numericValue(leftValue);
		const rightNumber = numericValue(rightValue);
		let comparison: number;
		if (leftNumber !== null && rightNumber !== null) {
			comparison = leftNumber - rightNumber;
		} else {
			comparison = collator.compare(leftValue, rightValue);
		}

		if (comparison === 0) comparison = left.index - right.index;
		return direction === 'ascending' ? comparison : -comparison;
	});
}

function numericValue(value: string): number | null {
	const normalized = value.replace(/,/g, '');
	if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
}
