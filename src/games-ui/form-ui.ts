import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameInput } from '../database/database';

import { getCurrentDateTime, parseOptionalScore } from './utils';

export function renderNewGameForm(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	onChanged: () => void,
): void {
	const section = container.createDiv('cribbage-panel');

	section.createEl('h2', {
		text: 'New game',
	});

	const form = section.createEl('form', {
		cls: 'cribbage-game-form',
	});

	const defaults = getCurrentDateTime();

	const dateInput = createField(form, 'Date', 'date');

	dateInput.value = defaults.date;
	dateInput.required = true;

	const timeInput = createField(form, 'Time', 'time');

	timeInput.value = defaults.time;
	timeInput.required = true;

	const playerNames = plugin.database.getPlayerNames();

	const datalistId = 'cribbage-player-suggestions';

	const datalist = form.createEl('datalist');

	datalist.id = datalistId;

	for (const player of playerNames) {
		datalist.createEl('option', {
			value: player,
		});
	}

	const player1Input = createField(form, 'Player 1', 'text');

	player1Input.setAttr('list', datalistId);

	player1Input.setAttr('autocomplete', 'off');

	player1Input.required = true;

	const player2Input = createField(form, 'Player 2', 'text');

	player2Input.setAttr('list', datalistId);

	player2Input.setAttr('autocomplete', 'off');

	player2Input.required = true;

	const dealerWrapper = form.createDiv('cribbage-form-field');

	dealerWrapper.createEl('label', {
		text: 'First dealer',
	});

	const dealerSelect = dealerWrapper.createEl('select');

	const unknownDealerOption = dealerSelect.createEl('option', {
		text: 'Unknown',
		value: '',
	});

	unknownDealerOption.selected = true;

	const player1DealerOption = dealerSelect.createEl('option', {
		text: 'Player 1',
		value: '1',
	});

	const player2DealerOption = dealerSelect.createEl('option', {
		text: 'Player 2',
		value: '2',
	});

	const updateDealerLabels = () => {
		player1DealerOption.text = player1Input.value.trim() || 'Player 1';

		player2DealerOption.text = player2Input.value.trim() || 'Player 2';
	};

	player1Input.addEventListener('input', updateDealerLabels);

	player2Input.addEventListener('input', updateDealerLabels);

	const player1Score = createField(form, 'Player 1 score', 'number');

	player1Score.min = '0';
	player1Score.step = '1';

	const player2Score = createField(form, 'Player 2 score', 'number');

	player2Score.min = '0';
	player2Score.step = '1';

	const actions = form.createDiv('cribbage-form-actions');

	const saveButton = actions.createEl('button', {
		text: 'Add game',
		type: 'submit',
		cls: 'mod-cta',
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();

		void (async () => {
			const player1 = player1Input.value.trim();

			const player2 = player2Input.value.trim();

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

			const input: GameInput = {
				playedDate: dateInput.value,

				playedTime: timeInput.value,

				player1,
				player2,

				firstDealer,

				player1Score: score1,
				player2Score: score2,

				player1HighHandManual: null,

				player2HighHandManual: null,
			};

			saveButton.disabled = true;

			try {
				await plugin.database.createGame(input);

				new Notice('Game added.');

				onChanged();
			} catch (error) {
				console.error(error);

				new Notice('Could not add game.');
			} finally {
				saveButton.disabled = false;
			}
		})();
	});
}

function createField(
	form: HTMLElement,
	label: string,
	type: string,
): HTMLInputElement {
	const wrapper = form.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	return wrapper.createEl('input', {
		type,
	});
}
