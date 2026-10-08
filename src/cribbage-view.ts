import { ItemView, WorkspaceLeaf } from 'obsidian';

import type { CribbageTrackerPluginContext } from './plugin-context';

import { renderGamesPage } from './games-ui/games-ui';

import type { GamesPageState } from './games-ui/games-ui';

import { renderHandsPage } from './hands-ui/hands-ui';

import { renderStatisticsPage } from './statistics/ui';

import { renderCustomMetricsPage } from './custom-metrics/ui';

import { renderLeaderboardPage } from './leaderboard/ui';

export const VIEW_TYPE_CRIBBAGE = 'cribbage-tracker-view';

export type CribbagePage =
	| 'games'
	| 'hands'
	| 'statistics'
	| 'leaderboard'
	| 'custom-metrics';

export class CribbageTrackerView extends ItemView {
	private activePage: CribbagePage = 'games';

	private selectedGameId: string | null = null;

	private gamesPageState: GamesPageState = {
		sortColumn: 'datetime',
		sortDirection: 'desc',
		editingGameId: null,
	};

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CribbageTrackerPluginContext,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CRIBBAGE;
	}

	getDisplayText(): string {
		return 'Cribbage tracker';
	}

	getIcon(): string {
		return 'dice-5';
	}

	async onOpen() {
		this.render();
	}

	async onClose() {}

	render(): void {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass('cribbage-tracker');

		this.renderHeader(contentEl);
		this.renderNavigation(contentEl);
		this.renderActivePage(contentEl);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv('cribbage-header');

		header.createEl('h1', {
			text: 'Cribbage tracker',
		});

		header.createDiv({
			text: `${this.plugin.database.getGameCount()} games`,
			cls: 'cribbage-game-count',
		});
	}

	private renderNavigation(container: HTMLElement): void {
		const navigation = container.createDiv('cribbage-navigation');

		this.createNavigationButton(navigation, 'Games', 'games');

		this.createNavigationButton(navigation, 'Hands', 'hands');

		this.createNavigationButton(navigation, 'Statistics', 'statistics');

		this.createNavigationButton(navigation, 'Leaderboard', 'leaderboard');

		this.createNavigationButton(
			navigation,
			'Custom Metrics',
			'custom-metrics',
		);
	}

	private createNavigationButton(
		container: HTMLElement,
		label: string,
		page: CribbagePage,
	): void {
		const button = container.createEl('button', {
			text: label,
		});

		if (this.activePage === page) {
			button.addClass('mod-cta');
		}

		button.addEventListener('click', () => {
			this.activePage = page;
			this.render();
		});
	}

	private renderActivePage(container: HTMLElement): void {
		switch (this.activePage) {
			case 'games':
				renderGamesPage(container, this.plugin, this.gamesPageState, {
					onChanged: () => {
						this.render();
					},

					onSortChanged: () => {
						this.render();
					},

					onOpenHands: (gameId) => {
						this.selectedGameId = gameId;

						this.activePage = 'hands';

						this.render();
					},

					onEdit: (gameId) => {
						this.gamesPageState.editingGameId = gameId;

						this.render();
					},

					onCancelEdit: () => {
						this.gamesPageState.editingGameId = null;

						this.render();
					},
				});

				break;

			case 'hands':
				renderHandsPage(
					container,
					this.plugin,
					this.selectedGameId,
					(gameId) => {
						this.selectedGameId = gameId;

						this.render();
					},
					() => {
						this.render();
					},
				);

				break;

			case 'statistics':
				renderStatisticsPage(container, this.plugin);

				break;

			case 'leaderboard':
				renderLeaderboardPage(container, this.plugin);

				break;

			case 'custom-metrics':
				renderCustomMetricsPage(container, this.plugin);

				break;
		}
	}
}
