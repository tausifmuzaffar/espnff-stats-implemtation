const dotenv = require('dotenv').config();
const fs = require('fs');
const request = require('superagent');
const espn = require('espn-fantasy-football-api/node');
const constants = require('./constants.js');

// Franchise Data
let franchiseValue = {
    1: 1000,
    2: 1000,
    3: 1000,
    4: 1000,
    5: 1000,
    6: 1000,
    7: 1000,
    8: 1000,
    9: 1000,
    10: 1000,
    11: 1000,
    12: 1000,
};

const league = new espn.Client({
    leagueId: process.env.LEAGUEID
});
league.setCookies({
    espnS2: process.env.ESPNS2,
    SWID: process.env.SWID
});

function getTranasctions(startYear, lastYear) {
    let transactions = [];
    for (let i = startYear; i <= lastYear; i++) {        
        if (i < constants.v3StartYear) {
            const req = request.get(`${constants.espnAPIv2URI(i)}&${constants.viewMatchupScore}&${constants.viewRoster}&${constants.viewSettings}&${constants.viewStandings}&${constants.viewTeam}`);
            req.set('Cookie', `espn_s2=${process.env.ESPNS2}; SWID=${process.env.SWID};`);
            transactions.push(
                new Promise((resolve, reject) => {
                    req.end((error, res) => {
                        resolve({
                            transactions: res.body,
                            year: i
                        });
                    });
                })
            );
        } else {
            const req = request.get(`${constants.espnAPIv3URI(i)}&${constants.viewStatus}&${constants.viewSettings}&${constants.viewTransaction}&${constants.viewTeam}`);
            req.set('Cookie', `espn_s2=${process.env.ESPNS2}; SWID=${process.env.SWID};`);
            transactions.push(
                new Promise((resolve, reject) => {
                    req.end((error, res) => {
                        resolve({
                            transactions: res.body,
                            year: i
                        });
                    });
                })
            );
        }
    }

    return transactions;
}

function getBoxscores(startYear, lastYear) {
    let matchupWeek = [];
    for (let i = startYear; i <= lastYear; i++) {
        if (i < constants.v3StartYear) {
            const req = request.get(`${constants.espnAPIv2URI(i)}&${constants.viewMatchup}`);
            matchupWeek.push(
                new Promise((resolve, reject) => {
                    req.end((error, res) => {
                        resolve({
                            scores: res.body,
                            year: i
                        });
                    });
                })
            );
        } else {
            for (let j = 1; j <= 17; j++) {
                matchupWeek.push(
                    new Promise((resolve, reject) => {
                        league.getBoxscoreForWeek({
                            seasonId: i,
                            scoringPeriodId: j,
                            matchupPeriodId: j
                        }).then((boxscores) => {
                            resolve({
                                scores: boxscores,
                                week: j,
                                year: i
                            });
                        })

                    })
                );
            }
        }
    }

    return matchupWeek;
}

function createWinLossJSON(winLoss, output) {
    Object.keys(output).forEach((year) => {
        Object.keys(output[year]).forEach((week) => {
            Object.keys(output[year][week]).forEach((team) => {
                if (!winLoss.hasOwnProperty(team)) {
                    winLoss[team] = {};
                }
                if (!winLoss[team].hasOwnProperty(output[year][week][team]['opponent'])) {
                    winLoss[team][output[year][week][team]['opponent']] = {};
                }
                if (!winLoss[team][output[year][week][team]['opponent']].hasOwnProperty('Wins')) {
                    winLoss[team][output[year][week][team]['opponent']]['Wins'] = 0;
                    winLoss[team][output[year][week][team]['opponent']]['Losses'] = 0;
                }
                if (!winLoss[team][output[year][week][team]['opponent']].hasOwnProperty('Matchup')) {
                    winLoss[team][output[year][week][team]['opponent']]['Matchup'] = [];
                }
                winLoss[team][output[year][week][team]['opponent']]['Matchup'].push({
                    'date': week + ' ' + year,
                    'win': output[year][week][team]['win'],
                    'score': output[year][week][team]['startScore'],
                    'difference': output[year][week][team]['difference'],
                });
                if (output[year][week][team]['win']) {
                    winLoss[team][output[year][week][team]['opponent']]['Wins'] = winLoss[team][output[year][week][team]['opponent']]['Wins'] + 1;
                } else {
                    winLoss[team][output[year][week][team]['opponent']]['Losses'] = winLoss[team][output[year][week][team]['opponent']]['Losses'] + 1;
                }

            });
        });
    });
    Object.keys(winLoss).forEach((team) => {
        let totalWins = 0;
        let totalLosses = 0;
        Object.keys(winLoss[team]).forEach((opponent) => {
            totalWins += winLoss[team][opponent]['Wins'];
            totalLosses += winLoss[team][opponent]['Losses'];
        });
        winLoss[team]['totalWins'] = totalWins;
        winLoss[team]['totalLosses'] = totalLosses;
    });

    return winLoss;
}

