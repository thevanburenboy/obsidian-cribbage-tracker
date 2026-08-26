import type CribbageTrackerPlugin
	from './main';

import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from './database';

const MIN_GAMES = 5;
const MIN_HANDS = 5;
const MIN_CRIBS = 5;
const MIN_ROUNDS = 5;
const MIN_ROLE_GAMES = 5;
const MIN_HIGH_HAND_GAMES = 5;
const MIN_WINS = 5;

interface PlayerAggregate {
	name: string;

	games: number;
	wins: number;
	losses: number;

	totalScore: number;
	totalDifferential: number;
    victoryMarginTotal: number;

	bestHighHand: number | null;

	dealerGames: number;
	dealerWins: number;
	dealerLosses: number;

	poneGames: number;
	poneWins: number;
	poneLosses: number;

	highHandComparableGames: number;
	higherHighHandGames: number;

	skunkWins: number;
	doubleSkunkWins: number;

	handPointsTotal: number;
	handCount: number;

	cribPointsTotal: number;
	cribCount: number;

	peggingPointsTotal: number;
	peggingRoundCount: number;
}

interface RankedItem {
	label: string;
	value: number;
	displayValue: string;
	subtext?: string;
}

interface RankedItemWithRank
	extends RankedItem {
	rank: number;
}

interface RecordOccurrence {
	score: number;

	player: string;
	opponent: string;

	playedDate: string;
	playedTime: string;
}

interface WinningStreakOccurrence {
	length: number;
	player: string;

	startDate: string;
	startTime: string;

	endDate: string;
	endTime: string;

	active: boolean;
}

interface GroupedStreakRow {
	rank: number;

	length: number;
	count: number;

	label: string;
	subtext: string;

	activeSingleton: boolean;
}

interface GroupedRecordRow {
	rank: number;

	score: number;
	count: number;

	label: string;
	subtext: string;
}

export function renderLeaderboardPage(
	container: HTMLElement,
	plugin: CribbageTrackerPlugin,
): void {
	const games =
		plugin.database
			.listGamesForStatistics();

	const hands =
		plugin.database
			.listHandsForStatistics();

	const summaries =
		buildPlayerAggregates(
			games,
			hands,
		);

	container.createEl('h2', {
		text: 'Leaderboard',
	});

	renderOverallStandings(
		container,
		summaries,
	);

	renderGamePerformance(
		container,
		summaries,
	);

	renderHandPerformance(
		container,
		summaries,
	);

	renderSituational(
		container,
		summaries,
	);

	renderRecords(
		container,
		summaries,
		games,
		hands,
	);
}

