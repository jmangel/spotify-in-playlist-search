import { access } from "fs";
import { ajax } from "jquery";
import { useCallback, useEffect, useState } from "react";
import { Button, Table } from 'reactstrap';
import { setTokenSourceMapRange } from "typescript";

function Playlist(
  {
    // playlist,
    href,
    accessToken,
    searchTerm,
    rateLimitWindowSeconds,
  } : {
    // playlist?: { url: string, name: string },
    href: string,
    accessToken: string,
    searchTerm: string,
    rateLimitWindowSeconds: number,
    // tracks?: { name: string, album: string, artists: string[], trackIndexInPlaylist: number }[]
  }
) {
  const [expanded, setExpanded] = useState(false);
  const [tracks, setTracks] = useState<{ name: string, artists: string[], album: string, trackIndexInPlaylist: number }[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const getTracks = useCallback(() => {
    const url = `${href}?fields=items(track(name,artists(name),album(name)))`;
    ajax({
      url,
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      success: function(response) {
        if (response.items && response.items[0]) {
          setTracks(response.items.map(({ track }: { track: { name: string, artists: {}[] } }) => track).filter((track: {}) => !!track));
          setUrl(response.external_urls.spotify);
          setName(response.name);
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
          setTimeout(() => getTracks(), rateLimitWindowSeconds*1000)
        } else {
          // getTracks(index + 1);
        }
      }
    });
  }, [href, accessToken, rateLimitWindowSeconds]);

  useEffect(() => {
    if (tracks.length === 0 && !!href && !!accessToken) getTracks();
  }, [href, accessToken, tracks, getTracks])

  return (
    <div>
      <a target="_blank" href={url} rel="noreferrer">{name}:</a>
      <Button onClick={() => setExpanded(expanded => !expanded)} color='link' className="py-0 border-0 align-baseline">See {expanded ? 'less' : 'more'} song results</Button>
      {expanded ? (
        <div className="ml-1">
          <Table>
            <thead>
              <tr>
                <th>
                  Track # in Playlist
                </th>
                <th>
                  Song
                </th>
                <th>
                  Artists
                </th>
                <th>
                  Album
                </th>
              </tr>
            </thead>
            <tbody>
              {(tracks || []).map(({ name, album, artists, trackIndexInPlaylist }) => (
                <tr>
                  <td>
                    {trackIndexInPlaylist + 1}
                  </td>
                  <td>
                    {name}
                  </td>
                  <td>
                    {artists.join(', ')}
                  </td>
                  <td>
                    {album}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <span>
          {tracks && tracks[0] && (
            <span>{tracks[0].name} - {tracks[0].artists.join(', ')} - {tracks[0].album}</span>
          )}
        </span>
      )}
    </div>
  )
}

export default Playlist;