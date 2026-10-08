import { Plugin } from 'obsidian';

import { CribbageDatabase } from './database/database';

import {
	DEFAULT_SETTINGS,
	CribbageTrackerSettings,
	CribbageTrackerSettingTab,
} from './settings';

import { CribbageTrackerView, VIEW_TYPE_CRIBBAGE } from './cribbage-view';

export default class CribbageTrackerPlugin extends Plugin {
	settings!: CribbageTrackerSettings;

	database!: CribbageDatabase;

	async onload() {
		await this.loadSettings();

		this.database = new CribbageDatabase(this);

		await this.database.load();

		this.registerView(
			VIEW_TYPE_CRIBBAGE,
			(leaf) => new CribbageTrackerView(leaf, this),
		);

		this.addRibbonIcon('dice-5', 'Open cribbage tracker', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-cribbage-tracker',
			name: 'Open',
			callback: () => {
				void this.activateView();
			},
		});

		this.addSettingTab(new CribbageTrackerSettingTab(this.app, this));
	}

	onunload() {
		this.database?.close();
	}

	async loadSettings(): Promise<void> {
		const savedData =
			(await this.loadData()) as Partial<CribbageTrackerSettings>;

		this.settings = {
			...DEFAULT_SETTINGS,
			...savedData,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	refreshViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CRIBBAGE);

		for (const leaf of leaves) {
			const view = leaf.view;

			if (view instanceof CribbageTrackerView) {
				view.render();
			}
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CRIBBAGE)[0];

		if (!leaf) {
			leaf = workspace.getLeaf('tab');

			await leaf.setViewState({
				type: VIEW_TYPE_CRIBBAGE,
				active: true,
			});
		}

		await workspace.revealLeaf(leaf);
	}
}
