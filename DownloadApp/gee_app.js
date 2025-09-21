/**
 * @name
 * 
 *      Aplicación de procesamiento y descarga de imágenes satelitales - PINV01-528
 * 
 * @description
 * 
 *      This is a processing and download tool for the PINV-528 project from CONACYT Paraguay
 *  
 * @author
 * 
 *      Carlos Giménez
 * 
 * @contact
 * 
 *      Carlos Giménez - carlos.gimenez@showmewhere.com/ 
 *      Dr. Pastor Pérez - peperez.estigarribia@pol.una.py/ peperez.estigarribia@gmail.com 
 *
 * @version
 * 
 *    1.0.0 - CG Access and download data using user's vector
 *    1.1.0 - CG Updated to interface
 *    1.1.1 - CG Updated exporting names and other features
 *    1.1.2 - CG Added parameters report (Need to include the list of images, currently only for periodo completo), also export as csv for each type of time agreggation
 *    1.1.3 - CG Added image visualization module (Need to list the images by type of time agreggation)
 *    1.1.4 - CG Edited getQuarterlyStatistics function to consider multiple years
 *    1.1.4 - CG Added image id for the results based on the temporal units (isoweek_year, quarter_year ) - pending
 *    1.1.5 - CG Changed S2 TOA collection by S2 SR collections
 *    1.1.5 - CG Added rescaling procedure of the bands
 *    1.1.6 - CG Added Cloud and shadows processing (Removals and void filling)
 *    1.1.7 - CG Variables selection
 *    1.1.7 - CG Reporting function for each time aggregation type
 * 
 * @see
 * 
 *  Repository - https://github.com/carlosgl91/PINV01-528
 * 
 * @comming soon
 * 
 * English interface
 * 
 * Study area subseting by field 
 * Shadow and cloud masking improvement using s2cloudness procedure 
 *  Image selecction for inclusion or exclusion
 *  Including other satelites (not so soon) (v.1.2)
 * 
 */

ui.root.clear();

