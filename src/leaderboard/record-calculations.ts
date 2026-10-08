import type { GameStatisticsRecord, HandStatisticsRecord } from '../database';

import type {
	GameLengthOccurrence,
	GroupedGameLengthRow,
	GroupedRecordRow,
	GroupedStreakRow,
	RecordContributor,
	RecordOccurrence,
	SkunkWinOccurrence,
	WinningStreakOccurrence,
} from './types';

import {
	cleanPlayerName,
	compareGamesChronologically,
	compareOccurrencesNewestFirst,
	compareStreaksNewestFirst,
	effectiveHighHand,
	formatDate,
	formatRecordContributors,
	formatStreakDateRange,
	getEffectiveHandEligibility,
	getHandDealer,
	groupHandsByGame,
} from './utils';

export function buildSkunkWinOccurrences(
	games: GameStatisticsRecord[],
	doubleSkunk: boolean,
): SkunkWinOccurrence[] {
	const occurrences: SkunkWinOccurrence[] = [];

	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const player1Won = game.player1Score > game.player2Score;

		const winner = player1Won
			? cleanPlayerName(game.player1)
			: cleanPlayerName(game.player2);

		const loser = player1Won
			? cleanPlayerName(game.player2)
			: cleanPlayerName(game.player1);

		const losingScore = player1Won ? game.player2Score : game.player1Score;

		if (!winner || !loser) {
			continue;
		}

		const qualifies = doubleSkunk
			? losingScore <= 60
			: losingScore > 60 && losingScore <= 90;

		if (!qualifies) {
			continue;
		}

		occurrences.push({
			player: winner,
			opponent: loser,

			playedDate: game.playedDate,

			playedTime: game.playedTime,
		});
	}

	return occurrences;
}

export function compareSkunksNewestFirst(
	a: SkunkWinOccurrence,
	b: SkunkWinOccurrence,
): number {
	return (
		b.playedDate.localeCompare(a.playedDate) ||
		b.playedTime.localeCompare(a.playedTime)
	);
}

export function buildWinningStreakOccurrences(
	games: GameStatisticsRecord[],
): WinningStreakOccurrence[] {
	interface ActiveStreak {
		length: number;

		startDate: string;
		startTime: string;

		endDate: string;
		endTime: string;
	}

	const occurrences: WinningStreakOccurrence[] = [];

	const active = new Map<string, ActiveStreak>();

	const chronological = [...games].sort(compareGamesChronologically);

	const finishStreak = (player: string, isActive: boolean) => {
		const streak = active.get(player);

		if (!streak) {
			return;
		}

		if (streak.length >= 2) {
			occurrences.push({
				length: streak.length,

				player,

				startDate: streak.startDate,

				startTime: streak.startTime,

				endDate: streak.endDate,

				endTime: streak.endTime,

				active: isActive,
			});
		}

		active.delete(player);
	};

	const processPlayer = (
		player: string,
		won: boolean,
		game: GameStatisticsRecord,
	) => {
		if (!won) {
			finishStreak(player, false);

			return;
		}

		const existing = active.get(player);

		if (existing) {
			existing.length++;

			existing.endDate = game.playedDate;

			existing.endTime = game.playedTime;

			return;
		}

		active.set(player, {
			length: 1,

			startDate: game.playedDate,

			startTime: game.playedTime,

			endDate: game.playedDate,

			endTime: game.playedTime,
		});
	};

	for (const game of chronological) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const player1 = cleanPlayerName(game.player1);

		const player2 = cleanPlayerName(game.player2);

		if (!player1 || !player2) {
			continue;
		}

		processPlayer(
			player1,

			game.player1Score > game.player2Score,

			game,
		);

		processPlayer(
			player2,

			game.player2Score > game.player1Score,

			game,
		);
	}

	/*
	 * Anything still in the map is an
	 * ongoing/current streak.
	 */
	for (const player of Array.from(active.keys())) {
		finishStreak(player, true);
	}

	return occurrences;
}

