# VR3 — arquitectura objetivo (diseño, no implementación)

## Estado de partida

VR3 arranca del código de Void Rescue II: TypeScript estricto, Vite, Three.js, simulación 2D de paso fijo 60 Hz, escena 2.5D, WebGPU con WebGL2 de respaldo, pruebas Vitest y Playwright. El refactor será **incremental**.

El sistema actual usa `src/game/` para simulación y reglas, `src/render/` para la escena, `src/landscape/` para fondos y preferencias, `src/ui/` para controles y `src/audio/` para sonido. No reemplazar sus contratos hasta agregar pruebas de equivalencia.

## Separaciones futuras propuestas

- **Game Core** (sin Three.js): movimiento, físicos, entidades, daño, misiones, rescates, oleadas y puntuación. Conserva determinismo y geometría circular.
- **Perfiles jugables de vehículo:** parámetros de inercia, ascenso, armas, forma de rescate y animaciones. La nave actual es el perfil de referencia.
- **Catálogo de entidades:** geometría/modelos, animaciones, sonidos y lógica específica de amenazas. Evitar una clase monolítica por tipo.
- **World Render**: escena, cámara, capas, materiales, paralaje y oclusión. No convertir objetos decorativos en colisiones salvo opt-in explícito y probado.
- **Editor y serialización:** herramientas simples, formatos versionados, validación de entradas, guardar/cargar/exportar sin acoplar la UI al renderizador.

## Modelo conceptual de escena

```text
Escena 2.5D
├── Cielo y atmósfera
├── Fondos de paralaje (lejanos → cercanos; hasta z=-31)
├── Tercer plano decorativo opcional (z=-18, paralaje más lento)
├── Mundo jugable (vehículos z=0, terreno y personajes)
└── Primer plano decorativo opcional (z=19, paralaje más rápido)
```

Una capa visual debería definir como mínimo: `id`, `name`, `enabled`, `depthOrder`, `parallaxFactor`, `opacity`, `objects` y `schemaVersion`. Son campos propuestos, **no tipos ya codificados**. Un objeto editable podrá ser rectángulo, línea, polígono o trazo. La topología envolvente debe respetar la costura horizontal del mundo circular.

## Requisitos clave

- Mantener rendimiento estable: construir geometría cuando cambia el diseño, no por cada frame; reutilizar materiales cuando sea viable.
- Mantener legibilidad: los primeros planos pueden ocultar parte de la acción; permitir ocultarlos globalmente, regular opacidad y reservar una opción de accesibilidad.
- Identificar y preservar el estado de los mundos creados por el usuario; nunca borrar automáticamente una biblioteca por migración.
- Separar `localStorage` de VR3 del de VR2; futura exportación/importación explícita. Asegurar validación y límites de tamaño.
- Añadir pruebas de occlusion/paralaje, no colisión de decorativos, persistencia y rendimiento tras crear múltiples objetos.

## Primer contrato para el editor (propuesta)

Orden visual de controles: biblioteca → rotación de ambientes → editor de fondo → primer plano → vista previa → exportación. El editor de dibujo debe permitir alternar herramientas sin detener la simulación, pero sus modificaciones se aplicarán como cambios visuales controlados, no como mutaciones directas sobre entidades de juego.

**Dos capas decorativas ya codificadas (rama `feat/dual-decor-layers`, pendiente de pruebas):** `src/render/ForegroundDecor.ts` genera siluetas con recursos compartidos en dos instancias independientes de `WorldScene`. `LandscapeStyle.foreground` conserva el primer plano legado y `LandscapeStyle.midground` añade el tercero, con controles independientes de motivo, color, opacidad, paralaje y activación. Ambos se guardan por ambiente. Los presets antiguos heredan un tercer plano desactivado y mantienen el primer plano. El editor de dibujo libre y objetos personalizados permanece planeado para la fase 3.
