// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacmen.forEach( ( p ) => ( p.nextDir = dir ) );
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
let lastTime = 0;
let accumulator = 0;

function loop( now ) {
  // Inicializar lastTime en la primera llamada de requestAnimationFrame
  if ( !lastTime ) lastTime = now;
  const dt = now - lastTime;
  lastTime = now;

  accumulator += Math.min( dt, MAX_FRAME_MS );

  frame++;
  if ( game.state === 'playing' ) {
    while ( accumulator >= STEP_MS ) {
      update( game );
      accumulator -= STEP_MS;
    }

    // El estado pudo haber cambiado a won o lost tras los updates de este frame
    if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
    else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
  }
  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
