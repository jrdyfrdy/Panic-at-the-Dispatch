import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- GAME STATE ---
const state = {
    isRunning: false,
    startTime: 0,
    timeElapsed: 0,
    won: false,
};

// --- CONSTANTS & CONFIG ---
const devConfig = {
    mazeSize: 21,
    cellSize: 4,
    playerSpeed: 40.0,
    timeLimit: 300, // 300 seconds = 5 minutes
    audioEnabled: true,
    minimapEnabled: true
};

const WALL_HEIGHT = 6;
const COLOR_BLUE = 0x0009FF;
const COLOR_WHITE = 0xFFFFFF;

// --- DOM ELEMENTS ---
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const redTint = document.getElementById('red-tint');
const timerDisplay = document.getElementById('timer-display');
const initialsModal = document.getElementById('initials-modal');
const finalTimeModal = document.getElementById('final-time-modal');
const initialsInput = document.getElementById('initials-input');
const submitInitials = document.getElementById('submit-initials');
const resultsScreen = document.getElementById('results-screen');
const humanTime = document.getElementById('human-time');
const leaderboardBody = document.getElementById('leaderboard-body');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');

// --- DEV SETTING ELEMENTS ---
const devModal = document.getElementById('dev-settings-modal');
const inputMazeSize = document.getElementById('setting-maze-size');
const inputSpeed = document.getElementById('setting-speed');
const inputTimeLimit = document.getElementById('setting-time-limit');
const inputAudio = document.getElementById('setting-audio');
const inputMinimap = document.getElementById('setting-minimap');
const closeDevBtn = document.getElementById('close-dev-btn');
const saveDevBtn = document.getElementById('save-dev-btn');

// --- MINIMAP SETUP ---
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOR_WHITE);
scene.fog = new THREE.Fog(COLOR_WHITE, 10, devConfig.mazeSize * devConfig.cellSize * 0.8);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

startBtn.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    if (!state.isRunning && !state.won) {
        startScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        resultsScreen.classList.add('hidden');
        state.startTime = performance.now();
        state.isRunning = true;
        updateAudioState();
    } else if (state.isRunning && !state.won) {
        updateAudioState();
    }
});

controls.addEventListener('unlock', () => {
    if (state.isRunning) {
        updateAudioState();
    }
});

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- AUDIO SETUP ---
// Placeholders for your background music tracks! Just rename the files below.
const START_BGM_FILE = 'start_bgm.mp3'; // Loading / Start Screen music
const GAME_BGM_FILE = 'game_bgm.mp3';   // Active Gameplay music
const END_BGM_FILE = 'end_bgm.mp3';     // Leaderboard / End screen music

const startBGM = new Audio(START_BGM_FILE);
startBGM.loop = true;
const gameBGM = new Audio(GAME_BGM_FILE);
gameBGM.loop = true;
const endBGM = new Audio(END_BGM_FILE);
endBGM.loop = true;

// Helper to switch audio states
function updateAudioState() {
    // 1. Pause all first to prevent overlapping
    startBGM.pause();
    gameBGM.pause();
    endBGM.pause();

    // 2. If disabled in dev settings, leave them paused
    if (!devConfig.audioEnabled) return;

    // 3. Play the right track depending on game state
    // We wrap in try-catch because browser policies block autoplay without user interaction
    try {
        if (state.won || (!resultsScreen.classList.contains('hidden'))) {
            endBGM.play().catch(e => console.log('Waiting for user interaction to play audio.'));
        } else if (state.isRunning) {
            gameBGM.play().catch(e => console.log('Waiting for user interaction to play audio.'));
        } else {
            startBGM.play().catch(e => console.log('Waiting for user interaction to play audio.'));
        }
    } catch (e) {
        console.warn("Audio playback issue:", e);
    }
}

// Ensure first click on page triggers audio if allowed
document.addEventListener('click', () => {
    if (startBGM.paused && gameBGM.paused && endBGM.paused) {
        updateAudioState();
    }
}, { once: true });

// Minimal synth for footsteps and rescue chime
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const rescueSound = {
    play: async () => {
        if (!devConfig.audioEnabled) return Promise.resolve();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const time = audioCtx.currentTime;
        osc.frequency.setValueAtTime(523.25, time); // C5
        osc.frequency.setValueAtTime(659.25, time + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, time + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, time + 0.45); // C6
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 2.0);
        
        osc.start(time);
        osc.stop(time + 2.5);
        return Promise.resolve();
    }
};

