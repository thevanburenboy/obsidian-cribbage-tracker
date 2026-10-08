import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from '../database/database';

import type {
	GameLengthOccurrence,
	RecordContributor,
	RecordOccurrence,
	SkunkWinOccurrence,
	WinningStreakOccurrence,
} from './types';

import {
	createLeaderboardGrid,
	createSection,
	renderEmpty,
} from './components';

import {
	formatDate,
	formatRecordContributors,
	formatRecordValue,
} from './utils';

import {
	buildAverageHandOccurrences,
	buildFinalCountDeficitOccurrences,
	buildFinalCountPointOccurrences,
	buildGameLengthOccurrences,
	buildHighHandLossOccurrences,
	buildHighestHandOccurrences,
	buildLowHighHandWinOccurrences,
	buildSingleRoundCountOccurrences,
	buildSkunkWinOccurrences,
	buildWinningStreakOccurrences,
	compareSkunksNewestFirst,
	groupGameLengthOccurrences,
	groupRecordOccurrences,
	groupWinningStreakOccurrences,
} from './record-calculations';

export function renderRecords(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): void {
	const section = createSection(container, 'Records');

	const grid = createLeaderboardGrid(section);

	renderGroupedSkunkCard(
		grid,
		'Skunk Wins',
		buildSkunkWinOccurrences(games, false),
	);

	renderGroupedSkunkCard(
		grid,
		'Double-Skunk Wins',
		buildSkunkWinOccurrences(games, true),
	);

	renderWinningStreakCard(grid, buildWinningStreakOccurrences(games));

	renderGameLengthRecordCard(
		grid,
		'Quickest game',
		buildGameLengthOccurrences(games, hands),
		'ascending',
	);

	renderGameLengthRecordCard(
		grid,
		'Longest game',
		buildGameLengthOccurrences(games, hands),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Largest final-count deficit overcome',
		buildFinalCountDeficitOccurrences(games, hands),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Most final-count points in a win',
		buildFinalCountPointOccurrences(games, hands, true),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Most final-count points in a loss',
		buildFinalCountPointOccurrences(games, hands, false),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Largest single-round count',
		buildSingleRoundCountOccurrences(hands),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Highest Hands/Cribs',
		buildHighestHandOccurrences(games, hands),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Highest High Hand/Crib in a Loss',
		buildHighHandLossOccurrences(games),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Lowest High Hand/Crib in a Win',
		buildLowHighHandWinOccurrences(games),
		'ascending',
	);

	renderGroupedRecordCard(
		grid,
		'Highest Average Hand',
		buildAverageHandOccurrences(games, hands),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Lowest Average Hand',
		buildAverageHandOccurrences(games, hands),
		'ascending',
	);
}

function renderGroupedRecordCard(
	container: HTMLElement,
	title: string,
	occurrences: RecordOccurrence[],
	direction: 'ascending' | 'descending',
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: title,
	});

	const rows = groupRecordOccurrences(occurrences, direction);

	if (rows.length === 0) {
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

function renderWinningStreakCard(
	container: HTMLElement,
	occurrences: WinningStreakOccurrence[],
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: 'Winning streak',
	});

	const rows = groupWinningStreakOccurrences(occurrences);

	if (rows.length === 0) {
		renderEmpty(card, 'No streaks of 2+ games yet.');

		return;
	}

	const rowsContainer = card.createDiv('cribbage-leaderboard-rows');

	let hasActiveMarker = false;

	for (const record of rows) {
		const row = rowsContainer.createDiv('cribbage-leaderboard-row');

		if (record.activeSingleton) {
			row.addClass('is-active-streak');

			hasActiveMarker = true;
		}

		const main = row.createDiv('cribbage-leaderboard-row-main');

		main.createSpan({
			text: `${record.rank}.`,
			cls: 'cribbage-leaderboard-rank',
		});

		main.createSpan({
			text: record.label,
			cls: 'cribbage-leaderboard-name',
		});

		let value = String(record.length);

		if (record.count > 1) {
			value += ` (x${record.count})`;
		}

		if (record.activeSingleton) {
			value += '*';
		}

		main.createEl('strong', {
			text: value,
			cls: 'cribbage-leaderboard-value',
		});

		row.createDiv({
			text: record.subtext,
			cls: 'cribbage-leaderboard-subtext',
		});
	}

	if (hasActiveMarker) {
		card.createDiv({
			text: '* Active streak',
			cls: 'cribbage-leaderboard-note cribbage-leaderboard-active-note',
		});
	}
}

