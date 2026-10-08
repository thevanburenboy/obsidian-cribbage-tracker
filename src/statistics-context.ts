import type {
	GameStatisticsRecord,
} from './database';

import type {
	ContextRecordOccurrence,
	ContextStreakOccurrence,
	SkunkContextOccurrence,
	StatisticContext,
} from './statistics-types';

import {
	effectiveHighHand,
	gameContainsPlayer,
	gameContainsPlayers,
	hasCompletedScore,
	getPlayerSide,
	formatDate,
} from './statistics-utils';

export function calculateStatisticContext(
	games: GameStatisticsRecord[],
	player: string | null,
	opponent: string | null,
): StatisticContext {
	const relevant = games.filter((game) => {
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

	const highHands: ContextRecordOccurrence[] = [];
	const lossHighHands: ContextRecordOccurrence[] = [];
	const winHighHands: ContextRecordOccurrence[] = [];

	for (const game of relevant) {
		for (const side of [1, 2] as const) {
			const subject = side === 1 ? game.player1 : game.player2;

			if (player !== null && subject !== player) {
				continue;
			}

			const high = effectiveHighHand(game, side);

			if (high === null) {
				continue;
			}

			const opponentName = side === 1 ? game.player2 : game.player1;

			const occurrence: ContextRecordOccurrence = {
				value: high,
				player: subject,
				opponent: opponentName,
				playedDate: game.playedDate,
				playedTime: game.playedTime,
			};

			highHands.push(occurrence);

			if (
				!hasCompletedScore(game) ||
				game.player1Score === game.player2Score
			) {
				continue;
			}

			const playerScore = side === 1 ? game.player1Score : game.player2Score;
			const opponentScore = side === 1 ? game.player2Score : game.player1Score;

			if (playerScore === null || opponentScore === null) {
				continue;
			}

			if (playerScore > opponentScore) {
				winHighHands.push(occurrence);
			} else {
				lossHighHands.push(occurrence);
			}
		}
	}

	const includePlayer = player === null;

	const highHandOccurrences = selectExtremeRecordOccurrences(
		highHands,
		'maximum',
	);

	const skunkOccurrences = buildSkunkContextOccurrences(relevant);

	const highestLossOccurrences = selectExtremeRecordOccurrences(
		lossHighHands,
		'maximum',
	);

	const lowestWinOccurrences = selectExtremeRecordOccurrences(
		winHighHands,
		'minimum',
	);

	const streakPlayers =
		player === null
			? Array.from(
					new Set(
						relevant.flatMap((game) => [game.player1, game.player2]),
					),
				)
			: [player];

	const streaks: ContextStreakOccurrence[] = [];

	for (const streakPlayer of streakPlayers) {
		streaks.push(...buildContextStreakOccurrences(relevant, streakPlayer));
	}

	const longestWins = selectLongestStreakOccurrences(streaks, 'W');
	const longestLosses = selectLongestStreakOccurrences(streaks, 'L');

	const current =
		player === null
			? undefined
			: streaks.find(
					(streak) => streak.player === player && streak.active,
				);

	const normalSkunks = skunkOccurrences.filter(
		(occurrence) => !occurrence.doubleSkunk,
	);

	const doubleSkunks = skunkOccurrences.filter(
		(occurrence) => occurrence.doubleSkunk,
	);

	const latestGlobalSkunk = latestSkunkOccurrence(normalSkunks);
	const latestGlobalDoubleSkunk = latestSkunkOccurrence(doubleSkunks);

	const playerSkunkWin =
		player === null
			? undefined
			: latestSkunkOccurrence(
					normalSkunks.filter((occurrence) => occurrence.winner === player),
				);

	const playerSkunkLoss =
		player === null
			? undefined
			: latestSkunkOccurrence(
					normalSkunks.filter((occurrence) => occurrence.loser === player),
				);

	const playerDoubleSkunkWin =
		player === null
			? undefined
			: latestSkunkOccurrence(
					doubleSkunks.filter((occurrence) => occurrence.winner === player),
				);

	const playerDoubleSkunkLoss =
		player === null
			? undefined
			: latestSkunkOccurrence(
					doubleSkunks.filter((occurrence) => occurrence.loser === player),
				);

	return {
		highHand: formatRecordContext(highHandOccurrences, includePlayer),

		highestHighHandInLoss: formatRecordContext(
			highestLossOccurrences,
			includePlayer,
		),

		lowestHighHandInWin: formatRecordContext(
			lowestWinOccurrences,
			includePlayer,
		),

		currentStreak: current
			? formatStreakContext([current], false)
			: undefined,

		longestWinStreak: formatStreakContext(longestWins, includePlayer),
		longestLossStreak: formatStreakContext(longestLosses, includePlayer),

		skunkWin: formatPlayerSkunkContext(playerSkunkWin, true, false),
		skunkLoss: formatPlayerSkunkContext(playerSkunkLoss, false, false),
		doubleSkunkWin: formatPlayerSkunkContext(playerDoubleSkunkWin, true, true),
		doubleSkunkLoss: formatPlayerSkunkContext(playerDoubleSkunkLoss, false, true),

		globalSkunkGame: formatGlobalSkunkContext(latestGlobalSkunk),
		globalDoubleSkunkGame: formatGlobalSkunkContext(latestGlobalDoubleSkunk),
	};
}

export function selectExtremeRecordOccurrences(
	occurrences: ContextRecordOccurrence[],
	direction: 'minimum' | 'maximum',
): ContextRecordOccurrence[] {
	if (occurrences.length === 0) {
		return [];
	}

	const values = occurrences.map((occurrence) => occurrence.value);
	const extreme =
		direction === 'maximum' ? Math.max(...values) : Math.min(...values);

	return occurrences.filter((occurrence) => occurrence.value === extreme);
}

export function buildContextStreakOccurrences(
	games: GameStatisticsRecord[],
	player: string,
): ContextStreakOccurrence[] {
	const chronological = [...games]
		.filter(
			(game) =>
				gameContainsPlayer(game, player) &&
				hasCompletedScore(game) &&
				game.player1Score !== game.player2Score,
		)
		.sort(
			(a, b) =>
				a.playedDate.localeCompare(b.playedDate) ||
				a.playedTime.localeCompare(b.playedTime) ||
				a.id.localeCompare(b.id),
		);

	const occurrences: ContextStreakOccurrence[] = [];

	let currentType: 'W' | 'L' | null = null;
	let currentCount = 0;

	let startDate = '';
	let startTime = '';
	let endDate = '';
	let endTime = '';

	const finish = (active: boolean) => {
		if (currentType === null || currentCount === 0) {
			return;
		}

		occurrences.push({
			type: currentType,
			length: currentCount,
			player,
			startDate,
			startTime,
			endDate,
			endTime,
			active,
		});

		currentType = null;
		currentCount = 0;
	};

	for (const game of chronological) {
		const side = getPlayerSide(game, player);

		if (side === null) {
			continue;
		}

		const playerScore = side === 1 ? game.player1Score : game.player2Score;
		const opponentScore = side === 1 ? game.player2Score : game.player1Score;

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
			endDate = game.playedDate;
			endTime = game.playedTime;
			continue;
		}

		finish(false);

		currentType = result;
		currentCount = 1;
		startDate = game.playedDate;
		startTime = game.playedTime;
		endDate = game.playedDate;
		endTime = game.playedTime;
	}

	finish(true);

	return occurrences;
}

export function selectLongestStreakOccurrences(
	occurrences: ContextStreakOccurrence[],
	type: 'W' | 'L',
): ContextStreakOccurrence[] {
	const matching = occurrences.filter((occurrence) => occurrence.type === type);

	if (matching.length === 0) {
		return [];
	}

	const longest = Math.max(
		...matching.map((occurrence) => occurrence.length),
	);

	return matching.filter((occurrence) => occurrence.length === longest);
}

export function formatRecordContext(
	occurrences: ContextRecordOccurrence[],
	includePlayer: boolean,
): string | undefined {
	if (occurrences.length === 0) {
		return undefined;
	}

	if (occurrences.length === 1) {
		const occurrence = occurrences[0]!;
		const context = `vs ${occurrence.opponent} on ${formatDate(occurrence.playedDate)}`;

		return includePlayer ? `${occurrence.player} • ${context}` : context;
	}

	const players = new Set(occurrences.map((occurrence) => occurrence.player));

	if (players.size === 1) {
		const latest = [...occurrences].sort(compareContextRecordsNewestFirst)[0]!;
		const context = `Last: vs ${latest.opponent} on ${formatDate(latest.playedDate)}`;

		return includePlayer ? `${latest.player} • ${context}` : context;
	}

	return formatContributorContext(occurrences);
}

export function formatStreakContext(
	occurrences: ContextStreakOccurrence[],
	includePlayer: boolean,
): string | undefined {
	if (occurrences.length === 0) {
		return undefined;
	}

	if (occurrences.length === 1) {
		const occurrence = occurrences[0]!;
		const range = formatContextStreakDateRange(occurrence);

		return includePlayer ? `${occurrence.player} • ${range}` : range;
	}

	const players = new Set(occurrences.map((occurrence) => occurrence.player));

	if (players.size === 1) {
		const latest = [...occurrences].sort(compareContextStreaksNewestFirst)[0]!;
		const context = `Last: ${formatContextStreakDateRange(latest)}`;

		return includePlayer ? `${latest.player} • ${context}` : context;
	}

	return formatContributorContext(occurrences);
}

export function formatContributorContext(
	occurrences: Array<{ player: string }>,
): string {
	const counts = new Map<string, number>();

	for (const occurrence of occurrences) {
		counts.set(occurrence.player, (counts.get(occurrence.player) ?? 0) + 1);
	}

	const contributors = Array.from(counts.entries()).sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
	);

	const pieces: string[] = [];

	for (const [player, count] of contributors.slice(0, 2)) {
		pieces.push(`${player} ${count}x`);
	}

	const others = contributors
		.slice(2)
		.reduce((total, [, count]) => total + count, 0);

	if (others > 0) {
		pieces.push(`Others ${others}x`);
	}

	return pieces.join(' • ');
}

