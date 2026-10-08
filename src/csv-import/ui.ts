import {
	Notice,
} from 'obsidian';

import type {
	CribbageTrackerPluginContext,
} from '../plugin-context';

import {
	confirmAction,
} from '../confirm-modal';

import {
	buildGamesFromCsv,
} from './builder';

import {
	inferColumns,
} from './columns';

import type {
	CsvData,
	ImportControls,
} from './types';

export function renderConfiguration(
	container: HTMLElement,
	previewContainer: HTMLElement,
	data: CsvData,
	plugin: CribbageTrackerPluginContext,
	onImported: () => void,
): void {
	container.empty();
	previewContainer.empty();

	const inferred =
		inferColumns(
			data.headers,
		);

	container.createEl('h3', {
		text: `Import settings — ${data.fileName}`,
	});

	const grid =
		container.createDiv(
			'cribbage-import-grid',
		);

	const player1Input =
		createTextField(
			grid,
			'Player 1 name',
			inferred.player1Name,
		);

	const player2Input =
		createTextField(
			grid,
			'Player 2 name',
			inferred.player2Name,
		);

	const dateSelect =
		createColumnSelect(
			grid,
			'Date column',
			data.headers,
			inferred.date,
			false,
		);

	const firstDealerSelect =
		createColumnSelect(
			grid,
			'First dealer column',
			data.headers,
			inferred.firstDealer,
			true,
		);

	const player1ScoreSelect =
		createColumnSelect(
			grid,
			'Player 1 score',
			data.headers,
			inferred.player1Score,
			false,
		);

	const player2ScoreSelect =
		createColumnSelect(
			grid,
			'Player 2 score',
			data.headers,
			inferred.player2Score,
			false,
		);

	const player1HighSelect =
		createColumnSelect(
			grid,
			'Player 1 high hand',
			data.headers,
			inferred.player1HighHand,
			true,
		);

	const player2HighSelect =
		createColumnSelect(
			grid,
			'Player 2 high hand',
			data.headers,
			inferred.player2HighHand,
			true,
		);

	const baseTimeInput =
		createTextField(
			grid,
			'First game time',
			'17:00',
			'time',
		);

	const spacingInput =
		createTextField(
			grid,
			'Same-day spacing (minutes)',
			'30',
			'number',
		);

	spacingInput.min = '0';
	spacingInput.step = '1';

	container.createEl('p', {
		text:
			'Games on the same date are assigned times in CSV row order. ' +
			'With the defaults, they become 17:00, 17:30, 18:00, and so on.',
		cls: 'setting-item-description',
	});

	const controls: ImportControls = {
		player1Input,
		player2Input,
		dateSelect,
		firstDealerSelect,
		player1ScoreSelect,
		player2ScoreSelect,
		player1HighSelect,
		player2HighSelect,
		baseTimeInput,
		spacingInput,
	};

	const updatePreview = () => {
		renderPreview(
			previewContainer,
			data,
			plugin,
			onImported,
			controls,
		);
	};

	for (const element of [
		player1Input,
		player2Input,
		dateSelect,
		firstDealerSelect,
		player1ScoreSelect,
		player2ScoreSelect,
		player1HighSelect,
		player2HighSelect,
		baseTimeInput,
		spacingInput,
	]) {
		element.addEventListener(
			'input',
			updatePreview,
		);

		element.addEventListener(
			'change',
			updatePreview,
		);
	}

	updatePreview();
}

