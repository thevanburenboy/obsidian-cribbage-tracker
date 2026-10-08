export interface Metric {
	label: string;
	value: string;
	subtext?: string;
	valueClass?: string;
}

export interface ContextRecordOccurrence {
	value: number;

	player: string;
	opponent: string;

	playedDate: string;
	playedTime: string;
}

export interface ContextStreakOccurrence {
	type: 'W' | 'L';
	length: number;

	player: string;

	startDate: string;
	startTime: string;

	endDate: string;
	endTime: string;

	active: boolean;
}

export interface SkunkContextOccurrence {
	winner: string;
	loser: string;

	winnerScore: number;
	loserScore: number;

	playedDate: string;
	playedTime: string;

	doubleSkunk: boolean;
}

export interface StatisticContext {
	highHand?: string;

	highestHighHandInLoss?: string;

	lowestHighHandInWin?: string;

	currentStreak?: string;

	longestWinStreak?: string;

	longestLossStreak?: string;

	skunkWin?: string;
	skunkLoss?: string;

	doubleSkunkWin?: string;
	doubleSkunkLoss?: string;

	globalSkunkGame?: string;
	globalDoubleSkunkGame?: string;
}

export interface ScopedRecordStat {
	value: number | null;
	count: number;
	subtext?: string;
}

export interface GameLengthOccurrence {
	value: number;

	player1: string;
	player2: string;

	playedDate: string;
	playedTime: string;
}

export interface ScopedExtraStats {
	averageVictoryMargin: number | null;

	highestAverageHand: ScopedRecordStat;
	lowestAverageHand: ScopedRecordStat;

	largestFinalCountDeficit: ScopedRecordStat;

	mostFinalCountPointsWin: ScopedRecordStat;
	mostFinalCountPointsLoss: ScopedRecordStat;

	largestSingleRoundCount: ScopedRecordStat;

	averageGameLength: number | null;

	quickestGame: ScopedRecordStat;
	longestGame: ScopedRecordStat;
}

export interface PlayerStats {
	games: number;
	wins: number;	losses: number;
	winPercent: number | null;
	ppg: number | null;
	scoreDifferential: number | null;
	highHand: number | null;
	pointsPerHand: number | null;
	pointsPerCrib: number | null;
	peggingPerRound: number | null;
	completeHandLogs: number;

	higherHighHandCount: number;
	tiedHighHandCount: number;
	lowerHighHandCount: number;

	highestHighHandInLoss: number | null;
	highestHighHandInLossCount: number;

	lowestHighHandInWin: number | null;
	lowestHighHandInWinCount: number;

	dealerFirstWins: number;
	dealerFirstLosses: number;

	poneFirstWins: number;
	poneFirstLosses: number;

	skunkWins: number;
	skunkLosses: number;

	doubleSkunkWins: number;
	doubleSkunkLosses: number;

	currentStreakType: 'W' | 'L' | null;
	currentStreakCount: number;

	longestWinStreak: number;
	longestLossStreak: number;
}

export interface HighHandWinObservation {
	highHand: number;
	won: boolean;
}

export type StatisticsScope = 'global' | 'player' | 'matchup';
