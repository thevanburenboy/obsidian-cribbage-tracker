import type CribbageTrackerPlugin from './main';

import type { GameStatisticsRecord } from './database';

import {
	renderCustomMetricStatistics,
} from './custom-metric-statistics';

interface Metric {
	label: string;
	value: string;
	subtext?: string;
	valueClass?: string;
}

interface PlayerStats {
	games: number;
	wins: number;
	losses: number;
	winPercent: number | null;
	ppg: number | null;
	scoreDifferential: number | null;
	highHand: number | null;
	pointsPerHand: number | null;
	pointsPerCrib: number | null;
	peggingPerRound: number | null;
	completeHandLogs: number;

	higherHighHandCount: number;
	tiedHighHandCount: number;
	lowerHighHandCount: number;

	highestHighHandInLoss: number | null;
	highestHighHandInLossCount: number;

	lowestHighHandInWin: number | null;
	lowestHighHandInWinCount: number;

	dealerFirstWins: number;
	dealerFirstLosses: number;

	poneFirstWins: number;
	poneFirstLosses: number;

	skunkWins: number;
	skunkLosses: number;

	doubleSkunkWins: number;
	doubleSkunkLosses: number;

	currentStreakType: 'W' | 'L' | null;

	currentStreakCount: number;

	longestWinStreak: number;
	longestLossStreak: number;
}

export function renderStatisticsPage(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
): void {
	const games = plugin.database.listGamesForStatistics();

	const players = plugin.database.getPlayerNames();

	const panel = container.createDiv('cribbage-panel');

	panel.createEl('h2', {
		text: 'Statistics',
	});

	if (games.length === 0) {
		panel.createEl('p', {
			text: 'No games recorded yet.',
		});

		return;
	}

	const controls = panel.createDiv('cribbage-stat-controls');

	const scopeField = createSelectField(controls, 'Scope', [
		['global', 'Global'],
		['player', 'Player'],
		['matchup', 'Matchup'],
	]);

	const player1Field = createPlayerSelect(controls, 'Player', players);

	const player2Field = createPlayerSelect(controls, 'Opponent', players);

	if (players.length > 1 && player2Field.value === player1Field.value) {
		player2Field.value = players[1] ?? '';
	}

	const results = panel.createDiv('cribbage-stat-results');

	const renderResults = () => {
		results.empty();

		const scope = scopeField.value;

		player1Field.parentElement?.toggleClass(
			'cribbage-hidden',
			scope === 'global',
		);

		player2Field.parentElement?.toggleClass(
			'cribbage-hidden',
			scope !== 'matchup',
		);

		if (scope === 'global') {
			renderGlobalStats(results, games, plugin);

			return;
		}

		const player = player1Field.value;

		if (!player) {
			results.createEl('p', {
				text: 'Select a player.',
			});

			return;
		}

		if (scope === 'player') {
			renderPlayerStats(results, games, player, plugin);

			return;
		}

		const opponent = player2Field.value;

		if (!opponent) {
			results.createEl('p', {
				text: 'Select an opponent.',
			});

			return;
		}

		if (player === opponent) {
			results.createEl('p', {
				text: 'Choose two different players.',
			});

			return;
		}

		renderMatchupStats(results, games, player, opponent, plugin);
	};

	for (const select of [scopeField, player1Field, player2Field]) {
		select.addEventListener('change', renderResults);
	}

	renderResults();
}

function renderGlobalStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	plugin: CribbageTrackerPlugin,
): void {
	const handPar =
		(plugin.settings.dealerHandPar + plugin.settings.poneHandPar) / 2;

	const peggingPar =
		(plugin.settings.dealerPeggingPar + plugin.settings.ponePeggingPar) / 2;

	const completed = games.filter(hasCompletedScore);

	const margins = completed.map((game) =>
		Math.abs((game.player1Score ?? 0) - (game.player2Score ?? 0)),
	);

	const completeHands = games.filter(
		(game) => !game.handDataIncomplete && game.roundCount > 0,
	);

	const totalEligibleHandPoints = sum(
		completeHands,
		(game) =>
			game.player1HandPointsEligible + game.player2HandPointsEligible,
	);

	const totalEligibleHands = sum(
		completeHands,
		(game) => game.eligibleRoundCount * 2,
	);

	const totalCribPoints = sum(
		completeHands,
		(game) =>
			game.player1CribPointsEligible + game.player2CribPointsEligible,
	);

	const totalCribs = sum(
		completeHands,
		(game) => game.player1EligibleCribCount + game.player2EligibleCribCount,
	);

	const totalPegging = sum(
		completeHands,
		(game) =>
			game.player1PeggingPointsTotal + game.player2PeggingPointsTotal,
	);

	const totalPlayerRounds = sum(completeHands, (game) => game.roundCount * 2);

	const globalPointsPerHand =
		totalEligibleHands > 0
			? totalEligibleHandPoints / totalEligibleHands
			: null;

	const globalPointsPerCrib =
		totalCribs > 0 ? totalCribPoints / totalCribs : null;

	const globalPeggingPerRound =
		totalPlayerRounds > 0 ? totalPegging / totalPlayerRounds : null;

    const globalHighHand =
        calculateGlobalHighHand(
            games,
        );

	const highHandExtremes = calculateGlobalHighHandExtremes(games);

	const globalExtras = calculateGlobalExtras(games);

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
			value: formatNumber(average(margins)),
		},
		{
			label: 'First dealer record',
			value: formatRecord(
				globalExtras.dealerWins,
				globalExtras.dealerLosses,
			),
		},
		{
			label: 'Pone-first record',
			value: formatRecord(globalExtras.poneWins, globalExtras.poneLosses),
		},
		{
			label: 'Skunk games',
			value: formatCountRate(globalExtras.skunkGames, completed.length),
		},
		{
			label: 'Double-skunk games',
			value: formatCountRate(
				globalExtras.doubleSkunkGames,
				completed.length,
			),
		},
		{
			label: 'Longest win streak',
			value:
				globalExtras.longestWinPlayer === null
					? '—'
					: `${globalExtras.longestWinPlayer} — W${globalExtras.longestWin}`,
		},
		{
			label: 'Longest loss streak',
			value:
				globalExtras.longestLossPlayer === null
					? '—'
					: `${globalExtras.longestLossPlayer} — L${globalExtras.longestLoss}`,
		},
        {
            label: 'High hand',
            value:
                formatValueWithCount(
                    globalHighHand.value,
                    globalHighHand.count,
                ),
            subtext:
                globalHighHand.scorer === null
                    ? undefined
                    : `Scored by: ${globalHighHand.scorer}`,
        },
		{
			label: 'Highest high-hand in loss',
			value: formatValueWithCount(
				highHandExtremes.highestHighHandInLoss,
				highHandExtremes.highestHighHandInLossCount,
			),
		},
		{
			label: 'Lowest high-hand in win',
			value: formatValueWithCount(
				highHandExtremes.lowestHighHandInWin,
				highHandExtremes.lowestHighHandInWinCount,
			),
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
			valueClass: getParClass(
				globalPointsPerCrib,
				plugin.settings.cribPar,
			),
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

    renderCustomMetricStatistics(
        container,
        plugin,
        games,
        {
            type: 'global',
        },
    );

	renderHighHandWinTable(
		container,
		'Winning % by High Hand',
		buildHighHandWinObservations(games, null, null),
	);

	renderMarginDistributionTable(container, 'Margin Distribution', games);
}

function renderPlayerStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	player: string,
	plugin: CribbageTrackerPlugin,
): void {
	container.createEl('h3', {
		text: player,
	});

	const stats = calculatePlayerStats(games, player, null);

	renderMetricGrid(container, playerMetrics(stats, plugin));

    renderCustomMetricStatistics(
        container,
        plugin,
        games,
        {
            type: 'player',
            player,
        },
    );

	renderHighHandWinTable(
		container,
		`${player} — Winning % by High Hand`,
		buildHighHandWinObservations(games, player, null),
	);

	renderMarginDistributionTable(
		container,
		`${player} — Margin Distribution`,
		games.filter((game) => gameContainsPlayer(game, player)),
	);
}