function renderPreview(
	container: HTMLElement,
	data: CsvData,
	plugin: CribbageTrackerPluginContext,
	onImported: () => void,
	controls: ImportControls,
): void {
	container.empty();

	const result =
		buildGamesFromCsv(
			data,
			controls,
		);

	container.createEl('h3', {
		text: 'Preview',
	});

	const summary =
		container.createDiv(
			'cribbage-import-summary',
		);

	summary.createSpan({
		text:
			`${result.games.length} valid game` +
			(result.games.length === 1
				? ''
				: 's'),
	});

	if (result.errors.length > 0) {
		summary.createSpan({
			text:
				` • ${result.errors.length} error` +
				(result.errors.length === 1
					? ''
					: 's'),
			cls: 'cribbage-import-error-text',
		});
	}

	if (result.errors.length > 0) {
		const errors =
			container.createDiv(
				'cribbage-import-errors',
			);

		errors.createEl('strong', {
			text: 'Import errors',
		});

		const list =
			errors.createEl('ul');

		for (
			const error of
			result.errors.slice(0, 20)
		) {
			list.createEl('li', {
				text: error,
			});
		}

		if (result.errors.length > 20) {
			errors.createEl('p', {
				text:
					`…and ${
						result.errors.length - 20
					} more.`,
			});
		}
	}

	if (result.games.length > 0) {
		const scroll =
			container.createDiv(
				'cribbage-table-scroll',
			);

		const table =
			scroll.createEl('table', {
				cls: 'cribbage-table',
			});

		const header =
			table.createEl('thead')
				.createEl('tr');

		for (const label of [
			'Date',
			'Time',
			'Player 1',
			'Player 2',
			'First dealer',
			'Score',
			'High hands',
		]) {
			header.createEl('th', {
				text: label,
			});
		}

		const tbody =
			table.createEl('tbody');

		for (
			const game of
			result.games.slice(0, 25)
		) {
			const row =
				tbody.createEl('tr');

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
				text:
					`${game.player1Score ?? '—'} - ` +
					`${game.player2Score ?? '—'}`,
			});

			row.createEl('td', {
				text:
					`${game.player1HighHandManual ?? '—'} / ` +
					`${game.player2HighHandManual ?? '—'}`,
			});
		}

		if (result.games.length > 25) {
			container.createEl('p', {
				text:
					`Previewing the first 25 of ${result.games.length} games.`,
				cls: 'setting-item-description',
			});
		}
	}

	const actions =
		container.createDiv(
			'cribbage-import-actions',
		);

	const importButton =
		actions.createEl('button', {
			text:
				`Import ${result.games.length} Game` +
				(result.games.length === 1
					? ''
					: 's'),
			cls: 'mod-cta',
		});

	importButton.disabled =
		result.games.length === 0 ||
		result.errors.length > 0;

	importButton.addEventListener(
		'click',
		() => {
			void (async () => {
				if (
					result.games.length === 0 ||
					result.errors.length > 0
				) {
					return;
				}

				const confirmed =
					await confirmAction(
						plugin.app,
						`Import ${result.games.length} games into Cribbage tracker?`,
						'Import',
					);

				if (!confirmed) {
					return;
				}

				importButton.disabled = true;

				try {
					const count =
						await plugin.database
							.createGames(
								result.games,
							);

					new Notice(
						`Imported ${count} games.`,
					);

					onImported();
				} catch (error) {
					console.error(error);

					new Notice(
						'Could not import games.',
					);

					importButton.disabled = false;
				}
			})();
		},
	);
}

function createTextField(
	container: HTMLElement,
	label: string,
	value: string,
	type = 'text',
): HTMLInputElement {
	const wrapper =
		container.createDiv(
			'cribbage-form-field',
		);

	wrapper.createEl('label', {
		text: label,
	});

	const input =
		wrapper.createEl('input', {
			type,
		});

	input.value = value;

	return input;
}

function createColumnSelect(
	container: HTMLElement,
	label: string,
	headers: string[],
	selectedIndex: number | null,
	optional: boolean,
): HTMLSelectElement {
	const wrapper =
		container.createDiv(
			'cribbage-form-field',
		);

	wrapper.createEl('label', {
		text: label,
	});

	const select =
		wrapper.createEl('select');

	if (optional) {
		select.createEl('option', {
			text: 'None',
			value: '',
		});
	} else {
		select.createEl('option', {
			text: 'Select column',
			value: '',
		});
	}

	for (
		let index = 0;
		index < headers.length;
		index++
	) {
		const option =
			select.createEl('option', {
				text:
					headers[index] ??
					`Column ${index + 1}`,
				value:
					String(index),
			});

		if (index === selectedIndex) {
			option.selected = true;
		}
	}

	return select;
}