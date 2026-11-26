"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface DepthSceneCanvasProps {
  imageUrl: string;
  depthMapUrl: string;
  aspectRatio: number;
  depthStrength: number;
  autoParallax: boolean;
  wireframe: boolean;
  invertDepth: boolean;
  resetSignal: number;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

function loadTextureFromUrl(
  url: string,
  isColor: boolean
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = isColor
          ? THREE.SRGBColorSpace
          : THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

interface DisplacedPlaneProps {
  imageUrl: string;
  depthMapUrl: string;
  aspectRatio: number;
  depthStrength: number;
  autoParallax: boolean;
  wireframe: boolean;
  invertDepth: boolean;
}

function DisplacedPhotoPlane({
  imageUrl,
  depthMapUrl,
  aspectRatio,
  depthStrength,
  autoParallax,
  wireframe,
  invertDepth,
}: DisplacedPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [textures, setTextures] = React.useState<{
    color: THREE.Texture;
    depth: THREE.Texture;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedColor: THREE.Texture | null = null;
    let loadedDepth: THREE.Texture | null = null;

    Promise.all([
      loadTextureFromUrl(imageUrl, true),
      loadTextureFromUrl(depthMapUrl, false),
    ])
      .then(([colorTex, depthTex]) => {
        if (cancelled) {
          colorTex.dispose();
          depthTex.dispose();
          return;
        }
        loadedColor = colorTex;
        loadedDepth = depthTex;
        setTextures({ color: colorTex, depth: depthTex });
      })
      .catch(() => {
        // Ignore texture load error if unmounted
      });

    return () => {
      cancelled = true;
      if (loadedColor) loadedColor.dispose();
      if (loadedDepth) loadedDepth.dispose();
    };
  }, [imageUrl, depthMapUrl]);

  // Fit plane cleanly inside camera frustum while preserving original image aspect ratio
  const { width, height } = useMemo(() => {
    const safeRatio =
      Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
    const maxDimension = 3.4;
    if (safeRatio >= 1) {
      return { width: maxDimension, height: maxDimension / safeRatio };
    }
    return { width: maxDimension * safeRatio, height: maxDimension };
  }, [aspectRatio]);

  // Smooth gentle parallax sway when Auto-Parallax is active
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    if (autoParallax) {
      const t = state.clock.elapsedTime;
      const targetRotY = Math.sin(t * 0.75) * 0.24;
      const targetRotX = Math.cos(t * 0.55) * 0.1;
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        targetRotY,
        Math.min(1, delta * 4)
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        targetRotX,
        Math.min(1, delta * 4)
      );
    } else {
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        0,
        Math.min(1, delta * 6)
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        0,
        Math.min(1, delta * 6)
      );
    }
  });

  if (!textures) return null;

  const signedScale = invertDepth ? -depthStrength : depthStrength;

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[width, height, 160, 160]} />
      <meshStandardMaterial
        map={textures.color}
        displacementMap={textures.depth}
        displacementScale={signedScale}
        displacementBias={-signedScale * 0.45}
        roughness={0.7}
        metalness={0.05}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  );
}

interface OrbitControllerProps {
  resetSignal: number;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

function SceneOrbitControls({
  resetSignal,
  onCanvasReady,
}: OrbitControllerProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (onCanvasReady) {
      onCanvasReady(gl.domElement);
    }
    return () => {
      if (onCanvasReady) onCanvasReady(null);
    };
  }, [gl, onCanvasReady]);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 1.6;
    controls.maxDistance = 9.5;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minPolarAngle = Math.PI * 0.12;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    if (resetSignal === 0) return;
    camera.position.set(0, 0, 4.4);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [resetSignal, camera]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

export default function DepthSceneCanvas({
  imageUrl,
  depthMapUrl,
  aspectRatio,
  depthStrength,
  autoParallax,
  wireframe,
  invertDepth,
  resetSignal,
  onCanvasReady,
}: DepthSceneCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.4], fov: 42, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
    >
      <color attach="background" args={["#060913"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <directionalLight position={[-3, -2, 3]} intensity={0.45} />

      <DisplacedPhotoPlane
        imageUrl={imageUrl}
        depthMapUrl={depthMapUrl}
        aspectRatio={aspectRatio}
        depthStrength={depthStrength}
        autoParallax={autoParallax}
        wireframe={wireframe}
        invertDepth={invertDepth}
      />

      <SceneOrbitControls
        resetSignal={resetSignal}
        onCanvasReady={onCanvasReady}
      />
    </Canvas>
  );
}
