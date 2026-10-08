import type { App } from 'obsidian';

import type { CribbageDatabase } from './database';

import type { CribbageTrackerSettings } from './settings';

export interface CribbageTrackerPluginContext {
	app: App;
	database: CribbageDatabase;
	settings: CribbageTrackerSettings;
}