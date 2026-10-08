import { Notice } from 'obsidian';

import type {
	CribbageTrackerPluginContext,
} from './plugin-context';

import type {
	GameInput,
	GameRecord,
} from './database';

import {
	renderCsvImporter,
} from './csv-import';

import {
	confirmAction,
} from './confirm-modal';

export type GameSortColumn =
	| 'datetime'
	| 'player1'
	| 'player2'
	| 'margin';

export interface GamesPageState {
	sortColumn: GameSortColumn;
	sortDirection: 'asc' | 'desc';
	editingGameId: string | null;
}

export interface GamesPageCallbacks {
	onChanged: () => void;
    onSortChanged: () => void;
	onOpenHands: (gameId: string) => void;
	onEdit: (gameId: string) => void;
	onCancelEdit: () => void;
}

export function renderGamesPage(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	renderNewGameForm(
		container,
		plugin,
		callbacks.onChanged,
	);

	if (plugin.settings.showCsvImporter) {
		renderCsvImporter(
			container,
			plugin,
			callbacks.onChanged,
		);
	}

	renderGamesTable(
		container,
		plugin,
		state,
		callbacks,
	);
}

function renderNewGameForm(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	onChanged: () => void,
): void {
	const section =
		container.createDiv('cribbage-panel');

	section.createEl('h2', {
		text: 'New game',
	});

	const form =
		section.createEl('form', {
			cls: 'cribbage-game-form',
		});

	const defaults =
		getCurrentDateTime();

	const dateInput = createField(
		form,
		'Date',
		'date',
	);

	dateInput.value = defaults.date;
	dateInput.required = true;

	const timeInput = createField(
		form,
		'Time',
		'time',
	);

	timeInput.value = defaults.time;
	timeInput.required = true;

	const playerNames =
		plugin.database.getPlayerNames();

	const datalistId =
		'cribbage-player-suggestions';

	const datalist =
		form.createEl('datalist');

	datalist.id = datalistId;

	for (const player of playerNames) {
		datalist.createEl('option', {
			value: player,
		});
	}

	const player1Input =
		createField(
			form,
			'Player 1',
			'text',
		);

	player1Input.setAttr(
		'list',
		datalistId,
	);

	player1Input.setAttr(
		'autocomplete',
		'off',
	);

	player1Input.required = true;

	const player2Input =
		createField(
			form,
			'Player 2',
			'text',
		);

	player2Input.setAttr(
		'list',
		datalistId,
	);

	player2Input.setAttr(
		'autocomplete',
		'off',
	);

	player2Input.required = true;

	const dealerWrapper =
		form.createDiv(
			'cribbage-form-field',
		);

	dealerWrapper.createEl('label', {
		text: 'First dealer',
	});

	const dealerSelect =
		dealerWrapper.createEl('select');

	const unknownDealerOption =
		dealerSelect.createEl('option', {
			text: 'Unknown',
			value: '',
		});

	unknownDealerOption.selected = true;

	const player1DealerOption =
		dealerSelect.createEl('option', {
			text: 'Player 1',
			value: '1',
		});

	const player2DealerOption =
		dealerSelect.createEl('option', {
			text: 'Player 2',
			value: '2',
		});

	const updateDealerLabels = () => {
		player1DealerOption.text =
			player1Input.value.trim() ||
			'Player 1';

		player2DealerOption.text =
			player2Input.value.trim() ||
			'Player 2';
	};

	player1Input.addEventListener(
		'input',
		updateDealerLabels,
	);

	player2Input.addEventListener(
		'input',
		updateDealerLabels,
	);

	const player1Score =
		createField(
			form,
			'Player 1 score',
			'number',
		);

	player1Score.min = '0';
	player1Score.step = '1';

	const player2Score =
		createField(
			form,
			'Player 2 score',
			'number',
		);

	player2Score.min = '0';
	player2Score.step = '1';

	const actions =
		form.createDiv(
			'cribbage-form-actions',
		);

	const saveButton =
		actions.createEl('button', {
			text: 'Add game',
			type: 'submit',
			cls: 'mod-cta',
		});

	form.addEventListener(
		'submit',
		(event) => {
			event.preventDefault();

			void (async () => {
				const player1 =
					player1Input.value.trim();

				const player2 =
					player2Input.value.trim();

				if (
					player1.toLocaleLowerCase() ===
					player2.toLocaleLowerCase()
				) {
					new Notice(
						'Player 1 and player 2 must be different.',
					);

					return;
				}

				const score1 =
					parseOptionalScore(
						player1Score.value,
					);

				const score2 =
					parseOptionalScore(
						player2Score.value,
					);

				if (
					score1 === undefined ||
					score2 === undefined
				) {
					new Notice(
						'Scores must be whole numbers of 0 or greater.',
					);

					return;
				}

				let firstDealer:
					1 | 2 | null = null;

				if (
					dealerSelect.value === '1'
				) {
					firstDealer = 1;
				} else if (
					dealerSelect.value === '2'
				) {
					firstDealer = 2;
				}

				const input: GameInput = {
					playedDate:
						dateInput.value,

					playedTime:
						timeInput.value,

					player1,
					player2,

					firstDealer,

					player1Score: score1,
					player2Score: score2,

					player1HighHandManual:
						null,

					player2HighHandManual:
						null,
				};

				saveButton.disabled = true;

				try {
					await plugin.database
						.createGame(input);

					new Notice(
						'Game added.',
					);

					onChanged();
				} catch (error) {
					console.error(error);

					new Notice(
						'Could not add game.',
					);
				} finally {
					saveButton.disabled =
						false;
				}
			})();
		},
	);
}

