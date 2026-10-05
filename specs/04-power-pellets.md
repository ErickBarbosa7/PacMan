# SPEC 04 — Power Pellets: Pac-Man puede comer fantasmas

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-10-06
> **Objective:** Cuatro Power Pellets que, al ser comidas, ponen a los cuatro fantasmas en modo asustado y permiten a Pac-Man comerlos, tras lo cual regresan a la base como un par de ojos.

> **Alcance reducido a propósito.** La SPEC 03 describe este mismo feature con las refinaciones del arcade (cadena de 200/400/800/1600, pausa en la pen antes de revivir y giros periódicos del fantasma asustado). Esta spec es la versión mínima, sin esas refinaciones. La SPEC 03 queda en `Draft` como spec posterior.

## Scope

**In:**

- Cuatro Power Pellets, una en cada esquina del rectángulo interior del laberinto, con un valor de tile propio (`4`).
- Comer una Power Pellet suma 50 puntos y deja a los cuatro fantasmas en estado `frightened`.
- Al entrar en `frightened`, todos los fantasmas invierten su dirección y bajan a la mitad de velocidad.
- El modo `frightened` dura 360 pasos lógicos y el fantasma asustado conserva su personalidad de la SPEC 01.
- Tres estados por fantasma: `normal`, `frightened` y `eaten`.
- Comer un fantasma `frightened` suma 200 puntos y lo pasa a `eaten`.
- Un fantasma `eaten` se dibuja solo con los ojos y regresa por su cuenta a la pen, donde revive a `normal`.
- Los ojos de un fantasma `eaten` no quitan vidas al colisionar con Pac-Man.
- La victoria exige `dotsRemaining === 0` **y** `energizersLeft === 0`.
- Perder una vida devuelve a los cuatro fantasmas a `normal`, en sus posiciones de inicio.

**Out of scope (for future specs):**

- La cadena de puntuación 200/400/800/1600 por bolita, que queda para la SPEC 03.
- La pausa en la pen antes de revivir, que queda para la SPEC 03.
- El giro periódico del fantasma asustado cada 10 pasos, que queda para la SPEC 03.
- Desactivar las Power Pellets cuando quedan pocos puntos, como en el arcade.
- Mostrar el tiempo de `frightened` restante en el HUD o un aviso en la pantalla de inicio.
- Alternancia scatter/chase con temporizadores, ya diferida en la SPEC 01.
- Velocidades distintas por fantasma, ya diferida en la SPEC 01.
- Niveles múltiples, vidas nuevas por nivel o puntuación al perder una vida.
- Los nombres canónicos del arcade (`blinky`, `pinky`, `inky`, `clyde`).

## Data model

El laberinto gana un quinto valor de tile. La convención actual de `maze.js` es `'#'` pared `1`, `'.'` dot `2`, `' '` vacío `0`, `'-'` puerta `3`; la Power Pellet sigue el mismo patrón con su propio carácter.

```js
// maze.js — una linea nueva en parseTile()
if ( ch === 'o' ) return 4; // power pellet
```

Las cuatro Power Pellets sustituyen al punto que ya hay en esas celdas de las filas 1 y 29:

```
'#o...........##...........o#', // 1
'#o........................o#', // 29
```

```js
// game.js — constantes nuevas
const POWER_PELLET_SCORE = 50;
const GHOST_SCORE = 200;
const FRIGHTENED_STEPS = 360;    // 6 s a 60 pasos logicos por segundo
const FRIGHTENED_SPEED = 1 / 20; // mitad exacta de GHOST_SPEED (1/10)
```

```js
// game.js — estado de partida, claves nuevas
{
  dotsRemaining,   // celdas con tile 2
  energizersLeft,  // celdas con tile 4
  frightenedSteps, // pasos logicos que quedan de asustado; 0 = sin fright
}
```

```js
// game.js — cada fantasma de game.ghosts gana dos campos
{
  x, y, dir,
  speed, // ya existe: pasa a FRIGHTENED_SPEED mientras esta asustado
  kind,  // ya existe: hunter | ambush | flank | coward, no cambia
  state, // 'normal' | 'frightened' | 'eaten'
  home,  // celda de GHOST_STARTS[i], su destino cuando esta comido
}
```

```js
// render.js — constante nueva
const POWER_PELLET_COLOR = '#33ccff';
```

