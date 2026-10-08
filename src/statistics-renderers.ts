import type {
	CribbageTrackerPluginContext,
} from './plugin-context';

import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from './database';

import type {
	Metric,
	ScopedExtraStats,
	StatisticContext,
	PlayerStats,
} from './statistics-types';

import {
	calculateGlobalExtras,
	calculateGlobalHighHand,
	calculateGlobalHighHandExtremes,
	calculatePlayerStats,
	calculateScopedExtraStats,
} from './statistics-stats';

import {
	calculateGlobalStreakSummary,
	calculateStatisticContext,
} from './statistics-context';

import {
	buildHighHandWinObservations,
	buildMatchupHighHandWinObservations,
	renderHighHandWinTable,
	renderMarginDistributionTable,
} from './statistics-tables';

import {
	formatCountRate,
	formatNumber,
	formatPercent,
	formatRecord,
	formatScopedRecord,
	formatShare,
	formatStreak,
	formatValueWithCount,
	gameContainsPlayer,
	gameContainsPlayers,
	getParClass,
	getPluginHandPar,
	getPluginPeggingPar,
	hasCompletedScore,
	renderMetricGrid,
} from './statistics-utils';

import {
	renderCustomMetricStatistics,
} from './custom-metric-statistics';

export function renderGlobalStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
	plugin: CribbageTrackerPluginContext,
): void {
	const handPar = getPluginHandPar(plugin);
	const peggingPar = getPluginPeggingPar(plugin);

	const completed = games.filter(hasCompletedScore);

	const completeHands = games.filter(
		(game) => !game.handDataIncomplete && game.roundCount > 0,
	);

	const totalEligibleHandPoints = completeHands.reduce(
		(total, game) =>
			total + game.player1HandPointsEligible + game.player2HandPointsEligible,
		0,
	);

	const totalEligibleHands = completeHands.reduce(
		(total, game) => total + game.eligibleRoundCount * 2,
		0,
	);

	const totalCribPoints = completeHands.reduce(
		(total, game) =>
			total + game.player1CribPointsEligible + game.player2CribPointsEligible,
		0,
	);

	const totalCribs = completeHands.reduce(
		(total, game) =>
			total + game.player1EligibleCribCount + game.player2EligibleCribCount,
		0,
	);

	const totalPegging = completeHands.reduce(
		(total, game) =>
			total + game.player1PeggingPointsTotal + game.player2PeggingPointsTotal,
		0,
	);

	const totalPlayerRounds = completeHands.reduce(
		(total, game) => total + game.roundCount * 2,
		0,
	);

	const globalPointsPerHand =
		totalEligibleHands > 0 ? totalEligibleHandPoints / totalEligibleHands : null;

	const globalPointsPerCrib =
		totalCribs > 0 ? totalCribPoints / totalCribs : null;

	const globalPeggingPerRound =
		totalPlayerRounds > 0 ? totalPegging / totalPlayerRounds : null;

	const globalHighHand = calculateGlobalHighHand(games);
	const highHandExtremes = calculateGlobalHighHandExtremes(games);
	const globalExtras = calculateGlobalExtras(games);
	const context = calculateStatisticContext(games, null, null);

	const extraStats = calculateScopedExtraStats(games, hands, null, null);

	const longestWinStreak = calculateGlobalStreakSummary(games, 'W');
	const longestLossStreak = calculateGlobalStreakSummary(games, 'L');

	const metrics: Metric[] = [
		{
			label: 'Games',
			value: String(games.length),
		},
		{
			label: 'Completed games',
			value: String(completed.length),
		},
		{
			label: 'Average margin of victory',
			value: formatNumber(extraStats.averageVictoryMargin),
		},
		{
			label: 'First dealer record',
			value: formatRecord(globalExtras.dealerWins, globalExtras.dealerLosses),
		},
		{
			label: 'Pone-first record',
			value: formatRecord(globalExtras.poneWins, globalExtras.poneLosses),
		},
		{
			label: 'Skunk games',
			value: formatCountRate(globalExtras.skunkGames, completed.length),
			subtext: context.globalSkunkGame,
		},
		{
			label: 'Double-skunk games',
			value: formatCountRate(globalExtras.doubleSkunkGames, completed.length),
			subtext: context.globalDoubleSkunkGame,
		},
		{
			label: 'Longest win streak',
			value: formatStreakWithCount(
				'W',
				longestWinStreak.length,
				longestWinStreak.count,
			),
			subtext: context.longestWinStreak,
		},
		{
			label: 'Longest loss streak',
			value: formatStreakWithCount(
				'L',
				longestLossStreak.length,
				longestLossStreak.count,
			),
			subtext: context.longestLossStreak,
		},
		{
			label: 'High hand/crib',
			value: formatValueWithCount(globalHighHand.value, globalHighHand.count),
			subtext: context.highHand,
		},
		{
			label: 'Highest high hand/crib in loss',
			value: formatValueWithCount(
				highHandExtremes.highestHighHandInLoss,
				highHandExtremes.highestHighHandInLossCount,
			),
			subtext: context.highestHighHandInLoss,
		},
		{
			label: 'Lowest high hand/crib in win',
			value: formatValueWithCount(
				highHandExtremes.lowestHighHandInWin,
				highHandExtremes.lowestHighHandInWinCount,
			),
			subtext: context.lowestHighHandInWin,
		},
		{
			label: 'Highest average hand',
			value: formatScopedRecord(extraStats.highestAverageHand, 2),
			subtext: extraStats.highestAverageHand.subtext,
		},
		{
			label: 'Lowest average hand',
			value: formatScopedRecord(extraStats.lowestAverageHand, 2),
			subtext: extraStats.lowestAverageHand.subtext,
		},
		{
			label: 'Largest final-count deficit overcome',
			value: formatScopedRecord(extraStats.largestFinalCountDeficit),
			subtext: extraStats.largestFinalCountDeficit.subtext,
		},
		{
			label: 'Most final-count points in a win',
			value: formatScopedRecord(extraStats.mostFinalCountPointsWin),
			subtext: extraStats.mostFinalCountPointsWin.subtext,
		},
		{
			label: 'Most final-count points in a loss',
			value: formatScopedRecord(extraStats.mostFinalCountPointsLoss),
			subtext: extraStats.mostFinalCountPointsLoss.subtext,
		},
		{
			label: 'Largest single-round count',
			value: formatScopedRecord(extraStats.largestSingleRoundCount),
			subtext: extraStats.largestSingleRoundCount.subtext,
		},
		{
			label: 'Average game length (hands)',
			value: formatNumber(extraStats.averageGameLength),
		},
		{
			label: 'Quickest game (hands)',
			value: formatScopedRecord(extraStats.quickestGame),
			subtext: extraStats.quickestGame.subtext,
		},
		{
			label: 'Longest game (hands)',
			value: formatScopedRecord(extraStats.longestGame),
			subtext: extraStats.longestGame.subtext,
		},
		{
			label: 'Points / hand',
			value: formatNumber(globalPointsPerHand),
			valueClass: getParClass(globalPointsPerHand, handPar),
			subtext:
				`Par ${handPar.toFixed(2)} ` +
				`(D ${plugin.settings.dealerHandPar.toFixed(2)} / ` +
				`P ${plugin.settings.poneHandPar.toFixed(2)})`,
		},
		{
			label: 'Points / crib',
			value: formatNumber(globalPointsPerCrib),
			valueClass: getParClass(globalPointsPerCrib, plugin.settings.cribPar),
			subtext: `Par ${plugin.settings.cribPar.toFixed(2)}`,
		},
		{
			label: 'Pegging / round',
			value: formatNumber(globalPeggingPerRound),
			valueClass: getParClass(globalPeggingPerRound, peggingPar),
			subtext:
				`Par ${peggingPar.toFixed(2)} ` +
				`(D ${plugin.settings.dealerPeggingPar.toFixed(2)} / ` +
				`P ${plugin.settings.ponePeggingPar.toFixed(2)})`,
		},
		{
			label: 'Complete hand logs',
			value: String(completeHands.length),
		},
	];

	renderMetricGrid(container, metrics);

	renderCustomMetricStatistics(container, plugin, games, {
		type: 'global',
	});

	renderHighHandWinTable(
		container,
		'Winning % by High Hand/Crib',
		buildHighHandWinObservations(games, null, null),
	);

	renderMarginDistributionTable(container, 'Margin Distribution', games);
}

