import type { Metadata } from "next";
import Nav from "../Nav";
import GalleryGrid from "./GalleryGrid";
import { getPhotos } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  alternates: { canonical: "/gallery" },
};

// Uploads refresh the page right away; this is just a fallback.
export const revalidate = 300;

export default async function GalleryPage() {
  const photos = await getPhotos();

  return (
    <>
      <Nav />
      <main className="page-body page-body--top">
        <h1 className="page-title">Gallery</h1>
        <div className="rule" />

        {photos.length === 0 ? (
          <p className="empty-note">No photos yet.</p>
        ) : (
          <GalleryGrid photos={photos} />
        )}
      </main>
    </>
  );
}