let lastFootstep = 0;
function playFootstepSynth() {
    if (!devConfig.audioEnabled) return;
    if (audioCtx.state === 'suspended') return;
    const now = audioCtx.currentTime;
    if (now - lastFootstep < 0.35) return; // limit footstep frequency
    lastFootstep = now;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.05); // low thud
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
}

// --- PROCEDURAL TEXTURES ---
function generateBuildingTexture(seed) {
    const canvas = document.createElement('canvas');
    const bHeightPixels = 1024;
    canvas.width = 512;
    canvas.height = bHeightPixels;
    const ctx = canvas.getContext('2d');
    
    // Slight variance on the base building color
    const baseColors = ['#0009FF', '#0005BB', '#0011DD', '#020088'];
    ctx.fillStyle = baseColors[seed % baseColors.length];
    ctx.fillRect(0, 0, 512, bHeightPixels);
    
    ctx.fillStyle = '#FFFFFF';
    const patternType = seed % 3;
    
    // Windows generator
    if (patternType === 0) {
        // Grid pattern
        for (let y = 50; y < bHeightPixels - 150; y += 80) {
            for (let x = 40; x < 480; x += 60) {
                if (Math.random() > 0.3) {
                    ctx.globalAlpha = Math.random() * 0.5 + 0.2;
                    ctx.fillRect(x, y, 25, 45);
                }
            }
        }
    } else if (patternType === 1) {
        // Horizontal strips (office vibe)
        for (let y = 60; y < bHeightPixels - 150; y += 120) {
            for (let x = 20; x < 490; x += 150) {
                if (Math.random() > 0.2) {
                    ctx.globalAlpha = Math.random() * 0.4 + 0.1;
                    ctx.fillRect(x, y, 120, 30);
                }
            }
        }
    } else {
        // Sparse minimalism
        for (let y = 100; y < bHeightPixels - 200; y += 180) {
            for (let x = 80; x < 450; x += 180) {
                if (Math.random() > 0.5) {
                    ctx.globalAlpha = Math.random() * 0.7 + 0.1;
                    ctx.fillRect(x, y, 40, 70);
                }
            }
        }
    }

    // --- Ground Floor (Doors) ---
    ctx.globalAlpha = 1.0;
    
    // Draw Door Frame
    const doorW = 80 + (seed % 3) * 20; // Varied width (80, 100, 120)
    const doorH = 120;
    const doorX = (512 / 2) - (doorW / 2);
    const doorY = bHeightPixels - doorH;

    // Outer trim
    ctx.fillStyle = '#222222';
    ctx.fillRect(doorX - 10, doorY - 10, doorW + 20, doorH + 10);
    
    // Inner door material
    ctx.fillStyle = seed % 2 === 0 ? '#111111' : '#FFFFFF';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Door glass panels
    if (seed % 2 !== 0) {
        ctx.fillStyle = '#AAAAAA'; // Glass reflection
        ctx.fillRect(doorX + 8, doorY + 8, doorW - 16, doorH - 40);
    }
    
    // Door Handle
    ctx.fillStyle = seed % 2 === 0 ? '#FFFFFF' : '#000000';
    ctx.fillRect(doorX + doorW - 20, doorY + doorH / 2, 8, 30);

    const tex = new THREE.CanvasTexture(canvas);
    // Crucial: We map it 1-to-1 without repeating, avoiding stretching the door at the bottom
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// Memory-efficient Pool of 8 unique building materials
const procBuildingMaterials = [];
for (let i = 0; i < 8; i++) {
    procBuildingMaterials.push(
        new THREE.MeshPhongMaterial({ 
            map: generateBuildingTexture(i),
            color: 0xFFFFFF, // Pure white light absorption so the canvas color drives everything
            flatShading: true
        })
    );
}

// --- MATERIALS ---
const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 }); // Slightly darker ground
const wireframeMaterial = new THREE.LineBasicMaterial({ color: COLOR_WHITE, transparent: true, opacity: 0.3 });
const targetOuterMsg = new THREE.MeshPhongMaterial({ color: COLOR_BLUE });
const targetInnerMsg = new THREE.MeshBasicMaterial({ color: COLOR_WHITE });