export function renderPlayerStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
	player: string,
	plugin: CribbageTrackerPluginContext,
): void {
	container.createEl('h3', {
		text: player,
	});

	const stats = calculatePlayerStats(games, player, null);
	const context = calculateStatisticContext(games, player, null);
	const extraStats = calculateScopedExtraStats(games, hands, player, null);

	renderMetricGrid(
		container,
		playerMetrics(stats, plugin, context, extraStats),
	);

	renderCustomMetricStatistics(container, plugin, games, {
		type: 'player',
		player,
	});

	renderHighHandWinTable(
		container,
		`${player} — Winning % by High Hand/Crib`,
		buildHighHandWinObservations(games, player, null),
	);

	renderMarginDistributionTable(
		container,
		`${player} — Margin Distribution`,
		games.filter((game) => gameContainsPlayer(game, player)),
	);
}

export function renderMatchupStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
	player1: string,
	player2: string,
	plugin: CribbageTrackerPluginContext,
): void {
	const handPar = getPluginHandPar(plugin);
	const peggingPar = getPluginPeggingPar(plugin);

	const matchupGames = games.filter((game) =>
		gameContainsPlayers(game, player1, player2),
	);

	container.createEl('h3', {
		text: `${player1} vs ${player2}`,
	});

	if (matchupGames.length === 0) {
		container.createEl('p', {
			text: 'No games found for this matchup.',
		});

		return;
	}

	const stats1 = calculatePlayerStats(games, player1, player2);
	const stats2 = calculatePlayerStats(games, player2, player1);
	const context1 = calculateStatisticContext(games, player1, player2);
	const context2 = calculateStatisticContext(games, player2, player1);
	const extra1 = calculateScopedExtraStats(games, hands, player1, player2);
	const extra2 = calculateScopedExtraStats(games, hands, player2, player1);

	const table = container.createEl('table', {
		cls: 'cribbage-table cribbage-stat-table',
	});

	const header = table.createEl('thead').createEl('tr');

	header.createEl('th', {
		text: 'Metric',
	});

	header.createEl('th', {
		text: player1,
	});

	header.createEl('th', {
		text: player2,
	});

	const body = table.createEl('tbody');

	const rows: [string, string, string][] = [
		['Games', String(stats1.games), String(stats2.games)],
		['Wins', String(stats1.wins), String(stats2.wins)],
		['Losses', String(stats1.losses), String(stats2.losses)],
		['Win %', formatPercent(stats1.winPercent), formatPercent(stats2.winPercent)],
		['PPG', formatNumber(stats1.ppg), formatNumber(stats2.ppg)],
		[
			'Avg score differential',
			formatNumber(stats1.scoreDifferential),
			formatNumber(stats2.scoreDifferential),
		],
		[
			'Average margin of victory',
			formatNumber(extra1.averageVictoryMargin),
			formatNumber(extra2.averageVictoryMargin),
		],
		[
			'When dealing first',
			formatRecord(stats1.dealerFirstWins, stats1.dealerFirstLosses),
			formatRecord(stats2.dealerFirstWins, stats2.dealerFirstLosses),
		],
		[
			'When pone first',
			formatRecord(stats1.poneFirstWins, stats1.poneFirstLosses),
			formatRecord(stats2.poneFirstWins, stats2.poneFirstLosses),
		],
		[
			'Skunk wins',
			formatCountRate(stats1.skunkWins, stats1.games),
			formatCountRate(stats2.skunkWins, stats2.games),
		],
		[
			'Skunk losses',
			formatCountRate(stats1.skunkLosses, stats1.games),
			formatCountRate(stats2.skunkLosses, stats2.games),
		],
		[
			'Double-skunk wins',
			formatCountRate(stats1.doubleSkunkWins, stats1.games),
			formatCountRate(stats2.doubleSkunkWins, stats2.games),
		],
		[
			'Double-skunk losses',
			formatCountRate(stats1.doubleSkunkLosses, stats1.games),
			formatCountRate(stats2.doubleSkunkLosses, stats2.games),
		],
		[
			'Current streak',
			formatStreak(stats1.currentStreakType, stats1.currentStreakCount),
			formatStreak(stats2.currentStreakType, stats2.currentStreakCount),
		],
		[
			'Longest win streak',
			stats1.longestWinStreak > 0 ? `W${stats1.longestWinStreak}` : '—',
			stats2.longestWinStreak > 0 ? `W${stats2.longestWinStreak}` : '—',
		],
		[
			'Longest loss streak',
			stats1.longestLossStreak > 0 ? `L${stats1.longestLossStreak}` : '—',
			stats2.longestLossStreak > 0 ? `L${stats2.longestLossStreak}` : '—',
		],
		[
			'High hand/crib',
			stats1.highHand === null ? '—' : String(stats1.highHand),
			stats2.highHand === null ? '—' : String(stats2.highHand),
		],
		[
			'Higher high hand/crib %',
			formatShare(
				stats1.higherHighHandCount,
				stats1.higherHighHandCount +
					stats1.tiedHighHandCount +
					stats1.lowerHighHandCount,
			),
			formatShare(
				stats2.higherHighHandCount,
				stats2.higherHighHandCount +
					stats2.tiedHighHandCount +
					stats2.lowerHighHandCount,
			),
		],
		[
			'High hand/crib tie %',
			formatShare(
				stats1.tiedHighHandCount,
				stats1.higherHighHandCount +
					stats1.tiedHighHandCount +
					stats1.lowerHighHandCount,
			),
			formatShare(
				stats2.tiedHighHandCount,
				stats2.higherHighHandCount +
					stats2.tiedHighHandCount +
					stats2.lowerHighHandCount,
			),
		],
		[
			'Lower high hand/crib %',
			formatShare(
				stats1.lowerHighHandCount,
				stats1.higherHighHandCount +
					stats1.tiedHighHandCount +
					stats1.lowerHighHandCount,
			),
			formatShare(
				stats2.lowerHighHandCount,
				stats2.higherHighHandCount +
					stats2.tiedHighHandCount +
					stats2.lowerHighHandCount,
			),
		],
		[
			'Highest high hand/crib in loss',
			formatValueWithCount(
				stats1.highestHighHandInLoss,
				stats1.highestHighHandInLossCount,
			),
			formatValueWithCount(
				stats2.highestHighHandInLoss,
				stats2.highestHighHandInLossCount,
			),
		],
		[
			'Lowest high hand/crib in win',
			formatValueWithCount(
				stats1.lowestHighHandInWin,
				stats1.lowestHighHandInWinCount,
			),
			formatValueWithCount(
				stats2.lowestHighHandInWin,
				stats2.lowestHighHandInWinCount,
			),
		],
		[
			'Highest average hand',
			formatScopedRecord(extra1.highestAverageHand, 2),
			formatScopedRecord(extra2.highestAverageHand, 2),
		],
		[
			'Lowest average hand',
			formatScopedRecord(extra1.lowestAverageHand, 2),
			formatScopedRecord(extra2.lowestAverageHand, 2),
		],
		[
			'Largest final-count deficit overcome',
			formatScopedRecord(extra1.largestFinalCountDeficit),
			formatScopedRecord(extra2.largestFinalCountDeficit),
		],
		[
			'Most final-count points in a win',
			formatScopedRecord(extra1.mostFinalCountPointsWin),
			formatScopedRecord(extra2.mostFinalCountPointsWin),
		],
		[
			'Most final-count points in a loss',
			formatScopedRecord(extra1.mostFinalCountPointsLoss),
			formatScopedRecord(extra2.mostFinalCountPointsLoss),
		],
		[
			'Largest single-round count',
			formatScopedRecord(extra1.largestSingleRoundCount),
			formatScopedRecord(extra2.largestSingleRoundCount),
		],
		[
			'Average game length (hands)',
			formatNumber(extra1.averageGameLength),
			formatNumber(extra2.averageGameLength),
		],
		[
			'Quickest game (hands)',
			formatScopedRecord(extra1.quickestGame),
			formatScopedRecord(extra2.quickestGame),
		],
		[
			'Longest game (hands)',
			formatScopedRecord(extra1.longestGame),
			formatScopedRecord(extra2.longestGame),
		],
		[
			`Points / hand (par ${handPar.toFixed(2)})`,
			formatNumber(stats1.pointsPerHand),
			formatNumber(stats2.pointsPerHand),
		],
		[
			`Points / crib (par ${plugin.settings.cribPar.toFixed(2)})`,
			formatNumber(stats1.pointsPerCrib),
			formatNumber(stats2.pointsPerCrib),
		],
		[
			`Pegging / round (par ${peggingPar.toFixed(2)})`,
			formatNumber(stats1.peggingPerRound),
			formatNumber(stats2.peggingPerRound),
		],
	];

	const contextualSubtexts = new Map<
		string,
		[string | undefined, string | undefined]
	>([
		['Current streak', [context1.currentStreak, context2.currentStreak]],
		[
			'Longest win streak',
			[context1.longestWinStreak, context2.longestWinStreak],
		],
		[
			'Longest loss streak',
			[context1.longestLossStreak, context2.longestLossStreak],
		],
		['High hand/crib', [context1.highHand, context2.highHand]],
		[
			'Highest high hand/crib in loss',
			[context1.highestHighHandInLoss, context2.highestHighHandInLoss],
		],
		[
			'Lowest high hand/crib in win',
			[context1.lowestHighHandInWin, context2.lowestHighHandInWin],
		],
		[
			'Highest average hand',
			[extra1.highestAverageHand.subtext, extra2.highestAverageHand.subtext],
		],
		[
			'Lowest average hand',
			[extra1.lowestAverageHand.subtext, extra2.lowestAverageHand.subtext],
		],
		[
			'Largest final-count deficit overcome',
			[
				extra1.largestFinalCountDeficit.subtext,
				extra2.largestFinalCountDeficit.subtext,
			],
		],
		[
			'Most final-count points in a win',
			[
				extra1.mostFinalCountPointsWin.subtext,
				extra2.mostFinalCountPointsWin.subtext,
			],
		],
		[
			'Most final-count points in a loss',
			[
				extra1.mostFinalCountPointsLoss.subtext,
				extra2.mostFinalCountPointsLoss.subtext,
			],
		],
		[
			'Largest single-round count',
			[
				extra1.largestSingleRoundCount.subtext,
				extra2.largestSingleRoundCount.subtext,
			],
		],
		[
			'Quickest game (hands)',
			[extra1.quickestGame.subtext, extra2.quickestGame.subtext],
		],
		[
			'Longest game (hands)',
			[extra1.longestGame.subtext, extra2.longestGame.subtext],
		],
		['Skunk wins', [context1.skunkWin, context2.skunkWin]],
		['Skunk losses', [context1.skunkLoss, context2.skunkLoss]],
		['Double-skunk wins', [context1.doubleSkunkWin, context2.doubleSkunkWin]],
		['Double-skunk losses', [context1.doubleSkunkLoss, context2.doubleSkunkLoss]],
	]);

	renderCustomMetricStatistics(container, plugin, games, {
		type: 'matchup',
		player1,
		player2,
	});

	renderHighHandWinTable(
		container,
		`${player1} vs ${player2} — Winning % by High Hand/Crib`,
		buildMatchupHighHandWinObservations(games, player1, player2),
	);

	renderMarginDistributionTable(
		container,
		`${player1} vs ${player2} — Margin Distribution`,
		matchupGames,
	);

	for (const values of rows) {
		const row = body.createEl('tr');
		const label = values[0];

		for (let index = 0; index < values.length; index++) {
			const cell = row.createEl('td');
			const value = cell.createSpan({
				text: values[index],
			});

			if (index === 0) {
				continue;
			}

			const subtexts = contextualSubtexts.get(label);
			const subtext = index === 1 ? subtexts?.[0] : subtexts?.[1];

			if (subtext) {
				cell.createDiv({
					text: subtext,
					cls: 'cribbage-stat-subtext',
				});
			}

			if (label.startsWith('Points / hand')) {
				value.addClass(
					getParClass(
						index === 1 ? stats1.pointsPerHand : stats2.pointsPerHand,
						handPar,
					) ?? '',
				);
			}

			if (label.startsWith('Points / crib')) {
				value.addClass(
					getParClass(
						index === 1 ? stats1.pointsPerCrib : stats2.pointsPerCrib,
						plugin.settings.cribPar,
					) ?? '',
				);
			}

			if (label.startsWith('Pegging / round')) {
				value.addClass(
					getParClass(
						index === 1 ? stats1.peggingPerRound : stats2.peggingPerRound,
						peggingPar,
					) ?? '',
				);
			}
		}
	}
}

