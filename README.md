# Auditoría Interna OEA 2026 — C.I. Colombian Mint

Aplicación web para consulta del Plan de Auditoría y Matriz de Requisitos OEA Exportador.

## Cómo usar

### Opción 1: Abrir directamente (recomendado para compartir)

1. Copie la carpeta `app` completa a los equipos de los auditores/auditados.
2. Abra `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox).
3. No requiere conexión a internet después de la primera carga (Tailwind CDN se cachea).

### Opción 2: Servidor local

```powershell
cd app
python -m http.server 8080
```

Luego abra: http://localhost:8080

## Estructura de archivos

```
app/
├── index.html      # Página principal (SPA)
├── styles.css      # Estilos personalizados
├── script.js       # Lógica de la aplicación
├── data.js         # Datos embebidos (Plan + Requisitos)
└── data/
    ├── plan.json           # Plan de auditoría (fuente)
    └── requisitos.json     # Matriz de requisitos (fuente)
```

## Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Vista general con estadísticas, objetivo, riesgos y cronograma resumido |
| **Plan de Auditoría** | Cronograma completo GMC-FR07 con hallazgos ARCA 2025 |
| **Requisitos OEA** | Búsqueda global en los 71 requisitos |
| **Por Responsable** | Filtro por líder de proceso para preparación de auditados |
| **Por Capítulo** | Navegación por los 9 capítulos del Art. 4º Res. 015/2016 |

## Actualizar datos

Si se modifican los archivos Excel originales:

```powershell
python convert_data.py
python -c "import json; p=open('app/data/plan.json',encoding='utf-8').read(); r=open('app/data/requisitos.json',encoding='utf-8').read(); open('app/data.js','w',encoding='utf-8').write('const PLAN_DATA = '+p+';\nconst REQUISITOS_DATA = '+r+';\n')"
```

## Normativa de referencia

- Resolución No. 000015 del 17 de febrero de 2016 (Artículo 4º)
- RES. 002543 OEA Exportador (23/03/2023)
- Revalidación OEA 2025

## Equipo de Auditoría Interna 2026

Jimena Zuluaga · Estefania Granda · Diana Arboleda · Luis Jaime Alvarez · Luis Arango · Diego Beltrán · Juan Esteban Gómez · Albeiro Esteban · Erika Mesa · Iván Arias