function compareContextRecordsNewestFirst(
	a: ContextRecordOccurrence,
	b: ContextRecordOccurrence,
): number {
	return (
		b.playedDate.localeCompare(a.playedDate) ||
		b.playedTime.localeCompare(a.playedTime)
	);
}

function compareContextStreaksNewestFirst(
	a: ContextStreakOccurrence,
	b: ContextStreakOccurrence,
): number {
	return (
		b.endDate.localeCompare(a.endDate) ||
		b.endTime.localeCompare(a.endTime)
	);
}

function formatContextStreakDateRange(
	streak: ContextStreakOccurrence,
): string {
	return `${formatDate(streak.startDate)} - ${formatDate(streak.endDate)}`;
}

export function buildSkunkContextOccurrences(
	games: GameStatisticsRecord[],
): SkunkContextOccurrence[] {
	const occurrences: SkunkContextOccurrence[] = [];

	for (const game of games) {
		if (
			!hasCompletedScore(game) ||
			game.player1Score === game.player2Score
		) {
			continue;
		}

		const player1Won = (game.player1Score ?? 0) > (game.player2Score ?? 0);

		const winner = player1Won ? game.player1 : game.player2;
		const loser = player1Won ? game.player2 : game.player1;

		const winnerScore = player1Won ? game.player1Score! : game.player2Score!;
		const loserScore = player1Won ? game.player2Score! : game.player1Score!;

		if (loserScore > 90) {
			continue;
		}

		occurrences.push({
			winner,
			loser,
			winnerScore,
			loserScore,
			playedDate: game.playedDate,
			playedTime: game.playedTime,
			doubleSkunk: loserScore <= 60,
		});
	}

	return occurrences;
}