export function groupWinningStreakOccurrences(
	occurrences: WinningStreakOccurrence[],
): GroupedStreakRow[] {
	const grouped = new Map<number, WinningStreakOccurrence[]>();

	for (const occurrence of occurrences) {
		const existing = grouped.get(occurrence.length);

		if (existing) {
			existing.push(occurrence);
		} else {
			grouped.set(occurrence.length, [occurrence]);
		}
	}

	const lengths = Array.from(grouped.keys()).sort((a, b) => b - a);

	const rows: GroupedStreakRow[] = [];

	let rank = 1;

	for (const length of lengths) {
		if (rows.length >= 5) {
			break;
		}

		const streaks = grouped.get(length) ?? [];

		if (streaks.length === 0) {
			continue;
		}

		const contributorStreaks = new Map<string, WinningStreakOccurrence[]>();

		for (const streak of streaks) {
			const existing = contributorStreaks.get(streak.player);

			if (existing) {
				existing.push(streak);
			} else {
				contributorStreaks.set(streak.player, [streak]);
			}
		}

		const contributors: RecordContributor[] = Array.from(
			contributorStreaks.entries(),
		).map(([player, playerStreaks]) => {
			const latest = [...playerStreaks].sort(
				compareStreaksNewestFirst,
			)[0]!;

			return {
				name: player,

				count: playerStreaks.length,

				latestDate: latest.endDate,

				latestTime: latest.endTime,
			};
		});

		const label =
			contributors.length === 1 ? contributors[0]!.name : 'Multiple';

		let subtext: string;

		let activeSingleton = false;

		if (streaks.length === 1) {
			const streak = streaks[0]!;

			subtext = formatStreakDateRange(streak);

			activeSingleton = streak.active;
		} else if (contributors.length === 1) {
			const latest = [...streaks].sort(compareStreaksNewestFirst)[0]!;

			subtext = `Last: ${formatStreakDateRange(latest)}`;
		} else {
			subtext = formatRecordContributors(contributors, true);
		}

		rows.push({
			rank,

			length,

			count: streaks.length,

			label,

			subtext,

			activeSingleton,
		});

		rank += streaks.length;
	}

	return rows;
}

export function buildGameLengthOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): GameLengthOccurrence[] {
	const occurrences: GameLengthOccurrence[] = [];

	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		if (
			game.handDataIncomplete ||
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number'
		) {
			continue;
		}

		const gameHands = handsByGame.get(game.id) ?? [];

		if (gameHands.length === 0) {
			continue;
		}

		const player1 = cleanPlayerName(game.player1);

		const player2 = cleanPlayerName(game.player2);

		if (!player1 || !player2) {
			continue;
		}

		occurrences.push({
			hands: gameHands.length,

			player1,
			player2,

			playedDate: game.playedDate,

			playedTime: game.playedTime,
		});
	}

	return occurrences;
}

