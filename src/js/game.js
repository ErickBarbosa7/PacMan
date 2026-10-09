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
const POWER_PELLET_SCORE = 50;
const GHOST_SCORE = 200;
const CORE_SCORE = 100;
const DOT_SCORE = 10;
const DIVIDED_DOT_SCORE = 20; // multiplicador x2 mientras dura la division
const FRIGHTENED_STEPS = 360;
const FRIGHTENED_SPEED = 1 / 32; // mitad exacta de GHOST_SPEED (1/16)
const DIVISION_STEPS = 600;      // 10 s a 60 pasos logicos por segundo

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
  let energizers = 0;
  for ( const row of grid ) {
    for ( const v of row ) {
      if ( v === 2 ) dots++;
      if ( v === 4 ) energizers++;
    }
  }

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    energizersLeft: energizers,
    frightenedSteps: 0,
    dividedSteps: 0,
    grid,
    pacmen: [
      {
        x: PACMAN_START.x,
        y: PACMAN_START.y,
        dir: 'left',
        nextDir: null,
        speed: PACMAN_SPEED,
      },
    ],
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      state: 'normal',
      home: { x: g.x, y: g.y },
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

function movePacman( game, p ) {
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
      game.score += game.dividedSteps > 0 ? DIVIDED_DOT_SCORE : DOT_SCORE;
      game.dotsRemaining--;
    }
    // Comer Power Pellet.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.energizersLeft--;
      startFrightened( game );
    }
    // Comer Division Core: reparte el control en dos Pac-Man.
    if ( grid[ p.y ][ p.x ] === 5 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += CORE_SCORE;
      startDivision( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// El Pac-Man mas cercano al fantasma g. Con uno solo es siempre el mismo.
function nearestPac( game, g ) {
  let best = game.pacmen[ 0 ];
  let bestDist = Infinity;
  for ( const p of game.pacmen ) {
    const dist = Math.abs( p.x - g.x ) + Math.abs( p.y - g.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

// Celda del Pac-Man mas cercano al fantasma g.
function pacCell( game, g ) {
  const p = nearestPac( game, g );
  return { x: Math.round( p.x ), y: Math.round( p.y ) };
}

// Activa el estado dividido: un clon en PACMAN_START y el reloj a tope.
function startDivision( game ) {
  if ( game.pacmen.length > 1 ) return;
  game.dividedSteps = DIVISION_STEPS;
  game.pacmen.push( {
    x: PACMAN_START.x,
    y: PACMAN_START.y,
    dir: 'left',
    nextDir: null,
    speed: PACMAN_SPEED,
  } );
}

function startFrightened( game ) {
  game.frightenedSteps = FRIGHTENED_STEPS;
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'normal' ) {
      g.state = 'frightened';
      g.speed = FRIGHTENED_SPEED;
      // Redondear posicion al cambiar velocidad (evita quedar atrapado entre celdas)
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      g.dir = OPPOSITE[ g.dir ];
    }
  } );
}

function eatGhost( game, g ) {
  game.score += GHOST_SCORE;
  g.state = 'eaten';
  g.speed = GHOST_SPEED;
  g.x = Math.round( g.x );
  g.y = Math.round( g.y );
  g.dir = OPPOSITE[ g.dir ];
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
  const pac = pacCell( game, g );
  const targetPac = nearestPac( game, g );

  // hunter: persigue la celda de Pac-Man. Es el agresivo.
  if ( g.kind === 'hunter' ) return pac;

  // ambush: se coloca 4 celdas por delante para cortarle el paso.
  if ( g.kind === 'ambush' ) return clampToGrid( aheadCell( targetPac, 4 ), grid );

  // flank: duplica el vector hunter -> 2 celdas por delante de Pac-Man, de modo
  // que entra por el lado opuesto al del hunter.
  if ( g.kind === 'flank' ) {
    const hunter = game.ghosts.find( ( other ) => other.kind === 'hunter' ) || targetPac;
    const from = { x: Math.round( hunter.x ), y: Math.round( hunter.y ) };
    const ahead = aheadCell( targetPac, 2 );
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

  // Revivir fantasma al llegar a su celda de inicio (home) dentro del cercado
  if ( g.state === 'eaten' && g.x === g.home.x && g.y === g.home.y ) {
    g.state = 'normal';
    g.speed = GHOST_SPEED;
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Al revivir, lo forzamos a mirar hacia arriba para que salga directo
    // y no se quede dando vueltas por la regla de no regresar.
    g.dir = 'up';
  }

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Fantasma comido regresa a su home en la pen.
  // Si esta afuera, su objetivo es la puerta de la pen. Si apuntara directo a su home,
  // la distancia Manhattan lo haria chocar contra la pared exterior y quedarse dando vueltas.
  if ( g.state === 'eaten' ) {
    let target = { x: 13, y: 12 }; // Celda de la puerta
    // Si ya esta en la puerta o adentro, apunta a su home exacto
    if ( (g.y === 12 && (g.x === 13 || g.x === 14)) || inPen(g) ) {
      target = g.home;
    }
    g.dir = chooseDir( g, target, choices );
    return;
  }

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
  game.frightenedSteps = 0;
  game.dividedSteps = 0;
  // Vuelve a un solo Pac-Man: el original en su celda de inicio.
  game.pacmen = [ game.pacmen[ 0 ] ];
  const p = game.pacmen[ 0 ];
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.state = 'normal';
    g.speed = GHOST_SPEED;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.pacmen.forEach( ( p ) => movePacman( game, p ) );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  if ( game.frightenedSteps > 0 ) {
    game.frightenedSteps--;
    if ( game.frightenedSteps === 0 ) {
      game.ghosts.forEach( ( g ) => {
        if ( g.state === 'frightened' ) {
          g.state = 'normal';
          g.speed = GHOST_SPEED;
          g.x = Math.round( g.x );
          g.y = Math.round( g.y );
        }
      } );
    }
  }

  // Reloj del estado dividido: al llegar a 0, fusion en el original.
  if ( game.dividedSteps > 0 ) {
    game.dividedSteps--;
    if ( game.dividedSteps === 0 && game.pacmen.length > 1 ) {
      game.pacmen = [ game.pacmen[ 0 ] ];
    }
  }

  // Una sola vida por paso: al perderla se sale del bucle.
  let lostLife = false;
  for ( const g of game.ghosts ) {
    if ( lostLife ) break;
    for ( const p of game.pacmen ) {
      if ( !collides( p, g ) ) continue;
      if ( g.state === 'eaten' ) {
        // Nada
      } else if ( g.state === 'frightened' ) {
        eatGhost( game, g );
      } else {
        game.lives--;
        if ( game.lives <= 0 ) {
          game.state = 'lost';
          return;
        }
        resetPositions( game );
        lostLife = true;
        break;
      }
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
