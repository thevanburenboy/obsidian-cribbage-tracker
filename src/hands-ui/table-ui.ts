import { Notice } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import type { GameRecord, HandRecord } from '../database/database';

import { confirmAction } from '../confirm-modal';

import { renderAddHand } from './form-ui';

import {
	createInlineNumber,
	createEligibilityControl,
	readHandInput,
	createParLabel,
	attachParColor,
} from './controls-ui';

export function renderHands(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	game: GameRecord,
	onRefresh: () => void,
): void {
	const panel = container.createDiv('cribbage-panel');

	panel.createEl('h2', {
		text: 'Hands',
	});

	panel.createEl('p', {
		text: 'The final row is automatically treated as the last hand and excluded from eligible hand/crib averages. Eligibility is calculated from the scores entered, but you can override it for individual components of the final hand. Only enter the hand points required to reach 121. If game ends during pegging and before hands are scored, enter 0 for the hand scores in the last row to avoid the penultimate round being counted as an ineligible round.',
		cls: 'setting-item-description',
	});

	if (game.firstDealer === null) {
		panel.createEl('p', {
			text: 'Set the first dealer on the Games page before adding hands.',
			cls: 'cribbage-warning',
		});
	}

	const hands = plugin.database.listHands(game.id);

	if (hands.length === 0) {
		panel.createEl('p', {
			text: 'No individual hands recorded.',
			cls: 'cribbage-empty-state',
		});
	} else {
		const scroll = panel.createDiv('cribbage-table-scroll');

		const table = scroll.createEl('table', {
			cls: 'cribbage-table',
		});

		const header = table.createEl('thead').createEl('tr');

		for (const label of [
			'#',
			`${game.player1} Hand`,
			`${game.player2} Hand`,
			'Dealer',
			'Crib',
			'Status',
			'',
		]) {
			header.createEl('th', {
				text: label,
			});
		}

		const body = table.createEl('tbody');

		for (const hand of hands) {
			renderHandRow(body, plugin, game, hand, onRefresh);
		}
	}

	renderAddHand(panel, plugin, game, hands, onRefresh);
}

