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
        let output = {};
        let winLoss = {};

        process.stdout.write('Getting all football boxscore data........ ');
        const boxscoreRes = await Promise.all(utils.getBoxscores(startYear, lastYear));
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Parsing weekly data........ `);
        boxscoreRes.forEach((cell) => {
            let boxscores = cell.scores;
            let year = cell.year;
            let matchupPeriodId = cell.week;
            if (year >= constants.v3StartYear) {
                parsedResponse = utils.parseV3Data(output, boxscores, year, matchupPeriodId);
            } else {
                parsedResponse = utils.parseV2Data(output, boxscores, year, matchupPeriodId);
            }
        });
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Inserting weekly data to db........ `);
        await utils.upsertScoreTable(client, parsedResponse);
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write('Getting all football transaction data........ ');
        const tranasctionRes = await Promise.all(utils.getTranasctions(startYear, lastYear));
        process.stdout.write('\x1b[32mDone\x1b[0m\n');

        process.stdout.write(`Parsing transaction data........ `);
        tranasctionRes.forEach((transaction) => {
            console.log(transaction.year, typeof transaction.transactions)
            if (Array.isArray(transaction.transactions)) { 
                transaction.transactions[0].teams.forEach((team) => {{
                    console.log(`${transaction.year} - team ${team.id} \n${team.transactionCounter}`);
                }});
            } else {
                transaction.transactions.teams.forEach((team) => {{
                    console.log(`${transaction.year} - team ${team.id} \n${team.transactionCounter}`);
                }});
            }
        });
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