function outputFile(dir, name, data) {
    if (!fs.existsSync('./' + dir)) {
        fs.mkdirSync('./' + dir);
    }
    fs.writeFile(dir + '/' + name + new Date().getTime() + '.json', JSON.stringify(data, null, 4) + '\n\n', (err) => {
        if (err) throw err;
        console.log('Saved ' + dir + '/' + name);
    });
}

function parseV2Data(output, boxscores, year, matchupPeriodId) {
    let bye = 1;
    let firstWeek = -99;
    let currentCount = -99;
    let matchup0 = 0;
    if (boxscores.length > 0) {
        if (!output.hasOwnProperty(year)) {
            output[year] = {};
        }
        boxscores[0].schedule.forEach((matchup, i) => {
            let matchupPeriod = 'Week_' + matchup.matchupPeriodId;
            if (!output[year].hasOwnProperty(matchupPeriod)) {
                output[year][matchupPeriod] = {};
            }

            if (matchup.hasOwnProperty('home')) {
                if (!output[year][matchupPeriod].hasOwnProperty(matchup.home.teamId)) {
                    output[year][matchupPeriod][matchup.home.teamId] = {};
                }
                output[year][matchupPeriod][matchup.home.teamId]['startScore'] = matchup.home.totalPoints;
                if (matchup.hasOwnProperty('away')) {
                    output[year][matchupPeriod][matchup.home.teamId]['win'] = matchup.winner === 'HOME' ? true : false;
                    output[year][matchupPeriod][matchup.home.teamId]['opponent'] = matchup.away.teamId;
                    output[year][matchupPeriod][matchup.home.teamId]['difference'] = Math.round((matchup.home.totalPoints - matchup.away.totalPoints) * 100) / 100;
                } else {
                    output[year][matchupPeriod][matchup.home.teamId]['win'] = true;
                    output[year][matchupPeriod][matchup.home.teamId]['opponent'] = 98 + bye;
                    output[year][matchupPeriod][98 + bye] = {
                        "startScore": 0,
                        "win": false,
                        "opponent": matchup.home.teamId
                    };
                    bye++;
                }
            }

            if (matchup.hasOwnProperty('away')) {
                if (!output[year][matchupPeriod].hasOwnProperty(matchup.away.teamId)) {
                    output[year][matchupPeriod][matchup.away.teamId] = {};
                }
                output[year][matchupPeriod][matchup.away.teamId]['startScore'] = matchup.away.totalPoints;
                if (matchup.hasOwnProperty('home')) {
                    output[year][matchupPeriod][matchup.away.teamId]['win'] = matchup.winner === 'AWAY' ? true : false;
                    output[year][matchupPeriod][matchup.away.teamId]['opponent'] = matchup.home.teamId;
                    output[year][matchupPeriod][matchup.away.teamId]['difference'] = Math.round((matchup.away.totalPoints - matchup.home.totalPoints) * 100) / 100;
                } else {
                    output[year][matchupPeriod][matchup.away.teamId]['win'] = true;
                    output[year][matchupPeriod][matchup.away.teamId]['opponent'] = 98 + bye;
                    output[year][matchupPeriod][98 + bye] = {
                        "startScore": 0,
                        "win": false,
                        "opponent": matchup.away.teamId
                    };
                    bye++;
                }
            }

            if (matchup.matchupPeriodId > (constants.playoffEndWeek[year] - 3)) {

                if (firstWeek === -99) {
                    matchup0 = 0;
                }
                const matchupDistance = constants.playoffEndWeek[year] - matchup.matchupPeriodId;
                const rounds = {
                    2: 4,
                    1: 2,
                    0: 1
                }
                if ((firstWeek <= matchup.matchupPeriodId)) {
                    matchup0++;
                    if (firstWeek < matchup.matchupPeriodId) {
                        firstWeek = matchup.matchupPeriodId;
                        matchup0 = 0;
                    }
                    if (matchup0 < rounds[matchupDistance]) {
                        if (matchup.hasOwnProperty('home')) {
                            output[year][matchupPeriod][matchup.home.teamId]['playoffPlayed'] = 1;
                        }
                        if (matchup.hasOwnProperty('away')) {
                            output[year][matchupPeriod][matchup.away.teamId]['playoffPlayed'] = 1;
                        }
                    }
                }
            }
        })
    }

    return output;
}

