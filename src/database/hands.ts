import type { Database } from 'sql.js';

import type {
	CreateId,
	HandInput,
	HandRecord,
	SaveDatabase,
} from './types';

import {
	getDealerForHand,
	getHandEligibility,
	recalculateGameAggregates,
} from './calculations';

export function listHands(
	db: Database,
	gameId: string,
): HandRecord[] {
	const gameResult = db.exec(
		`
		SELECT first_dealer
		FROM games
		WHERE id = ?;
		`,
		[gameId],
	);

	const firstDealerValue =
		gameResult[0]?.values[0]?.[0];

	const firstDealer: 1 | 2 | null =
		firstDealerValue === 1
			? 1
			: firstDealerValue === 2
				? 2
				: null;

	const result = db.exec(
		`
		SELECT
			id,
			game_id,
			hand_number,
			player_1_hand_points,
			player_2_hand_points,
			crib_points,
			player_1_hand_eligibility_override,
			player_2_hand_eligibility_override,
			crib_eligibility_override
		FROM hands
		WHERE game_id = ?
		ORDER BY hand_number ASC;
		`,
		[gameId],
	);

	const rows = result[0]?.values ?? [];

	const lastHandNumber =
		rows.length > 0
			? Number(rows[rows.length - 1]?.[2])
			: null;

	return rows.map((row) => {
		const handNumber = Number(row[2]);

		return {
			id: String(row[0]),
			gameId: String(row[1]),
			handNumber,

			dealer:
				firstDealer === null
					? null
					: getDealerForHand(
						firstDealer,
						handNumber,
					),

			player1HandPoints:
				typeof row[3] === 'number'
					? row[3]
					: null,

			player2HandPoints:
				typeof row[4] === 'number'
					? row[4]
					: null,

			cribPoints:
				typeof row[5] === 'number'
					? row[5]
					: null,

			player1HandEligibilityOverride:
				row[6] === null
					? null
					: row[6] === 1,

			player2HandEligibilityOverride:
				row[7] === null
					? null
					: row[7] === 1,

			cribEligibilityOverride:
				row[8] === null
					? null
					: row[8] === 1,

			isLastHand:
				handNumber === lastHandNumber,
		};
	});
}

export async function addHand(
	db: Database,
	gameId: string,
	input: HandInput,
	save: SaveDatabase,
	createId: CreateId,
): Promise<string> {
	const gameResult = db.exec(
		`
		SELECT first_dealer
		FROM games
		WHERE id = ?;
		`,
		[gameId],
	);

	const gameRow = gameResult[0]?.values[0];

	if (!gameRow) {
		throw new Error('Game not found.');
	}

	if (gameRow[0] !== 1 && gameRow[0] !== 2) {
		throw new Error(
			'First dealer must be known before adding hands.',
		);
	}

	const numberResult = db.exec(
		`
		SELECT
			COALESCE(MAX(hand_number), 0) + 1
		FROM hands
		WHERE game_id = ?;
		`,
		[gameId],
	);

	const handNumber = Number(
		numberResult[0]?.values[0]?.[0] ?? 1,
	);

	const id = createId();

	db.run('BEGIN;');

	try {
		db.run(
			`
			INSERT INTO hands (
				id,
				game_id,
				hand_number,
				player_1_hand_points,
				player_2_hand_points,
				crib_points,
				player_1_hand_eligibility_override,
				player_2_hand_eligibility_override,
				crib_eligibility_override
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
			`,
			[
				id,
				gameId,
				handNumber,
				input.player1HandPoints,
				input.player2HandPoints,
				input.cribPoints,

				input.player1HandEligibilityOverride === null ||
				input.player1HandEligibilityOverride === undefined
					? null
					: input.player1HandEligibilityOverride
						? 1
						: 0,

				input.player2HandEligibilityOverride === null ||
				input.player2HandEligibilityOverride === undefined
					? null
					: input.player2HandEligibilityOverride
						? 1
						: 0,

				input.cribEligibilityOverride === null ||
				input.cribEligibilityOverride === undefined
					? null
					: input.cribEligibilityOverride
						? 1
						: 0,
			],
		);

		recalculateGameAggregates(
			db,
			gameId,
		);

		db.run('COMMIT;');
	} catch (error) {
		db.run('ROLLBACK;');
		throw error;
	}

	await save();

	return id;
}