function renderHandRow(
	body: HTMLTableSectionElement,
	plugin: CribbageTrackerPluginContext,
	game: GameRecord,
	hand: HandRecord,
	onRefresh: () => void,
): void {
	const row = body.createEl('tr');

	if (hand.isLastHand) {
		row.addClass('cribbage-last-hand');
	}

	row.createEl('td', {
		text: String(hand.handNumber),
	});

	let player1EligibilityOverride = hand.player1HandEligibilityOverride;

	let player2EligibilityOverride = hand.player2HandEligibilityOverride;

	let cribEligibilityOverride = hand.cribEligibilityOverride;

	const effectiveEligibility = hand.isLastHand
		? plugin.database.getEffectiveHandEligibility(hand)
		: null;

	const automaticEligibility = hand.isLastHand
		? plugin.database.getEffectiveHandEligibility({
				...hand,
				player1HandEligibilityOverride: null,
				player2HandEligibilityOverride: null,
				cribEligibilityOverride: null,
			})
		: null;

	// Player 1 hand
	const player1Cell = row.createEl('td');

	const player1Par =
		hand.dealer === 1
			? plugin.settings.dealerHandPar
			: plugin.settings.poneHandPar;

	createParLabel(player1Cell, player1Par);

	const player1ScoreRow = player1Cell.createDiv('cribbage-edit-score');

	const player1 = createInlineNumber(player1ScoreRow, hand.player1HandPoints);

	attachParColor(player1, player1Par);

	if (effectiveEligibility !== null && automaticEligibility !== null) {
		createEligibilityControl(
			player1ScoreRow,
			effectiveEligibility.player1HandEligible,
			player1EligibilityOverride,
			automaticEligibility.player1HandEligible,
			async (override) => {
				player1EligibilityOverride = override;

				await plugin.database.updateHandEligibilityOverrides(
					hand.id,
					player1EligibilityOverride,
					player2EligibilityOverride,
					cribEligibilityOverride,
				);

				onRefresh();
			},
		);
	}

	// Player 2 hand
	const player2Cell = row.createEl('td');

	const player2Par =
		hand.dealer === 2
			? plugin.settings.dealerHandPar
			: plugin.settings.poneHandPar;

	createParLabel(player2Cell, player2Par);

	const player2ScoreRow = player2Cell.createDiv('cribbage-edit-score');

	const player2 = createInlineNumber(player2ScoreRow, hand.player2HandPoints);

	attachParColor(player2, player2Par);

	if (effectiveEligibility !== null && automaticEligibility !== null) {
		createEligibilityControl(
			player2ScoreRow,
			effectiveEligibility.player2HandEligible,
			player2EligibilityOverride,
			automaticEligibility.player2HandEligible,
			async (override) => {
				player2EligibilityOverride = override;

				await plugin.database.updateHandEligibilityOverrides(
					hand.id,
					player1EligibilityOverride,
					player2EligibilityOverride,
					cribEligibilityOverride,
				);

				onRefresh();
			},
		);
	}

	row.createEl('td', {
		text:
			hand.dealer === 1
				? game.player1
				: hand.dealer === 2
					? game.player2
					: 'Unknown',
	});

	// Crib
	const cribCell = row.createEl('td');

	createParLabel(cribCell, plugin.settings.cribPar);

	const cribScoreRow = cribCell.createDiv('cribbage-edit-score');

	const crib = createInlineNumber(cribScoreRow, hand.cribPoints);

	attachParColor(crib, plugin.settings.cribPar);

	if (effectiveEligibility !== null && automaticEligibility !== null) {
		createEligibilityControl(
			cribScoreRow,
			effectiveEligibility.cribEligible,
			cribEligibilityOverride,
			automaticEligibility.cribEligible,
			async (override) => {
				cribEligibilityOverride = override;

				await plugin.database.updateHandEligibilityOverrides(
					hand.id,
					player1EligibilityOverride,
					player2EligibilityOverride,
					cribEligibilityOverride,
				);

				onRefresh();
			},
		);
	}

	// Status
	row.createEl('td', {
		text: hand.isLastHand ? 'Last' : '',
	});

	// Actions
	const actions = row.createEl('td');

	const group = actions.createDiv('cribbage-row-actions');

	const save = group.createEl('button', {
		text: 'Save',
	});

	save.addEventListener('click', () => {
		void (async () => {
			const input = readHandInput(player1, player2, crib);

			if (!input) {
				return;
			}

			/*
			 * Only final-hand rows have eligibility
			 * controls, so only attach the overrides
			 * when this is the final row.
			 *
			 * null means "use automatic eligibility."
			 */
			if (hand.isLastHand) {
				input.player1HandEligibilityOverride =
					player1EligibilityOverride;

				input.player2HandEligibilityOverride =
					player2EligibilityOverride;

				input.cribEligibilityOverride = cribEligibilityOverride;
			}

			try {
				await plugin.database.updateHand(hand.id, input);

				new Notice('Hand updated.');

				onRefresh();
			} catch (error) {
				console.error(error);

				new Notice('Could not update hand.');
			}
		})();
	});

	const remove = group.createEl('button', {
		text: 'Delete',
		cls: 'cribbage-delete-button',
	});

	remove.addEventListener('click', () => {
		void (async () => {
			const confirmed = await confirmAction(
				plugin.app,
				`Delete hand ${hand.handNumber}?`,
				'Delete',
			);

			if (!confirmed) {
				return;
			}

			try {
				await plugin.database.deleteHand(hand.id);

				new Notice('Hand deleted.');

				onRefresh();
			} catch (error) {
				console.error(error);

				new Notice('Could not delete hand.');
			}
		})();
	});
}