function parseV3Data(output, boxscores, year, matchupPeriodId) {
    let matchupPeriod = 'Week_' + matchupPeriodId;
    if (boxscores.length > 0) {
        boxscores.forEach((matchup, i) => {
            if (matchup.homeScore != 0) {
                let homeTeamId = matchup.homeTeamId ? matchup.homeTeamId : 99;
                let awayTeamId = matchup.awayTeamId ? matchup.awayTeamId : 99;
                let homeScore = matchup.homeScore === undefined ? 0 : matchup.homeScore;
                let awayScore = matchup.awayScore === undefined ? 0 : matchup.awayScore;

                if (!output.hasOwnProperty(year)) {
                    output[year] = {};
                }
                if (!output[year].hasOwnProperty(matchupPeriod)) {
                    output[year][matchupPeriod] = {};
                }
                output[year][matchupPeriod][homeTeamId] = {};

                if ((output[year][matchupPeriod].hasOwnProperty(99)) && (awayTeamId === 99)) {
                    awayTeamId = 100;
                }

                output[year][matchupPeriod][awayTeamId] = {};

                let homeBenchPoints = 0;
                let maxTeam = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                matchup.homeRoster.forEach((player) => {
                    // QB, RB, RB, WR, WR, TE, FLEX, D, K
                    if (player.eligiblePositions.includes("QB")) {
                        if (player.totalPoints > maxTeam[0]) {
                            maxTeam[0] = player.totalPoints;
                        }
                    }
                    if (player.eligiblePositions.includes("RB")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[1]) {
                            nextScore = maxTeam[1];
                            maxTeam[1] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[2]) {
                            nextScore = maxTeam[2];
                            maxTeam[2] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("WR")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[3]) {
                            nextScore = maxTeam[3];
                            maxTeam[3] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[4]) {
                            nextScore = maxTeam[4];
                            maxTeam[4] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("TE")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[5]) {
                            nextScore = maxTeam[5];
                            maxTeam[5] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("D/ST")) {
                        if (player.totalPoints > maxTeam[7]) {
                            maxTeam[7] = player.totalPoints;
                        }
                    }
                    if (player.eligiblePositions.includes("K")) {
                        if (player.totalPoints > maxTeam[8]) {
                            maxTeam[8] = player.totalPoints;
                        }
                    }
                    if (player.rosteredPosition === 'Bench') {
                        homeBenchPoints += player.totalPoints;
                    }
                });
                output[year][matchupPeriod][homeTeamId]['startScore'] = Math.round(homeScore * 100) / 100;
                output[year][matchupPeriod][homeTeamId]['benchScore'] = Math.round(homeBenchPoints * 100) / 100;
                output[year][matchupPeriod][homeTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

                let awayBenchPoints = 0;
                maxTeam = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                matchup.awayRoster.forEach((player) => {
                    // QB, RB, RB, WR, WR, TE, FLEX, D, K
                    if (player.eligiblePositions.includes("QB")) {
                        if (player.totalPoints > maxTeam[0]) {
                            maxTeam[0] = player.totalPoints;
                        }
                    }
                    if (player.eligiblePositions.includes("RB")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[1]) {
                            nextScore = maxTeam[1];
                            maxTeam[1] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[2]) {
                            nextScore = maxTeam[2];
                            maxTeam[2] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("WR")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[3]) {
                            nextScore = maxTeam[3];
                            maxTeam[3] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[4]) {
                            nextScore = maxTeam[4];
                            maxTeam[4] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("TE")) {
                        let maxScore = player.totalPoints;
                        let nextScore = player.totalPoints;
                        if (maxScore > maxTeam[5]) {
                            nextScore = maxTeam[5];
                            maxTeam[5] = maxScore;
                            maxScore = nextScore;
                        }
                        if (maxScore > maxTeam[6]) {
                            nextScore = maxTeam[6];
                            maxTeam[6] = maxScore;
                            maxScore = nextScore;
                        }
                    }
                    if (player.eligiblePositions.includes("D/ST")) {
                        if (player.totalPoints > maxTeam[7]) {
                            maxTeam[7] = player.totalPoints;
                        }
                    }
                    if (player.eligiblePositions.includes("K")) {
                        if (player.totalPoints > maxTeam[8]) {
                            maxTeam[8] = player.totalPoints;
                        }
                    }
                    if (player.position === 'Bench') {
                        awayBenchPoints += player.totalPoints;
                    }
                });
                output[year][matchupPeriod][awayTeamId]['startScore'] = Math.round(awayScore * 100) / 100;
                output[year][matchupPeriod][awayTeamId]['benchScore'] = Math.round(awayBenchPoints * 100) / 100;
                output[year][matchupPeriod][awayTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

                output[year][matchupPeriod][homeTeamId]['difference'] = Math.round((homeScore - awayScore) * 100) / 100;
                output[year][matchupPeriod][awayTeamId]['difference'] = Math.round((awayScore - homeScore) * 100) / 100;

                output[year][matchupPeriod][homeTeamId]['win'] = homeScore > awayScore ? true : false;
                output[year][matchupPeriod][awayTeamId]['win'] = homeScore > awayScore ? false : true;

                output[year][matchupPeriod][homeTeamId]['opponent'] = awayTeamId;
                output[year][matchupPeriod][awayTeamId]['opponent'] = homeTeamId;

                if (matchupPeriodId > (constants.playoffEndWeek[year] - 3)) {
                    const matchupDistance = constants.playoffEndWeek[year] - matchupPeriodId;
                    const rounds = {
                        2: 4,
                        1: 2,
                        0: 1
                    }
                    if ((i < rounds[matchupDistance])) {
                        output[year][matchupPeriod][homeTeamId]['playoffPlayed'] = 1;
                        output[year][matchupPeriod][awayTeamId]['playoffPlayed'] = 1;
                    }
                }
            }
        });
    }

    return output;
}

function formatWeekData(data) {
    const everyWeek = [];

    data.forEach(entry => {
        everyWeek.push({
            id: entry[0],
            year: entry[1],
            week: entry[2],
            team: entry[3],
            manager: constants.managers[entry[3]],
            opponent: entry[9],
            startScore: entry[4],
            benchScore: entry[5],
            optimalScore: entry[6],
            difference: entry[7],
            win: entry[8],
            playoffGame: entry[10] === 1
        });
    });

    const winStreaks = {};
    const lossStreaks = {};
    const playoffWins = {};
    const groupedData = {};

    everyWeek.forEach(entry => {
        const teamId = entry.team;

        if (!winStreaks.hasOwnProperty(teamId)) {
            winStreaks[teamId] = 0;
        }

        if (entry.win) {
            winStreaks[teamId] += 1;
        } else {
            winStreaks[teamId] = 0;
        }


        entry.winStreak = winStreaks[teamId];
        const currentYear = entry.year;
        const currentWeek = entry.week;

        if (!playoffWins.hasOwnProperty(teamId)) {
            playoffWins[teamId] = {
                year: currentYear,
                week: currentWeek,
                count: 0
            };
        }

        const teamWinInfo = playoffWins[teamId];

        if (entry.win && entry.playoffGame) {
            if (teamWinInfo.year === currentYear && teamWinInfo.week === currentWeek - 1) {
                teamWinInfo.count += 1;
            } else {
                teamWinInfo.count = 1;
            }

            teamWinInfo.year = currentYear;
            teamWinInfo.week = currentWeek;

            if (teamWinInfo.count === 3) {
                entry.championship = 1;
            }
        } else {
            teamWinInfo.count = 0;
            teamWinInfo.year = currentYear;
            teamWinInfo.week = currentWeek;
        }
        if ((typeof entry.optimalScore === 'number') && (entry.optimalScore !== 0)) {
            entry.optimizedPercentage = (entry.startScore / entry.optimalScore) * 100;
        } else {
            entry.optimizedPercentage = 0;
        }
        entry.date = constants.endDates[currentYear][currentWeek];

        const key = `${entry.year}-${entry.week}`;
        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(entry);
    });

    // Add weekly ranking
    Object.keys(groupedData).forEach(key => {
        // Sort teams by startScore in descending order
        const sorted = groupedData[key].sort((a, b) => b.startScore - a.startScore);

        // Assign rankings with tie handling
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i].startScore < sorted[i - 1].startScore) {
                rank = i + 1;
            }
            sorted[i].weekRanking = rank;
        }
    });

    // Make change magic
    let nanFound = false;
    everyWeek.forEach(entry => {
        if (!nanFound) {
            let change = 0;
            const sortedKeys = Object.keys(franchiseValue).sort((a, b) => franchiseValue[b] - franchiseValue[a]);
            const keyMapping = {};
            sortedKeys.forEach((key, index) => {
                keyMapping[key] = index + 1;
            });

            if (entry.win) {
                change += constants.winBonus;
            } else {
                change += constants.lossPenalty;
            }

            change += constants.optimalBonus * (entry.optimizedPercentage / 100);
            change += constants.winStreakBonus * entry.winStreak;
            change += constants.pointBonus[entry.weekRanking];
            if (Math.abs(entry.difference) <= constants.closeGameRange) {
                change += constants.closeGameBonus;
            }

            if (entry.playoffGame) {
                change += constants.playoffBonus;
            }

            if (entry.championship === 1) {
                change += constants.championshipBonus;
            }

            if (change > 0) {
                entry.valueChange = change * constants.weightOfChange[keyMapping[entry.team]];
            } else {
                entry.valueChange = change;
            }

            if (isFinite(franchiseValue[entry.team])) {
                franchiseValue[entry.team] = franchiseValue[entry.team] + (1000 * (entry.valueChange / 100));
                entry.franchiseValue = franchiseValue[entry.team];
                if (!isFinite(franchiseValue[entry.team])) {
                    nanFound = true;
                }
            }
        }
    });
    return everyWeek;
}



