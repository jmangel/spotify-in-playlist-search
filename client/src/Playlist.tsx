import { Fragment, useCallback, useEffect, useState } from "react";
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
  id: string,
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
    description: string,
    owner: { id: string },
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

export const isRememberedPlaylist = (object: IRememberedPlaylist| IPlaylist): object is IRememberedPlaylist => {
  return 'rememberedAt' in object;
}

function Playlist(
  {
    playlist,
    searchTerm,
    profileId,
    playPlaylistTrack,
    restorePlaylist,
  } : {
    playlist: IPlaylist | IRememberedPlaylist,
    searchTerm: string,
    profileId: string,
    playPlaylistTrack: (songUri: string, offsetPosition: number) => void,
    restorePlaylist?: () => void,
  }
) {
  const [expanded, setExpanded] = useState(false);
  const [showNonmatchingSongs, setShowNonmatchingSongs] = useState(false);
  const [firstMatch, setFirstMatch] = useState<ITrack | undefined>(undefined);

  const trackMatches = useCallback(
    (track: ITrack) =>
      !!track &&
      `${track.name} ${track.artists.map(({ name }) => name).join(' ')} ${track.album.name}`
        .toLowerCase()
        .includes((searchTerm || '').toLowerCase()),
    [searchTerm]);

  // const trackMatches = useMemo(() => {
  //   return (track: ITrack) =>
  //     !!track &&
  //     `${track.name} ${track.artists
  //       .map(({ name }) => name)
  //       .join(' ')} ${track.album.name}`
  //       .toLowerCase()
  //       .includes((searchTerm || '').toLowerCase());
  // }, [searchTerm]);

  const tracks = isRememberedPlaylist(playlist) ? playlist.tracks : playlist?.data?.tracks;

  useEffect(() => {
    setFirstMatch(((tracks) || []).find((track) => trackMatches(track)))
  }, [playlist, tracks, trackMatches]);

  const ownerId = isRememberedPlaylist(playlist) ? playlist.owner?.id : playlist.metadata.owner.id;

  return firstMatch ? (
    <div>
      <Button onClick={restorePlaylist} color="primary" className="py-0 px-2 me-1">
        Save copy
      </Button>
      {isRememberedPlaylist(playlist) ? (
        <>
          <small className="me-1"><small><i>(remembered at {new Date(playlist.rememberedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })})</i></small></small>
          {
            playlist.id ? (
              <a target="_blank" href={`https://open.spotify.com/playlist/${playlist.id}`} rel="noreferrer"><strong>{playlist.name}</strong></a>
              ) : (
              <strong>{playlist.name}</strong>
            )
          }
        </>
        ) : (
        <a target="_blank" href={playlist?.metadata?.external_urls?.spotify} rel="noreferrer"><strong>{playlist?.metadata?.name}</strong></a>
      )}
      {
        ownerId && (
          <small><i> (<a target="_blank" rel="noreferrer" href={`https://open.spotify.com/user/${ownerId}`}>{(ownerId === profileId) ? 'me' : ownerId}</a>)</i></small>
        )
      }
      :
      <Button onClick={() => setExpanded(expanded => !expanded)} color='link' className="py-0 px-1 border-0 align-baseline">{expanded ? 'Hide' : 'Show'} additional matching songs</Button>
      {expanded ? (
        <div className="ml-1">
          <Button onClick={() => setShowNonmatchingSongs(showNonmatchingSongs => !showNonmatchingSongs)} color='link' className="py-0 px-1 border-0 align-baseline">{showNonmatchingSongs ? 'Hide' : 'Show'} non-matching songs</Button>
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
                return (showNonmatchingSongs || trackMatches(track)) ? (
                  <tr key={uri}>
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
                  <Fragment key={`fragment-${uri}`}></Fragment>
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