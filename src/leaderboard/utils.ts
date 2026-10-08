import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from '../database/database';

import type {
	PlayerAggregate,
	RecordContributor,
	RecordOccurrence,
	WinningStreakOccurrence,
} from './types';

export function formatRecordContributors(
	contributors: RecordContributor[],
	showCounts: boolean,
): string {
	const sorted = [...contributors].sort(
		(a, b) =>
			b.latestDate.localeCompare(a.latestDate) ||
			b.latestTime.localeCompare(a.latestTime) ||
			a.name.localeCompare(b.name),
	);

	/*
	 * Up to three contributors:
	 * show everyone.
	 *
	 * Four or more:
	 * show the two most recent,
	 * then "X others".
	 */
	const visible = sorted.length <= 3 ? sorted : sorted.slice(0, 2);

	const pieces = visible.map((contributor) =>
		showCounts
			? `${contributor.name} ${contributor.count}x`
			: contributor.name,
	);

	if (sorted.length > 3) {
		pieces.push(`${sorted.length - 2} others`);
	}

	return pieces.join(' • ');
}

export function effectiveHighHand(
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

export function getHandDealer(firstDealer: 1 | 2, handNumber: number): 1 | 2 {
	if (handNumber % 2 === 1) {
		return firstDealer;
	}

	return firstDealer === 1 ? 2 : 1;
}

export function getEffectiveHandEligibility(hand: HandStatisticsRecord): {
	player1HandEligible: boolean;
	player2HandEligible: boolean;
	cribEligible: boolean;
} {
	let player1HandEligible = !hand.isLastHand;

	let player2HandEligible = !hand.isLastHand;

	let cribEligible = !hand.isLastHand;

	if (hand.isLastHand && hand.firstDealer !== null) {
		const dealer = getHandDealer(hand.firstDealer, hand.handNumber);

		const dealerPoints =
			dealer === 1 ? hand.player1HandPoints : hand.player2HandPoints;

		if (hand.cribPoints !== null && hand.cribPoints > 0) {
			player1HandEligible = true;
			player2HandEligible = true;
		} else if (dealerPoints !== null && dealerPoints > 0) {
			const pone = dealer === 1 ? 2 : 1;

			if (pone === 1) {
				player1HandEligible = true;
			} else {
				player2HandEligible = true;
			}
		}

		cribEligible = false;
	}

	/*
	 * Explicit overrides take precedence over
	 * the automatic eligibility calculation.
	 */
	if (hand.player1HandEligibilityOverride !== null) {
		player1HandEligible = hand.player1HandEligibilityOverride;
	}

	if (hand.player2HandEligibilityOverride !== null) {
		player2HandEligible = hand.player2HandEligibilityOverride;
	}

	if (hand.cribEligibilityOverride !== null) {
		cribEligible = hand.cribEligibilityOverride;
	}

	return {
		player1HandEligible,
		player2HandEligible,
		cribEligible,
	};
}

export function groupHandsByGame(
	hands: HandStatisticsRecord[],
): Map<string, HandStatisticsRecord[]> {
	const grouped = new Map<string, HandStatisticsRecord[]>();

	for (const hand of hands) {
		const existing = grouped.get(hand.gameId);

		if (existing) {
			existing.push(hand);
		} else {
			grouped.set(hand.gameId, [hand]);
		}
	}

	return grouped;
}

export function compareGamesChronologically(
	a: GameStatisticsRecord,
	b: GameStatisticsRecord,
): number {
	return (
		a.playedDate.localeCompare(b.playedDate) ||
		a.playedTime.localeCompare(b.playedTime) ||
		a.id.localeCompare(b.id)
	);
}

export function compareOccurrencesNewestFirst(
	a: RecordOccurrence,
	b: RecordOccurrence,
): number {
	return (
		b.playedDate.localeCompare(a.playedDate) ||
		b.playedTime.localeCompare(a.playedTime)
	);
}

export function compareStreaksNewestFirst(
	a: WinningStreakOccurrence,
	b: WinningStreakOccurrence,
): number {
	return (
		b.endDate.localeCompare(a.endDate) ||
		b.endTime.localeCompare(a.endTime) ||
		b.startDate.localeCompare(a.startDate) ||
		b.startTime.localeCompare(a.startTime)
	);
}

export function cleanPlayerName(
	value: string | null | undefined,
): string | null {
	const name = value?.trim();

	return name ? name : null;
}

export function winRate(player: PlayerAggregate): number {
	if (player.games === 0) {
		return 0;
	}

	return player.wins / player.games;
}

export function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function formatSigned(value: number): string {
	const text = value.toFixed(2);

	return value > 0 ? `+${text}` : text;
}

export function formatDate(value: string): string {
	const parts = value.split('-');

	if (parts.length !== 3) {
		return value;
	}

	const year = Number(parts[0]);

	const month = Number(parts[1]);

	const day = Number(parts[2]);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return value;
	}

	return `${month}/${day}/${String(year).slice(-2)}`;
}

export function formatStreakDateRange(streak: WinningStreakOccurrence): string {
	return `${formatDate(streak.startDate)} - ${formatDate(streak.endDate)}`;
}

export function formatRecordValue(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
