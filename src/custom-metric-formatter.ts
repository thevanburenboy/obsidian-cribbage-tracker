type FormatValue =
	| number
	| string
	| boolean
	| null;

interface FormatToken {
	type:
		| 'number'
		| 'string'
		| 'identifier'
		| 'operator'
		| 'lparen'
		| 'rparen'
		| 'comma'
		| 'eof';

	value: string;
}

export interface CustomFormatResult {
	text: string;
	error: string | null;
}

export function evaluateCustomFormat(
	value: number | null,
	expression: string,
	prefix: string,
	suffix: string,
): CustomFormatResult {
	if (value === null) {
		return {
			text: '—',
			error: null,
		};
	}

	if (!expression.trim()) {
		return {
			text: '',
			error:
				'Custom format expression is empty.',
		};
	}

	try {
		const parser =
			new CustomFormatParser(
				tokenizeFormatExpression(
					expression,
				),
				value,
			);

		const result =
			parser.parse();

		return {
			text:
				prefix +
				stringifyValue(
					result,
				) +
				suffix,

			error: null,
		};
	} catch (error) {
		return {
			text: '',

			error:
				error instanceof Error
					? error.message
					: 'Custom formatting failed.',
		};
	}
}

class CustomFormatParser {
	private position = 0;

	constructor(
		private tokens:
			FormatToken[],
		private metricValue:
			number,
	) {}

	parse(): FormatValue {
		const value =
			this.parseOr();

		if (
			this.current().type !==
			'eof'
		) {
			throw new Error(
				`Unexpected token "${this.current().value}".`,
			);
		}

		return value;
	}

	private parseOr():
		FormatValue {
		let value =
			this.parseAnd();

		while (
			this.isKeyword('OR')
		) {
			this.consume();

			const right =
				this.parseAnd();

			value =
				toBoolean(value) ||
				toBoolean(right);
		}

		return value;
	}

	private parseAnd():
		FormatValue {
		let value =
			this.parseComparison();

		while (
			this.isKeyword('AND')
		) {
			this.consume();

			const right =
				this.parseComparison();

			value =
				toBoolean(value) &&
				toBoolean(right);
		}

		return value;
	}

	private parseComparison():
		FormatValue {
		let value =
			this.parseAdditive();

		while (
			this.current().type ===
			'operator' &&
			[
				'=',
				'==',
				'!=',
				'>',
				'>=',
				'<',
				'<=',
			].includes(
				this.current().value,
			)
		) {
			const operator =
				this.consume().value;

			const right =
				this.parseAdditive();

			value =
				compareValues(
					value,
					right,
					operator,
				);
		}

		return value;
	}

	private parseAdditive():
		FormatValue {
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

			if (operator === '+') {
				if (
					typeof value ===
						'string' ||
					typeof right ===
						'string'
				) {
					value =
						stringifyValue(
							value,
						) +
						stringifyValue(
							right,
						);
				} else {
					value =
						requireNumber(
							value,
							'Left side of +',
						) +
						requireNumber(
							right,
							'Right side of +',
						);
				}
			} else {
				value =
					requireNumber(
						value,
						'Left side of -',
					) -
					requireNumber(
						right,
						'Right side of -',
					);
			}
		}

