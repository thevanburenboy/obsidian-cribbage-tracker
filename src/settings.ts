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

	leaderboardMinGames: number;
	leaderboardMinWins: number;
	leaderboardMinHands: number;
	leaderboardMinCribs: number;
	leaderboardMinRounds: number;
	leaderboardMinRoleGames: number;
	leaderboardMinHighHandGames: number;
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

	leaderboardMinGames: 5,
	leaderboardMinWins: 5,
	leaderboardMinHands: 5,
	leaderboardMinCribs: 5,
	leaderboardMinRounds: 5,
	leaderboardMinRoleGames: 5,
	leaderboardMinHighHandGames: 5,
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
			{
				type: 'group' as const,
				heading:
					'Leaderboard qualification',

				items: [
					{
						name:
							'Minimum games',

						desc:
							'Games required for win percentage, PPG, and score differential leaderboards.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinGames',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum wins',

						desc:
							'Wins required for the average margin of victory leaderboard.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinWins',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum hands',

						desc:
							'Eligible hands required for the points per hand leaderboard.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinHands',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum cribs',

						desc:
							'Eligible cribs required for the points per crib leaderboard.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinCribs',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum rounds',

						desc:
							'Complete rounds required for the pegging per round leaderboard.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinRounds',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum role games',

						desc:
							'Games required for dealing-first and pone-first leaderboards.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinRoleGames',
							min: 1,
							step: 1,
						},
					},

					{
						name:
							'Minimum comparable high-hand games',

						desc:
							'Games with comparable high hands required for the higher high-hand percentage leaderboard.',

						control: {
							type: 'number' as const,
							key:
								'leaderboardMinHighHandGames',
							min: 1,
							step: 1,
						},
					},
				],
			},
		];
	}
}