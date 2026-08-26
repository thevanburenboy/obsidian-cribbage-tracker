import type {
	CribbageDatabase,
	CustomMetricFormatMode,
	CustomMetricSqlContext,
	CustomMetricSqlObservation,
	GameStatisticsRecord,
    CustomMetricSqlHandObservation,
    HandStatisticsRecord,
} from './database';

type ObservationValue =
	| number
	| boolean
	| null;

type GameObservation =
	Record<
		string,
		ObservationValue
	>;

const GAME_FIELDS =
	new Set([
		'SCORE',
		'OPPONENTSCORE',
		'MARGIN',
		'SCOREDIFFERENTIAL',
		'WON',
		'LOST',
		'HIGHHAND',
		'OPPONENTHIGHHAND',
		'HIGHERHIGHHAND',
		'DEALERFIRST',
		'PONEFIRST',
		'SKUNK',
		'DOUBLESKUNK',
		'HANDDATACOMPLETE',
	]);

const HAND_FIELDS =
	new Set([
		'HANDPOINTS',
		'OPPONENTHANDPOINTS',

		'CRIBPOINTS',
		'ROUNDCRIBPOINTS',

		'HANDNUMBER',

		'DEALER',
		'PONE',

		'LASTHAND',
		'ELIGIBLEHAND',

		'HANDDATACOMPLETE',
	]);

export type MetricEvaluationScope =
	| {
			type: 'global';
	  }
	| {
			type: 'player';
			player: string;
	  }
	| {
			type: 'matchup';
			player1: string;
			player2: string;
			subject?: string;
	  };

export interface MetricEvaluationResult {
	value: number | null;
	error: string | null;
	observationCount: number;
}

interface Token {
	type:
		| 'number'
		| 'identifier'
		| 'operator'
		| 'lparen'
		| 'rparen'
		| 'comma'
		| 'eof';

	value: string;
}

export function evaluateBuilderMetric(
	formula: string,
	games: GameStatisticsRecord[],
	scope: MetricEvaluationScope,
): MetricEvaluationResult {
	const observations =
		buildGameObservations(
			games,
			scope,
		);

	if (!formula.trim()) {
		return {
			value: null,
			error: 'Formula is empty.',
			observationCount:
				observations.length,
		};
	}

	try {
		const tokens =
			tokenize(formula);

        const parser =
            new FormulaParser(
                tokens,
                observations,
                GAME_FIELDS,
            );

		const value =
			parser.parse();

		if (
			value !== null &&
			!Number.isFinite(value)
		) {
			throw new Error(
				'Formula did not return a finite number.',
			);
		}

		return {
			value,
			error: null,
			observationCount:
				observations.length,
		};
	} catch (error) {
		return {
			value: null,

			error:
				error instanceof Error
					? error.message
					: 'Formula evaluation failed.',

			observationCount:
				observations.length,
		};
	}
}

export function evaluateHandsBuilderMetric(
	formula: string,
	hands: HandStatisticsRecord[],
	scope: MetricEvaluationScope,
): MetricEvaluationResult {
	const observations =
		buildHandObservations(
			hands,
			scope,
		);

	if (!formula.trim()) {
		return {
			value: null,
			error:
				'Formula is empty.',

			observationCount:
				observations.length,
		};
	}

	try {
		const tokens =
			tokenize(formula);

		const parser =
			new FormulaParser(
				tokens,
				observations,
				HAND_FIELDS,
			);

		const value =
			parser.parse();

		if (
			value !== null &&
			!Number.isFinite(value)
		) {
			throw new Error(
				'Formula did not return a finite number.',
			);
		}

		return {
			value,
			error: null,

			observationCount:
				observations.length,
		};
	} catch (error) {
		return {
			value: null,

			error:
				error instanceof Error
					? error.message
					: 'Hands formula evaluation failed.',

			observationCount:
				observations.length,
		};
	}
}

