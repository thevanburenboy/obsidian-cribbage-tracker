import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameRecord } from '../database/database';

import type { GamesPageCallbacks } from './types';

import { parseOptionalScore } from './utils';

export function renderEditableGameRow(
	body: HTMLTableSectionElement,
	game: GameRecord,
	plugin: CribbageTrackerPluginContext,
	callbacks: GamesPageCallbacks,
): void {
	const row = body.createEl('tr', {
		cls: 'cribbage-editing-row',
	});

	// Date
	const dateCell = row.createEl('td');

	const dateInput = dateCell.createEl('input', {
		type: 'date',
	});

	dateInput.value = game.playedDate;

	dateInput.setAttr('aria-label', 'Date');

	// Time
	const timeCell = row.createEl('td');

	const timeInput = timeCell.createEl('input', {
		type: 'time',
	});

	timeInput.value = game.playedTime;

	timeInput.setAttr('aria-label', 'Time');

	// Player 1
	const player1Cell = row.createEl('td');

	const player1Input = player1Cell.createEl('input', {
		type: 'text',
	});

	player1Input.value = game.player1;

	player1Input.setAttr('list', 'cribbage-player-suggestions');

	player1Input.setAttr('autocomplete', 'off');

	player1Input.setAttr('aria-label', 'Player 1');

	// Player 2
	const player2Cell = row.createEl('td');

	const player2Input = player2Cell.createEl('input', {
		type: 'text',
	});

	player2Input.value = game.player2;

	player2Input.setAttr('list', 'cribbage-player-suggestions');

	player2Input.setAttr('autocomplete', 'off');

	player2Input.setAttr('aria-label', 'Player 2');

	// First dealer
	const dealerCell = row.createEl('td');

	const dealerSelect = dealerCell.createEl('select');

	dealerSelect.setAttr('aria-label', 'First dealer');

	const unknownOption = dealerSelect.createEl('option', {
		text: 'Unknown',
		value: '',
	});

	const player1Option = dealerSelect.createEl('option', {
		text: game.player1,
		value: '1',
	});

	const player2Option = dealerSelect.createEl('option', {
		text: game.player2,
		value: '2',
	});

	if (game.firstDealer === 1) {
		player1Option.selected = true;
	} else if (game.firstDealer === 2) {
		player2Option.selected = true;
	} else {
		unknownOption.selected = true;
	}

	const updateDealerLabels = () => {
		player1Option.text = player1Input.value.trim() || 'Player 1';

		player2Option.text = player2Input.value.trim() || 'Player 2';
	};

	// Scores
	const scoreCell = row.createEl('td');

	const scoreWrapper = scoreCell.createDiv('cribbage-edit-score');

	const player1Score = scoreWrapper.createEl('input', {
		type: 'number',
	});

	player1Score.min = '0';
	player1Score.step = '1';

	player1Score.value =
		game.player1Score === null ? '' : String(game.player1Score);

	player1Score.setAttr('aria-label', `${game.player1} score`);

	scoreWrapper.createSpan({
		text: '–',
	});

	const player2Score = scoreWrapper.createEl('input', {
		type: 'number',
	});

	player2Score.min = '0';
	player2Score.step = '1';

	player2Score.value =
		game.player2Score === null ? '' : String(game.player2Score);

	player2Score.setAttr('aria-label', `${game.player2} score`);

	// Derived preview
	const winnerCell = row.createEl('td');

	const marginCell = row.createEl('td');

	const updateDerivedPreview = () => {
		const score1 = parseOptionalScore(player1Score.value);

		const score2 = parseOptionalScore(player2Score.value);

		if (score1 === undefined || score2 === undefined) {
			winnerCell.setText('Invalid');

			marginCell.setText('—');

			return;
		}

		if (score1 === null || score2 === null) {
			winnerCell.setText('—');

			marginCell.setText('—');

			return;
		}

		if (score1 === score2) {
			winnerCell.setText('Tie');
		} else if (score1 > score2) {
			winnerCell.setText(player1Input.value.trim() || 'Player 1');
		} else {
			winnerCell.setText(player2Input.value.trim() || 'Player 2');
		}

		marginCell.setText(String(Math.abs(score1 - score2)));
	};

	updateDerivedPreview();

	for (const input of [
		player1Input,
		player2Input,
		player1Score,
		player2Score,
	]) {
		input.addEventListener('input', () => {
			updateDealerLabels();

			updateDerivedPreview();
		});
	}

	// Save / Cancel
	const actionsCell = row.createEl('td');

	const actionGroup = actionsCell.createDiv('cribbage-row-actions');

	const saveButton = actionGroup.createEl('button', {
		text: 'Save',
		cls: 'mod-cta',
	});

	const cancelButton = actionGroup.createEl('button', {
		text: 'Cancel',
	});

	cancelButton.addEventListener('click', () => {
		callbacks.onCancelEdit();
	});

	saveButton.addEventListener('click', () => {
		void (async () => {
			const player1 = player1Input.value.trim();

			const player2 = player2Input.value.trim();

			if (!dateInput.value || !timeInput.value) {
				new Notice('Date and time are required.');

				return;
			}

			if (!player1 || !player2) {
				new Notice('Both player names are required.');

				return;
			}

			if (player1.toLocaleLowerCase() === player2.toLocaleLowerCase()) {
				new Notice('Player 1 and player 2 must be different.');

				return;
			}

			const score1 = parseOptionalScore(player1Score.value);

			const score2 = parseOptionalScore(player2Score.value);

			if (score1 === undefined || score2 === undefined) {
				new Notice('Scores must be whole numbers of 0 or greater.');

				return;
			}

			let firstDealer: 1 | 2 | null = null;

			if (dealerSelect.value === '1') {
				firstDealer = 1;
			} else if (dealerSelect.value === '2') {
				firstDealer = 2;
			}

			saveButton.disabled = true;

			try {
				await plugin.database.updateGame(game.id, {
					playedDate: dateInput.value,

					playedTime: timeInput.value,

					player1,
					player2,

					firstDealer,

					player1Score: score1,

					player2Score: score2,

					// Preserve historical fallback
					// data that is not exposed
					// in this editor.
					player1HighHandManual: game.player1HighHandManual,

					player2HighHandManual: game.player2HighHandManual,
				});

				new Notice('Game updated.');

				callbacks.onCancelEdit();
			} catch (error) {
				console.error(error);

				new Notice('Could not update game.');

				saveButton.disabled = false;
			}
		})();
	});
}
