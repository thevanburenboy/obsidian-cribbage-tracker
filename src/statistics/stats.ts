import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from '../database/database';

import type {
	ContextRecordOccurrence,
	GameLengthOccurrence,
	PlayerStats,
	ScopedExtraStats,
	ScopedRecordStat,
} from './types';

import {
	formatDate,
	getEffectiveHandEligibility,
	getHandDealer,
	groupHandsByGame,
	effectiveHighHand,
	gameContainsPlayer,
	gameContainsPlayers,
	hasCompletedScore,
	getPlayerSide,
	average,
} from './utils';

import { selectExtremeRecordOccurrences, formatRecordContext } from './context';

export function calculateScopedExtraStats(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
	player: string | null,
	opponent: string | null,
): ScopedExtraStats {
	const relevantGames = games.filter((game) => {
		if (player !== null && !gameContainsPlayer(game, player)) {
			return false;
		}

		if (
			player !== null &&
			opponent !== null &&
			!gameContainsPlayers(game, player, opponent)
		) {
			return false;
		}

		return true;
	});

	const relevantGameIds = new Set(relevantGames.map((game) => game.id));

	const handsByGame = groupHandsByGame(
		hands.filter((hand) => relevantGameIds.has(hand.gameId)),
	);

	const victoryMargins: number[] = [];

	const deficitOccurrences: ContextRecordOccurrence[] = [];
	const finalWinOccurrences: ContextRecordOccurrence[] = [];
	const finalLossOccurrences: ContextRecordOccurrence[] = [];
	const singleRoundOccurrences: ContextRecordOccurrence[] = [];
	const gameLengthOccurrences: GameLengthOccurrence[] = [];
	const averageHandOccurrences: ContextRecordOccurrence[] = [];

	for (const game of relevantGames) {
		const player1Score = game.player1Score;
		const player2Score = game.player2Score;
		const gameHands = handsByGame.get(game.id) ?? [];

		/*
		 * Per-game average hand records use the effective eligibility of each
		 * individual hand component.
		 *
		 * This intentionally does not use game.handDataIncomplete or
		 * hand.handDataIncomplete as a separate exclusion. A manually eligible
		 * final-hand component is allowed to participate.
		 *
		 * Components without a numeric point value are still excluded.
		 */
		for (const side of [1, 2] as const) {
			const playerName = side === 1 ? game.player1 : game.player2;

			if (player !== null && playerName !== player) {
				continue;
			}

			const eligibleHands = gameHands.filter((hand) => {
				const { player1HandEligible, player2HandEligible } =
					getEffectiveHandEligibility(hand);

				const eligible =
					side === 1 ? player1HandEligible : player2HandEligible;

				const points =
					side === 1
						? hand.player1HandPoints
						: hand.player2HandPoints;

				return eligible && typeof points === 'number';
			});

			if (eligibleHands.length === 0) {
				continue;
			}

			const total = eligibleHands.reduce(
				(sum, hand) =>
					sum +
					(side === 1
						? hand.player1HandPoints!
						: hand.player2HandPoints!),
				0,
			);

			averageHandOccurrences.push({
				value: total / eligibleHands.length,
				player: playerName,
				opponent: side === 1 ? game.player2 : game.player1,
				playedDate: game.playedDate,
				playedTime: game.playedTime,
			});
		}

		/*
		 * Game-length statistics require a complete hand log.
		 */
		if (
			!game.handDataIncomplete &&
			typeof player1Score === 'number' &&
			typeof player2Score === 'number' &&
			game.roundCount > 0
		) {
			gameLengthOccurrences.push({
				value: game.roundCount,
				player1: game.player1,
				player2: game.player2,
				playedDate: game.playedDate,
				playedTime: game.playedTime,
			});
		}

		if (
			typeof player1Score !== 'number' ||
			typeof player2Score !== 'number' ||
			player1Score === player2Score
		) {
			continue;
		}

		/* Average margin of victory. */
		if (player === null) {
			victoryMargins.push(Math.abs(player1Score - player2Score));
		} else {
			const side = getPlayerSide(game, player);

			if (side !== null) {
				const score = side === 1 ? player1Score : player2Score;
				const opponentScore = side === 1 ? player2Score : player1Score;

				if (score > opponentScore) {
					victoryMargins.push(score - opponentScore);
				}
			}
		}

		const finalHand = gameHands.find((hand) => hand.isLastHand);

		if (!finalHand) {
			continue;
		}

		const winningSide: 1 | 2 = player1Score > player2Score ? 1 : 2;
		const losingSide: 1 | 2 = winningSide === 1 ? 2 : 1;

		const winnerFinalPoints = getFinalCountPoints(finalHand, winningSide);
		const loserFinalPoints = getFinalCountPoints(finalHand, losingSide);

		if (player === null) {
			if (winnerFinalPoints !== null && winnerFinalPoints > 0) {
				addContextOccurrence(
					finalWinOccurrences,
					winnerFinalPoints,
					game,
					winningSide,
				);
			}

			if (loserFinalPoints !== null && loserFinalPoints > 0) {
				addContextOccurrence(
					finalLossOccurrences,
					loserFinalPoints,
					game,
					losingSide,
				);
			}
		} else {
			const side = getPlayerSide(game, player);

			if (side !== null) {
				const finalPoints = getFinalCountPoints(finalHand, side);

				if (finalPoints !== null && finalPoints > 0) {
					if (side === winningSide) {
						addContextOccurrence(
							finalWinOccurrences,
							finalPoints,
							game,
							side,
						);
					} else {
						addContextOccurrence(
							finalLossOccurrences,
							finalPoints,
							game,
							side,
						);
					}
				}
			}
		}

		/*
		 * We can reconstruct the position after final-round pegging by
		 * subtracting the final count from the final score.
		 */
		if (winnerFinalPoints !== null && loserFinalPoints !== null) {
			const winnerScore = winningSide === 1 ? player1Score : player2Score;
			const loserScore = losingSide === 1 ? player1Score : player2Score;

			const winnerBeforeCount = winnerScore - winnerFinalPoints;
			const loserBeforeCount = loserScore - loserFinalPoints;
			const deficit = loserBeforeCount - winnerBeforeCount;

			if (
				deficit > 0 &&
				(player === null || getPlayerSide(game, player) === winningSide)
			) {
				addContextOccurrence(
					deficitOccurrences,
					deficit,
					game,
					winningSide,
				);
			}
		}
	}

	/*
	 * Largest single-round count.
	 *
	 * A player's round count is their hand plus their crib when they are
	 * dealer.
	 */
	for (const hand of hands) {
		if (!relevantGameIds.has(hand.gameId)) {
			continue;
		}

		let sides: Array<1 | 2>;

		if (player === null) {
			sides = [1, 2];
		} else if (hand.player1 === player) {
			sides = [1];
		} else if (hand.player2 === player) {
			sides = [2];
		} else {
			continue;
		}

		for (const side of sides) {
			const value = getSingleRoundCount(hand, side);

			if (value === null) {
				continue;
			}

			singleRoundOccurrences.push({
				value,
				player: side === 1 ? hand.player1 : hand.player2,
				opponent: side === 1 ? hand.player2 : hand.player1,
				playedDate: hand.playedDate,
				playedTime: hand.playedTime,
			});
		}
	}

	const includePlayer = player === null;

	return {
		averageVictoryMargin: average(victoryMargins),

		highestAverageHand: summarizeContextRecord(
			averageHandOccurrences,
			'maximum',
			includePlayer,
		),

		lowestAverageHand: summarizeContextRecord(
			averageHandOccurrences,
			'minimum',
			includePlayer,
		),

		largestFinalCountDeficit: summarizeContextRecord(
			deficitOccurrences,
			'maximum',
			includePlayer,
		),

		mostFinalCountPointsWin: summarizeContextRecord(
			finalWinOccurrences,
			'maximum',
			includePlayer,
		),

		mostFinalCountPointsLoss: summarizeContextRecord(
			finalLossOccurrences,
			'maximum',
			includePlayer,
		),

		largestSingleRoundCount: summarizeContextRecord(
			singleRoundOccurrences,
			'maximum',
			includePlayer,
		),

		averageGameLength: average(
			gameLengthOccurrences.map((occurrence) => occurrence.value),
		),

		quickestGame: summarizeGameLength(
			gameLengthOccurrences,
			'minimum',
			player,
		),

		longestGame: summarizeGameLength(
			gameLengthOccurrences,
			'maximum',
			player,
		),
	};
}

