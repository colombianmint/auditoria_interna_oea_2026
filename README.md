# Auditoría Interna OEA 2026 — C.I. Colombian Mint

Aplicación web para gestión de la Auditoría Interna OEA Exportador — Fase 2.

## Cómo usar

### Servidor local (recomendado)

```powershell
cd app
python -m http.server 8080
```

Abra: http://localhost:8080

### Acceso

| Campo | Valor |
|-------|-------|
| Usuario | Correo electrónico, cédula o nombre de usuario asignado |
| Contraseña | Asignada por el administrador o últimos 4 dígitos de cédula (primer ingreso) |

En el **primer ingreso** (y tras restablecer contraseña temporal), el sistema exige cambiar la contraseña.

La cuenta de emergencia del administrador de sistema está configurada en `data/usuarios.json` (no visible en la interfaz ni en el código fuente).

## Estructura de archivos

```
app/
├── index.html          # SPA con login
├── styles.css          # Estilos
├── script.js           # Lógica principal
├── auth.js             # Autenticación y roles
├── storage.js          # Persistencia localStorage
├── admin.js            # Módulos administrador
├── data.js             # Datos embebidos
├── data/
│   ├── plan.json
│   ├── requisitos.json
│   ├── usuarios.json
│   ├── preguntas.json
│   └── listados.json
└── listados/
    └── GMC-FR08_Sesion_01..10.xlsx
```

## Módulos por rol

| Módulo | Admin | Auditor Interno | Auditado |
|--------|:-----:|:---------------:|:--------:|
| Dashboard | ✓ | ✓ | ✓ |
| Plan de Auditoría | ✓ | ✓ | ✓ |
| Requisitos OEA | ✓ | ✓ | ✓ (solo asignados) |
| Por Responsable | ✓ | ✓ | ✓ (solo propios) |
| Por Capítulo | ✓ | ✓ | ✓ |
| Banco de Preguntas | ✓ | ✓ | — |
| Listados Verificación | ✓ | ✓ | — |
| Gestión Usuarios | ✓ | — | — |
| Editar Plan | ✓ | — | — |
| Editar Requisitos | ✓ | — | — |

## Regenerar datos desde Excel

```powershell
python generate_phase2.py
```

Regenera: requisitos (con info DIAN), 710 preguntas, 10 listados GMC-FR08 y `data.js`.

## Normativa

- Resolución No. 000015/2016 — Artículo 4º (requisitos 1.1 a 9.4)
- RES. 002543 OEA Exportador
- Revalidación DIAN 2025
