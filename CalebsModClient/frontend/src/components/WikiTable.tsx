import {
	Children,
	cloneElement,
	isValidElement,
	useMemo,
	useState,
	type ReactElement,
	type ReactNode,
	type TableHTMLAttributes,
	type ThHTMLAttributes,
} from 'react';
import {
	filterTableRows,
	sortTableRows,
	type SortDirection,
	type TableRowData,
} from '../wiki-table-utils';

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

function elementChildren(node: ReactNode): ReactNode[] {
	return isValidElement<{ children?: ReactNode }>(node)
		? Children.toArray(node.props.children)
		: [];
}

function elementText(node: ReactNode): string {
	if (typeof node === 'string' || typeof node === 'number') return String(node);
	if (!isValidElement<{ children?: ReactNode }>(node)) return '';
	return Children.toArray(node.props.children).map(elementText).join('');
}

function elementsOfType(nodes: ReactNode[], type: string): ElementWithChildren[] {
	return nodes.filter(
		(node): node is ElementWithChildren => isValidElement(node) && node.type === type,
	);
}

type WikiTableProps = TableHTMLAttributes<HTMLTableElement> & { node?: unknown };

export default function WikiTable({ children, node: _node, ...props }: WikiTableProps) {
	const [query, setQuery] = useState('');
	const [sortColumn, setSortColumn] = useState<number | null>(null);
	const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
	void _node;

	const sections = Children.toArray(children);
	const head = elementsOfType(sections, 'thead')[0];
	const body = elementsOfType(sections, 'tbody')[0];
	const headRow = head ? elementsOfType(elementChildren(head), 'tr')[0] : undefined;
	const headers = headRow ? elementsOfType(elementChildren(headRow), 'th') : [];
	const originalRows = body ? elementsOfType(elementChildren(body), 'tr') : [];

	const rows = useMemo<TableRowData<ElementWithChildren>[]>(
		() =>
			originalRows.map((row, index) => ({
				value: row,
				cells: elementsOfType(elementChildren(row), 'td').map(elementText),
				index,
			})),
		[body],
	);

	const visibleRows = useMemo(
		() => sortTableRows(filterTableRows(rows, query), sortColumn, sortDirection),
		[query, rows, sortColumn, sortDirection],
	);

	const changeSort = (column: number) => {
		if (sortColumn === column) {
			setSortDirection((current) =>
				current === 'ascending' ? 'descending' : 'ascending',
			);
		} else {
			setSortColumn(column);
			setSortDirection('ascending');
		}
	};

	if (!head || !body || !headRow || headers.length === 0) {
		return <table {...props}>{children}</table>;
	}

	return (
		<div className="wiki-table">
			<div className="wiki-table__toolbar">
				<input
					type="search"
					className="input input--search wiki-table__search"
					placeholder="Filter table…"
					aria-label="Filter table rows"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<span className="wiki-table__count">
					{visibleRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'}
				</span>
			</div>
			<div className="wiki-table__scroll">
				<table {...props}>
					{cloneElement(
						head,
						{},
						cloneElement(
							headRow,
							{},
							headers.map((header, index) =>
								cloneElement(
									header as ReactElement<ThHTMLAttributes<HTMLTableCellElement>>,
									{
										key: index,
										'aria-sort': sortColumn === index ? sortDirection : 'none',
									},
									<button type="button" onClick={() => changeSort(index)}>
										<span>{header.props.children}</span>
										<span className="wiki-table__sort" aria-hidden="true">
											{sortColumn === index
												? sortDirection === 'ascending'
													? '↑'
													: '↓'
												: '↕'}
										</span>
									</button>,
								),
							),
						),
					)}
					{cloneElement(
						body,
						{},
						visibleRows.length > 0 ? (
							visibleRows.map((row) => cloneElement(row.value, { key: row.index }))
						) : (
							<tr>
								<td className="wiki-table__empty" colSpan={headers.length}>
									No rows contain “{query}”.
								</td>
							</tr>
						),
					)}
				</table>
			</div>
		</div>
	);
}