function renderMatchupStats(
	container: HTMLElement,
	games: GameStatisticsRecord[],
	player1: string,
	player2: string,
	plugin: CribbageTrackerPlugin,
): void {
	const handPar =
		(plugin.settings.dealerHandPar + plugin.settings.poneHandPar) / 2;

	const peggingPar =
		(plugin.settings.dealerPeggingPar + plugin.settings.ponePeggingPar) / 2;

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
		[
			'Win %',
			formatPercent(stats1.winPercent),
			formatPercent(stats2.winPercent),
		],
		['PPG', formatNumber(stats1.ppg), formatNumber(stats2.ppg)],
		[
			'Avg score differential',
			formatNumber(stats1.scoreDifferential),
			formatNumber(stats2.scoreDifferential),
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
			'High hand',
			stats1.highHand === null ? '—' : String(stats1.highHand),
			stats2.highHand === null ? '—' : String(stats2.highHand),
		],
		[
			'Higher high hand %',
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
			'High-hand tie %',
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
			'Lower high hand %',
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
			'Highest high-hand in loss',
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
			'Lowest high-hand in win',
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

    renderCustomMetricStatistics(
        container,
        plugin,
        games,
        {
            type: 'matchup',
            player1,
            player2,
        },
    );

	renderHighHandWinTable(
		container,
		`${player1} vs ${player2} — Winning % by High Hand`,
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

			if (label.startsWith('Points / hand')) {
				value.addClass(
					getParClass(
						index === 1
							? stats1.pointsPerHand
							: stats2.pointsPerHand,
						handPar,
					) ?? '',
				);
			}

			if (label.startsWith('Points / crib')) {
				value.addClass(
					getParClass(
						index === 1
							? stats1.pointsPerCrib
							: stats2.pointsPerCrib,
						plugin.settings.cribPar,
					) ?? '',
				);
			}

			if (label.startsWith('Pegging / round')) {
				value.addClass(
					getParClass(
						index === 1
							? stats1.peggingPerRound
							: stats2.peggingPerRound,
						peggingPar,
					) ?? '',
				);
			}
		}
	}
}

