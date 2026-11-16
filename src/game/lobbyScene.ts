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
  envMap: THREE.Texture,
): LobbySceneHandle {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / window.innerHeight,
    0.1,
    40,
  );
  // Centered so the 3D character stands right on top of the dirt trail in the nostalgic lobby artwork
  camera.position.set(0, 1.38, 3.65);

  // Warm late-afternoon Bermuda beach sunlight matching the backdrop sky & dirt road
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x7e5f44, 1.05);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff3de, 1.85);
  keyLight.position.set(2.8, 4.6, 3.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 14;
  keyLight.shadow.camera.left = -2.8;
  keyLight.shadow.camera.right = 2.8;
  keyLight.shadow.camera.top = 2.8;
  keyLight.shadow.camera.bottom = -2.8;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xffb56b, 2.2, 10);
  rimLight.position.set(-2.2, 2.1, -1.8);
  scene.add(rimLight);

  // Transparent shadow-catcher ground plane so character casts a real shadow onto the background dirt road
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.42 });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Character anchor centered on the dirt trail
  const characterAnchor = new THREE.Group();
  characterAnchor.position.set(0, -0.02, 0);
  scene.add(characterAnchor);

  const dispose = () => {
    shadowPlane.geometry.dispose();
    shadowMat.dispose();
  };

  return { scene, camera, characterAnchor, dispose };
}