function getFinalCountPoints(
	hand: HandStatisticsRecord,
	side: 1 | 2,
): number | null {
	const handPoints =
		side === 1 ? hand.player1HandPoints : hand.player2HandPoints;

	if (typeof handPoints !== 'number') {
		return null;
	}

	const dealer = getHandDealer(hand.firstDealer, hand.handNumber);

	if (dealer !== side) {
		return handPoints;
	}

	if (typeof hand.cribPoints !== 'number') {
		return null;
	}

	return handPoints + hand.cribPoints;
}

function getSingleRoundCount(
	hand: HandStatisticsRecord,
	side: 1 | 2,
): number | null {
	const handPoints =
		side === 1 ? hand.player1HandPoints : hand.player2HandPoints;

	if (typeof handPoints !== 'number') {
		return null;
	}

	const dealer = getHandDealer(hand.firstDealer, hand.handNumber);

	if (dealer !== side) {
		return handPoints;
	}

	if (typeof hand.cribPoints !== 'number') {
		return null;
	}

	return handPoints + hand.cribPoints;
}

function addContextOccurrence(
	target: ContextRecordOccurrence[],
	value: number,
	game: GameStatisticsRecord,
	side: 1 | 2,
): void {
	target.push({
		value,
		player: side === 1 ? game.player1 : game.player2,
		opponent: side === 1 ? game.player2 : game.player1,
		playedDate: game.playedDate,
		playedTime: game.playedTime,
	});
}

