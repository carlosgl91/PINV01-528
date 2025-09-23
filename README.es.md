# Repositorio de sensores remotos del proyecto CONACYT PINV01-528

En este repositorio se organizan y describen los datos y aplicaciones generadas por el proyecto CONACYT PINV01-528 en el ámbito de sensores remotos

El mismo cuenta con los siguientes componentes:

+ **Sen2TimeSeriesARD GEE aplicaction**: Una aplicación programada dentro de la API en JavaScript de Google Earth Engine capaz de generar datos listos para su uso en procesos de análisis científicos y técnicos cómo:
  
  + Modelado de nicho Ecológico
  + Clasificaciones de uso y cobertura de la tierra
  + Análisis de series de tiempo
  + Monitoreo de la cobertura forestal
  + Análisis de impacto y recuperación de incendios
  + Análisis de líneas de base dinámicas
  + Detección y análisis de zonas inundables
  + Mapeo y monitoreo de zonas urbanas
  
La aplicación es capaz de generar 3 tipos de archivos:

   1. datos en formato *.tif* : rasters multibanda por unidad temporal, esto es por ejemplo, si  el análisis corresponde a los trimestres del año 2024, la aplicación generará 4 rasters correspondientes a Q1,Q2,Q3 y Q4 del 2024, conteniendo cada uno estadisticas temporales espacialmente explicitas (min, max, media, mediana y desviación estándar) del conjunto de datos sentinel 2 filtrados en ese periodo en el área de interés.

   2. Listado detallado de imágenes y sus características en formato *.csv*, incluyendo datos como su GEE ID, cobertura de nubes y grilla.
   3. Datos de configuración y resultados como: tipo de análisis realizado, fecha de análisis,periodo analizado, humbral de cobertura de nubes, semanas iso con imágenes encontradas, meses con imágenes, cuenta total de imágenes.

En la siguiente figura se presenta un  flujo de procesamiento de imágenes satelitales: 

![Drag Racing](DownloadApp/docs/img_es/App_workflow_528.jpg)

  

+ **Sen2TimeSeries GEE Jupyter Notebooks:** Estos son una serie de notebooks basados en la aplicación Jupyter Lab. Estos cuadernos son capaces de generar datos de sentinel 2, listos para el análisis utilizando procesamiento de nubes y sombras avanzado, de manera iterativa para cubrir grandes regiones, es decir escalas nacionales y supra nacionales en donde se hace necesario divir el área de estudio por grillas y generar los datos de manera organizada. Esta herramienta está dirigida para un público más técnico, puesto que el objetivo es el de generar datos de manera iterativa basandose en el id de los elementos de una colección de geometrias, que sirven de grilla, además de parámetros humbrales para ajustar el modelo de enmascaramiento de nubes y sombras y también el modelo de agregación espacial en caso de querer reducir la resolución de los datos.

+ **Script de procesamiento local en R:** Un script para la organización y conversión de datos generados por la aplicación Sen2TimeSeriesARD GEE.  Es script organiza los datos en una estructura de carpetas, pero de manera más resaltante es capaz de convertir los datos a formato *.ascii* de manera estructurada e iterativa, soportando de esta manera el procesamiento de regiones extensas y evitando errores de manipulación manual. 