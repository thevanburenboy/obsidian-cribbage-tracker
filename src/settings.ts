import { App, PluginSettingTab, Setting } from 'obsidian';
import CribbageTrackerPlugin from './main';

export interface CribbageTrackerSettings {
	databasePath: string;
	showCsvImporter: boolean;

	dealerHandPar: number;
	poneHandPar: number;
	cribPar: number;

	dealerPeggingPar: number;
	ponePeggingPar: number;
}

export const DEFAULT_SETTINGS: CribbageTrackerSettings = {
	databasePath: 'Cribbage/cribbage.db',
	showCsvImporter: true,

	dealerHandPar: 7.95,
	poneHandPar: 8.10,
	cribPar: 4.65,

	dealerPeggingPar: 3.50,
	ponePeggingPar: 2.10,
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

		new Setting(containerEl)
			.setName('Configuration')
			.setHeading();

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
			new Setting(containerEl)
				.setName('Show CSV importer')
				.setDesc(
					'Show the Import Games from CSV section in the Cribbage Tracker view.',
				)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.showCsvImporter,
						)
						.onChange(async (value) => {
							this.plugin.settings.showCsvImporter =
								value;

							await this.plugin.saveSettings();

							this.plugin.refreshViews();
						}),
				);
new Setting(containerEl)
	.setName('Par benchmarks')
	.setHeading();

containerEl.createEl('p', {
	text:
		'Benchmarks shown alongside hand, crib, and pegging statistics. You can change these to your own targets.',
	cls: 'setting-item-description',
});

new Setting(containerEl)
	.setName('Dealer hand par')
	.setDesc(
		'Expected hand points when the player is dealer.',
	)
	.addText((text) => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.step = '0.01';

		text
			.setValue(
				String(
					this.plugin.settings.dealerHandPar,
				),
			)
			.onChange(async (value) => {
				const parsed = Number(value);

				if (
					!Number.isFinite(parsed) ||
					parsed < 0
				) {
					return;
				}

				this.plugin.settings.dealerHandPar =
					parsed;

				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			});
	});

new Setting(containerEl)
	.setName('Pone hand par')
	.setDesc(
		'Expected hand points when the player is not dealer.',
	)
	.addText((text) => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.step = '0.01';

		text
			.setValue(
				String(
					this.plugin.settings.poneHandPar,
				),
			)
			.onChange(async (value) => {
				const parsed = Number(value);

				if (
					!Number.isFinite(parsed) ||
					parsed < 0
				) {
					return;
				}

				this.plugin.settings.poneHandPar =
					parsed;

				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			});
	});

new Setting(containerEl)
	.setName('Crib par')
	.setDesc(
		'Expected points from the dealer’s crib.',
	)
	.addText((text) => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.step = '0.01';

		text
			.setValue(
				String(
					this.plugin.settings.cribPar,
				),
			)
			.onChange(async (value) => {
				const parsed = Number(value);

				if (
					!Number.isFinite(parsed) ||
					parsed < 0
				) {
					return;
				}

				this.plugin.settings.cribPar =
					parsed;

				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			});
	});

new Setting(containerEl)
	.setName('Dealer pegging par')
	.setDesc(
		'Expected pegging points when the player is dealer.',
	)
	.addText((text) => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.step = '0.01';

		text
			.setValue(
				String(
					this.plugin.settings.dealerPeggingPar,
				),
			)
			.onChange(async (value) => {
				const parsed = Number(value);

				if (
					!Number.isFinite(parsed) ||
					parsed < 0
				) {
					return;
				}

				this.plugin.settings.dealerPeggingPar =
					parsed;

				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			});
	});

new Setting(containerEl)
	.setName('Pone pegging par')
	.setDesc(
		'Expected pegging points when the player is not dealer.',
	)
	.addText((text) => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.step = '0.01';

		text
			.setValue(
				String(
					this.plugin.settings.ponePeggingPar,
				),
			)
			.onChange(async (value) => {
				const parsed = Number(value);

				if (
					!Number.isFinite(parsed) ||
					parsed < 0
				) {
					return;
				}

				this.plugin.settings.ponePeggingPar =
					parsed;

				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			});
	});
    }
}