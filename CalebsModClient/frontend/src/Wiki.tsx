import './App.css';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import {
	GetDocumentation,
	GetDocumentationList,
} from '../wailsjs/go/main/MinecraftService';
import { go_services } from '../wailsjs/go/models';
import { BookIcon } from './components/Icons';
import TopBar from './components/TopBar';
import WikiTable from './components/WikiTable';

interface HeadingLink {
	id: string;
	text: string;
	level: number;
}

const DEV_API_URL = 'http://localhost:3001';

function hasWailsRuntime(): boolean {
	return 'go' in window;
}

async function loadDocumentationList(): Promise<go_services.DocumentationSummary[]> {
	if (hasWailsRuntime() || !import.meta.env.DEV) return GetDocumentationList();
	const response = await fetch(`${DEV_API_URL}/api/documentation`);
	if (!response.ok) throw new Error(`Documentation request failed: ${response.status}`);
	return response.json();
}

async function loadDocumentation(id: string): Promise<go_services.DocumentationDocument> {
	if (hasWailsRuntime() || !import.meta.env.DEV) return GetDocumentation(id);
	const response = await fetch(`${DEV_API_URL}/api/documentation/${encodeURIComponent(id)}`);
	if (!response.ok) throw new Error(`Documentation request failed: ${response.status}`);
	return response.json();
}

export default function Wiki() {
	const articleRef = useRef<HTMLElement>(null);
	const [documents, setDocuments] = useState<go_services.DocumentationSummary[]>([]);
	const [selectedId, setSelectedId] = useState('');
	const [document, setDocument] = useState<go_services.DocumentationDocument | null>(null);
	const [headings, setHeadings] = useState<HeadingLink[]>([]);
	const [activeHeading, setActiveHeading] = useState('');
	const [loadingList, setLoadingList] = useState(true);
	const [loadingDocument, setLoadingDocument] = useState(false);
	const [error, setError] = useState('');
	const [documentRequest, setDocumentRequest] = useState(0);

	const loadList = useCallback(async () => {
		setLoadingList(true);
		setError('');
		try {
			const result = await loadDocumentationList();
			setDocuments(result);
			setSelectedId((current) =>
				result.some((item) => item.id === current) ? current : result[0]?.id ?? '',
			);
		} catch (loadError) {
			console.error('Failed to load documentation list:', loadError);
			setError('The Wiki could not reach the server.');
		} finally {
			setLoadingList(false);
		}
	}, []);

	useEffect(() => {
		void loadList();
	}, [loadList]);

	useEffect(() => {
		if (!selectedId) {
			setDocument(null);
			return;
		}

		let cancelled = false;
		setLoadingDocument(true);
		setError('');
		loadDocumentation(selectedId)
			.then((result) => {
				if (!cancelled) setDocument(result);
			})
			.catch((loadError) => {
				console.error('Failed to load documentation:', loadError);
				if (!cancelled) {
					setDocument(null);
					setError('This document could not be loaded.');
				}
			})
			.finally(() => {
				if (!cancelled) setLoadingDocument(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedId, documentRequest]);

	useEffect(() => {
		const article = articleRef.current;
		if (!article || !document) return;

		const nodes = Array.from(article.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
		const nextHeadings = nodes.map((heading) => ({
			id: heading.id,
			text: heading.textContent?.trim() || 'Untitled section',
			level: Number(heading.tagName.slice(1)),
		}));
		setHeadings(nextHeadings);
		setActiveHeading(nextHeadings[0]?.id ?? '');
		window.scrollTo({ top: 0 });

		const updateActiveHeading = () => {
			let active = nextHeadings[0]?.id ?? '';
			for (const heading of nodes) {
				if (heading.getBoundingClientRect().top <= 92) active = heading.id;
				else break;
			}
			setActiveHeading(active);
		};

		window.addEventListener('scroll', updateActiveHeading, { passive: true });
		return () => window.removeEventListener('scroll', updateActiveHeading);
	}, [document]);

	const goToHeading = (id: string) => {
		globalThis.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
		setActiveHeading(id);
	};

	const retry = () => {
		if (documents.length === 0) void loadList();
		else setDocumentRequest((current) => current + 1);
	};

	return (
		<div className="page wiki-page">
			<TopBar
				backTo="/"
				title="Wiki"
				actions={
				documents.length > 0 ? (
					<select
						className="input wiki-document-select"
						aria-label="Select a Wiki document"
						value={selectedId}
						onChange={(event) => setSelectedId(event.target.value)}
					>
						{documents.map((item) => (
							<option key={item.id} value={item.id}>{item.title}</option>
						))}
					</select>
				) : undefined
			}
			/>

			{loadingList || loadingDocument ? (
				<div className="wiki-state"><span className="spinner" /> Loading Wiki…</div>
			) : error ? (
				<div className="wiki-state wiki-state--error">
					<BookIcon className="wiki-state__icon" />
					<strong>{error}</strong>
					<button className="btn btn--primary btn--sm" onClick={retry}>Try again</button>
				</div>
			) : documents.length === 0 ? (
				<div className="wiki-state">
					<BookIcon className="wiki-state__icon" />
					<strong>No Wiki documents yet</strong>
					<span>Add a Markdown file to the server documentation folder.</span>
				</div>
			) : document ? (
				<div className="wiki-layout">
					<aside className="wiki-outline" aria-label="Document outline">
						<div className="eyebrow">On this page</div>
						<nav>
							{headings.map((heading) => (
								<button
									key={heading.id}
									type="button"
									className={activeHeading === heading.id ? 'is-active' : ''}
									style={{ paddingLeft: `${11 + Math.min(heading.level - 1, 3) * 11}px` } as CSSProperties}
									onClick={() => goToHeading(heading.id)}
									title={heading.text}
								>
									{heading.text}
								</button>
							))}
						</nav>
					</aside>
					<main className="wiki-content">
						<article ref={articleRef} key={document.id} className="wiki-article">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								rehypePlugins={[rehypeSlug]}
								components={{ table: WikiTable }}
							>
								{document.markdown}
							</ReactMarkdown>
						</article>
					</main>
				</div>
			) : null}
		</div>
	);
}
