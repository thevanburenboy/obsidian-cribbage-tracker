import {
	ItemView,
	Notice,
	Plugin,
	WorkspaceLeaf,
} from 'obsidian';

import {
	CribbageDatabase,
	GameInput,
	GameRecord,
} from './database';

import {
	DEFAULT_SETTINGS,
	CribbageTrackerSettings,
	CribbageTrackerSettingTab,
} from './settings';

import {
	renderCsvImporter,
} from './csv-import';

import {
	renderHandsPage,
} from './hands-ui';

import {
	renderStatisticsPage,
} from './statistics-ui';

import {
	renderCustomMetricsPage,
} from './custom-metrics-ui';

const VIEW_TYPE_CRIBBAGE = 'cribbage-tracker-view';

export default class CribbageTrackerPlugin extends Plugin {
	settings!: CribbageTrackerSettings;
	database!: CribbageDatabase;

	async onload() {
		await this.loadSettings();

		this.database = new CribbageDatabase(this);
		await this.database.load();

		this.registerView(
			VIEW_TYPE_CRIBBAGE,
			(leaf) =>
				new CribbageTrackerView(leaf, this),
		);

		this.addRibbonIcon(
			'dice-5',
			'Open Cribbage Tracker',
			() => {
				this.activateView();
			},
		);

		this.addCommand({
			id: 'open-cribbage-tracker',
			name: 'Open Cribbage Tracker',
			callback: () => {
				this.activateView();
			},
		});

		this.addSettingTab(
			new CribbageTrackerSettingTab(
				this.app,
				this,
			),
		);
	}

