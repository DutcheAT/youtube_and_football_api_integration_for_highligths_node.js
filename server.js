const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const schedule = require('node-schedule');
const fs = require('fs');
require('dotenv').config();


const app = express()
const port = 3000




app.get('/', (req, res) => {
  res.send('Hello World!')
 

  getTodayFootballDataFixtures()
  .then(function (todayFixtures) {
    if (todayFixtures) { 
      scheduleMultipleHighlightSearches(todayFixtures);   // Store or process the today's fixtures data here
      console.log(todayFixtures[0]);
    } else {
      console.log('Failed to fetch today\'s fixtures.');
    } })
  .catch(function (error) {
    console.log('Error:', error);
  });
})



app.get('/blog', (req, res) => {
    res.send('This is blog')
   
const homeTeam = 'Arsenal';
const awayTeam = 'Manchester United';
const matchStartTime = new Date('2023-09-03T15:30:00+00:00');
const homeTeamChannelId = getChannelIdByTeamName(homeTeam); // Replace with actual channel IDs
const awayTeamChannelId = getChannelIdByTeamName(awayTeam);
searchHighlights(homeTeam, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId);
})


app.listen(port, () => {

  console.log(`Example app listening on port ${port}`)

})




function getChannelIdByTeamName(teamName) {
  const teamsJson = fs.readFileSync('teams.json');
  const teamsData = JSON.parse(teamsJson);
  const teams = teamsData.teams;

  const team = teams.find((team) => team.name === teamName);
  if (team) {
    return team.ChannelId;
  } else {
    return null; // Team not found
  }
}






async function searchHighlights(homeTeam, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId) {
  
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  const startDate = new Date(matchStartTime);
  startDate.setHours(startDate.getHours() + 2); // Add two hours to the start time
  const endDate = new Date(matchStartTime);
  endDate.setHours(endDate.getHours() + 10); // Add five hours to the start time

  const queries = [
    `${homeTeam} vs ${awayTeam} highlight`,
    `${awayTeam} vs ${homeTeam} highlight`
  ];

  let firstLink = null;

  const job = schedule.scheduleJob('*/5 * * * *' , async () => {
    for (const query of queries) {
      for (const channelId of [homeTeamChannelId, awayTeamChannelId]) {
        try {
          const response = await youtube.search.list({
            part: 'snippet',
            q: query,
            channelId: channelId,
            publishedAfter: startDate.toISOString(),
            publishedBefore: endDate.toISOString(),
            type: 'video'
          });

          const videos = response.data.items;
          if (videos.length > 0) {
            firstLink = videos[0].id.videoId;
            break;
          }
        } catch (error) {
          console.error('Error searching for highlights:', error);
        }
      }

      if (firstLink) {
        console.log('First highlight link: https://www.youtube.com/watch?v=' + firstLink);
        job.cancel();
        break; // Exit the loop if a video is found
      }
    }

    // if (new Date() > endDate) {
    //   console.log('No highlights found.');
    //   job.cancel();
    // }
    console.log('This message takes five minutes'+new Date() + firstLink);
  });
}






function getPastFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;
  var config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=FT',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };
  
  axios(config)
  .then(function (response) {
    
    const fixtures = response.data.response;
    for (const fixture of fixtures) {
      const startTime = fixture.fixture.date;
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;

      console.log("Match Start Time:", startTime);
      console.log("Home Team:", homeTeam);
      console.log("Away Team:", awayTeam);
    }
  })
  .catch(function (error) {
    console.log(error);
  });
}




function getTodayFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;

  var config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=FT',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };
  return axios(config)
    .then(function (response) {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in the 'YYYY-MM-DD' format
      const fixtures = response.data.response;
      const todayFixtures = fixtures.filter(fixture => fixture.fixture.date.split('T')[0] === today);
     
     // Process and extract relevant information
     const processedFixtures = todayFixtures.map(fixture => {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const matchStartTime = fixture.fixture.date; // Get the time part of the date
      const homeTeamChannelId = getChannelIdByTeamName(homeTeam); // Replace with actual channel IDs
      const awayTeamChannelId = getChannelIdByTeamName(awayTeam);
      
      return {
        homeTeam,
        awayTeam,
        matchStartTime,
        homeTeamChannelId,
        awayTeamChannelId,
        
      };
    });

    return processedFixtures;
    })
    .catch(function (error) {
      console.log(error);
      throw error; 
    });
}


function getFutureFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;

  var config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=NS',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };
  
  axios(config)
  .then(function (response) {
    console.log(JSON.stringify(response.data));
  })
  .catch(function (error) {
    console.log(error);
  });
}






async function scheduleMultipleHighlightSearches(matches) {
  const promises = [];

  for (const match of matches) {
    const { homeTeam, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId } = match;
  console.log(homeTeam + awayTeam + matchStartTime + homeTeamChannelId + awayTeamChannelId);
    // Calculate starting time based on matchStartTime
    const delay = matchStartTime - Date.now();

    // Create a promise that calls searchHighlights after the delay
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          console.log(homeTeam + awayTeam + matchStartTime + homeTeamChannelId + awayTeamChannelId);
          resolve(searchHighlights(homeTeam, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId));
        } catch (error) {
          reject(error);
        }
      }, delay);
    });

    promises.push(promise);
  }

  // Wait for all promises to resolve or reject
  try {
    await Promise.all(promises);
    console.log("All highlight searches completed.");
  } catch (error) {
    console.error("Error during highlight searches:", error);
  }
}