function calculatePlayerStats(
	games: GameStatisticsRecord[],
	player: string,
	opponent: string | null,
): PlayerStats {
	const relevant = games.filter((game) => {
		if (!gameContainsPlayer(game, player)) {
			return false;
		}

		if (opponent !== null && !gameContainsPlayers(game, player, opponent)) {
			return false;
		}

		return true;
	});

	const completed = relevant.filter(hasCompletedScore);

	let wins = 0;
	let losses = 0;

	let dealerFirstWins = 0;
	let dealerFirstLosses = 0;

	let poneFirstWins = 0;
	let poneFirstLosses = 0;

	let skunkWins = 0;
	let skunkLosses = 0;

	let doubleSkunkWins = 0;
	let doubleSkunkLosses = 0;

	const scores: number[] = [];
	const differentials: number[] = [];

	const highHands: number[] = [];

	let higherHighHandCount = 0;
	let tiedHighHandCount = 0;
	let lowerHighHandCount = 0;

	let highestHighHandInLoss: number | null = null;

	let highestHighHandInLossCount = 0;

	let lowestHighHandInWin: number | null = null;

	let lowestHighHandInWinCount = 0;

	let handPoints = 0;
	let handCount = 0;

	let cribPoints = 0;
	let cribCount = 0;

	let pegging = 0;
	let rounds = 0;

	let completeHandLogs = 0;

	for (const game of relevant) {
		const side = getPlayerSide(game, player);

		if (side === null) {
			continue;
		}

		const high = effectiveHighHand(game, side);

		if (high !== null) {
			highHands.push(high);
		}

		if (!game.handDataIncomplete && game.roundCount > 0) {
			completeHandLogs++;

			if (side === 1) {
				handPoints += game.player1HandPointsEligible;

				cribPoints += game.player1CribPointsEligible;

				cribCount += game.player1EligibleCribCount;

				pegging += game.player1PeggingPointsTotal;
			} else {
				handPoints += game.player2HandPointsEligible;

				cribPoints += game.player2CribPointsEligible;

				cribCount += game.player2EligibleCribCount;

				pegging += game.player2PeggingPointsTotal;
			}

			handCount += game.eligibleRoundCount;

			rounds += game.roundCount;
		}
	}

	for (const game of completed) {
		const side = getPlayerSide(game, player);

		if (side === null) {
			continue;
		}

		const playerScore = side === 1 ? game.player1Score : game.player2Score;

		const opponentScore =
			side === 1 ? game.player2Score : game.player1Score;

		if (playerScore === null || opponentScore === null) {
			continue;
		}

		scores.push(playerScore);

		differentials.push(playerScore - opponentScore);

		const won = playerScore > opponentScore;

		const lost = playerScore < opponentScore;

		if (won) {
			wins++;
		} else if (lost) {
			losses++;
		}

		const playerHigh = effectiveHighHand(game, side);

		const opponentHigh = effectiveHighHand(game, side === 1 ? 2 : 1);

		/*
		 * Compare the two players' high hands.
		 *
		 * Only games where BOTH high hands are known
		 * participate in this comparison.
		 */
		if (playerHigh !== null && opponentHigh !== null) {
			if (playerHigh > opponentHigh) {
				higherHighHandCount++;
			} else if (playerHigh === opponentHigh) {
				tiedHighHandCount++;
			} else {
				lowerHighHandCount++;
			}
		}

		/*
		 * Extreme high-hand results.
		 */
		if (won && playerHigh !== null) {
			if (
				lowestHighHandInWin === null ||
				playerHigh < lowestHighHandInWin
			) {
				lowestHighHandInWin = playerHigh;

				lowestHighHandInWinCount = 1;
			} else if (playerHigh === lowestHighHandInWin) {
				lowestHighHandInWinCount++;
			}
		}

		if (lost && playerHigh !== null) {
			if (
				highestHighHandInLoss === null ||
				playerHigh > highestHighHandInLoss
			) {
				highestHighHandInLoss = playerHigh;

				highestHighHandInLossCount = 1;
			} else if (playerHigh === highestHighHandInLoss) {
				highestHighHandInLossCount++;
			}
		}

        if (game.firstDealer !== null) {
            if (
                game.firstDealer === side
            ) {
                if (won) {
                    dealerFirstWins++;
                } else if (lost) {
                    dealerFirstLosses++;
                }
            } else {
                if (won) {
                    poneFirstWins++;
                } else if (lost) {
                    poneFirstLosses++;
                }
            }
        }

		if (won || lost) {
			const losingScore = won ? opponentScore : playerScore;

			if (losingScore <= 60) {
				if (won) {
					doubleSkunkWins++;
				} else {
					doubleSkunkLosses++;
				}
			} else if (losingScore <= 90) {
				if (won) {
					skunkWins++;
				} else {
					skunkLosses++;
				}
			}
		}
	}

	const streaks = calculatePlayerStreaks(completed, player);

	const decidedGames = wins + losses;

	return {
		games: relevant.length,

		wins,
		losses,

		winPercent: decidedGames > 0 ? wins / decidedGames : null,

		ppg: average(scores),

		scoreDifferential: average(differentials),

		highHand: highHands.length > 0 ? Math.max(...highHands) : null,

		pointsPerHand: handCount > 0 ? handPoints / handCount : null,

		pointsPerCrib: cribCount > 0 ? cribPoints / cribCount : null,

		peggingPerRound: rounds > 0 ? pegging / rounds : null,

		completeHandLogs,

		higherHighHandCount,
		tiedHighHandCount,
		lowerHighHandCount,

		highestHighHandInLoss,
		highestHighHandInLossCount,

		lowestHighHandInWin,
		lowestHighHandInWinCount,

		dealerFirstWins,
		dealerFirstLosses,

		poneFirstWins,
		poneFirstLosses,

		skunkWins,
		skunkLosses,

		doubleSkunkWins,
		doubleSkunkLosses,

		currentStreakType: streaks.currentType,

		currentStreakCount: streaks.currentCount,

		longestWinStreak: streaks.longestWin,

		longestLossStreak: streaks.longestLoss,
	};
}

