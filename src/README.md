# Publicación de Nuevas Versiones del Paquete en NPM

Este documento describe cómo publicar nuevas versiones del paquete **ms3-api** en el registro de NPM.

## Requisitos Previos

1. **Acceso a NPM**: Es necesario estar autenticado con una cuenta que tenga permisos para publicar este paquete. (Nota: utilizar el correo de ms3@changetheblock.com con la contraseña del correo)

```bash
npm login
```

2. **Node.js y NPM instalados**: Asegúrate de contar con Node.js y NPM correctamente configurados en tu entorno local.

## Pasos para Subir una Nueva Versión

### 1. Actualizar la Versión del Paquete

Antes de publicar, incrementa el número de versión en el archivo package.json. Sigue las reglas de versionado semántico:

- Mayor (1.x.x): Para cambios que rompen compatibilidad con versiones anteriores.
- Menor (x.1.x): Para agregar nuevas funcionalidades que no rompen la compatibilidad.
- Parche (x.x.1): Para correcciones de errores o mejoras menores.

Revisa el archivo `package.json` para asegurarte de que la versión ha sido actualizada correctamente.  
Ejemplo de actualización de `package.json`:

```json
{
  "name": "ms3-api",
  "version": "1.0.1",
  "main": "dist/api.js",
  "types": "dist/api.d.ts"
}
```

Si lo prefieres, puedes usar el comando proporcionado por NPM para gestionar el cambio de versión automáticamente.

```bash
npm version [major | minor | patch]
```

### 2. Compilar el Paquete

Antes de publicar, es necesario compilar el paquete para generar los archivos de distribución (`dist`). Esto asegura que el código entregado a los usuarios es funcional y está preparado para producción.

```bash
npm run build
```

Verifica que la carpeta `dist` contenga los archivos necesarios como `.js` y `.d.ts`.

### 3. Publicar en NPM

Asegúrate de que los cambios estén listos para publicarse. Usa el comando correspondiente para subir la nueva versión al registro de NPM.

```bash
npm publish
```

Una vez completado, verifica que el paquete se publicó correctamente y que la versión más reciente está disponible.

### 4. Verificar la Publicación

Es buena práctica verificar que la versión publicada se refleje correctamente en el registro de NPM. Consulta la información del paquete para confirmar.

```bash
npm view ms3-api version
```

### 5. Resolución de Problemas Comunes

- Si ves un mensaje indicando que no puedes sobrescribir una versión publicada previamente, asegúrate de que la versión en `package.json` haya sido incrementada.
- Si el registro devuelve un error de permisos, verifica que estás autenticado correctamente y tienes los privilegios necesarios.

### 6. Consideraciones Finales

- Realiza pruebas exhaustivas antes de publicar cualquier versión para evitar errores en producción.
- Mantén consistencia en las versiones y evita subir versiones incompletas o inestables.
- Revisa y actualiza las dependencias del proyecto en caso de ser necesario.

Con esta guía, tú y tu equipo pueden gestionar actualizaciones del paquete de manera eficiente y confiable.