	onunload() {
		this.database?.close();

		this.app.workspace.detachLeavesOfType(
			VIEW_TYPE_CRIBBAGE,
		);
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

    refreshViews(): void {
        const leaves =
            this.app.workspace.getLeavesOfType(
                VIEW_TYPE_CRIBBAGE,
            );

        for (const leaf of leaves) {
            const view = leaf.view;

            if (
                view instanceof
                CribbageTrackerView
            ) {
                view.render();
            }
        }
    }

	async activateView() {
		const { workspace } = this.app;

		let leaf =
			workspace.getLeavesOfType(
				VIEW_TYPE_CRIBBAGE,
			)[0];

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
    private sortColumn:
        | 'datetime'
        | 'player1'
        | 'player2'
        | 'margin' = 'datetime';

    private sortDirection: 'asc' | 'desc' = 'desc';

    private editingGameId: string | null = null;

    private activePage:
        | 'games'
        | 'hands'
        | 'statistics'
        | 'custom-metrics' = 'games';

    private selectedGameId:
        string | null = null;

    private createSortableHeader(
        row: HTMLTableRowElement,
        label: string,
        column:
            | 'datetime'
            | 'player1'
            | 'player2'
            | 'margin',
    ): void {
        const header =
            row.createEl('th');

        const button =
            header.createEl('button', {
                cls: 'cribbage-sort-button',
            });

        let indicator = '';

        if (this.sortColumn === column) {
            indicator =
                this.sortDirection === 'asc'
                    ? ' ▲'
                    : ' ▼';
        }

        button.setText(
            `${label}${indicator}`,
        );

        button.addEventListener(
            'click',
            () => {
                if (
                    this.sortColumn === column
                ) {
                    this.sortDirection =
                        this.sortDirection === 'asc'
                            ? 'desc'
                            : 'asc';
                } else {
                    this.sortColumn = column;

                    // Dates and margins are generally
                    // most useful high-to-low first.
                    this.sortDirection =
                        column === 'datetime' ||
                        column === 'margin'
                            ? 'desc'
                            : 'asc';
                }

                this.render();
            },
        );
    }

    private sortGames(
        games: GameRecord[],
    ): GameRecord[] {
        return [...games].sort(
            (a, b) => {
                let comparison = 0;

                switch (this.sortColumn) {
                    case 'datetime': {
                        const aValue =
                            `${a.playedDate}T${a.playedTime}`;

                        const bValue =
                            `${b.playedDate}T${b.playedTime}`;

                        comparison =
                            aValue.localeCompare(
                                bValue,
                            );

                        break;
                    }

                    case 'player1':
                        comparison =
                            a.player1.localeCompare(
                                b.player1,
                                undefined,
                                {
                                    sensitivity:
                                        'base',
                                },
                            );

                        break;

                    case 'player2':
                        comparison =
                            a.player2.localeCompare(
                                b.player2,
                                undefined,
                                {
                                    sensitivity:
                                        'base',
                                },
                            );

                        break;

                    case 'margin': {
                        const aMargin =
                            this.getMarginValue(a);

                        const bMargin =
                            this.getMarginValue(b);

                        // Keep games without scores at
                        // the bottom regardless of direction.
                        if (aMargin === null) {
                            return bMargin === null
                                ? 0
                                : 1;
                        }

                        if (bMargin === null) {
                            return -1;
                        }

                        comparison =
                            aMargin - bMargin;

                        break;
                    }
                }

                return this.sortDirection === 'asc'
                    ? comparison
                    : -comparison;
            },
        );
    }

    private getMarginValue(
        game: GameRecord,
    ): number | null {
        if (
            game.player1Score === null ||
            game.player2Score === null
        ) {
            return null;
        }

        return Math.abs(
            game.player1Score -
                game.player2Score,
        );
    }
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
        contentEl.addClass('cribbage-tracker');

        const header =
            contentEl.createDiv(
                'cribbage-header',
            );

        header.createEl('h1', {
            text: 'Cribbage Tracker',
        });

        header.createEl('div', {
            text:
                `${this.plugin.database.getGameCount()} games`,
            cls: 'cribbage-game-count',
        });

        const navigation =
            contentEl.createDiv(
                'cribbage-navigation',
            );

        this.createNavigationButton(
            navigation,
            'Games',
            'games',
        );

        this.createNavigationButton(
            navigation,
            'Hands',
            'hands',
        );

        this.createNavigationButton(
            navigation,
            'Statistics',
            'statistics',
        );

        this.createNavigationButton(
            navigation,
            'Custom Metrics',
            'custom-metrics',
        );

        if (this.activePage === 'games') {
            this.renderGamesPage(
                contentEl,
            );
        } else if (
            this.activePage === 'hands'
        ) {
            renderHandsPage(
                contentEl,
                this.plugin,
                this.selectedGameId,

                (gameId) => {
                    this.selectedGameId =
                        gameId;

                    this.render();
                },

                () => {
                    this.render();
                },
            );
        } else if (
            this.activePage === 'statistics'
        ) {
            renderStatisticsPage(
                contentEl,
                this.plugin,
            );
        } else {
            renderCustomMetricsPage(
                contentEl,
                this.plugin,
            );
        }
    }

    private renderGamesPage(
        container: HTMLElement,
    ): void {
        this.renderNewGameForm(
            container,
        );

        if (
            this.plugin.settings
                .showCsvImporter
        ) {
            renderCsvImporter(
                container,
                this.plugin,
                () => this.render(),
            );
        }

        this.renderGamesTable(
            container,
        );
    }

    private createNavigationButton(
        container: HTMLElement,
        label: string,
        page:
            | 'games'
            | 'hands'
            | 'statistics'
            | 'custom-metrics',
    ): void {
        const button =
            container.createEl('button', {
                text: label,
            });

        if (
            this.activePage === page
        ) {
            button.addClass(
                'mod-cta',
            );
        }

        button.addEventListener(
            'click',
            () => {
                this.activePage =
                    page;

                this.render();
            },
        );
    }

	private renderNewGameForm(
		container: HTMLElement,
	): void {
		const section =
			container.createDiv('cribbage-panel');

		section.createEl('h2', {
			text: 'New Game',
		});

		const form =
			section.createEl('form', {
				cls: 'cribbage-game-form',
			});

		const defaults =
			this.getCurrentDateTime();

		const dateInput = this.createField(
			form,
			'Date',
			'date',
		);

		dateInput.value = defaults.date;
		dateInput.required = true;

		const timeInput = this.createField(
			form,
			'Time',
			'time',
		);

		timeInput.value = defaults.time;
		timeInput.required = true;

		const playerNames =
			this.plugin.database.getPlayerNames();

		const datalistId =
			'cribbage-player-suggestions';

		const datalist =
			form.createEl('datalist');

		datalist.id = datalistId;

		for (const player of playerNames) {
			datalist.createEl('option', {
				value: player,
			});
		}

		const player1Input =
			this.createField(
				form,
				'Player 1',
				'text',
			);

		player1Input.setAttr(
			'list',
			datalistId,
		);

		player1Input.setAttr(
			'autocomplete',
			'off',
		);

		player1Input.required = true;

		const player2Input =
			this.createField(
				form,
				'Player 2',
				'text',
			);

		player2Input.setAttr(
			'list',
			datalistId,
		);

		player2Input.setAttr(
			'autocomplete',
			'off',
		);

		player2Input.required = true;

		const dealerWrapper =
			form.createDiv(
				'cribbage-form-field',
			);

		dealerWrapper.createEl('label', {
			text: 'First dealer',
		});

        const dealerSelect =
            dealerWrapper.createEl('select');

        const unknownDealerOption =
            dealerSelect.createEl('option', {
                text: 'Unknown',
                value: '',
            });

        unknownDealerOption.selected = true;

		const player1DealerOption =
			dealerSelect.createEl('option', {
				text: 'Player 1',
				value: '1',
			});

		const player2DealerOption =
			dealerSelect.createEl('option', {
				text: 'Player 2',
				value: '2',
			});

		const updateDealerLabels = () => {
			player1DealerOption.text =
				player1Input.value.trim() ||
				'Player 1';

			player2DealerOption.text =
				player2Input.value.trim() ||
				'Player 2';
		};

		player1Input.addEventListener(
			'input',
			updateDealerLabels,
		);

		player2Input.addEventListener(
			'input',
			updateDealerLabels,
		);

		const player1Score =
			this.createField(
				form,
				'Player 1 score',
				'number',
			);

		player1Score.min = '0';
		player1Score.step = '1';

		const player2Score =
			this.createField(
				form,
				'Player 2 score',
				'number',
			);

		player2Score.min = '0';
		player2Score.step = '1';

		const actions =
			form.createDiv(
				'cribbage-form-actions',
			);

		const saveButton =
			actions.createEl('button', {
				text: 'Add Game',
				type: 'submit',
				cls: 'mod-cta',
			});

		form.addEventListener(
			'submit',
			async (event) => {
				event.preventDefault();

				const player1 =
					player1Input.value.trim();

				const player2 =
					player2Input.value.trim();

				if (
					player1.toLocaleLowerCase() ===
					player2.toLocaleLowerCase()
				) {
					new Notice(
						'Player 1 and Player 2 must be different.',
					);

					return;
				}

				const score1 =
					this.parseOptionalScore(
						player1Score.value,
					);

				const score2 =
					this.parseOptionalScore(
						player2Score.value,
					);

				if (
					score1 === undefined ||
					score2 === undefined
				) {
					new Notice(
						'Scores must be whole numbers of 0 or greater.',
					);

					return;
				}

                let firstDealer: 1 | 2 | null = null;

                if (dealerSelect.value === '1') {
                    firstDealer = 1;
                } else if (dealerSelect.value === '2') {
                    firstDealer = 2;
                }

                const input: GameInput = {
                    playedDate:
                        dateInput.value,
                    playedTime:
                        timeInput.value,
                    player1,
                    player2,
                    firstDealer,
                    player1Score: score1,
                    player2Score: score2,
                    player1HighHandManual: null,
                    player2HighHandManual: null,
                };

				saveButton.disabled = true;

				try {
					await this.plugin.database
						.createGame(input);

					new Notice('Game added.');

					this.render();
				} catch (error) {
					console.error(error);

					new Notice(
						'Could not add game.',
					);
				} finally {
					saveButton.disabled = false;
				}
			},
		);
	}

	private renderGamesTable(
		container: HTMLElement,
	): void {
		const section =
			container.createDiv('cribbage-panel');

		section.createEl('h2', {
			text: 'Games',
		});

        const games =
            this.sortGames(
                this.plugin.database.listGames(),
            );

		if (games.length === 0) {
			section.createEl('p', {
				text: 'No games recorded yet.',
				cls: 'cribbage-empty-state',
			});

			return;
		}

		const scroll =
			section.createDiv(
				'cribbage-table-scroll',
			);

		const table =
			scroll.createEl('table', {
				cls: 'cribbage-table',
			});

        const header =
            table.createEl('thead')
                .createEl('tr');

        this.createSortableHeader(
            header,
            'Date',
            'datetime',
        );

        header.createEl('th', {
            text: 'Time',
        });

        this.createSortableHeader(
            header,
            'Player 1',
            'player1',
        );

        this.createSortableHeader(
            header,
            'Player 2',
            'player2',
        );

        header.createEl('th', {
            text: 'First dealer',
        });

        header.createEl('th', {
            text: 'Score',
        });

        header.createEl('th', {
            text: 'Winner',
        });

        this.createSortableHeader(
            header,
            'Margin',
            'margin',
        );

        header.createEl('th');

		const body =
			table.createEl('tbody');

		for (const game of games) {
			this.renderGameRow(
				body,
				game,
			);
		}
	}

    private renderGameRow(
        body: HTMLTableSectionElement,
        game: GameRecord,
    ): void {
        if (this.editingGameId === game.id) {
            this.renderEditableGameRow(
                body,
                game,
            );

            return;
        }

        const row = body.createEl('tr');

        row.createEl('td', {
            text: game.playedDate,
        });

        row.createEl('td', {
            text: game.playedTime,
        });

        row.createEl('td', {
            text: game.player1,
        });

        row.createEl('td', {
            text: game.player2,
        });

        row.createEl('td', {
            text:
                game.firstDealer === 1
                    ? game.player1
                    : game.firstDealer === 2
                        ? game.player2
                        : 'Unknown',
        });

        row.createEl('td', {
            text: this.getScoreText(game),
        });

        row.createEl('td', {
            text: this.getWinnerText(game),
        });

        row.createEl('td', {
            text: this.getMarginText(game),
        });

        const actions =
            row.createEl('td');

        const actionGroup =
            actions.createDiv(
                'cribbage-row-actions',
            );

        const handsButton =
            actionGroup.createEl('button', {
                text: 'Hands',
            });

        handsButton.addEventListener(
            'click',
            () => {
                this.selectedGameId =
                    game.id;

                this.activePage =
                    'hands';

                this.render();
            },
        );

        const editButton =
            actionGroup.createEl('button', {
                text: 'Edit',
            });

        editButton.addEventListener(
            'click',
            () => {
                this.editingGameId =
                    game.id;

                this.render();
            },
        );

        const deleteButton =
            actionGroup.createEl('button', {
                text: 'Delete',
                cls: 'cribbage-delete-button',
            });

        deleteButton.addEventListener(
            'click',
            async () => {
                const confirmed =
                    window.confirm(
                        `Delete ${game.player1} vs ${game.player2} on ${game.playedDate}?`,
                    );

                if (!confirmed) {
                    return;
                }

                try {
                    await this.plugin.database
                        .deleteGame(game.id);

                    new Notice('Game deleted.');

                    this.render();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not delete game.',
                    );
                }
            },
        );
    }

