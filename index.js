const dotenv = require('dotenv').config();
const fs = require('fs');
const request = require('superagent');
const espn = require('espn-fantasy-football-api/node');
const league = new espn.Client({ leagueId: process.env.LEAGUEID });
const startYear = process.env.LEAGUECREATION;
const v3StartYear = 2018;//process.env.LEAGUECREATION;
const lastYear = new Date().getMonth() > 7 ? new Date().getFullYear() : (new Date().getFullYear() - 1);
league.setCookies({
	espnS2: process.env.ESPNS2,
	SWID: process.env.SWID
});
let output = {};
let winLoss = {};
let matchupId = 1;
let matchupWeek = [];

for (let i = startYear; i <= lastYear; i++) {
	if (i < v3StartYear) {
		const req = request.get('https://fantasy.espn.com/apis/v3/games/ffl/leagueHistory/1097599?seasonId=2013&view=mMatchup');
		matchupWeek.push(
			new Promise((resolve, reject) => {
		      	req.end((error, res) => {
		      		resolve({scores: res.body, year: i});
		        });
      		})
		);
	} else {
		for (let j = 1; j <= 17; j++) {
			matchupWeek.push(
				new Promise((resolve, reject) => {
					league.getBoxscoreForWeek({ seasonId: i, scoringPeriodId: j, matchupPeriodId: j }).then((boxscores) => {
						resolve({scores: boxscores, week: j, year: i});
					})
				})
			);
		}
	}
}

Promise.all(matchupWeek).then((res) => {
	res.forEach((cell) => {
		let boxscores = cell.scores;
		let year = cell.year;
		let matchupPeriodId = cell.week;
		if (year >= v3StartYear) {
			v3DataParse(boxscores, year, matchupPeriodId);
		} else {
			v2DataParse(boxscores, year, matchupPeriodId);
		}
	});
	outputFile('_scoresBackup', 'allYearScores', output);

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
				if(output[year][week][team]['win']) {
					winLoss[team][output[year][week][team]['opponent']]['Wins'] = winLoss[team][output[year][week][team]['opponent']]['Wins'] + 1;
				} else {
					winLoss[team][output[year][week][team]['opponent']]['Losses'] = winLoss[team][output[year][week][team]['opponent']]['Losses'] + 1;
				}
			});
		});
	});
	outputFile('_winsLossesBackup', 'allYearWinsLosses', winLoss);
});

function outputFile (dir, name, data) {
	if (!fs.existsSync('./' + dir)){
	    fs.mkdirSync('./' + dir);
	}
	fs.writeFile(dir + '/' + name + new Date().getTime() + '.json', JSON.stringify(data, null, 4) + '\n\n', (err) => {
	    if (err) throw err;
	    console.log('Saved ' + dir + '/' + name );
	});
}

function v2DataParse(boxscores, year, matchupPeriodId) {
	if (boxscores.length > 0) {
		if (!output.hasOwnProperty(year)) {
			output[year] = {};
		}
		boxscores[0].schedule.forEach((matchup) => {
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
					output[year][matchupPeriod][matchup.home.teamId]['opponent'] = 0;
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
					output[year][matchupPeriod][matchup.away.teamId]['opponent'] = 0;
				}
			}
		})
	}
}

function v3DataParse(boxscores, year, matchupPeriodId) {
	let matchupPeriod = 'Week_' + matchupPeriodId;
	if (boxscores.length > 0) {
		boxscores.forEach((matchup) => {
			if (matchup.homeScore != 0) {
				if (!output.hasOwnProperty(year)) {
					output[year] = {};
				}
				if (!output[year].hasOwnProperty(matchupPeriod)) {
					output[year][matchupPeriod] = {};
				}
				output[year][matchupPeriod][matchup.homeTeamId] = {};
				output[year][matchupPeriod][matchup.awayTeamId] = {};

				let homeBenchPoints = 0;
				let maxTeam = [0, 0, 0, 0, 0, 0, 0, 0, 0];
				matchup.homeRoster.forEach((player) => {
					// QB, RB, RB, WR, WR, TE, FLEX, D, K
					if (player.player.eligiblePositions.includes("QB")) {
						if (player.totalPoints > maxTeam[0]) {
							maxTeam[0] = player.totalPoints;
						}
					}
					if (player.player.eligiblePositions.includes("RB")) {
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
					if (player.player.eligiblePositions.includes("WR")) {
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
					if (player.player.eligiblePositions.includes("TE")) {
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
					if (player.player.eligiblePositions.includes("D/ST")) {
						if (player.totalPoints > maxTeam[7]) {
							maxTeam[7] = player.totalPoints;
						}
					}
					if (player.player.eligiblePositions.includes("K")) {
						if (player.totalPoints > maxTeam[8]) {
							maxTeam[8] = player.totalPoints;
						}
					}
					if (player.position === 'Bench') {
						homeBenchPoints += player.totalPoints;
					}
				});
				output[year][matchupPeriod][matchup.homeTeamId]['startScore'] = Math.round(matchup.homeScore * 100) / 100 ;
				output[year][matchupPeriod][matchup.homeTeamId]['benchScore'] = Math.round(homeBenchPoints * 100) / 100;
				output[year][matchupPeriod][matchup.homeTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

				let awayBenchPoints = 0;
				maxTeam = [0, 0, 0, 0, 0, 0, 0, 0, 0];
				matchup.awayRoster.forEach((player) => {
					// QB, RB, RB, WR, WR, TE, FLEX, D, K
					if (player.player.eligiblePositions.includes("QB")) {
						if (player.totalPoints > maxTeam[0]) {
							maxTeam[0] = player.totalPoints;
						}
					}
					if (player.player.eligiblePositions.includes("RB")) {
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
					if (player.player.eligiblePositions.includes("WR")) {
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
					if (player.player.eligiblePositions.includes("TE")) {
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
					if (player.player.eligiblePositions.includes("D/ST")) {
						if (player.totalPoints > maxTeam[7]) {
							maxTeam[7] = player.totalPoints;
						}
					}
					if (player.player.eligiblePositions.includes("K")) {
						if (player.totalPoints > maxTeam[8]) {
							maxTeam[8] = player.totalPoints;
						}
					}
					if (player.position === 'Bench') {
						awayBenchPoints += player.totalPoints;
					}
				});
				output[year][matchupPeriod][matchup.awayTeamId]['startScore'] = Math.round(matchup.awayScore * 100) / 100;
				output[year][matchupPeriod][matchup.awayTeamId]['benchScore'] = Math.round(awayBenchPoints * 100) / 100;
				output[year][matchupPeriod][matchup.awayTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

				output[year][matchupPeriod][matchup.homeTeamId]['difference'] = Math.round((matchup.homeScore - matchup.awayScore) * 100) / 100;
				output[year][matchupPeriod][matchup.awayTeamId]['difference'] = Math.round((matchup.awayScore - matchup.homeScore) * 100) / 100;

				output[year][matchupPeriod][matchup.homeTeamId]['win'] = matchup.homeScore > matchup.awayScore ? true : false;
				output[year][matchupPeriod][matchup.awayTeamId]['win'] = matchup.homeScore > matchup.awayScore ? false : true;

				output[year][matchupPeriod][matchup.homeTeamId]['opponent'] = matchup.awayTeamId;
				output[year][matchupPeriod][matchup.awayTeamId]['opponent'] = matchup.homeTeamId;
			}
		});
	}
}