export function evaluateSqlMetric(
	database: CribbageDatabase,
	query: string,

	games: GameStatisticsRecord[],
	hands: HandStatisticsRecord[],

	scope: MetricEvaluationScope,
): MetricEvaluationResult {
	if (!query.trim()) {
		return {
			value: null,
			error:
				'SQL query is empty.',
			observationCount: 0,
		};
	}

	const observations =
		buildSqlMetricObservations(
			games,
			scope,
		);

    const handObservations =
        buildSqlHandObservations(
            hands,
            scope,
        );

	const context =
		buildSqlContext(
			scope,
		);

	const result =
        database.evaluateCustomMetricSql(
            query,
            observations,
            handObservations,
            context,
        );

	return {
		value: result.value,
		error: result.error,

		observationCount:
			observations.length,
	};
}

export function formatMetricResult(
	value: number | null,
	mode: CustomMetricFormatMode,
	decimalPlaces: number,
	prefix: string,
	suffix: string,
): string {
	if (value === null) {
		return '—';
	}

	let formatted: string;

	if (mode === 'integer') {
		formatted =
			Math.round(value).toString();
	} else if (
		mode === 'percentage'
	) {
		formatted =
			`${(value * 100).toFixed(
				decimalPlaces,
			)}%`;
	} else if (
		mode === 'custom'
	) {
		/*
		 * Custom formatting expressions are
		 * implemented in the next pass.
		 *
		 * For now, show the raw numeric result.
		 */
		formatted =
			String(value);
	} else {
		formatted =
			value.toFixed(
				decimalPlaces,
			);
	}

	return (
		prefix +
		formatted +
		suffix
	);
}

function buildGameObservations(
	games: GameStatisticsRecord[],
	scope: MetricEvaluationScope,
): GameObservation[] {
	const observations:
		GameObservation[] = [];

	for (const game of games) {
		if (
			scope.type === 'matchup' &&
			!gameContainsPlayers(
				game,
				scope.player1,
				scope.player2,
			)
		) {
			continue;
		}

		for (
			const side of [1, 2] as const
		) {
			const player =
				side === 1
					? game.player1
					: game.player2;

			if (
				scope.type ===
					'player' &&
				player !== scope.player
			) {
				continue;
			}

			if (
				scope.type ===
					'matchup' &&
				scope.subject &&
				player !== scope.subject
			) {
				continue;
			}

			observations.push(
				buildObservation(
					game,
					side,
				),
			);
		}
	}

	return observations;
}

function buildHandObservations(
	hands: HandStatisticsRecord[],
	scope: MetricEvaluationScope,
): GameObservation[] {
	const observations:
		GameObservation[] = [];

	for (const hand of hands) {
		if (
			scope.type ===
				'matchup' &&
			!handContainsPlayers(
				hand,
				scope.player1,
				scope.player2,
			)
		) {
			continue;
		}

		for (
			const side of [1, 2] as const
		) {
			const player =
				side === 1
					? hand.player1
					: hand.player2;

			if (
				scope.type ===
					'player' &&
				player !== scope.player
			) {
				continue;
			}

			if (
				scope.type ===
					'matchup' &&
				scope.subject &&
				player !==
					scope.subject
			) {
				continue;
			}

			const dealer =
				getHandDealer(
					hand.firstDealer,
					hand.handNumber,
				);

			const isDealer =
				dealer === side;

			const handPoints =
				side === 1
					? hand.player1HandPoints
					: hand.player2HandPoints;

			const opponentHandPoints =
				side === 1
					? hand.player2HandPoints
					: hand.player1HandPoints;

			observations.push({
				HANDPOINTS:
					handPoints,

				OPPONENTHANDPOINTS:
					opponentHandPoints,

				CRIBPOINTS:
					isDealer
						? hand.cribPoints
						: null,

				ROUNDCRIBPOINTS:
					hand.cribPoints,

				HANDNUMBER:
					hand.handNumber,

				DEALER:
					isDealer,

				PONE:
					!isDealer,

				LASTHAND:
					hand.isLastHand,

				ELIGIBLEHAND:
					!hand.isLastHand,

				HANDDATACOMPLETE:
					!hand
						.handDataIncomplete,
			});
		}
	}

	return observations;
}

