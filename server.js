const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const schedule = require('node-schedule');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();


const app = express()
const port = 3000


async function connectDB(){
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING); 
  console.log('Connected');
}
connectDB();


const matchSchema = new mongoose.Schema({ matchId: Number, homeTeamId: Number, homeTeam: String, homeTeamScore: Number, awayTeamId: Number, awayTeam: String, awayTeamScore: Number, matchDateTime: Date, matchHighligth: String, thumbnailURL: String, title: String, description: String, });
const Finished_Matches = mongoose.model('Finished_Matches', matchSchema);

const futureMatchSchema = new mongoose.Schema({ matchId: Number, homeTeamId: Number, homeTeam: String, awayTeamId: Number, awayTeam: String, matchStartTime: Date, homeTeamChannelId : String, awayTeamChannelId: String });
const Upcaming_Matches = mongoose.model('Upcaming_Matches', matchSchema);



//The below route allows to view and save Past Football Fixtures to data base with video and
// video property
//Please comment the loop part to only view Past Football Fixtures
app.get('/', (req, res) => {

  getPastFootballDataFixtures()
  .then(fixturesData => {
    res.send(fixturesData)
    console.log(fixturesData);

      for (let i=0;i<fixturesData.length;i++){
        searchHighlightsForPastMatches(fixturesData[i]);     
     }

  })
  .catch(error => {
    console.error(error);
  });

})


 //The below route allows to view and save Future Football Fixtures to data base with 
 //channel id of each team
 //Please comment the loop part to only view Future Football Fixtures
app.get('/saveFutureFixtures', async (req, res) => {
 
    getFutureFootballDataFixtures().then(async fixturesData => {
    console.log(fixturesData);
    res.send(fixturesData)

    //Looping on future Football Fixtures to save to data base
    for (let i=0;i<fixturesData.length;i++){
      let match=new Upcaming_Matches(fixturesData[i]);
      console.log(match);
      await match.save();  
     }

  })
  .catch(error => {
    console.error(error);
  });

})



//The below Server main method allows to view and Schedule Todays Football Fixtures every  
// day at 6 am morning by scheduling and promising to resolve as the time reaches
//Please Uncomment the commented part to view Today Football Fixtures and schedule by now and 
//comment the rest
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
   
  // getTodayFootballDataFixtures()
  // .then(fixtures => {
  //   console.log(fixtures);
  //   //scheduleMultipleHighlightSearches(fixtures);
  // })
  // .catch(error => {
  //   console.error(error);
  // });
  

  
    function scheduleDailyMatches() {
      console.log("Good morning");
      getTodayFootballDataFixtures()
      .then(fixtures => {
        console.log(fixtures);
        scheduleMultipleHighlightSearches(fixturesData);
      })
      .catch(error => {
        console.error(error);
      });
    }
    
    const now = new Date();
    let millisTillMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0) - now;
    if (millisTillMorning < 0) {
         millisTillMorning += 86400000; // if it is after 6am, try 6am tomorrow.
    }
    setTimeout(function(){setInterval(scheduleDailyMatches, 24 * 60 * 60 * 1000)}, millisTillMorning);


})










//To get channel id of teams from teams.json
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




//This is the method that performs youtube api call for highligth vidoes 
//and store the whole match information with its highligth information

