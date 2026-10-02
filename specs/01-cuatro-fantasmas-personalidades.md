# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Status:** Approved
> **Date:** 2026-10-02
> **Objective:** Cuatro fantasmas en el laberinto, cada uno con una forma distinta de decidir hacia dónde moverse, uno de los cuales persigue a Pac-Man de forma directa y agresiva.

## Scope

**In:**

- Cuatro fantasmas en partida, arrancando en las cuatro celdas indicadas del cercado.
- Cuatro comportamientos identificados por `GHOST_STARTS[].kind`: `hunter`, `ambush`, `flank`, `coward`.
- `hunter` persigue la celda de Pac-Man; es el agresivo de la spec.
- `ambush` apunta a la celda cuatro pasos por delante de Pac-Man, en su dirección actual.
- `flank` duplica el vector que va del `hunter` a la celda dos pasos por delante de Pac-Man; llega por el lado opuesto.
- `coward` persigue mientras esté a más de 8 celdas de Manhattan y se retira a una esquina fija si está más cerca.
- Regla de salida del cercado: dentro del cercado el objetivo es la celda de puerta más cercana.
- Desempate determinista al elegir dirección: primero la dirección actual, luego derecha, izquierda, arriba, abajo.

**Out of scope (for future specs):**

- Alternancia scatter/chase con temporizadores globales.
- Palo de potencia, modo frightened y puntos por capturar fantasmas.
- Velocidades distintas por fantasma.
- Cambios en la puntuación al perder una vida.

## Data model

```js
// maze.js — geometria, no comportamiento
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'hunter' },  // indice 0 -> rojo
  { x: 14, y: 13, kind: 'ambush' },  // indice 1 -> cian
  { x: 12, y: 14, kind: 'flank' },   // indice 2 -> rosa
  { x: 15, y: 14, kind: 'coward' },  // indice 3 -> naranja
];
const PEN = { x0: 11, y0: 13, x1: 16, y1: 15 }; // caja del cercado: 6 x 3 = 18 celdas
const PEN_DOOR = [ { x: 13, y: 12 }, { x: 14, y: 12 } ];
```

```js
// game.js — constantes de comportamiento
const COWARD_RADIUS = 8;                // celdas de Manhattan
const COWARD_CORNER = { x: 26, y: 29 }; // esquina inferior derecha, celda transitable
const TIE_ORDER = [ 'right', 'left', 'up', 'down' ]; // tras la direccion actual
```

Convenciones:

- Coordenadas de celda, origen arriba-izquierda. `Math.round` sobre las posiciones flotantes para obtener la celda.
- El orden del array `GHOST_STARTS` fija el color vía `GHOST_COLORS[i]` en `render.js`.
- Exactamente un `kind: 'hunter'`; `flank` lo busca por `kind` para construir su objetivo.
- Todo objetivo se recorta al rango de la rejilla (`0..W-1`, `0..H-1`) antes de comparar distancias.
- `PEN` y `PEN_DOOR` se exponen en `window`; `game.js` ya carga después de `maze.js`, no hace falta tocar `index.html`.

## Implementation plan

1. En `maze.js`, ampliar `GHOST_STARTS` a cuatro entradas con su `kind`, en el orden de la sección Data model. Prueba manual: el juego arranca con cuatro fantasmas; los tres nuevos caen en la rama aleatoria actual y el juego sigue siendo jugable.
2. En `maze.js`, declarar `PEN` y `PEN_DOOR` y exportarlos en `window`. Prueba manual: el juego no cambia, `window.PEN` existe.
3. En `game.js`, añadir `inPen( ghost )` y `nearestPenDoor( ghost )`, y usarlos al principio de `decideGhost`: dentro del cercado el objetivo es la puerta y se elige dirección por distancia. Prueba manual: los cuatro fantasmas salen del cercado por la puerta.
4. En `game.js`, añadir `chooseDir( ghost, target, choices )` que ordena las candidatas como dirección actual primero y luego `TIE_ORDER`, y se queda con la de menor distancia Manhattan al objetivo. Refactorizar la rama `hunter` actual para que la use. Prueba manual: el comportamiento del fantasma rojo no cambia, solo desaparece el vaivén en empates.
5. En `game.js`, añadir `targetFor( game, ghost )` con los cuatro casos: `hunter` devuelve la celda de Pac-Man; `ambush`, la celda cuatro pasos por delante usando `game.pacman.dir`; `flank`, el punto dos pasos por delante duplicado desde la posición del `hunter`; `coward`, la celda de Pac-Man si la distancia supera `COWARD_RADIUS` y `COWARD_CORNER` si no. Recortar los cuatro al rango de la rejilla. Sustituir el `if ( kind === 'hunter' ) ... else random` de `decideGhost`. Prueba manual: los cuatro fantasmas toman caminos distintos.
6. En `game.js`, hacer el dispatch total: si `GHOST_STARTS` trae un `kind` desconocido, `targetFor` cae en `hunter` y avisa una vez por consola. Eliminar el código muerto de la rama aleatoria. Prueba manual: juego idéntico al paso 5, sin residuos de `random`.