async function upsertWeeklyScoresTable(client, formattedWeeks) {
    let rawWeek = [];
    for (var year in formattedWeeks) {
        var weeks = formattedWeeks[year];
        for (var week in weeks) {
            var teams = weeks[week];
            for (var teamId in teams) {
                var teamData = teams[teamId];
                var values = [
                    parseInt(year) + ' | ' + ('0' + parseInt(week.replace('Week_', ''))).slice(-2) + ' | ' + ('0' + parseInt(teamId)).slice(-2),
                    parseInt(year),
                    parseInt(week.replace('Week_', '')),
                    parseInt(teamId) === 13 ? 11 : parseInt(teamId),
                    teamData.startScore,
                    teamData.benchScore || 0,
                    teamData.optimalScore || 0,
                    teamData.difference || 0,
                    teamData.win,
                    parseInt(teamData.opponent) === 13 ? 11 : parseInt(teamData.opponent),
                    teamData.playoffPlayed || 0
                ];
                rawWeek.push(values);
            }
        }
    }

    const formatedWeeks = formatWeekData(rawWeek);
    for (var i = 0; i < formatedWeeks.length; i++) {
        var entry = formatedWeeks[i];
        var insertQuery = `
            INSERT INTO weekly_scores (
                id,
                year,
                week,
                date,
                team,
                manager_name,
                opponent,
                opponent_name,
                win,
                playoff_game,
                championship_win,
                win_streak,
                staters_score,
                bench_score,
                optimal_score,
                percent_optimized,
                matchup_difference,
                week_ranking,
                value_change,
                franchise_value
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
            ON CONFLICT (id) 
            DO UPDATE SET
                year = EXCLUDED.year,
                week = EXCLUDED.week,
                date = EXCLUDED.date,
                team = EXCLUDED.team,
                manager_name = EXCLUDED.manager_name,
                opponent = EXCLUDED.opponent,
                opponent_name = EXCLUDED.opponent_name,
                win = EXCLUDED.win,
                playoff_game = EXCLUDED.playoff_game,
                championship_win = EXCLUDED.championship_win,
                win_streak = EXCLUDED.win_streak,
                staters_score = EXCLUDED.staters_score,
                bench_score = EXCLUDED.bench_score,
                optimal_score = EXCLUDED.optimal_score,
                percent_optimized = EXCLUDED.percent_optimized,
                matchup_difference = EXCLUDED.matchup_difference,
                week_ranking = EXCLUDED.week_ranking,
                value_change = EXCLUDED.value_change,
                franchise_value = EXCLUDED.franchise_value;
        `;

        try {
            await client.query(
                insertQuery,
                [
                    entry.id, // 1 - id
                    entry.year, // 2 - year
                    entry.week, // 3 - week
                    entry.date, // 4 - date
                    entry.team, // 5 - team
                    constants.managers[entry.team], // 6 - manager_name
                    entry.opponent, // 7 - opponent
                    constants.managers[entry.opponent], // 8 - opponent_name
                    entry.win, // 9 - win
                    entry.playoffGame, // 10 - playoff_game
                    entry.championship === 1, // 11 - championship_win
                    entry.winStreak, // 12 - win_streak
                    entry.startScore, // 13 - staters_score
                    entry.benchScore, // 14 - bench_score
                    entry.optimalScore, // 15 - optimal_score
                    parseFloat(entry.optimizedPercentage).toFixed(2), // 16 - percent_optimized
                    entry.difference, // 17 - matchup_difference
                    entry.weekRanking, // 18 - week_ranking
                    parseFloat(entry.valueChange).toFixed(2), // 19 - value_change
                    parseFloat(entry.franchiseValue).toFixed(2) // 20 - franchise_value
                ]
            );
        } catch (err) {
            console.error('Error executing query', err.stack);
        }
    }
}

