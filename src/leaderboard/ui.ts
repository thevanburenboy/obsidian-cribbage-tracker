import type { CribbageTrackerPluginContext } from '../plugin-context';

import type {
	GameStatisticsRecord,
	HandStatisticsRecord,
} from '../database/database';

import { buildPlayerAggregates } from './aggregates';

import {
	renderGamePerformance,
	renderHandPerformance,
	renderOverallStandings,
	renderSituational,
} from './performance';

import { renderRecords } from './records-ui';

export function renderLeaderboardPage(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
): void {
	const games: GameStatisticsRecord[] =
		plugin.database.listGamesForStatistics();

	const hands: HandStatisticsRecord[] =
		plugin.database.listHandsForStatistics();

	const summaries = buildPlayerAggregates(games, hands);

	container.createEl('h2', {
		text: 'Leaderboard',
	});

	renderOverallStandings(container, summaries);

	renderGamePerformance(container, summaries, plugin);

	renderHandPerformance(container, summaries, plugin);

	renderSituational(container, summaries, plugin);

	renderRecords(container, games, hands);
}
