import { App, PluginSettingTab, Setting } from 'obsidian';
import CribbageTrackerPlugin from './main';

export interface CribbageTrackerSettings {
    databasePath: string;
}

export const DEFAULT_SETTINGS: CribbageTrackerSettings = {
    databasePath: 'Cribbage/cribbage.db',
};

export class CribbageTrackerSettingTab extends PluginSettingTab {
    plugin: CribbageTrackerPlugin;

    constructor(app: App, plugin: CribbageTrackerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', {
            text: 'Cribbage Tracker Settings',
        });

        new Setting(containerEl)
            .setName('Database path')
            .setDesc(
                'Path to the SQLite database, relative to the root of your vault.',
            )
            .addText((text) =>
                text
                    .setPlaceholder('Cribbage/cribbage.db')
                    .setValue(this.plugin.settings.databasePath)
                    .onChange(async (value) => {
                        this.plugin.settings.databasePath = value.trim();
                        await this.plugin.saveSettings();
                    }),
            );
    }
}