function buildSqlMetricObservations(
	games: GameStatisticsRecord[],
	scope: MetricEvaluationScope,
): CustomMetricSqlObservation[] {
	const observations:
		CustomMetricSqlObservation[] = [];

	for (const game of games) {
		if (
			scope.type === 'matchup' &&
			!gameContainsPlayers(
				game,
				scope.player1,
				scope.player2,
			)
		) {
			continue;
		}

		for (
			const side of [1, 2] as const
		) {
			const player =
				side === 1
					? game.player1
					: game.player2;

			const opponent =
				side === 1
					? game.player2
					: game.player1;

			if (
				scope.type ===
					'player' &&
				player !==
					scope.player
			) {
				continue;
			}

			if (
				scope.type ===
					'matchup' &&
				scope.subject &&
				player !==
					scope.subject
			) {
				continue;
			}

			const score =
				side === 1
					? game.player1Score
					: game.player2Score;

			const opponentScore =
				side === 1
					? game.player2Score
					: game.player1Score;

			const highHand =
				effectiveHighHand(
					game,
					side,
				);

			const opponentHighHand =
				effectiveHighHand(
					game,
					side === 1
						? 2
						: 1,
				);

			const hasScores =
				score !== null &&
				opponentScore !==
					null;

			const won =
				hasScores
					? score >
						opponentScore
					: null;

			const lost =
				hasScores
					? score <
						opponentScore
					: null;

			const margin =
				hasScores
					? Math.abs(
							score -
								opponentScore,
						)
					: null;

			const scoreDifferential =
				hasScores
					? score -
						opponentScore
					: null;

			const higherHighHand =
				highHand !== null &&
				opponentHighHand !==
					null
					? highHand >
						opponentHighHand
					: null;

			const dealerFirst =
				game.firstDealer ===
					null
					? null
					: game.firstDealer ===
						side;

			const poneFirst =
				dealerFirst === null
					? null
					: !dealerFirst;

			let skunk:
				boolean | null = null;

			let doubleSkunk:
				boolean | null = null;

			if (
				hasScores &&
				won !== null
			) {
				if (!won) {
					skunk = false;
					doubleSkunk =
						false;
				} else if (
					opponentScore <=
					60
				) {
					skunk = false;
					doubleSkunk =
						true;
				} else if (
					opponentScore <=
					90
				) {
					skunk = true;
					doubleSkunk =
						false;
				} else {
					skunk = false;
					doubleSkunk =
						false;
				}
			}

			observations.push({
				gameId:
					game.id,

				playedDate:
					game.playedDate,

				playedTime:
					game.playedTime,

				player,
				opponent,

				playerSide:
					side,

				score,

				opponentScore,

				margin,

				scoreDifferential,

				won:
					toSqlBoolean(
						won,
					),

				lost:
					toSqlBoolean(
						lost,
					),

				highHand,

				opponentHighHand,

				higherHighHand:
					toSqlBoolean(
						higherHighHand,
					),

				dealerFirst:
					toSqlBoolean(
						dealerFirst,
					),

				poneFirst:
					toSqlBoolean(
						poneFirst,
					),

				skunk:
					toSqlBoolean(
						skunk,
					),

				doubleSkunk:
					toSqlBoolean(
						doubleSkunk,
					),

				handDataComplete:
					game.handDataIncomplete
						? 0
						: 1,
			});
		}
	}

	return observations;
}

