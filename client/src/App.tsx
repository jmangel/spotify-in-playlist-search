import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from "jquery";
import './App.css';
import { Alert, Button, Input, Label, Progress, Spinner } from 'reactstrap';
import MatchingPlaylist from './MatchingPlaylist';

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

function App() {
  const [accessToken, setAccessToken] = useState('');
  const previousAccessToken = usePrevious(accessToken);

  const [profileInfo, setProfileInfo] = useState<{ display_name?: string, external_urls?: { spotify: string }}>({});

  const [devices, setDevices] = useState<{ id: string, is_active: boolean, name: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const [playlists, setPlaylists] = useState<{ name: string, external_urls: { spotify: string }, tracks: { href: string }; uri: string; }[]>([]);
  const [playlistsTracks, setPlaylistsTracks] = useState<{ playlist: { name: string, external_urls: { spotify: string } }, tracks: { name: string, uri: string, artists: { name: string }[], album: { name: string } }[] }[]>([]);

  const [playlistIndex, setPlaylistIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [initialCallHitRateLimit, setInitialCallHitRateLimit] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [matchingPlaylists, setMatchingPlaylists] = useState<{ playlist?: { name: string, url: string, uri: string }; tracks?: { name: string, uri: string, artists: string[], album: string, trackIndexInPlaylist: number }[]; }[]>([]);

  useEffect(() => {
    if (searchTerm === '') return;

    setMatchingPlaylists(playlistsTracks.map(({playlist, tracks}, index) => {
      if (!playlist) return {};
      return {
        playlist: {
          name: playlist.name,
          url: playlist.external_urls.spotify,
          uri: playlists[index].uri,
        },
        tracks: tracks.map(({name, uri, artists, album}: { name: string, uri: string, artists: { name: string }[], album: { name: string } }, index) => {
          return {
            name,
            uri,
            artists: artists.map(({name}) => name),
            album: album.name,
            trackIndexInPlaylist: index,
          };
        }).filter(({name, artists, album}) => (`${name} ${artists.join(' ')} ${album}`.toLowerCase().includes(searchTerm.toLowerCase())))
      };
    }).filter(({playlist, tracks}) => !!playlist && tracks.length > 0));
  }, [searchTerm, playlistsTracks, playlists])

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
      ajax({
        url: 'https://api.spotify.com/v1/me/player/devices',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        },
        success: function(response) {
          // setInitialCallHitRateLimit(false);
          setDevices(response.devices);
          // recursivelyGetPlaylists();

        },
        error: function(response) {
          // if (response.status === 401) setAccessToken('');
          // else if (response.status === 429) setInitialCallHitRateLimit(true);
          // else setInitialCallHitRateLimit(false);
        }
      });
    }
  }, [accessToken])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSelectedDeviceId(devices.find(({ is_active }) => is_active)?.id || ''), [devices])

  const memoizedGetPlaylistTracks = useCallback((index: number) => {
    if (index >= playlists.length) {
      setLoading(false);
      setPlaylistIndex(index);
      return;
    }

    const url = `${playlists[index].tracks.href}?fields=items(track(uri,name,artists(name),album(name)))`;
    setPlaylistIndex(index);
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items && response.items[0]) {
          setPlaylistsTracks(playlistsTracks => [...playlistsTracks, {
            playlist: playlists[index],
            tracks: response.items.map(({ track }: { track: { name: string, uri: string, artists: {}[] } }) => track).filter((track: {}) => !!track),
          }]);
        }
        // TODO: recurse:
        // if (response.next) recursivelyGetPlaylists(response.next);
        // else {
        //   playlistsTracksUrls = playlists.map(({ tracks }) => tracks.href);
        //   console.log(playlistsTracksUrls);
        // }
        memoizedGetPlaylistTracks(index + 1);
      },
      error: function(response) {
        // TODO: handle other errors
        if (response.status === 429) {
          setTimeout(() => memoizedGetPlaylistTracks(index), rateLimitWindowSeconds*1000)
        } else {
          memoizedGetPlaylistTracks(index + 1);
        }
      }
    });
  }, [accessToken, playlists])

  useEffect(() => {
    if (!loadingPlaylists && playlists.length > 0) memoizedGetPlaylistTracks(0);
  }, [loadingPlaylists, playlists, memoizedGetPlaylistTracks])

  function recursivelyGetPlaylists(url = 'https://api.spotify.com/v1/me/playlists') {
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items) {
          setPlaylists(playlists => [...playlists, ...response.items]);
          if (response.next) recursivelyGetPlaylists(response.next);
          else {
            setLoadingPlaylists(false);
          }
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
    setLoadingPlaylists(true);
    setPlaylists([]);
    setPlaylistsTracks([]);
    recursivelyGetPlaylists();
  }

  const playPlaylistTrack = useCallback((playlistUri: string | undefined, songUri: string, offsetPosition: number) => {
    ajax({
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      url: `https://api.spotify.com/v1/me/player/play?device_id=${selectedDeviceId}`,
      type: 'PUT',
      data: JSON.stringify({
        context_uri: playlistUri,
        offset: {
          position: offsetPosition,
        },
        position_ms: 0,
      }),
      success: function(response) {
        // We want to make this call twice, because if we call with offset: uri
        // immediately, it might fail if the device hasn't loaded the most
        // up-to-date playlist snapshot; if we pass in offset: position, it will
        // start playing at the position, which might be an out-of-date song,
        // but it will force reload the playlist so that it will be up-to-date,
        // so a second request to the song uri should succeed
        setTimeout(() => {
          ajax({
            url: 'https://api.spotify.com/v1/me/player',
            headers: {
              'Authorization': 'Bearer ' + accessToken
            },
            complete: function(xhr) {
              const response = JSON.parse(xhr.responseText)
              if (response?.item?.uri !== songUri) {
                setTimeout(
                  () => ajax({
                    headers: {
                      'Authorization': 'Bearer ' + accessToken
                    },
                    url: `https://api.spotify.com/v1/me/player/play?device_id=${selectedDeviceId}`,
                    type: 'PUT',
                    data: JSON.stringify({
                      context_uri: playlistUri,
                      offset: {
                        uri: songUri,
                      },
                      position_ms: 0,
                    }),
                  }),
                  2000
                )
              }
            }
          })
        }, 1000)
      },
    })
  }, [accessToken, selectedDeviceId])

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
            {
              loadingPlaylists && (
                <div>
                  {
                    initialCallHitRateLimit && (
                      <Alert color="danger">
                        Rate limit reached with spotify. Try refreshing in 30 seconds, otherwise the service might be down for up to a day
                      </Alert>
                    )
                  }
                  <small>
                    (Still loading more playlists)
                  </small>
                  <Spinner
                    size="sm"
                    className="ml-2"
                    style={{ color: spotifyGreen }}
                  >
                  </Spinner>
                </div>
              )
            }
            <div className="text-center">
              {loading ? 'Searching' : 'Searched'} {playlistIndex} / {playlists.length} playlists
            </div>
            <Progress
              animated={loading}
              value={playlistIndex}
              max={playlists.length}
              barStyle={{ backgroundColor: spotifyGreen }}
            />
            <div>Playing on
              <Input type="select" name="select" value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
                {devices.map(({ name, id }) => (
                  <option value={id}>{name}</option>
                ))}
              </Input>
            </div>
            <h3>Matching Playlists</h3>
            <div id="matching-playlists-links">
              {matchingPlaylists.map(({ playlist, tracks }) => (
                <MatchingPlaylist playlist={playlist} tracks={tracks} playPlaylistTrack={(songUri: string, offsetPosition: number) => playPlaylistTrack(playlist?.uri, songUri, offsetPosition)} />
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
