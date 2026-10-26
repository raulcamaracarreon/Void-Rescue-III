# VOID RESCUE III — prototipo de evolución 2.5D

**Estado: fase inicial (v0.1.0, NO publicada).** Base heredada de [Void Rescue II](https://github.com/raulcamaracarreon/Void-Rescue-II), bajo licencia MIT. La versión oficial de Void Rescue II permanece independiente e inalterada.

> **Aún no es el juego nuevo completo.** Se conserva la jugabilidad espacial de VR2 y se ha validado localmente el editor de rotación (16 pruebas E2E aprobadas por el usuario). La primera capa visual de primer plano (árboles, cercas y rejas) ya fue probada localmente por el usuario. En `feat/dual-decor-layers` se añade un **tercer plano** independiente entre los vehículos y las montañas/edificios. Ambos permiten activar/desactivar, escoger motivo, color, opacidad y paralaje. El dibujo manual, los helicópteros y los nuevos enemigos siguen pendientes.

## Fase 0 prioritaria: color automático e inversión de gradiente

Desarrollo en [`feat/decor-auto-gradient`](https://github.com/raulcamaracarreon/Void-Rescue-III/tree/feat/decor-auto-gradient), **pendiente de compilación y pruebas locales**. Ambos planos decorativos ofrecen color manual o color derivado del gradiente automático de dos extremos, con inversión independiente por plano. El color manual se conserva al alternar; la franja de vista previa incluye los planos habilitados y se actualiza al modificar la paleta. No se altera la simulación ni el gradiente de las montañas/edificios de fondo.

**Orden de trabajo:** validar conjuntamente fase 0 y cierre de fase 2 en la rama `feat/decor-buildings-and-span`; después iniciar fase 3 (editor de siluetas y dibujo manual). Edificios y longitud lateral están implementados en esa rama, pero aún no se han compilado ni probado en la máquina del usuario. No ampliar alcance fuera de esta secuencia.

## Fase 2 — edificios y longitud lateral de ambos planos

En [`feat/decor-buildings-and-span`](https://github.com/raulcamaracarreon/Void-Rescue-III/tree/feat/decor-buildings-and-span) se añadió el motivo **Edificios**, disponible en primer y tercer plano, y un campo **Longitud lateral (%)** independiente para ambos (5–100 %). La longitud define qué porcentaje del ancho circular (2400 unidades de juego) estará cubierto por la franja decorativa. Los elementos no se estiran, la zona restante queda vacía y el patrón se repite por mundo. No modifica la geometría colisionable ni el núcleo de simulación. Falta validación local de esta nueva rama.

## Qué funciona como base

- Simulación 2.5D existente: mundo horizontal circular, cámara, controles, combate, recogida y rescate, oleadas, récords y modos de dificultad.
- Editor de paisajes procedurales (13 estilos incluidos y biblioteca personal de hasta 100 ambientes).
- Propuesta de mejora de rotación: ambientes activos primero; dos columnas leídas de arriba hacia abajo; numeración, arrastrar, subir/bajar y mover al inicio, final o a una posición determinada.
- Almacenamiento exclusivo para VR3: `void-rescue-iii.landscape.v1`, `void-rescue-iii.preferences.v1`, `void-rescue-iii.records.v1` y `void-rescue-iii.pilot.v1`.
- Nombre, metadatos HTML y paquete npm renombrados para distinguir el prototipo.

El editor de rotación ya fue probado localmente con 16 recorridos E2E aprobados. **La rama de dos planos ya compiló y superó 118 pruebas unitarias y 24 E2E Playwright en la computadora del usuario. Queda pendiente la revisión visual manual de profundidad, paralaje y oclusión durante el vuelo.** No hay publicación de VR3 en Pages ni lanzamiento oficial.

## Ejecución local

Requiere Node.js 22.12 o superior.

```powershell
npm ci
npm run build
npm run test
npx playwright test tests/e2e/landscape.spec.ts tests/e2e/foreground.spec.ts
npm run dev
```

Acceso local: http://127.0.0.1:5173/

La prueba Playwright requiere tener instalado su navegador. Si no está disponible: `npx playwright install chromium`.

## Dirección del nuevo juego

VR3 evolucionará hacia un **arcade de rescate con vehículos y mundos configurables**. Un helicóptero de rescate y soldados, amenazas como drones, helicópteros y aviones, terrenos de selva/desierto/ciudad y capas decorativas opcionales que pueden superponerse al vehículo son ejemplos priorizados para los siguientes incrementos.

No se sustituirán el núcleo de simulación, la física ni las reglas probadas sin una migración incremental. Los elementos gráficos con oclusión de primer plano estarán separados del terreno y sus colisiones.

## Documentación VR3

- [Visión y ruta de desarrollo](docs/VR3_ROADMAP.md).
- [Arquitectura objetivo](docs/VR3_ARCHITECTURE.md).
- [Pruebas locales del repositorio independiente](docs/VR3_LOCAL_SETUP.md).
- [README histórico de la base VR2](docs/README_VR2_BASE.md).

**Automatizaciones:** los workflows de validación y Pages quedan manuales durante la etapa de prototipo; el workflow de releases exclusivo de VR2 no se incluye. No crear tags de versión VR2 desde esta rama.

**Repositorio independiente creado:** [Void-Rescue-III](https://github.com/raulcamaracarreon/Void-Rescue-III). La rama `feat/dual-decor-layers` parte de `feat/foreground-layers`; ambas se mantienen separadas de `main` hasta validación. El remoto `vr2-base` es sólo una referencia histórica.
