import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm';

import { normalizePath } from 'obsidian';

import type { CribbageTrackerPluginContext } from '../plugin-context';

import { migrateDatabase } from './migrations';

import {
	getGameCount,
	getPlayerNames,
	listGames,
	createGame,
	createGames,
	updateGame,
	deleteGame,
	setHandDataIncomplete,
	setManualHighHands,
	recalculateAllGameAggregates,
} from './games';

import {
	listHands,
	addHand,
	updateHand,
	deleteHand,
	getEffectiveHandEligibility,
	updateHandEligibilityOverrides,
} from './hands';

import {
	listCustomMetrics,
	createCustomMetric,
	updateCustomMetric,
	deleteCustomMetric,
	evaluateCustomMetricSql,
} from './custom-metrics';

import {
	getGameHandSummary,
	listGamesForStatistics,
	listHandsForStatistics,
} from './statistics';

import {
	type CustomMetricInput,
	type CustomMetricRecord,
	type CustomMetricSqlContext,
	type CustomMetricSqlHandObservation,
	type CustomMetricSqlObservation,
	type CustomMetricSqlResult,
	type GameHandSummary,
	type GameInput,
	type GameRecord,
	type GameStatisticsRecord,
	type HandInput,
	type HandRecord,
	type HandStatisticsRecord,
} from './types';

export type {
	CustomMetricCalculationMode,
	CustomMetricDataSource,
	CustomMetricFormatMode,
	CustomMetricInput,
	CustomMetricMatchupMode,
	CustomMetricRecord,
	CustomMetricSqlContext,
	CustomMetricSqlHandObservation,
	CustomMetricSqlObservation,
	CustomMetricSqlResult,
	GameHandSummary,
	GameInput,
	GameRecord,
	GameStatisticsRecord,
	HandInput,
	HandRecord,
	HandStatisticsRecord,
} from './types';

export class CribbageDatabase {
	private sql: SqlJsStatic | null = null;
	private db: Database | null = null;

	constructor(private plugin: CribbageTrackerPluginContext) {}

	async load(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
		}

		const sql = await initSqlJs({
			wasmBinary: new Uint8Array(sqlWasmBinary).buffer,
		});

		this.sql = sql;

		const path = this.getDatabasePath();

		if (await this.plugin.app.vault.adapter.exists(path)) {
			const data = await this.plugin.app.vault.adapter.readBinary(path);

			this.db = new sql.Database(new Uint8Array(data));
		} else {
			this.db = new sql.Database();
		}

		this.db.run('PRAGMA foreign_keys = ON;');

		await migrateDatabase(this.db, () => this.save());
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

