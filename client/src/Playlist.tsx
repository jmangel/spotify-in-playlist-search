import { useEffect, useState } from "react";
import { Button, Table } from 'reactstrap';

export interface ITrack {
  name: string,
  uri: string,
  artists: {
    name: string
  }[],
  album: {
    name: string
  }
}

export interface IRememberedPlaylist {
  name: string,
  description: string,
  snapshot_id: string,
  rememberedAt: Date,
  owner: { id: string },
  tracks: ITrack[]
}

export interface IPlaylist {
  metadata: {
    name: string,
    id: string,
    uri: string,
    snapshot_id: string,
    external_urls: { spotify: string },
    tracks: { href: string },
  },
  data: {
    tracks: ITrack[]
  }
}

let isRememberedPlaylist = (object: IRememberedPlaylist| IPlaylist): object is IRememberedPlaylist => {
  return 'rememberedAt' in object;
}

function trackMatches(track: ITrack, searchTerm: string) {
  return `${track.name} ${track.artists.map(({name}) => name).join(' ')} ${track.album.name}`.toLowerCase().includes((searchTerm || '').toLowerCase());
}

function Playlist(
  {
    playlist,
    searchTerm,
    playPlaylistTrack,
    restorePlaylist,
  } : {
    playlist: IPlaylist | IRememberedPlaylist,
    searchTerm: string,
    playPlaylistTrack: (songUri: string, offsetPosition: number) => void,
    restorePlaylist?: () => void,
  }
) {
  const [expanded, setExpanded] = useState(false);
  const [firstMatch, setFirstMatch] = useState<ITrack | undefined>(undefined);

  useEffect(() => {
    setFirstMatch(((isRememberedPlaylist(playlist) ? playlist.tracks : playlist?.data?.tracks) || []).find((track) => trackMatches(track, searchTerm)))
  }, [playlist, searchTerm]);

  return firstMatch ? (
    <div>
      {isRememberedPlaylist(playlist) ? (
        <span>{playlist.name} (remembered at {new Date(playlist.rememberedAt).toLocaleString()}):</span>
        ) : (
        <a target="_blank" href={playlist?.metadata?.external_urls?.spotify} rel="noreferrer">{playlist?.metadata?.name}:</a>
      )}
      {
        isRememberedPlaylist(playlist) && (
          <Button onClick={restorePlaylist} color="primary">
            Restore
          </Button>
        )
      }
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
              {((isRememberedPlaylist(playlist) ? playlist.tracks : playlist?.data?.tracks) || []).map((track, index) => {
                const { name, uri, album, artists } = track;
                return trackMatches(track, searchTerm) ? (
                  <tr>
                    <td>
                      {!isRememberedPlaylist(playlist) && (
                        <Button onClick={() => playPlaylistTrack(uri, index)} color="primary">
                          Play
                        </Button>
                      )}
                    </td>
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
          {firstMatch && (
            <span>{firstMatch.name} - {firstMatch.artists.map(({name}) => name).join(', ')} - {firstMatch.album.name}</span>
          )}
        </span>
      )}
    </div>
  ) : (
    <></>
  )
}

export default Playlist;