    private renderEditableGameRow(
        body: HTMLTableSectionElement,
        game: GameRecord,
    ): void {
        const row = body.createEl('tr', {
            cls: 'cribbage-editing-row',
        });

        // Date
        const dateCell =
            row.createEl('td');

        const dateInput =
            dateCell.createEl('input', {
                type: 'date',
            });

        dateInput.value =
            game.playedDate;

        dateInput.setAttr(
            'aria-label',
            'Date',
        );

        // Time
        const timeCell =
            row.createEl('td');

        const timeInput =
            timeCell.createEl('input', {
                type: 'time',
            });

        timeInput.value =
            game.playedTime;

        timeInput.setAttr(
            'aria-label',
            'Time',
        );

        // Player 1
        const player1Cell =
            row.createEl('td');

        const player1Input =
            player1Cell.createEl('input', {
                type: 'text',
            });

        player1Input.value =
            game.player1;

        player1Input.setAttr(
            'list',
            'cribbage-player-suggestions',
        );

        player1Input.setAttr(
            'autocomplete',
            'off',
        );

        player1Input.setAttr(
            'aria-label',
            'Player 1',
        );

        // Player 2
        const player2Cell =
            row.createEl('td');

        const player2Input =
            player2Cell.createEl('input', {
                type: 'text',
            });

        player2Input.value =
            game.player2;

        player2Input.setAttr(
            'list',
            'cribbage-player-suggestions',
        );

        player2Input.setAttr(
            'autocomplete',
            'off',
        );

        player2Input.setAttr(
            'aria-label',
            'Player 2',
        );

        // First dealer
        const dealerCell =
            row.createEl('td');

        const dealerSelect =
            dealerCell.createEl('select');

        dealerSelect.setAttr(
            'aria-label',
            'First dealer',
        );

        const unknownOption =
            dealerSelect.createEl('option', {
                text: 'Unknown',
                value: '',
            });

        const player1Option =
            dealerSelect.createEl('option', {
                text: game.player1,
                value: '1',
            });

        const player2Option =
            dealerSelect.createEl('option', {
                text: game.player2,
                value: '2',
            });

        if (game.firstDealer === 1) {
            player1Option.selected = true;
        } else if (game.firstDealer === 2) {
            player2Option.selected = true;
        } else {
            unknownOption.selected = true;
        }

        const updateDealerLabels = () => {
            player1Option.text =
                player1Input.value.trim() ||
                'Player 1';

            player2Option.text =
                player2Input.value.trim() ||
                'Player 2';
        };

        // Scores
        const scoreCell =
            row.createEl('td');

        const scoreWrapper =
            scoreCell.createDiv(
                'cribbage-edit-score',
            );

        const player1Score =
            scoreWrapper.createEl('input', {
                type: 'number',
            });

        player1Score.min = '0';
        player1Score.step = '1';

        player1Score.value =
            game.player1Score === null
                ? ''
                : String(
                        game.player1Score,
                    );

        player1Score.setAttr(
            'aria-label',
            `${game.player1} score`,
        );

        scoreWrapper.createSpan({
            text: '–',
        });

        const player2Score =
            scoreWrapper.createEl('input', {
                type: 'number',
            });

        player2Score.min = '0';
        player2Score.step = '1';

        player2Score.value =
            game.player2Score === null
                ? ''
                : String(
                        game.player2Score,
                    );

        player2Score.setAttr(
            'aria-label',
            `${game.player2} score`,
        );

        // Derived preview
        const winnerCell =
            row.createEl('td');

        const marginCell =
            row.createEl('td');

        const updateDerivedPreview =
            () => {
                const score1 =
                    this.parseOptionalScore(
                        player1Score.value,
                    );

                const score2 =
                    this.parseOptionalScore(
                        player2Score.value,
                    );

                if (
                    score1 === undefined ||
                    score2 === undefined
                ) {
                    winnerCell.setText(
                        'Invalid',
                    );

                    marginCell.setText('—');

                    return;
                }

                if (
                    score1 === null ||
                    score2 === null
                ) {
                    winnerCell.setText('—');
                    marginCell.setText('—');

                    return;
                }

                if (score1 === score2) {
                    winnerCell.setText('Tie');
                } else if (
                    score1 > score2
                ) {
                    winnerCell.setText(
                        player1Input.value.trim() ||
                            'Player 1',
                    );
                } else {
                    winnerCell.setText(
                        player2Input.value.trim() ||
                            'Player 2',
                    );
                }

                marginCell.setText(
                    String(
                        Math.abs(
                            score1 -
                                score2,
                        ),
                    ),
                );
            };

        updateDerivedPreview();

        for (const input of [
            player1Input,
            player2Input,
            player1Score,
            player2Score,
        ]) {
            input.addEventListener(
                'input',
                () => {
                    updateDealerLabels();
                    updateDerivedPreview();
                },
            );
        }

        // Save / Cancel
        const actionsCell =
            row.createEl('td');

        const actionGroup =
            actionsCell.createDiv(
                'cribbage-row-actions',
            );

        const saveButton =
            actionGroup.createEl('button', {
                text: 'Save',
                cls: 'mod-cta',
            });

        const cancelButton =
            actionGroup.createEl('button', {
                text: 'Cancel',
            });

        cancelButton.addEventListener(
            'click',
            () => {
                this.editingGameId =
                    null;

                this.render();
            },
        );

        saveButton.addEventListener(
            'click',
            async () => {
                const player1 =
                    player1Input.value.trim();

                const player2 =
                    player2Input.value.trim();

                if (
                    !dateInput.value ||
                    !timeInput.value
                ) {
                    new Notice(
                        'Date and time are required.',
                    );

                    return;
                }

                if (
                    !player1 ||
                    !player2
                ) {
                    new Notice(
                        'Both player names are required.',
                    );

                    return;
                }

                if (
                    player1.toLocaleLowerCase() ===
                    player2.toLocaleLowerCase()
                ) {
                    new Notice(
                        'Player 1 and Player 2 must be different.',
                    );

                    return;
                }

                const score1 =
                    this.parseOptionalScore(
                        player1Score.value,
                    );

                const score2 =
                    this.parseOptionalScore(
                        player2Score.value,
                    );

                if (
                    score1 === undefined ||
                    score2 === undefined
                ) {
                    new Notice(
                        'Scores must be whole numbers of 0 or greater.',
                    );

                    return;
                }

                let firstDealer:
                    1 | 2 | null =
                    null;

                if (
                    dealerSelect.value ===
                    '1'
                ) {
                    firstDealer = 1;
                } else if (
                    dealerSelect.value ===
                    '2'
                ) {
                    firstDealer = 2;
                }

                saveButton.disabled = true;

                try {
                    await this.plugin.database
                        .updateGame(
                            game.id,
                            {
                                playedDate:
                                    dateInput.value,

                                playedTime:
                                    timeInput.value,

                                player1,
                                player2,

                                firstDealer,

                                player1Score:
                                    score1,

                                player2Score:
                                    score2,

                                // Preserve historical fallback
                                // data that is not exposed
                                // in this editor.
                                player1HighHandManual:
                                    game.player1HighHandManual,

                                player2HighHandManual:
                                    game.player2HighHandManual,
                            },
                        );

                    this.editingGameId =
                        null;

                    new Notice(
                        'Game updated.',
                    );

                    this.render();
                } catch (error) {
                    console.error(error);

                    new Notice(
                        'Could not update game.',
                    );

                    saveButton.disabled =
                        false;
                }
            },
        );
    }

