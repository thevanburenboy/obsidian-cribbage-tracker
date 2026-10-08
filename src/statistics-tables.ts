import type {
	GameStatisticsRecord,
} from './database';

import type {
	HighHandWinObservation,
} from './statistics-types';

import {
	effectiveHighHand,
	gameContainsPlayer,
	gameContainsPlayers,
	getPlayerSide,
	hasCompletedScore,
	formatShare,
} from './statistics-utils';

export function buildHighHandWinObservations(
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
		const opponentScore = side === 1 ? game.player2Score : game.player1Score;

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

export function buildMatchupHighHandWinObservations(
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

export function renderHighHandWinTable(
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
		const exact = observations.filter((item) => bucket.matches(item.highHand));
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

export function renderMarginDistributionTable(
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
