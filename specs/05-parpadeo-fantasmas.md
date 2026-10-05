# SPEC 05 — Parpadeo de fantasmas asustados

> **Status:** Implemented
> **Depends on:** SPEC 04
> **Date:** 2026-10-05
> **Objective:** Los fantasmas asustados parpadean alternando entre azul y blanco durante los últimos 2 segundos de su estado para avisar al jugador que están a punto de volver a la normalidad.

## Scope

**In:**

- Cuando el contador `frightenedSteps` de la partida llega a 120 (equivalente a 2 segundos), comienza la animación de parpadeo.
- El parpadeo alterna los colores cada 15 pasos lógicos (4 veces por segundo).
- Fase azul (clásica): cuerpo `#2121ff` y cara `#ffb8ae`.
- Fase blanca (alerta): cuerpo `#ffffff` y cara `#ff0000`.
- El parpadeo es puramente visual; no afecta la velocidad, la puntuación ni la lógica del juego.

**Out of scope:**

- El giro periódico (vaivén) del fantasma asustado cada 10 pasos (reservado para SPEC 03 si en el futuro se implementa completa).
- Cadenas de puntuación progresiva.

## Data model

Esta característica es puramente visual y no introduce nuevas estructuras de datos ni propiedades en el estado del juego. `game.frightenedSteps`, introducido en la SPEC 04, actúa como reloj maestro para la animación.

## Implementation plan

1. En `render.js`, actualizar la firma de la función principal de pintado de fantasmas a `drawGhost( ctx, g, color, frightenedSteps )` y modificar la llamada en la función `draw()` para pasarle `game.frightenedSteps`.
2. En `render.js`, actualizar `drawFrightenedFace( ctx, cx, cy, isWhite )` para que acepte el flag de alerta. Si `isWhite` es `true`, los colores de los ojos y la boca deben ser `#ff0000` (rojo). Si es `false`, mantienen su color `#ffb8ae` actual.
3. En `render.js`, dentro de `drawGhost` para el estado `frightened`, calcular la variable `const isWhite = frightenedSteps <= 120 && Math.floor( frightenedSteps / 15 ) % 2 === 0`. Pasar el color del cuerpo (`#ffffff` o `#2121ff`) a `drawGhostBody` según esta variable, y pasar el flag a `drawFrightenedFace`.

## Acceptance criteria

- [ ] El juego carga sin errores.
- [ ] Al comer una Power Pellet, los fantasmas se vuelven azules de forma continua durante los primeros 4 segundos.
- [ ] Cuando quedan aproximadamente 2 segundos para terminar el estado asustado, los fantasmas empiezan a parpadear.
- [ ] El parpadeo alterna claramente entre cuerpo azul/cara salmón y cuerpo blanco/cara roja.
- [ ] La frecuencia de parpadeo es rápida y constante (cada 15 pasos).
- [ ] Todos los fantasmas asustados parpadean al mismo tiempo de forma sincronizada.
- [ ] Tras finalizar el parpadeo, todos recuperan correctamente su estado, color y velocidad normal.
- [ ] La lógica del juego en `game.js` se mantiene intacta.

## Decisions

- **Sí:** Calcular el parpadeo dentro de `render.js` usando `frightenedSteps`. Es puramente visual, no aporta ninguna regla de negocio y no debería ensuciar el estado del fantasma en `game.js` con flags de `flash`.
- **Sí:** Alternar cada 15 pasos. Da exactamente 8 destellos en 120 pasos lógicos, una cantidad fácil de distinguir y fiel al arcade.
- **Sí:** Cara roja en el destello blanco. En el arcade los ojos/boca cambian a rojo cuando el fantasma se vuelve blanco para mantener el contraste.

## Risks

No hay riesgos lógicos significativos ya que el código no interviene en `update()`. Se aprovechará el bucle `draw()` existente.
