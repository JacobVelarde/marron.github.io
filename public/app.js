import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

// 2. VARIABLES GLOBALES
let camera, scene, renderer, model;
let mixer;
const clock = new THREE.Clock();

// --- NUEVAS VARIABLES GLOBALES ---
let reticle; // El anillo que muestra dónde está el suelo
let hitTestSource = null; // La fuente de "rayos" para el Hit Test
let hitTestSourceRequested = false;
// --- FIN DE NUEVAS VARIABLES ---

// 3. INICIAR TODO
init();

// --- FUNCIONES PRINCIPALES ---

function init() {
  // A. CREAR LA ESCENA
  scene = new THREE.Scene();

  // B. CREAR LA CÁMARA
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // C. AÑADIR LUCES
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // D. CREAR EL RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    session.addEventListener('select', onSelect);
  });

  // E. AÑADIR EL BOTÓN DE AR
  // --- MODIFICADO ---
  // Ahora le pedimos al navegador que active la función 'hit-test'
  document.body.appendChild(ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'] // <-- ¡ESTA LÍNEA ES NUEVA!
  }));
  // --- FIN DE MODIFICACIÓN ---

  // F. CARGAR EL MODELO 3D
  const params = new URLSearchParams(window.location.search);
  const animacion = params.get('anim');
  let modeloSrc = '';

  if (animacion === 'reno') {
    modeloSrc = './src/monk_character.glb';
  } else if (animacion === 'arbol') {
    modeloSrc = './modelos/arbol.glb';
  } else if (animacion === 'gnomo') {
    modeloSrc = './modelos/gnomo.glb';
  } else if (animacion === 'estrella') {
    modeloSrc = './modelos/estrella.glb';
  } else {
    modeloSrc = './modelos/error.glb';
  }

  const loader = new GLTFLoader();
  loader.load(modeloSrc, (gltf) => {
    model = gltf.scene;
    
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }
    
    // --- MODIFICADO ---
    // El modelo ya no se añade a la escena aquí.
    // Lo haremos invisible y lo moveremos al centro (0,0,0) para empezar.
    model.visible = false; // <-- ¡NUEVO!
    model.scale.set(0.1, 0.1, 0.1);
    scene.add(model);
    // --- FIN DE MODIFICACIÓN ---
    
  }, undefined, (error) => {
    console.error('Error al cargar el modelo:', error);
  });

  // G. INICIAR EL BUCLE DE RENDERIZADO
  renderer.setAnimationLoop(animate);
  
  // H. Ajustar la ventana si cambia de tamaño
  window.addEventListener('resize', onWindowResize);

  // --- I. NUEVO: CREAR LA RETÍCULA (EL ANILLO) ---
  const reticleGeometry = new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2); // Rota para que esté plano en el suelo
  const reticleMaterial = new THREE.MeshBasicMaterial();
  reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
  reticle.matrixAutoUpdate = false; // Nosotros controlaremos su posición
  reticle.visible = false; // Oculto hasta que encontremos el suelo
  scene.add(reticle);
  // --- FIN DE NUEVO ---
  
  // --- J. NUEVO: MANEJAR EL "TOQUE" EN PANTALLA ---
  // renderer.domElement.addEventListener('touchend', onSelect);
  // --- FIN DE NUEVO ---
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- K. MODIFICADO: onSelect (V3) ---
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
// --- FIN DE MODIFICACIÓN ---

// --- L. MODIFICADO: animate (V3) ---
function animate(timestamp, frame) {
  // Actualizar la animación
  const delta = clock.getDelta();
  if (mixer) {
    mixer.update(delta);
  }

  // --- LÓGICA DE HIT-TEST (AHORA SE EJECUTA SIEMPRE) ---
  // Quitamos la condición "&& model.visible === false"
  if (frame) { 
    
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    // 1. Pedir la fuente del Hit Test (solo una vez)
    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      hitTestSourceRequested = true;
    }

    // 2. Obtener los resultados del Hit Test (en cada frame)
    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      // 3. Comprobar si "chocamos" con algo
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0]; 
        const hitPose = hit.getPose(referenceSpace);

        // 4. Mover la retícula a esa posición
        reticle.visible = true;
        reticle.matrix.fromArray(hitPose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
  // --- FIN DE LÓGICA DE HIT-TEST ---

  // Dibujar la escena
  renderer.render(scene, camera);
}
// --- FIN DE MODIFICACIÓN ---