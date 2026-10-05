# SPEC 02 — Velocidad pausada y ritmo independiente del monitor

> **Status:** Draft
> **Date:** 2026-10-02
> **Objective:** El juego avanza al mismo ritmo en cualquier monitor y más despacio que en la SPEC 01.

## Scope

**In:**

- `PACMAN_SPEED` pasa a `1/12` de celda por paso lógico y `GHOST_SPEED` a `1/16`.
- `main.js` ejecuta `update()` a 60 pasos lógicos por segundo mediante un acumulador de tiempo real.
- `draw()` sigue llamándose en cada frame de `requestAnimationFrame`.
- Tope del delta acumulado para no recuperar el tiempo perdido tras volver de una pestaña en segundo plano.

**Out of scope (for future specs):**

- Niveles con velocidad progresiva por nivel.
- Pausa del juego.
- Interpolación de render entre pasos lógicos.
- Cualquier otro ajuste de dificultad (puntos por fantasma, vidas, palo de potencia).

## Data model

No hay estructuras de datos nuevas. Solo dos constantes existentes y dos nuevas:

```js
// game.js — velocidades en celdas por paso logico
const PACMAN_SPEED = 1 / 12; // ~0.0833 -> 5.00 celdas/s a 60 Hz
const GHOST_SPEED = 1 / 16;  //   0.0625 -> 3.75 celdas/s a 60 Hz
```

```js
// main.js — ritmo de la simulacion
const STEP_MS = 1000 / 60; // un paso logico cada ~16.67 ms
const MAX_FRAME_MS = 250;  // delta maximo que se acumula
```

Convenciones:

- La velocidad se expresa en **celdas por paso lógico**, no por segundo. Con `STEP_MS` fijo, pasos por
  segundo = 60 y celdas por segundo = `speed * 60`.
- Toda velocidad debe ser exactamente `1/n`: es lo que garantiza que el actor pase por **todos** los
  centros de celda, que es el único sitio donde se giran y se comen puntos. `0.13` (= 13/100) realinea,
  pero cada 100 pasos tras recorrer 13 celdas.
- Velocidades resultantes, para referencia: hoy el juego corre a 7.50 celdas/s en Pac-Man a 60 Hz, y a
  15.00 en un monitor de 144 Hz. Con esta spec, 5.00 en cualquier monitor.

## Implementation plan

1. En `game.js`, cambiar `PACMAN_SPEED` a `1 / 12` y `GHOST_SPEED` a `1 / 16`, y reescribir el
   comentario del denominador con la regla `1/n`. Prueba manual: el juego se nota más lento, Pac-Man
   sigue girando en cada celda y sigue comiendo todos los puntos.
2. En `main.js`, declarar `STEP_MS` y `MAX_FRAME_MS`, y añadir `lastTime` y `accumulator`. Convertir
   `loop()` en `loop( now )`: sumar `Math.min( now - lastTime, MAX_FRAME_MS )` al acumulador y ejecutar
   `while ( accumulator >= STEP_MS ) { update( game ); accumulator -= STEP_MS; }`. Arrancar con
   `requestAnimationFrame( loop )` en lugar de `loop()`, porque `now` sería `undefined` en la primera
   llamada. Prueba manual: el juego responde igual que antes; los pasos siguen siendo discretos.
3. En `main.js`, sacar la comprobación de `won` / `lost` fuera del bucle de pasos y ejecutarla una sola
   vez por frame. Con varios pasos acumulados en un mismo frame, el `while` puede terminar la partida a
   mitad y disparar `showOverlay` más de una vez, reescribiendo su `innerHTML` repetidamente.
   `frame` sigue contando frames de `requestAnimationFrame`: solo anima la boca de Pac-Man.
   Prueba manual: ganar o perder muestra un único overlay.

## Acceptance criteria

