import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from "jquery";
import './App.css';
import { Alert, Button, Input, Label, Progress, Spinner } from 'reactstrap';
import Playlist from './Playlist';
// import MatchingPlaylist from './MatchingPlaylist';

/* TODO: store previous versions and don't reload same version
Use the snapshot_id
Playlist APIs expose a snapshot_id that corresponds to the version of the
playlist that you are working with. Downloading a playlist can be expensive
so some apps may want to store and refer to the snapshot_id to avoid refreshing
an entire playlist that has not changed. You can learn more about snapshot_id in
our Working with Playlists guide.
https://developer.spotify.com/documentation/general/guides/working-with-playlists/
*/

function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  },[value]); //this code will run when the value of 'value' changes
  return ref.current; //in the end, return the current ref value.
}

// TODO: use retry-after instead of this constant
// UPDATE: for some reason I can't access this header, either through ajax or
// fetch, even though access-control-allow-headers includes it
/* The header of the 429 response will normally include a Retry-After header
with a value in seconds. Consider waiting for the number of seconds specified in
Retry-After before your app calls the Web API again.*/
const rateLimitWindowSeconds = 30;

const spotifyGreen = '#1DB954';

interface PlaylistMetadata {
  name: string,
  external_urls: { spotify: string },
  tracks: { href: string },
}

function App() {
  const [accessToken, setAccessToken] = useState('');
  const previousAccessToken = usePrevious(accessToken);

  const [profileInfo, setProfileInfo] = useState<{ display_name?: string, external_urls?: { spotify: string }}>({});

  const [playlists, setPlaylists] = useState<PlaylistMetadata[]>([]);
  const [playlistsTracks, setPlaylistsTracks] = useState<{ playlist: { name: string, external_urls: { spotify: string } }, tracks: { name: string, artists: { name: string }[], album: { name: string } }[] }[]>([]);

  const [playlistIndex, setPlaylistIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [initialCallHitRateLimit, setInitialCallHitRateLimit] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [matchingPlaylists, setMatchingPlaylists] = useState<{ playlist?: { name: string, url: string }; tracks?: { name: string, artists: string[], album: string, trackIndexInPlaylist: number }[]; }[]>([]);

  useEffect(() => {
    if (searchTerm === '') return;

    setMatchingPlaylists(playlistsTracks.map(({playlist, tracks}) => {
      if (!playlist) return {};
      return {
        playlist: {
          name: playlist.name,
          url: playlist.external_urls.spotify
        },
        tracks: tracks.map(({name, artists, album}: { name: string, artists: { name: string }[], album: { name: string } }, index) => {
          return {
            name,
            artists: artists.map(({name}) => name),
            album: album.name,
            trackIndexInPlaylist: index,
          };
        }).filter(({name, artists, album}) => (`${name} ${artists.join(' ')} ${album}`.toLowerCase().includes(searchTerm.toLowerCase())))
      };
    }).filter(({playlist, tracks}) => !!playlist && tracks.length > 0));
  }, [searchTerm, playlistsTracks])

  useEffect(() => {
    if (previousAccessToken) return;

    if (!accessToken){
      ajax({
        url: '/refresh_token',
        xhrFields: { withCredentials: true },
      }).done(function(data) {
        setAccessToken(data.access_token);
      });
    } else {
      ajax({
        url: 'https://api.spotify.com/v1/me',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        },
        success: function(response) {
          setInitialCallHitRateLimit(false);
          setProfileInfo(response);
          recursivelyGetPlaylists();
        },
        error: function(response) {
          if (response.status === 401) setAccessToken('');
          else if (response.status === 429) setInitialCallHitRateLimit(true);
          else setInitialCallHitRateLimit(false);
        }
      });
    }
  }, [accessToken])  // eslint-disable-line react-hooks/exhaustive-deps

  function recursivelyGetPlaylists(url = 'https://api.spotify.com/v1/me/playlists') {
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items) {
          if (response.offset === 0) setPlaylists(Array.from(Array(response.total)));
          setPlaylists((playlists) => {
            response.items.forEach((item: PlaylistMetadata, index: number) => playlists[index + response.offset] = item)
            return playlists;
          })
          if (response.next) recursivelyGetPlaylists(response.next);
        } else console.error('response to recursivelyGetPlaylists had no items')
      },
      error: function(response) {
        // TODO: handle other errors
        if (response.status === 429) {
          setTimeout(() => recursivelyGetPlaylists(url), rateLimitWindowSeconds*1000)
        } else {
          console.error('unknown error in recursivelyGetPlaylists', response)
        }
      }
    });
  }

  const reloadPlaylists = () => {
    setLoading(true);
    setPlaylists([]);
    setPlaylistsTracks([]);
    recursivelyGetPlaylists();
  }

  return (
    <div className="container">
      {
        accessToken ? (
          <div>
            {
              (profileInfo.external_urls?.spotify && profileInfo.display_name) && (
                <h1>Logged in as <a target="_blank" href={profileInfo.external_urls?.spotify} rel="noreferrer">{profileInfo.display_name}</a></h1>
              )
            }
            <div>
              <Label for="song-name">Song Name</Label>
              <Input name="song-name" id="song-name-field" type="text" value={searchTerm} onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)} />
            </div>
            <div>
              <Button id="reload-playlists-button" onClick={() => reloadPlaylists()}>Reload Playlists</Button>
            </div>
            <div className="text-center">
              {loading ? 'Searching' : 'Searched'} {playlistIndex} / {playlists.length} playlists
            </div>
            <Progress
              animated={loading}
              value={playlistIndex}
              max={playlists.length}
              barStyle={{ backgroundColor: spotifyGreen }}
            />
            <h3>Matching Playlists</h3>
            <div id="matching-playlists-links">
              {playlists.map(({ tracks }) => (
                <Playlist accessToken={accessToken} href={tracks.href} searchTerm={searchTerm} rateLimitWindowSeconds={rateLimitWindowSeconds} />
              ))}
            </div>
          </div>
        ) : (
        <div>
          <h1>Spotify In-Playlist Search</h1>
          <a href="/login" className="btn btn-primary">Log in with Spotify</a>
        </div>
        )
      }
    </div>
  );
}

export default App;