function buildPlayerAggregates(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): PlayerAggregate[] {
	const players =
		new Map<
			string,
			PlayerAggregate
		>();

	/*
	 * -------------------------
	 * Completed-game statistics
	 * -------------------------
	 */
	for (const game of games) {
		if (
			typeof game.player1Score !==
				'number' ||
			typeof game.player2Score !==
				'number'
		) {
			continue;
		}

		const player1 =
			cleanPlayerName(
				game.player1,
			);

		const player2 =
			cleanPlayerName(
				game.player2,
			);

		if (!player1 || !player2) {
			continue;
		}

		const p1 =
			getPlayerAggregate(
				players,
				player1,
			);

		const p2 =
			getPlayerAggregate(
				players,
				player2,
			);

		updateGameAggregate(
			p1,
			game,
			1,
		);

		updateGameAggregate(
			p2,
			game,
			2,
		);
	}

	/*
	 * -------------------------
	 * Hand / crib statistics
	 * -------------------------
	 */
	for (const hand of hands) {
		const player1 =
			cleanPlayerName(
				hand.player1,
			);

		const player2 =
			cleanPlayerName(
				hand.player2,
			);

		if (!player1 || !player2) {
			continue;
		}

		const p1 =
			getPlayerAggregate(
				players,
				player1,
			);

		const p2 =
			getPlayerAggregate(
				players,
				player2,
			);

		/*
		 * These match our normal hand/crib
		 * eligibility rules:
		 *
		 * - incomplete games excluded
		 * - final hand excluded
		 */
		if (
			!hand.handDataIncomplete &&
			!hand.isLastHand
		) {
			if (
				typeof hand
					.player1HandPoints ===
				'number'
			) {
				p1.handPointsTotal +=
					hand.player1HandPoints;

				p1.handCount++;
			}

			if (
				typeof hand
					.player2HandPoints ===
				'number'
			) {
				p2.handPointsTotal +=
					hand.player2HandPoints;

				p2.handCount++;
			}

			if (
				typeof hand.cribPoints ===
				'number'
			) {
				const dealer =
					getHandDealer(
						hand.firstDealer,
						hand.handNumber,
					);

				const owner =
					dealer === 1
						? p1
						: p2;

				owner.cribPointsTotal +=
					hand.cribPoints;

				owner.cribCount++;
			}
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
	const handsByGame =
		groupHandsByGame(hands);

	for (const game of games) {
		if (
			game.handDataIncomplete ||
			typeof game.player1Score !==
				'number' ||
			typeof game.player2Score !==
				'number' ||
			game.firstDealer === null
		) {
			continue;
		}

		const gameHands =
			handsByGame.get(
				game.id,
			) ?? [];

		if (gameHands.length === 0) {
			continue;
		}

		const allComplete =
			gameHands.every(
				(hand) =>
					typeof hand
						.player1HandPoints ===
						'number' &&
					typeof hand
						.player2HandPoints ===
						'number' &&
					typeof hand
						.cribPoints ===
						'number',
			);

		if (!allComplete) {
			continue;
		}

		let player1Hands = 0;
		let player2Hands = 0;

		let player1Cribs = 0;
		let player2Cribs = 0;

		for (
			const hand of gameHands
		) {
			player1Hands +=
				hand.player1HandPoints!;

			player2Hands +=
				hand.player2HandPoints!;

			const dealer =
				getHandDealer(
					game.firstDealer,
					hand.handNumber,
				);

			if (dealer === 1) {
				player1Cribs +=
					hand.cribPoints!;
			} else {
				player2Cribs +=
					hand.cribPoints!;
			}
		}

		const player1 =
			cleanPlayerName(
				game.player1,
			);

		const player2 =
			cleanPlayerName(
				game.player2,
			);

		if (!player1 || !player2) {
			continue;
		}

		const p1 =
			getPlayerAggregate(
				players,
				player1,
			);

		const p2 =
			getPlayerAggregate(
				players,
				player2,
			);

		p1.peggingPointsTotal +=
			game.player1Score -
			player1Hands -
			player1Cribs;

		p2.peggingPointsTotal +=
			game.player2Score -
			player2Hands -
			player2Cribs;

		p1.peggingRoundCount +=
			gameHands.length;

		p2.peggingRoundCount +=
			gameHands.length;
	}

	return Array.from(
		players.values(),
	);
}

function updateGameAggregate(
	player: PlayerAggregate,
	game: GameStatisticsRecord,
	side: 1 | 2,
): void {
	const score =
		side === 1
			? game.player1Score
			: game.player2Score;

	const opponentScore =
		side === 1
			? game.player2Score
			: game.player1Score;

	if (
		typeof score !== 'number' ||
		typeof opponentScore !==
			'number'
	) {
		return;
	}

	player.games++;
	player.totalScore += score;

	player.totalDifferential +=
		score - opponentScore;

	const won =
		score > opponentScore;

    if (won) {
        player.wins++;

        player.victoryMarginTotal +=
            score - opponentScore;
    } else {
        player.losses++;
    }

	const highHand =
		effectiveHighHand(
			game,
			side,
		);

	if (
		highHand !== null &&
		(
			player.bestHighHand ===
				null ||
			highHand >
				player.bestHighHand
		)
	) {
		player.bestHighHand =
			highHand;
	}

	const opponentHighHand =
		effectiveHighHand(
			game,
			side === 1 ? 2 : 1,
		);

	if (
		highHand !== null &&
		opponentHighHand !== null
	) {
		player
			.highHandComparableGames++;

		if (
			highHand >
			opponentHighHand
		) {
			player
				.higherHighHandGames++;
		}
	}

	if (game.firstDealer !== null) {
		if (
			game.firstDealer ===
			side
		) {
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
		} else if (
			opponentScore <= 90
		) {
			player.skunkWins++;
		}
	}
}

function renderOverallStandings(
	container: HTMLElement,
	players: PlayerAggregate[],
): void {
	const section =
		createSection(
			container,
			'Overall Standings',
		);

	const standings =
		players
			.filter(
				(player) =>
					player.games > 0,
			)
			.sort(
				(a, b) =>
					winRate(b) -
						winRate(a) ||
					b.games -
						a.games ||
					b.wins -
						a.wins ||
					a.name.localeCompare(
						b.name,
					),
			);

	if (
		standings.length === 0
	) {
		renderEmpty(
			section,
			'No completed games yet.',
		);

		return;
	}

	const wrapper =
		section.createDiv(
			'cribbage-leaderboard-table-wrap',
		);

	const table =
		wrapper.createEl('table', {
			cls:
				'cribbage-leaderboard-standings',
		});

	const head =
		table.createEl('thead');

	const header =
		head.createEl('tr');

	for (const label of [
		'Player',
		'Record',
		'Win %',
		'PPG',
		'Diff',
	]) {
		header.createEl('th', {
			text: label,
		});
	}

    const body =
        table.createEl('tbody');

    let expanded = false;

    const renderRows = () => {
        body.empty();

        const visible =
            expanded
                ? standings
                : standings.slice(0, 5);

        for (
            const player of visible
        ) {
            const row =
                body.createEl('tr');

            row.createEl('td', {
                text: player.name,
            });

            row.createEl('td', {
                text:
                    `${player.wins}-${player.losses}`,
            });

            row.createEl('td', {
                text:
                    formatPercent(
                        winRate(
                            player,
                        ),
                    ),
            });

            row.createEl('td', {
                text:
                    (
                        player.totalScore /
                        player.games
                    ).toFixed(2),
            });

            row.createEl('td', {
                text:
                    formatSigned(
                        player
                            .totalDifferential /
                            player.games,
                    ),
            });
        }
    };

    renderRows();

    if (standings.length > 5) {
        const toggle =
            section.createEl(
                'button',
                {
                    cls:
                        'cribbage-leaderboard-expand-button',
                },
            );

        const updateButton = () => {
            toggle.setText(
                expanded
                    ? 'Show top 5'
                    : `Show all ${standings.length} players`,
            );
        };

        updateButton();

        toggle.addEventListener(
            'click',
            () => {
                expanded = !expanded;

                renderRows();
                updateButton();
            },
        );
    }
}

function renderGamePerformance(
	container: HTMLElement,
	players: PlayerAggregate[],
): void {
	const section =
		createSection(
			container,
			'Game Performance',
		);

	const grid =
		createLeaderboardGrid(
			section,
		);

	renderLeaderboardCard(
		grid,
		'Win %',
		players
			.filter(
				(player) =>
					player.games >=
					MIN_GAMES,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						winRate(
							player,
						),

					displayValue:
						formatPercent(
							winRate(
								player,
							),
						),

					subtext:
						`${player.wins}-${player.losses} • ${player.games} games`,
				}),
			),
		{
			note:
				`Minimum ${MIN_GAMES} games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'PPG',
		players
			.filter(
				(player) =>
					player.games >=
					MIN_GAMES,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player.totalScore /
						player.games,

					displayValue:
						(
							player.totalScore /
							player.games
						).toFixed(2),

					subtext:
						`${player.games} games`,
				}),
			),
		{
			note:
				`Minimum ${MIN_GAMES} games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Score Differential',
		players
			.filter(
				(player) =>
					player.games >=
					MIN_GAMES,
			)
			.map(
				(player) => {
					const value =
						player
							.totalDifferential /
						player.games;

					return {
						label:
							player.name,

						value,

						displayValue:
							formatSigned(
								value,
							),

						subtext:
							`${player.games} games`,
					};
				},
			),
		{
			note:
				`Minimum ${MIN_GAMES} games`,
		},
	);

    renderLeaderboardCard(
        grid,
        'Average Margin of Victory',
        players
            .filter(
                (player) =>
                    player.wins >=
                    MIN_WINS,
            )
            .map(
                (player) => {
                    const value =
                        player
                            .victoryMarginTotal /
                        player.wins;

                    return {
                        label:
                            player.name,

                        value,

                        displayValue:
                            value.toFixed(2),

                        subtext:
                            `${player.wins} wins`,
                    };
                },
            ),
        {
            note:
                `Minimum ${MIN_WINS} wins`,
        },
    );
}

function renderHandPerformance(
	container: HTMLElement,
	players: PlayerAggregate[],
): void {
	const section =
		createSection(
			container,
			'Hand Performance',
		);

	const grid =
		createLeaderboardGrid(
			section,
		);

	renderLeaderboardCard(
		grid,
		'Points / Hand',
		players
			.filter(
				(player) =>
					player.handCount >=
					MIN_HANDS,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player
							.handPointsTotal /
						player.handCount,

					displayValue:
						(
							player
								.handPointsTotal /
							player.handCount
						).toFixed(2),

					subtext:
						`${player.handCount} eligible hands`,
				}),
			),
		{
			note:
				`Minimum ${MIN_HANDS} eligible hands`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Points / Crib',
		players
			.filter(
				(player) =>
					player.cribCount >=
					MIN_CRIBS,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player
							.cribPointsTotal /
						player.cribCount,

					displayValue:
						(
							player
								.cribPointsTotal /
							player.cribCount
						).toFixed(2),

					subtext:
						`${player.cribCount} eligible cribs`,
				}),
			),
		{
			note:
				`Minimum ${MIN_CRIBS} eligible cribs`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Pegging / Round',
		players
			.filter(
				(player) =>
					player
						.peggingRoundCount >=
					MIN_ROUNDS,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player
							.peggingPointsTotal /
						player
							.peggingRoundCount,

					displayValue:
						(
							player
								.peggingPointsTotal /
							player
								.peggingRoundCount
						).toFixed(2),

					subtext:
						`${player.peggingRoundCount} complete rounds`,
				}),
			),
		{
			note:
				`Minimum ${MIN_ROUNDS} complete rounds`,
		},
	);
}