function playerMetrics(
	stats: PlayerStats,
	plugin: CribbageTrackerPlugin,
): Metric[] {
	const handPar =
		(plugin.settings.dealerHandPar + plugin.settings.poneHandPar) / 2;

	const peggingPar =
		(plugin.settings.dealerPeggingPar + plugin.settings.ponePeggingPar) / 2;
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
		},
		{
			label: 'Skunk losses',
			value: formatCountRate(stats.skunkLosses, stats.games),
		},
		{
			label: 'Double-skunk wins',
			value: formatCountRate(stats.doubleSkunkWins, stats.games),
		},
		{
			label: 'Double-skunk losses',
			value: formatCountRate(stats.doubleSkunkLosses, stats.games),
		},
		{
			label: 'Current streak',
			value: formatStreak(
				stats.currentStreakType,
				stats.currentStreakCount,
			),
		},
		{
			label: 'Longest win streak',
			value:
				stats.longestWinStreak > 0 ? `W${stats.longestWinStreak}` : '—',
		},
		{
			label: 'Longest loss streak',
			value:
				stats.longestLossStreak > 0
					? `L${stats.longestLossStreak}`
					: '—',
		},
		{
			label: 'High hand',
			value: stats.highHand === null ? '—' : String(stats.highHand),
		},
		{
			label: 'Higher high hand',
			value: formatShare(
				stats.higherHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'High-hand tie',
			value: formatShare(
				stats.tiedHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'Lower high hand',
			value: formatShare(
				stats.lowerHighHandCount,
				stats.higherHighHandCount +
					stats.tiedHighHandCount +
					stats.lowerHighHandCount,
			),
		},
		{
			label: 'Highest high-hand in loss',
			value: formatValueWithCount(
				stats.highestHighHandInLoss,
				stats.highestHighHandInLossCount,
			),
		},
		{
			label: 'Lowest high-hand in win',
			value: formatValueWithCount(
				stats.lowestHighHandInWin,
				stats.lowestHighHandInWinCount,
			),
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
			valueClass: getParClass(
				stats.pointsPerCrib,
				plugin.settings.cribPar,
			),
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

function effectiveHighHand(
	game: GameStatisticsRecord,
	side: 1 | 2,
): number | null {
	if (side === 1) {
		if (game.player1HighHandManual !== null) {
			return game.player1HighHandManual;
		}

		if (game.handDataIncomplete) {
			return null;
		}

		return game.player1HighHandCalculated;
	}

	if (game.player2HighHandManual !== null) {
		return game.player2HighHandManual;
	}

	if (game.handDataIncomplete) {
		return null;
	}

	return game.player2HighHandCalculated;
}

function calculatePlayerStreaks(
	games: GameStatisticsRecord[],
	player: string,
): {
	currentType: 'W' | 'L' | null;

	currentCount: number;

	longestWin: number;
	longestLoss: number;
} {
	const chronological = [...games]
		.filter(
			(game) =>
				gameContainsPlayer(game, player) &&
				hasCompletedScore(game) &&
				game.player1Score !== game.player2Score,
		)
		.sort((a, b) => {
			const dateCompare = a.playedDate.localeCompare(b.playedDate);

			if (dateCompare !== 0) {
				return dateCompare;
			}

			const timeCompare = a.playedTime.localeCompare(b.playedTime);

			if (timeCompare !== 0) {
				return timeCompare;
			}

			return a.id.localeCompare(b.id);
		});

	let currentType: 'W' | 'L' | null = null;

	let currentCount = 0;

	let longestWin = 0;
	let longestLoss = 0;

	for (const game of chronological) {
		const side = getPlayerSide(game, player);

		if (side === null) {
			continue;
		}

		const playerScore = side === 1 ? game.player1Score : game.player2Score;

		const opponentScore =
			side === 1 ? game.player2Score : game.player1Score;

		if (
			playerScore === null ||
			opponentScore === null ||
			playerScore === opponentScore
		) {
			continue;
		}

		const result: 'W' | 'L' = playerScore > opponentScore ? 'W' : 'L';

		if (result === currentType) {
			currentCount++;
		} else {
			currentType = result;
			currentCount = 1;
		}

		if (result === 'W') {
			longestWin = Math.max(longestWin, currentCount);
		} else {
			longestLoss = Math.max(longestLoss, currentCount);
		}
	}

	return {
		currentType,
		currentCount,
		longestWin,
		longestLoss,
	};
}

function calculateGlobalHighHandExtremes(games: GameStatisticsRecord[]): {
	highestHighHandInLoss: number | null;
	highestHighHandInLossCount: number;
	lowestHighHandInWin: number | null;
	lowestHighHandInWinCount: number;
} {
	let highestHighHandInLoss: number | null = null;

	let highestHighHandInLossCount = 0;

	let lowestHighHandInWin: number | null = null;

	let lowestHighHandInWinCount = 0;

	for (const game of games) {
		if (!hasCompletedScore(game)) {
			continue;
		}

		if (game.player1Score === game.player2Score) {
			continue;
		}

		const winnerSide: 1 | 2 =
			(game.player1Score ?? 0) > (game.player2Score ?? 0) ? 1 : 2;

		const loserSide: 1 | 2 = winnerSide === 1 ? 2 : 1;

		const winnerHigh = effectiveHighHand(game, winnerSide);

		const loserHigh = effectiveHighHand(game, loserSide);

		if (winnerHigh !== null) {
			if (
				lowestHighHandInWin === null ||
				winnerHigh < lowestHighHandInWin
			) {
				lowestHighHandInWin = winnerHigh;

				lowestHighHandInWinCount = 1;
			} else if (winnerHigh === lowestHighHandInWin) {
				lowestHighHandInWinCount++;
			}
		}

		if (loserHigh !== null) {
			if (
				highestHighHandInLoss === null ||
				loserHigh > highestHighHandInLoss
			) {
				highestHighHandInLoss = loserHigh;

				highestHighHandInLossCount = 1;
			} else if (loserHigh === highestHighHandInLoss) {
				highestHighHandInLossCount++;
			}
		}
	}

	return {
		highestHighHandInLoss,
		highestHighHandInLossCount,
		lowestHighHandInWin,
		lowestHighHandInWinCount,
	};
}

function calculateGlobalExtras(games: GameStatisticsRecord[]): {
	dealerWins: number;
	dealerLosses: number;

	poneWins: number;
	poneLosses: number;

	skunkGames: number;
	doubleSkunkGames: number;

	longestWin: number;
	longestWinPlayer: string | null;

	longestLoss: number;
	longestLossPlayer: string | null;
} {
	let dealerWins = 0;
	let dealerLosses = 0;

	let skunkGames = 0;
	let doubleSkunkGames = 0;

	for (const game of games) {
		if (!hasCompletedScore(game)) {
			continue;
		}

		if (game.player1Score === game.player2Score) {
			continue;
		}

		const p1Won = (game.player1Score ?? 0) > (game.player2Score ?? 0);

		if (game.firstDealer !== null) {
			const dealerWon =
				(game.firstDealer === 1 && p1Won) ||
				(game.firstDealer === 2 && !p1Won);

			if (dealerWon) {
				dealerWins++;
			} else {
				dealerLosses++;
			}
		}

		const losingScore = Math.min(
			game.player1Score ?? 0,
			game.player2Score ?? 0,
		);

		if (losingScore <= 60) {
			doubleSkunkGames++;
		} else if (losingScore <= 90) {
			skunkGames++;
		}
	}

	const players = new Set<string>();

	for (const game of games) {
		players.add(game.player1);
		players.add(game.player2);
	}

	let longestWin = 0;
	let longestWinPlayer: string | null = null;

	let longestLoss = 0;
	let longestLossPlayer: string | null = null;

	for (const player of players) {
		const streaks = calculatePlayerStreaks(games, player);

		if (streaks.longestWin > longestWin) {
			longestWin = streaks.longestWin;

			longestWinPlayer = player;
		}

		if (streaks.longestLoss > longestLoss) {
			longestLoss = streaks.longestLoss;

			longestLossPlayer = player;
		}
	}

	return {
		dealerWins,
		dealerLosses,

		poneWins: dealerLosses,
		poneLosses: dealerWins,

		skunkGames,
		doubleSkunkGames,

		longestWin,
		longestWinPlayer,

		longestLoss,
		longestLossPlayer,
	};
}

function calculateGlobalHighHand(
	games: GameStatisticsRecord[],
): {
	value: number | null;
	count: number;
	scorer: string | null;
} {
	let value: number | null = null;
	let count = 0;
	let scorer: string | null = null;

	for (const game of games) {
		for (const side of [1, 2] as const) {
			const high =
				effectiveHighHand(
					game,
					side,
				);

			if (high === null) {
				continue;
			}

			const player =
				side === 1
					? game.player1
					: game.player2;

			if (
				value === null ||
				high > value
			) {
				value = high;
				count = 1;
				scorer = player;
			} else if (
				high === value
			) {
				count++;
				scorer = 'Multiple';
			}
		}
	}

	return {
		value,
		count,
		scorer,
	};
}

interface HighHandWinObservation {
	highHand: number;
	won: boolean;
}

function buildHighHandWinObservations(
	games: GameStatisticsRecord[],
	player: string | null,
	opponent: string | null,
): HighHandWinObservation[] {
	const observations: HighHandWinObservation[] = [];

	for (const game of games) {
		if (!hasCompletedScore(game)) {
			continue;
		}

		if (game.player1Score === game.player2Score) {
			continue;
		}

		if (player === null) {
			for (const side of [1, 2] as const) {
				const highHand = effectiveHighHand(game, side);

				if (highHand === null) {
					continue;
				}

				const playerScore =
					side === 1 ? game.player1Score : game.player2Score;

				const opponentScore =
					side === 1 ? game.player2Score : game.player1Score;

				if (playerScore === null || opponentScore === null) {
					continue;
				}

				observations.push({
					highHand,
					won: playerScore > opponentScore,
				});
			}

			continue;
		}

		if (!gameContainsPlayer(game, player)) {
			continue;
		}

		if (opponent !== null && !gameContainsPlayers(game, player, opponent)) {
			continue;
		}

		const side = getPlayerSide(game, player);

		if (side === null) {
			continue;
		}

		const highHand = effectiveHighHand(game, side);

		if (highHand === null) {
			continue;
		}

		const playerScore = side === 1 ? game.player1Score : game.player2Score;

		const opponentScore =
			side === 1 ? game.player2Score : game.player1Score;

		if (playerScore === null || opponentScore === null) {
			continue;
		}

		observations.push({
			highHand,
			won: playerScore > opponentScore,
		});
	}

	return observations;
}

function renderHighHandWinTable(
	container: HTMLElement,
	title: string,
	observations: HighHandWinObservation[],
): void {
	const section = container.createDiv('cribbage-stat-section');

	section.createEl('h3', {
		text: title,
	});

	section.createEl('p', {
		text: 'Exact win % is the win rate when that high hand occurred. X+ win % is the win rate when that high hand or any higher high hand occurred.',
		cls: 'setting-item-description',
	});

	const scroll = section.createDiv('cribbage-table-scroll');

	const table = scroll.createEl('table', {
		cls: 'cribbage-table cribbage-stat-table',
	});

	const header = table.createEl('thead').createEl('tr');

	for (const label of ['High hand', 'Exact win %', 'Win % at X+']) {
		header.createEl('th', {
			text: label,
		});
	}

	const body = table.createEl('tbody');

	const rows: {
		label: string;
		matches: (value: number) => boolean;
		cumulative: (value: number) => boolean;
		showCumulative: boolean;
	}[] = [
		{
			label: '<10',

			matches: (value) => value < 10,

			cumulative: () => false,

			showCumulative: false,
		},
	];

	for (let high = 10; high <= 29; high++) {
		rows.push({
			label: String(high),

			matches: (value) => value === high,

			cumulative: (value) => value >= high,

			showCumulative: true,
		});
	}

	for (const bucket of rows) {
		const exact = observations.filter((item) =>
			bucket.matches(item.highHand),
		);

		const cumulative = observations.filter((item) =>
			bucket.cumulative(item.highHand),
		);

		const exactWins = exact.filter((item) => item.won).length;

		const cumulativeWins = cumulative.filter((item) => item.won).length;

		const row = body.createEl('tr');

		row.createEl('td', {
			text: bucket.label,
		});

		row.createEl('td', {
			text: formatShare(exactWins, exact.length),
		});

		row.createEl('td', {
			text: bucket.showCumulative
				? formatShare(cumulativeWins, cumulative.length)
				: '—',
		});
	}
}

function buildMatchupHighHandWinObservations(
	games: GameStatisticsRecord[],
	player1: string,
	player2: string,
): HighHandWinObservation[] {
	const observations: HighHandWinObservation[] = [];

	for (const game of games) {
		if (
			!gameContainsPlayers(game, player1, player2) ||
			!hasCompletedScore(game) ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		for (const side of [1, 2] as const) {
			const highHand = effectiveHighHand(game, side);

			if (highHand === null) {
				continue;
			}

			const playerScore =
				side === 1 ? game.player1Score : game.player2Score;

			const opponentScore =
				side === 1 ? game.player2Score : game.player1Score;

			if (playerScore === null || opponentScore === null) {
				continue;
			}

			observations.push({
				highHand,
				won: playerScore > opponentScore,
			});
		}
	}

	return observations;
}

function renderMarginDistributionTable(
	container: HTMLElement,
	title: string,
	games: GameStatisticsRecord[],
): void {
	const margins = games
		.filter(hasCompletedScore)
		.map((game) =>
			Math.abs((game.player1Score ?? 0) - (game.player2Score ?? 0)),
		)
		.filter((margin) => margin > 0);

	const section = container.createDiv('cribbage-stat-section');

	section.createEl('h3', {
		text: title,
	});

	section.createEl('p', {
		text: 'Exact occurrence is the share of games decided by exactly that margin. Cumulative occurrence includes that margin and all smaller margins.',
		cls: 'setting-item-description',
	});

	const scroll = section.createDiv('cribbage-table-scroll');

	const table = scroll.createEl('table', {
		cls: 'cribbage-table cribbage-stat-table',
	});

	const header = table.createEl('thead').createEl('tr');

	for (const label of ['Margin', 'Exact occurrence %', 'At or below %']) {
		header.createEl('th', {
			text: label,
		});
	}

	const body = table.createEl('tbody');

	for (let margin = 1; margin <= 29; margin++) {
		const exact = margins.filter((value) => value === margin).length;

		const cumulative = margins.filter((value) => value <= margin).length;

		const row = body.createEl('tr');

		row.createEl('td', {
			text: String(margin),
		});

		row.createEl('td', {
			text: formatShare(exact, margins.length),
		});

		row.createEl('td', {
			text: formatShare(cumulative, margins.length),
		});
	}

	const thirtyPlus = margins.filter((value) => value >= 30).length;

	const row = body.createEl('tr');

	row.createEl('td', {
		text: '30+',
	});

	row.createEl('td', {
		text: formatShare(thirtyPlus, margins.length),
	});

	row.createEl('td', {
		text: margins.length > 0 ? '100.0%' : '—',
	});
}

function getPlayerSide(
	game: GameStatisticsRecord,
	player: string,
): 1 | 2 | null {
	if (game.player1 === player) {
		return 1;
	}

	if (game.player2 === player) {
		return 2;
	}

	return null;
}

function gameContainsPlayer(
	game: GameStatisticsRecord,
	player: string,
): boolean {
	return game.player1 === player || game.player2 === player;
}

function gameContainsPlayers(
	game: GameStatisticsRecord,
	player1: string,
	player2: string,
): boolean {
	return (
		(game.player1 === player1 && game.player2 === player2) ||
		(game.player1 === player2 && game.player2 === player1)
	);
}

function hasCompletedScore(game: GameStatisticsRecord): boolean {
	return game.player1Score !== null && game.player2Score !== null;
}

function renderMetricGrid(container: HTMLElement, metrics: Metric[]): void {
	const grid = container.createDiv('cribbage-stat-grid');

	for (const metric of metrics) {
		const card = grid.createDiv('cribbage-stat-card');

		card.createEl('span', {
			text: metric.label,
			cls: 'cribbage-stat-label',
		});

		const value = card.createEl('strong', {
			text: metric.value,
			cls: 'cribbage-stat-value',
		});

		if (metric.valueClass) {
			value.addClass(metric.valueClass);
		}

		if (metric.subtext) {
			card.createEl('span', {
				text: metric.subtext,
				cls: 'cribbage-stat-subtext',
			});
		}
	}
}

function createSelectField(
	container: HTMLElement,
	label: string,
	options: [string, string][],
): HTMLSelectElement {
	const wrapper = container.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	const select = wrapper.createEl('select');

	for (const [value, text] of options) {
		select.createEl('option', {
			value,
			text,
		});
	}

	return select;
}

function createPlayerSelect(
	container: HTMLElement,
	label: string,
	players: string[],
): HTMLSelectElement {
	return createSelectField(
		container,
		label,
		players.map((player) => [player, player]),
	);
}

function getParClass(value: number | null, par: number): string | undefined {
	if (value === null) {
		return undefined;
	}

	const difference = value - par;

	if (Math.abs(difference) < 0.000001) {
		return undefined;
	}

	return difference > 0 ? 'cribbage-above-par' : 'cribbage-below-par';
}

function average(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}

	return values.reduce((total, value) => total + value, 0) / values.length;
}

function sum(
	games: GameStatisticsRecord[],
	getValue: (game: GameStatisticsRecord) => number,
): number {
	return games.reduce((total, game) => total + getValue(game), 0);
}

function formatNumber(value: number | null): string {
	if (value === null) {
		return '—';
	}

	return value.toFixed(2);
}

function formatShare(count: number, total: number): string {
	if (total === 0) {
		return '—';
	}

	return ((count / total) * 100).toFixed(1) + '%';
}

function formatValueWithCount(value: number | null, count: number): string {
	if (value === null) {
		return '—';
	}

	return `${value} (${count}x)`;
}

function formatRecord(wins: number, losses: number): string {
	const total = wins + losses;

	if (total === 0) {
		return '—';
	}

	return `${wins}-${losses} ` + `(${formatShare(wins, total)})`;
}

function formatCountRate(count: number, totalGames: number): string {
	if (totalGames === 0) {
		return '—';
	}

	return `${count} ` + `(${formatShare(count, totalGames)})`;
}

function formatStreak(type: 'W' | 'L' | null, count: number): string {
	if (type === null || count === 0) {
		return '—';
	}

	return `${type}${count}`;
}

function formatPercent(value: number | null): string {
	if (value === null) {
		return '—';
	}

	return (value * 100).toFixed(1) + '%';
}
