import type {
	InferredColumns,
} from './types';

export function inferColumns(
	headers: string[],
): InferredColumns {
	const normalized =
		headers.map(normalizeHeader);

	const date =
		findHeader(
			normalized,
			['date'],
		);

	const firstDealer =
		findHeader(
			normalized,
			[
				'first deal',
				'first dealer',
			],
		);

	const scoreColumns =
		headers
			.map(
				(header, index) => ({
					header,
					index,
				}),
			)
			.filter(
				(item) =>
					/\bscore\b/i.test(
						item.header,
					) &&
					!/\bhigh\b/i.test(
						item.header,
					),
			);

	let player1Name = '';
	let player2Name = '';

	if (scoreColumns.length >= 2) {
		player1Name =
			scoreColumns[0]
				?.header.replace(
					/\s+score\s*$/i,
					'',
				)
				.trim() ?? '';

		player2Name =
			scoreColumns[1]
				?.header.replace(
					/\s+score\s*$/i,
					'',
				)
				.trim() ?? '';
	}

	const player1Score =
		findPlayerColumn(
			headers,
			player1Name,
			'score',
		) ??
		scoreColumns[0]?.index ??
		null;

	const player2Score =
		findPlayerColumn(
			headers,
			player2Name,
			'score',
		) ??
		scoreColumns[1]?.index ??
		null;

	const player1HighHand =
		findPlayerColumn(
			headers,
			player1Name,
			'high hand',
		);

	const player2HighHand =
		findPlayerColumn(
			headers,
			player2Name,
			'high hand',
		);

	return {
		player1Name,
		player2Name,
		date,
		firstDealer,
		player1Score,
		player2Score,
		player1HighHand,
		player2HighHand,
	};
}

function normalizeHeader(
	value: string,
): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, ' ');
}

function findHeader(
	headers: string[],
	candidates: string[],
): number | null {
	for (const candidate of candidates) {
		const index =
			headers.indexOf(
				candidate.toLocaleLowerCase(),
			);

		if (index >= 0) {
			return index;
		}
	}

	return null;
}

function findPlayerColumn(
	headers: string[],
	player: string,
	suffix: string,
): number | null {
	if (!player) {
		return null;
	}

	const target =
		normalizeHeader(
			`${player} ${suffix}`,
		);

	const index =
		headers.findIndex(
			(header) =>
				normalizeHeader(header) ===
				target,
		);

	return index >= 0
		? index
		: null;
}