function buildSqlHandObservations(
	hands: HandStatisticsRecord[],
	scope: MetricEvaluationScope,
): CustomMetricSqlHandObservation[] {
	const observations:
		CustomMetricSqlHandObservation[] =
			[];

	for (const hand of hands) {
		if (
			scope.type ===
				'matchup' &&
			!handContainsPlayers(
				hand,
				scope.player1,
				scope.player2,
			)
		) {
			continue;
		}

		for (
			const side of [1, 2] as const
		) {
			const player =
				side === 1
					? hand.player1
					: hand.player2;

			const opponent =
				side === 1
					? hand.player2
					: hand.player1;

			if (
				scope.type ===
					'player' &&
				player !== scope.player
			) {
				continue;
			}

			if (
				scope.type ===
					'matchup' &&
				scope.subject &&
				player !==
					scope.subject
			) {
				continue;
			}

			const dealer =
				getHandDealer(
					hand.firstDealer,
					hand.handNumber,
				);

			const isDealer =
				dealer === side;

			observations.push({
				gameId:
					hand.gameId,

				handId:
					hand.id,

				playedDate:
					hand.playedDate,

				playedTime:
					hand.playedTime,

				player,
				opponent,

				playerSide:
					side,

				handNumber:
					hand.handNumber,

				handPoints:
					side === 1
						? hand
								.player1HandPoints
						: hand
								.player2HandPoints,

				opponentHandPoints:
					side === 1
						? hand
								.player2HandPoints
						: hand
								.player1HandPoints,

				cribPoints:
					isDealer
						? hand.cribPoints
						: null,

				roundCribPoints:
					hand.cribPoints,

				dealer:
					isDealer
						? 1
						: 0,

				pone:
					isDealer
						? 0
						: 1,

				lastHand:
					hand.isLastHand
						? 1
						: 0,

				eligibleHand:
					hand.isLastHand
						? 0
						: 1,

				handDataComplete:
					hand
						.handDataIncomplete
						? 0
						: 1,
			});
		}
	}

	return observations;
}

function toSqlBoolean(
	value: boolean | null,
): number | null {
	if (value === null) {
		return null;
	}

	return value ? 1 : 0;
}

function buildSqlContext(
	scope: MetricEvaluationScope,
): CustomMetricSqlContext {
	if (scope.type === 'global') {
		return {
			scope: 'global',

			selectedPlayer:
				null,

			matchupPlayer1:
				null,

			matchupPlayer2:
				null,

			subjectPlayer:
				null,
		};
	}

	if (scope.type === 'player') {
		return {
			scope: 'player',

			selectedPlayer:
				scope.player,

			matchupPlayer1:
				null,

			matchupPlayer2:
				null,

			subjectPlayer:
				scope.player,
		};
	}

	return {
		scope: 'matchup',

		selectedPlayer:
			scope.subject ??
			null,

		matchupPlayer1:
			scope.player1,

		matchupPlayer2:
			scope.player2,

		subjectPlayer:
			scope.subject ??
			null,
	};
}

function buildObservation(
	game: GameStatisticsRecord,
	side: 1 | 2,
): GameObservation {
	const score =
		side === 1
			? game.player1Score
			: game.player2Score;

	const opponentScore =
		side === 1
			? game.player2Score
			: game.player1Score;

	const highHand =
		effectiveHighHand(
			game,
			side,
		);

	const opponentHighHand =
		effectiveHighHand(
			game,
			side === 1 ? 2 : 1,
		);

	const hasScores =
		score !== null &&
		opponentScore !== null;

	const won =
		hasScores
			? score > opponentScore
			: null;

	const lost =
		hasScores
			? score < opponentScore
			: null;

	const margin =
		hasScores
			? Math.abs(
					score -
						opponentScore,
				)
			: null;

	const scoreDifferential =
		hasScores
			? score -
				opponentScore
			: null;

	const higherHighHand =
		highHand !== null &&
		opponentHighHand !== null
			? highHand >
				opponentHighHand
			: null;

	const dealerFirst =
		game.firstDealer === null
			? null
			: game.firstDealer === side;

	const poneFirst =
		dealerFirst === null
			? null
			: !dealerFirst;

	let skunk:
		boolean | null = null;

	let doubleSkunk:
		boolean | null = null;

	if (
		hasScores &&
		won !== null
	) {
		if (!won) {
			skunk = false;
			doubleSkunk = false;
		} else if (
			opponentScore <= 60
		) {
			skunk = false;
			doubleSkunk = true;
		} else if (
			opponentScore <= 90
		) {
			skunk = true;
			doubleSkunk = false;
		} else {
			skunk = false;
			doubleSkunk = false;
		}
	}

	return {
		SCORE: score,

		OPPONENTSCORE:
			opponentScore,

		MARGIN:
			margin,

		SCOREDIFFERENTIAL:
			scoreDifferential,

		WON: won,
		LOST: lost,

		HIGHHAND:
			highHand,

		OPPONENTHIGHHAND:
			opponentHighHand,

		HIGHERHIGHHAND:
			higherHighHand,

		DEALERFIRST:
			dealerFirst,

		PONEFIRST:
			poneFirst,

		SKUNK:
			skunk,

		DOUBLESKUNK:
			doubleSkunk,

		HANDDATACOMPLETE:
			!game.handDataIncomplete,
	};
}