function renderSituational(
	container: HTMLElement,
	players: PlayerAggregate[],
): void {
	const section =
		createSection(
			container,
			'Situational',
		);

	const grid =
		createLeaderboardGrid(
			section,
		);

	renderLeaderboardCard(
		grid,
		'Dealing First',
		players
			.filter(
				(player) =>
					player.dealerGames >=
					MIN_ROLE_GAMES,
			)
			.map(
				(player) => {
					const value =
						player.dealerWins /
						player.dealerGames;

					return {
						label:
							player.name,

						value,

						displayValue:
							formatPercent(
								value,
							),

						subtext:
							`${player.dealerWins}-${player.dealerLosses} • ${player.dealerGames} games`,
					};
				},
			),
		{
			note:
				`Minimum ${MIN_ROLE_GAMES} first-dealer games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Pone First',
		players
			.filter(
				(player) =>
					player.poneGames >=
					MIN_ROLE_GAMES,
			)
			.map(
				(player) => {
					const value =
						player.poneWins /
						player.poneGames;

					return {
						label:
							player.name,

						value,

						displayValue:
							formatPercent(
								value,
							),

						subtext:
							`${player.poneWins}-${player.poneLosses} • ${player.poneGames} games`,
					};
				},
			),
		{
			note:
				`Minimum ${MIN_ROLE_GAMES} pone-first games`,
		},
	);

	renderLeaderboardCard(
		grid,
		'Higher High-Hand %',
		players
			.filter(
				(player) =>
					player
						.highHandComparableGames >=
					MIN_HIGH_HAND_GAMES,
			)
			.map(
				(player) => {
					const value =
						player
							.higherHighHandGames /
						player
							.highHandComparableGames;

					return {
						label:
							player.name,

						value,

						displayValue:
							formatPercent(
								value,
							),

						subtext:
							`${player.higherHighHandGames}/${player.highHandComparableGames} games`,
					};
				},
			),
		{
			note:
				`Minimum ${MIN_HIGH_HAND_GAMES} comparable games`,
		},
	);
}

function renderRecords(
	container: HTMLElement,
	players: PlayerAggregate[],
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): void {
	const section =
		createSection(
			container,
			'Records',
		);

	const grid =
		createLeaderboardGrid(
			section,
		);

	renderLeaderboardCard(
		grid,
		'Skunk Wins',
		players
			.filter(
				(player) =>
					player.skunkWins > 0,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player.skunkWins,

					displayValue:
						String(
							player.skunkWins,
						),
				}),
			),
	);

	renderLeaderboardCard(
		grid,
		'Double-Skunk Wins',
		players
			.filter(
				(player) =>
					player
						.doubleSkunkWins >
					0,
			)
			.map(
				(player) => ({
					label:
						player.name,

					value:
						player
							.doubleSkunkWins,

					displayValue:
						String(
							player
								.doubleSkunkWins,
						),
				}),
			),
	);

    renderWinningStreakCard(
        grid,
        buildWinningStreakOccurrences(
            games,
        ),
    );

	renderGroupedRecordCard(
		grid,
		'Highest Hands',
		buildHighestHandOccurrences(
			games,
			hands,
		),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Highest High Hand in a Loss',
		buildHighHandLossOccurrences(
			games,
		),
		'descending',
	);

	renderGroupedRecordCard(
		grid,
		'Lowest High Hand in a Win',
		buildLowHighHandWinOccurrences(
			games,
		),
		'ascending',
	);
}

function renderLeaderboardCard(
	container: HTMLElement,
	title: string,
	items: RankedItem[],
	options?: {
		note?: string;
		direction?: 'ascending' | 'descending';
	},
): void {
	const card =
		container.createDiv(
			'cribbage-leaderboard-card',
		);

	card.createEl('h4', {
		text: title,
	});

	if (options?.note) {
		card.createEl('div', {
			text:
				options.note,
			cls:
				'cribbage-leaderboard-note',
		});
	}

	const ranked =
		rankItems(
			items,
			options?.direction ??
				'descending',
		);

	if (ranked.length === 0) {
		renderEmpty(
			card,
			'Not enough data yet.',
		);

		return;
	}

	const rows =
		card.createDiv(
			'cribbage-leaderboard-rows',
		);

	for (const item of ranked) {
		const row =
			rows.createDiv(
				'cribbage-leaderboard-row',
			);

		const main =
			row.createDiv(
				'cribbage-leaderboard-row-main',
			);

		main.createEl('span', {
			text:
				`${item.rank}.`,
			cls:
				'cribbage-leaderboard-rank',
		});

		main.createEl('span', {
			text: item.label,
			cls:
				'cribbage-leaderboard-name',
		});

		main.createEl('strong', {
			text:
				item.displayValue,
			cls:
				'cribbage-leaderboard-value',
		});

		if (item.subtext) {
			row.createEl('div', {
				text:
					item.subtext,
				cls:
					'cribbage-leaderboard-subtext',
			});
		}
	}
}

function renderGroupedRecordCard(
	container: HTMLElement,
	title: string,
	occurrences: RecordOccurrence[],
	direction:
		| 'ascending'
		| 'descending',
): void {
	const card =
		container.createDiv(
			'cribbage-leaderboard-card',
		);

	card.createEl('h4', {
		text: title,
	});

	const rows =
		groupRecordOccurrences(
			occurrences,
			direction,
		);

	if (rows.length === 0) {
		renderEmpty(
			card,
			'No qualifying records yet.',
		);

		return;
	}

	const rowsContainer =
		card.createDiv(
			'cribbage-leaderboard-rows',
		);

	for (const record of rows) {
		const row =
			rowsContainer.createDiv(
				'cribbage-leaderboard-row',
			);

		const main =
			row.createDiv(
				'cribbage-leaderboard-row-main',
			);

		main.createEl('span', {
			text:
				`${record.rank}.`,
			cls:
				'cribbage-leaderboard-rank',
		});

		main.createEl('span', {
			text:
				record.label,
			cls:
				'cribbage-leaderboard-name',
		});

		main.createEl('strong', {
			text:
				record.count > 1
					? `${record.score} (x${record.count})`
					: String(
							record.score,
						),
			cls:
				'cribbage-leaderboard-value',
		});

		row.createEl('div', {
			text:
				record.subtext,
			cls:
				'cribbage-leaderboard-subtext',
		});
	}
}

function rankItems(
	items: RankedItem[],
	direction:
		| 'ascending'
		| 'descending',
): RankedItemWithRank[] {
	const sorted =
		[...items].sort(
			(a, b) => {
				const difference =
					direction ===
					'descending'
						? b.value -
							a.value
						: a.value -
							b.value;

				return (
					difference ||
					a.label.localeCompare(
						b.label,
					)
				);
			},
		);

	const result:
		RankedItemWithRank[] = [];

	let previousValue:
		number | null = null;

	let previousRank = 0;

	for (
		let index = 0;
		index < sorted.length;
		index++
	) {
		const item =
			sorted[index];

		if (!item) {
			continue;
		}

		const rank =
			previousValue !== null &&
			item.value ===
				previousValue
				? previousRank
				: index + 1;

		result.push({
			...item,
			rank,
		});

		previousValue =
			item.value;

		previousRank =
			rank;

		if (result.length >= 5) {
			break;
		}
	}

	return result;
}

function buildWinningStreakOccurrences(
	games: GameStatisticsRecord[],
): WinningStreakOccurrence[] {
	interface ActiveStreak {
		length: number;

		startDate: string;
		startTime: string;

		endDate: string;
		endTime: string;
	}

	const occurrences:
		WinningStreakOccurrence[] = [];

	const active =
		new Map<
			string,
			ActiveStreak
		>();

	const chronological =
		[...games].sort(
			compareGamesChronologically,
		);

	const finishStreak = (
		player: string,
		isActive: boolean,
	) => {
		const streak =
			active.get(player);

		if (!streak) {
			return;
		}

		if (streak.length >= 2) {
			occurrences.push({
				length:
					streak.length,

				player,

				startDate:
					streak.startDate,

				startTime:
					streak.startTime,

				endDate:
					streak.endDate,

				endTime:
					streak.endTime,

				active:
					isActive,
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
			finishStreak(
				player,
				false,
			);

			return;
		}

		const existing =
			active.get(player);

		if (existing) {
			existing.length++;

			existing.endDate =
				game.playedDate;

			existing.endTime =
				game.playedTime;

			return;
		}

		active.set(
			player,
			{
				length: 1,

				startDate:
					game.playedDate,

				startTime:
					game.playedTime,

				endDate:
					game.playedDate,

				endTime:
					game.playedTime,
			},
		);
	};

	for (
		const game of chronological
	) {
		if (
			typeof game.player1Score !==
				'number' ||
			typeof game.player2Score !==
				'number' ||
			game.player1Score ===
				game.player2Score
		) {
			continue;
		}

		const player1 =
			cleanPlayerName(
				game.player1,
			);

		const player2 =
			cleanPlayerName(
				game.player2,
			);

		if (!player1 || !player2) {
			continue;
		}

		processPlayer(
			player1,

			game.player1Score >
				game.player2Score,

			game,
		);

		processPlayer(
			player2,

			game.player2Score >
				game.player1Score,

			game,
		);
	}

	/*
	 * Anything still in the map is an
	 * ongoing/current streak.
	 */
	for (
		const player of Array.from(
			active.keys(),
		)
	) {
		finishStreak(
			player,
			true,
		);
	}

	return occurrences;
}

function groupWinningStreakOccurrences(
	occurrences:
		WinningStreakOccurrence[],
): GroupedStreakRow[] {
	const grouped =
		new Map<
			number,
			WinningStreakOccurrence[]
		>();

	for (
		const occurrence
		of occurrences
	) {
		const existing =
			grouped.get(
				occurrence.length,
			);

		if (existing) {
			existing.push(
				occurrence,
			);
		} else {
			grouped.set(
				occurrence.length,
				[occurrence],
			);
		}
	}

	const lengths =
		Array.from(
			grouped.keys(),
		).sort(
			(a, b) => b - a,
		);

	const rows:
		GroupedStreakRow[] = [];

	let rank = 1;

	for (const length of lengths) {
		if (rows.length >= 5) {
			break;
		}

		const streaks =
			grouped.get(length) ??
			[];

		if (streaks.length === 0) {
			continue;
		}

		const contributorCounts =
			new Map<string, number>();

		for (
			const streak of streaks
		) {
			contributorCounts.set(
				streak.player,
				(
					contributorCounts.get(
						streak.player,
					) ?? 0
				) + 1,
			);
		}

		const contributors =
			Array.from(
				contributorCounts.entries(),
			).sort(
				(a, b) =>
					b[1] - a[1] ||
					a[0].localeCompare(
						b[0],
					),
			);

		const label =
			contributors.length === 1
				? contributors[0]![0]
				: 'Multiple';

		let subtext: string;

		let activeSingleton =
			false;

		if (streaks.length === 1) {
			const streak =
				streaks[0]!;

			subtext =
				formatStreakDateRange(
					streak,
				);

			activeSingleton =
				streak.active;
		} else if (
			contributors.length === 1
		) {
			const latest =
				[...streaks]
					.sort(
						compareStreaksNewestFirst,
					)[0]!;

			subtext =
				`Last: ${formatStreakDateRange(
					latest,
				)}`;
		} else {
			const pieces:
				string[] = [];

			for (
				const [
					player,
					count,
				] of contributors.slice(
					0,
					2,
				)
			) {
				pieces.push(
					`${player} ${count}x`,
				);
			}

			const others =
				contributors
					.slice(2)
					.reduce(
						(
							total,
							[, count],
						) =>
							total +
							count,
						0,
					);

			if (others > 0) {
				pieces.push(
					`Others ${others}x`,
				);
			}

			subtext =
				pieces.join(' • ');
		}

		rows.push({
			rank,

			length,

			count:
				streaks.length,

			label,

			subtext,

			activeSingleton,
		});

		rank +=
			streaks.length;
	}

	return rows;
}

function renderWinningStreakCard(
	container: HTMLElement,
	occurrences:
		WinningStreakOccurrence[],
): void {
	const card =
		container.createDiv(
			'cribbage-leaderboard-card',
		);

	card.createEl('h4', {
		text: 'Winning streak',
	});

	const rows =
		groupWinningStreakOccurrences(
			occurrences,
		);

	if (rows.length === 0) {
		renderEmpty(
			card,
			'No streaks of 2+ games yet.',
		);

		return;
	}

	const rowsContainer =
		card.createDiv(
			'cribbage-leaderboard-rows',
		);

	let hasActiveMarker = false;

	for (const record of rows) {
		const row =
			rowsContainer.createDiv(
				'cribbage-leaderboard-row',
			);

		if (
			record.activeSingleton
		) {
			row.addClass(
				'is-active-streak',
			);

			hasActiveMarker = true;
		}

		const main =
			row.createDiv(
				'cribbage-leaderboard-row-main',
			);

		main.createEl('span', {
			text:
				`${record.rank}.`,
			cls:
				'cribbage-leaderboard-rank',
		});

		main.createEl('span', {
			text:
				record.label,
			cls:
				'cribbage-leaderboard-name',
		});

		let value =
			String(
				record.length,
			);

		if (record.count > 1) {
			value +=
				` (x${record.count})`;
		}

		if (
			record.activeSingleton
		) {
			value += '*';
		}

		main.createEl('strong', {
			text: value,
			cls:
				'cribbage-leaderboard-value',
		});

		row.createEl('div', {
			text:
				record.subtext,
			cls:
				'cribbage-leaderboard-subtext',
		});
	}

	if (hasActiveMarker) {
		card.createEl('div', {
			text: '* Active streak',
			cls:
				'cribbage-leaderboard-note cribbage-leaderboard-active-note',
		});
	}
}

function buildHighestHandOccurrences(
	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences:
		RecordOccurrence[] = [];

	const handsByGame =
		groupHandsByGame(hands);

	for (const game of games) {
		const gameHands =
			handsByGame.get(
				game.id,
			) ?? [];

		/*
		 * If we have individual hand rows,
		 * every recorded hand score counts.
		 */
		if (gameHands.length > 0) {
			for (
				const hand of gameHands
			) {
				if (
					typeof hand
						.player1HandPoints ===
					'number'
				) {
					addRecordOccurrence(
						occurrences,

						hand
							.player1HandPoints,

						hand.player1,
						hand.player2,

						hand.playedDate,
						hand.playedTime,
					);
				}

				if (
					typeof hand
						.player2HandPoints ===
					'number'
				) {
					addRecordOccurrence(
						occurrences,

						hand
							.player2HandPoints,

						hand.player2,
						hand.player1,

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
		if (
			game
				.player1HighHandManual !==
			null
		) {
			addRecordOccurrence(
				occurrences,

				game
					.player1HighHandManual,

				game.player1,
				game.player2,

				game.playedDate,
				game.playedTime,
			);
		}

		if (
			game
				.player2HighHandManual !==
			null
		) {
			addRecordOccurrence(
				occurrences,

				game
					.player2HighHandManual,

				game.player2,
				game.player1,

				game.playedDate,
				game.playedTime,
			);
		}
	}

	return occurrences;
}

function buildHighHandLossOccurrences(
	games: GameStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences:
		RecordOccurrence[] = [];

	for (const game of games) {
		if (
			typeof game.player1Score !==
				'number' ||
			typeof game.player2Score !==
				'number' ||
			game.player1Score ===
				game.player2Score
		) {
			continue;
		}

		const losingSide:
			1 | 2 =
			game.player1Score <
			game.player2Score
				? 1
				: 2;

		const value =
			effectiveHighHand(
				game,
				losingSide,
			);

		if (value === null) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			value,

			losingSide === 1
				? game.player1
				: game.player2,

			losingSide === 1
				? game.player2
				: game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

function buildLowHighHandWinOccurrences(
	games: GameStatisticsRecord[],
): RecordOccurrence[] {
	const occurrences:
		RecordOccurrence[] = [];

	for (const game of games) {
		if (
			typeof game.player1Score !==
				'number' ||
			typeof game.player2Score !==
				'number' ||
			game.player1Score ===
				game.player2Score
		) {
			continue;
		}

		const winningSide:
			1 | 2 =
			game.player1Score >
			game.player2Score
				? 1
				: 2;

		const value =
			effectiveHighHand(
				game,
				winningSide,
			);

		if (value === null) {
			continue;
		}

		addRecordOccurrence(
			occurrences,
			value,

			winningSide === 1
				? game.player1
				: game.player2,

			winningSide === 1
				? game.player2
				: game.player1,

			game.playedDate,
			game.playedTime,
		);
	}

	return occurrences;
}

function groupRecordOccurrences(
	occurrences: RecordOccurrence[],
	direction:
		| 'ascending'
		| 'descending',
): GroupedRecordRow[] {
	const grouped =
		new Map<
			number,
			RecordOccurrence[]
		>();

	for (
		const occurrence
		of occurrences
	) {
		const existing =
			grouped.get(
				occurrence.score,
			);

		if (existing) {
			existing.push(
				occurrence,
			);
		} else {
			grouped.set(
				occurrence.score,
				[occurrence],
			);
		}
	}

	const scores =
		Array.from(
			grouped.keys(),
		).sort(
			(a, b) =>
				direction ===
					'descending'
					? b - a
					: a - b,
		);

	const rows:
		GroupedRecordRow[] = [];

	let rank = 1;

	for (const score of scores) {
		if (rows.length >= 5) {
			break;
		}

		const scoreOccurrences =
			grouped.get(score) ?? [];

		if (
			scoreOccurrences.length ===
			0
		) {
			continue;
		}

		const contributorCounts =
			new Map<
				string,
				number
			>();

		for (
			const occurrence
			of scoreOccurrences
		) {
			contributorCounts.set(
				occurrence.player,
				(
					contributorCounts.get(
						occurrence.player,
					) ?? 0
				) + 1,
			);
		}

		const contributors =
			Array.from(
				contributorCounts
					.entries(),
			).sort(
				(a, b) =>
					b[1] - a[1] ||
					a[0].localeCompare(
						b[0],
					),
			);

		const label =
			contributors.length === 1
				? contributors[0]![0]
				: 'Multiple';

		let subtext: string;

		if (
			scoreOccurrences.length ===
			1
		) {
			const occurrence =
				scoreOccurrences[0]!;

			subtext =
				`vs ${occurrence.opponent} on ${formatDate(occurrence.playedDate)}`;
		} else if (
			contributors.length === 1
		) {
			const latest =
				[...scoreOccurrences]
					.sort(
						compareOccurrencesNewestFirst,
					)[0]!;

			subtext =
				`Last: vs ${latest.opponent} on ${formatDate(latest.playedDate)}`;
		} else {
			const pieces:
				string[] = [];

			for (
				const [
					player,
					count,
				] of contributors.slice(
					0,
					2,
				)
			) {
				pieces.push(
					`${player} ${count}x`,
				);
			}

			const others =
				contributors
					.slice(2)
					.reduce(
						(
							total,
							[, count],
						) =>
							total +
							count,
						0,
					);

			if (others > 0) {
				pieces.push(
					`Others ${others}x`,
				);
			}

			subtext =
				pieces.join(' • ');
		}

		rows.push({
			rank,
			score,

			count:
				scoreOccurrences.length,

			label,
			subtext,
		});

		/*
		 * A score occurring 9 times occupies
		 * nine theoretical leaderboard places.
		 */
		rank +=
			scoreOccurrences.length;
	}

	return rows;
}

function addRecordOccurrence(
	target: RecordOccurrence[],
	score: number,
	playerValue:
		string | null | undefined,
	opponentValue:
		string | null | undefined,
	playedDate: string,
	playedTime: string,
): void {
	const player =
		cleanPlayerName(
			playerValue,
		);

	const opponent =
		cleanPlayerName(
			opponentValue,
		);

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

function getPlayerAggregate(
	players:
		Map<
			string,
			PlayerAggregate
		>,
	name: string,
): PlayerAggregate {
	const existing =
		players.get(name);

	if (existing) {
		return existing;
	}

	const player:
		PlayerAggregate = {
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

	players.set(
		name,
		player,
	);

	return player;
}

function effectiveHighHand(
	game: GameStatisticsRecord,
	side: 1 | 2,
): number | null {
	if (side === 1) {
		if (
			game
				.player1HighHandManual !==
			null
		) {
			return game
				.player1HighHandManual;
		}

		if (
			game.handDataIncomplete
		) {
			return null;
		}

		return game
			.player1HighHandCalculated;
	}

	if (
		game.player2HighHandManual !==
		null
	) {
		return game
			.player2HighHandManual;
	}

	if (
		game.handDataIncomplete
	) {
		return null;
	}

	return game
		.player2HighHandCalculated;
}

function getHandDealer(
	firstDealer: 1 | 2,
	handNumber: number,
): 1 | 2 {
	if (
		handNumber % 2 === 1
	) {
		return firstDealer;
	}

	return firstDealer === 1
		? 2
		: 1;
}

function groupHandsByGame(
	hands: HandStatisticsRecord[],
): Map<
	string,
	HandStatisticsRecord[]
> {
	const grouped =
		new Map<
			string,
			HandStatisticsRecord[]
		>();

	for (const hand of hands) {
		const existing =
			grouped.get(
				hand.gameId,
			);

		if (existing) {
			existing.push(hand);
		} else {
			grouped.set(
				hand.gameId,
				[hand],
			);
		}
	}

	return grouped;
}

function compareGamesChronologically(
	a: GameStatisticsRecord,
	b: GameStatisticsRecord,
): number {
	return (
		a.playedDate.localeCompare(
			b.playedDate,
		) ||
		a.playedTime.localeCompare(
			b.playedTime,
		) ||
		a.id.localeCompare(
			b.id,
		)
	);
}

function compareOccurrencesNewestFirst(
	a: RecordOccurrence,
	b: RecordOccurrence,
): number {
	return (
		b.playedDate.localeCompare(
			a.playedDate,
		) ||
		b.playedTime.localeCompare(
			a.playedTime,
		)
	);
}

function cleanPlayerName(
	value:
		string | null | undefined,
): string | null {
	const name =
		value?.trim();

	return name
		? name
		: null;
}

function winRate(
	player: PlayerAggregate,
): number {
	if (player.games === 0) {
		return 0;
	}

	return (
		player.wins /
		player.games
	);
}

function formatPercent(
	value: number,
): string {
	return (
		`${(value * 100).toFixed(1)}%`
	);
}

function formatSigned(
	value: number,
): string {
	const text =
		value.toFixed(2);

	return value > 0
		? `+${text}`
		: text;
}

function formatDate(
	value: string,
): string {
	const parts =
		value.split('-');

	if (parts.length !== 3) {
		return value;
	}

	const year =
		Number(parts[0]);

	const month =
		Number(parts[1]);

	const day =
		Number(parts[2]);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return value;
	}

	return (
		`${month}/${day}/${String(year).slice(-2)}`
	);
}

function formatStreakDateRange(
	streak:
		WinningStreakOccurrence,
): string {
	return (
		`${formatDate(
			streak.startDate,
		)} - ${formatDate(
			streak.endDate,
		)}`
	);
}

function compareStreaksNewestFirst(
	a: WinningStreakOccurrence,
	b: WinningStreakOccurrence,
): number {
	return (
		b.endDate.localeCompare(
			a.endDate,
		) ||
		b.endTime.localeCompare(
			a.endTime,
		) ||
		b.startDate.localeCompare(
			a.startDate,
		) ||
		b.startTime.localeCompare(
			a.startTime,
		)
	);
}

function createSection(
	container: HTMLElement,
	title: string,
): HTMLElement {
	const section =
		container.createDiv(
			'cribbage-leaderboard-section',
		);

	section.createEl('h3', {
		text: title,
	});

	return section;
}

function createLeaderboardGrid(
	container: HTMLElement,
): HTMLElement {
	return container.createDiv(
		'cribbage-leaderboard-grid',
	);
}

function renderEmpty(
	container: HTMLElement,
	text: string,
): void {
	container.createEl('div', {
		text,
		cls:
			'cribbage-leaderboard-empty',
	});
}