Convenciones:

- Coordenadas de celda, origen arriba-izquierda, igual que en la SPEC 01. El tile `4` es transitable para todos: no toca `isWall`, ni `drawWalls`, ni `drawDoor`, que solo miran `1` y `3`.
- Velocidades en celdas por paso lógico y siempre exactamente `1/n`, la regla de AGENTS.md. `FRIGHTENED_SPEED` es `1/20` porque `GHOST_SPEED` es `1/10`.
- `home` se copia de `GHOST_STARTS[i]` en `createGame`, no se busca por índice: el fantasma lleva su destino encima.
- El estado del fantasma vive en el fantasma, no en la partida. `frightenedSteps` es el único reloj y baja en `update()`.
- Al cambiar la velocidad de un fantasma se redondea su posición a la celda más cercana. La alineación a centros de celda es lo único que permite girar y comer, así que una posición flotante con una velocidad nueva deja al fantasma atrapado entre celdas.
- `state` es la única fuente de verdad del aspecto: `render.js` lee `state` y no deduce nada de la velocidad ni de la puntuación.

## Implementation plan

1. En `maze.js`, añadir `if ( ch === 'o' ) return 4;` a `parseTile`, sustituir los puntos de las columnas 1 y 26 de las filas 1 y 29 por `o` y actualizar el comentario de cabecera con la convención del tile nuevo. Prueba manual: el juego carga sin cambios en el aspecto y en consola `MAZE[ 1 ][ 1 ] === 4`.
2. En `render.js`, declarar `POWER_PELLET_COLOR` y añadir `drawPowerPellets( ctx, grid )`, un arco de radio 5 en cada celda con tile `4`, llamarla en `draw()` justo después de `drawDots`. Prueba manual: aparecen cuatro bolitas azules grandes en las esquinas y el resto del laberinto no se mueve. `index.html`, `style.css` y `TILE` no se tocan: la geometría no cambia.
3. En `game.js`, contar `energizersLeft` en `createGame`, detectar el tile `4` en `movePacman` (sumar `POWER_PELLET_SCORE` y vaciar la celda) y añadir `startFrightened( game )`, que pone `frightenedSteps` y pasa cada fantasma `normal` a `frightened` con `FRIGHTENED_SPEED`, la dirección invertida y la posición redondeada. Prueba manual: al comer una Power Pellet el marcador sube 50, la celda queda vacía y los cuatro fantasmas giran y se ralentizan a la vez.
4. En `game.js`, bajar `frightenedSteps` en cada paso lógico de `update()` y, al llegar a cero, devolver a `normal` a los fantasmas `frightened` con `GHOST_SPEED` y la posición redondeada. Prueba manual: unos 6 s después de la Power Pellet, los fantasmas recuperan su color y su velocidad.
5. En `game.js`, añadir `eatGhost( game, g )`, que suma `GHOST_SCORE`, pasa el fantasma a `eaten` con `GHOST_SPEED` y le invierte la dirección. En `update()`, separar la colisión en tres casos: `eaten` no hace nada, `frightened` llama a `eatGhost` y `normal` pierde una vida como hasta ahora. Prueba manual: tocar un fantasma asustado suma 200 y lo deja solo con los ojos.
6. En `game.js`, ramificar `decideGhost` con el estado `eaten`: el objetivo es `g.home`, que está dentro de la pen, y en ese estado no se excluye `OPPOSITE[ dir ]`, de modo que la puerta de entrada deje de ser un callejón. Al pisar una celda de la pen, revivirlo a `normal` con `GHOST_SPEED` y la posición redondeada. Limpiar `state` y `frightenedSteps` en `createGame` y `resetPositions`. Prueba manual: un fantasma comido entra en la pen y revive solo, los ojos no matan y perder una vida no deja fantasmas asustados ni comidos.
7. En `render.js`, hacer que `drawGhost` se ramifique por `state`: `normal` como hoy, `frightened` con cuerpo azul y boca ondulada, `eaten` solo con los dos ojos. Extraer el cuerpo y los ojos a funciones auxiliares para no duplicar el dibujo. Prueba manual: el fantasma asustado se ve azul y el comido se ve solo con los ojos.
8. En `AGENTS.md`, documentar el tile `4` junto a los otros valores, la regla de redondear la posición al cambiar de velocidad y el carácter `1/n` obligatorio de `FRIGHTENED_SPEED`. Prueba manual: el archivo refleja el código.

