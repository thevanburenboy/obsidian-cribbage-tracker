export interface PlayerAggregate {
	name: string;

	games: number;
	wins: number;
	losses: number;

	totalScore: number;
	totalDifferential: number;
	victoryMarginTotal: number;

	bestHighHand: number | null;

	dealerGames: number;
	dealerWins: number;
	dealerLosses: number;

	poneGames: number;
	poneWins: number;
	poneLosses: number;

	highHandComparableGames: number;
	higherHighHandGames: number;

	skunkWins: number;
	doubleSkunkWins: number;

	handPointsTotal: number;
	handCount: number;

	cribPointsTotal: number;
	cribCount: number;

	peggingPointsTotal: number;
	peggingRoundCount: number;
}

export interface RankedItem {
	label: string;
	value: number;
	displayValue: string;
	subtext?: string;
}

export interface RankedItemWithRank
	extends RankedItem {
	rank: number;
}

export interface RecordOccurrence {
	score: number;

	player: string;
	opponent: string;

	playedDate: string;
	playedTime: string;
}

export interface SkunkWinOccurrence {
	player: string;
	opponent: string;

	playedDate: string;
	playedTime: string;
}

export interface WinningStreakOccurrence {
	length: number;
	player: string;

	startDate: string;
	startTime: string;

	endDate: string;
	endTime: string;

	active: boolean;
}

export interface GroupedStreakRow {
	rank: number;

	length: number;
	count: number;

	label: string;
	subtext: string;

	activeSingleton: boolean;
}

export interface GroupedRecordRow {
	rank: number;

	score: number;
	count: number;

	label: string;
	subtext: string;
}

export interface RecordContributor {
	name: string;
	count: number;

	latestDate: string;
	latestTime: string;
}

export interface GameLengthOccurrence {
	hands: number;

	player1: string;
	player2: string;

	playedDate: string;
	playedTime: string;
}

export interface GroupedGameLengthRow {
	rank: number;

	hands: number;
	count: number;

	label: string;
	subtext: string;
}