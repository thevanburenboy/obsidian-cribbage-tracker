import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { normalizePath } from 'obsidian';
import type CribbageTrackerPlugin from './main';

const CURRENT_SCHEMA_VERSION = 3;

export interface GameRecord {
	id: string;
	playedDate: string;
	playedTime: string;
	player1: string;
	player2: string;
	firstDealer: 1 | 2 | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHandManual: number | null;
	player2HighHandManual: number | null;
	handDataIncomplete: boolean;
}

export interface GameInput {
	playedDate: string;
	playedTime: string;
	player1: string;
	player2: string;
	firstDealer: 1 | 2 | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHandManual: number | null;
	player2HighHandManual: number | null;
	handDataIncomplete?: boolean;
}

export interface HandRecord {
	id: string;
	gameId: string;
	handNumber: number;
	dealer: 1 | 2 | null;
	player1HandPoints: number | null;
	player2HandPoints: number | null;
	cribPoints: number | null;
	isLastHand: boolean;
}

export interface GameHandSummary {
	roundCount: number;
	eligibleRoundCount: number;

	player1HandPointsTotal: number;
	player2HandPointsTotal: number;

	player1HandPointsEligible: number;
	player2HandPointsEligible: number;

	player1CribPointsTotal: number;
	player2CribPointsTotal: number;

	player1CribPointsEligible: number;
	player2CribPointsEligible: number;

	player1CribCount: number;
	player2CribCount: number;

	player1EligibleCribCount: number;
	player2EligibleCribCount: number;

    player1PeggingPointsTotal: number;
    player2PeggingPointsTotal: number;

	player1HighHandCalculated: number | null;
	player2HighHandCalculated: number | null;
}

export interface GameStatisticsRecord {
	id: string;
    playedDate: string;
    playedTime: string;

	player1: string;
	player2: string;

	firstDealer: 1 | 2 | null;

	player1Score: number | null;
	player2Score: number | null;

	player1HighHandManual: number | null;
	player2HighHandManual: number | null;

	player1HighHandCalculated: number | null;
	player2HighHandCalculated: number | null;

	handDataIncomplete: boolean;

	roundCount: number;
	eligibleRoundCount: number;

	player1HandPointsEligible: number;
	player2HandPointsEligible: number;

	player1CribPointsEligible: number;
	player2CribPointsEligible: number;

	player1EligibleCribCount: number;
	player2EligibleCribCount: number;

	player1PeggingPointsTotal: number;
	player2PeggingPointsTotal: number;
}

export interface HandInput {
	player1HandPoints: number | null;
	player2HandPoints: number | null;
	cribPoints: number | null;
}

export class CribbageDatabase {
	private sql: SqlJsStatic | null = null;
	private db: Database | null = null;

	constructor(private plugin: CribbageTrackerPlugin) {}

	async load(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
		}

		const pluginDir = this.plugin.manifest.dir;

		if (!pluginDir) {
			throw new Error('Could not determine the plugin directory.');
		}

		const wasmPath = `${pluginDir}/sql-wasm.wasm`;
		const wasmBinary =
			await this.plugin.app.vault.adapter.readBinary(wasmPath);

		this.sql = await initSqlJs({
			wasmBinary,
		});

		const path = this.getDatabasePath();

		if (await this.plugin.app.vault.adapter.exists(path)) {
			const data =
				await this.plugin.app.vault.adapter.readBinary(path);

			this.db = new this.sql.Database(
				new Uint8Array(data),
			);
		} else {
			this.db = new this.sql.Database();
		}

		this.db.run('PRAGMA foreign_keys = ON;');

