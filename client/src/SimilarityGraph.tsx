import { useEffect, useState } from 'react';
import { Graph } from 'react-d3-graph';
import { IPlaylist } from './Playlist';
import { IAudioFeatures } from './App';

const SimilarityGraph: React.FC<{ playlists: IPlaylist[], tracksFeatures: { [trackId: string]: IAudioFeatures } }> = ({ playlists, tracksFeatures }) => {
  const [data, setData] = useState<{ nodes: { id: string }[], links: { source: string, target: string, distance: number }[] }>({ nodes: [], links: [] });

  // Calculate average feature vector for a playlist
  const calculateAverageFeatures = (playlist: IPlaylist): IAudioFeatures => {
    // Aggregate features
    let featureSums: IAudioFeatures = {
      acousticness: 0,
      danceability: 0,
      energy: 0,
      instrumentalness: 0,
      liveness: 0,
      loudness: 0,
      speechiness: 0,
      tempo: 0,
      happiness: 0,
      majorness: 0,
    };
    for (let track of playlist.data.tracks) {
      if (!playlist.data?.tracks) continue;

      let features = tracksFeatures[track.id];
      for (let key in features) {
        featureSums[key as keyof IAudioFeatures] += features[key as keyof IAudioFeatures];
      }
    }
    // Average features
    for (let key in featureSums) {
      featureSums[key as keyof IAudioFeatures] /= playlist.data.tracks.length;
    }
    return featureSums;
  };

  // Calculate Euclidean distance between two feature vectors
  const calculateDistance = (features1: IAudioFeatures, features2: IAudioFeatures): number => {
    let sum = 0;
    for (let key in features1) {
      let diff = features1[key as keyof IAudioFeatures] - features2[key as keyof IAudioFeatures];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  useEffect(() => {
    let nodes = playlists.map(playlist => ({ id: playlist.metadata.name }));
    let links: { source: string, target: string, distance: number }[] = [];
    for (let i = 0; i < playlists.length; i++) {
      for (let j = i + 1; j < playlists.length; j++) {
        let distance = calculateDistance(calculateAverageFeatures(playlists[i]), calculateAverageFeatures(playlists[j]));
        links.push({ source: playlists[i].metadata.name, target: playlists[j].metadata.name, distance });
      }
    }
    setData({ nodes, links });
  }, [playlists, tracksFeatures]);

  const myConfig = {
    nodeHighlightBehavior: true,
    linkHighlightBehavior: true,
    highlightDegree: 1,
    highlightOpacity: 0.2,
    node: {
      color: "lightgreen",
      size: 120,
      highlightStrokeColor: "blue",
    },
    link: {
      highlightColor: "lightblue",
    },
  };

  return (
    <Graph
      id="graph-id" // id is mandatory
      data={data}
      config={myConfig}
    />
  );
};

export default SimilarityGraph