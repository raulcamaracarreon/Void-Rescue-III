# AGENTS.md — instrucciones de desarrollo de VOID RESCUE III

## Identidad y alcance vigente

Este árbol es el **prototipo VR3 v0.1.0**, inicialmente preparado desde Void Rescue II. La aplicación anterior se conserva intacta en el repositorio/ramas de su lanzamiento. VR3 todavía no está publicado. El editor de rotación, dos capas decorativas y editor Paint fueron probados localmente; el usuario aceptó visualmente el editor de figuras el 26/10/2026. Aún falta completar la fase 3 (selección/transformación y exportación).

Prioridad para los agentes que trabajen en la rama/proyecto VR3:

1. Instrucciones explícitas más recientes del usuario.
2. Este `AGENTS.md`.
3. `docs/VR3_ROADMAP.md` y `docs/VR3_ARCHITECTURE.md`.
4. Criterios de aceptación y documentación técnica de la base VR2 cuando no contradigan los puntos anteriores.

Antes de programar, examinar archivos reales y pruebas. No asumir nombres, tipos o rutas. Cambios pequeños, comprobables y localizados. Actualizar documentación después de modificar comportamiento.

## Metas aprobadas

- Partir de la lógica de combate, rescate, simulación, colisiones, controles, cámara y oleadas existente en VR2.
- Mejorar la experiencia de rotación de ambientes: disposición vertical en columnas, selección rápida de posición, arrastre y accesibilidad.
- Diseñar capas visuales opcionales de primer plano (rejas, cercas, árboles, siluetas y otras); permitir oclusión visual sin convertirlas automáticamente en colisiones.
- Desarrollar gradualmente herramientas de dibujo y configuraciones exportables. El incremento Paint implementa panorama nuevo 2048×256, formatos antiguos 96×32 a 384×128, relleno de figuras, círculo, triángulo, polígonos, zoom y pincel configurable. Playwright: 10/10 E2E del editor y 2/2 pruebas focalizadas de círculo/triángulo aprobadas en ambos backends; el usuario confirmó funcionamiento manual. La selección rectangular de la Entrega A y las herramientas de manipulación de la Entrega B fueron **aceptadas visualmente por el usuario el 26/10/2026**, tras resolver la mezcla de duplicados con tinta original mediante copia flotante en `feat/phase3-selection-tools`. La suite general **20/20 E2E** aprobada es anterior al último parche; **después del parche** el usuario aportó build aprobado, **16/16** unitarias específicas y **8/8** E2E focalizadas en ambos backends. La fusión de `feat/phase3-selection-tools` a `main` fue autorizada expresamente por el usuario. Quedan escala/transformación avanzada y exportación/importación JSON. **Fase 4 iniciada (27/10/2026)** en `feat/phase4-vehicle-profiles`: contrato `VehicleProfile` y simulación paramétrica, conservando la nave como predeterminada. El primer incremento de perfiles quedó validado: build, 15/15 núcleo, 12/12 E2E de vuelo, y prueba corregida 1/1. Un segundo incremento en la rama introduce `models/Helicopter.ts`, rotores animados y alternancia visual por `vehicleId` en `Renderer.ts`, habilitada **solo por diagnóstico DEV**, sin selector de jugador ni rescate específico. El primer modelo se validó visualmente y fue rechazado por aspecto de juguete, lentitud y suelo demasiado alto. Se rediseñó como helicóptero utilitario angular tipo Black Hawk, con ruedas y escala 1.18×, se aumentó la velocidad máxima experimental a 90 y se permite suelo cercano a terreno +3.8 en reconocimiento/combate. **Este rediseño todavía no ha pasado las nuevas pruebas locales** (10 unitarias y 6 E2E previstas). La animación original del helicóptero quedó aceptada visualmente después de invertir solamente el signo vertical en `Renderer.ts`; **no reemplazar sus ejes ni amplitud**. Se añadió audio experimental específico en `src/audio/HelicopterSound.ts` (ruido de rotor pulsado + turbina), conmutado desde `AudioEngine.update(..., vehicleId)` y habilitado por demanda. El sonido propio del helicóptero fue **aceptado auditivamente por el usuario**, aunque faltan pruebas automáticas documentadas del audio. Después pidió reducir proporción respecto a la nave: escala `HELICOPTER_GAME_SCALE=0.56` (antes 1.18) y separación al terreno de 2.0 (antes 3.8). **No cambiar animación ni sonido aprobados.** Quedan pendientes build, 11 unitarias, 8 E2E y aprobación visual de la nueva escala. No declarar helicóptero listo ni fase 4 completada; la nave clásica continúa intacta. No declarar completa la fase 3.
- Agregar perfiles de vehículo (inicialmente helicóptero, después otros) y familias nuevas de enemigos (helicópteros, drones, aviones, defensas), pero no declarar que existen antes de implementarlos y probarlos.

## Arquitectura conservada

- TypeScript estricto, Vite, Three.js y renderer WebGPU con respaldo WebGL2.
- Separar estado del juego y simulación 2D del renderizado 2.5D.
- Paso de simulación fijo; mantener determinismo por semilla; mundo circular con costura limpia.
- No reescribir de golpe los módulos existentes ni duplicar todo el combate para cambiar un modelo gráfico.
- Preferir contratos explícitos y variantes configurables; sin servicios externos ni cuentas salvo pedido específico.
- No añadir dependencias salvo necesidad demostrada.
- Mantener interacción de teclado/gamepad, teclado accesible para listas, reducción de movimiento y opciones de legibilidad para oclusión.
- Evitar XSS mediante inserción segura de nombres, validar JSON/importaciones y preservar los mundos del usuario.

## Aislamiento de producto

- Nunca apuntar VR3 a la URL de Pages de VR2 ni etiquetar releases como v1.0.5.
- Usar almacenamiento de VR3, sin migración automática destructiva desde VR2.
- Mantener los workflows de VR3 **manuales** mientras no se autorice publicación.
- No fusionar `feat/void-rescue-iii-bootstrap` dentro de la rama `main` de VR2. Su destino es un **repositorio nuevo Void-Rescue-III**.
- Conservar licencia MIT y avisos de terceros pertinentes.

## Verificación requerida

1. `npm run build` (incluye TypeScript).
2. `npm run test` (Vitest).
3. `npx playwright test tests/e2e/landscape.spec.ts`.
4. Suites adicionales de rescate, oleadas, mandos y backend cuando se cambie jugabilidad.
5. Prueba visual real de lista de ambientes, persistencia, orden, drag-and-drop, pantallas reducidas, y luego editor/capas cuando existan.
6. Documentar resultados y pendientes sin inventar pruebas aprobadas.

El esquema completo de fases y límites está en `docs/VR3_ROADMAP.md`. Los artefactos VR2 previos son referencias, no prueba de que las funciones planeadas en VR3 ya existan.
