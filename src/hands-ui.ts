import { Notice } from 'obsidian';

import type CribbageTrackerPlugin from './main';
import type {
	GameRecord,
	HandInput,
	HandRecord,
} from './database';

export function renderHandsPage(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	selectedGameId: string | null,
	onSelectGame: (gameId: string) => void,
	onRefresh: () => void,
): void {
	const games =
		plugin.database.listGames();

	if (games.length === 0) {
		container.createEl('p', {
			text: 'No games recorded yet.',
			cls: 'cribbage-empty-state',
		});

		return;
	}

	const gameId =
		selectedGameId ??
		games[0]?.id;

	if (!gameId) {
		return;
	}

	const game =
		games.find(
			(item) =>
				item.id === gameId,
		) ?? games[0];

	if (!game) {
		return;
	}

	renderGameSelector(
		container,
		games,
		game.id,
		onSelectGame,
	);

	renderGameHeader(
		container,
		game,
	);

	renderTrackingSettings(
		container,
		plugin,
		game,
		onRefresh,
	);

	renderHands(
		container,
		plugin,
		game,
		onRefresh,
	);
}

function renderGameSelector(
	container: HTMLElement,
	games: GameRecord[],
	selectedGameId: string,
	onSelectGame: (gameId: string) => void,
): void {
	const panel =
		container.createDiv(
			'cribbage-panel',
		);

	const field =
		panel.createDiv(
			'cribbage-form-field',
		);

	field.createEl('label', {
		text: 'Game',
	});

	const select =
		field.createEl('select');

	for (const game of games) {
		const option =
			select.createEl('option', {
				value: game.id,
				text:
					`${game.playedDate} ${game.playedTime} — ` +
					`${game.player1} vs ${game.player2} ` +
					`(${game.player1Score ?? '—'}-${game.player2Score ?? '—'})`,
			});

		if (
			game.id ===
			selectedGameId
		) {
			option.selected = true;
		}
	}

	select.addEventListener(
		'change',
		() => {
			onSelectGame(
				select.value,
			);
		},
	);
}

function renderGameHeader(
	container: HTMLElement,
	game: GameRecord,
): void {
	const panel =
		container.createDiv(
			'cribbage-panel',
		);

	panel.createEl('h2', {
		text:
			`${game.player1} vs ${game.player2}`,
	});

	panel.createEl('p', {
		text:
			`${game.playedDate} at ${game.playedTime}`,
	});

	panel.createEl('p', {
		text:
			`Score: ${game.player1Score ?? '—'} - ` +
			`${game.player2Score ?? '—'}`,
	});

	panel.createEl('p', {
		text:
			'First dealer: ' +
			(
				game.firstDealer === 1
					? game.player1
					: game.firstDealer === 2
						? game.player2
						: 'Unknown'
			),
	});
}