		await this.migrate();
	}

	async save(): Promise<void> {
		const db = this.requireDb();
		const path = this.getDatabasePath();

		await this.ensureParentFolders(path);

		const data = db.export();

		const buffer = data.buffer.slice(
			data.byteOffset,
			data.byteOffset + data.byteLength,
		) as ArrayBuffer;

		await this.plugin.app.vault.adapter.writeBinary(
			path,
			buffer,
		);
	}

	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}

	getSchemaVersion(): number {
		const db = this.requireDb();

		const result = db.exec('PRAGMA user_version;');
		const value = result[0]?.values[0]?.[0];

		return typeof value === 'number' ? value : 0;
	}

	getGameCount(): number {
		const db = this.requireDb();

		const result = db.exec(
			'SELECT COUNT(*) FROM games;',
		);

		const value = result[0]?.values[0]?.[0];

		return typeof value === 'number' ? value : 0;
	}

	getPlayerNames(): string[] {
		const db = this.requireDb();

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

	listGames(): GameRecord[] {
		const db = this.requireDb();

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

            handDataIncomplete:
                row[10] === 1,
        }));
	}

	async createGame(input: GameInput): Promise<string> {
		const db = this.requireDb();
		const id = this.createId();

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

		await this.save();

		return id;
	}

    async createGames(
        inputs: GameInput[],
    ): Promise<number> {
        if (inputs.length === 0) {
            return 0;
        }

        const db = this.requireDb();

        db.run('BEGIN;');

        try {
            for (const input of inputs) {
                const id = this.createId();

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

        await this.save();

        return inputs.length;
    }

	async updateGame(
		id: string,
		input: GameInput,
	): Promise<void> {
		const db = this.requireDb();

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
		await this.save();
	}

	async deleteGame(id: string): Promise<void> {
		const db = this.requireDb();

		db.run(
			'DELETE FROM games WHERE id = ?;',
			[id],
		);

		await this.save();
	}

    listHands(gameId: string): HandRecord[] {
        const db = this.requireDb();

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
                crib_points
            FROM hands
            WHERE game_id = ?
            ORDER BY hand_number ASC;
            `,
            [gameId],
        );

        const rows = result[0]?.values ?? [];

        const lastHandNumber =
            rows.length > 0
                ? Number(
                        rows[
                            rows.length - 1
                        ]?.[2],
                    )
                : null;

        return rows.map((row) => {
            const handNumber =
                Number(row[2]);

            return {
                id: String(row[0]),
                gameId: String(row[1]),
                handNumber,

                dealer:
                    firstDealer === null
                        ? null
                        : this.getDealerForHand(
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

                isLastHand:
                    handNumber ===
                    lastHandNumber,
            };
        });
    }

    async addHand(
        gameId: string,
        input: HandInput,
    ): Promise<string> {
        const db = this.requireDb();

        const gameResult = db.exec(
            `
            SELECT first_dealer
            FROM games
            WHERE id = ?;
            `,
            [gameId],
        );

        const gameRow =
            gameResult[0]?.values[0];

        if (!gameRow) {
            throw new Error('Game not found.');
        }

        if (
            gameRow[0] !== 1 &&
            gameRow[0] !== 2
        ) {
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

        const handNumber =
            Number(
                numberResult[0]?.values[0]?.[0] ??
                    1,
            );

        const id = this.createId();

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
                    crib_points
                )
                VALUES (?, ?, ?, ?, ?, ?);
                `,
                [
                    id,
                    gameId,
                    handNumber,
                    input.player1HandPoints,
                    input.player2HandPoints,
                    input.cribPoints,
                ],
            );

            this.recalculateGameAggregates(
                gameId,
            );

            db.run('COMMIT;');
        } catch (error) {
            db.run('ROLLBACK;');
            throw error;
        }

        await this.save();

        return id;
    }

    async updateHand(
        id: string,
        input: HandInput,
    ): Promise<void> {
        const db = this.requireDb();

        const result = db.exec(
            `
            SELECT game_id
            FROM hands
            WHERE id = ?;
            `,
            [id],
        );

        const gameId =
            result[0]?.values[0]?.[0];

        if (typeof gameId !== 'string') {
            throw new Error('Hand not found.');
        }

        db.run('BEGIN;');

        try {
            db.run(
                `
                UPDATE hands
                SET
                    player_1_hand_points = ?,
                    player_2_hand_points = ?,
                    crib_points = ?
                WHERE id = ?;
                `,
                [
                    input.player1HandPoints,
                    input.player2HandPoints,
                    input.cribPoints,
                    id,
                ],
            );

            this.recalculateGameAggregates(
                gameId,
            );

            db.run('COMMIT;');
        } catch (error) {
            db.run('ROLLBACK;');
            throw error;
        }

        await this.save();
    }

    async deleteHand(id: string): Promise<void> {
        const db = this.requireDb();

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

        const row =
            result[0]?.values[0];

        if (!row) {
            throw new Error('Hand not found.');
        }

        const gameId =
            String(row[0]);

        const handNumber =
            Number(row[1]);

        db.run('BEGIN;');

        try {
            db.run(
                `
                DELETE FROM hands
                WHERE id = ?;
                `,
                [id],
            );

            /*
            * Renumber later hands while avoiding the
            * UNIQUE(game_id, hand_number) constraint.
            *
            * Example:
            * 1, 2, 3, 4
            * delete 2
            *
            * temporary:
            * 1, -3, -4
            *
            * final:
            * 1, 2, 3
            */
            db.run(
                `
                UPDATE hands
                SET hand_number = -hand_number
                WHERE
                    game_id = ?
                    AND hand_number > ?;
                `,
                [
                    gameId,
                    handNumber,
                ],
            );

            db.run(
                `
                UPDATE hands
                SET hand_number =
                    -hand_number - 1
                WHERE
                    game_id = ?
                    AND hand_number < ?;
                `,
                [
                    gameId,
                    -handNumber,
                ],
            );

            this.recalculateGameAggregates(
                gameId,
            );

            db.run('COMMIT;');
        } catch (error) {
            db.run('ROLLBACK;');
            throw error;
        }

        await this.save();
    }

    async setHandDataIncomplete(
        gameId: string,
        incomplete: boolean,
    ): Promise<void> {
        const db = this.requireDb();

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

        await this.save();
    }

    async setManualHighHands(
        gameId: string,
        player1High: number | null,
        player2High: number | null,
    ): Promise<void> {
        const db = this.requireDb();

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

        await this.save();
    }

    getGameHandSummary(
        gameId: string,
    ): GameHandSummary {
        const db = this.requireDb();

        const result = db.exec(
            `
            SELECT
                round_count,
                eligible_round_count,

                player_1_hand_points_total,
                player_2_hand_points_total,

                player_1_hand_points_eligible,
                player_2_hand_points_eligible,

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

            player1CribPointsTotal: Number(row[6]),
            player2CribPointsTotal: Number(row[7]),

            player1CribPointsEligible: Number(row[8]),
            player2CribPointsEligible: Number(row[9]),

            player1CribCount: Number(row[10]),
            player2CribCount: Number(row[11]),

            player1EligibleCribCount:
                Number(row[12]),

            player2EligibleCribCount:
                Number(row[13]),

            player1PeggingPointsTotal:
                Number(row[14]),

            player2PeggingPointsTotal:
                Number(row[15]),

            player1HighHandCalculated:
                typeof row[16] === 'number'
                    ? row[16]
                    : null,

            player2HighHandCalculated:
                typeof row[17] === 'number'
                    ? row[17]
                    : null,
        };
    }

    listGamesForStatistics(): GameStatisticsRecord[] {
        const db = this.requireDb();

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

        const rows =
            result[0]?.values ?? [];

        return rows.map((row) => ({
            id: String(row[0]),

            player1:
                String(row[1] ?? ''),

            player2:
                String(row[2] ?? ''),

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

            handDataIncomplete:
                row[10] === 1,

            roundCount:
                Number(row[11]),

            eligibleRoundCount:
                Number(row[12]),

            player1HandPointsEligible:
                Number(row[13]),

            player2HandPointsEligible:
                Number(row[14]),

            player1CribPointsEligible:
                Number(row[15]),

            player2CribPointsEligible:
                Number(row[16]),

            player1EligibleCribCount:
                Number(row[17]),

            player2EligibleCribCount:
                Number(row[18]),

            player1PeggingPointsTotal:
                Number(row[19]),

            player2PeggingPointsTotal:
                Number(row[20]),

            playedDate:
                String(row[21]),

            playedTime:
                String(row[22]),
        }));
    }

    private recalculateGameAggregates(
        gameId: string,
    ): void {
        const db = this.requireDb();

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

        const firstDealerValue =
            gameResult[0]?.values[0]?.[0];

        const firstDealer: 1 | 2 | null =
            firstDealerValue === 1
                ? 1
                : firstDealerValue === 2
                    ? 2
                    : null;

        const player1ScoreValue =
            gameResult[0]?.values[0]?.[1];

        const player2ScoreValue =
            gameResult[0]?.values[0]?.[2];

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
                crib_points
            FROM hands
            WHERE game_id = ?
            ORDER BY hand_number ASC;
            `,
            [gameId],
        );

        const rows =
            result[0]?.values ?? [];

        if (rows.length === 0) {
            db.run(
                `
                UPDATE games
                SET
                    player_1_hand_points_total = 0,
                    player_2_hand_points_total = 0,

                    player_1_hand_points_eligible = 0,
                    player_2_hand_points_eligible = 0,

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

        const lastHandNumber =
            Number(
                rows[
                    rows.length - 1
                ]?.[0],
            );

        let player1HandTotal = 0;
        let player2HandTotal = 0;

        let player1HandEligible = 0;
        let player2HandEligible = 0;

        let player1CribTotal = 0;
        let player2CribTotal = 0;

        let player1CribEligible = 0;
        let player2CribEligible = 0;

        let player1CribCount = 0;
        let player2CribCount = 0;

        let player1EligibleCribCount = 0;
        let player2EligibleCribCount = 0;

        let player1HighHand:
            number | null = null;

        let player2HighHand:
            number | null = null;

        for (const row of rows) {
            const handNumber =
                Number(row[0]);

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

            const eligible =
                handNumber !==
                lastHandNumber;

            if (player1Points !== null) {
                player1HandTotal +=
                    player1Points;

                player1HighHand =
                    player1HighHand === null
                        ? player1Points
                        : Math.max(
                                player1HighHand,
                                player1Points,
                            );

                if (eligible) {
                    player1HandEligible +=
                        player1Points;
                }
            }

            if (player2Points !== null) {
                player2HandTotal +=
                    player2Points;

                player2HighHand =
                    player2HighHand === null
                        ? player2Points
                        : Math.max(
                                player2HighHand,
                                player2Points,
                            );

                if (eligible) {
                    player2HandEligible +=
                        player2Points;
                }
            }

            if (
                cribPoints !== null &&
                firstDealer !== null
            ) {
                const dealer =
                    this.getDealerForHand(
                        firstDealer,
                        handNumber,
                    );

                if (dealer === 1) {
                    player1CribTotal +=
                        cribPoints;

                    player1CribCount++;

                    if (eligible) {
                        player1CribEligible +=
                            cribPoints;

                        player1EligibleCribCount++;
                    }
                } else {
                    player2CribTotal +=
                        cribPoints;

                    player2CribCount++;

                    if (eligible) {
                        player2CribEligible +=
                            cribPoints;

                        player2EligibleCribCount++;
                    }
                }
            }
        }

        const player1PeggingPoints =
            player1Score === null
                ? 0
                : player1Score
                    - player1HandTotal
                    - player1CribTotal;

        const player2PeggingPoints =
            player2Score === null
                ? 0
                : player2Score
                    - player2HandTotal
                    - player2CribTotal;

        db.run(
            `
            UPDATE games
            SET
                player_1_hand_points_total = ?,
                player_2_hand_points_total = ?,

                player_1_hand_points_eligible = ?,
                player_2_hand_points_eligible = ?,

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

                player1CribTotal,
                player2CribTotal,

                player1CribEligible,
                player2CribEligible,

                rows.length,
                Math.max(
                    rows.length - 1,
                    0,
                ),

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

    private getDealerForHand(
        firstDealer: 1 | 2,
        handNumber: number,
    ): 1 | 2 {
        const firstDealerHand =
            handNumber % 2 === 1;

        if (firstDealerHand) {
            return firstDealer;
        }

        return firstDealer === 1
            ? 2
            : 1;
    }

    private async migrate(): Promise<void> {
        const db = this.requireDb();
        let version = this.getSchemaVersion();

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

        await this.save();

        console.log(
            `Cribbage Tracker database schema: ${version}`,
        );
    }

	private requireDb(): Database {
		if (!this.db) {
			throw new Error(
				'Database has not been loaded.',
			);
		}

		return this.db;
	}

	private getDatabasePath(): string {
		const raw =
			this.plugin.settings.databasePath.trim();

		if (!raw) {
			throw new Error(
				'Database path cannot be empty.',
			);
		}

		const withoutLeadingSlash =
			raw.replace(/^\/+/, '');

		if (
			withoutLeadingSlash
				.split('/')
				.some((part) => part === '..')
		) {
			throw new Error(
				'Database path must remain inside the vault.',
			);
		}

		return normalizePath(withoutLeadingSlash);
	}

	private async ensureParentFolders(
		filePath: string,
	): Promise<void> {
		const parts =
			filePath.split('/').slice(0, -1);

		let current = '';

		for (const part of parts) {
			current = current
				? `${current}/${part}`
				: part;

			if (
				!(await this.plugin.app.vault.adapter.exists(
					current,
				))
			) {
				await this.plugin.app.vault.createFolder(
					current,
				);
			}
		}
	}

	private createId(): string {
		if (
			typeof globalThis.crypto?.randomUUID ===
			'function'
		) {
			return globalThis.crypto.randomUUID();
		}

		return [
			Date.now().toString(36),
			Math.random().toString(36).slice(2),
			Math.random().toString(36).slice(2),
		].join('-');
	}
}