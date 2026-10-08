export interface GameRecord {
	id: string;
	playedDate: string;
	playedTime: string;
	player1: string;
	player2: string;
	firstDealer: 1 | 2 | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHandManual: number | null;
	player2HighHandManual: number | null;
	handDataIncomplete: boolean;
}

export interface GameInput {
	playedDate: string;
	playedTime: string;
	player1: string;
	player2: string;
	firstDealer: 1 | 2 | null;
	player1Score: number | null;
	player2Score: number | null;
	player1HighHandManual: number | null;
	player2HighHandManual: number | null;
	handDataIncomplete?: boolean;
}

export interface HandRecord {
	id: string;
	gameId: string;
	handNumber: number;
	dealer: 1 | 2 | null;
	player1HandPoints: number | null;
	player2HandPoints: number | null;
	cribPoints: number | null;

	player1HandEligibilityOverride: boolean | null;
	player2HandEligibilityOverride: boolean | null;
	cribEligibilityOverride: boolean | null;

	isLastHand: boolean;
}

export interface GameHandSummary {
	roundCount: number;
	eligibleRoundCount: number;

	player1HandPointsTotal: number;
	player2HandPointsTotal: number;

	player1HandPointsEligible: number;
	player2HandPointsEligible: number;

	player1EligibleHandCount: number;
	player2EligibleHandCount: number;

	player1CribPointsTotal: number;
	player2CribPointsTotal: number;

	player1CribPointsEligible: number;
	player2CribPointsEligible: number;

	player1CribCount: number;
	player2CribCount: number;

	player1EligibleCribCount: number;
	player2EligibleCribCount: number;

	player1PeggingPointsTotal: number;
	player2PeggingPointsTotal: number;

	player1HighHandCalculated: number | null;
	player2HighHandCalculated: number | null;
}

export interface GameStatisticsRecord {
	id: string;
	playedDate: string;
	playedTime: string;

	player1: string;
	player2: string;

	firstDealer: 1 | 2 | null;

	player1Score: number | null;
	player2Score: number | null;

	player1HighHandManual: number | null;
	player2HighHandManual: number | null;

	player1HighHandCalculated: number | null;
	player2HighHandCalculated: number | null;

	handDataIncomplete: boolean;

	roundCount: number;
	eligibleRoundCount: number;

	player1HandPointsEligible: number;
	player2HandPointsEligible: number;

	player1CribPointsEligible: number;
	player2CribPointsEligible: number;

	player1EligibleCribCount: number;
	player2EligibleCribCount: number;

	player1PeggingPointsTotal: number;
	player2PeggingPointsTotal: number;
}

export interface HandStatisticsRecord {
	id: string;
	gameId: string;

	playedDate: string;
	playedTime: string;

	handNumber: number;
	isLastHand: boolean;

	player1: string;
	player2: string;

	firstDealer: 1 | 2;

	player1HandPoints: number | null;
	player2HandPoints: number | null;

	cribPoints: number | null;

	player1HandEligibilityOverride: boolean | null;
	player2HandEligibilityOverride: boolean | null;
	cribEligibilityOverride: boolean | null;

	handDataIncomplete: boolean;
}

export type CustomMetricDataSource = 'games' | 'hands';

export type CustomMetricCalculationMode = 'builder' | 'sql';

export type CustomMetricFormatMode =
	| 'integer'
	| 'decimal'
	| 'percentage'
	| 'custom';

export type CustomMetricMatchupMode = 'combined' | 'per_player';

export interface CustomMetricRecord {
	id: string;
	name: string;

	dataSource: CustomMetricDataSource;

	calculationMode: CustomMetricCalculationMode;

	builderFormula: string;
	sqlQuery: string;

	formatMode: CustomMetricFormatMode;

	decimalPlaces: number;

	prefix: string;
	suffix: string;

	formatExpression: string;

	showGlobal: boolean;
	showPlayer: boolean;
	showMatchup: boolean;

	matchupMode: CustomMetricMatchupMode;

	enabled: boolean;
	sortOrder: number;
}

export interface CustomMetricInput {
	name: string;

	dataSource: CustomMetricDataSource;

	calculationMode: CustomMetricCalculationMode;

	builderFormula: string;
	sqlQuery: string;

	formatMode: CustomMetricFormatMode;

	decimalPlaces: number;

	prefix: string;
	suffix: string;

	formatExpression: string;

	showGlobal: boolean;
	showPlayer: boolean;
	showMatchup: boolean;

	matchupMode: CustomMetricMatchupMode;

	enabled: boolean;
	sortOrder: number;
}

export interface CustomMetricSqlObservation {
	gameId: string;
	playedDate: string;
	playedTime: string;

	player: string;
	opponent: string;
	playerSide: 1 | 2;

	score: number | null;
	opponentScore: number | null;

	margin: number | null;
	scoreDifferential: number | null;

	won: number | null;
	lost: number | null;

	highHand: number | null;
	opponentHighHand: number | null;
	higherHighHand: number | null;

	dealerFirst: number | null;
	poneFirst: number | null;

	skunk: number | null;
	doubleSkunk: number | null;

	handDataComplete: number;
}

export interface CustomMetricSqlHandObservation {
	gameId: string;
	handId: string;

	playedDate: string;
	playedTime: string;

	player: string;
	opponent: string;

	playerSide: 1 | 2;

	handNumber: number;

	handPoints: number | null;
	opponentHandPoints: number | null;

	cribPoints: number | null;
	roundCribPoints: number | null;

	dealer: number;
	pone: number;

	lastHand: number;
	eligibleHand: number;

	handDataComplete: number;
}

export interface CustomMetricSqlContext {
	scope: 'global' | 'player' | 'matchup';

	selectedPlayer: string | null;

	matchupPlayer1: string | null;
	matchupPlayer2: string | null;

	subjectPlayer: string | null;
}

export interface CustomMetricSqlResult {
	value: number | null;
	error: string | null;
}

export interface HandInput {
	player1HandPoints: number | null;
	player2HandPoints: number | null;
	cribPoints: number | null;

	player1HandEligibilityOverride?: boolean | null;
	player2HandEligibilityOverride?: boolean | null;
	cribEligibilityOverride?: boolean | null;
}

export type SaveDatabase = () => Promise<void>;

export type CreateId = () => string;