async function searchHighlights(params) {
  
  const {  matchId, homeTeamId, homeTeam, awayTeamId, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId, } = params;
  
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });
  const startDate = new Date(matchStartTime);
  startDate.setHours(startDate.getHours() + 2); // Add two hours to the start time
  const endDate = new Date(matchStartTime);
  endDate.setHours(endDate.getHours() + 4); // Add five hours to the start time

  const queries = [
    `${homeTeam} vs ${awayTeam} highlight`,
    `${awayTeam} vs ${homeTeam} highlight`
  ];

  let firstLink = null;
  let firstvideo = null;

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
            firstvideo=videos[0];
            firstLink = videos[0].id.videoId;
            break;
          }
          } catch (error) {
          console.error('Error searching for highlights:', error);
          }
      }

      if (firstLink) {
              
        console.log(matchId + homeTeam + awayTeam+' First highlight link: https://www.youtube.com/watch?v=' + firstLink);
        console.log( matchId + homeTeam + awayTeam+' Thumbnail URL: ' + firstvideo.snippet.thumbnails.default.url);
        console.log('Title:', firstvideo.snippet.title);
        console.log('Description:', firstvideo.snippet.description);


        const matchid=parseInt(matchId);
        getMatchScoresById(matchid).then(async scores => {
        
        console.log(scores.homeTeamScore);  // Display home team score
        console.log(scores.awayTeamScore);  // Display away team score
       
      
        const matchHighlights = {
          matchId: matchid,
          homeTeamId: homeTeamId,
          homeTeam: homeTeam,
          homeTeamScore: scores.homeTeamScore,
          awayTeamId: awayTeamId,
          awayTeam: awayTeam,
          awayTeamScore: scores.awayTeamScore,
          matchDateTime: matchStartTime,
          matchHighligth: `https://www.youtube.com/watch?v=${firstLink}`,
          thumbnailURL: firstvideo.snippet.thumbnails.default.url,
          title: firstvideo.snippet.title,
          description: firstvideo.snippet.description,
        };
        
        job.cancel();

        //  Store the match with its Highlight information      
        let match=new Finished_Matches(matchHighlights);
        console.log(match);
        await match.save();


      })
      .catch(error => {
        console.log('Error:', error);
      });
        break; // Exit the loop if a video is found
      }
    }

    if (new Date() > endDate) {
      console.log('No highlights found.');
      job.cancel();
    }
   console.log('This message takes five minutes', new Date(), firstLink);
      
  });

}


//This is the method that performs youtube api call for past match highligth vidoes 
//and store the whole match information with its highligth information

async function searchHighlightsForPastMatches(params) {
  
  const {  matchId, homeTeamId, homeTeam, awayTeamId, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId, } = params;
  
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });
  const startDate = new Date(matchStartTime);
  startDate.setHours(startDate.getHours() + 2); // Add two hours to the start time
  const endDate = new Date(matchStartTime);
  endDate.setHours(endDate.getHours() + 4); // Add five hours to the start time

  const queries = [
    `${homeTeam} vs ${awayTeam} highlight`,
    `${awayTeam} vs ${homeTeam} highlight`
  ];

  let firstLink = null;
  let firstvideo = null;
//*/5 * * * *
  const job = schedule.scheduleJob('*/30 * * * * * ' , async () => {
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
            firstvideo=videos[0];
            firstLink = videos[0].id.videoId;
            break;
          }
          } catch (error) {
          console.error('Error searching for highlights:', error);
          }
      }

      if (firstLink) {
              
        console.log(matchId + homeTeam + awayTeam+' First highlight link: https://www.youtube.com/watch?v=' + firstLink);
        console.log( matchId + homeTeam + awayTeam+' Thumbnail URL: ' + firstvideo.snippet.thumbnails.default.url);
        console.log('Title:', firstvideo.snippet.title);
        console.log('Description:', firstvideo.snippet.description);


        const matchid=parseInt(matchId);
        getMatchScoresById(matchid).then(async scores => {
        
        console.log(scores.homeTeamScore);  // Display home team score
        console.log(scores.awayTeamScore);  // Display away team score
       
      
        const matchHighlights = {
          matchId: matchid,
          homeTeamId: homeTeamId,
          homeTeam: homeTeam,
          homeTeamScore: scores.homeTeamScore,
          awayTeamId: awayTeamId,
          awayTeam: awayTeam,
          awayTeamScore: scores.awayTeamScore,
          matchDateTime: matchStartTime,
          matchHighligth: `https://www.youtube.com/watch?v=${firstLink}`,
          thumbnailURL: firstvideo.snippet.thumbnails.default.url,
          title: firstvideo.snippet.title,
          description: firstvideo.snippet.description,
        };
        
        job.cancel();

        //  Store the match with its Highlight information      
        let match=new Finished_Matches(matchHighlights);
        console.log(match);
        await match.save();


      })
      .catch(error => {
        console.log('Error:', error);
      });
        break; // Exit the loop if a video is found
      }
    }

  
      
  });

}