function renderGamesTable(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	const section =
		container.createDiv('cribbage-panel');

	section.createEl('h2', {
		text: 'Games',
	});

	const games =
		sortGames(
			plugin.database.listGames(),
			state,
		);

	if (games.length === 0) {
		section.createEl('p', {
			text: 'No games recorded yet.',
			cls: 'cribbage-empty-state',
		});

		return;
	}

	const scroll =
		section.createDiv(
			'cribbage-table-scroll',
		);

	const table =
		scroll.createEl('table', {
			cls: 'cribbage-table',
		});

	const header =
		table
			.createEl('thead')
			.createEl('tr');

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

	const body =
		table.createEl('tbody');

	for (const game of games) {
		renderGameRow(
			body,
			game,
			plugin,
			state,
			callbacks,
		);
	}
}

function createSortableHeader(
	row: HTMLTableRowElement,
	label: string,
	column: GameSortColumn,
	state: GamesPageState,
    onSortChanged: () => void,
): void {
	const header =
		row.createEl('th');

	const button =
		header.createEl('button', {
			cls: 'cribbage-sort-button',
		});

	let indicator = '';

	if (state.sortColumn === column) {
		indicator =
			state.sortDirection === 'asc'
				? ' ▲'
				: ' ▼';
	}

	button.setText(
		`${label}${indicator}`,
	);

	button.addEventListener(
		'click',
		() => {
			if (state.sortColumn === column) {
				state.sortDirection =
					state.sortDirection === 'asc'
						? 'desc'
						: 'asc';
			} else {
				state.sortColumn = column;

				state.sortDirection =
					column === 'datetime' ||
					column === 'margin'
						? 'desc'
						: 'asc';
			}

			onSortChanged();
		},
	);
}

