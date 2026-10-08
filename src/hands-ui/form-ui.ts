import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameRecord, HandRecord } from '../database/database';

import { createNumberField, readHandInput } from './controls-ui';

export function renderAddHand(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	game: GameRecord,
	hands: HandRecord[],
	onRefresh: () => void,
): void {
	container.createEl('h3', {
		text: 'Add hand',
	});

	const grid = container.createDiv('cribbage-add-hand-grid');

	const nextDealer = getNextDealer(game, hands.length);

	const dealerName =
		nextDealer === 1
			? game.player1
			: nextDealer === 2
				? game.player2
				: null;

	const player1 = createNumberField(grid, `${game.player1} Hand`, null);

	const player2 = createNumberField(grid, `${game.player2} Hand`, null);

	const crib = createNumberField(
		grid,
		dealerName ? `${dealerName} Crib` : 'Crib',
		null,
	);

	const add = container.createEl('button', {
		text: 'Add hand',
		cls: 'mod-cta',
	});

	add.disabled = game.firstDealer === null;

	add.addEventListener('click', () => {
		void (async () => {
			const input = readHandInput(player1, player2, crib);

			if (!input) {
				return;
			}

			try {
				await plugin.database.addHand(game.id, input);

				new Notice('Hand added.');

				onRefresh();
			} catch (error) {
				console.error(error);

				new Notice(
					error instanceof Error
						? error.message
						: 'Could not add hand.',
				);
			}
		})();
	});
}

function getNextDealer(game: GameRecord, handCount: number): 1 | 2 | null {
	if (game.firstDealer !== 1 && game.firstDealer !== 2) {
		return null;
	}

	return handCount % 2 === 0
		? game.firstDealer
		: game.firstDealer === 1
			? 2
			: 1;
}
