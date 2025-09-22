
---

## Descripción General

Esta aplicación permite a los usuarios descargar imágenes satelitales de Sentinel-2 procesadas según diferentes agregaciones temporales y filtros espaciale s. Proporciona una interfaz intuitiva para definir un área de interés (AOI), seleccionar parámetros de análisis y exportar los resultados directamente a Google Drive.

---

## Conceptos Clave

### Cómputo en la Nube

El **cómputo en la nube** se refiere a la entrega de servicios informáticos (como servidores, almacenamiento, bases de datos, redes, software, análisis y más) a través de Internet ("la nube"). Permite acceder a recursos y servicios bajo demanda sin necesidad de tener infraestructura física propia, lo que proporciona flexibilidad, escalabilidad y eficiencia en costos.

**Beneficios:**

- **Accesibilidad:** Accede a recursos desde cualquier lugar con conexión a Internet.
- **Escalabilidad:** Ajusta los recursos según las necesidades actuales.
- **Eficiencia de Costos:** Paga solo por los recursos que utilizas.

### Google Earth Engine

**Google Earth Engine** es una plataforma de cómputo en la nube diseñada para procesar y analizar grandes cantidades de datos geoespaciales. Proporciona acceso a una vasta colección de imágenes satelitales y conjuntos de datos geográficos, junto con poderosas herramientas para el análisis y visualización.

**Características:**

- **Amplia Colección de Datos:** Acceso a imágenes históricas y actuales de satélites como Landsat, Sentinel y más.
- **Procesamiento a Gran Escala:** Realiza análisis complejos sin preocuparse por la capacidad de procesamiento.
- **API Flexible:** Soporta lenguajes como JavaScript y Python para personalizar análisis.

**Uso en la Aplicación:**

La aplicación utiliza Google Earth Engine para:

- **Acceder y Filtrar Imágenes Satelitales:** Descarga imágenes de Sentinel-2 según los parámetros especificados.
- **Procesamiento de Datos:** Calcula índices espectrales y aplica filtros espaciales.
- **Exportación de Resultados:** Los datos procesados se exportan a Google Drive para su descarga.

---

## Procesamiento de Imágenes

### Filtrado de Imágenes

El primer paso en el procesamiento es la **selección y filtrado de imágenes** de la colección Sentinel-2:

- **Periodo de Tiempo:** Se filtran las imágenes que caen dentro del rango de fechas especificado por el usuario.
- **Área de Interés (AOI):** Solo se consideran las imágenes que cubren el AOI definido.
- **Cobertura de Nubes:** Se aplica un filtro para seleccionar imágenes con un porcentaje de nubes igual o inferior al valor especificado.

**Variables Importantes:**

- **Fecha de Inicio y Fin:** `startDate`, `endDate`
- **Área de Interés (AOI):** `AOI`
- **Porcentaje Máximo de Nubes:** `cloudCoverValue`

### Cálculo de Índices Espectrales

Para cada imagen filtrada, se calculan **índices espectrales** que proporcionan información adicional:

- **Bandas Espectrales Utilizadas:**

  - **B2 (Azul):** 490 nm
  - **B3 (Verde):** 560 nm
  - **B4 (Rojo):** 665 nm
  - **B5 a B7 (Borde Rojo):** 705 nm, 740 nm, 783 nm
  - **B8 (Infrarrojo Cercano - NIR):** 842 nm
  - **B8A (Borde Rojo):** 865 nm
  - **B9 (Vapor de Agua):** 945 nm
  - **B11 (Infrarrojo de Onda Corta - SWIR):** 1610 nm
  - **B12 (SWIR):** 2190 nm

- **Índices Calculados:**

  - **NDVI (Índice de Vegetación de Diferencia Normalizada):**

    $$ NDVI = \frac{NIR - RED}{NIR + RED} $$

    - **NIR:** Banda B8
    - **RED:** Banda B4

  - **NDBI (Índice de Construcción de Diferencia Normalizada):**

    $$ NDBI = \frac{SWIR - NIR}{SWIR + NIR} $$

    - **SWIR:** Banda B11
    - **NIR:** Banda B8

  - **SAVI (Índice de Vegetación Ajustado al Suelo):**

    $$ SAVI = \left( \frac{NIR - RED}{NIR + RED + L} \right) \times (1 + L) $$

    - **L:** Factor de corrección de suelo (usualmente 0.5)
    - **NIR:** Banda B8
    - **RED:** Banda B4

  - **NDWI (Índice de Agua de Diferencia Normalizada):**

    $$ NDWI = \frac{GREEN - NIR}{GREEN + NIR} $$

    - **GREEN:** Banda B3
    - **NIR:** Banda B8

### Recuento de Variables

Tras el cálculo de los índices, el número de variables aumenta:

- **Bandas Originales:** 11
- **Tras Cálculo de Índices:** 15

Luego, durante la **agregación temporal**, se calculan estadísticas para cada banda.

- **Estadísticas Calculadas:**
  - **Media**
  - **Mediana**
  - **Mínimo**
  - **Máximo**
  - **Desviación Estándar**

**Cálculo del Número Total de Variables:**

