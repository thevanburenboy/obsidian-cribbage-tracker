import { Notice } from 'obsidian';

import type CribbageTrackerPlugin from './main';
import type { GameInput } from './database';

import {
	confirmAction,
} from './confirm-modal';

interface CsvData {
	fileName: string;
	headers: string[];
	rows: string[][];
}

interface ImportBuildResult {
	games: GameInput[];
	errors: string[];
}

export function renderCsvImporter(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	onImported: () => void,
): void {
	const panel = container.createEl('details', {
		cls: 'cribbage-panel cribbage-import-panel',
	});

	panel.createEl('summary', {
		text: 'Import games from CSV',
	});

	const body = panel.createDiv(
		'cribbage-import-body',
	);

	body.createEl('p', {
		text:
			'Import historical games from a CSV file. ' +
			'Columns can be mapped after selecting the file.',
		cls: 'setting-item-description',
	});

	const fileField =
		body.createDiv('cribbage-form-field');

	fileField.createEl('label', {
		text: 'CSV file',
	});

	const fileInput =
		fileField.createEl('input', {
			type: 'file',
		});

	fileInput.accept = '.csv,text/csv';

	const configContainer =
		body.createDiv();

	const previewContainer =
		body.createDiv();

    fileInput.addEventListener(
        'change',
        () => {
            void (async () => {
                const file =
                    fileInput.files?.[0];

			if (!file) {
				return;
			}

			try {
				const text = await file.text();
				const parsed = parseCsv(text);

				if (parsed.length < 2) {
					new Notice(
						'CSV must contain a header row and at least one data row.',
					);

					return;
				}

				const headers =
					parsed[0]?.map(
						(value) =>
							value.trim(),
					) ?? [];

				const rows =
					parsed
						.slice(1)
						.filter(
							(row) =>
								row.some(
									(value) =>
										value.trim() !==
										'',
								),
						);

				if (
					headers.length === 0 ||
					rows.length === 0
				) {
					new Notice(
						'No importable CSV data was found.',
					);

					return;
				}

				const data: CsvData = {
					fileName: file.name,
					headers,
					rows,
				};

				renderConfiguration(
					configContainer,
					previewContainer,
					data,
					plugin,
					onImported,
				);
			} catch (error) {
				console.error(error);

				new Notice(
					'Could not read CSV file.',
				);
			}
		})();
	},
);
}

