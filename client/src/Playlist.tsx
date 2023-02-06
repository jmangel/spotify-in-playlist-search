import { useEffect, useState } from "react";
import { Button, Table } from 'reactstrap';

export interface IPlaylist {
  metadata: {
    name: string,
    uri: string,
    external_urls: { spotify: string },
    tracks: { href: string },
  },
  data: {
    tracks: {
      name: string,
      uri: string,
      artists: {
        name: string
      }[],
      album: {
        name: string
      },
    }[]
  }
}

function Playlist(
  {
    playlist,
    searchTerm,
    playPlaylistTrack,
  } : {
    playlist?: IPlaylist,
    searchTerm: string,
    playPlaylistTrack: (songUri: string, offsetPosition: number) => void,
  }
) {
  const [expanded, setExpanded] = useState(false);
  const [hasMatch, setHasMatch] = useState(false);

  useEffect(() => {
    setHasMatch((playlist?.data?.tracks || []).some(({name, artists, album}) => (`${name} ${artists.map(({name}) => name).join(' ')} ${album.name}`.toLowerCase().includes((searchTerm || '').toLowerCase()))))
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
                <th></th>
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
              {(playlist?.data?.tracks || []).map(({ name, uri, album, artists }, index) => (
                <tr>
                  <td><Button onClick={() => playPlaylistTrack(uri, index)} color="primary">
                    Play
                  </Button></td>
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
              ))}
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