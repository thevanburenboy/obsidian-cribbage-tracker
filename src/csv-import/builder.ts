import type { GameInput } from '../database/database';

import type { CsvData, ImportBuildResult, ImportControls } from './types';

import {
	formatMinutes,
	parseCsvDate,
	parseDealer,
	parseOptionalInteger,
	parseRequiredInteger,
	parseTimeToMinutes,
} from './parser';

export function buildGamesFromCsv(
	data: CsvData,
	controls: ImportControls,
): ImportBuildResult {
	const games: GameInput[] = [];
	const errors: string[] = [];

	const player1 = controls.player1Input.value.trim();

	const player2 = controls.player2Input.value.trim();

	if (!player1) {
		errors.push('Player 1 name is required.');
	}

	if (!player2) {
		errors.push('Player 2 name is required.');
	}

	if (
		player1 &&
		player2 &&
		player1.toLocaleLowerCase() === player2.toLocaleLowerCase()
	) {
		errors.push('Player 1 and Player 2 must be different.');
	}

	const dateColumn = getRequiredColumn(controls.dateSelect);

	const player1ScoreColumn = getRequiredColumn(controls.player1ScoreSelect);

	const player2ScoreColumn = getRequiredColumn(controls.player2ScoreSelect);

	if (dateColumn === null) {
		errors.push('Select a date column.');
	}

	if (player1ScoreColumn === null) {
		errors.push('Select the Player 1 score column.');
	}

	if (player2ScoreColumn === null) {
		errors.push('Select the Player 2 score column.');
	}

	const firstDealerColumn = getOptionalColumn(controls.firstDealerSelect);

	const player1HighColumn = getOptionalColumn(controls.player1HighSelect);

	const player2HighColumn = getOptionalColumn(controls.player2HighSelect);

	const baseMinutes = parseTimeToMinutes(controls.baseTimeInput.value);

	if (baseMinutes === null) {
		errors.push('First game time must be valid.');
	}

	const spacing = Number(controls.spacingInput.value);

	if (!Number.isInteger(spacing) || spacing < 0) {
		errors.push('Same-day spacing must be a whole number of minutes.');
	}

	if (
		errors.length > 0 ||
		dateColumn === null ||
		player1ScoreColumn === null ||
		player2ScoreColumn === null ||
		baseMinutes === null ||
		!Number.isInteger(spacing) ||
		spacing < 0
	) {
		return {
			games,
			errors,
		};
	}

	const gamesPerDate = new Map<string, number>();

	for (let index = 0; index < data.rows.length; index++) {
		const row = data.rows[index];

		if (!row) {
			continue;
		}

		const csvRowNumber = index + 2;

		const date = parseCsvDate(row[dateColumn] ?? '');

		if (!date) {
			errors.push(
				`Row ${csvRowNumber}: invalid date "${row[dateColumn] ?? ''}".`,
			);

			continue;
		}

		const sameDayIndex = gamesPerDate.get(date) ?? 0;

		const gameMinutes = baseMinutes + spacing * sameDayIndex;

		if (gameMinutes >= 24 * 60) {
			errors.push(`Row ${csvRowNumber}: generated time passes midnight.`);

			continue;
		}

		const score1 = parseRequiredInteger(row[player1ScoreColumn] ?? '');

		const score2 = parseRequiredInteger(row[player2ScoreColumn] ?? '');

		if (score1 === null) {
			errors.push(`Row ${csvRowNumber}: invalid Player 1 score.`);

			continue;
		}

		if (score2 === null) {
			errors.push(`Row ${csvRowNumber}: invalid Player 2 score.`);

			continue;
		}

		const high1 =
			player1HighColumn === null
				? null
				: parseOptionalInteger(row[player1HighColumn] ?? '');

		const high2 =
			player2HighColumn === null
				? null
				: parseOptionalInteger(row[player2HighColumn] ?? '');

		if (high1 === undefined) {
			errors.push(`Row ${csvRowNumber}: invalid Player 1 high hand.`);

			continue;
		}

		if (high2 === undefined) {
			errors.push(`Row ${csvRowNumber}: invalid Player 2 high hand.`);

			continue;
		}

		const dealerResult = parseDealer(
			firstDealerColumn === null ? '' : (row[firstDealerColumn] ?? ''),
			player1,
			player2,
		);

		if (dealerResult === undefined) {
			errors.push(
				`Row ${csvRowNumber}: first dealer does not match "${player1}" or "${player2}".`,
			);

			continue;
		}

		gamesPerDate.set(date, sameDayIndex + 1);

		games.push({
			playedDate: date,
			playedTime: formatMinutes(gameMinutes),
			player1,
			player2,
			firstDealer: dealerResult,
			player1Score: score1,
			player2Score: score2,
			player1HighHandManual: high1,
			player2HighHandManual: high2,
			handDataIncomplete: true,
		});
	}

	return {
		games,
		errors,
	};
}

function getRequiredColumn(select: HTMLSelectElement): number | null {
	if (select.value === '') {
		return null;
	}

	const value = Number(select.value);

	return Number.isInteger(value) ? value : null;
}

function getOptionalColumn(select: HTMLSelectElement): number | null {
	return getRequiredColumn(select);
}