function renderConfiguration(
	container: HTMLElement,
	previewContainer: HTMLElement,
	data: CsvData,
	plugin: CribbageTrackerPlugin,
	onImported: () => void,
): void {
	container.empty();
	previewContainer.empty();

	const inferred =
		inferColumns(data.headers);

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

	const updatePreview = () => {
		renderPreview(
			previewContainer,
			data,
			plugin,
			onImported,
			{
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
			},
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

interface ImportControls {
	player1Input: HTMLInputElement;
	player2Input: HTMLInputElement;
	dateSelect: HTMLSelectElement;
	firstDealerSelect: HTMLSelectElement;
	player1ScoreSelect: HTMLSelectElement;
	player2ScoreSelect: HTMLSelectElement;
	player1HighSelect: HTMLSelectElement;
	player2HighSelect: HTMLSelectElement;
	baseTimeInput: HTMLInputElement;
	spacingInput: HTMLInputElement;
}

function renderPreview(
	container: HTMLElement,
	data: CsvData,
	plugin: CribbageTrackerPlugin,
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

function buildGamesFromCsv(
	data: CsvData,
	controls: ImportControls,
): ImportBuildResult {
	const games: GameInput[] = [];
	const errors: string[] = [];

	const player1 =
		controls.player1Input.value.trim();

	const player2 =
		controls.player2Input.value.trim();

	if (!player1) {
		errors.push(
			'Player 1 name is required.',
		);
	}

	if (!player2) {
		errors.push(
			'Player 2 name is required.',
		);
	}

	if (
		player1 &&
		player2 &&
		player1.toLocaleLowerCase() ===
			player2.toLocaleLowerCase()
	) {
		errors.push(
			'Player 1 and Player 2 must be different.',
		);
	}

	const dateColumn =
		getRequiredColumn(
			controls.dateSelect,
		);

	const player1ScoreColumn =
		getRequiredColumn(
			controls.player1ScoreSelect,
		);

	const player2ScoreColumn =
		getRequiredColumn(
			controls.player2ScoreSelect,
		);

	if (dateColumn === null) {
		errors.push(
			'Select a date column.',
		);
	}

	if (player1ScoreColumn === null) {
		errors.push(
			'Select the Player 1 score column.',
		);
	}

	if (player2ScoreColumn === null) {
		errors.push(
			'Select the Player 2 score column.',
		);
	}

	const firstDealerColumn =
		getOptionalColumn(
			controls.firstDealerSelect,
		);

	const player1HighColumn =
		getOptionalColumn(
			controls.player1HighSelect,
		);

	const player2HighColumn =
		getOptionalColumn(
			controls.player2HighSelect,
		);

	const baseMinutes =
		parseTimeToMinutes(
			controls.baseTimeInput.value,
		);

	if (baseMinutes === null) {
		errors.push(
			'First game time must be valid.',
		);
	}

	const spacing =
		Number(
			controls.spacingInput.value,
		);

	if (
		!Number.isInteger(spacing) ||
		spacing < 0
	) {
		errors.push(
			'Same-day spacing must be a whole number of minutes.',
		);
	}

	if (
		errors.length > 0 ||
		dateColumn === null ||
		player1ScoreColumn === null ||
		player2ScoreColumn === null ||
		baseMinutes === null ||
		!Number.isInteger(spacing) ||
		spacing < 0
	) {
		return {
			games,
			errors,
		};
	}

	const gamesPerDate =
		new Map<string, number>();

	for (
		let index = 0;
		index < data.rows.length;
		index++
	) {
		const row = data.rows[index];

		if (!row) {
			continue;
		}

		const csvRowNumber =
			index + 2;

		const date =
			parseCsvDate(
				row[dateColumn] ?? '',
			);

		if (!date) {
			errors.push(
				`Row ${csvRowNumber}: invalid date "${row[dateColumn] ?? ''}".`,
			);

			continue;
		}

		const sameDayIndex =
			gamesPerDate.get(date) ?? 0;

		const gameMinutes =
			baseMinutes +
			spacing * sameDayIndex;

		if (gameMinutes >= 24 * 60) {
			errors.push(
				`Row ${csvRowNumber}: generated time passes midnight.`,
			);

			continue;
		}

		const score1 =
			parseRequiredInteger(
				row[
					player1ScoreColumn
				] ?? '',
			);

		const score2 =
			parseRequiredInteger(
				row[
					player2ScoreColumn
				] ?? '',
			);

		if (score1 === null) {
			errors.push(
				`Row ${csvRowNumber}: invalid Player 1 score.`,
			);

			continue;
		}

		if (score2 === null) {
			errors.push(
				`Row ${csvRowNumber}: invalid Player 2 score.`,
			);

			continue;
		}

		const high1 =
			player1HighColumn === null
				? null
				: parseOptionalInteger(
						row[
							player1HighColumn
						] ?? '',
					);

		const high2 =
			player2HighColumn === null
				? null
				: parseOptionalInteger(
						row[
							player2HighColumn
						] ?? '',
					);

		if (high1 === undefined) {
			errors.push(
				`Row ${csvRowNumber}: invalid Player 1 high hand.`,
			);

			continue;
		}

		if (high2 === undefined) {
			errors.push(
				`Row ${csvRowNumber}: invalid Player 2 high hand.`,
			);

			continue;
		}

		const dealerResult =
			parseDealer(
				firstDealerColumn === null
					? ''
					: row[
							firstDealerColumn
						] ?? '',
				player1,
				player2,
			);

		if (dealerResult === undefined) {
			errors.push(
				`Row ${csvRowNumber}: first dealer does not match "${player1}" or "${player2}".`,
			);

			continue;
		}

		gamesPerDate.set(
			date,
			sameDayIndex + 1,
		);

		games.push({
			playedDate: date,
			playedTime:
				formatMinutes(
					gameMinutes,
				),
			player1,
			player2,
			firstDealer:
				dealerResult,
			player1Score: score1,
			player2Score: score2,
			player1HighHandManual:
				high1,
			player2HighHandManual:
				high2,
            handDataIncomplete: true,
		});
	}

	return {
		games,
		errors,
	};
}

function inferColumns(
	headers: string[],
): {
	player1Name: string;
	player2Name: string;
	date: number | null;
	firstDealer: number | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHand: number | null;
	player2HighHand: number | null;
} {
	const normalized =
		headers.map(normalizeHeader);

	const date =
		findHeader(
			normalized,
			['date'],
		);

	const firstDealer =
		findHeader(
			normalized,
			[
				'first deal',
				'first dealer',
			],
		);

	const scoreColumns =
		headers
			.map(
				(header, index) => ({
					header,
					index,
				}),
			)
			.filter(
				(item) =>
					/\bscore\b/i.test(
						item.header,
					) &&
					!/\bhigh\b/i.test(
						item.header,
					),
			);

	let player1Name = '';
	let player2Name = '';

	if (scoreColumns.length >= 2) {
		player1Name =
			scoreColumns[0]
				?.header.replace(
					/\s+score\s*$/i,
					'',
				)
				.trim() ?? '';

		player2Name =
			scoreColumns[1]
				?.header.replace(
					/\s+score\s*$/i,
					'',
				)
				.trim() ?? '';
	}

	const player1Score =
		findPlayerColumn(
			headers,
			player1Name,
			'score',
		) ??
		scoreColumns[0]?.index ??
		null;

	const player2Score =
		findPlayerColumn(
			headers,
			player2Name,
			'score',
		) ??
		scoreColumns[1]?.index ??
		null;

	const player1HighHand =
		findPlayerColumn(
			headers,
			player1Name,
			'high hand',
		);

	const player2HighHand =
		findPlayerColumn(
			headers,
			player2Name,
			'high hand',
		);

	return {
		player1Name,
		player2Name,
		date,
		firstDealer,
		player1Score,
		player2Score,
		player1HighHand,
		player2HighHand,
	};
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

function getRequiredColumn(
	select: HTMLSelectElement,
): number | null {
	if (select.value === '') {
		return null;
	}

	const value =
		Number(select.value);

	return Number.isInteger(value)
		? value
		: null;
}

function getOptionalColumn(
	select: HTMLSelectElement,
): number | null {
	return getRequiredColumn(select);
}

function parseDealer(
	value: string,
	player1: string,
	player2: string,
): 1 | 2 | null | undefined {
	const trimmed =
		value.trim();

	if (!trimmed) {
		return null;
	}

	const normalized =
		trimmed.toLocaleLowerCase();

	if (
		normalized ===
			player1.toLocaleLowerCase() ||
		normalized === '1' ||
		normalized === 'p1' ||
		normalized === 'player 1'
	) {
		return 1;
	}

	if (
		normalized ===
			player2.toLocaleLowerCase() ||
		normalized === '2' ||
		normalized === 'p2' ||
		normalized === 'player 2'
	) {
		return 2;
	}

	return undefined;
}

function parseRequiredInteger(
	value: string,
): number | null {
	const parsed =
		parseOptionalInteger(value);

	return typeof parsed === 'number'
		? parsed
		: null;
}

function parseOptionalInteger(
	value: string,
): number | null | undefined {
	const trimmed =
		value.trim();

	if (!trimmed) {
		return null;
	}

	const parsed =
		Number(trimmed);

	if (
		!Number.isInteger(parsed) ||
		parsed < 0
	) {
		return undefined;
	}

	return parsed;
}

function parseCsvDate(
	value: string,
): string | null {
	const trimmed =
		value.trim();

	const iso =
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/
			.exec(trimmed);

	if (iso) {
		return validateAndFormatDate(
			Number(iso[1]),
			Number(iso[2]),
			Number(iso[3]),
		);
	}

	const us =
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
			.exec(trimmed);

	if (us) {
		return validateAndFormatDate(
			Number(us[3]),
			Number(us[1]),
			Number(us[2]),
		);
	}

	return null;
}

function validateAndFormatDate(
	year: number,
	month: number,
	day: number,
): string | null {
	const date =
		new Date(
			Date.UTC(
				year,
				month - 1,
				day,
			),
		);

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !==
			month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	return [
		String(year).padStart(4, '0'),
		String(month).padStart(2, '0'),
		String(day).padStart(2, '0'),
	].join('-');
}

function parseTimeToMinutes(
	value: string,
): number | null {
	const match =
		/^(\d{1,2}):(\d{2})$/
			.exec(value.trim());

	if (!match) {
		return null;
	}

	const hours =
		Number(match[1]);

	const minutes =
		Number(match[2]);

	if (
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return hours * 60 + minutes;
}

function formatMinutes(
	total: number,
): string {
	const hours =
		Math.floor(total / 60);

	const minutes =
		total % 60;

	return (
		`${String(hours).padStart(2, '0')}:` +
		`${String(minutes).padStart(2, '0')}`
	);
}

function normalizeHeader(
	value: string,
): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, ' ');
}

function findHeader(
	headers: string[],
	candidates: string[],
): number | null {
	for (const candidate of candidates) {
		const index =
			headers.indexOf(
				candidate.toLocaleLowerCase(),
			);

		if (index >= 0) {
			return index;
		}
	}

	return null;
}

function findPlayerColumn(
	headers: string[],
	player: string,
	suffix: string,
): number | null {
	if (!player) {
		return null;
	}

	const target =
		normalizeHeader(
			`${player} ${suffix}`,
		);

	const index =
		headers.findIndex(
			(header) =>
				normalizeHeader(header) ===
				target,
		);

	return index >= 0
		? index
		: null;
}

function parseCsv(
	text: string,
): string[][] {
	const source =
		text.replace(/^\uFEFF/, '');

	const rows: string[][] = [];

	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (
		let index = 0;
		index < source.length;
		index++
	) {
		const char =
			source[index];

		if (quoted) {
			if (char === '"') {
				if (
					source[index + 1] ===
					'"'
				) {
					field += '"';
					index++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}

			continue;
		}

		if (char === '"') {
			quoted = true;
			continue;
		}

		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}

		if (
			char === '\n' ||
			char === '\r'
		) {
			if (
				char === '\r' &&
				source[index + 1] === '\n'
			) {
				index++;
			}

			row.push(field);
			rows.push(row);

			row = [];
			field = '';

			continue;
		}

		field += char;
	}

	row.push(field);

	if (
		row.length > 1 ||
		row[0]?.trim() !== ''
	) {
		rows.push(row);
	}

	return rows;
}