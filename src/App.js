import React, { useEffect, useState } from 'react';
import axios from 'axios';

const App = () => {
  const [topTracks, setTopTracks] = useState([]);

  // Get the access_token from the URL after user logs in
  const access_token = new URLSearchParams(window.location.hash.substring(1)).get('access_token');

  // Fetch the user's top tracks from Spotify
  useEffect(() => {
    if (access_token) {
      axios.get('https://api.spotify.com/v1/me/top/tracks', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      })
      .then(response => {
        setTopTracks(response.data.items);  // Set top tracks in state
      })
      .catch(error => {
        console.error('Error fetching top tracks:', error);
      });
    }
  }, [access_token]);

  return (
    <div>
      <h1>Your Top Tracks</h1>
      <ul>
        {topTracks.map(track => (
          <li key={track.id}>{track.name} by {track.artists[0].name}</li>
        ))}
      </ul>
    </div>
  );
};

export default App;