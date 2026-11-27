import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface LobbySceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  characterAnchor: THREE.Group;
  dispose: () => void;
}

export function createLobbyScene(
  _textures: ProceduralTextureSet,
  _envMap?: THREE.Texture | null,
): LobbySceneHandle {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / window.innerHeight,
    0.1,
    40,
  );
  // Centered so the 3D character stands right on top of the dirt trail in the nostalgic lobby artwork
  camera.position.set(0, 1.38, 3.65);

  // Classic vibrant FF 2017 bright hemisphere + warm sunlight
  const hemi = new THREE.HemisphereLight(0xbce8ff, 0x9ab858, 1.45);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1c4, 1.85);
  keyLight.position.set(2.8, 4.6, 3.4);
  keyLight.castShadow = false;
  scene.add(keyLight);

  // Character anchor centered on the dirt trail
  const characterAnchor = new THREE.Group();
  characterAnchor.position.set(0, -0.02, 0);
  scene.add(characterAnchor);

  const dispose = () => {};

  return { scene, camera, characterAnchor, dispose };
}
