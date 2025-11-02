import { marked } from 'marked';

export const parseMarkdown = (value: string | null | undefined): string => {
	if (!value) return '';
	return marked.parse(value, { breaks: true }) as string;
};