async function upsertYearlyOverviewTable(client, formattedYear) {
    for (var i = 0; i < Object.keys(formattedYear).length; i++) {
        var year = Object.keys(formattedYear)[i];
        var teamData = formattedYear[year];
        var insertQuery = `
            INSERT INTO yearly_recap (
                id,
                year,
                team,
                manager_name,
                total_wins,
                total_losses,
                longest_win_streak,
                total_points_for,
                total_points_against,
                total_moves,
                aquisitions,
                trades
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            ON CONFLICT (id) 
            DO UPDATE SET
                year = EXCLUDED.year,
                team = EXCLUDED.team,
                manager_name = EXCLUDED.manager_name,
                total_wins = EXCLUDED.total_wins,
                total_losses = EXCLUDED.total_losses,
                longest_win_streak = EXCLUDED.longest_win_streak,
                total_points_for = EXCLUDED.total_points_for,
                total_points_against = EXCLUDED.total_points_against,
                total_moves = EXCLUDED.total_moves,
                aquisitions = EXCLUDED.aquisitions,
                trades = EXCLUDED.trades;
        `;
        for (var j = 0; j < Object.keys(teamData).length; j++) {
            var team = Object.keys(teamData)[j];
            team = team === 13 ? 11 : parseInt(team);
            var entry = teamData[team];
            try {
                await client.query(
                    insertQuery,
                    [
                        parseInt(year) + ' | ' + ('0' + parseInt(team)).slice(-2), // 1 - id
                        year, // 2 - year
                        team, // 3 - team
                        constants.managers[team], // 4 - manager_name
                        entry.totalWins, // 5 - total_wins
                        entry.totalLosses, // 6 - total_losses
                        entry.longestWinStreak, // 7 - longest_win_streak
                        parseFloat(entry.totalPointsFor).toFixed(2), // 8 - total_points_for
                        parseFloat(entry.totalPointsAgainst).toFixed(2), // 9 - total_points_against
                        entry.totalMoves, // 10 - total_moves
                        entry.aquisitions, // 11 - aquisitions
                        entry.trades, // 12 - trades
                    ]
                );
            } catch (err) {
                console.error('Error executing query', err.stack);
            }
        }
    }
}