		return value;
	}

	private parseMultiplicative():
		FormatValue {
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

			const leftNumber =
				requireNumber(
					value,
					`Left side of ${operator}`,
				);

			const rightNumber =
				requireNumber(
					right,
					`Right side of ${operator}`,
				);

			if (operator === '*') {
				value =
					leftNumber *
					rightNumber;
			} else {
				if (
					rightNumber === 0
				) {
					throw new Error(
						'Division by zero.',
					);
				}

				value =
					leftNumber /
					rightNumber;
			}
		}

		return value;
	}

	private parseUnary():
		FormatValue {
		if (
			this.isKeyword('NOT')
		) {
			this.consume();

			return !toBoolean(
				this.parseUnary(),
			);
		}

		if (this.isOperator('-')) {
			this.consume();

			return -requireNumber(
				this.parseUnary(),
				'Unary -',
			);
		}

		if (this.isOperator('+')) {
			this.consume();

			return requireNumber(
				this.parseUnary(),
				'Unary +',
			);
		}

		return this.parsePrimary();
	}

	private parsePrimary():
		FormatValue {
		const token =
			this.current();

		if (
			token.type === 'number'
		) {
			this.consume();

			return Number(
				token.value,
			);
		}

		if (
			token.type === 'string'
		) {
			this.consume();

			return token.value;
		}

		if (
			token.type ===
			'lparen'
		) {
			this.consume();

			const value =
				this.parseOr();

			this.expect('rparen');

			return value;
		}

		if (
			token.type ===
			'identifier'
		) {
			const identifier =
				this.consume()
					.value
					.toUpperCase();

			if (
				this.current().type ===
				'lparen'
			) {
				this.consume();

				const args =
					this.parseArguments();

				return this.evaluateFunction(
					identifier,
					args,
				);
			}

			if (
				identifier === 'VALUE'
			) {
				return this.metricValue;
			}

			if (
				identifier === 'TRUE'
			) {
				return true;
			}

			if (
				identifier === 'FALSE'
			) {
				return false;
			}

			if (
				identifier === 'NULL'
			) {
				return null;
			}

			throw new Error(
				`Unknown identifier "${token.value}".`,
			);
		}

		throw new Error(
			`Expected a value but found "${token.value}".`,
		);
	}

	private parseArguments():
		FormatValue[] {
		const args:
			FormatValue[] = [];

		if (
			this.current().type ===
			'rparen'
		) {
			this.consume();

			return args;
		}

		while (true) {
			args.push(
				this.parseOr(),
			);

			if (
				this.current().type ===
				'comma'
			) {
				this.consume();

				continue;
			}

			this.expect(
				'rparen',
			);

			break;
		}

		return args;
	}

	private evaluateFunction(
		name: string,
		args: FormatValue[],
	): FormatValue {
		if (name === 'IF') {
			requireArgCount(
				name,
				args,
				3,
			);

			return toBoolean(
				args[0]!,
			)
				? args[1]!
				: args[2]!;
		}

		if (name === 'ABS') {
			requireArgCount(
				name,
				args,
				1,
			);

			return Math.abs(
				requireNumber(
					args[0]!,
					'ABS',
				),
			);
		}

		if (name === 'ROUND') {
			if (
				args.length !== 1 &&
				args.length !== 2
			) {
				throw new Error(
					'ROUND requires one value and optionally a decimal count.',
				);
			}

			const number =
				requireNumber(
					args[0]!,
					'ROUND',
				);

			const decimals =
				args.length === 2
					? requireDecimals(
							args[1]!,
						)
					: 0;

			const factor =
				10 ** decimals;

			return (
				Math.round(
					number *
						factor,
				) / factor
			);
		}

		if (name === 'FIXED') {
			if (
				args.length !== 1 &&
				args.length !== 2
			) {
				throw new Error(
					'FIXED requires one value and optionally a decimal count.',
				);
			}

			const number =
				requireNumber(
					args[0]!,
					'FIXED',
				);

			const decimals =
				args.length === 2
					? requireDecimals(
							args[1]!,
						)
					: 2;

			return number.toFixed(
				decimals,
			);
		}

		if (
			name === 'INTEGER'
		) {
			requireArgCount(
				name,
				args,
				1,
			);

			return String(
				Math.round(
					requireNumber(
						args[0]!,
						'INTEGER',
					),
				),
			);
		}

		if (
			name === 'PERCENT'
		) {
			if (
				args.length !== 1 &&
				args.length !== 2
			) {
				throw new Error(
					'PERCENT requires one value and optionally a decimal count.',
				);
			}

			const number =
				requireNumber(
					args[0]!,
					'PERCENT',
				);

			const decimals =
				args.length === 2
					? requireDecimals(
							args[1]!,
						)
					: 1;

			return (
				(
					number *
					100
				).toFixed(
					decimals,
				) + '%'
			);
		}

		if (
			name === 'MIN' ||
			name === 'MAX'
		) {
			if (args.length === 0) {
				throw new Error(
					`${name} requires at least one value.`,
				);
			}

			const values =
				args.map(
					(value) =>
						requireNumber(
							value,
							name,
						),
				);

			return name === 'MIN'
				? Math.min(
						...values,
					)
				: Math.max(
						...values,
					);
		}

		throw new Error(
			`Unknown formatting function "${name}".`,
		);
	}

	private current():
		FormatToken {
		return (
			this.tokens[
				this.position
			] ?? {
				type: 'eof',
				value: '',
			}
		);
	}

	private consume():
		FormatToken {
		const token =
			this.current();

		this.position++;

		return token;
	}

	private expect(
		type:
			FormatToken['type'],
	): FormatToken {
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

function tokenizeFormatExpression(
	input: string,
): FormatToken[] {
	const tokens:
		FormatToken[] = [];

	let position = 0;

	while (
		position <
		input.length
	) {
		const char =
			input.charAt(
				position,
			);

		if (/\s/.test(char)) {
			position++;

			continue;
		}

		if (
			char === '"' ||
			char === "'"
		) {
			const quote = char;

			position++;

			let value = '';
			let closed = false;

			while (
				position <
				input.length
			) {
				const current =
					input.charAt(
						position,
					);

				if (
					current ===
					quote
				) {
					position++;
					closed = true;

					break;
				}

				if (
					current === '\\'
				) {
					position++;

					if (
						position >=
						input.length
					) {
						break;
					}

					const escaped =
						input.charAt(
							position,
						);

					if (
						escaped === 'n'
					) {
						value += '\n';
					} else if (
						escaped === 't'
					) {
						value += '\t';
					} else {
						value +=
							escaped;
					}

					position++;

					continue;
				}

				value += current;
				position++;
			}

			if (!closed) {
				throw new Error(
					'Unclosed string literal.',
				);
			}

			tokens.push({
				type: 'string',
				value,
			});

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
					input.charAt(
						position,
					),
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
					input.charAt(
						position,
					),
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
				type:
					'operator',

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
				type:
					'operator',

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

function compareValues(
	left: FormatValue,
	right: FormatValue,
	operator: string,
): boolean {
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
		typeof left === 'number' &&
		typeof right === 'number'
	) {
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
	}

	if (
		typeof left === 'string' &&
		typeof right === 'string'
	) {
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
	}

	return false;
}

function requireArgCount(
	name: string,
	args: FormatValue[],
	count: number,
): void {
	if (args.length !== count) {
		throw new Error(
			`${name} requires exactly ${count} argument${count === 1 ? '' : 's'}.`,
		);
	}
}

function requireNumber(
	value: FormatValue,
	context: string,
): number {
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value)
	) {
		throw new Error(
			`${context} requires a numeric value.`,
		);
	}

	return value;
}

function requireDecimals(
	value: FormatValue,
): number {
	const decimals =
		requireNumber(
			value,
			'Decimal count',
		);

	if (
		!Number.isInteger(
			decimals,
		) ||
		decimals < 0 ||
		decimals > 12
	) {
		throw new Error(
			'Decimal count must be a whole number from 0 to 12.',
		);
	}

	return decimals;
}

function toBoolean(
	value: FormatValue,
): boolean {
	if (
		typeof value ===
		'boolean'
	) {
		return value;
	}

	if (
		typeof value ===
		'number'
	) {
		return value !== 0;
	}

	if (
		typeof value ===
		'string'
	) {
		return value.length > 0;
	}

	return false;
}

function stringifyValue(
	value: FormatValue,
): string {
	if (value === null) {
		return '';
	}

	if (
		typeof value ===
		'boolean'
	) {
		return value
			? 'true'
			: 'false';
	}

	return String(value);
}