//This is the method that performs football api call for match score information 
async function getMatchScoresById(matchId) {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;
  const config = {
    method: 'get',
    url: `https://v3.football.api-sports.io/fixtures?id=${matchId}`,
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };

  return new Promise((resolve, reject) => {
    axios(config)
      .then(response => {
        const fixture = response.data.response[0];
        const homeTeamScore = fixture.goals.home;
        const awayTeamScore = fixture.goals.away;
        resolve({ homeTeamScore, awayTeamScore });
      })
      .catch(error => {
        console.log(error);
        reject(error);
      });
  });
}


//This is the method that performs football api call for Finshed(past) match information 
//It returns 99 Finshed(past) match information as json
async function getPastFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;
  const config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=FT',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };

  try {
    const response = await axios(config);

    const fixtures = response.data.response;
    const last99Fixtures = fixtures.slice(-99);

    const fixturesData = last99Fixtures.map(fixture => {
      const matchId = String(fixture.fixture.id);
      const matchStartTime = fixture.fixture.date;
      const homeTeam = fixture.teams.home.name;
      const homeTeamId = fixture.teams.home.id;
      const awayTeam = fixture.teams.away.name;
      const awayTeamId = fixture.teams.away.id;
      const homeTeamChannelId = getChannelIdByTeamName(homeTeam); // Replace with actual channel IDs
      const awayTeamChannelId = getChannelIdByTeamName(awayTeam);
      const homeTeamScore = fixture.goals.home;
      const awayTeamScore = fixture.goals.away;

      return {
        matchId,
        homeTeamId,
        homeTeam,
        homeTeamScore,
        awayTeamId,
        awayTeam,
        awayTeamScore,
        matchStartTime,
        homeTeamChannelId,
        awayTeamChannelId
      };
    });

    return fixturesData;
  } catch (error) {
    console.log(error);
    return null;
  }
}




//This is the method that performs football api call for Todays match information 
//It returns Todays match information as json
function getTodayFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;

  var config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=NS',
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
      const matchId = String(fixture.fixture.id);
      const homeTeam = fixture.teams.home.name;
      const homeTeamId = fixture.teams.home.id;
      const awayTeam = fixture.teams.away.name;
      const awayTeamId = fixture.teams.away.id;
      const matchStartTime = fixture.fixture.date; // Get the time part of the date
      const homeTeamChannelId = getChannelIdByTeamName(homeTeam); // Replace with actual channel IDs
      const awayTeamChannelId = getChannelIdByTeamName(awayTeam);
      
      return {
        matchId,
        homeTeamId,
        homeTeam,
        awayTeamId,
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





//This is the method that performs football api call for Future(Not started) match information 
//It returns Future(Not started) match information as json
async function getFutureFootballDataFixtures() {
  const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;
  const config = {
    method: 'get',
    url: 'https://v3.football.api-sports.io/fixtures?league=39&season=2023&status=NS',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };

  try {
    const response = await axios(config);
    const fixtures = response.data.response;
    
    const fixturesData = fixtures.map(fixture => {
      const matchId = String(fixture.fixture.id);
      const matchStartTime = fixture.fixture.date;
      const homeTeam = fixture.teams.home.name;
      const homeTeamId = fixture.teams.home.id;
      const awayTeam = fixture.teams.away.name;
      const awayTeamId = fixture.teams.away.id;
      const homeTeamChannelId = getChannelIdByTeamName(homeTeam); // Replace with actual channel IDs
      const awayTeamChannelId = getChannelIdByTeamName(awayTeam);

      return { matchId,  homeTeamId, homeTeam, awayTeamId, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId };
    });

    return fixturesData;
  } catch (error) {
    console.log(error);
    return null;
  }
}





//Promise Football Fixtures by promising to resolve as the time reaches and
// by callling searchHighlight method which schedule youtube api call every five minute and 
//to search highligth vidoes and store the whole match information with its highligth information
async function scheduleMultipleHighlightSearches(matches) {
  const promises = [];
  for (const match of matches) {
    const { matchId, homeTeamId, homeTeam, awayTeamId, awayTeam, matchStartTime, homeTeamChannelId, awayTeamChannelId, } = match;
    // Calculate starting time based on matchStartTime
    const delay = matchStartTime - Date.now();

    // Create a promise that calls searchHighlights after the delay
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          console.log(homeTeam + awayTeam + matchStartTime + homeTeamChannelId + awayTeamChannelId);
          resolve(searchHighlights(match));
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







