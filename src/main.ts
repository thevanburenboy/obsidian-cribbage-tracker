import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import {
	ItemView,
	Notice,
	Plugin,
	Setting,
	WorkspaceLeaf,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	CribbageTrackerSettings,
	CribbageTrackerSettingTab,
} from './settings';

const VIEW_TYPE_CRIBBAGE = 'cribbage-tracker-view';

class CribbageDatabase {
	private sql: SqlJsStatic | null = null;
	private db: Database | null = null;

	constructor(private plugin: CribbageTrackerPlugin) {}

	async load(): Promise<void> {
        const wasmPath = `${this.plugin.manifest.dir}/sql-wasm.wasm`;

        const wasmBinary =
            await this.plugin.app.vault.adapter.readBinary(wasmPath);

        this.sql = await initSqlJs({
            wasmBinary,
        });

		const path = this.plugin.settings.databasePath;

		if (await this.plugin.app.vault.adapter.exists(path)) {
			const data = await this.plugin.app.vault.adapter.readBinary(path);

			// Obsidian returns an ArrayBuffer; sql.js expects array-like data.
			this.db = new this.sql.Database(new Uint8Array(data));
		} else {
			this.db = new this.sql.Database();

			this.db.run(`
				CREATE TABLE test (
					id INTEGER PRIMARY KEY,
					message TEXT NOT NULL
				);
			`);

			this.db.run(
				'INSERT INTO test (message) VALUES (?)',
				['Hello from Cribbage Tracker!'],
			);

			await this.save();
		}
	}

	async save(): Promise<void> {
		if (!this.db) {
			throw new Error('Database has not been loaded.');
		}

		const data = this.db.export();

		const parent = this.plugin.settings.databasePath
			.split('/')
			.slice(0, -1)
			.join('/');

		if (
			parent &&
			!(await this.plugin.app.vault.adapter.exists(parent))
		) {
			await this.plugin.app.vault.createFolder(parent);
		}

		// Obsidian wants an ArrayBuffer; sql.js gives us a Uint8Array.
		const buffer = data.buffer.slice(
			data.byteOffset,
			data.byteOffset + data.byteLength,
		) as ArrayBuffer;

		await this.plugin.app.vault.adapter.writeBinary(
			this.plugin.settings.databasePath,
			buffer,
		);
	}

	getTestMessage(): string {
		if (!this.db) {
			throw new Error('Database has not been loaded.');
		}

		const result = this.db.exec(
			'SELECT message FROM test LIMIT 1',
		);

		const firstResult = result[0];

		if (!firstResult) {
			return 'No results found.';
		}

		const firstRow = firstResult.values[0];

		if (!firstRow) {
			return 'No message found.';
		}

		const message = firstRow[0];

		if (message === undefined || message === null) {
			return 'No message found.';
		}

		return String(message);
	}
}

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

		this.addRibbonIcon('dice-5', 'Open Cribbage Tracker', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-cribbage-tracker',
			name: 'Open Cribbage Tracker',
			callback: () => {
				this.activateView();
			},
		});

		this.addSettingTab(
			new CribbageTrackerSettingTab(this.app, this),
		);

		console.log('Cribbage Tracker loaded');
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CRIBBAGE);
		console.log('Cribbage Tracker unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CRIBBAGE)[0];

		if (!leaf) {
			leaf = workspace.getLeaf('tab');

			await leaf.setViewState({
				type: VIEW_TYPE_CRIBBAGE,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);
	}
}

class CribbageTrackerView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CribbageTrackerPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CRIBBAGE;
	}

	getDisplayText(): string {
		return 'Cribbage Tracker';
	}

	getIcon(): string {
		return 'dice-5';
	}

	async onOpen() {
		this.render();
	}

	async onClose() {}

	render() {
		const { contentEl } = this;

		contentEl.empty();

		contentEl.createEl('h1', {
			text: 'Cribbage Tracker',
		});

		contentEl.createEl('p', {
			text: 'Database test',
		});

		const message = contentEl.createEl('p', {
			text: this.plugin.database.getTestMessage(),
		});

		new Setting(contentEl)
			.setName('Database path')
			.setDesc(this.plugin.settings.databasePath);

		const button = contentEl.createEl('button', {
			text: 'Reload Database',
		});

		button.addEventListener('click', async () => {
			try {
				await this.plugin.database.load();

				message.setText(
					this.plugin.database.getTestMessage(),
				);

				new Notice('Database loaded successfully.');
			} catch (error) {
				console.error(error);
				new Notice(
					'Failed to load database. Check the console.',
				);
			}
		});
	}
}