function totalsByTeam(data) {
    const totals = {};
    data.forEach(entry => {
        if (totals.hasOwnProperty(entry[3])) {
            let currentValues = totals[entry[3]];
            currentValues.startScore += entry[4];
            currentValues.benchScore += entry[5];
            currentValues.optimalScore += entry[6];
            currentValues.difference += entry[7];
            if (entry[8]) {
                currentValues.wins += 1;
            } else {
                currentValues.losses += 1;
            }
            if ((entry[8]) && (entry[10] === 1)) {
                currentValues.playoffPlayed += 1;
                currentValues.playoffwins += 1;
            } else if (entry[10] === 1) {
                currentValues.playoffPlayed += 1;
            }
            totals[entry[3]] = currentValues;
        } else {
            totals[entry[3]] = {
                startScore: entry[4],
                benchScore: entry[5],
                optimalScore: entry[6],
                difference: entry[7],
                wins: entry[8] ? 1 : 0,
                losses: entry[8] ? 0 : 1,
                playoffPlayed: entry[10],
                playoffwins: ((entry[8]) && (entry[10] === 1)) ? 1 : 0
            }
        }
    });
}

module.exports = {
    outputFile,
    getBoxscores,
    createWinLossJSON,
    parseV2Data,
    parseV3Data,
    formatWeekData,
    totalsByTeam,
    upsertWeeklyScoresTable,
    upsertYearlyOverviewTable,
    getTranasctions
}