import type { CribbageTrackerPluginContext } from '../plugin-context';

import {
	renderGameSelector,
	renderGameHeader,
	renderTrackingSettings,
} from './overview-ui';

import { renderHands } from './table-ui';

export function renderHandsPage(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	selectedGameId: string | null,
	onSelectGame: (gameId: string) => void,
	onRefresh: () => void,
): void {
	const games = plugin.database.listGames();

	if (games.length === 0) {
		container.createEl('p', {
			text: 'No games recorded yet.',
			cls: 'cribbage-empty-state',
		});

		return;
	}

	const gameId = selectedGameId ?? games[0]?.id;

	if (!gameId) {
		return;
	}

	const game = games.find((item) => item.id === gameId) ?? games[0];

	if (!game) {
		return;
	}

	renderGameSelector(container, games, game.id, onSelectGame);

	renderGameHeader(container, game);

	renderTrackingSettings(container, plugin, game, onRefresh);

	renderHands(container, plugin, game, onRefresh);
}