export function playerMetrics(
	stats: PlayerStats,
	plugin: CribbageTrackerPluginContext,
	context: StatisticContext,
	extraStats: ScopedExtraStats,
): Metric[] {
	const handPar = getPluginHandPar(plugin);
	const peggingPar = getPluginPeggingPar(plugin);

	return [
		{
			label: 'Games',
			value: String(stats.games),
		},
		{
			label: 'Wins',
			value: String(stats.wins),
		},
		{
			label: 'Losses',
			value: String(stats.losses),
		},
		{
			label: 'Win %',
			value: formatPercent(stats.winPercent),
		},
		{
			label: 'PPG',
			value: formatNumber(stats.ppg),
		},
		{
			label: 'Avg score differential',
			value: formatNumber(stats.scoreDifferential),
		},
		{
			label: 'Average margin of victory',
			value: formatNumber(extraStats.averageVictoryMargin),
		},
		{
			label: 'When dealing first',
			value: formatRecord(stats.dealerFirstWins, stats.dealerFirstLosses),
		},
		{
			label: 'When pone first',
			value: formatRecord(stats.poneFirstWins, stats.poneFirstLosses),
		},
		{
			label: 'Skunk wins',
			value: formatCountRate(stats.skunkWins, stats.games),
			subtext: context.skunkWin,
		},
		{
			label: 'Skunk losses',
			value: formatCountRate(stats.skunkLosses, stats.games),
			subtext: context.skunkLoss,
		},
		{
			label: 'Double-skunk wins',
			value: formatCountRate(stats.doubleSkunkWins, stats.games),
			subtext: context.doubleSkunkWin,
		},
		{
			label: 'Double-skunk losses',
			value: formatCountRate(stats.doubleSkunkLosses, stats.games),
			subtext: context.doubleSkunkLoss,
		},
		{
			label: 'Current streak',
			value: formatStreak(stats.currentStreakType, stats.currentStreakCount),
			subtext: context.currentStreak,
		},
		{
			label: 'Longest win streak',
			value: stats.longestWinStreak > 0 ? `W${stats.longestWinStreak}` : '—',
			subtext: context.longestWinStreak,
		},
		{
			label: 'Longest loss streak',
			value: stats.longestLossStreak > 0 ? `L${stats.longestLossStreak}` : '—',
			subtext: context.longestLossStreak,
		},
		{
			label: 'High hand/crib',
			value: stats.highHand === null ? '—' : String(stats.highHand),
			subtext: context.highHand,
		},
		{
			label: 'Higher high hand/crib',
			value: formatShare(
				stats.higherHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'High hand/crib tie',
			value: formatShare(
				stats.tiedHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'Lower high hand/crib',
			value: formatShare(
				stats.lowerHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'Highest high hand/crib in loss',
			value: formatValueWithCount(
				stats.highestHighHandInLoss,
				stats.highestHighHandInLossCount,
			),
			subtext: context.highestHighHandInLoss,
		},
		{
			label: 'Lowest high hand/crib in win',
			value: formatValueWithCount(
				stats.lowestHighHandInWin,
				stats.lowestHighHandInWinCount,
			),
			subtext: context.lowestHighHandInWin,
		},
		{
			label: 'Highest average hand',
			value: formatScopedRecord(extraStats.highestAverageHand, 2),
			subtext: extraStats.highestAverageHand.subtext,
		},
		{
			label: 'Lowest average hand',
			value: formatScopedRecord(extraStats.lowestAverageHand, 2),
			subtext: extraStats.lowestAverageHand.subtext,
		},
		{
			label: 'Largest final-count deficit overcome',
			value: formatScopedRecord(extraStats.largestFinalCountDeficit),
			subtext: extraStats.largestFinalCountDeficit.subtext,
		},
		{
			label: 'Most final-count points in a win',
			value: formatScopedRecord(extraStats.mostFinalCountPointsWin),
			subtext: extraStats.mostFinalCountPointsWin.subtext,
		},
		{
			label: 'Most final-count points in a loss',
			value: formatScopedRecord(extraStats.mostFinalCountPointsLoss),
			subtext: extraStats.mostFinalCountPointsLoss.subtext,
		},
		{
			label: 'Largest single-round count',
			value: formatScopedRecord(extraStats.largestSingleRoundCount),
			subtext: extraStats.largestSingleRoundCount.subtext,
		},
		{
			label: 'Average game length (hands)',
			value: formatNumber(extraStats.averageGameLength),
		},
		{
			label: 'Quickest game (hands)',
			value: formatScopedRecord(extraStats.quickestGame),
			subtext: extraStats.quickestGame.subtext,
		},
		{
			label: 'Longest game (hands)',
			value: formatScopedRecord(extraStats.longestGame),
			subtext: extraStats.longestGame.subtext,
		},
		{
			label: 'Points / hand',
			value: formatNumber(stats.pointsPerHand),
			valueClass: getParClass(stats.pointsPerHand, handPar),
			subtext:
				`Par ${handPar.toFixed(2)} ` +
				`(D ${plugin.settings.dealerHandPar.toFixed(2)} / ` +
				`P ${plugin.settings.poneHandPar.toFixed(2)})`,
		},
		{
			label: 'Points / crib',
			value: formatNumber(stats.pointsPerCrib),
			valueClass: getParClass(stats.pointsPerCrib, plugin.settings.cribPar),
			subtext: `Par ${plugin.settings.cribPar.toFixed(2)}`,
		},
		{
			label: 'Pegging / round',
			value: formatNumber(stats.peggingPerRound),
			valueClass: getParClass(stats.peggingPerRound, peggingPar),
			subtext:
				`Par ${peggingPar.toFixed(2)} ` +
				`(D ${plugin.settings.dealerPeggingPar.toFixed(2)} / ` +
				`P ${plugin.settings.ponePeggingPar.toFixed(2)})`,
		},
		{
			label: 'Complete hand logs',
			value: String(stats.completeHandLogs),
		},
	];
}

function formatStreakWithCount(
	type: 'W' | 'L',
	length: number,
	count: number,
): string {
	if (length === 0) {
		return '—';
	}

	const value = `${type}${length}`;

	return count > 1 ? `${value} (x${count})` : value;
}
