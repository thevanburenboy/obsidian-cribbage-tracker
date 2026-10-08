import type {
	CribbageTrackerPluginContext,
} from './plugin-context';


import {
	renderGlobalStats,
	renderMatchupStats,
	renderPlayerStats,
} from './statistics-renderers';

import {
	createPlayerSelect,
	createSelectField,
} from './statistics-utils';

export function renderStatisticsPage(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
): void {
	const games = plugin.database.listGamesForStatistics();
	const hands = plugin.database.listHandsForStatistics();
	const players = plugin.database.getPlayerNames();

	const panel = container.createDiv('cribbage-panel');

	panel.createEl('h2', {
		text: 'Statistics',
	});

	if (games.length === 0) {
		panel.createEl('p', {
			text: 'No games recorded yet.',
		});

		return;
	}

	const controls = panel.createDiv('cribbage-stat-controls');

	const scopeField = createSelectField(controls, 'Scope', [
		['global', 'Global'],
		['player', 'Player'],
		['matchup', 'Matchup'],
	]);

	const player1Field = createPlayerSelect(controls, 'Player', players);
	const player2Field = createPlayerSelect(controls, 'Opponent', players);

	if (players.length > 1 && player2Field.value === player1Field.value) {
		player2Field.value = players[1] ?? '';
	}

	const results = panel.createDiv('cribbage-stat-results');

	const renderResults = () => {
		results.empty();

		const scope = scopeField.value;

		player1Field.parentElement?.toggleClass(
			'cribbage-hidden',
			scope === 'global',
		);

		player2Field.parentElement?.toggleClass(
			'cribbage-hidden',
			scope !== 'matchup',
		);

		if (scope === 'global') {
			renderGlobalStats(results, games, hands, plugin);
			return;
		}

		const player = player1Field.value;

		if (!player) {
			results.createEl('p', {
				text: 'Select a player.',
			});
			return;
		}

		if (scope === 'player') {
			renderPlayerStats(results, games, hands, player, plugin);
			return;
		}

		const opponent = player2Field.value;

		if (!opponent) {
			results.createEl('p', {
				text: 'Select an opponent.',
			});
			return;
		}

		if (player === opponent) {
			results.createEl('p', {
				text: 'Choose two different players.',
			});
			return;
		}

		renderMatchupStats(results, games, hands, player, opponent, plugin);
	};

	for (const select of [scopeField, player1Field, player2Field]) {
		select.addEventListener('change', renderResults);
	}

	renderResults();
}

