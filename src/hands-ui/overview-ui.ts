import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameRecord } from '../database/database';

import {
	createNumberField,
	parseOptionalNumber,
	createSummaryValue,
} from './controls-ui';

export function renderGameSelector(
	container: HTMLElement,
	games: GameRecord[],
	selectedGameId: string,
	onSelectGame: (gameId: string) => void,
): void {
	const panel = container.createDiv('cribbage-panel');

	const field = panel.createDiv('cribbage-form-field');

	field.createEl('label', {
		text: 'Game',
	});

	const select = field.createEl('select');

	for (const game of games) {
		const option = select.createEl('option', {
			value: game.id,
			text:
				`${game.playedDate} ${game.playedTime} — ` +
				`${game.player1} vs ${game.player2} ` +
				`(${game.player1Score ?? '—'}-${game.player2Score ?? '—'})`,
		});

		if (game.id === selectedGameId) {
			option.selected = true;
		}
	}

	select.addEventListener('change', () => {
		onSelectGame(select.value);
	});
}

export function renderGameHeader(
	container: HTMLElement,
	game: GameRecord,
): void {
	const panel = container.createDiv('cribbage-panel');

	panel.createEl('h2', {
		text: `${game.player1} vs ${game.player2}`,
	});

	panel.createEl('p', {
		text: `${game.playedDate} at ${game.playedTime}`,
	});

	panel.createEl('p', {
		text:
			`Score: ${game.player1Score ?? '—'} - ` +
			`${game.player2Score ?? '—'}`,
	});

	panel.createEl('p', {
		text:
			'First dealer: ' +
			(game.firstDealer === 1
				? game.player1
				: game.firstDealer === 2
					? game.player2
					: 'Unknown'),
	});
}

export function renderTrackingSettings(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	game: GameRecord,
	onRefresh: () => void,
): void {
	const summary = plugin.database.getGameHandSummary(game.id);

	const panel = container.createDiv('cribbage-panel');

	panel.createEl('h2', {
		text: 'Hand tracking',
	});

	const incompleteRow = panel.createDiv('cribbage-checkbox-row');

	const incomplete = incompleteRow.createEl('input', {
		type: 'checkbox',
	});

	incomplete.checked = game.handDataIncomplete;

	const incompleteLabel = incompleteRow.createEl('label', {
		text: 'Incomplete hand data',
	});

	incompleteLabel.prepend(incomplete);

	panel.createEl('p', {
		text: 'Incomplete games are excluded from hand, crib, and pegging rate statistics.',
		cls: 'setting-item-description',
	});

	incomplete.addEventListener('change', () => {
		void (async () => {
			try {
				await plugin.database.setHandDataIncomplete(
					game.id,
					incomplete.checked,
				);

				onRefresh();
			} catch (error) {
				console.error(error);

				new Notice('Could not update hand tracking status.');
			}
		})();
	});

	panel.createEl('h3', {
		text: 'Manual high-hand override',
	});

	panel.createEl('p', {
		text: 'If entered, the manual value overrides the high hand calculated from individual hand rows.',
		cls: 'setting-item-description',
	});

	const highGrid = panel.createDiv('cribbage-high-hand-grid');

	const player1High = createNumberField(
		highGrid,
		game.player1,
		game.player1HighHandManual,
	);

	const player2High = createNumberField(
		highGrid,
		game.player2,
		game.player2HighHandManual,
	);

	const saveHigh = panel.createEl('button', {
		text: 'Save high hands',
	});

	saveHigh.addEventListener('click', () => {
		void (async () => {
			const high1 = parseOptionalNumber(player1High.value);

			const high2 = parseOptionalNumber(player2High.value);

			if (high1 === undefined || high2 === undefined) {
				new Notice('High hands must be whole numbers of 0 or greater.');

				return;
			}

			try {
				await plugin.database.setManualHighHands(game.id, high1, high2);

				new Notice('High-hand overrides saved.');

				onRefresh();
			} catch (error) {
				console.error(error);

				new Notice('Could not save high hands.');
			}
		})();
	});

	const effective1 =
		game.player1HighHandManual ?? summary.player1HighHandCalculated;

	const effective2 =
		game.player2HighHandManual ?? summary.player2HighHandCalculated;

	const stats = panel.createDiv('cribbage-hand-summary');

	createSummaryValue(stats, 'Rounds', String(summary.roundCount));

	createSummaryValue(
		stats,
		'Eligible rounds',
		String(summary.eligibleRoundCount),
	);

	createSummaryValue(
		stats,
		`${game.player1} high`,
		effective1 === null ? '—' : String(effective1),
	);

	createSummaryValue(
		stats,
		`${game.player2} high`,
		effective2 === null ? '—' : String(effective2),
	);

	createSummaryValue(
		stats,
		`${game.player1} hand`,
		`${summary.player1HandPointsEligible} total / ${
			summary.player1EligibleHandCount > 0
				? (
						summary.player1HandPointsEligible /
						summary.player1EligibleHandCount
					).toFixed(2)
				: '—'
		} per hand`,
	);

	createSummaryValue(
		stats,
		`${game.player2} hand`,
		`${summary.player2HandPointsEligible} total / ${
			summary.player2EligibleHandCount > 0
				? (
						summary.player2HandPointsEligible /
						summary.player2EligibleHandCount
					).toFixed(2)
				: '—'
		} per hand`,
	);

	createSummaryValue(
		stats,
		`${game.player1} crib`,
		`${summary.player1CribPointsEligible} total / ${
			summary.player1EligibleCribCount > 0
				? (
						summary.player1CribPointsEligible /
						summary.player1EligibleCribCount
					).toFixed(2)
				: '—'
		} per crib`,
	);

	createSummaryValue(
		stats,
		`${game.player2} crib`,
		`${summary.player2CribPointsEligible} total / ${
			summary.player2EligibleCribCount > 0
				? (
						summary.player2CribPointsEligible /
						summary.player2EligibleCribCount
					).toFixed(2)
				: '—'
		} per crib`,
	);

	createSummaryValue(
		stats,
		`${game.player1} pegging`,
		game.handDataIncomplete
			? 'Excluded — incomplete'
			: `${summary.player1PeggingPointsTotal} total / ${
					summary.roundCount > 0
						? (
								summary.player1PeggingPointsTotal /
								summary.roundCount
							).toFixed(2)
						: '—'
				} per round`,
	);

	createSummaryValue(
		stats,
		`${game.player2} pegging`,
		game.handDataIncomplete
			? 'Excluded — incomplete'
			: `${summary.player2PeggingPointsTotal} total / ${
					summary.roundCount > 0
						? (
								summary.player2PeggingPointsTotal /
								summary.roundCount
							).toFixed(2)
						: '—'
				} per round`,
	);
}
