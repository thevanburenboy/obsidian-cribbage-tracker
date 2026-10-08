import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameStatisticsRecord, HandStatisticsRecord } from '../database';

import type { Metric } from './types';

export function getPlayerSide(
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

export function gameContainsPlayer(
	game: GameStatisticsRecord,
	player: string,
): boolean {
	return game.player1 === player || game.player2 === player;
}

export function gameContainsPlayers(
	game: GameStatisticsRecord,
	player1: string,
	player2: string,
): boolean {
	return (
		(game.player1 === player1 && game.player2 === player2) ||
		(game.player1 === player2 && game.player2 === player1)
	);
}

export function hasCompletedScore(game: GameStatisticsRecord): boolean {
	return game.player1Score !== null && game.player2Score !== null;
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
	return handNumber % 2 === 1 ? firstDealer : firstDealer === 1 ? 2 : 1;
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
	 * Explicit overrides take precedence over automatic eligibility.
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

export function renderMetricGrid(
	container: HTMLElement,
	metrics: Metric[],
): void {
	const grid = container.createDiv('cribbage-stat-grid');

	for (const metric of metrics) {
		const card = grid.createDiv('cribbage-stat-card');

		card.createSpan({
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
			card.createSpan({
				text: metric.subtext,
				cls: 'cribbage-stat-subtext',
			});
		}
	}
}

export function createSelectField(
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

export function createPlayerSelect(
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

export function getParClass(
	value: number | null,
	par: number,
): string | undefined {
	if (value === null) {
		return undefined;
	}

	const difference = value - par;

	if (Math.abs(difference) < 0.000001) {
		return undefined;
	}

	return difference > 0 ? 'cribbage-above-par' : 'cribbage-below-par';
}

export function average(values: number[]): number | null {
	if (values.length === 0) {
		return null;
	}

	return values.reduce((total, value) => total + value, 0) / values.length;
}

export function sum(
	games: GameStatisticsRecord[],
	getValue: (game: GameStatisticsRecord) => number,
): number {
	return games.reduce((total, game) => total + getValue(game), 0);
}

export function formatNumber(value: number | null): string {
	if (value === null) {
		return '—';
	}

	return value.toFixed(2);
}

export function formatShare(count: number, total: number): string {
	if (total === 0) {
		return '—';
	}

	return ((count / total) * 100).toFixed(1) + '%';
}

export function formatValueWithCount(
	value: number | null,
	count: number,
): string {
	if (value === null) {
		return '—';
	}

	return `${value} (${count}x)`;
}

export function formatRecord(wins: number, losses: number): string {
	const total = wins + losses;

	if (total === 0) {
		return '—';
	}

	return `${wins}-${losses} ` + `(${formatShare(wins, total)})`;
}

export function formatCountRate(count: number, totalGames: number): string {
	if (totalGames === 0) {
		return '—';
	}

	return `${count} ` + `(${formatShare(count, totalGames)})`;
}

export function formatStreak(type: 'W' | 'L' | null, count: number): string {
	if (type === null || count === 0) {
		return '—';
	}

	return `${type}${count}`;
}

export function formatPercent(value: number | null): string {
	if (value === null) {
		return '—';
	}

	return (value * 100).toFixed(1) + '%';
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

export function formatScopedRecord(
	record: { value: number | null; count: number },
	decimals = 0,
): string {
	if (record.value === null) {
		return '—';
	}

	const value =
		decimals > 0 ? record.value.toFixed(decimals) : String(record.value);

	return record.count > 1 ? `${value} (x${record.count})` : value;
}

export function formatStreakWithCount(
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

export function getPluginHandPar(plugin: CribbageTrackerPluginContext): number {
	return (plugin.settings.dealerHandPar + plugin.settings.poneHandPar) / 2;
}

export function getPluginPeggingPar(
	plugin: CribbageTrackerPluginContext,
): number {
	return (
		(plugin.settings.dealerPeggingPar + plugin.settings.ponePeggingPar) / 2
	);
}