function summarizeContextRecord(
	occurrences: ContextRecordOccurrence[],
	direction: 'minimum' | 'maximum',
	includePlayer: boolean,
): ScopedRecordStat {
	const selected = selectExtremeRecordOccurrences(occurrences, direction);

	return {
		value: selected[0]?.value ?? null,
		count: selected.length,
		subtext: formatRecordContext(selected, includePlayer),
	};
}

function summarizeGameLength(
	occurrences: GameLengthOccurrence[],
	direction: 'minimum' | 'maximum',
	player: string | null,
): ScopedRecordStat {
	if (occurrences.length === 0) {
		return {
			value: null,
			count: 0,
		};
	}

	const values = occurrences.map((occurrence) => occurrence.value);
	const extreme =
		direction === 'maximum' ? Math.max(...values) : Math.min(...values);

	const matches = occurrences.filter(
		(occurrence) => occurrence.value === extreme,
	);

	return {
		value: extreme,
		count: matches.length,
		subtext: formatGameLengthContext(matches, player),
	};
}

function formatGameLengthContext(
	occurrences: GameLengthOccurrence[],
	player: string | null,
): string | undefined {
	if (occurrences.length === 0) {
		return undefined;
	}

	const latest = [...occurrences].sort(
		(a, b) =>
			b.playedDate.localeCompare(a.playedDate) ||
			b.playedTime.localeCompare(a.playedTime),
	)[0]!;

	const date = formatDate(latest.playedDate);

	if (player === null) {
		const matchup = `${latest.player1} vs ${latest.player2}`;

		return occurrences.length === 1
			? `${matchup} on ${date}`
			: `Last: ${matchup} on ${date}`;
	}

	const opponent =
		latest.player1 === player ? latest.player2 : latest.player1;

	return occurrences.length === 1
		? `vs ${opponent} on ${date}`
		: `Last: vs ${opponent} on ${date}`;
}

export function calculatePlayerStats(
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
		 * Only games where BOTH high hands are known participate in this
		 * comparison.
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

		/* Extreme high-hand results. */
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
			if (game.firstDealer === side) {
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

export function calculateGlobalHighHandExtremes(
	games: GameStatisticsRecord[],
): {
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

export function calculateGlobalExtras(games: GameStatisticsRecord[]): {
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

export function calculateGlobalHighHand(games: GameStatisticsRecord[]): {
	value: number | null;
	count: number;
	scorer: string | null;
} {
	let value: number | null = null;
	let count = 0;
	let scorer: string | null = null;

	for (const game of games) {
		for (const side of [1, 2] as const) {
			const high = effectiveHighHand(game, side);

			if (high === null) {
				continue;
			}

			const player = side === 1 ? game.player1 : game.player2;

			if (value === null || high > value) {
				value = high;
				count = 1;
				scorer = player;
			} else if (high === value) {
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