function renderGroupedSkunkCard(
	container: HTMLElement,
	title: string,
	occurrences: SkunkWinOccurrence[],
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: title,
	});

	const byPlayer = new Map<string, SkunkWinOccurrence[]>();

	for (const occurrence of occurrences) {
		const existing = byPlayer.get(occurrence.player);

		if (existing) {
			existing.push(occurrence);
		} else {
			byPlayer.set(occurrence.player, [occurrence]);
		}
	}

	const byCount = new Map<number, [string, SkunkWinOccurrence[]][]>();

	for (const [player, playerOccurrences] of byPlayer) {
		const count = playerOccurrences.length;

		const existing = byCount.get(count);

		const entry: [string, SkunkWinOccurrence[]] = [
			player,
			playerOccurrences,
		];

		if (existing) {
			existing.push(entry);
		} else {
			byCount.set(count, [entry]);
		}
	}

	const counts = Array.from(byCount.keys()).sort((a, b) => b - a);

	if (counts.length === 0) {
		renderEmpty(card, 'No qualifying records yet.');

		return;
	}

	const rowsContainer = card.createDiv('cribbage-leaderboard-rows');

	let rank = 1;
	let rowsShown = 0;

	for (const count of counts) {
		if (rowsShown >= 5) {
			break;
		}

		const players = byCount.get(count) ?? [];

		if (players.length === 0) {
			continue;
		}

		const row = rowsContainer.createDiv('cribbage-leaderboard-row');

		const main = row.createDiv('cribbage-leaderboard-row-main');

		main.createSpan({
			text: `${rank}.`,
			cls: 'cribbage-leaderboard-rank',
		});

		main.createSpan({
			text: players.length === 1 ? players[0]![0] : 'Multiple',

			cls: 'cribbage-leaderboard-name',
		});

		main.createEl('strong', {
			text: String(count),

			cls: 'cribbage-leaderboard-value',
		});

		let subtext: string;

		if (players.length === 1) {
			const [, playerOccurrences] = players[0]!;

			const latest = [...playerOccurrences].sort(
				compareSkunksNewestFirst,
			)[0]!;

			if (playerOccurrences.length === 1) {
				subtext = `vs ${latest.opponent} on ${formatDate(latest.playedDate)}`;
			} else {
				subtext = `Last: vs ${latest.opponent} on ${formatDate(latest.playedDate)}`;
			}
		} else {
			const contributors: RecordContributor[] = players.map(
				([player, playerOccurrences]) => {
					const latest = [...playerOccurrences].sort(
						compareSkunksNewestFirst,
					)[0]!;

					return {
						name: player,

						count: playerOccurrences.length,

						latestDate: latest.playedDate,

						latestTime: latest.playedTime,
					};
				},
			);

			subtext = formatRecordContributors(contributors, false);
		}

		row.createDiv({
			text: subtext,
			cls: 'cribbage-leaderboard-subtext',
		});

		/*
		 * Players tied at this count occupy
		 * multiple theoretical leaderboard
		 * positions.
		 */
		rank += players.length;

		rowsShown++;
	}
}

function renderGameLengthRecordCard(
	container: HTMLElement,
	title: string,
	occurrences: GameLengthOccurrence[],
	direction: 'ascending' | 'descending',
): void {
	const card = container.createDiv('cribbage-leaderboard-card');

	card.createEl('h4', {
		text: title,
	});

	const rows = groupGameLengthOccurrences(occurrences, direction);

	if (rows.length === 0) {
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
					? `${record.hands} (x${record.count})`
					: String(record.hands),

			cls: 'cribbage-leaderboard-value',
		});

		row.createDiv({
			text: record.subtext,

			cls: 'cribbage-leaderboard-subtext',
		});
	}
}
