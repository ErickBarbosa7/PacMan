# SPEC 06 — Pac-Man dividido en dos

> **Status:** Draft
> **Depends on:** SPEC 04
> **Date:** 2026-10-06
> **Objective:** Un Division Core reparte el control entre dos Pac-Man que comparten teclado y vida durante 10 segundos, con los puntos de las bolitas duplicados mientras dure el estado.

## Scope

**In:**

- Un tile nuevo (`5`) con el carácter `c` en el laberinto: el **Division Core**, en la celda fija (13,17).
- Comer el core suma 100 puntos, vacía la celda y crea un segundo Pac-Man en `PACMAN_START` (13,23).
- `game.pacman` pasa a ser `game.pacmen`, un array de 1 o 2 personajes; ambos reciben la misma `nextDir`.
- Cada Pac-Man comprueba paredes, come bolitas y come fantasmas por su cuenta.
- El estado dividido dura 600 pasos lógicos (`dividedSteps`), el mismo patrón de reloj que `frightenedSteps`.
- Si un fantasma `normal` atrapa a **cualquiera** de los dos: se pierde una vida, termina el estado dividido y `resetPositions` vuelve a un solo Pac-Man.
- Mientras dure la división, una bolita vale 20 en vez de 10.
- Los fantasmas apuntan al Pac-Man más cercano (distancia Manhattan), incluidos `ambush` y `flank` con su celda adelantada y su espejo sobre ese mismo objetivo.
- Al llegar `dividedSteps` a 0, el clon desaparece y el original conserva su posición, dirección y `nextDir`.
- HUD en canvas: arriba-derecha `DIVIDIDO NNs` mientras dure el estado; abajo-izquierda las vidas como iconos de Pac-Man (`lives - 1`, al estilo arcade) y desaparece el texto `VIDAS N`.

**Out of scope (for future specs):**

- El bonus de +500 puntos por sobrevivir los 10 segundos completos.
- Aparición aleatoria o repetida del Division Core; solo hay una por partida.
- El Nivel 2 del documento: un Pac-Man más rápido que el otro.
- El Nivel 3: cada fantasma elige libremente a cuál perseguir (aquí solo el más cercano).
- El Nivel 4: fusión manual por parte del jugador.
- El Nivel 5: triple división.
- Multiplicar las Power Pellets o las capturas de fantasmas.
- Mostrar el contador de dividido en el overlay de inicio.

## Data model

El laberinto gana un sexto valor de tile, con la misma convención que los anteriores.

```js
// maze.js — una linea nueva en parseTile()
if ( ch === 'c' ) return 5; // division core
```

La celda (13,17) de `MAZE_STR` deja de ser bolita y pasa a ser `c`:

```js
'######.##....c.....##.######', // 17
```

```js
// game.js — constantes nuevas
const CORE_SCORE = 100;
const DIVISION_STEPS = 600;     // 10 s a 60 pasos logicos por segundo
const DOT_SCORE = 10;
const DIVIDED_DOT_SCORE = 20;
```

```js
// game.js — estado de partida, claves nuevas y renombrada
{
  dividedSteps, // pasos logicos que quedan de dividido; 0 = normal
  pacmen,       // [{ x, y, dir, nextDir, speed }]; 1 en normal, 2 en dividido
}
```

```js
// render.js — constante nueva
const CORE_COLOR = '#33ff55';
```

Convenciones:

- `pacmen[0]` es siempre el original. El clon entra en `[1]` y se borra al fusionar o al perder una vida.
- La entrada del jugador escribe la misma `nextDir` en todos los elementos de `pacmen`; no hay estado de entrada propio del clon.
- `dividedSteps` es el único reloj y baja en `update()`, igual que `frightenedSteps`. No se usa `Date.now()`.
- El estado dividido se pregunta con `pacmen.length === 2` o con `dividedSteps > 0`; ambas cosas se mantienen a la vez y se limpian juntas en `resetPositions`.
- Las velocidades no cambian: todos los personajes siguen a `PACMAN_SPEED = 1/12`.
- El tile `5` es transitable para todos: no toca `isWall`, `drawWalls` ni `drawDoor`.

## Implementation plan