export function groupGameLengthOccurrences(
	occurrences: GameLengthOccurrence[],
	direction: 'ascending' | 'descending',
): GroupedGameLengthRow[] {
	const grouped = new Map<number, GameLengthOccurrence[]>();

	for (const occurrence of occurrences) {
		const existing = grouped.get(occurrence.hands);

		if (existing) {
			existing.push(occurrence);
		} else {
			grouped.set(occurrence.hands, [occurrence]);
		}
	}

	const counts = Array.from(grouped.keys()).sort((a, b) =>
		direction === 'descending' ? b - a : a - b,
	);

	const rows: GroupedGameLengthRow[] = [];

	let rank = 1;

	for (const hands of counts) {
		if (rows.length >= 5) {
			break;
		}

		const games = grouped.get(hands) ?? [];

		if (games.length === 0) {
			continue;
		}

		const matchupGroups = new Map<string, GameLengthOccurrence[]>();

		for (const game of games) {
			const matchup = getGameLengthMatchupLabel(game);

			const existing = matchupGroups.get(matchup);

			if (existing) {
				existing.push(game);
			} else {
				matchupGroups.set(matchup, [game]);
			}
		}

		const matchups = Array.from(matchupGroups.entries()).sort((a, b) => {
			const latestA = [...a[1]].sort(compareGameLengthsNewestFirst)[0]!;

			const latestB = [...b[1]].sort(compareGameLengthsNewestFirst)[0]!;

			return (
				compareGameLengthsNewestFirst(latestA, latestB) ||
				a[0].localeCompare(b[0])
			);
		});

		let label: string;
		let subtext: string;

		if (matchups.length === 1) {
			const [matchup, matchupGames] = matchups[0]!;

			label = matchup;

			const latest = [...matchupGames].sort(
				compareGameLengthsNewestFirst,
			)[0]!;

			subtext =
				matchupGames.length === 1
					? formatDate(latest.playedDate)
					: `Last: ${formatDate(latest.playedDate)}`;
		} else {
			label = 'Multiple';

			if (matchups.length <= 3) {
				subtext = matchups.map(([matchup]) => matchup).join(' • ');
			} else {
				const pieces = matchups.slice(0, 2).map(([matchup]) => matchup);

				pieces.push(`${matchups.length - 2} others`);

				subtext = pieces.join(' • ');
			}
		}

		rows.push({
			rank,

			hands,

			count: games.length,

			label,
			subtext,
		});

		rank += games.length;
	}

	return rows;
}

export function getGameLengthMatchupLabel(game: GameLengthOccurrence): string {
	const players = [game.player1, game.player2].sort((a, b) =>
		a.localeCompare(b),
	);

	return `${players[0]} vs ${players[1]}`;
}

export function compareGameLengthsNewestFirst(
	a: GameLengthOccurrence,
	b: GameLengthOccurrence,
): number {
	return (
		b.playedDate.localeCompare(a.playedDate) ||
		b.playedTime.localeCompare(a.playedTime)
	);
}

export function buildHighestHandOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		const gameHands = handsByGame.get(game.id) ?? [];

		/*
		 * If we have individual hand rows,
		 * every recorded hand score counts.
		 */
		if (gameHands.length > 0) {
			for (const hand of gameHands) {
				if (typeof hand.player1HandPoints === 'number') {
					addRecordOccurrence(
						occurrences,

						hand.player1HandPoints,

						hand.player1,
						hand.player2,

						hand.playedDate,
						hand.playedTime,
					);
				}

				if (typeof hand.player2HandPoints === 'number') {
					addRecordOccurrence(
						occurrences,

						hand.player2HandPoints,

						hand.player2,
						hand.player1,

						hand.playedDate,
						hand.playedTime,
					);
				}

				/*
				 * The crib belongs to the dealer.
				 * Include it regardless of eligibility.
				 */
				if (
					typeof hand.cribPoints === 'number' &&
					hand.firstDealer !== null
				) {
					const dealer = getHandDealer(
						hand.firstDealer,
						hand.handNumber,
					);

					addRecordOccurrence(
						occurrences,
						hand.cribPoints,
						dealer === 1 ? hand.player1 : hand.player2,
						dealer === 1 ? hand.player2 : hand.player1,
						hand.playedDate,
						hand.playedTime,
					);
				}
			}

			continue;
		}

		/*
		 * Historical/manual-only game:
		 * one occurrence from each manual
		 * high hand if available.
		 */
		if (game.player1HighHandManual !== null) {
			addRecordOccurrence(
				occurrences,

				game.player1HighHandManual,

				game.player1,
				game.player2,

				game.playedDate,
				game.playedTime,
			);
		}

		if (game.player2HighHandManual !== null) {
			addRecordOccurrence(
				occurrences,

				game.player2HighHandManual,

				game.player2,
				game.player1,

				game.playedDate,
				game.playedTime,
			);
		}
	}

	return occurrences;
}