function latestSkunkOccurrence(
	occurrences: SkunkContextOccurrence[],
): SkunkContextOccurrence | undefined {
	return [...occurrences].sort(
		(a, b) =>
			b.playedDate.localeCompare(a.playedDate) ||
			b.playedTime.localeCompare(a.playedTime),
	)[0];
}

function formatPlayerSkunkContext(
	occurrence: SkunkContextOccurrence | undefined,
	won: boolean,
	doubleSkunk: boolean,
): string | undefined {
	if (!occurrence) {
		return undefined;
	}

	const verb = doubleSkunk ? 'double-skunked' : 'skunked';
	const opponent = won ? occurrence.loser : occurrence.winner;

	return won
		? `Last: ${verb} ${opponent} on ${formatDate(occurrence.playedDate)}`
		: `Last: ${verb} by ${opponent} on ${formatDate(occurrence.playedDate)}`;
}

function formatGlobalSkunkContext(
	occurrence: SkunkContextOccurrence | undefined,
): string | undefined {
	if (!occurrence) {
		return undefined;
	}

	return (
		`${occurrence.winner} ` +
		`${occurrence.winnerScore} - ` +
		`${occurrence.loserScore} ` +
		`${occurrence.loser} • ` +
		formatDate(occurrence.playedDate)
	);
}

export function calculateGlobalStreakSummary(
	games: GameStatisticsRecord[],
	type: 'W' | 'L',
): {
	length: number;
	count: number;
} {
	const players = new Set<string>();

	for (const game of games) {
		players.add(game.player1);
		players.add(game.player2);
	}

	const occurrences: ContextStreakOccurrence[] = [];

	for (const player of players) {
		occurrences.push(...buildContextStreakOccurrences(games, player));
	}

	const matching = occurrences.filter((occurrence) => occurrence.type === type);

	if (matching.length === 0) {
		return {
			length: 0,
			count: 0,
		};
	}

	const length = Math.max(...matching.map((occurrence) => occurrence.length));

	return {
		length,
		count: matching.filter((occurrence) => occurrence.length === length).length,
	};
}
