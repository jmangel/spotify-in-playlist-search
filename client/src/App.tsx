import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ajax, ajaxSetup } from "jquery";
import './App.css';
import { Alert, Button, Input, Label, Progress, Spinner, UncontrolledAlert } from 'reactstrap';
import Playlist, { IPlaylist, IRememberedPlaylist, isRememberedPlaylist, ITrack } from './Playlist';

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

  const [profileInfo, setProfileInfo] = useState<{ display_name?: string, external_urls?: { spotify: string }, id?: string}>({});

  const [devices, setDevices] = useState<{ id: string, is_active: boolean, name: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);
  const [rememberedSnapshots, setRememberedSnapshots] = useState<IRememberedPlaylist[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [initialCallHitRateLimit, setInitialCallHitRateLimit] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [showRememberedPlaylists, setShowRememberedPlaylists] = useState(false);

  const [localStorageError, setLocalStorageError] = useState<string>();

  const loadDevices = useCallback(() => {
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
  }, [accessToken])

  const refreshAccessToken = () => {
   return ajax({
      url: '/refresh_token',
      xhrFields: { withCredentials: true },
    }).done(function(data) {
      setAccessToken(data.access_token);
    });
  }

  useEffect(() => {
    if (previousAccessToken) return;

    if (!accessToken){
      refreshAccessToken();
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
      loadDevices();
    }
  }, [accessToken])  // eslint-disable-line react-hooks/exhaustive-deps

  const [genericAjaxError, setGenericAjaxError] = useState<string>();

  useEffect(() => {
    ajaxSetup({
      // THIS GETS OVERWRITTEN BY CUSTOM ERROR HANDLERS
      error: function (x, status, error) {
        if (x.responseJSON.error.status === 401) refreshAccessToken()
        setGenericAjaxError(JSON.stringify(x))
      }
    });

    const rememberedSnapshots = Object.entries(localStorage).flatMap(([key, stringified]) => {
      const playlistId = key.replace(/playlistSnapshots_/, '');
      return (Object.values(JSON.parse(stringified)) as (IRememberedPlaylist & { tracks: { items: { track: ITrack }[] } })[]).map((value) => {
        return { ...value, tracks: value.tracks.items.map(({ track }) => track), id: playlistId };
      });
    });

    setRememberedSnapshots(rememberedSnapshots);
  }, [])

  useEffect(() => setSelectedDeviceId(selectedDeviceId => devices.find(({ is_active }) => is_active)?.id || selectedDeviceId || ''), [devices])

  const localStorageKey = (playlistId: string) => `playlistSnapshots_${playlistId}`;

  const loadPlaylistTracks = useCallback((index: number) => {
    if (index >= playlists.length) {
      setLoading(false);
      return;
    }

    const playlistId = playlists[index].metadata.id
    const url = `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,owner.id,description,images,snapshot_id,tracks.items(track(name,uri,artists(name),album(name)))`;
    if (playlists[index].data) {
      loadPlaylistTracks(index + 1);
    } else {
      ajax({
        url,
        headers: {
          'Authorization': 'Bearer ' + accessToken
        },
        success: function(response) {
          if (response.tracks && response.tracks.items && response.tracks.items[0]) {
            setPlaylists(playlists => {
              const newPlaylists = [...playlists];
              newPlaylists[index].data = {
                tracks: response.tracks.items.map(({ track }: { track: { name: string, uri: string, artists: {}[] } }) => track).filter((track: {}) => !!track),
              };
              return newPlaylists;
            });
          }
          const localStorageValue = JSON.parse(localStorage.getItem(localStorageKey(playlistId)) || '{}');
          if (!localStorageValue[response.snapshot_id]) {
            localStorageValue[response.snapshot_id] = { ...response, rememberedAt: new Date() };
            try {
              localStorage.setItem(localStorageKey(playlistId), JSON.stringify(localStorageValue));
            } catch (err) {
              if (err instanceof DOMException &&
                // everything except Firefox
                (err.code === 22 ||
                  // Firefox
                  err.code === 1014 ||
                  // test name field too, because code might not be present
                  // everything except Firefox
                  err.name === "QuotaExceededError" ||
                  // Firefox
                  err.name === "NS_ERROR_DOM_QUOTA_REACHED")
              ) {
                if (!!profileInfo?.id) {
                  Object.entries(localStorage).forEach(([key, stringified]) => {
                    const snapshots = Object.values(JSON.parse(stringified)) as (IRememberedPlaylist & { tracks: { items: { track: ITrack }[] } })[]
                    if (snapshots.some((snapshot) => snapshot.owner?.id === profileInfo.id)){
                      console.log('forgetting playlist snapshots for playlist', key);
                      localStorage.removeItem(key);
                    }
                  });
                  try {
                    localStorage.setItem(localStorageKey(playlistId), JSON.stringify(localStorageValue));
                  } catch (err) {
                    if (err instanceof DOMException &&
                      // everything except Firefox
                      (err.code === 22 ||
                        // Firefox
                        err.code === 1014 ||
                        // test name field too, because code might not be present
                        // everything except Firefox
                        err.name === "QuotaExceededError" ||
                        // Firefox
                        err.name === "NS_ERROR_DOM_QUOTA_REACHED")
                    ) {
                      setLocalStorageError('Local storage quota exceeded, app will continue to work as expected, but will not cache and remember playlists');
                    } else setLocalStorageError(JSON.stringify(err))
                  }
                } else setLocalStorageError('Local storage quota exceeded, app will continue to work as expected, but will not cache and remember playlists');
              } else setLocalStorageError(JSON.stringify(err))
            }
          }
          // TODO: recurse:
          // if (response.next) recursivelyGetPlaylists(response.next);
          // else {
          //   playlistsTracksUrls = playlists.map(({ tracks }) => tracks.href);
          //   console.log(playlistsTracksUrls);
          // }
          loadPlaylistTracks(index + 1);
        },
        error: function(response) {
          // TODO: handle other errors
          if (response.status === 429) {
            setTimeout(() => loadPlaylistTracks(index), rateLimitWindowSeconds*1000)
          } else {
            loadPlaylistTracks(index + 1);
          }
        }
      });
    }
  }, [accessToken, playlists])

  const getCachedPlaylistTracks = useCallback((index: number) => {
    if (index >= playlists.length) {
      loadPlaylistTracks(0);
      return;
    }

    const rememberedPlaylistSnapshots = JSON.parse(localStorage.getItem(localStorageKey(playlists[index].metadata.id)) || '{}');
    const rememberedPlaylistSnapshot = rememberedPlaylistSnapshots[playlists[index].metadata.snapshot_id]
    if (rememberedPlaylistSnapshot) {
      setPlaylists(playlists => {
        const newPlaylists = [...playlists];
        newPlaylists[index].data = {
          tracks: rememberedPlaylistSnapshot.tracks.items.map(({ track }: { track: { name: string, uri: string, artists: {}[] } }) => track).filter((track: {}) => !!track),
        };
        return newPlaylists;
      });
    }

    getCachedPlaylistTracks(index + 1);
  }, [playlists, loadPlaylistTracks])


  useEffect(() => {
    if (!loadingPlaylists && playlists.length > 0 && !playlists.some(({ data }) => !!data)) getCachedPlaylistTracks(0);
  }, [loadingPlaylists, playlists, getCachedPlaylistTracks])

  function recursivelyGetPlaylists(url = 'https://api.spotify.com/v1/me/playlists') {
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items) {
          setPlaylists(playlists => [...playlists, ...response.items.map((item: IPlaylist['metadata']) => { return { metadata: item }; })]);
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
    recursivelyGetPlaylists();
  }

  const playPlaylistTrack = useCallback((playlistUri: string | undefined, songUri: string, offsetPosition: number) => {
    const url = selectedDeviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${selectedDeviceId}` : 'https://api.spotify.com/v1/me/player/play'
    ajax({
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      url,
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
                    url,
                    type: 'PUT',
                    data: JSON.stringify({
                      context_uri: playlistUri,
                      offset: {
                        uri: songUri,
                      },
                      position_ms: 0,
                    }),
                    complete: function(response) {
                      // try yet again, because sometimes the offset: uri method
                      // can still fail to play even after loading, so we
                      // fall back again to the offset: position
                      if (response.status === 404) {
                        ajax({
                          headers: {
                            'Authorization': 'Bearer ' + accessToken
                          },
                          url,
                          type: 'PUT',
                          data: JSON.stringify({
                            context_uri: playlistUri,
                            offset: {
                              position: offsetPosition,
                            },
                            position_ms: 0,
                          })
                        })
                      } else {
                        setTimeout(() => {
                          ajax({
                            url: 'https://api.spotify.com/v1/me/player',
                            headers: {
                              'Authorization': 'Bearer ' + accessToken
                            },
                            complete: function(xhr) {
                              const response = JSON.parse(xhr.responseText)
                              if (!response?.is_playing) {
                                setTimeout(
                                  () => ajax({
                                    headers: {
                                      'Authorization': 'Bearer ' + accessToken
                                    },
                                    url,
                                    type: 'PUT',
                                    data: JSON.stringify({
                                      context_uri: playlistUri,
                                      offset: {
                                        position: offsetPosition,
                                      },
                                      position_ms: 0,
                                    })
                                  }),
                                  2000
                                )
                              }
                            }
                          })
                        }, 1000)
                      }
                    }
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

  function decodeHtml(input: string) {
    var doc = new DOMParser().parseFromString(input, "text/html");
    return doc.documentElement.textContent;
  }

  const restorePlaylist = useCallback((playlist: IRememberedPlaylist | IPlaylist) => {
    const { name, description, rememberedAt, tracks } = isRememberedPlaylist(playlist) ? playlist : { ...playlist.metadata, ...playlist.data, rememberedAt: new Date() }
    ajax({
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      url: `https://api.spotify.com/v1/users/${profileInfo?.id}/playlists`,
      type: 'POST',
      data: JSON.stringify({
        name,
        description: description ? `(copied on ${new Date(rememberedAt).toLocaleDateString(undefined, {dateStyle: 'short'})}) - ${decodeHtml(description)}` : `(copied on ${new Date().toLocaleDateString(undefined, {dateStyle: 'short'})})`,
        public: false,
        collaborative: false,
      }),
      success: function(response) {
        ajax({
          url: `https://api.spotify.com/v1/playlists/${response.id}/tracks`,
          headers: {
            'Authorization': 'Bearer ' + accessToken
          },
          type: 'POST',
          data: JSON.stringify({
            uris: tracks.map(({ uri }) => uri),
          }),
          success: function(response) {
            console.warn(response);
          }
        })
      },
    })
  }, [accessToken, profileInfo?.id])

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
              {loading ? 'Searching' : 'Searched'} {playlists.filter((playlist) => !!playlist.data).length} / {playlists.length} playlists
            </div>
            <Progress
              animated={loading}
              value={playlists.filter((playlist) => !!playlist.data).length}
              max={playlists.length}
              barStyle={{ backgroundColor: spotifyGreen }}
            />
            <div className="d-flex">
              <Label className="flex-shrink-0 pr-1">Playing on</Label>
              <Input className="flex-grow-1 mx-2" type="select" name="select" value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
                <option value=""></option>
                {devices.map(({ name, id }) => (
                  <option value={id}>{name}</option>
                ))}
              </Input>
              <Button onClick={loadDevices} className="flex-shrink-0">
                Refresh devices
              </Button>
            </div>
            {localStorageError && (
              <UncontrolledAlert color="danger">
                {localStorageError}
              </UncontrolledAlert>
            )}
            {genericAjaxError && (
              <UncontrolledAlert color="danger" toggle={() => setGenericAjaxError(undefined)}>
                {genericAjaxError}
              </UncontrolledAlert>
            )}
            <h3>Matching Playlists</h3>
            <div id="matching-playlists-links">
              {playlists.map((playlist, index) => (
                <Playlist
                  key={playlist.metadata.snapshot_id}
                  playlist={playlist}
                  profileId={profileInfo.id!}
                  searchTerm={(searchTerm || '').toLowerCase()}
                  playPlaylistTrack={(songUri: string, offsetPosition: number) => playPlaylistTrack(playlists[index].metadata.uri, songUri, offsetPosition)}
                  restorePlaylist={() => restorePlaylist(playlist)}
                />
              ))}
              {/* {matchingPlaylists.map(({ playlist, tracks }) => (
                <Playlist playlist={playlist} tracks={tracks} searchTerm={searchTerm} />
              ))} */}
            </div>
            <h3>
              Matching Remembered Playlists
              <Button onClick={() => setShowRememberedPlaylists(showRememberedPlaylists => !showRememberedPlaylists)} color='link' className="py-0 border-0 align-baseline">{showRememberedPlaylists ? 'Hide' : 'Show'}</Button>
            </h3>
            {showRememberedPlaylists && (
              <div>
                {rememberedSnapshots.filter(({ owner }) => owner?.id !== profileInfo.id).map((playlist, index) => (
                  <Playlist
                    key={playlist.snapshot_id}
                    playlist={playlist}
                    profileId={profileInfo.id!}
                    searchTerm={searchTerm}
                    playPlaylistTrack={() => {}}
                    restorePlaylist={() => restorePlaylist(playlist)}
                  />
                ))}
              </div>
            )}
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