export function buildHighHandLossOccurrences(
	games: GameStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const losingSide: 1 | 2 = game.player1Score < game.player2Score ? 1 : 2;

		const value = effectiveHighHand(game, losingSide);

		if (value === null) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			value,

			losingSide === 1 ? game.player1 : game.player2,

			losingSide === 1 ? game.player2 : game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

export function buildLowHighHandWinOccurrences(
	games: GameStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const winningSide: 1 | 2 =
			game.player1Score > game.player2Score ? 1 : 2;

		const value = effectiveHighHand(game, winningSide);

		if (value === null) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			value,

			winningSide === 1 ? game.player1 : game.player2,

			winningSide === 1 ? game.player2 : game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

export function getRoundCountPoints(
	hand: HandStatisticsRecord,
	side: 1 | 2,
): number | null {
	const handPoints =
		side === 1 ? hand.player1HandPoints : hand.player2HandPoints;

	if (typeof handPoints !== 'number') {
		return null;
	}

	const dealer = getHandDealer(hand.firstDealer, hand.handNumber);

	/*
	 * Pone only counts their hand,
	 * so crib points do not need to
	 * exist for their total to be known.
	 */
	if (dealer !== side) {
		return handPoints;
	}

	if (typeof hand.cribPoints !== 'number') {
		return null;
	}

	return handPoints + hand.cribPoints;
}

export function buildSingleRoundCountOccurrences(
	hands: HandStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	for (const hand of hands) {
		const player1Points = getRoundCountPoints(hand, 1);

		if (player1Points !== null) {
			addRecordOccurrence(
				occurrences,
				player1Points,

				hand.player1,
				hand.player2,

				hand.playedDate,
				hand.playedTime,
			);
		}

		const player2Points = getRoundCountPoints(hand, 2);

		if (player2Points !== null) {
			addRecordOccurrence(
				occurrences,
				player2Points,

				hand.player2,
				hand.player1,

				hand.playedDate,
				hand.playedTime,
			);
		}
	}

	return occurrences;
}

export function buildFinalCountDeficitOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const gameHands = handsByGame.get(game.id) ?? [];

		const finalHand = gameHands.find((hand) => hand.isLastHand);

		if (!finalHand) {
			continue;
		}

		const winningSide: 1 | 2 =
			game.player1Score > game.player2Score ? 1 : 2;

		const losingSide: 1 | 2 = winningSide === 1 ? 2 : 1;

		const winnerFinalPoints = getRoundCountPoints(finalHand, winningSide);

		const loserFinalPoints = getRoundCountPoints(finalHand, losingSide);

		if (winnerFinalPoints === null || loserFinalPoints === null) {
			continue;
		}

		const winnerScore =
			winningSide === 1 ? game.player1Score : game.player2Score;

		const loserScore =
			losingSide === 1 ? game.player1Score : game.player2Score;

		const winnerBeforeCount = winnerScore - winnerFinalPoints;

		const loserBeforeCount = loserScore - loserFinalPoints;

		const deficit = loserBeforeCount - winnerBeforeCount;

		/*
		 * This record specifically measures
		 * deficits that were actually overcome.
		 */
		if (deficit <= 0) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			deficit,

			winningSide === 1 ? game.player1 : game.player2,

			winningSide === 1 ? game.player2 : game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

export function buildFinalCountPointOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
	winner: boolean,
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const gameHands = handsByGame.get(game.id) ?? [];

		const finalHand = gameHands.find((hand) => hand.isLastHand);

		if (!finalHand) {
			continue;
		}

		const winningSide: 1 | 2 =
			game.player1Score > game.player2Score ? 1 : 2;

		const side: 1 | 2 = winner ? winningSide : winningSide === 1 ? 2 : 1;

		const points = getRoundCountPoints(finalHand, side);

		if (points === null || points === 0) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			points,

			side === 1 ? game.player1 : game.player2,

			side === 1 ? game.player2 : game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

export function buildAverageHandOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences: RecordOccurrence[] = [];

	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		if (
			game.handDataIncomplete ||
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number'
		) {
			continue;
		}

		const gameHands = handsByGame.get(game.id) ?? [];

		let player1Total = 0;
		let player2Total = 0;
		let player1Count = 0;
		let player2Count = 0;

		for (const hand of gameHands) {
			const { player1HandEligible, player2HandEligible } =
				getEffectiveHandEligibility(hand);

			if (
				player1HandEligible &&
				typeof hand.player1HandPoints === 'number'
			) {
				player1Total += hand.player1HandPoints;

				player1Count++;
			}

			if (
				player2HandEligible &&
				typeof hand.player2HandPoints === 'number'
			) {
				player2Total += hand.player2HandPoints;

				player2Count++;
			}
		}

		if (player1Count > 0) {
			addRecordOccurrence(
				occurrences,
				player1Total / player1Count,

				game.player1,
				game.player2,

				game.playedDate,
				game.playedTime,
			);
		}

		if (player2Count > 0) {
			addRecordOccurrence(
				occurrences,
				player2Total / player2Count,

				game.player2,
				game.player1,

				game.playedDate,
				game.playedTime,
			);
		}
	}

	return occurrences;
}

