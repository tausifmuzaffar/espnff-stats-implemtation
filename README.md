# ESPN Fantasy Football API v3 Implementation

## Overview
Using the ESPN Fantasy Football v3 API to create metrics for my personal league. 

Using https://stmorse.github.io/journal/espn-fantasy-v3.html and https://www.npmjs.com/package/espn-fantasy-football-api creating a suit of advance fantasy football metrics that can be plug and play into other fantasy leagues

## How to set up 
### Create enviornment variables
Create a .env file with the following data
```
# League Details
LEAGUEID= # The league id found in league URL
LEAGUECREATION= # The year your league started (Before 2018 the data has been dramatically reduced by ESPN)

# You'll need two cookies from ESPN: espn_s2 and SWID. These are found at "Application > Cookies > espn.com" in the Chrome DevTools when on espn.com.
ESPNS2=
SWID=
```
### Install app
Prereq: nodejs and npm installed and running on your machine
1.  cd espnff-stats-implemtation
2.  npm install
3.  node index.js
