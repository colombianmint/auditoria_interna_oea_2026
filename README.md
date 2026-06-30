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
| Usuario | Correo electrónico o cédula |
| Contraseña | Últimos 4 dígitos de la cédula |
| Super Admin (emergencia) | Usuario: `123456789` / Contraseña: `123456789` |

Usuarios con doble rol (Auditor Interno + Auditado) seleccionan el rol al ingresar.

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
