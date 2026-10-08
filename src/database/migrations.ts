import type { Database } from 'sql.js';

import type { SaveDatabase } from './types';

export const CURRENT_SCHEMA_VERSION = 6;

export async function migrateDatabase(
	db: Database,
	save: SaveDatabase,
): Promise<void> {
	let version = getSchemaVersion(db);

	const originalVersion = version;

	if (version > CURRENT_SCHEMA_VERSION) {
		throw new Error(
			`Database schema ${version} is newer than this plugin supports (${CURRENT_SCHEMA_VERSION}).`,
		);
	}

	if (version < 1) {
		db.run('BEGIN;');

		try {
			db.run('DROP TABLE IF EXISTS test;');

			db.run(`
				CREATE TABLE games (
					id TEXT PRIMARY KEY NOT NULL,

					played_date TEXT NOT NULL,
					played_time TEXT NOT NULL,

					player_1 TEXT,
					player_2 TEXT,
					first_dealer INTEGER
						CHECK (first_dealer IN (1, 2)),

					player_1_score INTEGER
						CHECK (player_1_score >= 0),
					player_2_score INTEGER
						CHECK (player_2_score >= 0),

					player_1_hand_points_total INTEGER NOT NULL DEFAULT 0,
					player_2_hand_points_total INTEGER NOT NULL DEFAULT 0,

					player_1_hand_points_eligible INTEGER NOT NULL DEFAULT 0,
					player_2_hand_points_eligible INTEGER NOT NULL DEFAULT 0,

					player_1_crib_points_total INTEGER NOT NULL DEFAULT 0,
					player_2_crib_points_total INTEGER NOT NULL DEFAULT 0,

					player_1_crib_points_eligible INTEGER NOT NULL DEFAULT 0,
					player_2_crib_points_eligible INTEGER NOT NULL DEFAULT 0,

					round_count INTEGER NOT NULL DEFAULT 0,
					eligible_round_count INTEGER NOT NULL DEFAULT 0,

					player_1_crib_count INTEGER NOT NULL DEFAULT 0,
					player_2_crib_count INTEGER NOT NULL DEFAULT 0,

					player_1_eligible_crib_count INTEGER NOT NULL DEFAULT 0,
					player_2_eligible_crib_count INTEGER NOT NULL DEFAULT 0,

					player_1_pegging_points_total INTEGER NOT NULL DEFAULT 0,
					player_2_pegging_points_total INTEGER NOT NULL DEFAULT 0,

					player_1_high_hand INTEGER,
					player_2_high_hand INTEGER,

					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
			`);

			db.run(`
				CREATE TABLE hands (
					id TEXT PRIMARY KEY NOT NULL,
					game_id TEXT NOT NULL,
					hand_number INTEGER NOT NULL
						CHECK (hand_number >= 1),

					player_1_hand_points INTEGER
						CHECK (player_1_hand_points >= 0),
					player_2_hand_points INTEGER
						CHECK (player_2_hand_points >= 0),
					crib_points INTEGER
						CHECK (crib_points >= 0),

					FOREIGN KEY (game_id)
						REFERENCES games(id)
						ON DELETE CASCADE,

					UNIQUE (game_id, hand_number)
				);
			`);

			db.run(`
				CREATE INDEX idx_games_played
				ON games (played_date, played_time);
			`);

			db.run(`
				CREATE INDEX idx_games_player_1
				ON games (player_1);
			`);

			db.run(`
				CREATE INDEX idx_games_player_2
				ON games (player_2);
			`);

			db.run(`
				CREATE INDEX idx_hands_game
				ON hands (game_id, hand_number);
			`);

			db.run('PRAGMA user_version = 1;');
			db.run('COMMIT;');

			version = 1;
		} catch (error) {
			db.run('ROLLBACK;');
			throw error;
		}
	}

	if (version < 2) {
		db.run('BEGIN;');

		try {
			db.run(`
				ALTER TABLE games
				ADD COLUMN player_1_high_hand_manual INTEGER
					CHECK (
						player_1_high_hand_manual IS NULL
						OR player_1_high_hand_manual >= 0
					);
			`);

			db.run(`
				ALTER TABLE games
				ADD COLUMN player_2_high_hand_manual INTEGER
					CHECK (
						player_2_high_hand_manual IS NULL
						OR player_2_high_hand_manual >= 0
					);
			`);

			db.run('PRAGMA user_version = 2;');
			db.run('COMMIT;');

			version = 2;
		} catch (error) {
			db.run('ROLLBACK;');
			throw error;
		}
	}

	if (version < 3) {
		db.run('BEGIN;');

		try {
			db.run(`
				ALTER TABLE games
				ADD COLUMN hand_data_incomplete INTEGER
					NOT NULL DEFAULT 0
					CHECK (
						hand_data_incomplete IN (0, 1)
					);
			`);

			/*
			 * Existing games with no hand rows are historical/
			 * untracked games, so mark them incomplete.
			 */
			db.run(`
				UPDATE games
				SET hand_data_incomplete = 1
				WHERE NOT EXISTS (
					SELECT 1
					FROM hands
					WHERE hands.game_id = games.id
				);
			`);

			db.run('PRAGMA user_version = 3;');
			db.run('COMMIT;');

			version = 3;
		} catch (error) {
			db.run('ROLLBACK;');
			throw error;
		}
	}

	if (version < 4) {
		db.run('BEGIN;');

		try {
			db.run(`
				CREATE TABLE custom_metrics (
					id TEXT PRIMARY KEY NOT NULL,

					name TEXT NOT NULL,

					data_source TEXT NOT NULL
						DEFAULT 'games'
						CHECK (
							data_source IN (
								'games',
								'hands'
							)
						),

					calculation_mode TEXT NOT NULL
						DEFAULT 'builder'
						CHECK (
							calculation_mode IN (
								'builder',
								'sql'
							)
						),

					builder_formula TEXT,
					sql_query TEXT,

					format_mode TEXT NOT NULL
						DEFAULT 'decimal'
						CHECK (
							format_mode IN (
								'integer',
								'decimal',
								'percentage',
								'custom'
							)
						),

					decimal_places INTEGER NOT NULL
						DEFAULT 2
						CHECK (
							decimal_places >= 0
							AND decimal_places <= 12
						),

					prefix TEXT NOT NULL DEFAULT '',
					suffix TEXT NOT NULL DEFAULT '',

					format_expression TEXT,

					show_global INTEGER NOT NULL
						DEFAULT 1
						CHECK (
							show_global IN (0, 1)
						),

					show_player INTEGER NOT NULL
						DEFAULT 1
						CHECK (
							show_player IN (0, 1)
						),

					show_matchup INTEGER NOT NULL
						DEFAULT 1
						CHECK (
							show_matchup IN (0, 1)
						),

					matchup_mode TEXT NOT NULL
						DEFAULT 'combined'
						CHECK (
							matchup_mode IN (
								'combined',
								'per_player'
							)
						),

					enabled INTEGER NOT NULL
						DEFAULT 1
						CHECK (
							enabled IN (0, 1)
						),

					sort_order INTEGER NOT NULL
						DEFAULT 0,

					created_at TEXT NOT NULL
						DEFAULT CURRENT_TIMESTAMP,

					updated_at TEXT NOT NULL
						DEFAULT CURRENT_TIMESTAMP
				);
			`);

			db.run(`
				CREATE INDEX
					idx_custom_metrics_sort
				ON custom_metrics (
					enabled DESC,
					sort_order ASC,
					name COLLATE NOCASE ASC
				);
			`);

			db.run('PRAGMA user_version = 4;');
			db.run('COMMIT;');

			version = 4;
		} catch (error) {
			db.run('ROLLBACK;');
			throw error;
		}
	}

	if (version < 5) {
		db.run('BEGIN;');

		try {
			db.run(`
				ALTER TABLE hands
				ADD COLUMN player_1_hand_eligibility_override INTEGER
					CHECK (
						player_1_hand_eligibility_override IS NULL
						OR player_1_hand_eligibility_override IN (0, 1)
					);
			`);

			db.run(`
				ALTER TABLE hands
				ADD COLUMN player_2_hand_eligibility_override INTEGER
					CHECK (
						player_2_hand_eligibility_override IS NULL
						OR player_2_hand_eligibility_override IN (0, 1)
					);
			`);

			db.run(`
				ALTER TABLE hands
				ADD COLUMN crib_eligibility_override INTEGER
					CHECK (
						crib_eligibility_override IS NULL
						OR crib_eligibility_override IN (0, 1)
					);
			`);

			db.run('PRAGMA user_version = 5;');
			db.run('COMMIT;');

			version = 5;
		} catch (error) {
			db.run('ROLLBACK;');
			throw error;
		}
	}

	if (version < 6) {
		db.run(`
			ALTER TABLE games
			ADD COLUMN player_1_eligible_hand_count
			INTEGER NOT NULL DEFAULT 0;
		`);

		db.run(`
			ALTER TABLE games
			ADD COLUMN player_2_eligible_hand_count
			INTEGER NOT NULL DEFAULT 0;
		`);

		db.run(`
			PRAGMA user_version = 6;
		`);

		version = 6;
	}

	if (version !== originalVersion) {
		await save();
	}
}

function getSchemaVersion(
	db: Database,
): number {
	const result = db.exec(
		'PRAGMA user_version;',
	);

	const value = result[0]?.values[0]?.[0];

	return typeof value === 'number'
		? value
		: 0;
}