function effectiveHighHand(
	game: GameStatisticsRecord,
	side: 1 | 2,
): number | null {
	if (side === 1) {
		if (
			game.player1HighHandManual !==
			null
		) {
			return (
				game.player1HighHandManual
			);
		}

		if (
			game.handDataIncomplete
		) {
			return null;
		}

		return (
			game.player1HighHandCalculated
		);
	}

	if (
		game.player2HighHandManual !== null
	) {
		return (
			game.player2HighHandManual
		);
	}

	if (game.handDataIncomplete) {
		return null;
	}

	return (
		game.player2HighHandCalculated
	);
}

function gameContainsPlayers(
	game: GameStatisticsRecord,
	player1: string,
	player2: string,
): boolean {
	return (
		(
			game.player1 === player1 &&
			game.player2 === player2
		) ||
		(
			game.player1 === player2 &&
			game.player2 === player1
		)
	);
}

function handContainsPlayers(
	hand: HandStatisticsRecord,
	player1: string,
	player2: string,
): boolean {
	return (
		(
			hand.player1 === player1 &&
			hand.player2 === player2
		) ||
		(
			hand.player1 === player2 &&
			hand.player2 === player1
		)
	);
}

function getHandDealer(
	firstDealer: 1 | 2,
	handNumber: number,
): 1 | 2 {
	if (
		handNumber % 2 === 1
	) {
		return firstDealer;
	}

	return firstDealer === 1
		? 2
		: 1;
}

class FormulaParser {
	private position = 0;

    constructor(
        private tokens: Token[],
        private observations:
            GameObservation[],
        private allowedFields:
            Set<string>,
    ) {}

	parse(): number | null {
		const value =
			this.parseAdditive();

		if (
			this.current().type !== 'eof'
		) {
			throw new Error(
				`Unexpected token "${this.current().value}".`,
			);
		}

		return value;
	}

	private parseAdditive():
		number | null {
		let value =
			this.parseMultiplicative();

		while (
			this.isOperator('+') ||
			this.isOperator('-')
		) {
			const operator =
				this.consume().value;

			const right =
				this.parseMultiplicative();

			value =
				this.applyArithmetic(
					value,
					right,
					operator,
				);
		}

		return value;
	}

	private parseMultiplicative():
		number | null {
		let value =
			this.parseUnary();

		while (
			this.isOperator('*') ||
			this.isOperator('/')
		) {
			const operator =
				this.consume().value;

			const right =
				this.parseUnary();

			value =
				this.applyArithmetic(
					value,
					right,
					operator,
				);
		}

		return value;
	}

	private parseUnary():
		number | null {
		if (this.isOperator('-')) {
			this.consume();

			const value =
				this.parseUnary();

			return value === null
				? null
				: -value;
		}

		if (this.isOperator('+')) {
			this.consume();

			return this.parseUnary();
		}

		return this.parsePrimary();
	}

