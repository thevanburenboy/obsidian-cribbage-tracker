import type { CribbageTrackerPluginContext } from '../plugin-context';

import { renderCsvImporter } from '../csv-import/csv-import';

import { renderNewGameForm } from './form-ui';

import { renderGamesTable } from './table-ui';

import type { GamesPageCallbacks, GamesPageState } from './types';

export type {
	GameSortColumn,
	GamesPageCallbacks,
	GamesPageState,
} from './types';

export function renderGamesPage(
	container: HTMLElement,
	plugin: CribbageTrackerPluginContext,
	state: GamesPageState,
	callbacks: GamesPageCallbacks,
): void {
	renderNewGameForm(container, plugin, callbacks.onChanged);

	if (plugin.settings.showCsvImporter) {
		renderCsvImporter(container, plugin, callbacks.onChanged);
	}

	renderGamesTable(container, plugin, state, callbacks);
}
