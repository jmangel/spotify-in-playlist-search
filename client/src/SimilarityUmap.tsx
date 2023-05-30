import React, { useEffect, useState } from "react";
import Plot from 'react-plotly.js';
import * as umap from "umap-js";
import { IPlaylist } from "./Playlist";
import { IAudioFeatures } from "./App";

interface SimilarityUmapProps {
  playlists: IPlaylist[];
  tracksFeatures: { [trackId: string]: IAudioFeatures };
}

const SimilarityUmap: React.FC<SimilarityUmapProps> = ({ playlists, tracksFeatures }) => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Calculate the average features for each playlist
    const playlistFeatures: { [playlistId: string]: IAudioFeatures } = {};
    for (const playlist of playlists) {
      if (!playlist.data?.tracks) continue;

      const features: IAudioFeatures[] = [];
      for (const track of playlist.data.tracks) {
        features.push(tracksFeatures[track.id]);
      }
      playlistFeatures[playlist.metadata.id] = calculateAverageFeatures(features);
    }

    // Run UMAP
    const umapInstance = new umap.UMAP();
    const playlistFeatureVectors = Object.values(playlistFeatures).map((feature) => Object.values(feature));
    const embedding = umapInstance.fit(playlistFeatureVectors);

    // Create plot data
    const plotData = {
      x: embedding.map((value) => value[0]),
      y: embedding.map((value) => value[1]),
      mode: 'markers',
      type: 'scatter',
      text: Object.keys(playlistFeatures),
    };

    setData([plotData]);
  }, [playlists, tracksFeatures]);

  return <Plot data={data} layout={{ width: 500, height: 500, title: 'UMAP Visualization' }} />;
};

export default SimilarityUmap;

// Helper function to calculate the average features of an array of tracks
function calculateAverageFeatures(features: IAudioFeatures[]): IAudioFeatures {
  const totalFeatures = features.reduce(
    (total, current) => {
      for (const key in current) {
        const featureKey = key as keyof IAudioFeatures;
        total[featureKey] += current[featureKey];
      }
      return total;
    },
    {
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
    }
  );

  const averageFeatures = {} as IAudioFeatures;
  for (const key in totalFeatures) {
    const featureKey = key as keyof IAudioFeatures;
    averageFeatures[featureKey] = totalFeatures[featureKey] / features.length;
  }

  return averageFeatures as IAudioFeatures;
}