	private parsePrimary():
		number | null {
		const token =
			this.current();

		if (token.type === 'number') {
			this.consume();

			return Number(
				token.value,
			);
		}

		if (
			token.type === 'lparen'
		) {
			this.consume();

			const value =
				this.parseAdditive();

			this.expect('rparen');

			return value;
		}

		if (
			token.type ===
			'identifier'
		) {
			const functionName =
				this.consume()
					.value
					.toUpperCase();

			this.expect('lparen');

			const args =
				this.collectFunctionArguments();

			return this.evaluateFunction(
				functionName,
				args,
			);
		}

		throw new Error(
			`Expected a number, function, or parenthesis but found "${token.value}".`,
		);
	}

	private evaluateFunction(
		name: string,
		args: Token[][],
	): number | null {
		if (name === 'COUNT') {
			if (args.length === 0) {
				return (
					this.observations.length
				);
			}

			if (args.length !== 1) {
				throw new Error(
					'COUNT accepts zero arguments or one field.',
				);
			}

			const field =
				this.getFieldName(
					args[0]!,
				);

			return this.observations
				.filter(
					(observation) =>
						observation[field] !==
							null &&
						observation[field] !==
							undefined,
				)
				.length;
		}

		if (name === 'COUNTIF') {
			if (args.length !== 1) {
				throw new Error(
					'COUNTIF requires one condition.',
				);
			}

			return this.observations
				.filter(
					(observation) =>
						evaluateCondition(
							args[0]!,
							observation,
						),
				)
				.length;
		}

		if (
			name === 'SUM' ||
			name === 'AVERAGE' ||
			name === 'MIN' ||
			name === 'MAX'
		) {
			if (args.length !== 1) {
				throw new Error(
					`${name} requires one field.`,
				);
			}

			const field =
				this.getFieldName(
					args[0]!,
				);

			const values =
				this.getNumericFieldValues(
					field,
					this.observations,
				);

			if (name === 'SUM') {
				return values.reduce(
					(total, value) =>
						total + value,
					0,
				);
			}

			if (values.length === 0) {
				return null;
			}

			if (name === 'AVERAGE') {
				return (
					values.reduce(
						(total, value) =>
							total + value,
						0,
					) /
					values.length
				);
			}

			if (name === 'MIN') {
				return Math.min(
					...values,
				);
			}

			return Math.max(
				...values,
			);
		}

		if (
			name === 'SUMIF' ||
			name === 'AVERAGEIF'
		) {
			if (args.length !== 2) {
				throw new Error(
					`${name} requires a field and a condition.`,
				);
			}

			const field =
				this.getFieldName(
					args[0]!,
				);

			const filtered =
				this.observations.filter(
					(observation) =>
						evaluateCondition(
							args[1]!,
							observation,
						),
				);

			const values =
				this.getNumericFieldValues(
					field,
					filtered,
				);

			if (name === 'SUMIF') {
				return values.reduce(
					(total, value) =>
						total + value,
					0,
				);
			}

			if (values.length === 0) {
				return null;
			}

			return (
				values.reduce(
					(total, value) =>
						total + value,
					0,
				) /
				values.length
			);
		}

		throw new Error(
			`Unknown function "${name}".`,
		);
	}

	private getNumericFieldValues(
		field: string,
		observations:
			GameObservation[],
	): number[] {
		const values: number[] = [];

		for (
			const observation of observations
		) {
			const value =
				observation[field];

			if (
				typeof value === 'number'
			) {
				values.push(value);
			} else if (
				typeof value === 'boolean'
			) {
				values.push(
					value ? 1 : 0,
				);
			}
		}

		return values;
	}

	private getFieldName(
		tokens: Token[],
	): string {
		if (
			tokens.length !== 1 ||
			tokens[0]?.type !==
				'identifier'
		) {
			throw new Error(
				'Expected a field name.',
			);
		}

		const field =
			tokens[0].value
				.toUpperCase();

        if (
            !this.allowedFields.has(field)
        ) {

			throw new Error(
				`Unknown field "${tokens[0].value}".`,
			);
		}

		return field;
	}

