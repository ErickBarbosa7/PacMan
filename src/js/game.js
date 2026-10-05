// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 1 / 12; // 1/n celda/paso logico para garantizar alineacion
const GHOST_SPEED = 1 / 16;  // 1/n celda/paso logico para garantizar alineacion

// Desempate entre direcciones a igual distancia: primero la actual, luego
// derecha, izquierda, arriba y abajo. Evita el vaiven entre rutas optimas.
const TIE_ORDER = [ 'right', 'left', 'up', 'down' ];
const COWARD_RADIUS = 8;                // celdas de Manhattan
const COWARD_CORNER = { x: 26, y: 29 }; // esquina inferior derecha

// Personalidades que targetFor sabe resolver.
const GHOST_KINDS = [ 'hunter', 'ambush', 'flank', 'coward' ];
let warnedUnknownKind = false;

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda de Pac-Man.
function pacCell( game ) {
  return { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) };
}

// Celda situada `steps` celdas por delante del actor en su direccion actual.
function aheadCell( a, steps ) {
  const d = DIRS[ a.dir ];
  return {
    x: Math.round( a.x ) + d.x * steps,
    y: Math.round( a.y ) + d.y * steps,
  };
}

// El objetivo de un fantasma es siempre una celda real de la rejilla.
function clampToGrid( target, grid ) {
  return {
    x: Math.max( 0, Math.min( grid[ 0 ].length - 1, target.x ) ),
    y: Math.max( 0, Math.min( grid.length - 1, target.y ) ),
  };
}

// Celda objetivo segun la personalidad del fantasma. Los cuatro se parecen en
// que devuelven una celda; lo que los distingue es cual.
function targetFor( game, g ) {
  const grid = game.grid;
  const pac = pacCell( game );

  // hunter: persigue la celda de Pac-Man. Es el agresivo.
  if ( g.kind === 'hunter' ) return pac;

  // ambush: se coloca 4 celdas por delante para cortarle el paso.
  if ( g.kind === 'ambush' ) return clampToGrid( aheadCell( game.pacman, 4 ), grid );

  // flank: duplica el vector hunter -> 2 celdas por delante de Pac-Man, de modo
  // que entra por el lado opuesto al del hunter.
  if ( g.kind === 'flank' ) {
    const hunter = game.ghosts.find( ( other ) => other.kind === 'hunter' ) || game.pacman;
    const from = { x: Math.round( hunter.x ), y: Math.round( hunter.y ) };
    const ahead = aheadCell( game.pacman, 2 );
    return clampToGrid(
      {
        x: from.x + ( ahead.x - from.x ) * 2,
        y: from.y + ( ahead.y - from.y ) * 2,
      },
      grid
    );
  }

  // coward: persigue mientras lejos, se retira a la esquina si se acerca.
  if ( g.kind === 'coward' ) {
    const self = { x: Math.round( g.x ), y: Math.round( g.y ) };
    const dist = Math.abs( self.x - pac.x ) + Math.abs( self.y - pac.y );
    return dist > COWARD_RADIUS ? pac : COWARD_CORNER;
  }

  // Dispatch total: un kind desconocido cae en hunter y avisa una sola vez, para
  // que un typo en GHOST_STARTS no aparezca como un fantasma que deambula.
  if ( !warnedUnknownKind ) {
    warnedUnknownKind = true;
    console.warn( 'game.js: kind de fantasma desconocido, se usa hunter:', g.kind );
  }
  return pac;
}

// Direccion de `choices` que minimiza la distancia Manhattan a `target`.
function chooseDir( g, target, choices ) {
  const ranked = [];
  for ( const dir of [ g.dir ].concat( TIE_ORDER ) ) {
    if ( choices.includes( dir ) && !ranked.includes( dir ) ) ranked.push( dir );
  }
  let best = ranked[ 0 ];
  let bestDist = Infinity;
  for ( const dir of ranked ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - target.x ) + Math.abs( g.y + d.y - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// ¿El fantasma sigue dentro del cercado de PEN?
function inPen( g ) {
  return g.x >= PEN.x0 && g.x <= PEN.x1 && g.y >= PEN.y0 && g.y <= PEN.y1;
}

// Celda de la puerta de la pen mas cercana al fantasma.
function nearestPenDoor( g ) {
  let best = PEN_DOOR[ 0 ];
  let bestDist = Infinity;
  for ( const door of PEN_DOOR ) {
    const dist = Math.abs( door.x - g.x ) + Math.abs( door.y - g.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = door;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Dentro del cercado el objetivo es la puerta. Sin esto el fantasma
  // tendria que rodear paredes para alcanzar un objetivo exterior.
  if ( inPen( g ) ) {
    g.dir = chooseDir( g, nearestPenDoor( g ), choices );
    return;
  }

  g.dir = chooseDir( g, targetFor( game, g ), choices );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
