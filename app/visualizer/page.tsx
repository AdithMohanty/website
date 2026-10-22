import type { Metadata } from "next";
import Visualizer from "./Visualizer";

export const metadata: Metadata = {
  title: "Visualizer",
  description: "A liquid visualizer that moves with whatever I'm playing on Spotify.",
  alternates: { canonical: "/visualizer" },
};

export default function VisualizerPage() {
  return <Visualizer />;
}
