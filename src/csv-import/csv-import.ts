import {
	Notice,
} from 'obsidian';

import type {
	CribbageTrackerPluginContext,
} from '../plugin-context';

import {
	parseCsv,
} from './parser';

import {
	renderConfiguration,
} from './ui';

import type {
	CsvData,
} from './types';

export function renderCsvImporter(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	onImported: () => void,
): void {
	const panel =
		container.createEl('details', {
			cls:
				'cribbage-panel cribbage-import-panel',
		});

	panel.createEl('summary', {
		text: 'Import games from CSV',
	});

	const body =
		panel.createDiv(
			'cribbage-import-body',
		);

	body.createEl('p', {
		text:
			'Import historical games from a CSV file. ' +
			'Columns can be mapped after selecting the file.',
		cls: 'setting-item-description',
	});

	const fileField =
		body.createDiv(
			'cribbage-form-field',
		);

	fileField.createEl('label', {
		text: 'CSV file',
	});

	const fileInput =
		fileField.createEl('input', {
			type: 'file',
		});

	fileInput.accept =
		'.csv,text/csv';

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
					const text =
						await file.text();

					const parsed =
						parseCsv(text);

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
						fileName:
							file.name,
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