## Acceptance criteria

- [ ] El juego carga sin errores en la consola y `game.ghosts.length` vale 4.
- [ ] Se ven cuatro fantasmas, uno de cada color de `GHOST_COLORS`.
- [ ] Los cuatro arrancan en las cuatro celdas de la spec y dentro del cercado.
- [ ] Los cuatro salen del cercado por la puerta sin quedar atascados dentro.
- [ ] El fantasma rojo reduce la distancia Manhattan a la celda de Pac-Man en cada bifurcación mientras está fuera del cercado.
- [ ] El fantasma cian se dirige a la celda cuatro pasos por delante de Pac-Man y no a su celda actual.
- [ ] El fantasma rosa se aproxima desde un lado distinto al del rojo.
- [ ] El fantasma naranja se aleja cuando está a 8 celdas o menos de Pac-Man.
- [ ] Ningún fantasma repite una dirección opuesta a la que venía, salvo en un callejón sin salida.
- [ ] `render.js` y `index.html` no se modifican.

## Decisions

- **Sí:** las cuatro personalidades canónicas de Pac-Man, con nombres por rol (`hunter` / `ambush` / `flank` / `coward`) en vez de `blinky` / `pinky` / `inky` / `clyde`. El nombre delata qué hace el fantasma sin necesidad de conocer el juego original, y encaja con el `kind: 'hunter'` que ya existía.
- **No:** nombres del original. Habría que buscarlos para saber qué hace cada fantasma, y el repo no documenta esa relación.
- **Sí:** cada comportamiento devuelve una celda objetivo y una función compartida elige la dirección. Los cuatro difieren solo en el objetivo, que es exactamente lo que la spec quiere mostrar.
- **No:** una función de decisión completa por comportamiento. Duplicaría el filtrado de candidatos y el desempate cuatro veces.
- **Sí:** desempate por dirección actual, luego derecha, izquierda, arriba, abajo. Un orden fijo global sin preferencia por la actual hace oscilar al fantasma entre dos rutas óptimas cuando el objetivo cambia de celda.
- **No:** el orden natural de `DIRS`. Mismo problema, y el resultado depende de un orden de llaves que no comunica intención.
- **Sí:** dentro del cercado el objetivo es la celda de puerta más cercana. El cercado son 18 celdas cerradas salvo por la puerta; perseguir un objetivo exterior desde dentro obligaría a bordear paredes y el fantasma no saldría nunca.
- **No:** los fantasmas nacen fuera del cercado. Deja sin uso la geometría que ya está dibujada y desaparece la pen de `maze.js`.
- **No:** regla de salida especial, cada uno con su personalidad dentro del cercado. Puede dejar fantasmas dando vueltas dentro indefinidamente.
- **Sí:** los cuatro a `GHOST_SPEED = 0.1`. La agresividad viene del objetivo, no de la velocidad, y `0.125` haría que el perseguidor alcance a Pac-Man en campo abierto. También preserva el invariante de fracción exacta de celda por frame.
- **No:** velocidades distintas por fantasma.
- **Sí:** recorte de los objetivos al rango de la rejilla. `flank` genera coordenadas fuera del laberinto cuando el `hunter` está dentro del cercado; sin recorte el objetivo no es una celda real y no se puede depurar.
- **Sí:** `flank` usa la posición real del `hunter` aunque siga dentro del cercado, sin caso especial. El cazador sale primero, así que la colaboración se resuelve sola.
- **No:** el bug de desbordamiento hacia arriba del `ambush` del juego original. Es un accidente del arcade, no una intención de diseño.
- **Sí:** `ambush` usa `game.pacman.dir`, la dirección comprometida, no `nextDir`. Con `nextDir` el fantasma reacciona a teclas que el jugador aún no ha ejecutado.
- **Sí:** la spec va en español con el estado `Aproved` en inglés. No hay specs previos; se usa el juego de etiquetas por defecto de `template.md`, que `/spec-impl` acepta igual.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El fallback a `random` silencioso oculta un `kind` mal escrito | El paso 6 hace el dispatch total y avisa por consola |
| Cuatro fantasmas en 18 celdas se amontonan | Las cuatro celdas de arranque están separadas y la puerta es de dos celdas de ancho |
| El `flank` genera un objetivo fuera de la rejilla mientras el `hunter` sigue dentro | Recorte al rango de la rejilla en `targetFor` |

## What is **not** in this spec

- Alternancia scatter/chase con temporizadores.
- Palo de potencia, modo frightened y puntuación por capturar fantasmas.
- Velocidades distintas por fantasma.

Cada uno de esos, si aterriza, va en su propia spec.