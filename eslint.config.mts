import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,

	{
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					mode: 'loose',

					enforceCamelCaseLower: false,

					acronyms: [
						'CSV',
						'SQL',
					],

					ignoreWords: [
						'COUNT',
						'COUNTIF',
						'SUM',
						'SUMIF',
						'AVERAGE',
						'AVERAGEIF',
						'MIN',
						'MAX',
						'VALUE',
						'IF',
						'ROUND',
						'FIXED',
						'INTEGER',
						'PERCENT',
						'ABS',
						'AND',
						'OR',
						'NOT',
						'TRUE',
						'FALSE',
						'NULL',
					],

					ignoreRegex: [
						'^Games fields:',
						'^Hands fields:',
						'^Functions:',
						'^Example:',
						'^metric_games columns:',
						'^metric_hands columns:',
						'^SELECT ',
						'^VALUE is the raw numeric metric result\\.',
						'^Set the first dealer on the Games page before adding hands\\.$',
					],
				},
			],
		},
	},
);