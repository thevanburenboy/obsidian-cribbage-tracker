export function parseCsv(
	text: string,
): string[][] {
	const source =
		text.replace(/^\uFEFF/, '');

	const rows: string[][] = [];

	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (
		let index = 0;
		index < source.length;
		index++
	) {
		const char =
			source[index];

		if (quoted) {
			if (char === '"') {
				if (
					source[index + 1] ===
					'"'
				) {
					field += '"';
					index++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}

			continue;
		}

		if (char === '"') {
			quoted = true;
			continue;
		}

		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}

		if (
			char === '\n' ||
			char === '\r'
		) {
			if (
				char === '\r' &&
				source[index + 1] === '\n'
			) {
				index++;
			}

			row.push(field);
			rows.push(row);

			row = [];
			field = '';

			continue;
		}

		field += char;
	}

	row.push(field);

	if (
		row.length > 1 ||
		row[0]?.trim() !== ''
	) {
		rows.push(row);
	}

	return rows;
}

export function parseDealer(
	value: string,
	player1: string,
	player2: string,
): 1 | 2 | null | undefined {
	const trimmed =
		value.trim();

	if (!trimmed) {
		return null;
	}

	const normalized =
		trimmed.toLocaleLowerCase();

	if (
		normalized ===
			player1.toLocaleLowerCase() ||
		normalized === '1' ||
		normalized === 'p1' ||
		normalized === 'player 1'
	) {
		return 1;
	}

	if (
		normalized ===
			player2.toLocaleLowerCase() ||
		normalized === '2' ||
		normalized === 'p2' ||
		normalized === 'player 2'
	) {
		return 2;
	}

	return undefined;
}

export function parseRequiredInteger(
	value: string,
): number | null {
	const parsed =
		parseOptionalInteger(value);

	return typeof parsed === 'number'
		? parsed
		: null;
}

export function parseOptionalInteger(
	value: string,
): number | null | undefined {
	const trimmed =
		value.trim();

	if (!trimmed) {
		return null;
	}

	const parsed =
		Number(trimmed);

	if (
		!Number.isInteger(parsed) ||
		parsed < 0
	) {
		return undefined;
	}

	return parsed;
}

export function parseCsvDate(
	value: string,
): string | null {
	const trimmed =
		value.trim();

	const iso =
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/
			.exec(trimmed);

	if (iso) {
		return validateAndFormatDate(
			Number(iso[1]),
			Number(iso[2]),
			Number(iso[3]),
		);
	}

	const us =
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
			.exec(trimmed);

	if (us) {
		return validateAndFormatDate(
			Number(us[3]),
			Number(us[1]),
			Number(us[2]),
		);
	}

	return null;
}

function validateAndFormatDate(
	year: number,
	month: number,
	day: number,
): string | null {
	const date =
		new Date(
			Date.UTC(
				year,
				month - 1,
				day,
			),
		);

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !==
			month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	return [
		String(year).padStart(4, '0'),
		String(month).padStart(2, '0'),
		String(day).padStart(2, '0'),
	].join('-');
}

export function parseTimeToMinutes(
	value: string,
): number | null {
	const match =
		/^(\d{1,2}):(\d{2})$/
			.exec(value.trim());

	if (!match) {
		return null;
	}

	const hours =
		Number(match[1]);

	const minutes =
		Number(match[2]);

	if (
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return hours * 60 + minutes;
}

export function formatMinutes(
	total: number,
): string {
	const hours =
		Math.floor(total / 60);

	const minutes =
		total % 60;

	return (
		`${String(hours).padStart(2, '0')}:` +
		`${String(minutes).padStart(2, '0')}`
	);
}