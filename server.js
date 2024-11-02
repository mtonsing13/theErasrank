require('dotenv').config()
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const path = require('path');
const app = express();

console.log(process.env)


//const client_id = '92e5575fa0304bed8bd33b022d248cad';
//const client_secret = '009c458cafe54c3f9ddd58899fa35d70';
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = 'http://localhost:8888/callback';


app.use(express.static(path.join(__dirname, 'public')));


let access_token = '';

//will add renaming dictionary 
const renamingDictionary = {
  "Midnights (The Til Dawn Edition)": "Midnights",
  "Midnights (3am Edition)": "Midnights",
  "You’re Losing Me (From The Vault)": "Midnights",
  'folklore (deluxe version)': 'Folklore',
  'folklore': 'Folklore',
  'folklore: the long pond studio sessions (from the Disney+ special) [deluxe edition]': 'Folklore',
  "Red (Taylor's Version)": 'Red',
  'Red (Deluxe Edition)': 'Red',
  'Red': 'Red',
  "Fearless (Taylor's Version)": "Fearless",
  'Fearless Platinum Edition': 'Fearless',
  'Fearless': 'Fearless',
  "1989 (Taylor's Version)": '1989',
  "1989 (Taylor's Version) [Deluxe]": '1989',
  '1989': '1989',
  '1989 (Deluxe Edition)': '1989',
  'Lover': 'Lover',
  'Reputation Stadium Tour Surprise Song Playlist': 'Reputation',
  'reputation': 'Reputation',
  "Speak Now (Taylor's Version)": 'Speak Now',
  'Speak Now (Deluxe Edition)': 'Speak Now',
  'Speak Now World Tour Live': 'Speak Now',
  'Speak Now': 'Speak Now',
  'evermore': 'Evermore',
  'evermore (deluxe version)': 'Evermore',
  'The Tortured Poets Department': 'The Tortured Poets Department',
  'All Of The Girls You Loved Before': 'Lover',
  'THE TORTURED POETS DEPARTMENT: THE ANTHOLOGY': 'The Tortured Poets Department',
  'THE TORTURED POETS DEPARTMENT': 'The Tortured Poets Department',
  'Taylor Swift': 'Taylor Swift',
};

// Spotify Login Route
app.get('/login', (req, res) => {
 const scope = 'user-top-read';
 res.redirect(
   'https://accounts.spotify.com/authorize?' +
     querystring.stringify({
       response_type: 'code',
       client_id: client_id,
       scope: scope,
       redirect_uri: redirect_uri,
     })
 );
});


// Spotify Callback Route
app.get('/callback', (req, res) => {
 const code = req.query.code || null;

 axios({
   method: 'post',
   url: 'https://accounts.spotify.com/api/token',
   data: querystring.stringify({
     grant_type: 'authorization_code',
     code: code,
     redirect_uri: redirect_uri,
   }),
   headers: {
     Authorization:
       'Basic ' +
       Buffer.from(client_id + ':' + client_secret).toString('base64'),
     'Content-Type': 'application/x-www-form-urlencoded',
   },
 })
   .then(response => {
     access_token = response.data.access_token;
     res.redirect('/index.html');
   })
   .catch(error => {
     console.error('Error retrieving access token:', error);
     res.status(500).send('Error retrieving access token');
   });
});


// Helper function to fetch user's top tracks with an extended time range
async function fetchTopTracks(time_range = 'long_term') {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      params: {
        limit: 50,
        time_range: time_range,
      },
    });
    return response.data.items;
  } catch (error) {
    console.error(`Error fetching top tracks for ${time_range}:`, error);
    throw error;
  }
}


//will add this so we can have more tracks to use 
// Function to fetch top tracks from all time ranges and combine them
async function fetchAllTopTracks() {
  const timeRanges = ['short_term', 'medium_term', 'long_term'];
  const allTopTracks = new Map(); // Use a Map to prevent duplicate tracks

  for (const range of timeRanges) {
    const tracks = await fetchTopTracks(range);
    tracks.forEach(track => {
      if (!allTopTracks.has(track.id)) {
        allTopTracks.set(track.id, track);
      }
    });
  }
  return Array.from(allTopTracks.values()); // Convert the Map to an array
}