function sortGames(
	games: GameRecord[],
	state: GamesPageState,
): GameRecord[] {
	return [...games].sort(
		(a, b) => {
			let comparison = 0;

			switch (state.sortColumn) {
				case 'datetime': {
					const aValue =
						`${a.playedDate}T${a.playedTime}`;

					const bValue =
						`${b.playedDate}T${b.playedTime}`;

					comparison =
						aValue.localeCompare(
							bValue,
						);

					break;
				}

				case 'player1':
					comparison =
						a.player1.localeCompare(
							b.player1,
							undefined,
							{
								sensitivity:
									'base',
							},
						);

					break;

				case 'player2':
					comparison =
						a.player2.localeCompare(
							b.player2,
							undefined,
							{
								sensitivity:
									'base',
							},
						);

					break;

				case 'margin': {
					const aMargin =
						getMarginValue(a);

					const bMargin =
						getMarginValue(b);

					if (aMargin === null) {
						return bMargin === null
							? 0
							: 1;
					}

					if (bMargin === null) {
						return -1;
					}

					comparison =
						aMargin - bMargin;

					break;
				}
			}

			return state.sortDirection === 'asc'
				? comparison
				: -comparison;
		},
	);
}

function renderGameRow(
	body: HTMLTableSectionElement,
	game: GameRecord,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	if (state.editingGameId === game.id) {
		renderEditableGameRow(
			body,
			game,
			plugin,
			callbacks,
		);

		return;
	}

	const row =
		body.createEl('tr');

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

	const actions =
		row.createEl('td');

	const actionGroup =
		actions.createDiv(
			'cribbage-row-actions',
		);

	const handsButton =
		actionGroup.createEl('button', {
			text: 'Hands',
		});

	handsButton.addEventListener(
		'click',
		() => {
			callbacks.onOpenHands(game.id);
		},
	);

	const editButton =
		actionGroup.createEl('button', {
			text: 'Edit',
		});

	editButton.addEventListener(
		'click',
		() => {
			callbacks.onEdit(game.id);
		},
	);

	const deleteButton =
		actionGroup.createEl('button', {
			text: 'Delete',
			cls: 'cribbage-delete-button',
		});

	deleteButton.addEventListener(
		'click',
		() => {
			void (async () => {
				const confirmed =
					await confirmAction(
						plugin.app,
						`Delete ${game.player1} vs ${game.player2} on ${game.playedDate}?`,
						'Delete',
					);

				if (!confirmed) {
					return;
				}

				try {
					await plugin.database
						.deleteGame(game.id);

					new Notice(
						'Game deleted.',
					);

					callbacks.onChanged();
				} catch (error) {
					console.error(error);

					new Notice(
						'Could not delete game.',
					);
				}
			})();
		},
	);
}

