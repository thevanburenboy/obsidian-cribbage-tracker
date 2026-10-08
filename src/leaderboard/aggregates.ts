import type { GameStatisticsRecord, HandStatisticsRecord } from '../database';

import type { PlayerAggregate } from './types';

import {
	effectiveHighHand,
	getEffectiveHandEligibility,
	getHandDealer,
	groupHandsByGame,
	cleanPlayerName,
} from './utils';

export function buildPlayerAggregates(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): PlayerAggregate[] {
	const players = new Map<string, PlayerAggregate>();

	/*
	 * -------------------------
	 * Completed-game statistics
	 * -------------------------
	 */
	for (const game of games) {
		if (
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number'
		) {
			continue;
		}

		const player1 = cleanPlayerName(game.player1);

		const player2 = cleanPlayerName(game.player2);

		if (!player1 || !player2) {
			continue;
		}

		const p1 = getPlayerAggregate(players, player1);

		const p2 = getPlayerAggregate(players, player2);

		updateGameAggregate(p1, game, 1);

		updateGameAggregate(p2, game, 2);
	}

	/*
	 * -------------------------
	 * Hand / crib statistics
	 * -------------------------
	 */
	for (const hand of hands) {
		const player1 = cleanPlayerName(hand.player1);

		const player2 = cleanPlayerName(hand.player2);

		if (!player1 || !player2) {
			continue;
		}

		const p1 = getPlayerAggregate(players, player1);

		const p2 = getPlayerAggregate(players, player2);

		/*
		 * Hand / crib statistics use effective
		 * component-level eligibility.
		 *
		 * A component can be eligible even when
		 * it belongs to the final hand, provided
		 * the user explicitly marked that component
		 * eligible.
		 */
		const { player1HandEligible, player2HandEligible, cribEligible } =
			getEffectiveHandEligibility(hand);

		if (player1HandEligible && typeof hand.player1HandPoints === 'number') {
			p1.handPointsTotal += hand.player1HandPoints;

			p1.handCount++;
		}

		if (player2HandEligible && typeof hand.player2HandPoints === 'number') {
			p2.handPointsTotal += hand.player2HandPoints;

			p2.handCount++;
		}

		if (
			cribEligible &&
			typeof hand.cribPoints === 'number' &&
			hand.firstDealer !== null
		) {
			const dealer = getHandDealer(hand.firstDealer, hand.handNumber);

			const owner = dealer === 1 ? p1 : p2;

			owner.cribPointsTotal += hand.cribPoints;

			owner.cribCount++;
		}
	}

	/*
	 * -------------------------
	 * Pegging
	 * -------------------------
	 *
	 * Recreate the same core calculation:
	 *
	 * final score
	 * - all hand points
	 * - all owned crib points
	 *
	 * Only complete games with completely
	 * populated hand rows qualify.
	 */
	const handsByGame = groupHandsByGame(hands);

	for (const game of games) {
		if (
			game.handDataIncomplete ||
			typeof game.player1Score !== 'number' ||
			typeof game.player2Score !== 'number' ||
			game.firstDealer === null
		) {
			continue;
		}

		const gameHands = handsByGame.get(game.id) ?? [];

		if (gameHands.length === 0) {
			continue;
		}

		const allComplete = gameHands.every(
			(hand) =>
				typeof hand.player1HandPoints === 'number' &&
				typeof hand.player2HandPoints === 'number' &&
				typeof hand.cribPoints === 'number',
		);

		if (!allComplete) {
			continue;
		}

		let player1Hands = 0;
		let player2Hands = 0;

		let player1Cribs = 0;
		let player2Cribs = 0;

		for (const hand of gameHands) {
			player1Hands += hand.player1HandPoints!;

			player2Hands += hand.player2HandPoints!;

			const dealer = getHandDealer(game.firstDealer, hand.handNumber);

			if (dealer === 1) {
				player1Cribs += hand.cribPoints!;
			} else {
				player2Cribs += hand.cribPoints!;
			}
		}

		const player1 = cleanPlayerName(game.player1);

		const player2 = cleanPlayerName(game.player2);

		if (!player1 || !player2) {
			continue;
		}

		const p1 = getPlayerAggregate(players, player1);

		const p2 = getPlayerAggregate(players, player2);

		p1.peggingPointsTotal +=
			game.player1Score - player1Hands - player1Cribs;

		p2.peggingPointsTotal +=
			game.player2Score - player2Hands - player2Cribs;

		p1.peggingRoundCount += gameHands.length;

		p2.peggingRoundCount += gameHands.length;
	}

	return Array.from(players.values());
}

function updateGameAggregate(
	player: PlayerAggregate,
	game: GameStatisticsRecord,
	side: 1 | 2,
): void {
	const score = side === 1 ? game.player1Score : game.player2Score;

	const opponentScore = side === 1 ? game.player2Score : game.player1Score;

	if (typeof score !== 'number' || typeof opponentScore !== 'number') {
		return;
	}

	player.games++;
	player.totalScore += score;

	player.totalDifferential += score - opponentScore;

	const won = score > opponentScore;

	if (won) {
		player.wins++;

		player.victoryMarginTotal += score - opponentScore;
	} else {
		player.losses++;
	}

	const highHand = effectiveHighHand(game, side);

	if (
		highHand !== null &&
		(player.bestHighHand === null || highHand > player.bestHighHand)
	) {
		player.bestHighHand = highHand;
	}

	const opponentHighHand = effectiveHighHand(game, side === 1 ? 2 : 1);

	if (highHand !== null && opponentHighHand !== null) {
		player.highHandComparableGames++;

		if (highHand > opponentHighHand) {
			player.higherHighHandGames++;
		}
	}

	if (game.firstDealer !== null) {
		if (game.firstDealer === side) {
			player.dealerGames++;

			if (won) {
				player.dealerWins++;
			} else {
				player.dealerLosses++;
			}
		} else {
			player.poneGames++;

			if (won) {
				player.poneWins++;
			} else {
				player.poneLosses++;
			}
		}
	}

	if (won) {
		if (opponentScore <= 60) {
			player.doubleSkunkWins++;
		} else if (opponentScore <= 90) {
			player.skunkWins++;
		}
	}
}

function getPlayerAggregate(
	players: Map<string, PlayerAggregate>,
	name: string,
): PlayerAggregate {
	const existing = players.get(name);

	if (existing) {
		return existing;
	}

	const player: PlayerAggregate = {
		name,

		games: 0,
		wins: 0,
		losses: 0,

		totalScore: 0,
		totalDifferential: 0,
		victoryMarginTotal: 0,

		bestHighHand: null,

		dealerGames: 0,
		dealerWins: 0,
		dealerLosses: 0,

		poneGames: 0,
		poneWins: 0,
		poneLosses: 0,

		highHandComparableGames: 0,
		higherHighHandGames: 0,

		skunkWins: 0,
		doubleSkunkWins: 0,

		handPointsTotal: 0,
		handCount: 0,

		cribPointsTotal: 0,
		cribCount: 0,

		peggingPointsTotal: 0,
		peggingRoundCount: 0,
	};

	players.set(name, player);

	return player;
}
