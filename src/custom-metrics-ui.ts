import { Notice } from 'obsidian';

import type CribbageTrackerPlugin from './main';

import type {
	CustomMetricCalculationMode,
	CustomMetricDataSource,
	CustomMetricFormatMode,
	CustomMetricInput,
	CustomMetricMatchupMode,
	CustomMetricRecord,
} from './database';

import {
	evaluateBuilderMetric,
	evaluateHandsBuilderMetric,
	evaluateSqlMetric,
	formatMetricResult,
	type MetricEvaluationScope,
} from './custom-metric-evaluator';

import {
	evaluateCustomFormat,
} from './custom-metric-formatter';

export function renderCustomMetricsPage(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
): void {
	const pageContainer = container.createDiv('cribbage-custom-metrics-page');

	const page = new CustomMetricsPage(pageContainer, plugin);

	page.render();
}

class CustomMetricsPage {
	private editingId: string | null = null;

	private showEditor = false;

	constructor(
		private container: HTMLElement,

		private plugin: CribbageTrackerPlugin,
	) {}

	render(): void {
        this.container.empty();

		const header = this.container.createDiv(
			'cribbage-custom-metric-header',
		);

		header.createEl('h2', {
			text: 'Custom Metrics',
		});

		const newButton = header.createEl('button', {
			text: '+ New Metric',
			cls: 'mod-cta',
		});

		newButton.addEventListener('click', () => {
			this.editingId = null;

			this.showEditor = true;

			this.render();
		});

		const metrics = this.plugin.database.listCustomMetrics();

		this.renderMetricList(metrics);

		if (this.showEditor) {
			const editing =
				this.editingId === null
					? null
					: (metrics.find((metric) => metric.id === this.editingId) ??
						null);

			this.renderEditor(editing);
		}
	}

	private renderMetricList(metrics: CustomMetricRecord[]): void {
		const panel = this.container.createDiv('cribbage-panel');

		panel.createEl('h3', {
			text: 'Saved Metrics',
		});

		if (metrics.length === 0) {
			panel.createEl('p', {
				text: 'No custom metrics created yet.',
				cls: 'cribbage-empty-state',
			});

			return;
		}

		const scroll = panel.createDiv('cribbage-table-scroll');

		const table = scroll.createEl('table', {
			cls: 'cribbage-table',
		});

		const header = table.createEl('thead').createEl('tr');

		for (const label of [
			'Metric',
			'Calculation',
			'Format',
			'Screens',
			'Status',
			'',
		]) {
			header.createEl('th', {
				text: label,
			});
		}

		const body = table.createEl('tbody');

		for (const metric of metrics) {
			const row = body.createEl('tr');

			row.createEl('td', {
				text: metric.name,
			});

			row.createEl('td', {
				text:
					metric.calculationMode === 'sql'
						? 'Advanced SQL'
						: 'Builder',
			});

			row.createEl('td', {
				text: formatModeName(metric.formatMode),
			});

			row.createEl('td', {
				text: getScreenSummary(metric),
			});

			row.createEl('td', {
				text: metric.enabled ? 'Enabled' : 'Disabled',
			});

			const actions = row.createEl('td');

			const group = actions.createDiv('cribbage-row-actions');

			const edit = group.createEl('button', {
				text: 'Edit',
			});

			edit.addEventListener('click', () => {
				this.editingId = metric.id;

				this.showEditor = true;

				this.render();
			});

			const remove = group.createEl('button', {
				text: 'Delete',
				cls: 'cribbage-delete-button',
			});

			remove.addEventListener('click', async () => {
				if (!window.confirm(`Delete "${metric.name}"?`)) {
					return;
				}

				try {
					await this.plugin.database.deleteCustomMetric(metric.id);

					new Notice('Custom metric deleted.');

					this.render();
				} catch (error) {
					console.error(error);

					new Notice('Could not delete custom metric.');
				}
			});
		}
	}