export function groupRecordOccurrences(
	occurrences: RecordOccurrence[],
	direction: 'ascending' | 'descending',
): GroupedRecordRow[] {
	const grouped = new Map<number, RecordOccurrence[]>();

	for (const occurrence of occurrences) {
		const existing = grouped.get(occurrence.score);

		if (existing) {
			existing.push(occurrence);
		} else {
			grouped.set(occurrence.score, [occurrence]);
		}
	}

	const scores = Array.from(grouped.keys()).sort((a, b) =>
		direction === 'descending' ? b - a : a - b,
	);

	const rows: GroupedRecordRow[] = [];

	let rank = 1;

	for (const score of scores) {
		if (rows.length >= 5) {
			break;
		}

		const scoreOccurrences = grouped.get(score) ?? [];

		if (scoreOccurrences.length === 0) {
			continue;
		}

		const contributorOccurrences = new Map<string, RecordOccurrence[]>();

		for (const occurrence of scoreOccurrences) {
			const existing = contributorOccurrences.get(occurrence.player);

			if (existing) {
				existing.push(occurrence);
			} else {
				contributorOccurrences.set(occurrence.player, [occurrence]);
			}
		}

		const contributors: RecordContributor[] = Array.from(
			contributorOccurrences.entries(),
		).map(([player, playerOccurrences]) => {
			const latest = [...playerOccurrences].sort(
				compareOccurrencesNewestFirst,
			)[0]!;

			return {
				name: player,

				count: playerOccurrences.length,

				latestDate: latest.playedDate,

				latestTime: latest.playedTime,
			};
		});

		const label =
			contributors.length === 1 ? contributors[0]!.name : 'Multiple';

		let subtext: string;

		if (scoreOccurrences.length === 1) {
			const occurrence = scoreOccurrences[0]!;

			subtext = `vs ${occurrence.opponent} on ${formatDate(occurrence.playedDate)}`;
		} else if (contributors.length === 1) {
			const latest = [...scoreOccurrences].sort(
				compareOccurrencesNewestFirst,
			)[0]!;

			subtext = `Last: vs ${latest.opponent} on ${formatDate(latest.playedDate)}`;
		} else {
			subtext = formatRecordContributors(contributors, true);
		}

		rows.push({
			rank,
			score,

			count: scoreOccurrences.length,

			label,
			subtext,
		});

		/*
		 * A score occurring 9 times occupies
		 * nine theoretical leaderboard places.
		 */
		rank += scoreOccurrences.length;
	}

	return rows;
}

export function addRecordOccurrence(
	target: RecordOccurrence[],
	score: number,
	playerValue: string | null | undefined,
	opponentValue: string | null | undefined,
	playedDate: string,
	playedTime: string,
): void {
	const player = cleanPlayerName(playerValue);

	const opponent = cleanPlayerName(opponentValue);

	if (!player || !opponent) {
		return;
	}

	target.push({
		score,
		player,
		opponent,
		playedDate,
		playedTime,
	});
}
