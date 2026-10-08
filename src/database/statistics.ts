import type { Database } from 'sql.js';

import type {
	GameHandSummary,
	GameStatisticsRecord,
	HandStatisticsRecord,
} from './types';

export function getGameHandSummary(
	db: Database,
	gameId: string,
): GameHandSummary {
	const result = db.exec(
		`
		SELECT
			round_count,
			eligible_round_count,

			player_1_hand_points_total,
			player_2_hand_points_total,

			player_1_hand_points_eligible,
			player_2_hand_points_eligible,

			player_1_eligible_hand_count,
			player_2_eligible_hand_count,

			player_1_crib_points_total,
			player_2_crib_points_total,

			player_1_crib_points_eligible,
			player_2_crib_points_eligible,

			player_1_crib_count,
			player_2_crib_count,

			player_1_eligible_crib_count,
			player_2_eligible_crib_count,

			player_1_pegging_points_total,
			player_2_pegging_points_total,

			player_1_high_hand,
			player_2_high_hand

		FROM games
		WHERE id = ?;
		`,
		[gameId],
	);

	const row = result[0]?.values[0];

	if (!row) {
		throw new Error('Game not found.');
	}

	return {
		roundCount: Number(row[0]),
		eligibleRoundCount: Number(row[1]),

		player1HandPointsTotal: Number(row[2]),
		player2HandPointsTotal: Number(row[3]),

		player1HandPointsEligible: Number(row[4]),
		player2HandPointsEligible: Number(row[5]),

		player1EligibleHandCount: Number(row[6]),
		player2EligibleHandCount: Number(row[7]),

		player1CribPointsTotal: Number(row[8]),
		player2CribPointsTotal: Number(row[9]),

		player1CribPointsEligible: Number(row[10]),
		player2CribPointsEligible: Number(row[11]),

		player1CribCount: Number(row[12]),
		player2CribCount: Number(row[13]),

		player1EligibleCribCount: Number(row[14]),
		player2EligibleCribCount: Number(row[15]),

		player1PeggingPointsTotal: Number(row[16]),
		player2PeggingPointsTotal: Number(row[17]),

		player1HighHandCalculated:
			typeof row[18] === 'number'
				? row[18]
				: null,

		player2HighHandCalculated:
			typeof row[19] === 'number'
				? row[19]
				: null,
	};
}

export function listGamesForStatistics(
	db: Database,
): GameStatisticsRecord[] {
	const result = db.exec(`
		SELECT
			id,

			player_1,
			player_2,

			first_dealer,

			player_1_score,
			player_2_score,

			player_1_high_hand_manual,
			player_2_high_hand_manual,

			player_1_high_hand,
			player_2_high_hand,

			hand_data_incomplete,

			round_count,
			eligible_round_count,

			player_1_hand_points_eligible,
			player_2_hand_points_eligible,

			player_1_crib_points_eligible,
			player_2_crib_points_eligible,

			player_1_eligible_crib_count,
			player_2_eligible_crib_count,

			player_1_pegging_points_total,
			player_2_pegging_points_total,

			played_date,
			played_time

		FROM games;
	`);

	const rows = result[0]?.values ?? [];

	return rows.map((row) => ({
		id: String(row[0]),

		player1: String(row[1] ?? ''),
		player2: String(row[2] ?? ''),

		firstDealer:
			row[3] === 1
				? 1
				: row[3] === 2
					? 2
					: null,

		player1Score:
			typeof row[4] === 'number'
				? row[4]
				: null,

		player2Score:
			typeof row[5] === 'number'
				? row[5]
				: null,

		player1HighHandManual:
			typeof row[6] === 'number'
				? row[6]
				: null,

		player2HighHandManual:
			typeof row[7] === 'number'
				? row[7]
				: null,

		player1HighHandCalculated:
			typeof row[8] === 'number'
				? row[8]
				: null,

		player2HighHandCalculated:
			typeof row[9] === 'number'
				? row[9]
				: null,

		handDataIncomplete: row[10] === 1,

		roundCount: Number(row[11]),
		eligibleRoundCount: Number(row[12]),

		player1HandPointsEligible: Number(row[13]),
		player2HandPointsEligible: Number(row[14]),

		player1CribPointsEligible: Number(row[15]),
		player2CribPointsEligible: Number(row[16]),

		player1EligibleCribCount: Number(row[17]),
		player2EligibleCribCount: Number(row[18]),

		player1PeggingPointsTotal: Number(row[19]),
		player2PeggingPointsTotal: Number(row[20]),

		playedDate: String(row[21]),
		playedTime: String(row[22]),
	}));
}

export function listHandsForStatistics(
	db: Database,
): HandStatisticsRecord[] {
	const result = db.exec(`
		SELECT
			h.id,
			h.game_id,

			g.played_date,
			g.played_time,

			h.hand_number,

			CASE
				WHEN h.hand_number = (
					SELECT MAX(h2.hand_number)
					FROM hands h2
					WHERE h2.game_id = h.game_id
				)
				THEN 1
				ELSE 0
			END,

			g.player_1,
			g.player_2,

			g.first_dealer,

			h.player_1_hand_points,
			h.player_2_hand_points,

			h.crib_points,

			h.player_1_hand_eligibility_override,
			h.player_2_hand_eligibility_override,
			h.crib_eligibility_override,

			g.hand_data_incomplete

		FROM hands h

		INNER JOIN games g
			ON g.id = h.game_id

		ORDER BY
			g.played_date ASC,
			g.played_time ASC,
			h.hand_number ASC;
	`);

	const rows = result[0]?.values ?? [];

	return rows.flatMap((row) => {
		const firstDealer =
			row[8] === 1
				? 1
				: row[8] === 2
					? 2
					: null;

		/*
		 * Hands should only exist when the
		 * first dealer is known.
		 */
		if (firstDealer === null) {
			return [];
		}

		return [
			{
				id: String(row[0]),

				gameId: String(row[1]),

				playedDate: String(row[2]),
				playedTime: String(row[3]),

				handNumber: Number(row[4]),

				isLastHand: row[5] === 1,

				player1: String(row[6] ?? ''),
				player2: String(row[7] ?? ''),

				firstDealer,

				player1HandPoints:
					typeof row[9] === 'number'
						? row[9]
						: null,

				player2HandPoints:
					typeof row[10] === 'number'
						? row[10]
						: null,

				cribPoints:
					typeof row[11] === 'number'
						? row[11]
						: null,

				player1HandEligibilityOverride:
					row[12] === null
						? null
						: row[12] === 1,

				player2HandEligibilityOverride:
					row[13] === null
						? null
						: row[13] === 1,

				cribEligibilityOverride:
					row[14] === null
						? null
						: row[14] === 1,

				handDataIncomplete: row[15] === 1,
			},
		];
	});
}