function renderTrackingSettings(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	game: GameRecord,
	onRefresh: () => void,
): void {
	const summary =
		plugin.database
			.getGameHandSummary(
				game.id,
			);

	const panel =
		container.createDiv(
			'cribbage-panel',
		);

	panel.createEl('h2', {
		text: 'Hand tracking',
	});

	const incompleteRow =
		panel.createDiv(
			'cribbage-checkbox-row',
		);

	const incomplete =
		incompleteRow.createEl(
			'input',
			{
				type: 'checkbox',
			},
		);

	incomplete.checked =
		game.handDataIncomplete;

	const incompleteLabel =
		incompleteRow.createEl(
			'label',
			{
				text:
					'Incomplete hand data',
			},
		);

	incompleteLabel.prepend(
		incomplete,
	);

	panel.createEl('p', {
		text:
			'Incomplete games are excluded from hand, crib, and pegging rate statistics.',
		cls: 'setting-item-description',
	});

	incomplete.addEventListener(
		'change',
        () => {
            void (async () => {
                try {
                    await plugin.database
                        .setHandDataIncomplete(
                            game.id,
                            incomplete.checked,
                        );

                    onRefresh();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not update hand tracking status.',
                    );
                }
            })();
        },
	);

	panel.createEl('h3', {
		text: 'Manual high-hand override',
	});

	panel.createEl('p', {
		text:
			'If entered, the manual value overrides the high hand calculated from individual hand rows.',
		cls: 'setting-item-description',
	});

	const highGrid =
		panel.createDiv(
			'cribbage-high-hand-grid',
		);

	const player1High =
		createNumberField(
			highGrid,
			game.player1,
			game.player1HighHandManual,
		);

	const player2High =
		createNumberField(
			highGrid,
			game.player2,
			game.player2HighHandManual,
		);

	const saveHigh =
		panel.createEl('button', {
			text: 'Save high hands',
		});

	saveHigh.addEventListener(
		'click',
        () => {
            void (async () => {
                const high1 =
                    parseOptionalNumber(
                        player1High.value,
                    );

                const high2 =
                    parseOptionalNumber(
                        player2High.value,
                    );

                if (
                    high1 === undefined ||
                    high2 === undefined
                ) {
                    new Notice(
                        'High hands must be whole numbers of 0 or greater.',
                    );

                    return;
                }

                try {
                    await plugin.database
                        .setManualHighHands(
                            game.id,
                            high1,
                            high2,
                        );

                    new Notice(
                        'High-hand overrides saved.',
                    );

                    onRefresh();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not save high hands.',
                    );
                }
            })();
        },
	);

	const effective1 =
		game.player1HighHandManual ??
		summary.player1HighHandCalculated;

	const effective2 =
		game.player2HighHandManual ??
		summary.player2HighHandCalculated;

	const stats =
		panel.createDiv(
			'cribbage-hand-summary',
		);

	createSummaryValue(
		stats,
		'Rounds',
		String(
			summary.roundCount,
		),
	);

	createSummaryValue(
		stats,
		'Eligible rounds',
		String(
			summary.eligibleRoundCount,
		),
	);

	createSummaryValue(
		stats,
		`${game.player1} high`,
		effective1 === null
			? '—'
			: String(effective1),
	);

	createSummaryValue(
		stats,
		`${game.player2} high`,
		effective2 === null
			? '—'
			: String(effective2),
	);

	createSummaryValue(
		stats,
		`${game.player1} eligible hand pts`,
		String(
			summary.player1HandPointsEligible,
		),
	);

	createSummaryValue(
		stats,
		`${game.player2} eligible hand pts`,
		String(
			summary.player2HandPointsEligible,
		),
	);

	createSummaryValue(
		stats,
		`${game.player1} eligible crib`,
		`${summary.player1CribPointsEligible} / ${summary.player1EligibleCribCount}`,
	);

	createSummaryValue(
		stats,
		`${game.player2} eligible crib`,
		`${summary.player2CribPointsEligible} / ${summary.player2EligibleCribCount}`,
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

function renderHands(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	game: GameRecord,
	onRefresh: () => void,
): void {
	const panel =
		container.createDiv(
			'cribbage-panel',
		);

	panel.createEl('h2', {
		text: 'Hands',
	});

	panel.createEl('p', {
		text:
			'The final row is automatically treated as the last hand and excluded from eligible hand/crib averages. Only enter the hand points required to reach 121. If game ends during pegging and before hands are scored, enter 0 for the hand scores in the last row to avoid the penultimate round being counted as an ineligible round.',
		cls: 'setting-item-description',
	});

	if (game.firstDealer === null) {
		panel.createEl('p', {
			text:
				'Set the first dealer in the "Games" page before adding hands.',
			cls: 'cribbage-warning',
		});
	}

	const hands =
		plugin.database.listHands(
			game.id,
		);

	if (hands.length === 0) {
		panel.createEl('p', {
			text:
				'No individual hands recorded.',
			cls: 'cribbage-empty-state',
		});
	} else {
		const scroll =
			panel.createDiv(
				'cribbage-table-scroll',
			);

		const table =
			scroll.createEl('table', {
				cls: 'cribbage-table',
			});

		const header =
			table.createEl('thead')
				.createEl('tr');

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

		const body =
			table.createEl('tbody');

		for (const hand of hands) {
			renderHandRow(
				body,
				plugin,
				game,
				hand,
				onRefresh,
			);
		}
	}

	renderAddHand(
		panel,
		plugin,
		game,
		onRefresh,
	);
}

function renderHandRow(
	body: HTMLTableSectionElement,
	plugin: CribbageTrackerPlugin,
	game: GameRecord,
	hand: HandRecord,
	onRefresh: () => void,
): void {
	const row =
		body.createEl('tr');

	if (hand.isLastHand) {
		row.addClass(
			'cribbage-last-hand',
		);
	}

	row.createEl('td', {
		text:
			String(
				hand.handNumber,
			),
	});

    const player1Cell =
        row.createEl('td');

    const player1Par =
        hand.dealer === 1
            ? plugin.settings.dealerHandPar
            : plugin.settings.poneHandPar;

    createParLabel(
        player1Cell,
        player1Par,
    );

    const player1 =
        createInlineNumber(
            player1Cell,
            hand.player1HandPoints,
        );

    attachParColor(
        player1,
        player1Par,
    );

    const player2Cell =
        row.createEl('td');

    const player2Par =
        hand.dealer === 2
            ? plugin.settings.dealerHandPar
            : plugin.settings.poneHandPar;

    createParLabel(
        player2Cell,
        player2Par,
    );

    const player2 =
        createInlineNumber(
        player2Cell,
        hand.player2HandPoints,
    );

    attachParColor(
        player2,
        player2Par,
    );

    row.createEl('td', {
        text:
            hand.dealer === 1
                ? game.player1
                : hand.dealer === 2
                    ? game.player2
                    : 'Unknown',
    });

    const cribCell =
        row.createEl('td');

    createParLabel(
        cribCell,
        plugin.settings.cribPar,
    );

    const crib =
        createInlineNumber(
        cribCell,
        hand.cribPoints,
    );

    attachParColor(
        crib,
        plugin.settings.cribPar,
    );

	row.createEl('td', {
		text:
			hand.isLastHand
				? 'Last'
				: '',
	});

	const actions =
		row.createEl('td');

	const group =
		actions.createDiv(
			'cribbage-row-actions',
		);

	const save =
		group.createEl('button', {
			text: 'Save',
		});

	save.addEventListener(
		'click',
        () => {
            void (async () => {
                const input =
                    readHandInput(
                        player1,
                        player2,
                        crib,
                    );

                if (!input) {
                    return;
                }

                try {
                    await plugin.database
                        .updateHand(
                            hand.id,
                            input,
                        );

                    new Notice(
                        'Hand updated.',
                    );

                    onRefresh();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not update hand.',
                    );
                }
            })();
        },
	);

	const remove =
		group.createEl('button', {
			text: 'Delete',
			cls:
				'cribbage-delete-button',
		});

	remove.addEventListener(
		'click',
        () => {
            void (async () => {
                const confirmed =
                    window.confirm(
                        `Delete hand ${hand.handNumber}?`,
                    );

                if (!confirmed) {
                    return;
                }

                try {
                    await plugin.database
                        .deleteHand(
                            hand.id,
                        );

                    new Notice(
                        'Hand deleted.',
                    );

                    onRefresh();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not delete hand.',
                    );
                }
            })();
        },
	);
}