## Acceptance criteria

- [ ] El juego carga sin errores en la consola y hay cuatro celdas con tile `4`, en (1,1), (26,1), (1,29) y (26,29).
- [ ] Las cuatro Power Pellets se dibujan en azul y de mayor tamaño que un punto normal.
- [ ] El laberinto no se desincroniza: ni las paredes ni los puntos cambian de sitio ni de posición en pantalla.
- [ ] `index.html`, `style.css` y `TILE` no se modifican.
- [ ] Comer una Power Pellet suma exactamente 50 puntos y deja la celda vacía.
- [ ] Inmediatamente después de comer una Power Pellet, los cuatro fantasmas invierten su dirección.
- [ ] Los cuatro fantasmas se mueven más lento mientras están asustados y recuperan su velocidad al terminar.
- [ ] El modo asustado dura 360 pasos lógicos.
- [ ] Un fantasma asustado sigue usando su personalidad: el `hunter` sigue acercándose a la celda de Pac-Man.
- [ ] Comer un fantasma asustado suma 200 puntos.
- [ ] Un fantasma comido se dibuja solo con los ojos, sin cuerpo.
- [ ] Un fantasma comido regresa a la pen por su cuenta aunque el modo asustado termine antes de que llegue.
- [ ] Al entrar en la pen, un fantasma comido revive a su color y a su velocidad normales.
- [ ] Los ojos de un fantasma comido no quitan vidas al colisionar con Pac-Man.
- [ ] Perder una vida devuelve a los cuatro fantasmas a `normal`, en sus posiciones de inicio, con la velocidad normal.
- [ ] Ganar exige comerse todos los puntos y las cuatro Power Pellets.
- [ ] Ningún fantasma se queda atascado entre celdas, ni al empezar ni al terminar el modo asustado.

## Decisions

