// Modules
const pg = require('pg');

// Custom Classes
const utils = require('./ESPNFantasyFootballUtils.js');
const constants = require('./constants.js');

// Database Client
var Client = pg.Client;
var client = new Client(constants.postgres_config);

// League Constants
const startYear = process.env.LEAGUECREATION;
const lastYear = new Date().getMonth() > 7 ? 
    new Date().getFullYear() : 
    (new Date().getFullYear() - 1);

async function main() {
    console.log('================================================================');
    try {
        process.stdout.write('Connecting to database........ ');
        await client.connect();
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write('Getting all football boxscore data........ ');
        const boxscoreRes = await Promise.all(utils.getBoxscores(startYear, lastYear));
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Parsing weekly data........ `);
        let weeklyScores = {};
        boxscoreRes.forEach((cell) => {
            let boxscores = cell.scores;
            let year = cell.year;
            let matchupPeriodId = cell.week;
            if (year >= constants.v3StartYear) {
                weeklyScores = utils.parseV3Data(weeklyScores, boxscores, year, matchupPeriodId);
            } else {
                weeklyScores = utils.parseV2Data(weeklyScores, boxscores, year, matchupPeriodId);
            }
        });
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Inserting weekly data to db........ `);
        await utils.upsertWeeklyScoresTable(client, weeklyScores);
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write('Getting all football transaction data........ ');
        const tranasctionRes = await Promise.all(utils.getTranasctions(startYear, lastYear));
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Parsing transaction data........ `);
        let yearOverview = {};
        tranasctionRes.forEach((transaction) => {
            let teamOverview = {};
            if (Array.isArray(transaction.transactions)) { 
                transaction.transactions[0].teams.forEach((team) => {{
                    teamOverview[team.id] = {
                        totalWins: team.record.overall.wins,
                        totalLosses: team.record.overall.losses,
                        longestWinStreak: team.record.overall.streakType === 'WIN' ? team.record.overall.streakLength : 0,
                        totalPointsAgainst: team.record.overall.pointsAgainst,
                        totalPointsFor: team.record.overall.pointsFor,                        
                        totalMoves: team.transactionCounter.moveToActive,
                        aquisitions: team.transactionCounter.acquisitions,
                        trades: team.transactionCounter.trades
                    }
                }});
            } else {
                transaction.transactions.teams.forEach((team) => {{
                    teamOverview[team.id] = {
                        totalWins: team.record.overall.wins,
                        totalLosses: team.record.overall.losses,
                        longestWinStreak: team.record.overall.streakType === 'WIN' ? team.record.overall.streakLength : 0,
                        totalPointsAgainst: team.record.overall.pointsAgainst,
                        totalPointsFor: team.record.overall.pointsFor,                        
                        totalMoves: team.transactionCounter.moveToActive,
                        aquisitions: team.transactionCounter.acquisitions,
                        trades: team.transactionCounter.trades
                    }
                }});
            }
            yearOverview[transaction.year] = teamOverview;
        });
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Inserting yearly data to db........ `);
        await utils.upsertYearlyOverviewTable(client, yearOverview);
        process.stdout.write('\x1b[32mDone\x1b[0m\n');
    } catch (err) {
        process.stdout.write('\x1b[31mError\x1b[0m\n\n');
        console.error('Error in main function', err);
    } finally {
        client.end();
    }
    console.log('================================================================');
}

main().catch(console.error);
