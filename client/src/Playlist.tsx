import { useEffect, useState } from "react";
import { Button, Table } from 'reactstrap';

export interface IPlaylist {
  metadata: {
    name: string,
    external_urls: { spotify: string },
    tracks: { href: string },
  },
  data: {
    tracks: {
      name: string,
      artists: {
        name: string
      }[],
      album: {
        name: string
      }
    }[]
  }
}

function trackMatches(track: IPlaylist['data']['tracks'][number], searchTerm: string) {
  return `${track.name} ${track.artists.map(({name}) => name).join(' ')} ${track.album.name}`.toLowerCase().includes((searchTerm || '').toLowerCase());
}

function Playlist(
  {
    playlist,
    searchTerm,
  } : {
    playlist?: IPlaylist,
    searchTerm: string,
  }
) {
  const [expanded, setExpanded] = useState(false);
  const [hasMatch, setHasMatch] = useState(false);

  useEffect(() => {
    setHasMatch((playlist?.data?.tracks || []).some((track) => trackMatches(track, searchTerm)))
  }, [playlist?.data?.tracks, searchTerm]);

  return hasMatch ? (
    <div>
      <a target="_blank" href={playlist?.metadata?.external_urls?.spotify} rel="noreferrer">{playlist?.metadata?.name}:</a>
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
              {(playlist?.data?.tracks || []).map((track, index) => {
                const { name, album, artists } = track;
                return trackMatches(track, searchTerm) ? (
                  <tr>
                    <td>
                      {index + 1}
                    </td>
                    <td>
                      {name}
                    </td>
                    <td>
                      {artists.map(({name}) => name).join(', ')}
                    </td>
                    <td>
                      {album.name}
                    </td>
                  </tr>
                ) : (
                  <></>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : (
        <span>
          {playlist?.data?.tracks && playlist.data.tracks[0] && (
            <span>{playlist.data.tracks[0].name} - {playlist.data.tracks[0].artists.map(({name}) => name).join(', ')} - {playlist.data.tracks[0].album.name}</span>
          )}
        </span>
      )}
    </div>
  ) : (
    <></>
  )
}

export default Playlist;