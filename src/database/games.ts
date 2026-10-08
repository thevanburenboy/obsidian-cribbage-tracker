import type { Database } from 'sql.js';

import type {
	CreateId,
	GameInput,
	GameRecord,
	SaveDatabase,
} from './types';

import {
	recalculateGameAggregates,
} from './calculations';

export function getGameCount(
	db: Database,
): number {
	const result = db.exec(
		'SELECT COUNT(*) FROM games;',
	);

	const value = result[0]?.values[0]?.[0];

	return typeof value === 'number' ? value : 0;
}

export function getPlayerNames(
	db: Database,
): string[] {
	const result = db.exec(`
		SELECT MIN(name) AS name
		FROM (
			SELECT TRIM(player_1) AS name
			FROM games
			WHERE player_1 IS NOT NULL
				AND TRIM(player_1) <> ''

			UNION ALL

			SELECT TRIM(player_2) AS name
			FROM games
			WHERE player_2 IS NOT NULL
				AND TRIM(player_2) <> ''
		)
		GROUP BY LOWER(name)
		ORDER BY name COLLATE NOCASE;
	`);

	const rows = result[0]?.values ?? [];

	return rows
		.map((row) => row[0])
		.filter(
			(value): value is string =>
				typeof value === 'string',
		);
}

export function listGames(
	db: Database,
): GameRecord[] {
	const result = db.exec(`
		SELECT
			id,
			played_date,
			played_time,
			player_1,
			player_2,
			first_dealer,
			player_1_score,
			player_2_score,
			player_1_high_hand_manual,
			player_2_high_hand_manual,
			hand_data_incomplete
		FROM games
		ORDER BY
			played_date DESC,
			played_time DESC,
			created_at DESC;
	`);

	const rows = result[0]?.values ?? [];

	return rows.map((row) => ({
		id: String(row[0]),
		playedDate: String(row[1]),
		playedTime: String(row[2]),
		player1: String(row[3] ?? ''),
		player2: String(row[4] ?? ''),

		firstDealer:
			row[5] === 1
				? 1
				: row[5] === 2
					? 2
					: null,

		player1Score:
			typeof row[6] === 'number'
				? row[6]
				: null,

		player2Score:
			typeof row[7] === 'number'
				? row[7]
				: null,

		player1HighHandManual:
			typeof row[8] === 'number'
				? row[8]
				: null,

		player2HighHandManual:
			typeof row[9] === 'number'
				? row[9]
				: null,

		handDataIncomplete: row[10] === 1,
	}));
}

export async function createGame(
	db: Database,
	input: GameInput,
	save: SaveDatabase,
	createId: CreateId,
): Promise<string> {
	const id = createId();

	db.run(
		`
		INSERT INTO games (
			id,
			played_date,
			played_time,
			player_1,
			player_2,
			first_dealer,
			player_1_score,
			player_2_score,
			player_1_high_hand_manual,
			player_2_high_hand_manual,
			hand_data_incomplete
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
		`,
		[
			id,
			input.playedDate,
			input.playedTime,
			input.player1.trim(),
			input.player2.trim(),
			input.firstDealer,
			input.player1Score,
			input.player2Score,
			input.player1HighHandManual,
			input.player2HighHandManual,
			input.handDataIncomplete ? 1 : 0,
		],
	);

	await save();

	return id;
}

export async function createGames(
	db: Database,
	inputs: GameInput[],
	save: SaveDatabase,
	createId: CreateId,
): Promise<number> {
	if (inputs.length === 0) {
		return 0;
	}

	db.run('BEGIN;');

	try {
		for (const input of inputs) {
			const id = createId();

			db.run(
				`
				INSERT INTO games (
					id,
					played_date,
					played_time,
					player_1,
					player_2,
					first_dealer,
					player_1_score,
					player_2_score,
					player_1_high_hand_manual,
					player_2_high_hand_manual,
					hand_data_incomplete
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
				`,
				[
					id,
					input.playedDate,
					input.playedTime,
					input.player1.trim(),
					input.player2.trim(),
					input.firstDealer,
					input.player1Score,
					input.player2Score,
					input.player1HighHandManual,
					input.player2HighHandManual,
					input.handDataIncomplete ? 1 : 0,
				],
			);
		}

		db.run('COMMIT;');
	} catch (error) {
		db.run('ROLLBACK;');
		throw error;
	}

	await save();

	return inputs.length;
}

export async function updateGame(
	db: Database,
	id: string,
	input: GameInput,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		`
		UPDATE games
		SET
			played_date = ?,
			played_time = ?,
			player_1 = ?,
			player_2 = ?,
			first_dealer = ?,
			player_1_score = ?,
			player_2_score = ?,
			player_1_high_hand_manual = ?,
			player_2_high_hand_manual = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?;
		`,
		[
			input.playedDate,
			input.playedTime,
			input.player1.trim(),
			input.player2.trim(),
			input.firstDealer,
			input.player1Score,
			input.player2Score,
			input.player1HighHandManual,
			input.player2HighHandManual,
			id,
		],
	);

	recalculateGameAggregates(db, id);

	await save();
}

export async function deleteGame(
	db: Database,
	id: string,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		'DELETE FROM games WHERE id = ?;',
		[id],
	);

	await save();
}

export async function setHandDataIncomplete(
	db: Database,
	gameId: string,
	incomplete: boolean,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		`
		UPDATE games
		SET
			hand_data_incomplete = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?;
		`,
		[
			incomplete ? 1 : 0,
			gameId,
		],
	);

	await save();
}

export async function setManualHighHands(
	db: Database,
	gameId: string,
	player1High: number | null,
	player2High: number | null,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		`
		UPDATE games
		SET
			player_1_high_hand_manual = ?,
			player_2_high_hand_manual = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?;
		`,
		[
			player1High,
			player2High,
			gameId,
		],
	);

	await save();
}

export function recalculateAllGameAggregates(
	db: Database,
): void {
	const result = db.exec(`
		SELECT id
		FROM games;
	`);

	const rows = result[0]?.values ?? [];

	for (const row of rows) {
		const gameId = String(row[0]);

		recalculateGameAggregates(
			db,
			gameId,
		);
	}
}