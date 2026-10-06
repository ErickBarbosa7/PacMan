# 🧬 Pac-Man Dividido

## Descripción

**Pac-Man Dividido** es una nueva mecánica en la que Pac-Man puede recoger un objeto especial que provoca que se divida temporalmente en **dos Pac-Man independientes**.

Los dos personajes estarán conectados: **ambos responden simultáneamente a las mismas instrucciones del jugador**, pero cada uno se encuentra en una posición diferente del laberinto.

La dificultad consiste en controlar el movimiento de ambos al mismo tiempo y evitar que cualquiera de ellos sea atrapado por un fantasma.

---

## 🎯 Objetivo

Agregar una mecánica diferente al Pac-Man clásico que obligue al jugador a:

* Pensar en la posición de dos personajes al mismo tiempo.
* Buscar rutas seguras para ambos Pac-Man.
* Evitar que uno de los dos quede atrapado.
* Aprovechar el estado dividido para conseguir más puntos.

---

## 🧬 Funcionamiento

Durante la partida aparecerá un objeto especial:

```text
        🧬
    DIVISION CORE
```

Cuando Pac-Man recoge el objeto:

```text
          🧬
           ↓
          🟡
         /  \
        ↓    ↓
      🟡      🟡
```

Pac-Man se divide en dos.

A partir de ese momento existen:

```text
Pac-Man A 🟡
Pac-Man B 🟡
```

Ambos permanecen activos simultáneamente.

---

## 🎮 Control

El jugador continúa utilizando los mismos controles:

```text
↑  Arriba
↓  Abajo
←  Izquierda
→  Derecha
```

Una dirección enviada por el jugador se aplica a **ambos Pac-Man**.

Ejemplo:

```text
Jugador presiona →


🟡 A  → → →


🟡 B  → → →
```

Sin embargo, como los dos están ubicados en diferentes partes del laberinto, cada uno puede encontrarse con diferentes obstáculos.

---

## 🧩 Comportamiento ante paredes

Cada Pac-Man comprueba individualmente si puede realizar el movimiento.

Por ejemplo:

```text
🟡 A →      █
           ↑
        bloqueado


🟡 B → → → •
```

Si el Pac-Man A encuentra una pared, permanece en su posición.

El Pac-Man B puede continuar avanzando si su camino está libre.

Esto permite que una misma dirección produzca diferentes resultados para cada personaje.

---

## 👻 Fantasmas

Los fantasmas pueden perseguir a cualquiera de los dos Pac-Man.

```text
        👻
         ↓

🟡 A             🟡 B
```

Cada Pac-Man puede ser detectado y perseguido independientemente.

Esto aumenta la dificultad porque el jugador debe considerar constantemente la posición de ambos.

---

## 💀 Condición de derrota

La característica principal de esta mecánica es que **los dos Pac-Man comparten la misma vida**.

Si uno de ellos es atrapado:

```text
🟡 A  💥 👻

🟡 B
```

Se pierde una vida.

No importa si el otro Pac-Man continúa con vida.

### Regla:

> **Si uno muere, ambos regresan al estado normal o se pierde una vida, dependiendo de la implementación elegida.**

Para una versión más desafiante:

> **Si uno muere, se pierde inmediatamente una vida y termina el estado dividido.**

---

## ⏱️ Duración

La división puede tener una duración limitada.

Ejemplo:

```text
DIVIDED MODE

████████████████
TIME: 08 seconds
████████████████

🟡 A          🟡 B
```

Duración recomendada:

**10 segundos**

Cuando el tiempo termina, los dos Pac-Man vuelven a fusionarse.

```text
🟡 A      🟡 B

     ↓

     🟡
```

---

## ⭐ Sistema de puntuación

Mientras Pac-Man está dividido, los puntos pueden tener un multiplicador.

```text
Normal:

• = 10 puntos

Dividido:

• = 20 puntos
```

También se puede agregar un bonus por mantener vivos a ambos:

```text
10 segundos sobrevividos
+500 puntos
```

---

## 🌀 Objeto especial

El objeto puede aparecer aleatoriamente en el mapa.

Nombre:

### `Division Core`

Diseño sugerido:

```text
      ╭─────╮
      │ 🧬  │
      ╰─────╯
```

También puede tener una animación para llamar la atención del jugador.

---

## 🔄 Flujo de la mecánica

```text
          PAC-MAN NORMAL
                 │
                 ↓
        Encuentra Division Core
                 │
                 ↓
             🧬 ACTIVADO
                 │
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
      🟡 A              🟡 B
        │                 │
        └────────┬────────┘
                 │
           10 segundos
                 │
        ┌────────┴────────┐
        ↓                 ↓
     Ambos vivos       Uno muere
        │                 │
        ↓                 ↓
     🟡 Fusión          💀 Vida perdida
```

---

## 🧠 Dificultad

La dificultad aumenta porque el jugador debe pensar en **dos posiciones simultáneamente**.

Por ejemplo:

```text
        👻

🟡 A ────────┐
             │
             │
             └────── 🟡 B
```

El jugador puede querer avanzar hacia la derecha para salvar a B, pero ese mismo movimiento podría poner a A frente a un fantasma.

Esto genera decisiones como:

> "Si avanzo, salvo a B pero pongo en peligro a A."

---

## 🚀 Posibles mejoras

### Nivel 1 — División básica

Los dos Pac-Man responden a los mismos controles.

### Nivel 2 — Diferentes velocidades

Uno de los Pac-Man puede ser ligeramente más rápido.

### Nivel 3 — Fantasmas independientes

Cada fantasma puede elegir cuál de los dos perseguir.

### Nivel 4 — División estratégica

El jugador puede elegir cuándo fusionarlos nuevamente.

### Nivel 5 — Triple división

Como una mejora especial:

```text
          🟡
        /  |  \
      🟡   🟡   🟡
```

El jugador controla tres Pac-Man simultáneamente.

---

## 💡 Concepto principal

La mecánica transforma el juego de:

> **"Evita a los fantasmas."**

a:

> **"Evita a los fantasmas mientras mantienes vivos a dos Pac-Man al mismo tiempo."**

Esto crea una experiencia diferente al Pac-Man tradicional sin cambiar completamente las reglas principales del juego.

---

## 🎮 Resumen

| Característica | Descripción                          |
| -------------- | ------------------------------------ |
| Objeto         | 🧬 Division Core                     |
| Efecto         | Divide a Pac-Man en dos              |
| Controles      | Ambos responden al jugador           |
| Duración       | 10 segundos                          |
| Fantasmas      | Pueden perseguir a cualquiera        |
| Vida           | Compartida                           |
| Puntuación     | Multiplicador durante la división    |
| Dificultad     | Control simultáneo de dos personajes |
| Final          | Fusión o pérdida de vida             |

### 🧬 Idea central

**"One mind. Two Pac-Men. One life."**
