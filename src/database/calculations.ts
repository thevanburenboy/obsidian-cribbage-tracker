import type { Database } from 'sql.js';

export function getDealerForHand(
	firstDealer: 1 | 2,
	handNumber: number,
): 1 | 2 {
	const firstDealerHand = handNumber % 2 === 1;

	if (firstDealerHand) {
		return firstDealer;
	}

	return firstDealer === 1 ? 2 : 1;
}

export function getHandEligibility(
	firstDealer: 1 | 2 | null,
	handNumber: number,
	lastHandNumber: number,
	player1Points: number | null,
	player2Points: number | null,
	cribPoints: number | null,
	player1Override: boolean | null,
	player2Override: boolean | null,
	cribOverride: boolean | null,
): {
	player1HandEligible: boolean;
	player2HandEligible: boolean;
	cribEligible: boolean;
} {
	const isLastHand = handNumber === lastHandNumber;

	let player1HandEligible = !isLastHand;
	let player2HandEligible = !isLastHand;
	let cribEligible = !isLastHand;

	if (isLastHand && firstDealer !== null) {
		const dealer = getDealerForHand(firstDealer, handNumber);

		const dealerPoints =
			dealer === 1
				? player1Points
				: player2Points;

		if (cribPoints !== null && cribPoints > 0) {
			player1HandEligible = true;
			player2HandEligible = true;
		} else if (
			dealerPoints !== null &&
			dealerPoints > 0
		) {
			const pone = dealer === 1 ? 2 : 1;

			if (pone === 1) {
				player1HandEligible = true;
			} else {
				player2HandEligible = true;
			}
		}

		cribEligible = false;
	}

	if (isLastHand) {
		if (player1Override !== null) {
			player1HandEligible = player1Override;
		}

		if (player2Override !== null) {
			player2HandEligible = player2Override;
		}

		if (cribOverride !== null) {
			cribEligible = cribOverride;
		}
	}

	return {
		player1HandEligible,
		player2HandEligible,
		cribEligible,
	};
}