function renderEditableGameRow(
	body: HTMLTableSectionElement,
	game: GameRecord,
	plugin: CribbageTrackerPluginContext,
	callbacks: GamesPageCallbacks,
): void {
	const row =
		body.createEl('tr', {
			cls: 'cribbage-editing-row',
		});

	// Date
	const dateCell =
		row.createEl('td');

	const dateInput =
		dateCell.createEl('input', {
			type: 'date',
		});

	dateInput.value =
		game.playedDate;

	dateInput.setAttr(
		'aria-label',
		'Date',
	);

	// Time
	const timeCell =
		row.createEl('td');

	const timeInput =
		timeCell.createEl('input', {
			type: 'time',
		});

	timeInput.value =
		game.playedTime;

	timeInput.setAttr(
		'aria-label',
		'Time',
	);

	// Player 1
	const player1Cell =
		row.createEl('td');

	const player1Input =
		player1Cell.createEl('input', {
			type: 'text',
		});

	player1Input.value =
		game.player1;

	player1Input.setAttr(
		'list',
		'cribbage-player-suggestions',
	);

	player1Input.setAttr(
		'autocomplete',
		'off',
	);

	player1Input.setAttr(
		'aria-label',
		'Player 1',
	);

	// Player 2
	const player2Cell =
		row.createEl('td');

	const player2Input =
		player2Cell.createEl('input', {
			type: 'text',
		});

	player2Input.value =
		game.player2;

	player2Input.setAttr(
		'list',
		'cribbage-player-suggestions',
	);

	player2Input.setAttr(
		'autocomplete',
		'off',
	);

	player2Input.setAttr(
		'aria-label',
		'Player 2',
	);

	// First dealer
	const dealerCell =
		row.createEl('td');

	const dealerSelect =
		dealerCell.createEl('select');

	dealerSelect.setAttr(
		'aria-label',
		'First dealer',
	);

	const unknownOption =
		dealerSelect.createEl('option', {
			text: 'Unknown',
			value: '',
		});

	const player1Option =
		dealerSelect.createEl('option', {
			text: game.player1,
			value: '1',
		});

	const player2Option =
		dealerSelect.createEl('option', {
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
		player1Option.text =
			player1Input.value.trim() ||
			'Player 1';

		player2Option.text =
			player2Input.value.trim() ||
			'Player 2';
	};

	// Scores
	const scoreCell =
		row.createEl('td');

	const scoreWrapper =
		scoreCell.createDiv(
			'cribbage-edit-score',
		);

	const player1Score =
		scoreWrapper.createEl('input', {
			type: 'number',
		});

	player1Score.min = '0';
	player1Score.step = '1';

	player1Score.value =
		game.player1Score === null
			? ''
			: String(
					game.player1Score,
				);

	player1Score.setAttr(
		'aria-label',
		`${game.player1} score`,
	);

	scoreWrapper.createSpan({
		text: '–',
	});

	const player2Score =
		scoreWrapper.createEl('input', {
			type: 'number',
		});

	player2Score.min = '0';
	player2Score.step = '1';

	player2Score.value =
		game.player2Score === null
			? ''
			: String(
					game.player2Score,
				);

	player2Score.setAttr(
		'aria-label',
		`${game.player2} score`,
	);

	// Derived preview
	const winnerCell =
		row.createEl('td');

	const marginCell =
		row.createEl('td');

	const updateDerivedPreview = () => {
		const score1 =
			parseOptionalScore(
				player1Score.value,
			);

		const score2 =
			parseOptionalScore(
				player2Score.value,
			);

		if (
			score1 === undefined ||
			score2 === undefined
		) {
			winnerCell.setText(
				'Invalid',
			);

			marginCell.setText('—');

			return;
		}

		if (
			score1 === null ||
			score2 === null
		) {
			winnerCell.setText('—');
			marginCell.setText('—');

			return;
		}

		if (score1 === score2) {
			winnerCell.setText('Tie');
		} else if (score1 > score2) {
			winnerCell.setText(
				player1Input.value.trim() ||
					'Player 1',
			);
		} else {
			winnerCell.setText(
				player2Input.value.trim() ||
					'Player 2',
			);
		}

		marginCell.setText(
			String(
				Math.abs(
					score1 - score2,
				),
			),
		);
	};

	updateDerivedPreview();

	for (const input of [
		player1Input,
		player2Input,
		player1Score,
		player2Score,
	]) {
		input.addEventListener(
			'input',
			() => {
				updateDealerLabels();
				updateDerivedPreview();
			},
		);
	}

	// Save / Cancel
	const actionsCell =
		row.createEl('td');

	const actionGroup =
		actionsCell.createDiv(
			'cribbage-row-actions',
		);

	const saveButton =
		actionGroup.createEl('button', {
			text: 'Save',
			cls: 'mod-cta',
		});

	const cancelButton =
		actionGroup.createEl('button', {
			text: 'Cancel',
		});

	cancelButton.addEventListener(
		'click',
		() => {
			callbacks.onCancelEdit();
		},
	);

	saveButton.addEventListener(
		'click',
		() => {
			void (async () => {
				const player1 =
					player1Input.value.trim();

				const player2 =
					player2Input.value.trim();

				if (
					!dateInput.value ||
					!timeInput.value
				) {
					new Notice(
						'Date and time are required.',
					);

					return;
				}

				if (
					!player1 ||
					!player2
				) {
					new Notice(
						'Both player names are required.',
					);

					return;
				}

				if (
					player1.toLocaleLowerCase() ===
					player2.toLocaleLowerCase()
				) {
					new Notice(
						'Player 1 and player 2 must be different.',
					);

					return;
				}

				const score1 =
					parseOptionalScore(
						player1Score.value,
					);

				const score2 =
					parseOptionalScore(
						player2Score.value,
					);

				if (
					score1 === undefined ||
					score2 === undefined
				) {
					new Notice(
						'Scores must be whole numbers of 0 or greater.',
					);

					return;
				}

				let firstDealer:
					1 | 2 | null = null;

				if (
					dealerSelect.value === '1'
				) {
					firstDealer = 1;
				} else if (
					dealerSelect.value === '2'
				) {
					firstDealer = 2;
				}

				saveButton.disabled = true;

				try {
					await plugin.database
						.updateGame(
							game.id,
							{
								playedDate:
									dateInput.value,

								playedTime:
									timeInput.value,

								player1,
								player2,

								firstDealer,

								player1Score:
									score1,

								player2Score:
									score2,

								// Preserve historical fallback
								// data that is not exposed
								// in this editor.
								player1HighHandManual:
									game.player1HighHandManual,

								player2HighHandManual:
									game.player2HighHandManual,
							},
						);

					new Notice(
						'Game updated.',
					);

					callbacks.onCancelEdit();
				} catch (error) {
					console.error(error);

					new Notice(
						'Could not update game.',
					);

					saveButton.disabled =
						false;
				}
			})();
		},
	);
}

function createField(
	form: HTMLElement,
	label: string,
	type: string,
): HTMLInputElement {
	const wrapper =
		form.createDiv(
			'cribbage-form-field',
		);

	wrapper.createEl('label', {
		text: label,
	});

	return wrapper.createEl('input', {
		type,
	});
}

function parseOptionalScore(
	value: string,
): number | null | undefined {
	const trimmed = value.trim();

	if (trimmed === '') {
		return null;
	}

	const parsed = Number(trimmed);

	if (
		!Number.isInteger(parsed) ||
		parsed < 0
	) {
		return undefined;
	}

	return parsed;
}

function getScoreText(
	game: GameRecord,
): string {
	if (
		game.player1Score === null &&
		game.player2Score === null
	) {
		return '—';
	}

	return `${game.player1Score ?? '—'} - ${game.player2Score ?? '—'}`;
}

function getWinnerText(
	game: GameRecord,
): string {
	if (
		game.player1Score === null ||
		game.player2Score === null
	) {
		return '—';
	}

	if (
		game.player1Score ===
		game.player2Score
	) {
		return 'Tie';
	}

	return game.player1Score >
		game.player2Score
		? game.player1
		: game.player2;
}

function getMarginText(
	game: GameRecord,
): string {
	if (
		game.player1Score === null ||
		game.player2Score === null
	) {
		return '—';
	}

	return String(
		Math.abs(
			game.player1Score -
				game.player2Score,
		),
	);
}

function getMarginValue(
	game: GameRecord,
): number | null {
	if (
		game.player1Score === null ||
		game.player2Score === null
	) {
		return null;
	}

	return Math.abs(
		game.player1Score -
			game.player2Score,
	);
}

function getCurrentDateTime(): {
	date: string;
	time: string;
} {
	const now = new Date();

	const year =
		String(now.getFullYear());

	const month =
		String(
			now.getMonth() + 1,
		).padStart(2, '0');

	const day =
		String(
			now.getDate(),
		).padStart(2, '0');

	const hours =
		String(
			now.getHours(),
		).padStart(2, '0');

	const minutes =
		String(
			now.getMinutes(),
		).padStart(2, '0');

	return {
		date: `${year}-${month}-${day}`,
		time: `${hours}:${minutes}`,
	};
}