1. En `maze.js`, añadir `if ( ch === 'c' ) return 5;` a `parseTile`, poner `c` en la celda (13,17) de la fila 17 y actualizar el comentario de cabecera con el tile nuevo. Prueba manual: el juego carga y en consola `MAZE[ 17 ][ 13 ] === 5`.
2. En `render.js`, declarar `CORE_COLOR` y añadir `drawDivisionCore( ctx, grid, frame )`, un círculo que pulsa (radio alternando con `frame`) en cada celda con tile `5`, llamada en `draw()` justo después de `drawPowerPellets`. Prueba manual: se ve un núcleo verde pulsando en el centro del laberinto. `index.html`, `style.css` y `TILE` no se tocan.
3. En `game.js`, renombrar `game.pacman` a `game.pacmen` (array de un elemento) sin cambiar el comportamiento: `movePacman( game, p )` recibe el personaje, `update()` lo llama en bucle, la colisión recorre `pacmen`, `resetPositions` reconstruye el array con el original, `nearestPac( game, g )` devuelve el Pac-Man más cercano al fantasma y `targetFor` se apoya en él. `main.js` escribe `nextDir` en todos los `pacmen` y `render.js` dibuja todos. Prueba manual: se juega idéntico a antes, el `hunter` sigue persiguiendo igual.
4. En `game.js`, detectar el tile `5` en el ramo de comida de `movePacman`: sumar `CORE_SCORE`, vaciar la celda y llamar a `startDivision( game )`, que solo si `pacmen.length === 1` empuja un clon en `PACMAN_START` con `dir: 'left'` y pone `dividedSteps = DIVISION_STEPS`. Prueba manual: al comer el núcleo aparece el segundo Pac-Man y ambos responden a la misma flecha.
5. En `game.js`, bajar `dividedSteps` en cada paso lógico de `update()` y, al llegar a 0, quitar el clon (`pacmen = [ pacmen[ 0 ] ]`). Prueba manual: 10 segundos después de comer el núcleo vuelve a haber un solo Pac-Man, en la posición en la que estaba el original.
6. En `game.js`, hacer que la colisión mire a todos los `pacmen`: un fantasma `frightened` comido por cualquiera suma 200 como hasta ahora, y un fantasma `normal` que atrape a cualquiera resta una vida, termina el estado dividido (`dividedSteps = 0`, quitar el clon) y llama a `resetPositions`. Mantener la regla de una vida por paso. Prueba manual: si atrapan al clon se pierde una vida y el juego vuelve a un solo Pac-Man; si atrapan al original, idem.
7. En `game.js`, sustituir el literal `10` de las bolitas por `game.dividedSteps > 0 ? DIVIDED_DOT_SCORE : DOT_SCORE`. Prueba manual: dividido una bolita suma 20 y al fusionar vuelve a sumar 10.
8. En `render.js`, rehacer el HUD: `SCORE` sigue arriba-izquierda; arriba-derecha, solo cuando `dividedSteps > 0`, `DIVIDIDO ` + `Math.ceil( dividedSteps / 60 )` + `s`; abajo-izquierda, `drawLives( ctx, game.lives )` pinta `lives - 1` iconos de Pac-Man amarillos (radio 7, boca fija, mirando a la izquierda) sobre un rectángulo negro que tape la línea azul del borde, y desaparece el texto `VIDAS N`. Prueba manual: con 3 vidas se ven 2 iconos abajo; al perder una, 1 icono.
9. En `AGENTS.md`, documentar el tile `5` junto a los demás, el array `pacmen` y el reloj `dividedSteps`. Prueba manual: el archivo refleja el código.

## Acceptance criteria

- [ ] El juego carga sin errores en la consola y `MAZE[ 17 ][ 13 ] === 5`.
- [ ] El Division Core se dibuja pulsando en (13,17) y solo se ve uno en todo el laberinto.
- [ ] `index.html`, `style.css` y `TILE` no se modifican; el laberinto no se desincroniza.
- [ ] Comer el core suma exactamente 100 puntos y deja la celda vacía.
- [ ] Tras comerlo hay dos Pac-Man: el original en su sitio y el clon en (13,23).
- [ ] Una sola pulsación de flecha mueve a los dos en esa dirección.
- [ ] Cada Pac-Man se detiene por su cuenta contra una pared mientras el otro sigue.
- [ ] El estado dividido dura 600 pasos lógicos y termina solo, sin input del jugador.
- [ ] Al terminar, el clon desaparece y el original queda donde estaba, con su dirección.
- [ ] Mientras dure la división una bolita suma 20; al volver a uno, suma 10.
- [ ] Un fantasma `normal` que atrapa a cualquiera de los dos resta una vida, termina la división y resetea posiciones.
- [ ] Un fantasma `frightened` comido por el clon suma 200 y se comporta igual que con el original.
- [ ] Cada fantasma apunta al Pac-Man más cercano mientras hay dos.
- [ ] El HUD muestra `DIVIDIDO NNs` arriba-derecha solo durante el estado dividido.
- [ ] Las vidas se dibujan como `lives - 1` iconos de Pac-Man abajo a la izquierda y no queda texto `VIDAS`.
- [ ] El marcador `SCORE` sigue arriba a la izquierda.
- [ ] Reiniciar desde el overlay limpia cualquier estado dividido.
- [ ] Ningún personaje se queda atascado entre celdas.
- [ ] Ganar sigue dependiendo solo de `dotsRemaining === 0`: el core no bloquea la victoria.