- [ ] `PACMAN_SPEED` vale `1/12` y `GHOST_SPEED` vale `1/16` en `game.js`.
- [ ] `update()` se ejecuta a 60 pasos por segundo con independencia de la frecuencia del monitor.
- [ ] En un monitor de 60 Hz el juego se nota más lento que en la SPEC 01.
- [ ] En un monitor de 120 Hz o superior el juego no corre al doble de velocidad.
- [ ] Pac-Man sigue girando correctamente en cada intersección y sigue comiendo todos los puntos.
- [ ] Los cuatro fantasmas siguen saliendo del cercado por la puerta.
- [ ] Al ganar o al perder aparece un único overlay, sin texto duplicado.
- [ ] La boca de Pac-Man sigue animándose al cambiar la velocidad.
- [ ] Tras volver de una pestaña inactiva el juego no salta de golpe más de ~15 pasos.
- [ ] `render.js`, `maze.js` e `index.html` no se modifican.

## Decisions

- **Sí:** velocidades `1/12` y `1/16`. Desde la SPEC 01 hay cuatro fantasmas cazando y la partida quedó
  más dura; bajar el numerador los deja en 3.75 celdas/s frente a las 5.00 de Pac-Man, así que se
  distingue quién hace cada cosa y la partida es sobrevivible.
- **No:** `1/12` y `1/10` (fantasmas a 5 celdas/s). Un perseguidor más rápido que el cazador deja la
  huida inútil: el `coward` no puede alejarse.
- **No:** bajar solo `PACMAN_SPEED` y dejar `GHOST_SPEED`. Con el cazador a 6 celdas/s te alcanza
  siempre, sin importar la personalidad.
- **Sí:** timestep fijo a 60 pasos lógicos por segundo en el mismo cambio. Hoy `update()` corre una vez
  por frame de `requestAnimationFrame`, así que la velocidad real depende del monitor. Es un bug, no una
  preferencia, y tocarlo ahora evita tener que volver a tocar los números más adelante.
- **No:** dejar el acoplamiento al refresco y solo bajar las constantes. El juego seguiría siendo 2.4x
  más rápido en un monitor de 144 Hz.
- **Sí:** tope de `MAX_FRAME_MS = 250`. Sin tope, volver de una pestaña inactiva acumularía varios
  segundos como delta y el `while` recuperaría cientos de pasos de golpe. Con 250 ms el peor caso son
  ~15 pasos.
- **No:** tope más pequeño (100 ms). Reduce el salto tras volver de segundo plano, pero en una máquina
  que se atasca cada pocos segundos el juego perdería tiempo de forma continua.
- **Sí:** `draw()` sigue en cada frame de rAF. Es el que hace que la animación de la boca de Pac-Man
  vaya fluida en un monitor de 144 Hz aunque la lógica vaya a 60 pasos.
- **No:** interpolación de render entre pasos lógicos. Envolver `draw()` para mostrar una posición
  interpolada toca el render de todos los actores y no aporta nada a la velocidad.
- **No:** velocidad progresiva por nivel. Es una decisión de diseño de niveles, no un ajuste.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `loop( now )` recibe `undefined` en la primera llamada y `now - lastTime` es `NaN` | El arranque pasa a ser `requestAnimationFrame( loop )`; el acumulador empieza en 0 |
| `showOverlay` se dispara varias veces si varios pasos de un frame terminan la partida | La comprobación de `won` / `lost` sale del bucle y se hace una vez por frame |
| Con paso fijo, una máquina a 30 Hz avanza 2 pasos por frame | Es el comportamiento correcto: el ritmo lógico se mantiene, solo se dibuja menos |
| Al bajar la velocidad, la partida dura más con los mismos 3 puntos de vida | Fuera de alcance de esta spec; la duración total no se ajusta aquí |

## What is **not** in this spec

- Niveles con velocidad progresiva.
- Pausa del juego.
- Interpolación de render.
- Ajustes de dificultad (puntos por fantasma, vidas, palo de potencia).

Cada uno de esos, si aterriza, va en su propia spec.