	private createField(
		form: HTMLElement,
		label: string,
		type: string,
	): HTMLInputElement {
		const wrapper =
			form.createDiv(
				'cribbage-form-field',
			);

		wrapper.createEl('label', {
			text: label,
		});

		return wrapper.createEl('input', {
			type,
		});
	}

	private parseOptionalScore(
		value: string,
	): number | null | undefined {
		const trimmed = value.trim();

		if (trimmed === '') {
			return null;
		}

		const parsed = Number(trimmed);

		if (
			!Number.isInteger(parsed) ||
			parsed < 0
		) {
			return undefined;
		}

		return parsed;
	}

	private getScoreText(
		game: GameRecord,
	): string {
		if (
			game.player1Score === null &&
			game.player2Score === null
		) {
			return '—';
		}

		return `${game.player1Score ?? '—'} - ${game.player2Score ?? '—'}`;
	}

	private getWinnerText(
		game: GameRecord,
	): string {
		if (
			game.player1Score === null ||
			game.player2Score === null
		) {
			return '—';
		}

		if (
			game.player1Score ===
			game.player2Score
		) {
			return 'Tie';
		}

		return game.player1Score >
			game.player2Score
			? game.player1
			: game.player2;
	}

	private getMarginText(
		game: GameRecord,
	): string {
		if (
			game.player1Score === null ||
			game.player2Score === null
		) {
			return '—';
		}

		return String(
			Math.abs(
				game.player1Score -
					game.player2Score,
			),
		);
	}

	private getCurrentDateTime(): {
		date: string;
		time: string;
	} {
		const now = new Date();

		const year =
			String(now.getFullYear());

		const month =
			String(
				now.getMonth() + 1,
			).padStart(2, '0');

		const day =
			String(
				now.getDate(),
			).padStart(2, '0');

		const hours =
			String(
				now.getHours(),
			).padStart(2, '0');

		const minutes =
			String(
				now.getMinutes(),
			).padStart(2, '0');

		return {
			date: `${year}-${month}-${day}`,
			time: `${hours}:${minutes}`,
		};
	}
}