function renderAddHand(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
	game: GameRecord,
	onRefresh: () => void,
): void {
	container.createEl('h3', {
		text: 'Add hand',
	});

	const grid =
		container.createDiv(
			'cribbage-add-hand-grid',
		);

	const player1 =
		createNumberField(
			grid,
			`${game.player1} hand`,
			null,
		);

	const player2 =
		createNumberField(
			grid,
			`${game.player2} hand`,
			null,
		);

	const crib =
		createNumberField(
			grid,
			'Crib',
			null,
		);

	const add =
		container.createEl('button', {
			text: 'Add hand',
			cls: 'mod-cta',
		});

	add.disabled =
		game.firstDealer === null;

	add.addEventListener(
		'click',
        () => {
            void (async () => {
                const input =
                    readHandInput(
                        player1,
                        player2,
                        crib,
                    );

                if (!input) {
                    return;
                }

                try {
                    await plugin.database
                        .addHand(
                            game.id,
                            input,
                        );

                    new Notice(
                        'Hand added.',
                    );

                    onRefresh();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        error instanceof Error
                            ? error.message
                            : 'Could not add hand.',
                    );
                }
            })();
        },
	);
}

function readHandInput(
	player1: HTMLInputElement,
	player2: HTMLInputElement,
	crib: HTMLInputElement,
): HandInput | null {
	const p1 =
		parseOptionalNumber(
			player1.value,
		);

	const p2 =
		parseOptionalNumber(
			player2.value,
		);

	const cribValue =
		parseOptionalNumber(
			crib.value,
		);

	if (
		p1 === undefined ||
		p2 === undefined ||
		cribValue === undefined
	) {
		new Notice(
			'Hand and crib values must be whole numbers of 0 or greater.',
		);

		return null;
	}

	return {
		player1HandPoints: p1,
		player2HandPoints: p2,
		cribPoints: cribValue,
	};
}

