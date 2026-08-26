import {
	App,
	Modal,
	Setting,
} from 'obsidian';


class ConfirmModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly message: string,
		private readonly confirmText: string,
		private readonly resolveResult:
			(confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText('Confirm');

        this.contentEl.createEl('p', {
            text: this.message,
        });

		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText('Cancel')
					.onClick(() => {
						this.finish(false);
					}),
			)
			.addButton((button) =>
				button
					.setButtonText(
						this.confirmText,
					)
					.setCta()
					.onClick(() => {
						this.finish(true);
					}),
			);
	}

	onClose(): void {
		// Treat Escape, clicking outside, or the X
		// exactly like clicking Cancel.
		if (!this.settled) {
			this.settled = true;

			this.resolveResult(false);
		}

		this.contentEl.empty();
	}

	private finish(
		confirmed: boolean,
	): void {
		if (this.settled) {
			return;
		}

		this.settled = true;

		this.resolveResult(confirmed);

		this.close();
	}
}


export function confirmAction(
	app: App,
	message: string,
	confirmText = 'Confirm',
): Promise<boolean> {
	return new Promise<boolean>(
		(resolve) => {
			new ConfirmModal(
				app,
				message,
				confirmText,
				resolve,
			).open();
		},
	);
}