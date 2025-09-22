# Repositorio de sensores remotos del proyecto CONACYT PINV01-528

En este repositorio se organizan y describen los datos y aplicaciones generadas por el proyecto CONACYT PINV01-528

El mismo cuenta con los siguientes componentes:

+ Sen2TimeSeriesARD GEE aplicaction: Una aplicación programada dentro de la API en JavaScript de Google Earth Engine capaz de generar datos listos para su uso en procesos de análisis científicos y técnicos cómo:
  
  + Modelado de nicho Ecológico
  + Clasificaciones de uso y cobertura de la tierra
  + Análisis de series de tiempo
  + Monitoreo de la cobertura forestal
  + Análisis de impacto y recuperación de incendios
  + Análisis de líneas de base dinámicas
  + Detección y análisis de zonas inundables
  + Mapeo y monitoreo de zonas urbanas
  
+ Sen2TimeSeries GEE Jupyter Notebooks: Estos son una serie de notebooks basados en la aplicación Jupyter Lab que usa como base el lenguaje de programación Python. Estos cuadernos son capaces de generar datos de sentinel 2, listos para el análisis utilizando procesamiento de nubes y sombras avanzado, de manera iterativa para cubrir grandes regiones, es decir escalas nacionales y supra nacionales en donde se hace necesario divir el área de estudio por grillas y generar los datos de manera organizada. Esta herramienta está dirigida para un público más técnico, puesto que el objetivo es el de generar datos de manera iterativa basandose en el id de los elementos de una colección de geometrias, que sirven de grilla, además de parámetros humbrales para ajustar el modelo de enmascaramiento de nubes y sombras y también el modelo de agregación espacial en caso de querer reducir la resolución de los datos. 