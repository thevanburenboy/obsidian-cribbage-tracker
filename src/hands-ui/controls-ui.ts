import { Notice } from 'obsidian';

import type { HandInput } from '../database/database';

export function createNumberField(
	container: HTMLElement,
	label: string,
	value: number | null,
): HTMLInputElement {
	const wrapper = container.createDiv('cribbage-form-field');

	wrapper.createEl('label', {
		text: label,
	});

	const input = wrapper.createEl('input', {
		type: 'number',
	});

	input.min = '0';
	input.step = '1';

	if (value !== null) {
		input.value = String(value);
	}

	return input;
}

export function createInlineNumber(
	container: HTMLElement,
	value: number | null,
): HTMLInputElement {
	const input = container.createEl('input', {
		type: 'number',
		cls: 'cribbage-hand-input',
	});

	input.min = '0';
	input.step = '1';

	if (value !== null) {
		input.value = String(value);
	}

	return input;
}

export function readHandInput(
	player1: HTMLInputElement,
	player2: HTMLInputElement,
	crib: HTMLInputElement,
): HandInput | null {
	const p1 = parseOptionalNumber(player1.value);

	const p2 = parseOptionalNumber(player2.value);

	const cribValue = parseOptionalNumber(crib.value);

	if (p1 === undefined || p2 === undefined || cribValue === undefined) {
		new Notice(
			'Hand and crib values must be whole numbers of 0 or greater.',
		);

		return null;
	}

	return {
		player1HandPoints: p1,
		player2HandPoints: p2,
		cribPoints: cribValue,
	};
}

export function createEligibilityControl(
	container: HTMLElement,
	effectiveEligible: boolean,
	override: boolean | null,
	automaticEligible: boolean,
	onOverrideChange: (override: boolean | null) => Promise<void>,
): void {
	const eligibility = container.createDiv('cribbage-eligibility');

	const label = eligibility.createEl('label');

	const checkbox = label.createEl('input', {
		type: 'checkbox',
	});

	checkbox.checked = effectiveEligible;

	label.createSpan({
		text: 'Eligible',
	});

	const reset = eligibility.createEl('button', {
		text: 'Auto',
		cls: 'cribbage-eligibility-reset',
		attr: {
			'aria-label': 'Use automatic eligibility',
			title: 'Use automatic eligibility',
		},
	});

	reset.hidden = override === null;

	checkbox.addEventListener('change', () => {
		void (async () => {
			const previousChecked = checkbox.checked;

			try {
				await onOverrideChange(checkbox.checked);

				reset.hidden = false;
			} catch (error) {
				console.error(error);

				checkbox.checked = !previousChecked;

				new Notice('Could not update eligibility.');
			}
		})();
	});

	reset.addEventListener('click', () => {
		void (async () => {
			try {
				await onOverrideChange(null);

				checkbox.checked = automaticEligible;

				reset.hidden = true;
			} catch (error) {
				console.error(error);

				new Notice('Could not reset eligibility.');
			}
		})();
	});
}

export function parseOptionalNumber(value: string): number | null | undefined {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	const number = Number(trimmed);

	if (!Number.isInteger(number) || number < 0) {
		return undefined;
	}

	return number;
}

export function createSummaryValue(
	container: HTMLElement,
	label: string,
	value: string,
): void {
	const item = container.createDiv('cribbage-summary-item');

	item.createSpan({
		text: label,
		cls: 'cribbage-summary-label',
	});

	item.createEl('strong', {
		text: value,
	});
}

export function createParLabel(container: HTMLElement, value: number): void {
	container.createDiv({
		text: `Par: ${value.toFixed(2)}`,
		cls: 'cribbage-par-label',
	});
}

export function attachParColor(input: HTMLInputElement, par: number): void {
	const update = () => {
		input.removeClass('cribbage-above-par');

		input.removeClass('cribbage-below-par');

		const parsed = parseOptionalNumber(input.value);

		if (parsed === null || parsed === undefined) {
			return;
		}

		const difference = parsed - par;

		if (Math.abs(difference) < 0.000001) {
			return;
		}

		input.addClass(
			difference > 0 ? 'cribbage-above-par' : 'cribbage-below-par',
		);
	};

	input.addEventListener('input', update);

	update();
}
