import {
	type Database,
	type SqlJsStatic,
} from 'sql.js';

import type {
	CustomMetricInput,
	CustomMetricRecord,
	CustomMetricSqlContext,
	CustomMetricSqlHandObservation,
	CustomMetricSqlObservation,
	CustomMetricSqlResult,
	SaveDatabase,
} from './types';

export function listCustomMetrics(
	db: Database,
): CustomMetricRecord[] {
	const result = db.exec(`
		SELECT
			id,
			name,
			data_source,
			calculation_mode,
			builder_formula,
			sql_query,
			format_mode,
			decimal_places,
			prefix,
			suffix,
			format_expression,
			show_global,
			show_player,
			show_matchup,
			matchup_mode,
			enabled,
			sort_order
		FROM custom_metrics
		ORDER BY
			sort_order ASC,
			name COLLATE NOCASE ASC;
	`);

	const rows = result[0]?.values ?? [];

	return rows.map((row) => ({
		id: String(row[0]),

		name: String(row[1] ?? ''),

		dataSource:
			row[2] === 'hands'
				? 'hands'
				: 'games',

		calculationMode:
			row[3] === 'sql'
				? 'sql'
				: 'builder',

		builderFormula: String(row[4] ?? ''),

		sqlQuery: String(row[5] ?? ''),

		formatMode:
			row[6] === 'integer'
				? 'integer'
				: row[6] === 'percentage'
					? 'percentage'
					: row[6] === 'custom'
						? 'custom'
						: 'decimal',

		decimalPlaces: Number(row[7]),

		prefix: String(row[8] ?? ''),

		suffix: String(row[9] ?? ''),

		formatExpression: String(row[10] ?? ''),

		showGlobal: row[11] === 1,

		showPlayer: row[12] === 1,

		showMatchup: row[13] === 1,

		matchupMode:
			row[14] === 'per_player'
				? 'per_player'
				: 'combined',

		enabled: row[15] === 1,

		sortOrder: Number(row[16]),
	}));
}

export async function createCustomMetric(
	db: Database,
	input: CustomMetricInput,
	save: SaveDatabase,
	createId: () => string,
): Promise<string> {
	const id = createId();

	db.run(
		`
		INSERT INTO custom_metrics (
			id,
			name,
			data_source,
			calculation_mode,
			builder_formula,
			sql_query,
			format_mode,
			decimal_places,
			prefix,
			suffix,
			format_expression,
			show_global,
			show_player,
			show_matchup,
			matchup_mode,
			enabled,
			sort_order
		)
		VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?
		);
		`,
		[
			id,
			input.name.trim(),

			input.dataSource,
			input.calculationMode,

			input.builderFormula,
			input.sqlQuery,

			input.formatMode,
			input.decimalPlaces,

			input.prefix,
			input.suffix,

			input.formatExpression,

			input.showGlobal ? 1 : 0,
			input.showPlayer ? 1 : 0,
			input.showMatchup ? 1 : 0,

			input.matchupMode,

			input.enabled ? 1 : 0,
			input.sortOrder,
		],
	);

	await save();

	return id;
}

export async function updateCustomMetric(
	db: Database,
	id: string,
	input: CustomMetricInput,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		`
		UPDATE custom_metrics
		SET
			name = ?,
			data_source = ?,
			calculation_mode = ?,
			builder_formula = ?,
			sql_query = ?,
			format_mode = ?,
			decimal_places = ?,
			prefix = ?,
			suffix = ?,
			format_expression = ?,
			show_global = ?,
			show_player = ?,
			show_matchup = ?,
			matchup_mode = ?,
			enabled = ?,
			sort_order = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?;
		`,
		[
			input.name.trim(),

			input.dataSource,
			input.calculationMode,

			input.builderFormula,
			input.sqlQuery,

			input.formatMode,
			input.decimalPlaces,

			input.prefix,
			input.suffix,

			input.formatExpression,

			input.showGlobal ? 1 : 0,
			input.showPlayer ? 1 : 0,
			input.showMatchup ? 1 : 0,

			input.matchupMode,

			input.enabled ? 1 : 0,
			input.sortOrder,

			id,
		],
	);

	await save();
}

export async function deleteCustomMetric(
	db: Database,
	id: string,
	save: SaveDatabase,
): Promise<void> {
	db.run(
		`
		DELETE FROM custom_metrics
		WHERE id = ?;
		`,
		[id],
	);

	await save();
}