// --- ENVIRONMENT BUILDER ---
let walls = [];
let targetMesh;
let targetPos = new THREE.Vector3();
let grid = [];
let shortestPath = null;

function initMaze() {
    // Clear old
    walls.forEach(w => scene.remove(w.mesh));
    if (targetMesh) scene.remove(targetMesh);
    walls = [];

    scene.children.forEach(c => {
        if(c.name === "ground") scene.remove(c);
    });

    // Ground
    const groundGeo = new THREE.PlaneGeometry(devConfig.mazeSize * devConfig.cellSize * 2, devConfig.mazeSize * devConfig.cellSize * 2);
    const ground = new THREE.Mesh(groundGeo, floorMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.name = "ground";
    scene.add(ground);

    let solvable = false;
    let startCoords;
    let endCoords;

    while (!solvable) {
        generateGrid();
        startCoords = { x: 1, z: 1 };
        endCoords = { x: devConfig.mazeSize - 2, z: devConfig.mazeSize - 2 };
        grid[startCoords.z][startCoords.x] = 0;
        grid[endCoords.z][endCoords.x] = 0;
        
        // Ensure spawn area and target area are completely open but keep the outer border walls intact
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                let sz = startCoords.z + dz;
                let sx = startCoords.x + dx;
                if (sz > 0 && sz < devConfig.mazeSize - 1 && sx > 0 && sx < devConfig.mazeSize - 1) {
                    grid[sz][sx] = 0;
                }
                
                let ez = endCoords.z + dz;
                let ex = endCoords.x + dx;
                if (ez > 0 && ez < devConfig.mazeSize - 1 && ex > 0 && ex < devConfig.mazeSize - 1) {
                    grid[ez][ex] = 0;
                }
            }
        }
        
        // Randomly clear some extra blocks to make it ~25% open (in an organic way) or simpler
        for(let i=0; i < devConfig.mazeSize*devConfig.mazeSize * 0.2; i++) {
            let rx = Math.floor(Math.random()*(devConfig.mazeSize-2))+1;
            let rz = Math.floor(Math.random()*(devConfig.mazeSize-2))+1;
            grid[rz][rx] = 0; 
        }
        
        shortestPath = checkSolvable(startCoords, endCoords);
        solvable = shortestPath !== null;
    }

    buildGridMeshes();

    // Setup Target
    const targetGeoOuter = new THREE.OctahedronGeometry(1.5);
    const targetGeoInner = new THREE.OctahedronGeometry(0.8);
    const outer = new THREE.Mesh(targetGeoOuter, targetOuterMsg);
    const inner = new THREE.Mesh(targetGeoInner, targetInnerMsg);
    targetMesh = new THREE.Group();
    targetMesh.add(outer);
    targetMesh.add(inner);
    
    // Wireframe for target
    const targetWire = new THREE.LineSegments(new THREE.EdgesGeometry(targetGeoOuter), wireframeMaterial);
    targetMesh.add(targetWire);

    targetPos.set(
        (endCoords.x - devConfig.mazeSize/2) * devConfig.cellSize,
        2,
        (endCoords.z - devConfig.mazeSize/2) * devConfig.cellSize
    );
    targetMesh.position.copy(targetPos);
    scene.add(targetMesh);

    // Position Camera lower like in a vehicle
    camera.position.set(
        (startCoords.x - devConfig.mazeSize/2) * devConfig.cellSize,
        1.5,
        (startCoords.z - devConfig.mazeSize/2) * devConfig.cellSize
    );
}

function generateGrid() {
    grid = [];
    for (let z = 0; z < devConfig.mazeSize; z++) {
        let row = [];
        for (let x = 0; x < devConfig.mazeSize; x++) {
            // Edges are always walls, inside is randomized prioritizing walls
            if (x === 0 || x === devConfig.mazeSize - 1 || z === 0 || z === devConfig.mazeSize - 1) {
                row.push(1);
            } else {
                row.push(Math.random() > 0.4 ? 1 : 0);
            }
        }
        grid.push(row);
    }

    // Explictly carve a safe, guaranteed path from start to end!
    let cx = 1; let cz = 1;
    let ex = devConfig.mazeSize - 2; let ez = devConfig.mazeSize - 2;
    while(cx !== ex || cz !== ez) {
        grid[cz][cx] = 0;
        if (Math.random() > 0.5) {
            if (cx < ex) cx++; else if (cx > ex) cx--;
            else if (cz < ez) cz++; else cz--;
        } else {
            if (cz < ez) cz++; else if (cz > ez) cz--;
            else if (cx < ex) cx++; else cx--;
        }
    }
    grid[ez][ex] = 0;
}