- **Por Cada Banda:** Se generan 5 estadísticas.
- **Total de Variables Tras Agregación Temporal:**

  $$ 15 \text{ bandas} \times 5 \text{ estadísticas} = 75 \text{ bandas} $$

Si se aplican **filtros espaciales**, se generan conjuntos adicionales de bandas para cada tipo de filtro seleccionado.

- **Filtros Espaciales Posibles:**
  - **Media**
  - **Mediana**
  - **Mayoría**

**Si se Aplican Todos los Filtros Espaciales:**

- **Conjunto Original:** 75 bandas
- **Conjuntos Filtrados:** 75 bandas por cada filtro aplicado
- **Total Potencial de Bandas:**

  $$ 75 \text{ bandas (original)} + (75 \text{ bandas} \times \text{número de filtros}) $$

  Por ejemplo, si se aplican los tres filtros:

  $$ 75 + (75 \times 3) = 75 + 225 = 300 \text{ bandas} $$

### Agregación Temporal

Dependiendo del tipo de análisis seleccionado, las imágenes se agrupan y se **reducen** temporalmente:

- **Semanas ISO:**
  - Las imágenes se agrupan por número de semana ISO.
  - Para cada semana, se calculan las estadísticas mencionadas, generando un conjunto de 75 bandas por semana.
- **Trimestral:**
  - Las imágenes se agrupan por trimestre.
  - Se generan 75 bandas por trimestre.
- **Periodo Completo:**
  - Se considera todo el periodo como un solo grupo.
  - Se generan 75 bandas para el periodo completo.

### Aplicación de Filtros Espaciales

Después de la agregación temporal, se pueden aplicar **filtros espaciales** para suavizar y mejorar la calidad de las imágenes:

- **Tipos de Filtros:**
  - **Filtro de Media**
  - **Filtro de Mediana**
  - **Filtro de Mayoría**

**Efecto en el Número de Variables:**

- Por cada filtro aplicado, se genera un nuevo conjunto de bandas filtradas (75 bandas por conjunto).
- Si se aplican múltiples filtros, el número de bandas aumenta proporcionalmente.

---

## Guía de Uso

### 1. Definir el Área de Interés (AOI)

Puedes especificar tu AOI de dos maneras:

- **A. Dibujar en el mapa:**

  1. Marca la casilla **"Dibujar en el mapa"**.
  2. Utiliza las herramientas de dibujo en el mapa para trazar un polígono que represente tu área de interés.
  3. **Nota:** Asegúrate de que el área no exceda las **250,000 hectáreas**.

- **B. Especificar ID de asset:**

  1. Marca la casilla **"Especificar ID de asset"**.
  2. Ingresa el ID del asset en el campo de texto proporcionado.
     - Valor predeterminado:  
       `projects/ee-pinv01-528-senepa-fpun/assets/topadengue/tpd_area`

**Cargar límites:**

- Después de definir tu AOI, haz clic en el botón **"Cargar límites"**.
- La aplicación validará el área y mostrará un mensaje:
  - Si el área excede las 250,000 hectáreas, se mostrará un mensaje de error.
  - Si el área es válida, se visualizará en el mapa en color rojo y el mapa se centrará en el AOI.

### 2. Establecer Parámetros del Análisis

- **Fecha de inicio del periodo:**

  - Ingresa la fecha de inicio en el formato **`aaaa-mm-dd`**.  
    _Ejemplo:_ `2021-01-01`

- **Fecha de fin del periodo:**

  - Ingresa la fecha de fin en el formato **`aaaa-mm-dd`**.  
    _Ejemplo:_ `2021-06-30`

- **Porcentaje máximo de nubes:**

  - Ajusta el deslizador para establecer el porcentaje máximo de cobertura de nubes (0% a 100%).

- **Tipo de análisis:**

  - Selecciona el tipo de agregación temporal en el menú desplegable:
    - **Trimestral:** El análisis se realizará por trimestres.
    - **Semanas ISO:** El análisis se realizará por semanas ISO.
    - **Periodo Completo:** El análisis abarcará todo el periodo especificado.

### 3. Aplicar Filtros Espaciales (Opcional)

Puedes aplicar filtros espaciales para mejorar la calidad de las imágenes:

- Marca las casillas correspondientes para aplicar los filtros deseados:
  - **Aplicar media**
  - **Aplicar mediana**
  - **Aplicar mayoría**

- **Tamaño del filtro:**

  - Ajusta el deslizador para establecer el tamaño del filtro.  
    _Valores impares entre **3** y **10**._

### 4. Generar el Análisis

- Haz clic en el botón **"Generar"** para iniciar el análisis.
- La aplicación procesará las imágenes según los parámetros especificados.
- Los mensajes de progreso o errores aparecerán en el panel **"Mensajes del sistema"**.
- **Nota:** Si no se encuentran imágenes, intenta ajustar las fechas o el porcentaje máximo de nubes.

### 5. Descargar las Imágenes

- Una vez completado el análisis, haz clic en el botón **"Descargar"** para exportar las imágenes a tu Google Drive.
- Las imágenes se guardarán en una carpeta llamada **"PINV01_Exports"**.
- La aplicación notificará cuando el proceso de descarga haya comenzado.
- **Importante:** Verifica tu Google Drive para acceder a los archivos exportados.

---
