# Obsidian Cribbage Tracker
**Disclaimer: LLMs were used for the majority of code generation. All features and design elements were my ideas, but I am not a developer and would not have been able to create the code without spending months of my free time learning the language. I wanted a plugin that allowed me to track my cribbage games against my wife without needing my ugly Excel sheet anymore. I checked and tested all aspects of the plugin to make sure it worked as I expected, so I am pretty confident in the functionality, but it may be written inefficiently.**

**Disclaimer 2: As I am not a developer, once this plugin achieves the functionality I wish for, I can't promise I will make too many updates. I am not planning to publicize this plugin beyond it being available in the Community Plugins browser, so if you find it on your own, congratulations but also YMMV with any issues/pull requests. I won't go AWOL but I will not be monitoring this religiously. And you are of course free to fork it if you wish to take it in a different direction/adapt for a different game/etc.**

This plugin allows users to track cribbage games, including hand-by-hand scores (optional), and tracks many statistics related to the games, including: Points per Game, W/L Record (including first/not first dealer breakdown), highest hands (if tracked), points per hand/crib (if tracked), and pegging/round (if hands are tracked).

There are 5 tabs in this plugin:
- [Games](#games)
- [Hands](#hands)
- [Statistics (Global, Matchup, and Player)](#statistics)
- [Leaderboard](#leaderboard)
- [Custom Metrics](#custom-metrics)

## Games
This tab is where you enter the high level data: Date/Time, Player 1/Player 1 Score, Player 2/Player 2 Score, and First Dealer. First Dealer can be unknown, so if you are not sure, leave as Unknown and that game will just not count into First Deal Win% and related metrics.

Below the New Game box, you will see a table of all games in the database, sorted by default from new to old. Each line also contains three buttons: one to delete the game, one to edit it, and one to take you to the linked Hands record (see below).

In the settings for this plugin, you can also enable "Show CSV importer", which will add a dialog in the middle of the Games screen that allows you to import a CSV of past games, if you have previously tracked them elsewhere.

## Hands
This tab is where you enter the hand-by-hand data for a given game. By default, it will select the most recent game in the database, but you can select another if you'd prefer.

It will display summary information about the game, score, and first dealer at the top, and then there is a summary statistic section in the middle that also gives you the option to manually enter the high hand for each player in that game if you'd prefer to not track each hand individually.

The Hands table at the bottom allows you to enter the score for Player 1, Player 2, and crib. The dealer is automatically determined by alternating the player, where Hand 1's dealer is the First Dealer denoted on the Games tab.

**Important:** The last hand recorded for a game is automatically excluded from per hand statistics, as it is overwhelmingly likely that either one or both of the players will cross 121 without counting their full hand. **For accurate pegging stats, make sure to only count the effective points from the final hand. For example, if Player 1 counts first, has 8 points, but only needs 4 points to reach 121 and win, only enter 4, and then enter 0 for Player 2 and the crib as they did not count that round.** If the game ends during the pegging phase, enter the last hand as 0 for all 3 cells to avoid your penultimate hand not counting towards statistics.

## Statistics
This tab includes statistical data for 3 scopes: Global, Player, and Matchup.

**Global**

This displays the total games across all matchups, the average margin of victory, first dealer record, first pone record, games that ended in a skunk (but not double skunk), games that ended in a double skunk, the longest win streak, the longest loss streak, the highest hand, the highest high-hand in a loss, the lowest high-hand in a win, global points per hand, global points per crib, global pegging per round, and completed hand logs. The three "points per" statistics are color coded based on "par" (retrieved from https://www.gamecolony.com/cribbage_hands.shtml), where those better than par are green and worse than par are red.

There are also two tables beneath the statistic cards:
- Winning % Distribution by High Hand: which shows the high hand, the win % with that exact hand, and the cumulative win % with that high hand or better.
- Margin Distribution: which shows margins of victory from 1 to 30+ and the % of games that end at that exact margin as well as what % of games are at or smaller than that margin (ie, % of games that were margin of 8 points or closer).

**Player**

This displays the same statistics as Global does, except filtered to just the selected player's results. There are also 3 additional cards: Higher High Hand, High-hand Tie, and Lower High Hand. These represent where your high hand in a game is relative to your opponent.

There are also the same two tables below the statistic cards, again filtered to just that player's games.

**Matchup**

Once again, largely the same statistics as the above views, but this time you select two opponents and the view is side-by-side instead of cards.

The same two tables are also present here below the side-by-side table, filtered to just games between these two players.

## Leaderboard

This displays many of the same statistics as the Statistics tabs, but instead takes the view of ranking the players/games/hands in the database. For example, instead of global points per hand, it ranks every player with 5 or more games by their points per hand.

Another example is the Highest Hands statistic, which uses your hand data from games (and uses the high hand data as a fallback for games without individual hands) and displays what hands have occurred the most, with 3 possibilities:
- one occurrence by one player (ie, Player A scored a 29 point hand once and no others have done it), which display as "Player | Points" with a subtext that says what game/date it occurred in,
- multiple occurrences by one player (ie, Player A scored 24 points twice and no others have done it), which display as "Player | Points (# of Occurrences)" with a subtext that says the last game/date it occurred in,
- multiple occurrences by multiple players (ie, Player A and B both scored 20 points 5 times each), which display as "Multiple | Points (# of Occurrences)" with a subtext that says what players have scored it the most, from high to low. Example would be "Player A 3x | Player B 2x". If 3+ players have achieved that score, it would show as "Player A 3x | Player B 2x | Others 6x".

## Custom Metrics

This is a powerful tool that allows you to create any custom metrics you can think of that are missing from the stock statistics. When you add a new custom metric, it will show in a section below the stock statistic cards.

When creating a metric, your options are:
- Metric Name
- Data Source (Games or Hands)
- Calculation Mode (Metric Builder or Advanced SQL)
- Formula (In either basic Excel-esque format or in SQL query format, depending on selection for Mode)
- "Show On" check boxes (Global/Player/Matchup Statistic screens)
- Matchup Display (Combined or Per Player, ie, # of Games where either Player had a 20+ point high hand vs. # of Games where Player A had 20+ against Player B and where Player B had 20+ against Player A)
- Display Formatting (Formats: Integer, Decimal, Percentage, or Custom, which allows you to use basic formulas)

It will also display a Preview field of what the values/formatting is for what you've entered, in order to sanity check what you have entered.

## Configurable Settings
- Database Path (default: Cribbage/cribbage.db): This is the vault-relative position where you want the .db file to be stored for your cribbage games.
- Show CSV Importer (Yes/No): This allows you to enable/disable the dialog on the Games screen for importing games from a CSV file.
- Par Benchmarks (Dealer hand/Pone hand/Crib/Dealer pegging/Pone pegging): This allows you to change the default "par" for the various scoring scenarios. On the assumption that each player is dealer 50% of the time, the par displayed in the Hands and Statistics screen is an average of the Dealer and Pone pars.
- Minimum Requirements: This is for the minimum games/hands/etc threshold on the Leaderboard tab. By default, most leaderboard cards won't show players with less than 5 of the relevant scenario (games/hands/cribs).