function checkSolvable(start, end) {
    const queue = [{x: start.x, z: start.z, path: [{x: start.x, z: start.z}]}];
    const visited = Array(devConfig.mazeSize).fill(0).map(() => Array(devConfig.mazeSize).fill(false));
    visited[start.z][start.x] = true;
    
    const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
    
    while(queue.length > 0) {
        const curr = queue.shift();
        if (curr.x === end.x && curr.z === end.z) return curr.path;
        
        for (let [dz, dx] of dirs) {
            let nz = curr.z + dz;
            let nx = curr.x + dx;
            
            // Protect against out-of-bounds array access just in case
            if (nz >= 0 && nz < devConfig.mazeSize && nx >= 0 && nx < devConfig.mazeSize) {
                if (grid[nz][nx] === 0 && !visited[nz][nx]) {
                    visited[nz][nx] = true;
                    // Copy path array and add new step
                    queue.push({x: nx, z: nz, path: [...curr.path, {x: nx, z: nz}]});
                }
            }
        }
    }
    return null;
}

function buildGridMeshes() {
    for (let z = 0; z < devConfig.mazeSize; z++) {
        for (let x = 0; x < devConfig.mazeSize; x++) {
            if (grid[z][x] === 1) {
                // Vary building heights moderately
                const bHeight = Math.random() > 0.7 ? WALL_HEIGHT * (1.2 + Math.random() * 1.5) : WALL_HEIGHT;
                
                const boxGeo = new THREE.BoxGeometry(devConfig.cellSize, bHeight, devConfig.cellSize);
                
                // Pick a random unique texture from our procedural pool!
                const randMat = procBuildingMaterials[Math.floor(Math.random() * procBuildingMaterials.length)].clone();
                const mesh = new THREE.Mesh(boxGeo, randMat);
                
                const px = (x - devConfig.mazeSize/2) * devConfig.cellSize;
                const pz = (z - devConfig.mazeSize/2) * devConfig.cellSize;
                mesh.position.set(px, bHeight/2, pz);
                
                // Add glowing outline correctly scaled
                const outlineGeo = new THREE.EdgesGeometry(boxGeo);
                const wireframe = new THREE.LineSegments(outlineGeo, wireframeMaterial);
                mesh.add(wireframe);
                
                // Bounding box for collision
                mesh.geometry.computeBoundingBox();
                scene.add(mesh);
                walls.push({
                    mesh: mesh,
                    box: new THREE.Box3().setFromObject(mesh)
                });
            }
        }
    }
}

// --- MOVEMENT & COLLISION ---
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'KeyE': if(event.shiftKey) exportCSV(); break;
        case 'KeyR': if(event.shiftKey) resetData(); break;
        case 'KeyP': if(event.shiftKey) openDevSettings(); break;
    }
});

function openDevSettings() {
    controls.unlock();
    inputMazeSize.value = devConfig.mazeSize;
    inputSpeed.value = devConfig.playerSpeed;
    inputTimeLimit.value = devConfig.timeLimit;
    inputAudio.checked = devConfig.audioEnabled;
    inputMinimap.checked = devConfig.minimapEnabled;
    devModal.classList.remove('hidden');
}

closeDevBtn.addEventListener('click', () => {
    devModal.classList.add('hidden');
    // Lock again if we are running
    if (state.isRunning && !state.won) controls.lock();
    updateAudioState();
});