function createNumberField(
	container: HTMLElement,
	label: string,
	value: number | null,
): HTMLInputElement {
	const wrapper =
		container.createDiv(
			'cribbage-form-field',
		);

	wrapper.createEl('label', {
		text: label,
	});

	const input =
		wrapper.createEl('input', {
			type: 'number',
		});

	input.min = '0';
	input.step = '1';

	if (value !== null) {
		input.value =
			String(value);
	}

	return input;
}

function createInlineNumber(
	container: HTMLElement,
	value: number | null,
): HTMLInputElement {
	const input =
		container.createEl('input', {
			type: 'number',
			cls:
				'cribbage-hand-input',
		});

	input.min = '0';
	input.step = '1';

	if (value !== null) {
		input.value =
			String(value);
	}

	return input;
}

function parseOptionalNumber(
	value: string,
): number | null | undefined {
	const trimmed =
		value.trim();

	if (!trimmed) {
		return null;
	}

	const number =
		Number(trimmed);

	if (
		!Number.isInteger(number) ||
		number < 0
	) {
		return undefined;
	}

	return number;
}

function createSummaryValue(
	container: HTMLElement,
	label: string,
	value: string,
): void {
	const item =
		container.createDiv(
			'cribbage-summary-item',
		);

	item.createEl('span', {
		text: label,
		cls:
			'cribbage-summary-label',
	});

	item.createEl('strong', {
		text: value,
	});
}

function createParLabel(
	container: HTMLElement,
	value: number,
): void {
	container.createDiv({
		text: `Par: ${value.toFixed(2)}`,
		cls: 'cribbage-par-label',
	});
}

function attachParColor(
	input: HTMLInputElement,
	par: number,
): void {
	const update = () => {
		input.removeClass(
			'cribbage-above-par',
		);

		input.removeClass(
			'cribbage-below-par',
		);

		const parsed =
			parseOptionalNumber(
				input.value,
			);

		if (
			parsed === null ||
			parsed === undefined
		) {
			return;
		}

		const difference =
			parsed - par;

		if (
			Math.abs(difference) <
			0.000001
		) {
			return;
		}

		input.addClass(
			difference > 0
				? 'cribbage-above-par'
				: 'cribbage-below-par',
		);
	};

	input.addEventListener(
		'input',
		update,
	);

	update();
}