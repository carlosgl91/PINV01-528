// Aplicación para descarga de imágenes
// Autor: Ing. Amb. Carlos Giménez
//* Changelong: 29-09-2024
//* Changelong: 08-03-2025
//* Changelong: 14-03-2025

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
  processedCollection: null,  
  filteredCollections: {},     

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
  exportCompositeImages: function(compositeCollection, descriptionPrefix, suffix, region, selectedTimeAggregation, batchSize) {
  // Obtener la lista de IDs de imágenes sin traer toda la colección al cliente
  compositeCollection.aggregate_array('system:index').evaluate(function(imageIds) {
    if (!imageIds) return;

    // Dividir en lotes según el batchSize
    var batches = [];
    for (var i = 0; i < imageIds.length; i += batchSize) {
      batches.push(imageIds.slice(i, i + batchSize));
    }

    // Función de exportación sin getInfo()
    var exportBatch = function(batch) {
      batch.forEach(function(imageId) {
        var image = compositeCollection.filter(ee.Filter.eq('system:index', imageId)).first();

        // Construcción del nombre del archivo sin traer datos al cliente
        var prefix = ee.String(descriptionPrefix);
        var suffixStr = ee.String(suffix);
        var startDateStr = ee.String(image.get('start_date'));
        var endDateStr = ee.String(image.get('end_date'));
        var year = ee.Date(startDateStr).get('year').format();

        var filename = ee.Algorithms.If(
          selectedTimeAggregation === 'Trimestral',
          prefix.cat('_Q').cat(ee.Number(image.get('quarter')).format('%.0f')).cat('_Year_').cat(year).cat(suffixStr),
          ee.Algorithms.If(
            selectedTimeAggregation === 'Semanas ISO',
            prefix.cat('_Week').cat(ee.String(image.get('iso_week'))).cat('_Year_').cat(year).cat(suffixStr),
            ee.Algorithms.If(
              selectedTimeAggregation === 'Periodo Completo',
              prefix.cat('_').cat(startDateStr).cat('_to_').cat(endDateStr).cat(suffixStr),
              prefix.cat('_Year_').cat(year).cat(suffixStr)
            )
          )
        );

        // Obtener escala de resolución de la imagen sin extraer datos al cliente
        var scale = image.projection().nominalScale();
        print('Exportando imagen:', filename);
        filename = filename.getInfo();
        // Exportación sin getInfo()
        Export.image.toDrive({
          image: image.clip(region),
          description: filename,
          fileNamePrefix: filename,
          folder: "PINV01_Exports",
          region: region,
          scale: scale,
          maxPixels: 1e13
        });

        
      });
    };

    // Ejecutar exportaciones en lotes
    batches.forEach(function(batch, batchIndex) {
      print('Exportando lote', batchIndex + 1, 'de', batches.length);
      exportBatch(batch);
    });
  });
},
  exportSpatiallyFilteredImages: function(filteredCollections, descriptionPrefix, suffix, region, selectedTimeAggregation, batchSize) {
  // Iterate over each filter type in the collections
  Object.keys(filteredCollections).forEach(function(filterType) {
    var collection = filteredCollections[filterType];

    // 1) Extract all system:index values in one go (client-side array)
    collection.aggregate_array('system:index').evaluate(function(imageIds) {
      // If no images, exit
      if (!imageIds) return;

      // 2) Split imageIds into batches of size 'batchSize'
      var batches = [];
      for (var i = 0; i < imageIds.length; i += batchSize) {
        batches.push(imageIds.slice(i, i + batchSize));
      }

      // 3) Define a function to export each batch
      var exportBatch = function(batch) {
        batch.forEach(function(imageId) {
          // Filter to get the single image with this index
          var image = collection.filter(ee.Filter.eq('system:index', imageId)).first();

          // Build filename on the server side (ee.String)
          var prefix = ee.String(descriptionPrefix);
          var suffixStr = ee.String(suffix);
          var startDateStr = ee.String(image.get('start_date'));
          var year = ee.Date(startDateStr).get('year').format();
          var spatial_filter_size = ee.Number(App.filterOptions.filterSize).format('%.0f') 

          // Choose filename based on selectedTimeAggregation, plus "_spf_" + filterType
          var filename = ee.Algorithms.If(
            ee.String(selectedTimeAggregation).compareTo('Trimestral').eq(0),
            prefix.cat('_Q')
                  .cat(ee.Number(image.get('quarter')).format('%.0f'))
                  .cat('_Year_')
                  .cat(year)
                  .cat('_spf_')
                  .cat(spatial_filter_size)
                  .cat('_')
                  .cat(filterType)
                  .cat(suffixStr),
            ee.Algorithms.If(
              ee.String(selectedTimeAggregation).compareTo('Semanas ISO').eq(0),
              prefix.cat('_Week')
                    .cat(ee.String(image.get('iso_week')))
                    .cat('_Year_')
                    .cat(year)
                    .cat('_spf_')
                    .cat(spatial_filter_size)
                    .cat('_')
                    .cat(filterType)
                    .cat(suffixStr),
              // Default (no quarter or iso_week)
              prefix.cat('_Year_')
                    .cat(year)
                    .cat('_spf_')
                    .cat(spatial_filter_size)
                    .cat('_')
                    .cat(filterType)
                    .cat(suffixStr)
            )
          );

          // Optionally, keep scale dynamic:
          // var scale = image.projection().nominalScale();
          // Or keep the fixed scale = 10 (as in your original code):
          var scale = 10;

          // Convert ee.String to a plain JS string for Export
          var filenameJS = filename.getInfo();

          print('Exporting image for filter:', filterType, ' => ', filenameJS);

          // 4) Set up the export
          Export.image.toDrive({
            image: image.clip(region),
            description: filenameJS,
            fileNamePrefix: filenameJS,
            folder: "PINV01_Exports",
            region: region,
            scale: scale,
            maxPixels: 1e13
          });
        });
      };

      // 5) Export each batch in sequence
      batches.forEach(function(batch, batchIndex) {
        print('Exporting batch', batchIndex + 1, 'of', batches.length, 'for filter:', filterType);
        exportBatch(batch);
      });
    });
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
    App.exportModule.exportCompositeImages(reducedCollection, descriptionPrefix, '', region,App.selectedTimeAggregation,5);
  
    // Export spatially filtered collections if any
    if (Object.keys(filteredCollections).length > 0) {
      // filteredCollections, descriptionPrefix, suffix, region, selectedTimeAggregation, batchSize
      App.exportModule.exportSpatiallyFilteredImages(filteredCollections, descriptionPrefix, '_Filtered', region,App.selectedTimeAggregation,5);
    }
  
    App.ui.forms.updateMessage("Export process started. Check your Google Drive.", false);
  }

},

  checkAreaAndDisplayMessage: function (aoi) {
    var areaHectares = aoi.geometry().area().divide(10000); // Convert m² to hectares

    areaHectares.evaluate(function (area) {
      if (area > 250000) {
        App.ui.forms.updateMessage('Error: El área excede 250,000 hectáreas. Área actual: ' + area.toFixed(2) + ' ha', true);
        App.aoi = null;
      } else {
        App.ui.forms.updateMessage('Área cargada exitosamente. Área total: ' + area.toFixed(2) + ' ha', false);
        App.ui.forms.mainPanel_Map.addLayer(aoi, { color: 'FF0000' }, "AOI", true, 0.5);
        App.ui.forms.mainPanel_Map.centerObject(aoi);
      }
    });
  },

  getIsoWeek: function (date) {
    var jan4 = ee.Date.fromYMD(date.get('year'), 1, 4); // Determines the date of the first week of the year based in ISO 8601
    var weekOffset = jan4.getRelative('week', 'year'); // Based on the date, retrieves the relative week number of that year for the 04/01
    // Obtains the relative week of the date, substract the weekOffset and adds 1 because of the 0 base of the earth engine function 
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
  print(diffMonths,"diffMonths")
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
  
  
  // Esta función obtiene las estadisticas básicas de la colección para cada trimestre
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

  // Esta función obtiene las estadisticas básicas de la colección para cada isoweek

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


  // Esta función define que periodo ha sido seleccionado, llama a las funciones correspondientes
  // y almacena los datos procesados en las collecciones correspondientes
  applyTimeAnalysis: function (imageCollection) {
        //Generamos dos colecciones, filteredCollection 
        var filteredCollections = {}; // Inicializamos un objeto vacio
        var processedCollection; // 
      
        if (App.selectedTimeAggregation === 'Trimestral') {
          // Procesar trimestralmente
          var quarterlyCollection = imageCollection.map(App.addIndices).map(App.addQuarterAndIsoWeek);
          var uniqueQuarters = quarterlyCollection.aggregate_array('quarter').distinct().sort();
      
          var quarterlyImages = uniqueQuarters.map(function (quarter) {
            return App.getQuarterlyStatistics(quarter, quarterlyCollection);
          });
      
          var quarterlyStatsCollection = ee.ImageCollection(quarterlyImages);
      
          // Aplicar filtros espaciales
          if (App.filterOptions.mean) {
            filteredCollections.mean = App.applySpatialFilter(quarterlyStatsCollection, 'mean');
          }
          if (App.filterOptions.median) {
            filteredCollections.median = App.applySpatialFilter(quarterlyStatsCollection, 'median');
          }
          if (App.filterOptions.majority) {
            filteredCollections.majority = App.applySpatialFilter(quarterlyStatsCollection, 'majority');
          }
      
          print('Colección de estadísticas trimestrales:', quarterlyStatsCollection);
          processedCollection = quarterlyStatsCollection;
      
        } else if (App.selectedTimeAggregation === 'Semanas ISO') {
          // Procesar semanalmente
          var isoWeekCollection = imageCollection.map(App.addIndices).map(App.addQuarterAndIsoWeek);
          var uniqueIsoWeeks = isoWeekCollection.aggregate_array('iso_week').distinct().sort();
      
          var weeklyImages = uniqueIsoWeeks.map(function (isoWeek) {
            return App.getWeeklyStatistics(isoWeek, isoWeekCollection);
          });
      
          var weeklyStatsCollection = ee.ImageCollection(weeklyImages);
      
          // Aplicar filtros espaciales
          if (App.filterOptions.mean) {
            filteredCollections.mean = App.applySpatialFilter(weeklyStatsCollection, 'mean');
          }
          if (App.filterOptions.median) {
            filteredCollections.median = App.applySpatialFilter(weeklyStatsCollection, 'median');
          }
          if (App.filterOptions.majority) {
            filteredCollections.majority = App.applySpatialFilter(weeklyStatsCollection, 'majority');
          }
      
          print('Colección de estadísticas semanales:', weeklyStatsCollection);
          processedCollection = weeklyStatsCollection;
      } else if (App.selectedTimeAggregation === 'Periodo Completo') {
     
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
        processedCollection = periodStatsCollection;
    
      } else {
        App.ui.forms.updateMessage('Por favor, seleccione un tipo de análisis válido.', true);
      }
      // Almacenar las colecciones procesadas
      App.processedCollection = processedCollection;
      App.filteredCollections = filteredCollections;
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
        this.controlPanel.add(this.label_spatialFilterSize);
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
          width: '350px'        }
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
        value: 'Aplicación de procesamiento y descarga de imágenes satelitales - PNV01-530',
        style: { fontSize: '25px', color: '#8b8b8b',textAlign: 'center'}
      }),
      label_aoi: ui.Label({
        value: 'Área de interés',
        style: { fontSize: '15px', fontWeight: 'bold' }
      }),
      subpanel_Parameters: ui.Panel({
        layout: ui.Panel.Layout.flow('vertical'),
        style: { stretch: 'vertical', width: '350px' }
      }),
      subpanel_AOI: ui.Panel({
        layout: ui.Panel.Layout.flow('horizontal'),
        style: { height: '50px' }
      }),
      cBox_draw: ui.Checkbox({
        'label': 'Dibujar en el mapa',
        'value' : false,
        'onChange':function(){
          App.ui.forms.cBox_AssetId.setValue(false)
          if (App.ui.forms.cBox_draw.getValue()) {
            // If the checkbox is checked, activate drawing tools
            App.ui.forms.mainPanel_Map.drawingTools().setShown(true);
            App.ui.forms.mainPanel_Map.drawingTools().setDrawModes(['polygon']);
            // Create a function to handle the drawing complete event
            var dummyGeometry = ui.Map.GeometryLayer({geometries: null, name: 'AOI', color: '23cba7'});
            App.ui.forms.mainPanel_Map.drawingTools().layers().add(dummyGeometry);
            App.ui.forms.mainPanel_Map.drawingTools().onDraw(function(geometry) {

            App.aoi_drawn = ee.FeatureCollection(geometry);
            
          });
          } else {
            // If the checkbox is unchecked, deactivate drawing tools
            App.ui.forms.mainPanel_Map.drawingTools().setShown(false);
  
            App.ui.forms.mainPanel_Map.drawingTools().stop();
            // Remove the drawn shape from the map
            // App.ui.forms.panel_leftMap.layers().get(0).remove();
            print(App.ui.forms.mainPanel_Map.layers().get(0))
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
        value: 'projects/ee-lc-monitoring/assets/proyecto_pinv530/tapyta_y_pomera_buffer500m'
      }),
      button_uploadBoundary: ui.Button("Cargar límites", function () {
        // Remove the aoi
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
      label_Period_start: ui.Label('Fecha de inicio del periodo'),
      label_Period_end: ui.Label('Fecha de fin del periodo'),
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
      label_timeAggregation: ui.Label('Agrupación temporal'),
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
      label_spatialFilterSize: ui.Label('Tamaño del filtro espacial'),
      slider_filterSize: ui.Slider({
        min: 3,
        max: 10,
        value: 3,
        step: 1,
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
      
      //---------------------------------------------------------------------------------------------------    
      //------------------------------------------------------Validation----------------------------------- 
      //--------------------------------------------------------------------------------------------------- 
      
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
            
            //---------------------------------------------------------------------------------------------------    
            //--------------------------------------------Processing---------------------------------------------    
            //---------------------------------------------------------------------------------------------------  
            
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
    if (!App.processedCollection) {
      App.ui.forms.updateMessage("Por favor, genere los datos antes de descargar.", true);
      return;
    }

    App.ui.forms.updateMessage("Preparando archivos para descargar...", false);

    // Utilizar las colecciones procesadas almacenadas
    var reducedCollection = App.processedCollection;
    var filteredCollections = App.filteredCollections;
    var region = App.aoi.geometry();

    // Llamar a la función de exportación
    App.exportModule.exportAll(reducedCollection, filteredCollections, region);

    App.ui.forms.updateMessage("Descarga iniciada. Revise su Google Drive para los archivos exportados.", false);
  }
}),
    }

  },

  /////////////////////////////////////////////////////////////////////////////

};

App.init();