saveDevBtn.addEventListener('click', () => {
    let newSize = parseInt(inputMazeSize.value) || 21;
    if (newSize % 2 === 0) newSize++; // force odd
    devConfig.mazeSize = newSize;
    devConfig.playerSpeed = parseFloat(inputSpeed.value) || 40.0;
    devConfig.timeLimit = parseFloat(inputTimeLimit.value) || 300;
    devConfig.audioEnabled = inputAudio.checked;
    devConfig.minimapEnabled = inputMinimap.checked;
    minimapCanvas.style.display = devConfig.minimapEnabled ? 'block' : 'none';
    
    devModal.classList.add('hidden');
    // Reset and regenerate maze with new config
    state.timeElapsed = 0;
    state.won = false;
    redTint.style.opacity = 0;
    initMaze();
    resultsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    updateAudioState();
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

function checkCollision(targetPosition) {
    // Precise grid-based Axis-Aligned Bounding Box (AABB) collision to completely prevent clipping
    const pr = 0.8; // Player's physical width/radius
    
    // Convert world position boundaries -> integer grid map cells they touch
    const minXGrid = Math.floor((targetPosition.x - pr) / devConfig.cellSize + devConfig.mazeSize / 2 + 0.5);
    const maxXGrid = Math.floor((targetPosition.x + pr) / devConfig.cellSize + devConfig.mazeSize / 2 + 0.5);
    const minZGrid = Math.floor((targetPosition.z - pr) / devConfig.cellSize + devConfig.mazeSize / 2 + 0.5);
    const maxZGrid = Math.floor((targetPosition.z + pr) / devConfig.cellSize + devConfig.mazeSize / 2 + 0.5);
    
    for (let z = minZGrid; z <= maxZGrid; z++) {
        for (let x = minXGrid; x <= maxXGrid; x++) {
            // Boundary safety
            if (z < 0 || z >= devConfig.mazeSize || x < 0 || x >= devConfig.mazeSize) return true;
            // If any touched chunk is a wall (1), trigger a blocked collision
            if (grid[z][x] === 1) return true;
        }
    }
    return false;
}

// --- MINIMAP RENDERER ---
function drawMinimap() {
    if (!minimapCtx || !devConfig.minimapEnabled) return;
    
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const cellW = w / devConfig.mazeSize;
    const cellH = h / devConfig.mazeSize;
    
    minimapCtx.clearRect(0, 0, w, h);
    
    // Fill Grid Map base layout
    for (let z = 0; z < devConfig.mazeSize; z++) {
        for (let x = 0; x < devConfig.mazeSize; x++) {
            if (grid[z][x] === 1) {
                minimapCtx.fillStyle = '#0009FF'; // Building / Wall
                minimapCtx.fillRect(x * cellW, z * cellH, cellW + 0.5, cellH + 0.5);
            } else {
                minimapCtx.fillStyle = '#E5E7EB'; // Walkable Pathway (gray)
                minimapCtx.fillRect(x * cellW, z * cellH, cellW + 0.5, cellH + 0.5);
            }
        }
    }
    
    // Draw verified optimal BFS Path
    if (shortestPath) {
        minimapCtx.beginPath();
        minimapCtx.strokeStyle = '#10B981'; // Solved Green Route line
        minimapCtx.lineWidth = 3;
        for (let i = 0; i < shortestPath.length; i++) {
            let px = shortestPath[i].x * cellW + cellW / 2;
            let py = shortestPath[i].z * cellH + cellH / 2;
            if (i === 0) minimapCtx.moveTo(px, py);
            else minimapCtx.lineTo(px, py);
        }
        minimapCtx.stroke();
    }
    
    // Draw Target / Patient Dest mark
    minimapCtx.fillStyle = '#EF4444'; // Red Target
    minimapCtx.beginPath();
    minimapCtx.arc((devConfig.mazeSize - 2) * cellW + cellW/2, (devConfig.mazeSize - 2) * cellH + cellH/2, cellW/2.5, 0, Math.PI*2);
    minimapCtx.fill();
    
    // Draw Current Player Position
    const pGridX = camera.position.x / devConfig.cellSize + devConfig.mazeSize / 2;
    const pGridZ = camera.position.z / devConfig.cellSize + devConfig.mazeSize / 2;
    
    minimapCtx.fillStyle = '#F59E0B'; // Orange Player Dot
    minimapCtx.beginPath();
    minimapCtx.arc((pGridX + 0.5) * cellW, (pGridZ + 0.5) * cellH, cellW/2, 0, Math.PI*2);
    minimapCtx.fill();
}

// --- MAIN LOOP ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    // Cap delta at 0.1 to avoid tunneling via physics lag spikes
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    if (state.isRunning && !state.won && devModal.classList.contains('hidden')) {
        state.timeElapsed = (time - state.startTime) / 1000;
        timerDisplay.textContent = state.timeElapsed.toFixed(2) + 's';
        
        // Render updated GPS tracking minimap every frame
        drawMinimap();

        // Red screen effect
        let limit = devConfig.timeLimit;
        if (state.timeElapsed > limit * 0.8) {
            // fade to max 0.6 opacity
            let opacity = ((state.timeElapsed - limit * 0.8) / (limit * 0.2)) * 0.6;
            if (opacity > 0.6) opacity = 0.6;
            redTint.classList.remove('hidden');
            redTint.style.opacity = opacity;
        } else {
            redTint.style.opacity = 0;
            redTint.classList.add('hidden');
        }

        // Movement
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize();

        const speed = devConfig.playerSpeed;
        if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

        // Footsteps synth triggered by velocity check
        if (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1) {
            playFootstepSynth();
        }

        const originalPos = camera.position.clone();
        
        // Calculate the full intended position
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        const intendedPos = camera.position.clone();
        
        // --- Separating Axis Theorem (SAT) Sliding Check ---
        
        // Test X movement independently
        camera.position.set(intendedPos.x, originalPos.y, originalPos.z);
        if (checkCollision(camera.position)) {
            intendedPos.x = originalPos.x; // Blocked on X, slide along Z
        }

        // Test Z movement starting from the (potentially corrected) X position
        camera.position.set(intendedPos.x, originalPos.y, intendedPos.z);
        if (checkCollision(camera.position)) {
            intendedPos.z = originalPos.z; // Blocked on Z, slide along X
        }
        
        // Apply finalized safe position
        camera.position.copy(intendedPos);
        
        // Ensure height stays fixed
        camera.position.y = 1.5;

        // Target rotation
        if (targetMesh) {
            targetMesh.rotation.y += delta;
            targetMesh.rotation.x += delta * 0.5;
            
            // Check win
            const dist = camera.position.distanceTo(targetMesh.position);
            if (dist < 2.5) {
                triggerWin();
            }
        }
    }

    renderer.render(scene, camera);
    prevTime = time;
}

function triggerWin() {
    state.isRunning = false;
    state.won = true;
    
    updateAudioState();
    rescueSound.play().catch(e => console.log('Audio play blocked:', e));

    controls.unlock();
    
    hud.classList.add('hidden');
    initialsModal.classList.remove('hidden');
    
    const timeStr = state.timeElapsed.toFixed(2);
    finalTimeModal.textContent = timeStr;
    humanTime.textContent = `Manual Routing: ${timeStr}s`;
    
    initialsInput.value = '';
    setTimeout(() => initialsInput.focus(), 100);
}

// --- DATA PERSISTENCE ---
submitInitials.addEventListener('click', () => {
    let init = initialsInput.value.trim().toUpperCase();
    if (!init) init = 'AAA';
    
    saveScore(init, state.timeElapsed);
    
    initialsModal.classList.add('hidden');
    showResults();
});

function saveScore(initials, time) {
    let scores = JSON.parse(localStorage.getItem('tatag_scores')) || [];
    scores.push({ initials, time });
    scores.sort((a, b) => a.time - b.time);
    localStorage.setItem('tatag_scores', JSON.stringify(scores));
}

function showResults() {
    resultsScreen.classList.remove('hidden');
    updateAudioState();
    
    let scores = JSON.parse(localStorage.getItem('tatag_scores')) || [];
    scores = scores.slice(0, 5); // top 5
    
    leaderboardBody.innerHTML = '';
    scores.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-200 hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-3 font-bold">${idx + 1}</td>
            <td class="p-3 font-mono tracking-widest">${s.initials}</td>
            <td class="p-3 font-mono">${s.time.toFixed(3)}</td>
        `;
        leaderboardBody.appendChild(tr);
    });
}

function exportCSV() {
    let scores = JSON.parse(localStorage.getItem('tatag_scores')) || [];
    if (scores.length === 0) return alert('No data to export.');
    
    let csvContent = "data:text/csv;charset=utf-8,Rank,Initials,Time\n";
    scores.forEach((s, i) => {
        csvContent += `${i+1},${s.initials},${s.time}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kalinga-expo-results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function resetData() {
    if (confirm("Reset all leaderboard data?")) {
        localStorage.removeItem('tatag_scores');
        alert("Data reset.");
        if (!resultsScreen.classList.contains('hidden')) {
            showResults();
        }
    }
}

restartBtn.addEventListener('click', () => {
    state.timeElapsed = 0;
    state.won = false;
    redTint.style.opacity = 0;
    redTint.classList.add('hidden');
    initMaze();
    resultsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    updateAudioState();
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// STARTUP
initMaze();
animate();