		await this.plugin.app.vault.adapter.writeBinary(path, buffer);
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
		return getGameCount(this.requireDb());
	}

	getPlayerNames(): string[] {
		return getPlayerNames(this.requireDb());
	}

	listGames(): GameRecord[] {
		return listGames(this.requireDb());
	}

	async createGame(input: GameInput): Promise<string> {
		return createGame(
			this.requireDb(),
			input,
			() => this.save(),
			() => this.createId(),
		);
	}

	async createGames(inputs: GameInput[]): Promise<number> {
		return createGames(
			this.requireDb(),
			inputs,
			() => this.save(),
			() => this.createId(),
		);
	}

	async updateGame(id: string, input: GameInput): Promise<void> {
		return updateGame(this.requireDb(), id, input, () => this.save());
	}

	async deleteGame(id: string): Promise<void> {
		return deleteGame(this.requireDb(), id, () => this.save());
	}

	listHands(gameId: string): HandRecord[] {
		return listHands(this.requireDb(), gameId);
	}

	async addHand(gameId: string, input: HandInput): Promise<string> {
		return addHand(
			this.requireDb(),
			gameId,
			input,
			() => this.save(),
			() => this.createId(),
		);
	}

	async updateHand(id: string, input: HandInput): Promise<void> {
		return updateHand(this.requireDb(), id, input, () => this.save());
	}

	async deleteHand(id: string): Promise<void> {
		return deleteHand(this.requireDb(), id, () => this.save());
	}

	async setHandDataIncomplete(
		gameId: string,
		incomplete: boolean,
	): Promise<void> {
		return setHandDataIncomplete(this.requireDb(), gameId, incomplete, () =>
			this.save(),
		);
	}

	async setManualHighHands(
		gameId: string,
		player1High: number | null,
		player2High: number | null,
	): Promise<void> {
		return setManualHighHands(
			this.requireDb(),
			gameId,
			player1High,
			player2High,
			() => this.save(),
		);
	}

	listCustomMetrics(): CustomMetricRecord[] {
		return listCustomMetrics(this.requireDb());
	}

	async createCustomMetric(input: CustomMetricInput): Promise<string> {
		return createCustomMetric(
			this.requireDb(),
			input,
			() => this.save(),
			() => this.createId(),
		);
	}

	async updateCustomMetric(
		id: string,
		input: CustomMetricInput,
	): Promise<void> {
		return updateCustomMetric(this.requireDb(), id, input, () =>
			this.save(),
		);
	}

	async deleteCustomMetric(id: string): Promise<void> {
		return deleteCustomMetric(this.requireDb(), id, () => this.save());
	}

	evaluateCustomMetricSql(
		query: string,
		observations: CustomMetricSqlObservation[],
		handObservations: CustomMetricSqlHandObservation[],
		context: CustomMetricSqlContext,
	): CustomMetricSqlResult {
		return evaluateCustomMetricSql(
			this.requireDb(),
			this.sql,
			query,
			observations,
			handObservations,
			context,
		);
	}

	getGameHandSummary(gameId: string): GameHandSummary {
		return getGameHandSummary(this.requireDb(), gameId);
	}

	listGamesForStatistics(): GameStatisticsRecord[] {
		return listGamesForStatistics(this.requireDb());
	}

	listHandsForStatistics(): HandStatisticsRecord[] {
		return listHandsForStatistics(this.requireDb());
	}

	public recalculateAllGameAggregates(): void {
		recalculateAllGameAggregates(this.requireDb());
	}

	public getEffectiveHandEligibility(hand: HandRecord): {
		player1HandEligible: boolean;
		player2HandEligible: boolean;
		cribEligible: boolean;
	} {
		return getEffectiveHandEligibility(this.requireDb(), hand);
	}

	public async updateHandEligibilityOverrides(
		id: string,
		player1HandEligibilityOverride: boolean | null,
		player2HandEligibilityOverride: boolean | null,
		cribEligibilityOverride: boolean | null,
	): Promise<void> {
		return updateHandEligibilityOverrides(
			this.requireDb(),
			id,
			player1HandEligibilityOverride,
			player2HandEligibilityOverride,
			cribEligibilityOverride,
			() => this.save(),
		);
	}

	private requireDb(): Database {
		if (!this.db) {
			throw new Error('Database has not been loaded.');
		}

		return this.db;
	}

	private getDatabasePath(): string {
		const raw = this.plugin.settings.databasePath.trim();

		if (!raw) {
			throw new Error('Database path cannot be empty.');
		}

		const withoutLeadingSlash = raw.replace(/^\/+/, '');

		if (withoutLeadingSlash.split('/').some((part) => part === '..')) {
			throw new Error('Database path must remain inside the vault.');
		}

		return normalizePath(withoutLeadingSlash);
	}

	private async ensureParentFolders(filePath: string): Promise<void> {
		const parts = filePath.split('/').slice(0, -1);

		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;

			if (!(await this.plugin.app.vault.adapter.exists(current))) {
				await this.plugin.app.vault.createFolder(current);
			}
		}
	}

	private createId(): string {
		if (typeof window.crypto?.randomUUID === 'function') {
			return window.crypto.randomUUID();
		}

		return [
			Date.now().toString(36),
			Math.random().toString(36).slice(2),
			Math.random().toString(36).slice(2),
		].join('-');
	}
}