export function evaluateCustomMetricSql(
	db: Database,
	sql: SqlJsStatic | null,
	query: string,
	observations: CustomMetricSqlObservation[],
	handObservations: CustomMetricSqlHandObservation[],
	context: CustomMetricSqlContext,
): CustomMetricSqlResult {
	if (!sql) {
		return {
			value: null,
			error: 'SQL.js is not initialized.',
		};
	}

	const exported = db.export();

	const clone = new sql.Database(
		new Uint8Array(exported),
	);

	try {
		clone.run(`
			CREATE TEMP TABLE metric_games (
				game_id TEXT NOT NULL,

				played_date TEXT NOT NULL,
				played_time TEXT NOT NULL,

				player TEXT NOT NULL,
				opponent TEXT NOT NULL,

				player_side INTEGER NOT NULL,

				score REAL,
				opponent_score REAL,

				margin REAL,
				score_differential REAL,

				won INTEGER,
				lost INTEGER,

				high_hand REAL,
				opponent_high_hand REAL,
				higher_high_hand INTEGER,

				dealer_first INTEGER,
				pone_first INTEGER,

				skunk INTEGER,
				double_skunk INTEGER,

				hand_data_complete INTEGER
					NOT NULL
			);
		`);

		clone.run(`
			CREATE TEMP TABLE metric_context (
				scope TEXT NOT NULL,

				selected_player TEXT,

				matchup_player_1 TEXT,
				matchup_player_2 TEXT,

				subject_player TEXT
			);
		`);

		clone.run(
			`
			INSERT INTO metric_context (
				scope,
				selected_player,
				matchup_player_1,
				matchup_player_2,
				subject_player
			)
			VALUES (?, ?, ?, ?, ?);
			`,
			[
				context.scope,
				context.selectedPlayer,
				context.matchupPlayer1,
				context.matchupPlayer2,
				context.subjectPlayer,
			],
		);

		const insert = clone.prepare(`
			INSERT INTO metric_games (
				game_id,

				played_date,
				played_time,

				player,
				opponent,

				player_side,

				score,
				opponent_score,

				margin,
				score_differential,

				won,
				lost,

				high_hand,
				opponent_high_hand,
				higher_high_hand,

				dealer_first,
				pone_first,

				skunk,
				double_skunk,

				hand_data_complete
			)
			VALUES (
				?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?,
				?, ?
			);
		`);

		try {
			for (const observation of observations) {
				insert.run([
					observation.gameId,

					observation.playedDate,
					observation.playedTime,

					observation.player,
					observation.opponent,

					observation.playerSide,

					observation.score,
					observation.opponentScore,

					observation.margin,
					observation.scoreDifferential,

					observation.won,
					observation.lost,

					observation.highHand,
					observation.opponentHighHand,
					observation.higherHighHand,

					observation.dealerFirst,
					observation.poneFirst,

					observation.skunk,
					observation.doubleSkunk,

					observation.handDataComplete,
				]);
			}
		} finally {
			insert.free();
		}

		clone.run(`
			CREATE TEMP TABLE metric_hands (
				game_id TEXT NOT NULL,
				hand_id TEXT NOT NULL,

				played_date TEXT NOT NULL,
				played_time TEXT NOT NULL,

				player TEXT NOT NULL,
				opponent TEXT NOT NULL,

				player_side INTEGER NOT NULL,

				hand_number INTEGER NOT NULL,

				hand_points REAL,
				opponent_hand_points REAL,

				crib_points REAL,
				round_crib_points REAL,

				dealer INTEGER NOT NULL,
				pone INTEGER NOT NULL,

				last_hand INTEGER NOT NULL,
				eligible_hand INTEGER NOT NULL,

				hand_data_complete INTEGER NOT NULL
			);
		`);

		const handInsert = clone.prepare(`
			INSERT INTO metric_hands (
				game_id,
				hand_id,

				played_date,
				played_time,

				player,
				opponent,

				player_side,

				hand_number,

				hand_points,
				opponent_hand_points,

				crib_points,
				round_crib_points,

				dealer,
				pone,

				last_hand,
				eligible_hand,

				hand_data_complete
			)
			VALUES (
				?, ?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?
			);
		`);

		try {
			for (const observation of handObservations) {
				handInsert.run([
					observation.gameId,
					observation.handId,

					observation.playedDate,
					observation.playedTime,

					observation.player,
					observation.opponent,

					observation.playerSide,

					observation.handNumber,

					observation.handPoints,
					observation.opponentHandPoints,

					observation.cribPoints,
					observation.roundCribPoints,

					observation.dealer,
					observation.pone,

					observation.lastHand,
					observation.eligibleHand,

					observation.handDataComplete,
				]);
			}
		} finally {
			handInsert.free();
		}

		const statement = clone.prepare(query);

		try {
			if (!statement.step()) {
				return {
					value: null,
					error:
						'SQL query returned no rows. A custom metric must return exactly one row and one numeric column.',
				};
			}

			const columns = statement.getColumnNames();

			if (columns.length !== 1) {
				return {
					value: null,
					error:
						`SQL query returned ${columns.length} columns. A custom metric must return exactly one column.`,
				};
			}

			const row = statement.get();

			const raw = row[0] ?? null;

			if (statement.step()) {
				return {
					value: null,
					error:
						'SQL query returned more than one row. A custom metric must return exactly one row.',
				};
			}

			if (raw === null) {
				return {
					value: null,
					error: null,
				};
			}

			if (typeof raw !== 'number') {
				return {
					value: null,
					error:
						'SQL query did not return a numeric value.',
				};
			}

			if (!Number.isFinite(raw)) {
				return {
					value: null,
					error:
						'SQL query returned a non-finite number.',
				};
			}

			return {
				value: raw,
				error: null,
			};
		} finally {
			statement.free();
		}
	} catch (error) {
		return {
			value: null,
			error:
				error instanceof Error
					? error.message
					: 'Advanced SQL evaluation failed.',
		};
	} finally {
		clone.close();
	}
}