# Void Rescue III — pruebas locales (repositorio propio)

Void Rescue III reside en el repositorio [raulcamaracarreon/Void-Rescue-III](https://github.com/raulcamaracarreon/Void-Rescue-III). VR2 permanece independiente.

## Carpeta local del proyecto

`E:\Proyectos\JUEGOS\VoidRescue-III`

La rama `main` es la base que el usuario comprobó con 16 pruebas Playwright aprobadas. Las mejoras nuevas se preparan en ramas específicas y se validan antes de fusionar. El antiguo remoto `vr2-base` es sólo referencia histórica; **no subir VR3 a VR2**.

## Probar la rama del primer plano

En PowerShell, cerrar antes cualquier servidor Vite en esa carpeta con Ctrl+C. Comprobar que no existan cambios versionados pendientes:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git status --short --branch
git fetch origin
git switch --track origin/feat/foreground-layers
npm ci
npm run build
npm run test
npx playwright test tests/e2e/landscape.spec.ts tests/e2e/foreground.spec.ts
npm run dev
```

En caso de que la rama local ya exista, usar `git switch feat/foreground-layers` en lugar del comando con `--track`. No borrar capturas locales `docs/screenshots/*.png`; son archivos no versionados generados por Playwright.

Abre `http://127.0.0.1:5173/`; entra en Personalizar paisaje → Primer plano. En un paisaje de la serie, activar árboles crea un borrador personalizado (no altera el preset); para conservarlo con nombre, pulsa Guardar nuevo. Prueba árboles, cercas, rejas, opacidad, paralaje, desplazamiento por el mundo y recarga. Revisa también la variante `?backend=webgl2`.

No anunciar pruebas aprobadas hasta ejecutar realmente estos comandos. Si falla alguna, conservar la salida completa.

## Publicación

La rama de primer plano no se fusiona a `main` ni se despliega automáticamente. Pages y el pipeline CI continúan manuales hasta autorización expresa del usuario.