## Decisions

- **Sí:** `game.pacmen`, un array uniforme de 1 o 2 elementos. Mueve, colisiona y dibuja con el mismo bucle en los dos estados.
- **No:** `game.pacman` más un `game.clon` suelto. Duplica cada punto de acceso (movimiento, colisión, dibujo, `nextDir`) y permite que un campo se limpie y el otro no.
- **Sí:** tile `5` con el carácter `c` en la celda fija (13,17). Sigue la convención de `parseTile` y hace que "queda un core" sea una pregunta sobre `game.grid`.
- **No:** aparición aleatoria con `Math.random`. La SPEC 01 lo quitó a propósito para que la simulación sea reproducible paso a paso.
- **Sí:** el clon aparece en `PACMAN_START`. Celda fija, conocida y ya usada para el reset.
- **No:** el clon aparece en la misma celda que el original. Con los mismos controles y la misma posición los dos harían siempre idéntico movimiento y nunca se divergerían.
- **Sí:** 600 pasos lógicos, no 10 segundos de reloj. Es el patrón de `frightenedSteps` y `update()` no conoce el tiempo real.
- **No:** `Date.now()` para el contador. Metería reloj de pared en el estado del juego y rompería la simulación paso a paso.
- **Sí:** muerte de cualquiera = perder una vida y terminar el estado dividido (la variante difícil que propone `Pacman-Dividido.md`).
- **No:** solo fusionar sin perder vida. Deja al jugador sin castigo por exponer a cualquiera de los dos.
- **Sí:** cada fantasma apunta al Pac-Man más cercano en `targetFor`. Cumple "los fantasmas pueden perseguir a cualquiera" sin estados nuevos.
- **No:** que todos sigan solo al original. El clon no sería nunca amenaza y la mitad de la dificultad no existiría.
- **No:** perseguir aleatoriamente a uno de los dos. Otro `Math.random` en la lógica, ya descartado.
- **Sí:** multiplicar solo las bolitas (10 → 20). Es lo que describe el documento y cambia una sola línea.
- **No:** el bonus de +500 por sobrevivir. Requiere otro reloj y un caso de puntuación nuevo; queda para una spec futura.
- **No:** multiplicar Power Pellets ni capturas de fantasmas. Sus valores (50 y 200) ya son el gancho de la SPEC 04.
- **Sí:** el core suma 100, entre los 50 de la bolita y los 200 del fantasma.
- **No:** core sin puntos. El jugador no recibiría confirmación de haber recogido algo.
- **Sí:** fusión en la posición del original (`pacmen[ 0 ]`).
- **No:** volver a `PACMAN_START` al fusionar. Castigaría al jugador por llegar a tiempo.
- **Sí:** las vidas como `lives - 1` iconos abajo-izquierda, como el arcade (la que se juega está en el laberinto).
- **No:** texto `VIDAS N`. El arcade no lo lleva y el icono se lee sin traducir.
- **Sí:** un rectángulo negro detrás de los iconos de vida. La fila 30 pinta una línea azul de borde y los iconos flotarían sobre ella.
- **No:** tocar `index.html` o `style.css` para el HUD. Todo el HUD ya vive en `drawHUD`.
- **No:** respawn del core ni niveles 2–5 del documento (velocidades distintas, fusión manual, triple división).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El refactor de `pacmen[]` rompe algo sin ruido (targeting, reset, dibujo) | El paso 3 no añade funcionalidad: si el juego se juega idéntico, el refactor está bien antes de seguir |
| El clon aparece en (13,23) con un fantasma encima y pierde una vida sin culpa del jugador | Mismo caso que el reset actual tras perder una vida; la colisión se evalúa tras mover, como hoy |
| El estado dividido y el reloj se desincronizan (uno activo y el otro no) | Se preguntan y se limpian siempre juntos: `resetPositions`, la fusión por reloj y la muerte borran los dos |
| Los iconos de vida tapan la línea del borde o quedan encima de una bolita | Rectángulo negro detrás y fila 30, que es borde sólido sin bolitas |
| La SPEC 03 pide energizers en la victoria y hoy no se comprueba | Fuera del alcance de esta spec; no se toca la condición de victoria |

## What is **not** in this spec

- Bonus de +500 puntos por sobrevivir los 10 segundos.
- Division Core aleatoria o reaparece después de comerla.
- Velocidades distintas para los dos Pac-Man (Nivel 2 del documento).
- Fantasmas con objetivo libre entre los dos (Nivel 3; aquí solo el más cercano).
- Fusión manual por el jugador (Nivel 4) y triple división (Nivel 5).
- Multiplicador en Power Pellets y capturas.

Cada uno de esos, si aterriza, va en su propia spec.