// API to fetch Taylor Swift albums and accumulate play counts
app.get('/api/top-taylor-swift-albums', async (req, res) => {
  if (!access_token) {
    return res.status(401).json({ error: 'Access token is missing' });
  }

  try {
    // Step 1: Fetch Taylor Swift's artist ID
    const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      params: {
        q: 'Taylor Swift',
        type: 'artist',
        limit: 1,
      },
    });

    const artist = searchResponse.data.artists.items[0];
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const artistId = artist.id;

    // Step 2: Fetch all albums by Taylor Swift
    const albumsResponse = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      params: {
        include_groups: 'album',
        market: 'US',
        limit: 50,
      },
    });

    const albums = albumsResponse.data.items;

    // Step 3: Fetch user's top tracks over the long-term timeframe
    //will change this since we want to add all short/middle/long term together 
    //const topTracks = await fetchTopTracks('long_term');
    const topTracks = await fetchAllTopTracks();
    
    // Step 4: Initialize a count for each album
    const albumCounts = {};

    // Step 5: Match top tracks to albums and count occurrences
    topTracks.forEach(track => {
      //const originalAlbumName = track.album.name;
      const albumName = renamingDictionary[track.album.name] || track.album.name;
      //console.log(`Original: ${originalAlbumName}, Renamed: ${albumName}`);
      albumCounts[albumName] = (albumCounts[albumName] || 0) + 1;
    });

    // Step 6: Create a list of albums with their respective counts
    const albumsWithCounts = albums.map(album => {
      const albumName = renamingDictionary[album.name] || album.name;
      //return { ...album, count: albumCounts[albumName] || 0 };
      
      //return only albums not in the renamingDictionary 
      //return renamingDictionary[album.name] ? null : {...album,count: albumCounts[albumName] || 0 };
    //}).filter(album=>album!=null);
    return {
      ...album,
      name: albumName,
      count: albumCounts[albumName] || 0
    };
  });


  /*
    const uniqueAlbums = [];` qww`
    const seen = new Set();

    albumsWithCounts.forEach(album => {
      if (album.artists.some(a => a.name === 'Taylor Swift') && !seen.has(album.name)) {
        uniqueAlbums.push(album);
        seen.add(album.name);
      }
    });

    const sortedAlbums = uniqueAlbums.sort((a, b) => b.count - a.count);
    */

    // Step 7: Deduplicate by album name and keep highest count version
    const uniqueAlbums = {};
    albumsWithCounts.forEach(album => {
      if (!uniqueAlbums[album.name] || album.count > uniqueAlbums[album.name].count) {
        uniqueAlbums[album.name] = album;
      }
    });

    // Step 8: Convert uniqueAlbums object to array and sort by count
    const sortedAlbums = Object.values(uniqueAlbums).sort((a, b) => b.count - a.count);


    res.json(sortedAlbums);
    console.log(sortedAlbums);
  } catch (error) {
    console.error('Error fetching top albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});















//Tried this way in order to rank tracks then sort track to each album
//but this would mean you have to go latest tracks then sort it to
//taylor album, but its possibel you havent listen to taylor in the 
//past few months so need to fix!
// Helper function to fetch top tracks within a specific time range
/*
async function fetchTopTracks(time_range) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      params: {
        limit: 100000,
        time_range: time_range,
      },
    });
    return response.data.items;
  } catch (error) {
    console.error(`Error fetching top tracks for ${time_range}:`, error);
    throw error;
  }
}
const renamingDictionary = {
  'Midnights (The Til Dawn Edition)': 'Midnights',
  'Midnights (3am Edition)': 'Midnights',
  'Folklore (Deluxe)': 'Folklore',
  'Folklore': 'Folklore',
  'Folklore: the long pond studio sessions (from the Disney+ special)[deluxe edition]': 'Folklore',
  'Red (Taylor’s Version)': 'Red',
  'Red (Deluxe Edition)': 'Red',
  'Red': 'Red',
  'Fearless (Taylor’s Version)': 'Fearless',
  'Fearless Platinum Edition': 'Fearless',
  'Fearless': 'Fearless',
  '1989 (Taylor’s Version)': '1989',
  '1989 (Taylor’s Version) [Deluxe]' : '1989',
  '1989': '1989',
  '1989 (Deluxe Edition)': '1989',
  'Lover': 'Lover',
  'Reputation Stadium Tour Surprise Song Playlist': 'Reputation',
  'Reputation': 'Reputation',
  'Speak Now (Taylor’s Version)': 'Speak Now',
  'Speak Now (Deluxe Edition)': 'Speak Now',
  'Speak Now': 'Speak Now',
  'Evermore': 'Evermore',
  'Evermore (deluxe version)': 'Evermore',
  'The Tortured Poets Department': 'The Tortured Poets Department',
  'All Of The Girls You Loved Before': 'Lover',
  'The Tortured Poets Department:The Anthology': 'The Tortured Poets Department',
  'Taylor Swift': 'Taylor Swift',
};
function getStandardAlbumName(albumName) {
  return renamingDictionary[albumName] || albumName;
}

async function getTopAlbums() {
  const topTracks = await fetchTopTracks('medium_term'); // Adjust time range as needed
  
  const albumCounts = {};

  topTracks.forEach(track => {
    const albumName = getStandardAlbumName(track.album.name);
    
    if (albumCounts[albumName]) {
      albumCounts[albumName] += 1; // Increment count for each track appearance
    } 
    else {
      albumCounts[albumName] = 1; // Initialize count
    }
  });
  console.log(albumCounts)
  return albumCounts;
}

app.get('/api/top-taylor-swift-albums', async (req, res) => {
  try {
    const albumCounts = await getTopAlbums('medium_term');;
    
    // Convert to sorted array
    const sortedAlbums = Object.entries(albumCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Limit to top 10

    res.json(sortedAlbums);
  } catch (error) {
    console.error('Error fetching top albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});




*/









/*
// API to fetch the top played Taylor Swift albums since a specific date
app.get('/api/top-taylor-swift-albums', async (req, res) => {
   if (!access_token) {
     return res.status(401).json({ error: 'Access token is missing' });
   }
    try {
     // Fetch Taylor Swift's artist ID
     const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
       headers: {
         Authorization: 'Bearer ' + access_token,
       },
       params: {
         q: 'Taylor Swift',
         type: 'artist',
         limit: 1,
       },
     });
      const artist = searchResponse.data.artists.items[0];
     if (!artist) {
       return res.status(404).json({ error: 'Artist not found' });
     }
      const artistId = artist.id;
      // Fetch albums for Taylor Swift using artist ID
     const albumsResponse = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
       headers: {
         Authorization: 'Bearer ' + access_token,
       },
       params: {
         include_groups: 'album',
         market: 'US',
         limit: 50, // Set the limit to 10
       },
     });
      const albums = albumsResponse.data.items;
      //console.log(albums);
      const renamingDictionary = {
        'Midnights (The Til Dawn Edition)': 'Midnights',
        'Midnights (3am Edition)': 'Midnights',
        'Folklore (Deluxe)': 'Folklore',
        'Folklore': 'Folklore',
        'Folklore: the long pond studio sessions (from the Disney+ special)[deluxe edition]': 'Folklore',
        'Red (Taylor’s Version)': 'Red',
        'Red (Deluxe Edition)': 'Red',
        'Red': 'Red',
        'Fearless (Taylor’s Version)': 'Fearless',
        'Fearless Platinum Edition': 'Fearless',
        'Fearless': 'Fearless',
        '1989 (Taylor’s Version)': '1989',
        '1989 (Taylor’s Version) [Deluxe]' : '1989',
        '1989': '1989',
        '1989 (Deluxe Edition)': '1989',
        'Lover': 'Lover',
        'Reputation Stadium Tour Surprise Song Playlist': 'Reputation',
        'Reputation': 'Reputation',
        'Speak Now (Taylor’s Version)': 'Speak Now',
        'Speak Now (Deluxe Edition)': 'Speak Now',
        'Speak Now': 'Speak Now',
        'Evermore': 'Evermore',
        'Evermore (deluxe version)': 'Evermore',
        'The Tortured Poets Department': 'The Tortured Poets Department',
        'All Of The Girls You Loved Before': 'Lover',
        'The Tortured Poets Department:The Anthology': 'The Tortured Poets Department',
        'Taylor Swift': 'Taylor Swift',
      };
      //create count album counts empty dictionary
      const albumCounts = {};
     await albums.map(async (album) => {
       // Fetch tracks for each album
       const tracksResponse = await axios.get(`https://api.spotify.com/v1/albums/${album.id}/tracks`, {
         headers: {
           Authorization: 'Bearer ' + access_token,
         },
       });
        const tracks = tracksResponse.data.items;
        // Calculate total play counts for the album (assuming play counts are stored in a relevant field)
       const totalPlayCount = tracks.reduce((acc, track) => {
         // Assuming track has a property `playcount`
         return acc + (track.playcount || 0); // Default to 0 if playcount is not defined
       }, 0);
       //if album.name is in rename dictoniary change to the regular name and add totalPlayCount
       //in safe change

       //here do something that saves info
       //albums list

       //process each album in album list 
       //dont want output one next get output 
       albums.forEach(album => {
        //rename album if its in the renaming dictionary 
        const albumName = renamingDictionary[album] || album;
        if (albumCounts[albumName]){
          //not sure if this correctly adds
          albumCounts[albumName] += album.totalPlayCount
        }
        else{
          albumCounts[albumName] += album.totalPlayCount
        }
       });
     });
     console.log(albumCounts)

     //now will create a map where each album is paired with its count
     const albumDataPromises = albums.map(async (album) => {
        //this one joins albums
        //so will rename albumname if needed
        const albumName = renamingDictionary[album] || album;

        //then will get count for the renamed album
        return {...album,count:albumCounts[albumName]};

        //first check if needs to rename 
        
     });

      const albumsWithPlayCounts = await Promise.all(albumDataPromises);
      // Sort the albums based on play counts and take top 10
     const sortedAlbums = albumsWithPlayCounts
       .filter(album => album.artists.some(a => a.name === 'Taylor Swift'))
       .sort((a, b) => b.playcount - a.playcount)
       .slice(0, 50);
      res.json(sortedAlbums);
   } catch (error) {
     console.error('Error fetching top albums:', error);
     res.status(500).json({ error: 'Failed to fetch albums' });
   }
 });

*/
// Start the server
app.listen(8888, () => {
 console.log('Server is running on http://localhost:8888');
});