export async function updateHand(
	db: Database,
	id: string,
	input: HandInput,
	save: SaveDatabase,
): Promise<void> {
	const result = db.exec(
		`
		SELECT
			game_id,
			player_1_hand_eligibility_override,
			player_2_hand_eligibility_override,
			crib_eligibility_override
		FROM hands
		WHERE id = ?;
		`,
		[id],
	);

	const row = result[0]?.values[0];

	if (!row) {
		throw new Error('Hand not found.');
	}

	const gameId = String(row[0]);

	const existingPlayer1Override =
		row[1] === null
			? null
			: row[1] === 1;

	const existingPlayer2Override =
		row[2] === null
			? null
			: row[2] === 1;

	const existingCribOverride =
		row[3] === null
			? null
			: row[3] === 1;

	db.run('BEGIN;');

	try {
		db.run(
			`
			UPDATE hands
			SET
				player_1_hand_points = ?,
				player_2_hand_points = ?,
				crib_points = ?,
				player_1_hand_eligibility_override = ?,
				player_2_hand_eligibility_override = ?,
				crib_eligibility_override = ?
			WHERE id = ?;
			`,
			[
				input.player1HandPoints,
				input.player2HandPoints,
				input.cribPoints,

				input.player1HandEligibilityOverride === undefined
					? existingPlayer1Override === null
						? null
						: existingPlayer1Override
							? 1
							: 0
					: input.player1HandEligibilityOverride === null
						? null
						: input.player1HandEligibilityOverride
							? 1
							: 0,

				input.player2HandEligibilityOverride === undefined
					? existingPlayer2Override === null
						? null
						: existingPlayer2Override
							? 1
							: 0
					: input.player2HandEligibilityOverride === null
						? null
						: input.player2HandEligibilityOverride
							? 1
							: 0,

				input.cribEligibilityOverride === undefined
					? existingCribOverride === null
						? null
						: existingCribOverride
							? 1
							: 0
					: input.cribEligibilityOverride === null
						? null
						: input.cribEligibilityOverride
							? 1
							: 0,

				id,
			],
		);

		recalculateGameAggregates(
			db,
			gameId,
		);

		db.run('COMMIT;');
	} catch (error) {
		db.run('ROLLBACK;');
		throw error;
	}

	await save();
}

export async function deleteHand(
	db: Database,
	id: string,
	save: SaveDatabase,
): Promise<void> {
	const result = db.exec(
		`
		SELECT
			game_id,
			hand_number
		FROM hands
		WHERE id = ?;
		`,
		[id],
	);

	const row = result[0]?.values[0];

	if (!row) {
		throw new Error('Hand not found.');
	}

	const gameId = String(row[0]);
	const handNumber = Number(row[1]);

	db.run('BEGIN;');

	try {
		db.run(
			`
			DELETE FROM hands
			WHERE id = ?;
			`,
			[id],
		);

		const laterHands = db.exec(
			`
			SELECT
				id,
				hand_number
			FROM hands
			WHERE
				game_id = ?
				AND hand_number > ?
			ORDER BY hand_number ASC;
			`,
			[
				gameId,
				handNumber,
			],
		);

		const laterRows =
			laterHands[0]?.values ?? [];

		for (const laterRow of laterRows) {
			const laterId = String(laterRow[0]);
			const laterNumber = Number(laterRow[1]);

			db.run(
				`
				UPDATE hands
				SET hand_number = ?
				WHERE id = ?;
				`,
				[
					laterNumber - 1,
					laterId,
				],
			);
		}

		recalculateGameAggregates(
			db,
			gameId,
		);

		db.run('COMMIT;');
	} catch (error) {
		db.run('ROLLBACK;');
		throw error;
	}

	await save();
}

export function getEffectiveHandEligibility(
	db: Database,
	hand: HandRecord,
): {
	player1HandEligible: boolean;
	player2HandEligible: boolean;
	cribEligible: boolean;
} {
	const gameResult = db.exec(
		`
		SELECT first_dealer
		FROM games
		WHERE id = ?;
		`,
		[hand.gameId],
	);

	const firstDealerValue =
		gameResult[0]?.values[0]?.[0];

	const firstDealer: 1 | 2 | null =
		firstDealerValue === 1
			? 1
			: firstDealerValue === 2
				? 2
				: null;

	const lastHandResult = db.exec(
		`
		SELECT MAX(hand_number)
		FROM hands
		WHERE game_id = ?;
		`,
		[hand.gameId],
	);

	const lastHandNumber = Number(
		lastHandResult[0]?.values[0]?.[0] ?? 0,
	);

	return getHandEligibility(
		firstDealer,
		hand.handNumber,
		lastHandNumber,
		hand.player1HandPoints,
		hand.player2HandPoints,
		hand.cribPoints,
		hand.player1HandEligibilityOverride,
		hand.player2HandEligibilityOverride,
		hand.cribEligibilityOverride,
	);
}

export async function updateHandEligibilityOverrides(
	db: Database,
	id: string,
	player1HandEligibilityOverride: boolean | null,
	player2HandEligibilityOverride: boolean | null,
	cribEligibilityOverride: boolean | null,
	save: SaveDatabase,
): Promise<void> {
	const result = db.exec(
		`
		SELECT game_id
		FROM hands
		WHERE id = ?;
		`,
		[id],
	);

	const row = result[0]?.values[0];

	if (!row) {
		throw new Error('Hand not found.');
	}

	const gameId = String(row[0]);

	db.run(
		`
		UPDATE hands
		SET
			player_1_hand_eligibility_override = ?,
			player_2_hand_eligibility_override = ?,
			crib_eligibility_override = ?
		WHERE id = ?;
		`,
		[
			player1HandEligibilityOverride === null
				? null
				: player1HandEligibilityOverride
					? 1
					: 0,

			player2HandEligibilityOverride === null
				? null
				: player2HandEligibilityOverride
					? 1
					: 0,

			cribEligibilityOverride === null
				? null
				: cribEligibilityOverride
					? 1
					: 0,

			id,
		],
	);

	recalculateGameAggregates(
		db,
		gameId,
	);

	await save();
}