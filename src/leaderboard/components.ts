import type { RecordOccurrence, RankedItem, RankedItemWithRank } from './types';

import { formatRecordValue } from './utils';

export function renderLeaderboardCard(
	container: HTMLElement,
	title: string,
	items: RankedItem[],
	options?: {
		note?: string;
		direction?: 'ascending' | 'descending';
	},
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: title,
	});

	if (options?.note) {
		card.createDiv({
			text: options.note,
			cls: 'cribbage-leaderboard-note',
		});
	}

	const ranked = rankItems(items, options?.direction ?? 'descending');

	if (ranked.length === 0) {
		renderEmpty(card, 'Not enough data yet.');

		return;
	}

	const rows = card.createDiv('cribbage-leaderboard-rows');

	for (const item of ranked) {
		const row = rows.createDiv('cribbage-leaderboard-row');

		const main = row.createDiv('cribbage-leaderboard-row-main');

		main.createSpan({
			text: `${item.rank}.`,
			cls: 'cribbage-leaderboard-rank',
		});

		main.createSpan({
			text: item.label,
			cls: 'cribbage-leaderboard-name',
		});

		main.createEl('strong', {
			text: item.displayValue,
			cls: 'cribbage-leaderboard-value',
		});

		if (item.subtext) {
			row.createDiv({
				text: item.subtext,
				cls: 'cribbage-leaderboard-subtext',
			});
		}
	}
}

export function rankItems(
	items: RankedItem[],
	direction: 'ascending' | 'descending',
): RankedItemWithRank[] {
	const sorted = [...items].sort((a, b) => {
		const difference =
			direction === 'descending' ? b.value - a.value : a.value - b.value;

		return difference || a.label.localeCompare(b.label);
	});

	const result: RankedItemWithRank[] = [];

	let previousValue: number | null = null;

	let previousRank = 0;

	for (let index = 0; index < sorted.length; index++) {
		const item = sorted[index];

		if (!item) {
			continue;
		}

		const rank =
			previousValue !== null && item.value === previousValue
				? previousRank
				: index + 1;

		result.push({
			...item,
			rank,
		});

		previousValue = item.value;

		previousRank = rank;

		if (result.length >= 5) {
			break;
		}
	}

	return result;
}

export function renderSimpleRecordCard(
	container: HTMLElement,
	title: string,
	occurrences: RecordOccurrence[],
	rows: {
		rank: number;
		score: number;
		count: number;
		label: string;
		subtext: string;
	}[],
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: title,
	});

	if (occurrences.length === 0 || rows.length === 0) {
		renderEmpty(card, 'No qualifying records yet.');

		return;
	}

	const rowsContainer = card.createDiv('cribbage-leaderboard-rows');

	for (const record of rows) {
		const row = rowsContainer.createDiv('cribbage-leaderboard-row');

		const main = row.createDiv('cribbage-leaderboard-row-main');

		main.createSpan({
			text: `${record.rank}.`,
			cls: 'cribbage-leaderboard-rank',
		});

		main.createSpan({
			text: record.label,
			cls: 'cribbage-leaderboard-name',
		});

		main.createEl('strong', {
			text:
				record.count > 1
					? `${formatRecordValue(record.score)} (x${record.count})`
					: formatRecordValue(record.score),
			cls: 'cribbage-leaderboard-value',
		});

		row.createDiv({
			text: record.subtext,
			cls: 'cribbage-leaderboard-subtext',
		});
	}
}

export function createSection(
	container: HTMLElement,
	title: string,
): HTMLElement {
	const section = container.createDiv('cribbage-leaderboard-section');

	section.createEl('h3', {
		text: title,
	});

	return section;
}

export function createLeaderboardGrid(container: HTMLElement): HTMLElement {
	return container.createDiv('cribbage-leaderboard-grid');
}

export function renderEmpty(container: HTMLElement, text: string): void {
	container.createDiv({
		text,
		cls: 'cribbage-leaderboard-empty',
	});
}
