import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { PlayerAggregate } from './types';

import {
	createLeaderboardGrid,
	createSection,
	renderEmpty,
	renderLeaderboardCard,
} from './components';

import { formatPercent, formatSigned, winRate } from './utils';

export function renderOverallStandings(
	container: HTMLElement,
	players: PlayerAggregate[],
): void {
	const section = createSection(container, 'Overall Standings');

	const standings = players
		.filter((player) => player.games > 0)
		.sort(
			(a, b) =>
				winRate(b) - winRate(a) ||
				b.games - a.games ||
				b.wins - a.wins ||
				a.name.localeCompare(b.name),
		);

	if (standings.length === 0) {
		renderEmpty(section, 'No completed games yet.');

		return;
	}

	const wrapper = section.createDiv('cribbage-leaderboard-table-wrap');

	const table = wrapper.createEl('table', {
		cls: 'cribbage-leaderboard-standings',
	});

	const head = table.createEl('thead');

	const header = head.createEl('tr');

	for (const label of ['Player', 'Record', 'Win %', 'PPG', 'Diff']) {
		header.createEl('th', {
			text: label,
		});
	}

	const body = table.createEl('tbody');

	let expanded = false;

	const renderRows = () => {
		body.empty();

		const visible = expanded ? standings : standings.slice(0, 5);

		for (const player of visible) {
			const row = body.createEl('tr');

			row.createEl('td', {
				text: player.name,
			});

			row.createEl('td', {
				text: `${player.wins}-${player.losses}`,
			});

			row.createEl('td', {
				text: formatPercent(winRate(player)),
			});

			row.createEl('td', {
				text: (player.totalScore / player.games).toFixed(2),
			});

			row.createEl('td', {
				text: formatSigned(player.totalDifferential / player.games),
			});
		}
	};

	renderRows();

	if (standings.length > 5) {
		const toggle = section.createEl('button', {
			cls: 'cribbage-leaderboard-expand-button',
		});

		const updateButton = () => {
			toggle.setText(
				expanded
					? 'Show top 5'
					: `Show all ${standings.length} players`,
			);
		};

		updateButton();

		toggle.addEventListener('click', () => {
			expanded = !expanded;

			renderRows();
			updateButton();
		});
	}
}

export function renderGamePerformance(
	container: HTMLElement,
	players: PlayerAggregate[],
	plugin: CribbageTrackerPluginContext,
): void {
	const minGames = plugin.settings.leaderboardMinGames;

	const minWins = plugin.settings.leaderboardMinWins;

	const section = createSection(container, 'Game Performance');

	const grid = createLeaderboardGrid(section);

	renderLeaderboardCard(
		grid,
		'Win %',
		players
			.filter((player) => player.games >= minGames)
			.map((player) => ({
				label: player.name,

				value: winRate(player),

				displayValue: formatPercent(winRate(player)),

				subtext: `${player.wins}-${player.losses} • ${player.games} games`,
			})),
		{
			note: `Minimum ${minGames} games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'PPG',
		players
			.filter((player) => player.games >= minGames)
			.map((player) => ({
				label: player.name,

				value: player.totalScore / player.games,

				displayValue: (player.totalScore / player.games).toFixed(2),

				subtext: `${player.games} games`,
			})),
		{
			note: `Minimum ${minGames} games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Score Differential',
		players
			.filter((player) => player.games >= minGames)
			.map((player) => {
				const value = player.totalDifferential / player.games;

				return {
					label: player.name,

					value,

					displayValue: formatSigned(value),

					subtext: `${player.games} games`,
				};
			}),
		{
			note: `Minimum ${minGames} games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Average Margin of Victory',
		players
			.filter((player) => player.wins >= minWins)
			.map((player) => {
				const value = player.victoryMarginTotal / player.wins;

				return {
					label: player.name,

					value,

					displayValue: value.toFixed(2),

					subtext: `${player.wins} wins`,
				};
			}),
		{
			note: `Minimum ${minWins} wins`,
		},
	);
}

export function renderHandPerformance(
	container: HTMLElement,
	players: PlayerAggregate[],
	plugin: CribbageTrackerPluginContext,
): void {
	const minHands = plugin.settings.leaderboardMinHands;

	const minCribs = plugin.settings.leaderboardMinCribs;

	const minRounds = plugin.settings.leaderboardMinRounds;

	const section = createSection(container, 'Hand Performance');

	const grid = createLeaderboardGrid(section);

	renderLeaderboardCard(
		grid,
		'Points / Hand',
		players
			.filter((player) => player.handCount >= minHands)
			.map((player) => ({
				label: player.name,

				value: player.handPointsTotal / player.handCount,

				displayValue: (
					player.handPointsTotal / player.handCount
				).toFixed(2),

				subtext: `${player.handCount} eligible hands`,
			})),
		{
			note: `Minimum ${minHands} eligible hands`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Points / Crib',
		players
			.filter((player) => player.cribCount >= minCribs)
			.map((player) => ({
				label: player.name,

				value: player.cribPointsTotal / player.cribCount,

				displayValue: (
					player.cribPointsTotal / player.cribCount
				).toFixed(2),

				subtext: `${player.cribCount} eligible cribs`,
			})),
		{
			note: `Minimum ${minCribs} eligible cribs`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Pegging / Round',
		players
			.filter((player) => player.peggingRoundCount >= minRounds)
			.map((player) => ({
				label: player.name,

				value: player.peggingPointsTotal / player.peggingRoundCount,

				displayValue: (
					player.peggingPointsTotal / player.peggingRoundCount
				).toFixed(2),

				subtext: `${player.peggingRoundCount} complete rounds`,
			})),
		{
			note: `Minimum ${minRounds} complete rounds`,
		},
	);
}

export function renderSituational(
	container: HTMLElement,
	players: PlayerAggregate[],
	plugin: CribbageTrackerPluginContext,
): void {
	const minRoleGames = plugin.settings.leaderboardMinRoleGames;

	const minHighHandGames = plugin.settings.leaderboardMinHighHandGames;

	const section = createSection(container, 'Situational');

	const grid = createLeaderboardGrid(section);

	renderLeaderboardCard(
		grid,
		'Dealing First',
		players
			.filter((player) => player.dealerGames >= minRoleGames)
			.map((player) => {
				const value = player.dealerWins / player.dealerGames;

				return {
					label: player.name,

					value,

					displayValue: formatPercent(value),

					subtext: `${player.dealerWins}-${player.dealerLosses} • ${player.dealerGames} games`,
				};
			}),
		{
			note: `Minimum ${minRoleGames} first-dealer games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Pone First',
		players
			.filter((player) => player.poneGames >= minRoleGames)
			.map((player) => {
				const value = player.poneWins / player.poneGames;

				return {
					label: player.name,

					value,

					displayValue: formatPercent(value),

					subtext: `${player.poneWins}-${player.poneLosses} • ${player.poneGames} games`,
				};
			}),
		{
			note: `Minimum ${minRoleGames} pone-first games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Higher High Hand/Crib %',
		players
			.filter(
				(player) => player.highHandComparableGames >= minHighHandGames,
			)
			.map((player) => {
				const value =
					player.higherHighHandGames / player.highHandComparableGames;

				return {
					label: player.name,

					value,

					displayValue: formatPercent(value),

					subtext: `${player.higherHighHandGames}/${player.highHandComparableGames} games`,
				};
			}),
		{
			note: `Minimum ${minHighHandGames} comparable games`,
		},
	);
}
