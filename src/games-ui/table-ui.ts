import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameRecord } from '../database/database';

import type {
	GameSortColumn,
	GamesPageCallbacks,
	GamesPageState,
} from './types';

import { renderEditableGameRow } from './edit-ui';

import { confirmAction } from '../confirm-modal';

import {
	getMarginText,
	getMarginValue,
	getScoreText,
	getWinnerText,
} from './utils';

export function renderGamesTable(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	const section = container.createDiv('cribbage-panel');

	section.createEl('h2', {
		text: 'Games',
	});

	const games = sortGames(plugin.database.listGames(), state);

	if (games.length === 0) {
		section.createEl('p', {
			text: 'No games recorded yet.',
			cls: 'cribbage-empty-state',
		});

		return;
	}

	const scroll = section.createDiv('cribbage-table-scroll');

	const table = scroll.createEl('table', {
		cls: 'cribbage-table',
	});

	const header = table.createEl('thead').createEl('tr');

	createSortableHeader(
		header,
		'Date',
		'datetime',
		state,
		callbacks.onSortChanged,
	);

	header.createEl('th', {
		text: 'Time',
	});

	createSortableHeader(
		header,
		'Player 1',
		'player1',
		state,
		callbacks.onSortChanged,
	);

	createSortableHeader(
		header,
		'Player 2',
		'player2',
		state,
		callbacks.onSortChanged,
	);

	header.createEl('th', {
		text: 'First dealer',
	});

	header.createEl('th', {
		text: 'Score',
	});

	header.createEl('th', {
		text: 'Winner',
	});

	createSortableHeader(
		header,
		'Margin',
		'margin',
		state,
		callbacks.onSortChanged,
	);

	header.createEl('th');

	const body = table.createEl('tbody');

	for (const game of games) {
		renderGameRow(body, game, plugin, state, callbacks);
	}
}

function createSortableHeader(
	row: HTMLTableRowElement,
	label: string,
	column: GameSortColumn,
	state: GamesPageState,
	onSortChanged: () => void,
): void {
	const header = row.createEl('th');

	const button = header.createEl('button', {
		cls: 'cribbage-sort-button',
	});

	let indicator = '';

	if (state.sortColumn === column) {
		indicator = state.sortDirection === 'asc' ? ' ▲' : ' ▼';
	}

	button.setText(`${label}${indicator}`);

	button.addEventListener('click', () => {
		if (state.sortColumn === column) {
			state.sortDirection =
				state.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			state.sortColumn = column;

			state.sortDirection =
				column === 'datetime' || column === 'margin' ? 'desc' : 'asc';
		}

		onSortChanged();
	});
}

function sortGames(games: GameRecord[], state: GamesPageState): GameRecord[] {
	return [...games].sort((a, b) => {
		let comparison = 0;

		switch (state.sortColumn) {
			case 'datetime': {
				const aValue = `${a.playedDate}T${a.playedTime}`;

				const bValue = `${b.playedDate}T${b.playedTime}`;

				comparison = aValue.localeCompare(bValue);

				break;
			}

			case 'player1':
				comparison = a.player1.localeCompare(b.player1, undefined, {
					sensitivity: 'base',
				});

				break;

			case 'player2':
				comparison = a.player2.localeCompare(b.player2, undefined, {
					sensitivity: 'base',
				});

				break;

			case 'margin': {
				const aMargin = getMarginValue(a);

				const bMargin = getMarginValue(b);

				if (aMargin === null) {
					return bMargin === null ? 0 : 1;
				}

				if (bMargin === null) {
					return -1;
				}

				comparison = aMargin - bMargin;

				break;
			}
		}

		return state.sortDirection === 'asc' ? comparison : -comparison;
	});
}

function renderGameRow(
	body: HTMLTableSectionElement,
	game: GameRecord,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	if (state.editingGameId === game.id) {
		renderEditableGameRow(body, game, plugin, callbacks);

		return;
	}

	const row = body.createEl('tr');

	row.createEl('td', {
		text: game.playedDate,
	});

	row.createEl('td', {
		text: game.playedTime,
	});

	row.createEl('td', {
		text: game.player1,
	});

	row.createEl('td', {
		text: game.player2,
	});

	row.createEl('td', {
		text:
			game.firstDealer === 1
				? game.player1
				: game.firstDealer === 2
					? game.player2
					: 'Unknown',
	});

	row.createEl('td', {
		text: getScoreText(game),
	});

	row.createEl('td', {
		text: getWinnerText(game),
	});

	row.createEl('td', {
		text: getMarginText(game),
	});

	const actions = row.createEl('td');

	const actionGroup = actions.createDiv('cribbage-row-actions');

	const handsButton = actionGroup.createEl('button', {
		text: 'Hands',
	});

	handsButton.addEventListener('click', () => {
		callbacks.onOpenHands(game.id);
	});

	const editButton = actionGroup.createEl('button', {
		text: 'Edit',
	});

	editButton.addEventListener('click', () => {
		callbacks.onEdit(game.id);
	});

	const deleteButton = actionGroup.createEl('button', {
		text: 'Delete',
		cls: 'cribbage-delete-button',
	});

	deleteButton.addEventListener('click', () => {
		void (async () => {
			const confirmed = await confirmAction(
				plugin.app,
				`Delete ${game.player1} vs ${game.player2} on ${game.playedDate}?`,
				'Delete',
			);

			if (!confirmed) {
				return;
			}

			try {
				await plugin.database.deleteGame(game.id);

				new Notice('Game deleted.');

				callbacks.onChanged();
			} catch (error) {
				console.error(error);

				new Notice('Could not delete game.');
			}
		})();
	});
}