export function recalculateGameAggregates(
	db: Database,
	gameId: string,
): void {
	const gameResult = db.exec(
		`
		SELECT
			first_dealer,
			player_1_score,
			player_2_score
		FROM games
		WHERE id = ?;
		`,
		[gameId],
	);

	const gameRow = gameResult[0]?.values[0];

	const firstDealerValue = gameRow?.[0];

	const firstDealer: 1 | 2 | null =
		firstDealerValue === 1
			? 1
			: firstDealerValue === 2
				? 2
				: null;

	const player1ScoreValue = gameRow?.[1];

	const player2ScoreValue = gameRow?.[2];

	const player1Score =
		typeof player1ScoreValue === 'number'
			? player1ScoreValue
			: null;

	const player2Score =
		typeof player2ScoreValue === 'number'
			? player2ScoreValue
			: null;

	const result = db.exec(
		`
		SELECT
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

	if (rows.length === 0) {
		db.run(
			`
			UPDATE games
			SET
				player_1_hand_points_total = 0,
				player_2_hand_points_total = 0,

				player_1_hand_points_eligible = 0,
				player_2_hand_points_eligible = 0,

				player_1_eligible_hand_count = 0,
				player_2_eligible_hand_count = 0,

				player_1_crib_points_total = 0,
				player_2_crib_points_total = 0,

				player_1_crib_points_eligible = 0,
				player_2_crib_points_eligible = 0,

				round_count = 0,
				eligible_round_count = 0,

				player_1_crib_count = 0,
				player_2_crib_count = 0,

				player_1_eligible_crib_count = 0,
				player_2_eligible_crib_count = 0,

				player_1_high_hand = NULL,
				player_2_high_hand = NULL,

				player_1_pegging_points_total = 0,
				player_2_pegging_points_total = 0,

				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?;
			`,
			[gameId],
		);

		return;
	}

	const lastHandNumber = Number(
		rows[rows.length - 1]?.[0],
	);

	let player1HandTotal = 0;
	let player2HandTotal = 0;

	let player1HandEligible = 0;
	let player2HandEligible = 0;

	let player1EligibleHandCount = 0;
	let player2EligibleHandCount = 0;

	let player1CribTotal = 0;
	let player2CribTotal = 0;

	let player1CribEligible = 0;
	let player2CribEligible = 0;

	let player1CribCount = 0;
	let player2CribCount = 0;

	let player1EligibleCribCount = 0;
	let player2EligibleCribCount = 0;

	let player1HighHand: number | null = null;
	let player2HighHand: number | null = null;

	for (const row of rows) {
		const handNumber = Number(row[0]);

		const player1Points =
			typeof row[1] === 'number'
				? row[1]
				: null;

		const player2Points =
			typeof row[2] === 'number'
				? row[2]
				: null;

		const cribPoints =
			typeof row[3] === 'number'
				? row[3]
				: null;

		const player1Override =
			row[4] === null
				? null
				: row[4] === 1;

		const player2Override =
			row[5] === null
				? null
				: row[5] === 1;

		const cribOverride =
			row[6] === null
				? null
				: row[6] === 1;

		const {
			player1HandEligible:
				player1HandIsEligible,
			player2HandEligible:
				player2HandIsEligible,
			cribEligible:
				cribIsEligible,
		} = getHandEligibility(
			firstDealer,
			handNumber,
			lastHandNumber,
			player1Points,
			player2Points,
			cribPoints,
			player1Override,
			player2Override,
			cribOverride,
		);

		if (player1Points !== null) {
			player1HandTotal += player1Points;

			player1HighHand =
				player1HighHand === null
					? player1Points
					: Math.max(
						player1HighHand,
						player1Points,
					);

			if (player1HandIsEligible) {
				player1HandEligible += player1Points;
				player1EligibleHandCount++;
			}
		}

		if (player2Points !== null) {
			player2HandTotal += player2Points;

			player2HighHand =
				player2HighHand === null
					? player2Points
					: Math.max(
						player2HighHand,
						player2Points,
					);

			if (player2HandIsEligible) {
				player2HandEligible += player2Points;
				player2EligibleHandCount++;
			}
		}

		if (cribPoints !== null && firstDealer !== null) {
			const dealer = getDealerForHand(
				firstDealer,
				handNumber,
			);

			if (dealer === 1) {
				player1CribTotal += cribPoints;

				player1CribCount++;

				player1HighHand =
					player1HighHand === null
						? cribPoints
						: Math.max(
							player1HighHand,
							cribPoints,
						);

				if (cribIsEligible) {
					player1CribEligible += cribPoints;
					player1EligibleCribCount++;
				}
			} else {
				player2CribTotal += cribPoints;

				player2CribCount++;

				player2HighHand =
					player2HighHand === null
						? cribPoints
						: Math.max(
							player2HighHand,
							cribPoints,
						);

				if (cribIsEligible) {
					player2CribEligible += cribPoints;
					player2EligibleCribCount++;
				}
			}
		}
	}

	const player1PeggingPoints =
		player1Score === null
			? 0
			: player1Score -
				player1HandTotal -
				player1CribTotal;

	const player2PeggingPoints =
		player2Score === null
			? 0
			: player2Score -
				player2HandTotal -
				player2CribTotal;

	db.run(
		`
		UPDATE games
		SET
			player_1_hand_points_total = ?,
			player_2_hand_points_total = ?,

			player_1_hand_points_eligible = ?,
			player_2_hand_points_eligible = ?,

			player_1_eligible_hand_count = ?,
			player_2_eligible_hand_count = ?,

			player_1_crib_points_total = ?,
			player_2_crib_points_total = ?,

			player_1_crib_points_eligible = ?,
			player_2_crib_points_eligible = ?,

			round_count = ?,
			eligible_round_count = ?,

			player_1_crib_count = ?,
			player_2_crib_count = ?,

			player_1_eligible_crib_count = ?,
			player_2_eligible_crib_count = ?,

			player_1_high_hand = ?,
			player_2_high_hand = ?,

			player_1_pegging_points_total = ?,
			player_2_pegging_points_total = ?,

			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?;
		`,
		[
			player1HandTotal,
			player2HandTotal,

			player1HandEligible,
			player2HandEligible,

			player1EligibleHandCount,
			player2EligibleHandCount,

			player1CribTotal,
			player2CribTotal,

			player1CribEligible,
			player2CribEligible,

			rows.length,
			Math.max(rows.length - 1, 0),

			player1CribCount,
			player2CribCount,

			player1EligibleCribCount,
			player2EligibleCribCount,

			player1HighHand,
			player2HighHand,

			player1PeggingPoints,
			player2PeggingPoints,

			gameId,
		],
	);
}