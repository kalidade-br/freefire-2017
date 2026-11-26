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
  scene.environment = null;

  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / window.innerHeight,
    0.1,
    40,
  );
  // Centered so the 3D character stands right on top of the dirt trail in the nostalgic lobby artwork
  camera.position.set(0, 1.38, 3.65);

  // Bright Free Fire 2017 mobile daylight lighting (zero shadow maps, zero PBR env)
  const hemi = new THREE.HemisphereLight(0xcbeaff, 0xb89668, 1.45);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.75);
  keyLight.position.set(2.8, 4.6, 3.4);
  keyLight.castShadow = false;
  scene.add(keyLight);

  // Character anchor centered on the dirt trail (carries its own Blob Shadow)
  const characterAnchor = new THREE.Group();
  characterAnchor.position.set(0, -0.02, 0);
  scene.add(characterAnchor);

  const dispose = () => {
    // No extra shadow plane resources to dispose
  };

  return { scene, camera, characterAnchor, dispose };
}