	private renderEditor(metric: CustomMetricRecord | null): void {
		const panel = this.container.createDiv('cribbage-panel');

		panel.createEl('h3', {
			text: metric === null ? 'New Metric' : `Edit: ${metric.name}`,
		});

		const grid = panel.createDiv('cribbage-custom-metric-grid');

		const name = createTextField(grid, 'Metric name', metric?.name ?? '');

		const dataSource = createSelectField(
			grid,
			'Data source',
            [
                [
                    'games',
                    'Games',
                ],
                [
                    'hands',
                    'Hands',
                ],
            ],
			metric?.dataSource ?? 'games',
		);

		const calculationMode = createSelectField(
			grid,
			'Calculation mode',
			[
				['builder', 'Metric Builder'],
				['sql', 'Advanced SQL'],
			],
			metric?.calculationMode ?? 'builder',
		);

		const enabled = createCheckboxField(
			grid,
			'Enabled',
			metric?.enabled ?? true,
		);

		const calculationArea = panel.createDiv();

		const builderArea = calculationArea.createDiv();

		builderArea.createEl('h4', {
			text: 'Builder Formula',
		});

        builderArea.createEl('p', {
            text:
                'Games fields: Score, OpponentScore, Margin, ScoreDifferential, Won, Lost, HighHand, OpponentHighHand, HigherHighHand, DealerFirst, PoneFirst, Skunk, DoubleSkunk, HandDataComplete.',
            cls:
                'setting-item-description',
        });

        builderArea.createEl('p', {
            text:
                'Hands fields: HandPoints, OpponentHandPoints, CribPoints, RoundCribPoints, HandNumber, Dealer, Pone, LastHand, EligibleHand, HandDataComplete.',
            cls:
                'setting-item-description',
        });

        builderArea.createEl('p', {
            text:
                'Functions: COUNT, COUNTIF, SUM, SUMIF, AVERAGE, AVERAGEIF, MIN, MAX. Conditions support AND, OR, NOT, comparisons, TRUE, FALSE, and NULL.',
            cls:
                'setting-item-description',
        });

		const builderFormula = builderArea.createEl('textarea', {
			cls: 'cribbage-custom-textarea',
		});

		builderFormula.value = metric?.builderFormula ?? '';

		builderFormula.placeholder = 'Example: COUNTIF(HighHand >= 20)';

		const sqlArea = calculationArea.createDiv();

		sqlArea.createEl('h4', {
			text: 'Advanced SQL',
		});

		sqlArea.createEl('div', {
			text: 'Warning: Advanced SQL bypasses the metric builder and its logical guardrails. Incorrect or expensive queries may produce unexpected results. SQL evaluation will run against an isolated copy of the database rather than the live database.',
			cls: 'cribbage-custom-warning',
		});

        sqlArea.createEl('p', {
            text:
                'Recommended table: metric_games or metric_hands. It contains one player-perspective row per applicable game (or hand) and is automatically filtered to the current Global, Player, or Matchup preview scope.',
            cls:
                'setting-item-description',
        });

        sqlArea.createEl('p', {
            text:
                'metric_games columns: game_id, played_date, played_time, player, opponent, player_side, score, opponent_score, margin, score_differential, won, lost, high_hand, opponent_high_hand, higher_high_hand, dealer_first, pone_first, skunk, double_skunk, hand_data_complete.',
            cls:
                'setting-item-description',
        });

        sqlArea.createEl('p', {
            text:
                'metric_hands columns: game_id, hand_id, played_date, played_time, player, opponent, player_side, hand_number, hand_points, opponent_hand_points, crib_points, round_crib_points, dealer, pone, last_hand, eligible_hand, hand_data_complete.',
            cls:
                'setting-item-description',
        });

        sqlArea.createEl('p', {
            text:
                'The single-row metric_context table also exposes: scope, selected_player, matchup_player_1, matchup_player_2, subject_player.',
            cls:
                'setting-item-description',
        });

		const sqlQuery = sqlArea.createEl('textarea', {
			cls: 'cribbage-custom-textarea cribbage-custom-sql',
		});

		sqlQuery.value = metric?.sqlQuery ?? '';

        sqlQuery.placeholder =
            'SELECT COUNT(*) FROM metric_games WHERE high_hand >= 20;';

		panel.createEl('h4', {
			text: 'Show On',
		});

		const screens = panel.createDiv('cribbage-custom-checkbox-grid');

		const showGlobal = createCheckboxField(
			screens,
			'Global',
			metric?.showGlobal ?? true,
		);

		const showPlayer = createCheckboxField(
			screens,
			'Player',
			metric?.showPlayer ?? true,
		);

		const showMatchup = createCheckboxField(
			screens,
			'Matchup',
			metric?.showMatchup ?? true,
		);

		const matchupMode = createSelectField(
			panel,
			'Matchup display',
			[
				['combined', 'Combined'],
				['per_player', 'Per player'],
			],
			metric?.matchupMode ?? 'combined',
		);

		panel.createEl('h4', {
			text: 'Display Formatting',
		});

		const formatGrid = panel.createDiv('cribbage-custom-metric-grid');

		const formatMode = createSelectField(
			formatGrid,
			'Format',
			[
				['integer', 'Integer'],
				['decimal', 'Decimal'],
				['percentage', 'Percentage'],
				['custom', 'Custom'],
			],
			metric?.formatMode ?? 'decimal',
		);

		const decimalPlaces = createNumberField(
			formatGrid,
			'Decimal places',
			metric?.decimalPlaces ?? 2,
			0,
			12,
		);

		const prefix = createTextField(
			formatGrid,
			'Prefix',
			metric?.prefix ?? '',
		);

		const suffix = createTextField(
			formatGrid,
			'Suffix',
			metric?.suffix ?? '',
		);

		const customFormatArea = panel.createDiv();

		customFormatArea.createEl('div', {
			text: 'Warning: Custom formatting bypasses the stock number formats. Invalid expressions may produce unexpected output. The formatter will use a restricted formatting language rather than arbitrary JavaScript.',
			cls: 'cribbage-custom-warning',
		});

		const formatExpression = customFormatArea.createEl('textarea', {
			cls: 'cribbage-custom-textarea',
		});

		formatExpression.value = metric?.formatExpression ?? '';

        formatExpression.placeholder =
            'Example: IF(VALUE >= 10, "🔥 " + FIXED(VALUE, 3), INTEGER(VALUE) + "x")';

        customFormatArea.createEl('p', {
            text:
                'VALUE is the raw numeric metric result. Functions: IF, ROUND, FIXED, INTEGER, PERCENT, ABS, MIN, MAX. Strings may use single or double quotes. Operators: +, -, *, /, comparisons, AND, OR, NOT.',
            cls:
                'setting-item-description',
        });

		const order = createNumberField(
			formatGrid,
			'Sort order',
			metric?.sortOrder ?? 0,
			0,
			9999,
		);

        const preview =
            panel.createDiv(
                'cribbage-custom-preview',
            );

        preview.createEl('h4', {
            text: 'Preview',
        });

        const players =
            this.plugin.database
                .getPlayerNames();

        const previewControls =
            preview.createDiv(
                'cribbage-custom-preview-controls',
            );

        let previewPlayer:
            HTMLSelectElement | null = null;

        let previewMatchup1:
            HTMLSelectElement | null = null;

        let previewMatchup2:
            HTMLSelectElement | null = null;

        if (players.length > 0) {
            previewPlayer =
                createSelectField(
                    previewControls,
                    'Player',
                    players.map(
                        (player) => [
                            player,
                            player,
                        ],
                    ),
                    players[0] ?? '',
                );

            previewMatchup1 =
                createSelectField(
                    previewControls,
                    'Matchup player 1',
                    players.map(
                        (player) => [
                            player,
                            player,
                        ],
                    ),
                    players[0] ?? '',
                );

            previewMatchup2 =
                createSelectField(
                    previewControls,
                    'Matchup player 2',
                    players.map(
                        (player) => [
                            player,
                            player,
                        ],
                    ),
                    players[1] ??
                        players[0] ??
                        '',
                );
        }

        const previewResults =
            preview.createDiv(
                'cribbage-custom-preview-results',
            );

        const updatePreview = () => {
            previewResults.empty();

            const games =
                this.plugin.database
                    .listGamesForStatistics();

            const hands =
                this.plugin.database
                    .listHandsForStatistics();

            const useSql =
                calculationMode.value ===
                'sql';

            const formula =
                useSql
                    ? sqlQuery.value.trim()
                    : builderFormula.value.trim();

            if (!formula) {
                previewResults.createEl('p', {
                    text:
                        useSql
                            ? 'Enter an SQL query to preview it.'
                            : 'Enter a builder formula to preview it.',
                    cls:
                        'setting-item-description',
                });

                return;
            }

            const evaluate = (
                scope: MetricEvaluationScope,
            ) => {
                if (useSql) {
                    return evaluateSqlMetric(
                        this.plugin.database,
                        formula,
                        games,
                        hands,
                        scope,
                    );
                }

                if (
                    dataSource.value ===
                    'hands'
                ) {
                    return evaluateHandsBuilderMetric(
                        formula,
                        hands,
                        scope,
                    );
                }

                return evaluateBuilderMetric(
                    formula,
                    games,
                    scope,
                );
            };

            const renderResult = (
                label: string,
                result: ReturnType<
                    typeof evaluateBuilderMetric
                >,
            ) => {
                const row =
                    previewResults.createDiv(
                        'cribbage-custom-preview-row',
                    );

                const labelArea =
                    row.createDiv();

                labelArea.createEl('span', {
                    text: label,
                });

                labelArea.createEl('div', {
                    text:
                        `${result.observationCount} scoped observations`,
                    cls:
                        'cribbage-custom-preview-count',
                });

                if (result.error) {
                    row.createEl('strong', {
                        text:
                            `Error: ${result.error}`,
                        cls:
                            'cribbage-preview-error',
                    });

                    return;
                }

                if (
                    formatMode.value ===
                    'custom'
                ) {
                    const custom =
                        evaluateCustomFormat(
                            result.value,
                            formatExpression.value,
                            prefix.value,
                            suffix.value,
                        );

                    if (custom.error) {
                        row.createEl('strong', {
                            text:
                                `Format error: ${custom.error}`,
                            cls:
                                'cribbage-preview-error',
                        });

                        return;
                    }

                    const valueArea =
                        row.createDiv(
                            'cribbage-custom-preview-value',
                        );

                    valueArea.createEl('strong', {
                        text: custom.text,
                    });

                    valueArea.createEl('div', {
                        text:
                            `Raw: ${
                                result.value === null
                                    ? 'NULL'
                                    : String(
                                            result.value,
                                        )
                            }`,
                        cls:
                            'cribbage-custom-preview-count',
                    });

                    return;
                }

                row.createEl('strong', {
                    text:
                        formatMetricResult(
                            result.value,
                            formatMode.value as
                                CustomMetricFormatMode,
                            Number(
                                decimalPlaces.value,
                            ) || 0,
                            prefix.value,
                            suffix.value,
                        ),
                });
            };

            renderResult(
                'Global',
                evaluate({
                    type: 'global',
                }),
            );

            if (
                previewPlayer &&
                previewPlayer.value
            ) {
                renderResult(
                    `Player — ${previewPlayer.value}`,

                    evaluate({
                        type: 'player',

                        player:
                            previewPlayer.value,
                    }),
                );
            }

            if (
                previewMatchup1 &&
                previewMatchup2 &&
                previewMatchup1.value &&
                previewMatchup2.value
            ) {
                if (
                    previewMatchup1.value ===
                    previewMatchup2.value
                ) {
                    const row =
                        previewResults.createDiv(
                            'cribbage-custom-preview-row',
                        );

                    row.createEl('span', {
                        text: 'Matchup',
                    });

                    row.createEl('strong', {
                        text:
                            'Choose two different players.',
                        cls:
                            'cribbage-preview-error',
                    });

                    return;
                }

                if (
                    matchupMode.value ===
                    'combined'
                ) {
                    renderResult(
                        `${previewMatchup1.value} vs ${previewMatchup2.value}`,

                        evaluate({
                            type:
                                'matchup',

                            player1:
                                previewMatchup1.value,

                            player2:
                                previewMatchup2.value,
                        }),
                    );
                } else {
                    renderResult(
                        `${previewMatchup1.value} vs ${previewMatchup2.value} — ${previewMatchup1.value}`,

                        evaluate({
                            type:
                                'matchup',

                            player1:
                                previewMatchup1.value,

                            player2:
                                previewMatchup2.value,

                            subject:
                                previewMatchup1.value,
                        }),
                    );

                    renderResult(
                        `${previewMatchup1.value} vs ${previewMatchup2.value} — ${previewMatchup2.value}`,

                        evaluate({
                            type:
                                'matchup',

                            player1:
                                previewMatchup1.value,

                            player2:
                                previewMatchup2.value,

                            subject:
                                previewMatchup2.value,
                        }),
                    );
                }
            }
        };

		const updateVisibility = () => {
			const mode = calculationMode.value;

			builderArea.toggleClass('cribbage-hidden', mode !== 'builder');

			sqlArea.toggleClass('cribbage-hidden', mode !== 'sql');

			customFormatArea.toggleClass(
				'cribbage-hidden',
				formatMode.value !== 'custom',
			);

            decimalPlaces.disabled =
                formatMode.value === 'integer' ||
                formatMode.value === 'custom';

			matchupMode.parentElement?.toggleClass(
				'cribbage-hidden',
				!showMatchup.checked,
			);
		};

		calculationMode.addEventListener('change', updateVisibility);

		formatMode.addEventListener('change', updateVisibility);

		showMatchup.addEventListener('change', updateVisibility);

        for (const element of [
            builderFormula,
            sqlQuery,
            dataSource,
            calculationMode,
            formatMode,
            decimalPlaces,
            prefix,
            suffix,
            formatExpression,
            matchupMode,
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

        previewPlayer?.addEventListener(
            'change',
            updatePreview,
        );

        previewMatchup1?.addEventListener(
            'change',
            updatePreview,
        );

        previewMatchup2?.addEventListener(
            'change',
            updatePreview,
        );

		updateVisibility();

        updatePreview();

		const actions = panel.createDiv('cribbage-custom-editor-actions');

		const save = actions.createEl('button', {
			text: metric === null ? 'Create Metric' : 'Save Changes',
			cls: 'mod-cta',
		});

		const cancel = actions.createEl('button', {
			text: 'Cancel',
		});

		cancel.addEventListener('click', () => {
			this.editingId = null;

			this.showEditor = false;

			this.render();
		});

		save.addEventListener('click', async () => {
			const metricName = name.value.trim();

			if (!metricName) {
				new Notice('Metric name is required.');

				return;
			}

			const decimals = Number(decimalPlaces.value);

			const sortOrder = Number(order.value);

			if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
				new Notice(
					'Decimal places must be a whole number from 0 to 12.',
				);

				return;
			}

			if (!Number.isInteger(sortOrder) || sortOrder < 0) {
				new Notice(
					'Sort order must be a whole number of 0 or greater.',
				);

				return;
			}

			if (
				!showGlobal.checked &&
				!showPlayer.checked &&
				!showMatchup.checked
			) {
				new Notice('Choose at least one screen for this metric.');

				return;
			}

			const input: CustomMetricInput = {
				name: metricName,

				dataSource: dataSource.value as CustomMetricDataSource,

				calculationMode:
					calculationMode.value as CustomMetricCalculationMode,

				builderFormula: builderFormula.value,

				sqlQuery: sqlQuery.value,

				formatMode: formatMode.value as CustomMetricFormatMode,

				decimalPlaces: decimals,

				prefix: prefix.value,

				suffix: suffix.value,

				formatExpression: formatExpression.value,

				showGlobal: showGlobal.checked,

				showPlayer: showPlayer.checked,

				showMatchup: showMatchup.checked,

				matchupMode: matchupMode.value as CustomMetricMatchupMode,

				enabled: enabled.checked,

				sortOrder,
			};

			try {
				if (metric === null) {
					await this.plugin.database.createCustomMetric(input);

					new Notice('Custom metric created.');
				} else {
					await this.plugin.database.updateCustomMetric(
						metric.id,
						input,
					);

					new Notice('Custom metric updated.');
				}

				this.editingId = null;

				this.showEditor = false;

				this.render();
			} catch (error) {
				console.error(error);

				new Notice('Could not save custom metric.');
			}
		});
	}
}

function createTextField(
	container: HTMLElement,
	label: string,
	value: string,
): HTMLInputElement {
	const wrapper = container.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	const input = wrapper.createEl('input', {
		type: 'text',
	});

	input.value = value;

	return input;
}

function createNumberField(
	container: HTMLElement,
	label: string,
	value: number,
	min: number,
	max: number,
): HTMLInputElement {
	const wrapper = container.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	const input = wrapper.createEl('input', {
		type: 'number',
	});

	input.min = String(min);
	input.max = String(max);
	input.step = '1';
	input.value = String(value);

	return input;
}

function createSelectField(
	container: HTMLElement,
	label: string,
	options: [string, string][],
	value: string,
): HTMLSelectElement {
	const wrapper = container.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	const select = wrapper.createEl('select');

	for (const [optionValue, optionLabel] of options) {
		const option = select.createEl('option', {
			value: optionValue,

			text: optionLabel,
		});

		option.selected = optionValue === value;
	}

	return select;
}

function createCheckboxField(
	container: HTMLElement,
	label: string,
	checked: boolean,
): HTMLInputElement {
	const wrapper = container.createDiv('cribbage-custom-checkbox');

	const input = wrapper.createEl('input', {
		type: 'checkbox',
	});

	input.checked = checked;

	const text = wrapper.createEl('label', {
		text: label,
	});

	text.prepend(input);

	return input;
}

function formatModeName(mode: CustomMetricFormatMode): string {
	if (mode === 'integer') {
		return 'Integer';
	}

	if (mode === 'percentage') {
		return 'Percentage';
	}

	if (mode === 'custom') {
		return 'Custom';
	}

	return 'Decimal';
}

function getScreenSummary(metric: CustomMetricRecord): string {
	const screens: string[] = [];

	if (metric.showGlobal) {
		screens.push('G');
	}

	if (metric.showPlayer) {
		screens.push('P');
	}

	if (metric.showMatchup) {
		screens.push('M');
	}

	return screens.join(' / ');
}
