const dotenv = require('dotenv').config();
const startYear = process.env.LEAGUECREATION;
const lastYear = new Date().getMonth() > 7 ? new Date().getFullYear() : (new Date().getFullYear() - 1);
const utils = require('./utils.js');
const v3StartYear = 2018;

Promise.all(utils.getBoxscores(startYear,lastYear)).then((res) => {
	let output = {};
	let winLoss = {};
	res.forEach((cell) => {
		let boxscores = cell.scores;
		let year = cell.year;
		let matchupPeriodId = cell.week;
		if (year >= v3StartYear) {
			output = utils.v3DataParse(output, boxscores, year, matchupPeriodId);
		} else {
			output = utils.v2DataParse(output, boxscores, year, matchupPeriodId);
		}
	});
	winLoss = utils.createWinLossJSON(winLoss, output);

	utils.outputFile('_scoresBackup', 'allYearScores', output);
	utils.outputFile('_winsLossesBackup', 'allYearWinsLosses', winLoss);
});