	private collectFunctionArguments():
		Token[][] {
		const inner: Token[] = [];

		let depth = 0;

		while (true) {
			const token =
				this.current();

			if (token.type === 'eof') {
				throw new Error(
					'Unclosed function call.',
				);
			}

			if (
				token.type ===
					'rparen' &&
				depth === 0
			) {
				this.consume();

				break;
			}

			if (
				token.type === 'lparen'
			) {
				depth++;
			} else if (
				token.type === 'rparen'
			) {
				depth--;
			}

			inner.push(
				this.consume(),
			);
		}

		if (inner.length === 0) {
			return [];
		}

		const args: Token[][] = [];

		let current: Token[] = [];
		depth = 0;

		for (const token of inner) {
			if (
				token.type ===
				'lparen'
			) {
				depth++;
			} else if (
				token.type ===
				'rparen'
			) {
				depth--;
			}

			if (
				token.type ===
					'comma' &&
				depth === 0
			) {
				args.push(current);
				current = [];

				continue;
			}

			current.push(token);
		}

		args.push(current);

		return args;
	}

	private applyArithmetic(
		left: number | null,
		right: number | null,
		operator: string,
	): number | null {
		if (
			left === null ||
			right === null
		) {
			return null;
		}

		if (operator === '+') {
			return left + right;
		}

		if (operator === '-') {
			return left - right;
		}

		if (operator === '*') {
			return left * right;
		}

		if (right === 0) {
			throw new Error(
				'Division by zero.',
			);
		}

		return left / right;
	}

	private current(): Token {
		return (
			this.tokens[
				this.position
			] ?? {
				type: 'eof',
				value: '',
			}
		);
	}

	private consume(): Token {
		const token =
			this.current();

		this.position++;

		return token;
	}

	private expect(
		type: Token['type'],
	): Token {
		const token =
			this.current();

		if (token.type !== type) {
			throw new Error(
				`Expected ${type} but found "${token.value}".`,
			);
		}

		return this.consume();
	}

	private isOperator(
		operator: string,
	): boolean {
		return (
			this.current().type ===
				'operator' &&
			this.current().value ===
				operator
		);
	}
}

class ConditionParser {
	private position = 0;

	constructor(
		private tokens: Token[],
		private observation:
			GameObservation,
	) {}

	parse(): boolean {
		const result =
			this.parseOr();

		if (
			this.current().type !== 'eof'
		) {
			throw new Error(
				`Unexpected condition token "${this.current().value}".`,
			);
		}

		return result;
	}

	private parseOr(): boolean {
		let result =
			this.parseAnd();

		while (
			this.isKeyword('OR')
		) {
			this.consume();

			const right =
				this.parseAnd();

			result =
				result || right;
		}

		return result;
	}

	private parseAnd(): boolean {
		let result =
			this.parseNot();

		while (
			this.isKeyword('AND')
		) {
			this.consume();

			const right =
				this.parseNot();

			result =
				result && right;
		}

		return result;
	}

	private parseNot(): boolean {
		if (
			this.isKeyword('NOT')
		) {
			this.consume();

			return !this.parseNot();
		}

		return this.parseComparison();
	}

	private parseComparison():
		boolean {
		if (
			this.current().type ===
			'lparen'
		) {
			this.consume();

			const result =
				this.parseOr();

			this.expect('rparen');

			return result;
		}

		const left =
			this.parseValue();

		if (
			this.current().type !==
			'operator'
		) {
			return Boolean(left);
		}

		const operator =
			this.consume().value;

		const right =
			this.parseValue();

		if (
			operator === '=' ||
			operator === '=='
		) {
			return left === right;
		}

		if (operator === '!=') {
			return left !== right;
		}

		if (
			typeof left !== 'number' ||
			typeof right !== 'number'
		) {
			return false;
		}

		if (operator === '>') {
			return left > right;
		}

		if (operator === '>=') {
			return left >= right;
		}

		if (operator === '<') {
			return left < right;
		}

		if (operator === '<=') {
			return left <= right;
		}

		throw new Error(
			`Unknown comparison operator "${operator}".`,
		);
	}

