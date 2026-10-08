import type { GameRecord } from '../database/database';

export function parseOptionalScore(value: string): number | null | undefined {
	const trimmed = value.trim();

	if (trimmed === '') {
		return null;
	}

	const parsed = Number(trimmed);

	if (!Number.isInteger(parsed) || parsed < 0) {
		return undefined;
	}

	return parsed;
}

export function getScoreText(game: GameRecord): string {
	if (game.player1Score === null && game.player2Score === null) {
		return '—';
	}

	return `${game.player1Score ?? '—'} - ${game.player2Score ?? '—'}`;
}

export function getWinnerText(game: GameRecord): string {
	if (game.player1Score === null || game.player2Score === null) {
		return '—';
	}

	if (game.player1Score === game.player2Score) {
		return 'Tie';
	}

	return game.player1Score > game.player2Score ? game.player1 : game.player2;
}

export function getMarginText(game: GameRecord): string {
	if (game.player1Score === null || game.player2Score === null) {
		return '—';
	}

	return String(Math.abs(game.player1Score - game.player2Score));
}

export function getMarginValue(game: GameRecord): number | null {
	if (game.player1Score === null || game.player2Score === null) {
		return null;
	}

	return Math.abs(game.player1Score - game.player2Score);
}

export function getCurrentDateTime(): {
	date: string;
	time: string;
} {
	const now = new Date();

	const year = String(now.getFullYear());

	const month = String(now.getMonth() + 1).padStart(2, '0');

	const day = String(now.getDate()).padStart(2, '0');

	const hours = String(now.getHours()).padStart(2, '0');

	const minutes = String(now.getMinutes()).padStart(2, '0');

	return {
		date: `${year}-${month}-${day}`,
		time: `${hours}:${minutes}`,
	};
}
