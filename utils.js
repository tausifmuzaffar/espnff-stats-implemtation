const dotenv = require('dotenv').config();
const fs = require('fs');
const request = require('superagent');
const espn = require('espn-fantasy-football-api/node');
const league = new espn.Client({ leagueId: process.env.LEAGUEID });
league.setCookies({
	espnS2: process.env.ESPNS2,
	SWID: process.env.SWID
});
const v3StartYear = 2018;

function getBoxscores(startYear, lastYear) {
	let matchupWeek = [];
	for (let i = startYear; i <= lastYear; i++) {
		if (i < v3StartYear) {
			const req = request.get('https://fantasy.espn.com/apis/v3/games/ffl/leagueHistory/1097599?seasonId='+ i +'&view=mMatchup');
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
				if(output[year][week][team]['win']) {
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

function outputFile (dir, name, data) {
	if (!fs.existsSync('./' + dir)){
	    fs.mkdirSync('./' + dir);
	}
	fs.writeFile(dir + '/' + name + new Date().getTime() + '.json', JSON.stringify(data, null, 4) + '\n\n', (err) => {
	    if (err) throw err;
	    console.log('Saved ' + dir + '/' + name );
	});
}

function v2DataParse(output, boxscores, year, matchupPeriodId) {
	let bye = 1;
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
					output[year][matchupPeriod][matchup.home.teamId]['opponent'] = 'BYE' + bye;
					output[year][matchupPeriod]['BYE' + bye] = {
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
					output[year][matchupPeriod][matchup.away.teamId]['opponent'] = 'BYE' + bye;
					output[year][matchupPeriod]['BYE' + bye] = {
		                "startScore": 0,
		                "win": false,
		                "opponent": matchup.away.teamId
		            };
					bye++;
				}
			}
		})
	}

	return output;
}

function v3DataParse(output, boxscores, year, matchupPeriodId) {
	let matchupPeriod = 'Week_' + matchupPeriodId;
	if (boxscores.length > 0) {
		boxscores.forEach((matchup) => {
			if (matchup.homeScore != 0) {
				let homeTeamId = matchup.homeTeamId ? matchup.homeTeamId : 'BYE1';
				let awayTeamId = matchup.awayTeamId ? matchup.awayTeamId : 'BYE1';
				let homeScore = matchup.homeScore === undefined ? 0 : matchup.homeScore;
				let awayScore = matchup.awayScore === undefined ? 0 : matchup.awayScore;

				if (!output.hasOwnProperty(year)) {
					output[year] = {};
				}
				if (!output[year].hasOwnProperty(matchupPeriod)) {
					output[year][matchupPeriod] = {};
				}
				output[year][matchupPeriod][homeTeamId] = {};

				if ((output[year][matchupPeriod].hasOwnProperty('BYE1')) && (awayTeamId === 'BYE1')) {
					awayTeamId = 'BYE2';
				}

				output[year][matchupPeriod][awayTeamId] = {};

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
				output[year][matchupPeriod][homeTeamId]['startScore'] = Math.round(homeScore * 100) / 100 ;
				output[year][matchupPeriod][homeTeamId]['benchScore'] = Math.round(homeBenchPoints * 100) / 100;
				output[year][matchupPeriod][homeTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

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
				output[year][matchupPeriod][awayTeamId]['startScore'] = Math.round(awayScore * 100) / 100;
				output[year][matchupPeriod][awayTeamId]['benchScore'] = Math.round(awayBenchPoints * 100) / 100;
				output[year][matchupPeriod][awayTeamId]['optimalScore'] = Math.round(maxTeam.reduce((a, b) => a + b, 0) * 100) / 100;

				output[year][matchupPeriod][homeTeamId]['difference'] = Math.round((homeScore - awayScore) * 100) / 100;
				output[year][matchupPeriod][awayTeamId]['difference'] = Math.round((awayScore - homeScore) * 100) / 100;

				output[year][matchupPeriod][homeTeamId]['win'] = homeScore > awayScore ? true : false;
				output[year][matchupPeriod][awayTeamId]['win'] = homeScore > awayScore ? false : true;

				output[year][matchupPeriod][homeTeamId]['opponent'] = awayTeamId;
				output[year][matchupPeriod][awayTeamId]['opponent'] = homeTeamId;
			}
		});
	}

	return output;
}

module.exports = {
  outputFile,
  getBoxscores,
  createWinLossJSON,
  v2DataParse,
  v3DataParse,
}
