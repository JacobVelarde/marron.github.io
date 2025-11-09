// 1. IMPORTAR LAS LIBRERÍAS

import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ¡Importamos ARButton aquí en el JS!

import { ARButton } from 'three/addons/webxr/ARButton.js';



// 2. VARIABLES GLOBALES

let camera, scene, renderer, model;

let mixer;

const clock = new THREE.Clock();

let reticle;

let hitTestSource = null;

let hitTestSourceRequested = false;

let controller;



// 3. INICIAR TODO

init();



// --- FUNCIONES ---



function init() {

scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);



const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);

directionalLight.position.set(1, 1, 1);

scene.add(directionalLight);



renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(window.devicePixelRatio);

renderer.xr.enabled = true; // Habilitamos WebXR (para Android)

document.body.appendChild(renderer.domElement);



// Obtenemos el parámetro de la URL

const params = new URLSearchParams(window.location.search);

const animacion = params.get('anim');



// Definimos las rutas de los modelos

let modeloGlb = '';

let modeloUsdz = ''; // <-- ¡NUEVO! Necesitamos la ruta al .usdz



if (animacion === 'reno') {

modeloGlb = './src/monk_character.glb';

modeloUsdz = './src/pc.usdz'; // <-- ¡DEBES TENER ESTE ARCHIVO!

} else if (animacion === 'arbol') {

// ... define tus otras rutas glb y usdz

} else {

// ... modelo de error

}



if (isIOS()) {

// --- LÓGICA DE iOS (AR Quick Look) ---

// No necesitamos Three.js para la RA, solo para el visor 2D.


// Mostramos el modelo en 2D (igual que antes)

cargarVisor2D(modeloGlb);


// Obtenemos los elementos HTML de iOS

const arLink = document.getElementById('ar-link-ios');

const arButton = document.getElementById('ar-button-ios');


// Creamos una imagen de póster (miniatura) para Quick Look

// (Opcional pero recomendado)

// arLink.appendChild(document.createElement('img'));


// Configuramos el enlace invisible

arLink.setAttribute('href', modeloUsdz);

arButton.style.display = 'block'; // Mostramos nuestro botón de iOS



} else {

// --- LÓGICA DE ANDROID (WebXR) ---

// (Este es el código V4 que ya tenías)


// Mostramos el modelo en 2D

cargarVisor2D(modeloGlb);



// Añadimos el botón de WebXR

document.body.appendChild(ARButton.createButton(renderer, {

requiredFeatures: ['hit-test']

}));


// Configuramos los controladores de WebXR

controller = renderer.xr.getController(0);

controller.addEventListener('selectstart', onSelectStart);

controller.addEventListener('selectend', onSelectEnd);

controller.addEventListener('select', onSelect);

scene.add(controller);


// Creamos la retícula (anillo)

const reticleGeometry = new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2);

const reticleMaterial = new THREE.MeshBasicMaterial();

reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);

reticle.matrixAutoUpdate = false;

reticle.visible = false;

scene.add(reticle);

}


// --- FIN: LÓGICA DE DETECCIÓN ---



renderer.setAnimationLoop(animate);

window.addEventListener('resize', onWindowResize);

}





// --- INICIO: LÓGICA DE DETECCIÓN DE iOS ---



// Función para detectar si es iOS

function isIOS() {

return [

'iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'

].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);

}



// --- NUEVA FUNCIÓN: Cargar Visor 2D ---

// Separamos la lógica de carga para poder reusarla

function cargarVisor2D(rutaGlb) {

const loader = new GLTFLoader();

loader.load(rutaGlb, (gltf) => {

model = gltf.scene;

if (gltf.animations && gltf.animations.length) {

mixer = new THREE.AnimationMixer(model);

const action = mixer.clipAction(gltf.animations[0]);

action.play();

}

// En el V5, el modelo SÍ es visible al inicio (para el visor 2D)

model.visible = true;

model.scale.set(0.5, 0.5, 0.5); // Ajusta la escala para el visor 2D

model.position.set(0, 0, -1); // Ponlo frente a la cámara 2D

scene.add(model);

}, undefined, (error) => {

console.error('Error al cargar el modelo:', error);

});

}



// --- FUNCIONES DE ANDROID / WEBXR ---

// (Estas son las funciones V4 que ya tenías)

// (onWindowResize, onSelectStart, onSelectEnd, onSelect, animate)



function onWindowResize() {

camera.aspect = window.innerWidth / window.innerHeight;

camera.updateProjectionMatrix();

renderer.setSize(window.innerWidth, window.innerHeight);

}



let isDragging = false;

let lastDragX = 0;

const ROTATION_SPEED = 3;



function onSelectStart() {

isDragging = true;

if (controller.inputSource && controller.inputSource.gamepad) {

lastDragX = controller.inputSource.gamepad.axes[0];

}

}



function onSelectEnd() {

isDragging = false;

}



function onSelect() {

// Solo necesitamos verificar si la retícula está visible y si el modelo cargó

if (reticle.visible && model) {


// ...copia la posición de la retícula al modelo

// (Esto funciona para colocarlo la primera vez O para moverlo)

model.position.setFromMatrixPosition(reticle.matrix);


// ...¡y haz el modelo visible!

// (Si ya era visible, no pasa nada)

model.visible = true;


// ¡YA NO APAGAMOS EL HIT-TEST!

// Dejamos que la retícula siga activa para poder re-colocar.

}

}



function animate(timestamp, frame) {

const delta = clock.getDelta();

if (mixer) mixer.update(delta);



// Lógica de rotación (solo si estamos en RA en Android)

if (renderer.xr.isPresenting && isDragging && model && controller.inputSource && controller.inputSource.gamepad) {

const currentDragX = controller.inputSource.gamepad.axes[0];

const deltaX = (currentDragX - lastDragX) * ROTATION_SPEED;

model.rotation.y -= deltaX;

lastDragX = currentDragX;

}


// Rotación suave en el visor 2D (antes de entrar en RA)

if (model && !renderer.xr.isPresenting && !isIOS()) {

model.rotation.y += 0.005;

}



// Lógica de Hit-Test (solo si estamos en RA en Android)

if (frame && !isIOS()) {

const referenceSpace = renderer.xr.getReferenceSpace();

const session = renderer.xr.getSession();



if (hitTestSourceRequested === false) {

session.requestReferenceSpace('viewer').then((viewerSpace) => {

session.requestHitTestSource({ space: viewerSpace }).then((source) => {

hitTestSource = source;

});

});

hitTestSourceRequested = true;

}



if (hitTestSource) {

const hitTestResults = frame.getHitTestResults(hitTestSource);

if (hitTestResults.length > 0) {

const hit = hitTestResults[0];

const hitPose = hit.getPose(referenceSpace);

reticle.visible = true;

reticle.matrix.fromArray(hitPose.transform.matrix);

} else {

reticle.visible = false;

}

}

}



renderer.render(scene, camera);

}