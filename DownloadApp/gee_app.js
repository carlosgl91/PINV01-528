// Aplicación para descarga de imágenes
// Autor: Ing. Amb. Carlos Giménez
//* Checkpoint: 29-09-2024

ui.root.clear();

var tools = require('users/charlieswall/functions_cg:appTools');

var currentDatea = new Date().toISOString().slice(0, 10);

var App = {
  aoi: null,
  aoi_drawn: null, // Store the drawn AOI
  selectedTimeAggregation: null, // To store the selected aggregation type
  filterOptions: {
    mean: false,
    median: false,
    majority: false,
    filterSize: 3 // Default filter size is 3x3
  },

  init: function () {
    // Calls the UI initialization
    this.ui.init();
  },

  countIsoWeeks : function(startDate, endDate, imageCollection) {
    // Parse the date range
    var start = ee.Date(startDate);
    var end = ee.Date(endDate);
  
    // Calculate the total number of ISO weeks in the date range
    var totalWeeks = end.difference(start, 'week').floor();
    
    // Generate a list of all ISO weeks in the range
    var allIsoWeeks = ee.List.sequence(0, totalWeeks).map(function(weekOffset) {
      var weekDate = start.advance(weekOffset, 'week');
      return App.getIsoWeek(weekDate);
    }).distinct(); // Ensure unique ISO weeks
    
    // Get the ISO weeks with data from the image collection
    var isoWeeksWithData = imageCollection.aggregate_array('iso_week').distinct().sort();
  
    // Find missing ISO weeks (i.e., weeks that have no data)
    var missingIsoWeeks = allIsoWeeks.removeAll(isoWeeksWithData);
  
    // Count the number of missing ISO weeks
    var missingWeeksCount = missingIsoWeeks.length();
  
    // Print the total number of weeks, missing weeks, and count of missing weeks
    print('Total ISO weeks in range:', allIsoWeeks.length());
    print('ISO weeks with data:', isoWeeksWithData);
    print('Missing ISO weeks:', missingIsoWeeks);
    print('Total number of missing ISO weeks:', missingWeeksCount);
  },

 exportModule: {
  // Function to export composite images (mean, median, etc.) for each quarter
 exportCompositeImages: function(compositeCollection, descriptionPrefix, suffix, region) {
  var imageList = compositeCollection.toList(compositeCollection.size());
  var n = compositeCollection.size().getInfo();

  for (var i = 0; i < n; i++) {
    var image = ee.Image(imageList.get(i));

    // Get properties
    var startDateStr = image.get('start_date').getInfo();
    var endDateStr = image.get('end_date').getInfo();
    var year = ee.Date(startDateStr).get('year').getInfo();

    var filename;
    if (App.selectedTimeAggregation === 'Trimestral') {
      var quarter = image.get('quarter').getInfo();
      filename = descriptionPrefix + '_Q' + quarter + '_Year_' + year + suffix;
    } else if (App.selectedTimeAggregation === 'Semanas ISO') {
      var isoWeek = image.get('iso_week').getInfo();
      filename = descriptionPrefix + '_Week' + isoWeek + '_Year_' + year + suffix;
    } else if (App.selectedTimeAggregation === 'Periodo Completo') {
      filename = descriptionPrefix + '_' + startDateStr + '_to_' + endDateStr + suffix;
    } else {
      filename = descriptionPrefix + '_Year_' + year + suffix;
    }

    // Set up export
    Export.image.toDrive({
      image: image.clip(region).setDefaultProjection('EPSG:4326', null, 10),
      description: filename,
      fileNamePrefix: filename,
      folder:"PINV01_Exports",
      region: region,
      scale: 10,
      maxPixels: 1e13
    });
  }
},

  exportSpatiallyFilteredImages: function(filteredCollections, descriptionPrefix, suffix, region) {
  Object.keys(filteredCollections).forEach(function(filterType) {
    var collection = filteredCollections[filterType];
    var imageList = collection.toList(collection.size());
    var n = collection.size().getInfo();

    for (var i = 0; i < n; i++) {
      var image = ee.Image(imageList.get(i));

      // Get properties
      var startDateStr = image.get('start_date').getInfo();
      var year = ee.Date(startDateStr).get('year').getInfo();

      var filename;
      if (App.selectedTimeAggregation === 'Trimestral') {
        var quarter = image.get('quarter').getInfo();
        filename = descriptionPrefix + '_Q' + quarter + '_Year_' + year + '_spf_' + filterType + suffix;
      } else if (App.selectedTimeAggregation === 'Semanas ISO') {
        var isoWeek = image.get('iso_week').getInfo();
        filename = descriptionPrefix + '_Week' + isoWeek + '_Year_' + year + '_spf_' + filterType + suffix;
      } else {
        filename = descriptionPrefix + '_Year_' + year + '_spf_' + filterType + suffix;
      }

      // Set up export
      Export.image.toDrive({
        image: image.clip(region),
        description: filename,
        fileNamePrefix: filename,
        folder:"PINV01_Exports",
        region: region,
        scale: 10,
        maxPixels: 1e13
      });
    }
  });
},

  // Unified function to call export for reduced and filtered images
  exportAll: function(reducedCollection, filteredCollections, region) {
    var descriptionPrefix;
    if (App.selectedTimeAggregation === 'Semanas ISO') {
        descriptionPrefix = 'Weekly';
    } else if (App.selectedTimeAggregation === 'Trimestral') {
        descriptionPrefix = 'Quarterly';
    } else if (App.selectedTimeAggregation === 'Periodo Completo') {
        descriptionPrefix = 'Period';
    } else {
        descriptionPrefix = 'Unknown';
    }
  
    // Export the reduced collection
    App.exportModule.exportCompositeImages(reducedCollection, descriptionPrefix, '', region);
  
    // Export spatially filtered collections if any
    if (Object.keys(filteredCollections).length > 0) {
      App.exportModule.exportSpatiallyFilteredImages(filteredCollections, descriptionPrefix, '_Filtered', region);
    }
  
    App.ui.forms.updateMessage("Export process started. Check your Google Drive.", false);
  }

},

  checkAreaAndDisplayMessage: function (aoi) {
    var areaHectares = aoi.geometry().area().divide(10000); // Convert m² to hectares

    areaHectares.evaluate(function (area) {
      if (area > 250000) {
        App.ui.forms.updateMessage('Error: El área excede los 250,000 hectáreas. Área actual: ' + area.toFixed(2) + ' ha', true);
      } else {
        App.ui.forms.updateMessage('Área cargada exitosamente. Área total: ' + area.toFixed(2) + ' ha', false);
        App.ui.forms.mainPanel_Map.addLayer(aoi, { color: 'FF0000' }, "AOI", true, 0.5);
        App.ui.forms.mainPanel_Map.centerObject(aoi);
      }
    });
  },

  getIsoWeek: function (date) {
    var jan4 = ee.Date.fromYMD(date.get('year'), 1, 4); 
    var weekOffset = jan4.getRelative('week', 'year'); 
    var isoWeek = ee.Number(date.getRelative('week', 'year')).subtract(weekOffset).add(1);
    return isoWeek;
  },

  getQuarter: function (date) {
    var month = date.get('month');
    return ee.Number(month).divide(3).ceil();
  },

  validateDateRange: function (startDate, endDate, analysisType) {
  var start = ee.Date(startDate);
  var end = ee.Date(endDate);
  var diffMonths = end.difference(start, 'month');
  var diffWeeks = end.difference(start, 'week');

  if (analysisType === 'Trimestral') {
    return diffMonths.gte(3);  
  } else if (analysisType === 'Semanas ISO') {
    return diffWeeks.gte(1);  
  } else if (analysisType === 'Periodo Completo') {
    return ee.Number(1);  // Always valid
  } else {
    return ee.Number(0);  // Invalid
  }
},

  addIndices: function (image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI').toFloat();
  var ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI').toFloat();
  var savi = image.expression(
    '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
      'NIR': image.select('B8'),
      'RED': image.select('B4'),
      'L': 0.5
    }
  ).rename('SAVI').toFloat();
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI').toFloat();

  return image.addBands(ndvi)
              .addBands(ndbi)
              .addBands(savi)
              .addBands(ndwi);
},

  addQuarterAndIsoWeek: function (image) {
    var date = image.date();
    var quarter = App.getQuarter(date);
    var isoWeek = App.getIsoWeek(date);
    
    return image.set('quarter', quarter)
              .set('iso_week', isoWeek)
              .copyProperties(image, image.propertyNames());
  },

  applySpatialFilter: function (collection, filterType) {
    var filterSize = App.filterOptions.filterSize;

    if (filterType === 'mean') {
      return collection.map(function (image) {
        return image.focal_mean(filterSize, 'square', 'pixels').copyProperties(image);
      });
    } else if (filterType === 'median') {
      return collection.map(function (image) {
        return image.focal_median(filterSize, 'square', 'pixels').copyProperties(image);
      });
    } else if (filterType === 'majority') {
      return collection.map(function (image) {
        return image.focal_mode(filterSize, 'square', 'pixels').copyProperties(image);
      });
    }
  },

  getQuarterlyStatistics: function (quarter, collection) {
  var quarterCollection = collection.filter(ee.Filter.eq('quarter', quarter));
  var imageCount = quarterCollection.size();
  var startDate = ee.Date(quarterCollection.first().get('system:time_start'));
  var endDate = ee.Date(quarterCollection.sort('system:time_start', false).first().get('system:time_start'));

  var meanImage = quarterCollection.mean()
    .toFloat()
    .rename(quarterCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_mean');
    }));

  var medianImage = quarterCollection.median()
    .toFloat()
    .rename(quarterCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_median');
    }));

  var minImage = quarterCollection.min()
    .toFloat()
    .rename(quarterCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_min');
    }));

  var maxImage = quarterCollection.max()
    .toFloat()
    .rename(quarterCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_max');
    }));

  var stdDevImage = quarterCollection.reduce(ee.Reducer.stdDev())
    .toFloat()
    .rename(quarterCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_stdDev');
    }));

  var combinedImage = meanImage.addBands(medianImage)
                              .addBands(minImage)
                              .addBands(maxImage)
                              .addBands(stdDevImage)
                              .set('quarter', quarter)
                              .set('start_date', startDate.format('YYYY-MM-dd'))
                              .set('end_date', endDate.format('YYYY-MM-dd'))
                              .set('image_count', imageCount)
                              .set('system:time_start', startDate.millis());

  return combinedImage;
},


  getWeeklyStatistics: function (isoWeek, collection) {
  var weekCollection = collection.filter(ee.Filter.eq('iso_week', isoWeek));
  var imageCount = weekCollection.size();
  var startDate = ee.Date(weekCollection.first().get('system:time_start'));
  var endDate = ee.Date(weekCollection.sort('system:time_start', false).first().get('system:time_start'));

  var meanImage = weekCollection.mean()
    .toFloat()
    .rename(weekCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_mean');
    }));

  var medianImage = weekCollection.median()
    .toFloat()
    .rename(weekCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_median');
    }));

  var minImage = weekCollection.min()
    .toFloat()
    .rename(weekCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_min');
    }));

  var maxImage = weekCollection.max()
    .toFloat()
    .rename(weekCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_max');
    }));

  var stdDevImage = weekCollection.reduce(ee.Reducer.stdDev())
    .toFloat()
    .rename(weekCollection.first().bandNames().map(function (band) {
      return ee.String(band).cat('_stdDev');
    }));

  var combinedImage = meanImage.addBands(medianImage)
                              .addBands(minImage)
                              .addBands(maxImage)
                              .addBands(stdDevImage)
                              .set('iso_week', isoWeek)
                              .set('start_date', startDate.format('YYYY-MM-dd'))
                              .set('end_date', endDate.format('YYYY-MM-dd'))
                              .set('image_count', imageCount)
                              .set('system:time_start', startDate.millis());

  return combinedImage;
},

  applyTimeAnalysis: function (imageCollection) {
  var filteredCollections = {}; 

  if (App.selectedTimeAggregation === 'Trimestral') {
    // Existing code for Trimestral
  } else if (App.selectedTimeAggregation === 'Semanas ISO') {
    // Existing code for Semanas ISO
  } else if (App.selectedTimeAggregation === 'Periodo Completo') {
    // Code for Periodo Completo

    // Apply indices to the images
    var periodCollection = imageCollection.map(App.addIndices);

    var imageCount = periodCollection.size();
    var startDate = ee.Date(periodCollection.first().get('system:time_start'));
    var endDate = ee.Date(periodCollection.sort('system:time_start', false).first().get('system:time_start'));

    // **Collect image metadata**
    var imageMetadata = periodCollection.map(function(image) {
      return ee.Feature(null, {
        'image_id': image.id(),
        'system_start_time': image.get('system:time_start'),
        'cloud_coverage': image.get('CLOUDY_PIXEL_PERCENTAGE'),
        'provider': image.get('SATELLITE'),
        'collection': image.get('SENSOR')
      });
    });

    // **Export image metadata as CSV**
    Export.table.toDrive({
      collection: imageMetadata,
      description: 'PeriodoCompleto_ImageList',
      fileFormat: 'CSV',
      folder: 'PINV01_Exports'
    });

    // Proceed with existing statistics computation
    var meanImage = periodCollection.mean()
        .toFloat()
        .rename(periodCollection.first().bandNames().map(function (band) {
          return ee.String(band).cat('_mean');
        }));

    var medianImage = periodCollection.median()
        .toFloat()
        .rename(periodCollection.first().bandNames().map(function (band) {
          return ee.String(band).cat('_median');
        }));

    var minImage = periodCollection.min()
        .toFloat()
        .rename(periodCollection.first().bandNames().map(function (band) {
          return ee.String(band).cat('_min');
        }));

    var maxImage = periodCollection.max()
        .toFloat()
        .rename(periodCollection.first().bandNames().map(function (band) {
          return ee.String(band).cat('_max');
        }));

    var stdDevImage = periodCollection.reduce(ee.Reducer.stdDev())
        .toFloat()
        .rename(periodCollection.first().bandNames().map(function (band) {
          return ee.String(band).cat('_stdDev');
        }));

    var combinedImage = meanImage.addBands(medianImage)
                                .addBands(minImage)
                                .addBands(maxImage)
                                .addBands(stdDevImage)
                                .set('start_date', startDate.format('YYYY-MM-dd'))
                                .set('end_date', endDate.format('YYYY-MM-dd'))
                                .set('image_count', imageCount)
                                .set('system:time_start', startDate.millis());

    var periodStatsCollection = ee.ImageCollection([combinedImage]);

    // Apply spatial filters if any
    if (App.filterOptions.mean) {
        filteredCollections.mean = App.applySpatialFilter(periodStatsCollection, 'mean');
        print('Colección filtrada (Media):', filteredCollections.mean);
    }
    if (App.filterOptions.median) {
        filteredCollections.median = App.applySpatialFilter(periodStatsCollection, 'median');
        print('Colección filtrada (Mediana):', filteredCollections.median);
    }
    if (App.filterOptions.majority) {
        filteredCollections.majority = App.applySpatialFilter(periodStatsCollection, 'majority');
        print('Colección filtrada (Mayoría):', filteredCollections.majority);
    }

    print('Colección de estadísticas del periodo completo:', periodStatsCollection);

  } else {
    App.ui.forms.updateMessage('Por favor, seleccione un tipo de análisis válido.', true);
  }
},

  ui: {
    init: function () {
      this.forms.init();
    },
    clear: function () {
      Map.clear();
    },
    forms: {
      init: function () {
        this.subpanel_AOI.add(this.cBox_draw);
        this.subpanel_AOI.add(this.cBox_AssetId);
        this.subpanel_Parameters.add(this.label_aoi);
        this.subpanel_Parameters.add(this.subpanel_AOI);
        this.subpanel_Parameters.add(this.label_propertyID);
        this.subpanel_Parameters.add(this.textBox_propertyAssetID);
        this.subpanel_Parameters.add(this.button_uploadBoundary);
        this.messagePanel.add(this.messageLabel);
        this.controlPanel.add(this.label_ToolTitle);
        this.controlPanel.add(this.subpanel_Parameters);
        this.controlPanel.add(this.label_Period_start);
        this.controlPanel.add(this.textBox_Period_start);
        this.controlPanel.add(this.label_Period_end);
        this.controlPanel.add(this.textBox_Period_end);
        this.controlPanel.add(this.label_cloudCover);
        this.controlPanel.add(this.slider_cloudCover);
        this.controlPanel.add(this.label_timeAggregation);
        this.controlPanel.add(this.select_timeAggregation);
        this.controlPanel.add(this.label_spatialFilters);
        this.controlPanel.add(this.checkbox_mean);
        this.controlPanel.add(this.checkbox_median);
        this.controlPanel.add(this.checkbox_majority);
        this.controlPanel.add(this.slider_filterSize);
        this.controlPanel.add(this.button_generate);
        this.controlPanel.add(this.button_download);
        this.mainPanel_Map.add(this.messagePanel);
        ui.root.add(this.mainPanel_Map);
        ui.root.add(this.controlPanel);
      },
      controlPanel: ui.Panel({
        style: {
          position: 'top-right',
          width: '350px',
          backgroundColor: '#bddfe9'
        }
      }),
      mainPanel_Map: ui.Map({
        style: {
          position: 'top-left'
        }
      }),
      messagePanel: ui.Panel({
        style: {
          height: '200px',
          width: '300px',
          padding: '8px',
          position: 'bottom-left',
          backgroundColor: 'rgba(255, 255, 255, 0.6)'
        }
      }),
      messageLabel: ui.Label({
        value: 'Mensajes del sistema',
        style: { color: 'black' }
      }),
      updateMessage: function (message, isError) {
        var color = isError ? 'red' : 'green';
        App.ui.forms.messageLabel.setValue(message);
        App.ui.forms.messageLabel.style().set({ color: color });
      },
      label_ToolTitle: ui.Label({
        value: 'Aplicación de descarga - PNV01-528',
        style: { fontSize: '28px', color: '#DF9D6B' }
      }),
      label_aoi: ui.Label({
        value: 'Área de interés',
        style: { fontSize: '15px', fontWeight: 'bold' }
      }),
      subpanel_Parameters: ui.Panel({
        layout: ui.Panel.Layout.flow('vertical'),
        style: { stretch: 'vertical', width: '350px', backgroundColor: '#49d289' }
      }),
      subpanel_AOI: ui.Panel({
        layout: ui.Panel.Layout.flow('horizontal'),
        style: { height: '50px' }
      }),
      cBox_draw: ui.Checkbox({
        label: 'Dibujar en el mapa',
        value: false,
        onChange: function () {
          App.ui.forms.cBox_AssetId.setValue(false);
          if (App.ui.forms.cBox_draw.getValue()) {
            App.ui.forms.mainPanel_Map.drawingTools().setShown(true);
            App.ui.forms.mainPanel_Map.drawingTools().setDrawModes(['polygon']);
            App.ui.forms.mainPanel_Map.drawingTools().onDraw(function (geometry) {
              App.aoi_drawn = ee.FeatureCollection(geometry);
            });
          } else {
            App.ui.forms.mainPanel_Map.drawingTools().setShown(false);
            App.ui.forms.mainPanel_Map.drawingTools().stop();
          }
        }
      }),
      cBox_AssetId: ui.Checkbox({
        label: 'Especificar ID de asset',
        value: true,
        onChange: function () {
          App.ui.forms.cBox_draw.setValue(false);
        }
      }),
      label_propertyID: ui.Label('Especifique el ID del área de interés (asset)'),
      textBox_propertyAssetID: ui.Textbox({
        placeholder: 'Especifique ID de la tabla',
        value: 'projects/ee-pinv01-528-senepa-fpun/assets/topadengue/tpd_area'
      }),
      button_uploadBoundary: ui.Button("Cargar límites", function () {
        tools.removeLayer(App.ui.forms.mainPanel_Map, "AOI");

        if (App.ui.forms.cBox_draw.getValue()) {
          if (App.aoi_drawn === null) {
            App.ui.forms.updateMessage("No se ha definido el área de interés. Defina y vuelva a cargar", true);
          } else {
            App.aoi = App.aoi_drawn;
            App.checkAreaAndDisplayMessage(App.aoi);
          }
        } else {
          if (App.ui.forms.cBox_AssetId.getValue()) {
            if (App.ui.forms.textBox_propertyAssetID.getValue() === '') {
              App.ui.forms.updateMessage("ID de la tabla no especificado, por favor especifique el ID", true);
            } else {
              App.aoi = ee.FeatureCollection(App.ui.forms.textBox_propertyAssetID.getValue());
              App.checkAreaAndDisplayMessage(App.aoi);
            }
          } else {
            App.ui.forms.updateMessage("Seleccione el método para definir el AOI", true);
          }
        }
      }),
      label_Period_start: ui.Label('Fecha de inicio del periodo', { backgroundColor: '#F5F0E4' }),
      label_Period_end: ui.Label('Fecha de fin del periodo', { backgroundColor: '#F5F0E4' }),
      textBox_Period_start: ui.Textbox({
        placeholder: 'aaaa-mm-dd',
        value: '2021-01-01',
        style: { fontWeight: 'bold', fontSize: '12px', textAlign: 'left', width: '100px' }
      }),
      textBox_Period_end: ui.Textbox({
        placeholder: 'aaaa-mm-dd',
        value: '2021-06-30',
        style: { fontWeight: 'bold', fontSize: '12px', textAlign: 'left', width: '100px' }
      }),
      label_cloudCover: ui.Label('Porcentaje máximo de nubes'),
      slider_cloudCover: ui.Slider({
        min: 0,
        max: 100,
        value: 1,
        step: 1,
        style: { width: '200px' }
      }),
      label_timeAggregation: ui.Label('Tipo de análisis (Trimestral / Semanas ISO)'),
            select_timeAggregation: ui.Select({
          items: ['Trimestral', 'Semanas ISO', 'Periodo Completo'], // Added 'Periodo Completo'
          placeholder: 'Seleccione un tipo de análisis',
          onChange: function (selected) {
            App.selectedTimeAggregation = selected;
          }
      }),
      label_spatialFilters: ui.Label('Filtros espaciales (opcional)'),
      checkbox_mean: ui.Checkbox({
        label: 'Aplicar media',
        value: false,
        onChange: function (value) {
          App.filterOptions.mean = value;
        }
      }),
      checkbox_median: ui.Checkbox({
        label: 'Aplicar mediana',
        value: false,
        onChange: function (value) {
          App.filterOptions.median = value;
        }
      }),
      checkbox_majority: ui.Checkbox({
        label: 'Aplicar mayoría',
        value: false,
        onChange: function (value) {
          App.filterOptions.majority = value;
        }
      }),
      slider_filterSize: ui.Slider({
        min: 3,
        max: 10,
        value: 3,
        step: 2,
        style: { width: '200px' },
        onChange: function (size) {
          App.filterOptions.filterSize = size;
        }
      }),
      button_generate: ui.Button({
  label: 'Generar',
  onClick: function () {
    var startDate = App.ui.forms.textBox_Period_start.getValue();
    var endDate = App.ui.forms.textBox_Period_end.getValue();
    var cloudCoverValue = App.ui.forms.slider_cloudCover.getValue();
    var analysisType = App.selectedTimeAggregation;

    if (!startDate || !endDate) {
      App.ui.forms.updateMessage("Por favor, especifique ambas fechas de inicio y fin del periodo.", true);
      return;
    }

    if (!analysisType) {
      App.ui.forms.updateMessage("Por favor, seleccione un tipo de análisis.", true);
      return;
    }

    var isValidRange = App.validateDateRange(startDate, endDate, analysisType);
    isValidRange.evaluate(function (isValid) {
      if (!isValid) {
        if (analysisType === 'Trimestral') {
          App.ui.forms.updateMessage("El rango de fechas debe cubrir al menos 3 meses para análisis trimestral.", true);
        } else if (analysisType === 'Semanas ISO') {
          App.ui.forms.updateMessage("El rango de fechas debe cubrir al menos 1 semana para análisis de semanas ISO.", true);
        }
        return;
      }

      App.ui.forms.updateMessage("Iniciando el análisis...", false);

      var imageCollection = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
        .filterDate(startDate, endDate)
        .filterBounds(App.aoi)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloudCoverValue))
        .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9',  'B11', 'B12'])
        .map(App.addQuarterAndIsoWeek);

      // Only count ISO weeks if the selected time aggregation is "Semanas ISO"
      if (analysisType === 'Semanas ISO') {
        App.countIsoWeeks(startDate, endDate, imageCollection);
      }

      var count = imageCollection.size();
      
      count.evaluate(function (cnt) {
        if (cnt === 0) {
          App.ui.forms.updateMessage("No se encontraron imágenes con los parámetros especificados.", true);
        } else {
          App.applyTimeAnalysis(imageCollection);
          App.ui.forms.updateMessage("Análisis completado. Revise la consola para más detalles.", false);
        }
      });
    });
  }
}),
    button_download: ui.Button({
  label: 'Descargar',
  onClick: function () {
    App.ui.forms.updateMessage("Preparing files for download...", false);

    // Get parameters
    var startDate = App.ui.forms.textBox_Period_start.getValue();
    var endDate = App.ui.forms.textBox_Period_end.getValue();
    var cloudCoverValue = App.ui.forms.slider_cloudCover.getValue();
    var analysisType = App.selectedTimeAggregation;

    // Build the image collection
    var imageCollection = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
      .filterDate(startDate, endDate)
      .filterBounds(App.aoi)
      .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloudCoverValue))
      .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9',  'B11', 'B12'])
      .map(function(image) {
        return image.toFloat().divide(10000).copyProperties(image, image.propertyNames()); // Convert to float and rescale to 0-1
      });

    // Initialize variables
    var reducedCollection;
    var filteredCollections = {};

    if (analysisType === 'Trimestral') {
      // Existing code for Trimestral
    } else if (analysisType === 'Semanas ISO') {
      // Existing code for Semanas ISO
    } else if (analysisType === 'Periodo Completo') {
      // Code for Periodo Completo

      // Apply indices to the images
      var periodCollection = imageCollection.map(App.addIndices);

      var imageCount = periodCollection.size();
      var startDate = ee.Date(periodCollection.first().get('system:time_start'));
      var endDate = ee.Date(periodCollection.sort('system:time_start', false).first().get('system:time_start'));

      var meanImage = periodCollection.mean()
          .toFloat()
          .rename(periodCollection.first().bandNames().map(function (band) {
            return ee.String(band).cat('_mean');
          }));

      var medianImage = periodCollection.median()
          .toFloat()
          .rename(periodCollection.first().bandNames().map(function (band) {
            return ee.String(band).cat('_median');
          }));

      var minImage = periodCollection.min()
          .toFloat()
          .rename(periodCollection.first().bandNames().map(function (band) {
            return ee.String(band).cat('_min');
          }));

      var maxImage = periodCollection.max()
          .toFloat()
          .rename(periodCollection.first().bandNames().map(function (band) {
            return ee.String(band).cat('_max');
          }));

      var stdDevImage = periodCollection.reduce(ee.Reducer.stdDev())
          .toFloat()
          .rename(periodCollection.first().bandNames().map(function (band) {
            return ee.String(band).cat('_stdDev');
          }));

      var combinedImage = meanImage.addBands(medianImage)
                                  .addBands(minImage)
                                  .addBands(maxImage)
                                  .addBands(stdDevImage)
                                  .set('start_date', startDate.format('YYYY-MM-dd'))
                                  .set('end_date', endDate.format('YYYY-MM-dd'))
                                  .set('image_count', imageCount)
                                  .set('system:time_start', startDate.millis());

      reducedCollection = ee.ImageCollection([combinedImage]);

      // Apply spatial filters
      if (App.filterOptions.mean) {
          filteredCollections.mean = App.applySpatialFilter(reducedCollection, 'mean');
      }
      if (App.filterOptions.median) {
          filteredCollections.median = App.applySpatialFilter(reducedCollection, 'median');
      }
      if (App.filterOptions.majority) {
          filteredCollections.majority = App.applySpatialFilter(reducedCollection, 'majority');
      }

    } else {
      App.ui.forms.updateMessage("Por favor, seleccione un tipo de análisis válido.", true);
      return;
    }

    // Call the export function
    App.exportModule.exportAll(reducedCollection, filteredCollections, App.aoi.geometry());

    App.ui.forms.updateMessage("Download initiated. Check your Google Drive for exported files.", false);
  }
}),
    }

  },

  /////////////////////////////////////////////////////////////////////////////

};

App.init();