var tools = require('users/charlieswall/functions_cg:appTools');
var s2_tools = require('users/charlieswall/CARLOSGL07:sentinel_2/S2_functions');


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
  Image_Col_to_process:null, // This object will store the images filtered by the parameters entered by the user
  available_variables:{
    bands: ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9',  'B11', 'B12'],
    indexes: ['NDVI', 'NDBI','NDWI','SAVI'],
    
  },
  
  selected_vars:[],
  selectedVars:null,
  //iso_weeks report data
  r_total_iso_weeks_in_range:null,
  r_iso_weeks_with_data:null,
  r_missing_iso_weeks_in_range:null,
  r_count_missing_isoweeks:null,
  //variable descriptions
  
  
  report:{
      // How many quarters we have in the time period
          // How many images in total
          // How many images per quarter
          // How many images per month
    start_date:null,
    end_date:null,
    cloud_cover_perc:null,
    img_count_total:null,
    img_count_quarters:null,
    img_count_months:null,
    img_count_iso_weeks:null,
    //Report metadata
    metadata_for_reporting:  [{
                              id: 'analysisType',
                              desc: 'Valor seleccionado para el parámetro agrupación temporal (Trimestral, Semanas ISO, Periodo completo)'},
                              {
                              id: 'start_date',
                              desc: 'Fecha de inicio del periodo de filtrado de imágenes satelitales'},
                              {
                              id: 'end_date',
                              desc: 'Fecha final del periodo de filtrado de imágenes satelitales'},
                              {
                              id: 'cloud_cover_perc',
                              desc: 'Valor selecionado para el parámetro de filtro de cobertura de nubes (%)'
                              },
                              {
                              id: 'img_count_iso_weeks',
                              desc: 'Semanas ISO con datos presentes en el periodo comprendido entre la fecha inicial y final especificados'
                              },
                              {
                              id: 'img_count_months',
                              desc: 'Meses con datos presentes en el periodo comprendido entre la fecha inicial y final especificados'
                              },
                              {
                              id: 'img_count_total',
                              desc: 'Número total de imágenes filtradas y procesadas'
                              },
                              ]
  },
  
  init: function () {
    // Calls the UI initialization
    this.ui.init();
  },
  // MODULES
  /*
      This module contains two funcitons:
      1. exportCompositeImages
      2. exportSpatiallyFilteredImages
      3. exportAll: This is the general function that calls 1 and 2. It also sets a prefix that is later used in 1 and 2. 
      */
  exportModule: {
  // Function to export composite images (mean, median, etc.)
  exportCompositeImages: function(compositeCollection, descriptionPrefix, suffix, region, selectedTimeAggregation, batchSize) {
  print("Pre-export collection", compositeCollection )
  // Obtener la lista de IDs de imágenes sin traer toda la colección al cliente
  compositeCollection.aggregate_array('system:index').evaluate(function(imageIds) {
    if (!imageIds) return;

    // Dividir en lotes según el batchSize
    var batches = [];
    // creates batches of a given size 
    for (var i = 0; i < imageIds.length; i += batchSize) {
      //Adds to the list
      batches.push(imageIds.slice(i, i + batchSize));
    }

    // Funtion with for each running on each batch
    // Takes the images, filters them by system index, creates prefix, suffix, start and end dates, year
    // Finally depending on the time aggregation, creates the name
    var exportBatch = function(batch) {
      batch.forEach(function(imageId) {
        var image = compositeCollection.filter(ee.Filter.eq('system:index', imageId)).first();

        // Construcción del nombre del archivo sin traer datos al cliente
        var prefix = ee.String(descriptionPrefix);
        var suffixStr = ee.String(suffix);
        var startDateStr = ee.String(image.get('start_date'));
        var endDateStr = ee.String(image.get('end_date'));
        var year = ee.Date(startDateStr).get('year').format();
        var quarter = ee.Number(image.get('quarter')).format('%.0f');

        var filename = ee.Algorithms.If(
          selectedTimeAggregation === 'Trimestral',
          prefix.cat('_Q').cat(quarter).cat('_Year_').cat(year).cat(suffixStr),
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
        // var scale = image.projection().nominalScale();
        print('Exportando imagen:', filename);
        // print('Scale:', scale);

        // Para el nombre llama a get info y lo añade a la funcion estándar para exportar al drive
        filename = filename.getInfo();

        Export.image.toDrive({
          image: image.clip(region),
          description: filename,
          fileNamePrefix: filename,
          folder: "PINV01_Exports",
          region: region,
          scale: 10,
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
  exportReportImageList: function(compositeCollection){
    
    var csv_file_name;
    if (App.selectedTimeAggregation === 'Semanas ISO') {
        csv_file_name = 'ISO_week';
    } else if (App.selectedTimeAggregation === 'Trimestral') {
        csv_file_name = 'Quarter';
    } else if (App.selectedTimeAggregation === 'Periodo Completo') {
        csv_file_name = 'Full_period';
    } else {
        csv_file_name = 'Unknown';
    }
    
     // **Collect image metadata**
     
     //print(compositeCollection,"ImageCollection to list")
        var imageMetadata = compositeCollection.map(function(image) {
          return ee.Feature(null, {
            'image_id': image.id(),
            'system_start_time': image.get('system:time_start'),
            'cloud_coverage': image.get('CLOUDY_PIXEL_PERCENTAGE'),
            'isoWeek_year':image.get('isoWeek_year'),
            'iso_week':image.get('iso_week'),
            'quarter':image.get('quarter'),
            'quarter_year':image.get('quarter_year'),
            'yearMonth':image.get('yearMonth')




            // 'provider': image.get('SATELLITE'),
            // 'collection': image.get('SENSOR')
          });
        });
    
        // **Export image metadata as CSV**
        Export.table.toDrive({
          collection: imageMetadata,
          description: 'ImageList_' + csv_file_name ,
          fileFormat: 'CSV',
          folder: 'PINV01_Exports'
        });
  },
  exportReportParameters: function(parameteres_dictionary){
    
    var toExportParameters = App.report
        
    // Convert to a FeatureCollection with one feature
    var feature = ee.Feature(null, toExportParameters);
    var fc = ee.FeatureCollection([feature]);
        
    // Export as CSV
    Export.table.toDrive({
      collection: fc,
      description: 'PINV01_528_App_settings',
      fileFormat: 'CSV',
      folder:"PINV01_Exports"
    });
  },

  // Unified function to call export for reduced and filtered images
  /*
  This function requieres the reduced and filtered collections and the region
  depending on the time agreggation it sets the "prefix" for the file name,
  then in calls the exportCompositeimage function for exporting the processed stack of images
  and optionally the exportSpatiallyFilteredImages functioon to export the spatially filtered images
  */
  exportAll: function(reducedCollection, filteredCollections, region) {
    // Sets a description prefix depending of the selected time agreggation
    var descriptionPrefix;
    if (App.selectedTimeAggregation === 'Semanas ISO') {
        descriptionPrefix = 'ISO_week';
    } else if (App.selectedTimeAggregation === 'Trimestral') {
        descriptionPrefix = 'Trimestre';
    } else if (App.selectedTimeAggregation === 'Periodo Completo') {
        descriptionPrefix = 'Periodo';
    } else {
        descriptionPrefix = 'Unknown';
    }
    
     App.exportModule.exportReportImageList(App.Image_Col_to_process);
     
     App.exportModule.exportReportParameters(App.report);
    // Export the reduced collection
    // This function use the reduced collection of images, the prefix, suffix (for spatially filtered)
    // region, selected time agreggation and batchSize 
    App.exportModule.exportCompositeImages(reducedCollection, descriptionPrefix, '', region,App.selectedTimeAggregation,5);
 
    // Export spatially filtered collections if any
    if (Object.keys(filteredCollections).length > 0) {
      // filteredCollections, descriptionPrefix, suffix, region, selectedTimeAggregation, batchSize
      App.exportModule.exportSpatiallyFilteredImages(filteredCollections, descriptionPrefix, '_Filtered', region,App.selectedTimeAggregation,5);
    }
  
    App.ui.forms.updateMessage("Proceso de exportar iniciado, revise la pestaña Tasks", false);
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
  // Function for reporting in the console
  countIsoWeeks : function(startDate, endDate, imageCollection) {
    //Sets the report variables to null 
    App.r_total_iso_weeks_in_range=null;
    App.r_iso_weeks_with_data=null;
    App.r_missing_iso_weeks_in_range=null;
    App.r_count_missing_isoweeks=null;
    
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
  
    
    
    App.r_total_iso_weeks_in_range= allIsoWeeks.length();
    App.r_iso_weeks_with_data=isoWeeksWithData;
    App.r_missing_iso_weeks_in_range=missingIsoWeeks;
    App.r_count_missing_isoweeks=missingWeeksCount;
    
    // Print the total number of weeks, missing weeks, and count of missing weeks
    print('Total ISO weeks in range:',App.r_total_iso_weeks_in_range);
    print('ISO weeks with data:', App.r_iso_weeks_with_data);
    print('Missing ISO weeks:', App.r_missing_iso_weeks_in_range);
    print('Total number of missing ISO weeks:', App.r_count_missing_isoweeks);
  },

  getIsoWeek: function (date) {
    var jan4 = ee.Date.fromYMD(date.get('year'), 1, 4); // Determines the date of the first week of the year based in ISO 8601
    var weekOffset = jan4.getRelative('week', 'year'); // Based on the date, retrieves the relative week number of that year for the 04/01
    // Obtains the relative week of the date, substract the weekOffset and adds 1 because of the 0 base of the earth engine function 
    var isoWeek = ee.Number(date.getRelative('week', 'year')).subtract(weekOffset).add(1); 
    return isoWeek;
  },
  getIsoYear : function(date,isoWeek) {
   date = ee.Date(date);
  var year = date.get('year');
  var week = isoWeek;
  var month = date.get('month');
  var day = date.get('day');

  // If it's early January and still part of ISO week 52 or 53, it's part of the previous ISO year
  var isPreviousYear = week.gte(52).and(month.eq(1));

  // If it's late December and week 1, it's part of the next ISO year
  var isNextYear = week.eq(1).and(month.eq(12));

  return ee.Number(year)
    .subtract(ee.Number(isPreviousYear))
    .add(ee.Number(isNextYear));
  },
  getQuarter: function (date) {
    var month = date.get('month');
    return ee.Number(month).divide(3).ceil();
  },

  validateDateRange: function (startDate, endDate, analysisType) {
  var start = ee.Date(startDate);
  var end = ee.Date(endDate);
  var diffMonths = end.difference(start, 'month');
  print("Period in months: ", diffMonths)
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

    /**
   * Masks clouds and cirrus in a Sentinel-2 SR image using the QA60 band.
   * @param {ee.Image} image The input Sentinel-2 image.
   * @return {ee.Image} The cloud-masked image, with cloudy pixels being masked out.
   */
  cloudMask: function(image) {
    var qa = image.select('QA60');
    // Bits 10 and 11 are clouds and cirrus, respectively.
    var cloudBitMask = 1 << 10;
    var cirrusBitMask = 1 << 11;
    // Create a mask where both flags are 0, indicating clear conditions.
    var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
    // Apply the mask to the image and copy its properties.
    return image.updateMask(mask).copyProperties(image, image.propertyNames());
  },
  /**
 * Applies cloud masking and then fills the resulting voids (gaps).
 * The void-filling strategy depends on the selected temporal aggregation.
 * @param {ee.ImageCollection} imageCollection The input collection to process.
 * @return {ee.ImageCollection} A new collection with clouds masked and voids filled.
 */
 
  applyCloudMaskAndFillVoids: function(imageCollection) {
      
              var analysisType = App.selectedTimeAggregation;
            
              // Step 1: Apply the cloud mask to every image in the collection.
              var maskedCollection = imageCollection.map(App.cloudMask);
            
              App.ui.forms.updateMessage("Cloud masking complete. Filling voids...", false);
            
              // Step 2: Fill the voids based on the selected analysis type.
              if (analysisType === 'Periodo Completo') {
            // For the full period, create one median composite from the ENTIRE original collection to fill gaps.
            var medianFiller = imageCollection.median();
        
            var filledCollection = maskedCollection.map(function(image) {
                // Replace masked pixels in each image with the value from the period's median composite.
                return image.unmask(medianFiller).copyProperties(image, image.propertyNames());
            });
            return filledCollection;
        
        } else if (analysisType === 'Trimestral') {
            // For quarterly analysis, fill gaps using the median of the respective quarter.
            var uniqueQuarters = ee.List(imageCollection.aggregate_array('quarter_year')).distinct();
        
            var filledByQuarter = uniqueQuarters.map(function(quarter_year) {
                // Create the median composite for this specific quarter from the ORIGINAL collection.
                var quarterMedianFiller = imageCollection
                    .filter(ee.Filter.eq('quarter_year', quarter_year))
                    .median();
        
                // Filter the MASKED collection and fill the voids for all images in this quarter.
                var filledImages = maskedCollection
                    .filter(ee.Filter.eq('quarter_year', quarter_year))
                    .map(function(image) {
                        return image.unmask(quarterMedianFiller).copyProperties(image, image.propertyNames());
                    });
                return filledImages;
            });
        
            // The result is a list of ImageCollections. Flatten it into a single ImageCollection.
            return ee.ImageCollection(ee.FeatureCollection(filledByQuarter).flatten());
        
        } else if (analysisType === 'Semanas ISO') {
            // For ISO week analysis, efficiently fill gaps using the median of the corresponding quarter.
            
            // 1. Get a list of all unique quarters in the collection.
            var uniqueQuarters = ee.List(imageCollection.aggregate_array('quarter_year')).distinct();
            
            // 2. Iterate over each unique quarter.
            var filledByQuarter = uniqueQuarters.map(function(quarter_year) {
                
                // 3. Calculate the median filler for this quarter just ONCE.
                var quarterMedianFiller = imageCollection
                    .filter(ee.Filter.eq('quarter_year', quarter_year))
                    .median();
                
                // 4. Filter the MASKED collection to get all images belonging to this quarter.
                var imagesInQuarter = maskedCollection.filter(ee.Filter.eq('quarter_year', quarter_year));
                
                // 5. Map over this smaller, quarter-specific collection and fill the voids.
                var filledImages = imagesInQuarter.map(function(image) {
                    return image.unmask(quarterMedianFiller).copyProperties(image, image.propertyNames());
                });
                
                // You can print inside the loop if you need to debug a specific quarter
                // print('Images filled for quarter: ' + quarter_year, filledImages);
                
                return filledImages;
            });
            
            // 6. The result is a list of ImageCollections. Flatten it into a single collection.
            return ee.ImageCollection(ee.FeatureCollection(filledByQuarter).flatten());
                
        } else {
            // If no matching analysis type, just return the masked collection with no filling.
            return maskedCollection;
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
    //Adds date, iso_week, 
    var date = image.date();
    var yearMonth = date.format('YYYY-MM');
    var year = date.format('YYYY');
    var quarter = App.getQuarter(date);
    var isoWeek = App.getIsoWeek(date);
    var iso_year = App.getIsoYear(date,isoWeek)
    var isoWeek_year =  iso_year.format('%04d').cat('_').cat(isoWeek.format('%02d')); // YYYY_WW format
    var quarter_year =  year.cat('_').cat(quarter.format('%d')); // YYYY-Q format


    return image.set('quarter', quarter)
              .set('iso_week', isoWeek)
              .set('yearMonth', yearMonth)
              .set('isoWeek_year', isoWeek_year)
               .set('quarter_year', quarter_year)
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
    // Here it is important to have in mind that, when multiple years, the function could produce one image per quarter instead  
  // of one image per quarter and year. So we should add a year property for the filter
  getQuarterlyStatistics: function (quarter_year, collection) {
    
  var quarterCollection = collection.filter(ee.Filter.eq('quarter_year', quarter_year));
  var imageCount = quarterCollection.size();
  var startDate = ee.Date(quarterCollection.first().get('system:time_start'));
  var endDate = ee.Date(quarterCollection.sort('system:time_start', false).first().get('system:time_start'));
  var quarter = quarterCollection.first().get('quarter')

 

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
                              .set('quarter', quarter)////
                              .set('quarter_year', quarter_year)
                              .set('start_date', startDate.format('YYYY-MM-dd'))
                              .set('end_date', endDate.format('YYYY-MM-dd'))
                              .set('image_count', imageCount)
                              .set('system:time_start', startDate.millis());

 
   return combinedImage ;
      
  },

  // Esta función obtiene las estadisticas básicas de la colección para cada isoweek
  // Here it is important to have in mind that, when multiple years, the function could produce one image per week instead  
  // of one image per week and year. So we should add a year property for the filter
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
  // y almacena los datos procesados en las colecciones correspondientes
  applyTimeAnalysis: function (imageCollection) {
        //Generamos dos colecciones, filteredCollection 
        var filteredCollections = {}; // Inicializamos un objeto vacio
        var processedCollection; // 
      
        if (App.selectedTimeAggregation === 'Trimestral') {
          // Things to inform from here...
          
          // List of images, acquisition dates, cc, asset id, quarter, iso week,grid name
          
          // How many quarters we have in the time period
          // How many images in total
          // How many images per quarter
          // How many images per month
          
          
          // Procesar trimestralmente
          // This adds the indexes as bands, and quarter and corresponding isoweek to each image
          var quarterlyCollection = imageCollection
          
          // Create a collection of images per quarter
          
          quarterlyCollection = quarterlyCollection.map(App.addIndices)
          
          print(quarterlyCollection,"Quarterly col")
          
          // a year identifier should be added here

          var uniqueQuarters = quarterlyCollection.aggregate_array('quarter_year').distinct().sort();

          // produces a list with as much as images as quarters
          var quarterlyImages = uniqueQuarters.map(function (quarter) {
            // Filters the collection per quarter and returns as much images as quarters were provided
            return App.getQuarterlyStatistics(quarter, quarterlyCollection);
          });
          // print(quarterlyImages,"quarters")
      
          var quarterlyStatsCollection = ee.ImageCollection(quarterlyImages);
      
          // Aplicar filtros espaciales cuando son seleccionados
          if (App.filterOptions.mean) {
            filteredCollections.mean = App.applySpatialFilter(quarterlyStatsCollection, 'mean');
          }
          if (App.filterOptions.median) {
            filteredCollections.median = App.applySpatialFilter(quarterlyStatsCollection, 'median');
          }
          if (App.filterOptions.majority) {
            filteredCollections.majority = App.applySpatialFilter(quarterlyStatsCollection, 'majority');
          }
          // Imprime a la consola las imagenes de la colección trimestral
          // Guarda en la variable de colecciones procesadas fuera del IF Trimestral
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
        var periodCollection = imageCollection.map(App.addIndices)
        print(periodCollection, "collection after select bands")
    
        var imageCount = periodCollection.size();
        var startDate = ee.Date(periodCollection.first().get('system:time_start'));
        var endDate = ee.Date(periodCollection.sort('system:time_start', false).first().get('system:time_start'));
  
    
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
    /**
   * Pulls every image in an ee.ImageCollection to the client
   * and adds it to the map with simple RGB viz.
   */
  displayMedianComposites: function(collection) {
  // 1) Get the count of images in the collection
  collection.size().evaluate(function(n) {
      if (n === 0) {
        App.ui.forms.updateMessage("No hay imágenes para mostrar.", true);
        return;
      }
      // 2) Build a server-side list of exactly n images
      var imgList = collection.toList(n);
      // 3) Loop client-side and add each median composite
      for (var i = 0; i < n; i++) {
        var img = ee.Image(imgList.get(i))
                     .select(['B4_median','B3_median','B2_median']);
        var viz = { min: 0, max: 0.3 };                  // stretch
        var name = 'Mediana_' + (i + 1);
        App.ui.forms.mainPanel_Map.addLayer(img, viz, name);
      }
    });
  },
  
  // Populate the vars panel
  
  populate_panel: function (checkboxPanel, listCheck, objectforStoring) {
    // Clear any existing widgets
    checkboxPanel.clear();

    listCheck.forEach(function (varName) {
        // Create the checkbox
        var checkbox = ui.Checkbox(varName, true);

        //  tell the checkbox to run your update function when clicked 
        checkbox.onChange(App.updateSelectedVarsList);

        // Store the checkbox widget itself
        objectforStoring.push(checkbox);

        // Add the checkbox to the panel
        checkboxPanel.add(checkbox);
    });
    
    App.updateSelectedVarsList(); 

  },
  
  updateSelectedVarsList: function() {
    // Start with an empty list each time
    var selectedNames = [];

    // Loop through the array of checkbox WIDGETS
    App.selected_vars.forEach(function(checkbox) {
        // If a checkbox is checked, add its name (the label) to the list
        if (checkbox.getValue()) {
            selectedNames.push(checkbox.getLabel());
        }
    });

    // Update the app's state with the fresh list of names
    App.selectedVars = selectedNames;

    
  },
  /**
  * Creates a list of derived band names from selected base variables.
  * For each base variable, it appends statistical suffixes (_mean, _median, etc.).
  * @param {Array<string>} selectedBaseVars A list of base variable names like ['B4', 'NDVI'].
  *  @returns {ee.List} A server-side list of derived band names for use with .select().
  */
  getDerivedBandNames: function (selectedBaseVars) {
    var derivedNames = []; // Standard JavaScript array
    var stats = ['_mean', '_median', '_min', '_max', '_stdDev'];
  
    selectedBaseVars.forEach(function(baseVar) {
      stats.forEach(function(stat) {
        // Simple, instant string concatenation in the browser
        derivedNames.push(baseVar + stat);
      });
    });
    print(derivedNames,"Objeto de variables a descargar")
    return derivedNames; // Returns ['NDVI_mean', 'NDVI_median', ...]
},
  //getDerivedBandName_serverside: function(selectedBaseVars) {
  //  var derivedNames = ee.List([]); // Start with an empty server-side list
  //  var stats = ['_mean', '_median', '_min', '_max', '_stdDev'];
    
  //  // Ensure selectedBaseVars is a client-side array before iterating
  //  if (!Array.isArray(selectedBaseVars)) {
  //    print('Error: Input to getDerivedBandNames is not an array.');
  //    return ee.List([]); // Return empty to prevent errors
  //  }

  //  selectedBaseVars.forEach(function(baseVar) {
  //    stats.forEach(function(stat) {
  //      // Add the new derived name to the server-side list
  //      derivedNames = derivedNames.add(ee.String(baseVar).cat(stat));
  //    });
      
  //  });
    
  //  return derivedNames;
  //},

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
        var varlist = App.available_variables.bands.concat(App.available_variables.indexes);
        App.populate_panel(this.available_vars_panel,varlist,App.selected_vars );
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
        this.controlPanel.add(this.label_available_vars);
        this.controlPanel.add(this.available_vars_panel);
        
        


        this.controlPanel.add(this.label_spatialFilters);
        this.controlPanel.add(this.checkbox_mean);
        this.controlPanel.add(this.checkbox_median);
        this.controlPanel.add(this.checkbox_majority);
        this.controlPanel.add(this.label_spatialFilterSize);
        this.controlPanel.add(this.slider_filterSize);
        this.controlPanel.add(this.button_generate);
        this.controlPanel.add(this.button_download);
        this.controlPanel.add(this.link_documentation);
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
        value: 'Aplicación de procesamiento y descarga de imágenes satelitales - PINV01-528',
        style: { fontSize: '25px', color: '#8b8b8b',textAlign: 'center'}
      }),
      label_aoi: ui.Label({
        value: 'Área de interés',
        style: {  fontWeight: 'bold' }
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
      label_propertyID: ui.Label({value:'Especifique el ID del área de interés (asset)', style:{'fontWeight': 'bold'}}),
      textBox_propertyAssetID: ui.Textbox({
        placeholder: 'Especifique ID de la tabla',
        value: 'projects/ee-lc-monitoring/assets/tpd_area',
        style:{'width':'320px'}
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
      label_Period_start: ui.Label({value:'Fecha de inicio del periodo (YYYY-MM-DD)',style:{'fontWeight': 'bold'}}),
      label_Period_end: ui.Label({value:'Fecha de fin del periodo (YYYY-MM-DD)',style:{'fontWeight': 'bold'}}),
      textBox_Period_start: ui.Textbox({
        placeholder: 'aaaa-mm-dd',
        value: '2021-01-01',
        style: { fontSize: '12px', textAlign: 'left', width: '100px' }
      }),
      textBox_Period_end: ui.Textbox({
        placeholder: 'aaaa-mm-dd',
        value: '2021-06-30',
        style: {  fontSize: '12px', textAlign: 'left', width: '100px' }
      }),
      label_cloudCover: ui.Label({value:'Porcentaje máximo de nubes',style:{'fontWeight': 'bold'}}),
      slider_cloudCover: ui.Slider({
        min: 0,
        max: 100,
        value: 1,
        step: 1,
        style: { width: '200px' }
      }),
      label_timeAggregation: ui.Label({value:'Agrupación temporal',style:{'fontWeight': 'bold'}}),
      
      select_timeAggregation: ui.Select({
      items: ['Trimestral', 'Semanas ISO', 'Periodo Completo'], // Added 'Periodo Completo'
      placeholder: 'Seleccione un tipo de análisis',
      onChange: function (selected) {
        App.selectedTimeAggregation = selected;
        }
      }),
      
      label_available_vars: ui.Label({value:'Variables',style:{'fontWeight': 'bold'}}),
      available_vars_panel:ui.Panel({
          'layout': ui.Panel.Layout.flow('horizontal'),
          
          'style': {
              
              'stretch': 'horizontal',
               'shown':true,
              // 'backgroundColor': '#cccccc',
          },
      }),
      
       
      label_spatialFilters: ui.Label({value:'Filtros espaciales (opcional)',style:{'fontWeight': 'bold'}}),
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
      label_spatialFilterSize: ui.Label({value:'Tamaño del filtro espacial',style:{'fontWeight': 'bold'}}),
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
        style:{width:'150px'},
        onClick: function () {
          
        print('////// ----  Processing ---- ///// ');

          // This values are 
          var startDate = App.ui.forms.textBox_Period_start.getValue();
          var endDate = App.ui.forms.textBox_Period_end.getValue();
          var cloudCoverValue = App.ui.forms.slider_cloudCover.getValue();
          var analysisType = App.selectedTimeAggregation;
           
          App.report.start_date = startDate;
          App.report.end_date = endDate;
          App.report.cloud_cover_perc = cloudCoverValue;
          App.report.analysisType = analysisType;
         
 
      // print("Párametros:",App.report)
      // Optional: Print to the console to see the live result
      print('Selected Variables:', App.selectedVars);
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
            
            var imageCollection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
              .filterDate(startDate, endDate)
              .filterBounds(App.aoi)
              .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloudCoverValue))
              .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9',  'B11', 'B12',"QA60"])
              .map(App.addQuarterAndIsoWeek)
              .map(s2_tools.rescaleBands)
              
            // Collection for gap filling 
            var imageColl_voidfilling =  imageCollection
            
            // Store the filtered collection for   

            App.Image_Col_to_process = imageCollection
            // Only count ISO weeks if the selected time aggregation is "Semanas ISO"
            if (analysisType === 'Semanas ISO') {
              // This is just informative and will produce and store counts about the disponibility of 
              //iso weeks within the date range
              App.countIsoWeeks(startDate, endDate, imageCollection);
            }
      
            var count = imageCollection.size();
           App.report.img_count_total = count
           App.report.img_count_quarters = imageCollection.aggregate_array('quarter_year').distinct().sort()
           App.report.img_count_months = imageCollection.aggregate_array('yearMonth').distinct().sort();
           App.report.img_count_iso_weeks = imageCollection.sort('date').aggregate_array('isoWeek_year').distinct();
            
          print("Parameters:",App.report)

            count.evaluate(function (cnt) {
              if (cnt === 0) {
                App.ui.forms.updateMessage("No se encontraron imágenes con los parámetros especificados.", true);
              } else {
                
                // Run the processing

                 // Cloud masking and void filling process
                 var gapFilledCollection = App.applyCloudMaskAndFillVoids(imageCollection);
                // Time aggregation
                App.applyTimeAnalysis(gapFilledCollection);
                App.ui.forms.updateMessage("Análisis completado. Visualizando resultados…", false);
                
                 App.ui.forms.mainPanel_Map.layers().reset();// (re‐add your AOI layer here if you want it to stay visible)
                // Now show every generated composite on the map:
                print("Processed collections: ",App.processedCollection )
                App.displayMedianComposites(App.processedCollection);
                
                
              }
            });
          });
  }
}),
   button_download: ui.Button({
  label: 'Descargar',
  style:{width:'150px'},
  onClick: function () {
    if (!App.processedCollection) {
      App.ui.forms.updateMessage("Por favor, genere los datos antes de descargar.", true);
      return;
    }

    App.ui.forms.updateMessage("Preparando archivos para descargar...", false);
    
    // Get the list of bands to export based on checkbox selections
    var bandsToExport = App.getDerivedBandNames(App.selectedVars);

    // Utilizar las colecciones procesadas almacenadas
    var reducedCollectionForExport  = App.processedCollection.select(bandsToExport); // Image or images temporally aggregated 
    var filteredCollectionsForExport  = {};// Image or images temporally aggregated 
    
    // Select bands from any spatially filtered collections that exist
    Object.keys(App.filteredCollections).forEach(function(filterType) {
      var originalFilteredCollection = App.filteredCollections[filterType];
      filteredCollectionsForExport[filterType] = originalFilteredCollection.select(bandsToExport);
      
    });
    
    var region = App.aoi.geometry();
    
    print("////// --- Download --- ////")
    //print
    print(reducedCollectionForExport,"reducedCollection")
    // Llamar a la función de exportación
    App.exportModule.exportAll(reducedCollectionForExport, filteredCollectionsForExport, region);
    
    

    App.ui.forms.updateMessage("Proceso de descarga iniciado, revise la pestaña Tasks.", false);
  }
}),
    link_documentation:ui.Label({
      value: 'Documentación',
      targetUrl: "https://github.com/carlosgl91/PINV01-528"
    })
    }

  },

  /////////////////////////////////////////////////////////////////////////////

};

App.init();
