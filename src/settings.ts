import {
	App,
	PluginSettingTab,
	type SettingDefinitionItem,
} from 'obsidian';

import CribbageTrackerPlugin
	from './main';


export interface CribbageTrackerSettings {
	databasePath: string;
	showCsvImporter: boolean;

	dealerHandPar: number;
	poneHandPar: number;
	cribPar: number;

	dealerPeggingPar: number;
	ponePeggingPar: number;
}


export const DEFAULT_SETTINGS:
	CribbageTrackerSettings = {
	databasePath:
		'Cribbage/cribbage.db',

	showCsvImporter: true,

	dealerHandPar: 7.95,
	poneHandPar: 8.10,
	cribPar: 4.65,

	dealerPeggingPar: 3.50,
	ponePeggingPar: 2.10,
};


export class CribbageTrackerSettingTab
	extends PluginSettingTab {

	plugin: CribbageTrackerPlugin;

	constructor(
		app: App,
		plugin: CribbageTrackerPlugin,
	) {
		super(app, plugin);

		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group' as const,
				heading: 'Configuration',

				items: [
					{
						name: 'Database path',

						desc:
							'Path to the SQLite database, relative to the root of your vault.',

						control: {
							type: 'text' as const,
							key: 'databasePath',
							placeholder:
								'Cribbage/cribbage.db',
						},
					},

					{
						name:
							'Show CSV importer',

						desc:
							'Show the Import games from CSV section in the Cribbage tracker view.',

						render: (setting) => {
							setting.addToggle(
								(toggle) =>
									toggle
										.setValue(
											this
												.plugin
												.settings
												.showCsvImporter,
										)
										.onChange(
											async (
												value,
											) => {
												this.plugin
													.settings
													.showCsvImporter =
													value;

												await this
													.plugin
													.saveSettings();

												this.plugin
													.refreshViews();
											},
										),
							);
						},
					},
				],
			},

			{
				type: 'group' as const,
				heading:
					'Par benchmarks',

				items: [
					{
						name:
							'Dealer hand par',

						desc:
							'Benchmark for hand points when dealing.',

						control: {
							type: 'number' as const,
							key:
								'dealerHandPar',
							min: 0,
						},
					},

					{
						name:
							'Pone hand par',

						desc:
							'Benchmark for hand points when pone.',

						control: {
							type: 'number' as const,
							key:
								'poneHandPar',
							min: 0,
						},
					},

					{
						name:
							'Crib par',

						desc:
							'Benchmark for crib points.',

						control: {
							type: 'number' as const,
							key:
								'cribPar',
							min: 0,
						},
					},

					{
						name:
							'Dealer pegging par',

						desc:
							'Benchmark for pegging points per round when dealing.',

						control: {
							type: 'number' as const,
							key:
								'dealerPeggingPar',
							min: 0,
						},
					},

					{
						name:
							'Pone pegging par',

						desc:
							'Benchmark for pegging points per round when pone.',

						control: {
							type: 'number' as const,
							key:
								'ponePeggingPar',
							min: 0,
						},
					},
				],
			},
		];
	}
}