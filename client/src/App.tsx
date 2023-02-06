import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from "jquery";
import './App.css';
import { Alert, Button, Input, Label, Progress, Spinner } from 'reactstrap';
import Playlist, { IPlaylist } from './Playlist';

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

  const [playlists, setPlaylists] = useState<Array<IPlaylist | undefined>>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [initialCallHitRateLimit, setInitialCallHitRateLimit] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [nextMetadataLink, setNextMetadataLink] = useState<string | null>(null);

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
          setNextMetadataLink('https://api.spotify.com/v1/me/playlists')
        },
        error: function(response) {
          if (response.status === 401) setAccessToken('');
          else if (response.status === 429) setInitialCallHitRateLimit(true);
          else setInitialCallHitRateLimit(false);
        }
      });
    }
  }, [accessToken])  // eslint-disable-line react-hooks/exhaustive-deps

  function loadTracks(index: number) {
    console.warn('loading tracks for playlist', index)
    const playlist = playlists[index]
    if (!playlist?.metadata?.tracks?.href) return;

    const url = `${playlist.metadata.tracks.href}?fields=items(track(name,artists(name),album(name)))`;
    return ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items && response.items[0]) {
          setPlaylists(playlists => {
            playlist.data = {
              tracks: response.items.map(({ track }: { track: { name: string, artists: {}[] } }) => track).filter((track: {}) => !!track),
            };
            playlists[index] = playlist;
            return playlists;
          });
        }
        // TODO: recurse:
        // if (response.next) recursivelyGetPlaylists(response.next);
        // else {
        //   playlistsTracksUrls = playlists.map(({ tracks }) => tracks.href);
        //   console.log(playlistsTracksUrls);
        // }
      },
      error: function(response) {
        // TODO: handle other errors
        if (response.status === 429) {
          setTimeout(() => loadTracks(index), rateLimitWindowSeconds*1000)
        }
      }
    });
  }

  const loadNextBatchOfPlaylistMetadatas = useCallback((url: string) => {
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items) {
          setPlaylists((playlists) => {
            if (response.offset === 0) playlists = Array.from(Array(response.total));
            response.items.forEach((item: IPlaylist['metadata'], index: number) => playlists[index + response.offset] = { metadata: item })
            return playlists;
          })
          setNextMetadataLink(response.next)
        } else console.error('response to recursivelyGetPlaylists had no items')
      },
      error: function(response) {
        // TODO: handle other errors
        if (response.status === 429) {
          setTimeout(() => loadNextBatchOfPlaylistMetadatas(url), rateLimitWindowSeconds*1000)
        } else {
          console.error('unknown error in recursivelyGetPlaylists', response)
        }
      }
    });
  }, [accessToken])

  useEffect(() => {
    const playlistsWithMetadata = playlists.filter(playlist => playlist) as IPlaylist[];

    // console.warn('checking whether to load next metadata batch', !!nextMetadataLink, playlists.find((playlist) => !(!playlist?.metadata || !!playlist?.data?.tracks)))
    // console.warn('checking whether to load next metadata batch', !!nextMetadataLink, !!firstPlaylistWithoutTracks, !firstPlaylistWithoutTracks?.metadata, firstPlaylistWithoutTracks)
    console.warn('checking whether to load next metadata batch', !!nextMetadataLink, !playlistsWithMetadata.some((playlist) => !playlist.data), playlistsWithMetadata.find((playlist) => !playlist.data))
    // load next batch of playlists metadata ONLY if all playlists loaded so far
    if (!!nextMetadataLink && !playlistsWithMetadata.some((playlist) => !playlist.data)) {
      loadNextBatchOfPlaylistMetadatas(nextMetadataLink)
    }
  }, [playlists, nextMetadataLink, loadNextBatchOfPlaylistMetadatas])

  // function recursivelyGetPlaylists(url = 'https://api.spotify.com/v1/me/playlists') {
  //   ajax({
  //     url,
  //     headers: {
  //       'Authorization': 'Bearer ' + accessToken
  //     },
  //     success: function(response) {
  //       if (response.items) {
  //         console.warn('loading playlists metadata', playlists.length)
  //         if (response.offset === 0) setPlaylists(Array.from(Array(response.total)));
  //         setPlaylists((playlists) => {
  //           response.items.forEach((item: IPlaylist['metadata'], index: number) => playlists[index + response.offset] = { metadata: item })
  //           return playlists;
  //         })
  //         if (response.next) recursivelyGetPlaylists(response.next);
  //       } else console.error('response to recursivelyGetPlaylists had no items')
  //     },
  //     error: function(response) {
  //       // TODO: handle other errors
  //       if (response.status === 429) {
  //         setTimeout(() => recursivelyGetPlaylists(url), rateLimitWindowSeconds*1000)
  //       } else {
  //         console.error('unknown error in recursivelyGetPlaylists', response)
  //       }
  //     }
  //   });
  // }

  const reloadPlaylists = () => {
    setLoading(true);
    setPlaylists([]);
    // recursivelyGetPlaylists();
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
            {
              initialCallHitRateLimit && (
                <Alert color="danger">
                  Rate limit reached with spotify. Try refreshing in 30 seconds, otherwise the service might be down for up to a day
                </Alert>
              )
            }
            <div className="text-center">
              {loading ? 'Searching' : 'Searched'} {playlists.filter((playlist) => !!playlist?.data?.tracks).length} / {playlists.length} playlists
            </div>
            <Progress
              animated={loading}
              value={playlists.filter((playlist) => !!playlist?.data?.tracks).length}
              max={playlists.length}
              barStyle={{ backgroundColor: spotifyGreen }}
            />
            <h3>Matching Playlists</h3>
            <div id="matching-playlists-links">
              {playlists.map((playlist, index) => (
                <Playlist
                  playlist={playlist}
                  searchTerm={searchTerm}
                  loadTracks={() => loadTracks(index)}
                />
              ))}
              {/* {matchingPlaylists.map(({ playlist, tracks }) => (
                <Playlist playlist={playlist} tracks={tracks} searchTerm={searchTerm} />
              ))} */}
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