- **Sí:** tile `4` con el carácter `o`, en vez de una lista de coordenadas aparte. Sigue la convención que ya usa `parseTile` y hace que "queda una Power Pellet" sea una pregunta sobre `game.grid`, igual que los dots.
- **No:** un array `POWER_PELLETS` de posiciones en `maze.js`. Duplica la verdad: el render leería una lista y el juego otra, y comer una bolita tendría que modificar las dos estructuras.
- **Sí:** las cuatro bolitas en las esquinas del rectángulo interior, las mismas celdas del arcade.
- **No:** bolitas repartidas por el laberinto, o solo las dos de arriba. El rectángulo de esquinas es lo que hace el nivel reconocible.
- **Sí:** dos contadores, `dotsRemaining` y `energizersLeft`.
- **No:** un contador único para puntos y bolitas. Mezcla dos preguntas distintas en un número y deja de poder decir cuántos puntos quedan.
- **Sí:** el modo asustado dura 360 pasos lógicos, no 6 segundos de reloj. `update()` no sabe cuánto tiempo real pasa; el paso lógico es la unidad con la que ya trabajan las velocidades.
- **No:** `Date.now()` para el temporizador. Obliga a `main.js` a meter reloj en el estado del juego y rompe la simulación reproducible paso a paso.
- **Sí:** el fantasma asustado conserva su `targetFor` de la SPEC 01 y solo cambia de velocidad.
- **No:** dirección aleatoria en cada celda, como en el arcade. La SPEC 01 quitó `Math.random` a propósito.
- **No:** el giro periódico cada 10 pasos que describe la SPEC 03. Da el vaivén nervioso del original, pero es una refinamiento y esta spec se limita al núcleo.
- **No:** que el modo asustado se acorte con cada captura, como en el arcade. Exige tocar el reloj dentro de `eatGhost` y no está en el alcance pedido.
- **Sí:** `FRIGHTENED_SPEED = 1/20`, la mitad exacta de `GHOST_SPEED`. Sigue siendo `1/n`, que es lo que garantiza pasar por todos los centros de celda.
- **No:** bajar la velocidad con un decimal arbitrario como `0.06`. Es `6/100`: realinea cada 100 pasos tras recorrer seis celdas, así que el fantasma deja de girar y de comer.
- **Sí:** redondear la posición a la celda al entrar y al salir de `frightened`.
- **No:** dejar la posición flotante al cambiar la velocidad. Un fantasma en `x = 3.05` con velocidad `1/20` ya no vuelve a caer en un centro de celda: se queda entre celdas, sin girar y sin poder entrar en la pen. Es el invariante de AGENTS.md.
- **Sí:** los cuatro fantasmas invierten su dirección al comer la bolita, los que estén dentro de la pen incluidos.
- **No:** limitar el giro a los que están fuera de la pen. El giro es la señal inmediata de que el nivel ha cambiado, y es lo que hace el arcade.
- **Sí:** el destino del fantasma comido es su propia celda de inicio (`home`), dentro de la pen.
- **No:** apuntar a `PEN_DOOR`. En la puerta el objetivo coincide con la celda del fantasma, todas las direcciones disponibles empatan y `chooseDir` se queda con la actual: el fantasma sigue de largo por el pasillo de arriba en vez de entrar.
- **Sí:** en estado `eaten` se permite el giro de 180°.
- **No:** el filtro de `OPPOSITE` que hoy se aplica a todos los fantasmas. Al llegar a la puerta desde abajo, la única dirección que entra en la pen es justo la inversa de la que traía.
- **No:** una pausa en la pen antes de revivir, como propone la SPEC 03. Revivir al instante es más simple de revisar y el fantasma sale normal por la lógica de cercado que ya existe.
- **Sí:** los ojos de un fantasma comido no hacen daño.
- **No:** que los ojos maten por simetría con `collides`. En el arcade son inofensivos, y obligar al jugador a esquivarlos en la pen no aporta nada.
- **Sí:** la bolita puntúa 50 y el fantasma comido 200, el valor más simple del arcade.
- **No:** 10 puntos como un punto normal. El original da 50, y es lo que hace que merezca la pena arriesgarse a comerla.
- **No:** la cadena 200/400/800/1600. La SPEC 03 la recoge entera; meterla aquí impide revisar el núcleo sin arrastrar la puntuación.
- **Sí:** `resetPositions` limpia el estado de los fantasmas y el reloj del modo asustado.
- **No:** dejar vivo el modo asustado tras perder una vida. La partida volvería con fantasmas asustados que el jugador no ha activado.
- **Sí:** esta spec no toca `main.js`, `index.html` ni `style.css`. El reloj son pasos lógicos y la geometría no cambia.
- **No:** mostrar el tiempo de fright restante en el HUD. Es presentación, y el HUD solo tiene marcador y vidas.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Cambiar la velocidad con la posición flotante deja al fantasma desalineado para siempre | Redondear a la celda dentro de la función que cambia la velocidad, al entrar y al salir de `frightened` |
| El fantasma comido no entra en la pen: en la puerta todas las direcciones empatan y sigue de largo | Objetivo `home`, que está dentro de la pen, y giro de 180° permitido en `eaten` |
| `FRIGHTENED_SPEED = 1/20` está calculada sobre `GHOST_SPEED = 1/10` | Si se aprueba la SPEC 02 y `GHOST_SPEED` pasa a `1/16`, hay que cambiarla a `1/32`. La regla `1/n` sigue mandando |
| Los 360 pasos son 6 s solo si `update()` corre a 60 por segundo | Hoy corre una vez por frame de `requestAnimationFrame`, así que son 6 s en un monitor de 60 Hz y menos en uno más rápido. La SPEC 02 lo arregla; el paso lógico evita tener que rehacerlo |
| Una celda con tile `4` que el juego no llega a comer hace la partida imposible de ganar | `energizersLeft` cuenta las cuatro y la victoria lo exige, así que la celda huérfana se ve en el contador |
| La SPEC 03 describe este mismo feature con más alcance | Esta spec declara explícitamente qué refinamientos se dejan para la 03, para que no se implementen dos veces |

## What is **not** in this spec

- La cadena de 200/400/800/1600, la pausa en la pen y los giros del fantasma asustado: quedan en la SPEC 03.
- Desactivar las bolitas cuando quedan pocos puntos, como en el arcade.
- Tiempo de fright en el HUD o aviso en la pantalla de inicio.
- Scatter/chase con temporizadores y velocidades por nivel (SPEC 01 y SPEC 02).
- Niveles múltiples, vidas nuevas por nivel o puntuación al perder una vida.
- Nombres canónicos del arcade para los fantasmas.

Cada uno de esos, si aterriza, va en su propia spec.