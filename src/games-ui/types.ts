export type GameSortColumn =
	| 'datetime'
	| 'player1'
	| 'player2'
	| 'margin';

export interface GamesPageState {
	sortColumn: GameSortColumn;
	sortDirection: 'asc' | 'desc';
	editingGameId: string | null;
}

export interface GamesPageCallbacks {
	onChanged: () => void;
	onSortChanged: () => void;
	onOpenHands: (gameId: string) => void;
	onEdit: (gameId: string) => void;
	onCancelEdit: () => void;
}