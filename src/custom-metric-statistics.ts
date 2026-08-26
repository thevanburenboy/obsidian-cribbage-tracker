import type CribbageTrackerPlugin
	from './main';

import type {
	CustomMetricRecord,
	GameStatisticsRecord,
    HandStatisticsRecord,
} from './database';

import {
	evaluateBuilderMetric,
	evaluateSqlMetric,
	formatMetricResult,
    evaluateHandsBuilderMetric,
	type MetricEvaluationScope,
} from './custom-metric-evaluator';

import {
	evaluateCustomFormat,
} from './custom-metric-formatter';

export type CustomMetricStatisticsScope =
	| {
			type: 'global';
	  }
	| {
			type: 'player';
			player: string;
	  }
	| {
			type: 'matchup';
			player1: string;
			player2: string;
	  };

export function renderCustomMetricStatistics(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	games: GameStatisticsRecord[],
	scope: CustomMetricStatisticsScope,
): void {
	const metrics =
		plugin.database
			.listCustomMetrics()
			.filter(
				(metric) =>
					metric.enabled &&
					metricAppliesToScope(
						metric,
						scope,
					),
			);

    const hands =
        plugin.database
            .listHandsForStatistics();

	if (metrics.length === 0) {
		return;
	}

	const section =
		container.createDiv(
			'cribbage-custom-statistics-section',
		);

	section.createEl('h3', {
		text: 'Custom statistics',
	});

	const grid =
		section.createDiv(
			'cribbage-stat-grid',
		);

	for (const metric of metrics) {
		renderMetric(
			grid,
            plugin,
			metric,
			games,
            hands,
			scope,
		);
	}
}

function renderMetric(
	container: HTMLElement,
    plugin: CribbageTrackerPlugin,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
    hands: HandStatisticsRecord[],
	scope: CustomMetricStatisticsScope,
): void {
	const card =
		container.createDiv(
			'cribbage-stat-card',
		);

	card.createSpan({
		text: metric.name,
		cls: 'cribbage-stat-label',
	});

	if (
		scope.type === 'matchup' &&
		metric.matchupMode ===
			'per_player'
	) {
		renderPerPlayerMatchup(
			card,
            plugin,
			metric,
			games,
            hands,
			scope.player1,
			scope.player2,
		);

		return;
	}

	const evaluationScope =
		toEvaluationScope(
			scope,
		);

	renderSingleResult(
		card,
        plugin,
		metric,
		games,
        hands,
		evaluationScope,
	);
}

function renderSingleResult(
	card: HTMLElement,
	plugin: CribbageTrackerPlugin,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
    hands: HandStatisticsRecord[],
	scope: MetricEvaluationScope,
): void {
	const result =
		evaluateCustomMetric(
			plugin,
			metric,
			games,
            hands,
			scope,
		);

	if (result.error) {
		card.createEl('strong', {
			text: 'Error',
			cls:
				'cribbage-stat-value cribbage-preview-error',
		});

		card.createSpan({
			text: result.error,
			cls:
				'cribbage-stat-subtext',
		});

		return;
	}

    if (
        metric.formatMode === 'custom'
    ) {
        const custom =
            evaluateCustomFormat(
                result.value,
                metric.formatExpression,
                metric.prefix,
                metric.suffix,
            );

        if (custom.error) {
            card.createEl('strong', {
                text: 'Format error',
                cls:
                    'cribbage-stat-value cribbage-preview-error',
            });

            card.createSpan({
                text: custom.error,
                cls:
                    'cribbage-stat-subtext',
            });

            return;
        }

        card.createEl('strong', {
            text: custom.text,
            cls:
                'cribbage-stat-value',
        });

        return;
    }

    card.createEl('strong', {
        text:
            formatMetricResult(
                result.value,
                metric.formatMode,
                metric.decimalPlaces,
                metric.prefix,
                metric.suffix,
            ),
        cls: 'cribbage-stat-value',
    });
}

function renderPerPlayerMatchup(
	card: HTMLElement,
	plugin: CribbageTrackerPlugin,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
    hands: HandStatisticsRecord[],
	player1: string,
	player2: string,
): void {
	const values =
		card.createDiv(
			'cribbage-custom-matchup-values',
		);

	renderPlayerResult(
		values,
		plugin,
		metric,
		games,
        hands,
		player1,
		player1,
		player2,
	);

	renderPlayerResult(
		values,
        plugin,
		metric,
		games,
        hands,
		player2,
		player1,
		player2,
	);
}

function renderPlayerResult(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
    hands: HandStatisticsRecord[],
	subject: string,
	player1: string,
	player2: string,
): void {
	const row =
		container.createDiv(
			'cribbage-custom-matchup-value',
		);

	row.createSpan({
		text: subject,
		cls:
			'cribbage-custom-matchup-player',
	});

	const result =
		evaluateCustomMetric(
			plugin,
			metric,
			games,
            hands,
			{
				type: 'matchup',
				player1,
				player2,
				subject,
			},
		);

	if (result.error) {
		row.createEl('strong', {
			text: 'Error',
			cls:
				'cribbage-preview-error',
		});

		return;
	}

    if (
        metric.formatMode === 'custom'
    ) {
        const custom =
            evaluateCustomFormat(
                result.value,
                metric.formatExpression,
                metric.prefix,
                metric.suffix,
            );

        if (custom.error) {
            row.createEl('strong', {
                text:
                    'Format error',
                cls:
                    'cribbage-preview-error',
            });

            return;
        }

        row.createEl('strong', {
            text: custom.text,
        });

        return;
    }

    row.createEl('strong', {
        text:
            formatMetricResult(
                result.value,
                metric.formatMode,
                metric.decimalPlaces,
                metric.prefix,
                metric.suffix,
            ),
    });
}

function metricAppliesToScope(
	metric: CustomMetricRecord,
	scope: CustomMetricStatisticsScope,
): boolean {
	if (scope.type === 'global') {
		return metric.showGlobal;
	}

	if (scope.type === 'player') {
		return metric.showPlayer;
	}

	return metric.showMatchup;
}

function toEvaluationScope(
	scope: CustomMetricStatisticsScope,
): MetricEvaluationScope {
	if (scope.type === 'global') {
		return {
			type: 'global',
		};
	}

	if (scope.type === 'player') {
		return {
			type: 'player',
			player: scope.player,
		};
	}

	return {
		type: 'matchup',
		player1: scope.player1,
		player2: scope.player2,
	};
}

function evaluateCustomMetric(
	plugin: CribbageTrackerPlugin,
	metric: CustomMetricRecord,

	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],

	scope: MetricEvaluationScope,
) {
	if (
		metric.calculationMode ===
		'sql'
	) {
		return evaluateSqlMetric(
			plugin.database,
			metric.sqlQuery,
			games,
			hands,
			scope,
		);
	}

	if (
		metric.dataSource ===
		'hands'
	) {
		return evaluateHandsBuilderMetric(
			metric.builderFormula,
			hands,
			scope,
		);
	}

	return evaluateBuilderMetric(
		metric.builderFormula,
		games,
		scope,
	);
}