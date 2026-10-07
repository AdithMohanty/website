"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        alt?: string;
        ar?: boolean;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "auto-rotate-delay"?: string;
        "rotation-per-second"?: string;
        "shadow-intensity"?: string;
        exposure?: string;
        "environment-image"?: string;
        "camera-orbit"?: string;
        "interaction-prompt"?: string;
      };
    }
  }
}

// Wraps a project's thumbnail so clicking it opens the 3D model in a dialog.
// Straight-on front view, like looking at the wall.
const CAMERA_ORBIT = "0deg 85deg 1m";

type ModelViewerElement = HTMLElement & {
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  updateComplete: Promise<boolean>;
  jumpCameraToGoal(): void;
  resetTurntableRotation(theta?: number): void;
};

// model-viewer (and three.js under it) only loads on the first open.
export default function ModelViewer({
  src,
  title,
  children,
}: {
  src: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewerRef = useRef<ModelViewerElement>(null);
  const [loaded, setLoaded] = useState(false);
  // The model itself (and the Draco decoder) can take a few seconds.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mv = viewerRef.current;
    if (!mv) return;
    const onLoad = () => setReady(true);
    mv.addEventListener("load", onLoad);
    return () => mv.removeEventListener("load", onLoad);
  }, [loaded]);

  async function open() {
    dialogRef.current?.showModal();
    // Reopening starts from the default, centered view rather than wherever
    // the camera was left.
    const mv = viewerRef.current;
    if (mv) {
      mv.cameraOrbit = CAMERA_ORBIT;
      mv.cameraTarget = "auto auto auto";
      mv.fieldOfView = "auto";
      // Jumping before the element applies the new values leaves the camera
      // in a broken spot.
      await mv.updateComplete;
      mv.jumpCameraToGoal();
      // Idle spinning turns the model itself, so undo that too.
      mv.resetTurntableRotation(0);
    }
    if (!loaded) {
      await import("@google/model-viewer");
      setLoaded(true);
    }
  }

  return (
    <>
      <button type="button" className="entry-media-button" onClick={open} aria-label={`View ${title} in 3D`}>
        {children}
        <span className="entry-media-badge">3D</span>
      </button>
      <dialog
        ref={dialogRef}
        className="model-dialog"
        role="dialog"
        aria-label={`${title} 3D model`}
        // Clicks on the backdrop land on the dialog itself.
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      >
        <div className="model-dialog-head">
          <span className="model-dialog-title">{title}</span>
          <span className="model-dialog-hint">Drag to rotate · scroll to zoom</span>
          <button type="button" className="model-dialog-close" onClick={() => dialogRef.current?.close()} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {loaded && (
          <model-viewer
            ref={viewerRef}
            src={src}
            alt={`3D model of ${title}`}
            camera-controls
            // Spins slowly while idle; pauses while someone drags and picks
            // back up after a couple of seconds.
            auto-rotate
            auto-rotate-delay="2000"
            rotation-per-second="15deg"
            ar
            camera-orbit={CAMERA_ORBIT}
            shadow-intensity="0.6"
            exposure="1.1"
            environment-image="neutral"
            interaction-prompt="none"
          />
        )}
        {!ready && <div className="model-dialog-loading">Loading model…</div>}
      </dialog>
    </>
  );
}
