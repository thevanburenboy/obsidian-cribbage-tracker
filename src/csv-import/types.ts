import type { GameInput } from '../database/database';

export interface CsvData {
	fileName: string;
	headers: string[];
	rows: string[][];
}

export interface ImportBuildResult {
	games: GameInput[];
	errors: string[];
}

export interface ImportControls {
	player1Input: HTMLInputElement;
	player2Input: HTMLInputElement;
	dateSelect: HTMLSelectElement;
	firstDealerSelect: HTMLSelectElement;
	player1ScoreSelect: HTMLSelectElement;
	player2ScoreSelect: HTMLSelectElement;
	player1HighSelect: HTMLSelectElement;
	player2HighSelect: HTMLSelectElement;
	baseTimeInput: HTMLInputElement;
	spacingInput: HTMLInputElement;
}

export interface InferredColumns {
	player1Name: string;
	player2Name: string;
	date: number | null;
	firstDealer: number | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHand: number | null;
	player2HighHand: number | null;
}
