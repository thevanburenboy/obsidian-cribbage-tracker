import type CribbageTrackerPlugin
	from './main';

import type {
	CustomMetricRecord,
	GameStatisticsRecord,
} from './database';

import {
	evaluateBuilderMetric,
	formatMetricResult,
	type MetricEvaluationScope,
} from './custom-metric-evaluator';

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

	if (metrics.length === 0) {
		return;
	}

	const section =
		container.createDiv(
			'cribbage-custom-statistics-section',
		);

	section.createEl('h3', {
		text: 'Custom Statistics',
	});

	const grid =
		section.createDiv(
			'cribbage-stat-grid',
		);

	for (const metric of metrics) {
		renderMetric(
			grid,
			metric,
			games,
			scope,
		);
	}
}

function renderMetric(
	container: HTMLElement,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
	scope: CustomMetricStatisticsScope,
): void {
	const card =
		container.createDiv(
			'cribbage-stat-card',
		);

	card.createEl('span', {
		text: metric.name,
		cls: 'cribbage-stat-label',
	});

	if (metric.dataSource !== 'games') {
		renderUnavailable(
			card,
			'Hands metrics are not implemented yet.',
		);

		return;
	}

	if (
		metric.calculationMode === 'sql'
	) {
		renderUnavailable(
			card,
			'Advanced SQL evaluation is coming next.',
		);

		return;
	}

	if (
		scope.type === 'matchup' &&
		metric.matchupMode ===
			'per_player'
	) {
		renderPerPlayerMatchup(
			card,
			metric,
			games,
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
		metric,
		games,
		evaluationScope,
	);
}

function renderSingleResult(
	card: HTMLElement,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
	scope: MetricEvaluationScope,
): void {
	const result =
		evaluateBuilderMetric(
			metric.builderFormula,
			games,
			scope,
		);

	if (result.error) {
		card.createEl('strong', {
			text: 'Error',
			cls:
				'cribbage-stat-value cribbage-preview-error',
		});

		card.createEl('span', {
			text: result.error,
			cls:
				'cribbage-stat-subtext',
		});

		return;
	}

	const formatted =
		formatMetricResult(
			result.value,
			metric.formatMode,
			metric.decimalPlaces,
			metric.prefix,
			metric.suffix,
		);

	card.createEl('strong', {
		text: formatted,
		cls: 'cribbage-stat-value',
	});

	if (
		metric.formatMode === 'custom'
	) {
		card.createEl('span', {
			text:
				'Custom formatter not yet applied; showing raw value.',
			cls:
				'cribbage-stat-subtext',
		});
	}
}

function renderPerPlayerMatchup(
	card: HTMLElement,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
	player1: string,
	player2: string,
): void {
	const values =
		card.createDiv(
			'cribbage-custom-matchup-values',
		);

	renderPlayerResult(
		values,
		metric,
		games,
		player1,
		player1,
		player2,
	);

	renderPlayerResult(
		values,
		metric,
		games,
		player2,
		player1,
		player2,
	);
}

function renderPlayerResult(
	container: HTMLElement,
	metric: CustomMetricRecord,
	games: GameStatisticsRecord[],
	subject: string,
	player1: string,
	player2: string,
): void {
	const row =
		container.createDiv(
			'cribbage-custom-matchup-value',
		);

	row.createEl('span', {
		text: subject,
		cls:
			'cribbage-custom-matchup-player',
	});

	const result =
		evaluateBuilderMetric(
			metric.builderFormula,
			games,
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

function renderUnavailable(
	card: HTMLElement,
	message: string,
): void {
	card.createEl('strong', {
		text: 'Not available yet',
		cls: 'cribbage-stat-value',
	});

	card.createEl('span', {
		text: message,
		cls:
			'cribbage-stat-subtext',
	});
}