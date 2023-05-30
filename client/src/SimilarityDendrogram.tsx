import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { hierarchy, tree } from 'd3';
import { IAudioFeatures } from './App';
import { IPlaylist } from './Playlist';

interface IProps {
  playlists: IPlaylist[];
  tracksFeatures: { [trackId: string]: IAudioFeatures };
}

export const PlaylistsDendrogram: React.FC<IProps> = ({ playlists, tracksFeatures }) => {
  const ref = useRef(null);

  useEffect(() => {
    const avgFeatures = playlists.map(playlist => {
      const features = playlist.data.tracks.map(track => tracksFeatures[track.id]);
      const avg = Object.keys(features[0]).reduce((acc, key) => ({
        ...acc,
        [key]: features.reduce((total, feat) => total + feat[key], 0) / features.length,
      }), {});
      return { name: playlist.metadata.name, features: avg };
    });

    const similarityMatrix = avgFeatures.map((a, i) => avgFeatures.map((b, j) => {
      if (i === j) return 1;
      const dotProduct = Object.keys(a.features).reduce((total, key) => total + a.features[key] * b.features[key], 0);
      const magnitudeA = Math.sqrt(Object.values(a.features).reduce((total, val) => total + val * val, 0));
      const magnitudeB = Math.sqrt(Object.values(b.features).reduce((total, val) => total + val * val, 0));
      return dotProduct / (magnitudeA * magnitudeB);
    }));

    const clusters = d3.cluster().size([height, width])(d3.hierarchy(similarityMatrix));
    const svg = d3.select(ref.current);
    // ... render the dendrogram using D3.js
  }, [playlists, tracksFeatures]);

  return <svg ref={ref} />;
};