	private parseValue():
		ObservationValue {
		const token =
			this.current();

		if (token.type === 'number') {
			this.consume();

			return Number(
				token.value,
			);
		}

		if (
			token.type ===
			'identifier'
		) {
			const identifier =
				this.consume()
					.value
					.toUpperCase();

			if (identifier === 'TRUE') {
				return true;
			}

			if (identifier === 'FALSE') {
				return false;
			}

			if (identifier === 'NULL') {
				return null;
			}

			if (
				!(
					identifier in
					this.observation
				)
			) {
				throw new Error(
					`Unknown field "${token.value}".`,
				);
			}

            return (
                this.observation[
                    identifier
                ] ?? null
            );
		}

		throw new Error(
			`Expected a field or value but found "${token.value}".`,
		);
	}

	private current(): Token {
		return (
			this.tokens[
				this.position
			] ?? {
				type: 'eof',
				value: '',
			}
		);
	}

	private consume(): Token {
		const token =
			this.current();

		this.position++;

		return token;
	}

	private expect(
		type: Token['type'],
	): Token {
		const token =
			this.current();

		if (token.type !== type) {
			throw new Error(
				`Expected ${type} but found "${token.value}".`,
			);
		}

		return this.consume();
	}

	private isKeyword(
		keyword: string,
	): boolean {
		return (
			this.current().type ===
				'identifier' &&
			this.current()
				.value
				.toUpperCase() ===
				keyword
		);
	}
}

function evaluateCondition(
	tokens: Token[],
	observation: GameObservation,
): boolean {
	const parser =
		new ConditionParser(
			[
				...tokens,
				{
					type: 'eof',
					value: '',
				},
			],
			observation,
		);

	return parser.parse();
}

function tokenize(
	input: string,
): Token[] {
	const tokens: Token[] = [];

	let position = 0;

	while (
		position < input.length
	) {
		const char =
			input.charAt(position);

		if (/\s/.test(char)) {
			position++;

			continue;
		}

		if (
			/[0-9.]/.test(char)
		) {
			const start =
				position;

			position++;

			while (
				position <
					input.length &&
				/[0-9.]/.test(
					input.charAt(position),
				)
			) {
				position++;
			}

			const value =
				input.slice(
					start,
					position,
				);

			if (
				!Number.isFinite(
					Number(value),
				)
			) {
				throw new Error(
					`Invalid number "${value}".`,
				);
			}

			tokens.push({
				type: 'number',
				value,
			});

			continue;
		}

		if (
			/[A-Za-z_]/.test(
				char,
			)
		) {
			const start =
				position;

			position++;

			while (
				position <
					input.length &&
				/[A-Za-z0-9_]/.test(
					input.charAt(position),
				)
			) {
				position++;
			}

			tokens.push({
				type:
					'identifier',

				value:
					input.slice(
						start,
						position,
					),
			});

			continue;
		}

		const twoCharacter =
			input.slice(
				position,
				position + 2,
			);

		if (
			[
				'>=',
				'<=',
				'!=',
				'==',
			].includes(
				twoCharacter,
			)
		) {
			tokens.push({
				type: 'operator',
				value:
					twoCharacter,
			});

			position += 2;

			continue;
		}

		if (
			[
				'+',
				'-',
				'*',
				'/',
				'>',
				'<',
				'=',
			].includes(char)
		) {
			tokens.push({
				type: 'operator',
				value: char,
			});

			position++;

			continue;
		}

		if (char === '(') {
			tokens.push({
				type: 'lparen',
				value: char,
			});

			position++;

			continue;
		}

		if (char === ')') {
			tokens.push({
				type: 'rparen',
				value: char,
			});

			position++;

			continue;
		}

		if (char === ',') {
			tokens.push({
				type: 'comma',
				value: char,
			});

			position++;

			continue;
		}

		throw new Error(
			`Unexpected character "${char}".`,
		);
	}

	tokens.push({
		type: 'eof',
		value: '',
	});

	return tokens;
}