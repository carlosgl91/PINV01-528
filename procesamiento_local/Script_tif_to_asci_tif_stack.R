
library(terra)
library(sf)
library(tidyverse)

if (!require('fs'))
  install.packages("fs")
library(fs)

if (!require('glue'))
  install.packages("glue")
library(glue)

################################################################### Init----
# ATENCION!!!!

# Todas las referencias con # REVIEW!!! necesitan modificacion cada vez que se cambie de directorio y o archivo de origen !!!

##### Directories ----

folder_to_export <- "G:/My Drive/Carlos_workspace/PINV01-528 SENEPA/raster_piloto/por_trimestre/2018/02_segundo_trimestre_2018/"# REVIEW!!!!

folder_to_load <- "G:/My Drive/Carlos_workspace/PINV01-528 SENEPA/raster_piloto/por_trimestre/2018/02_segundo_trimestre_2018/"# REVIEW!!!!

folder_list <-
  list(
    "geo_tif_stack", 
    "asci")
# Create the directories acording the 

for (i in 1:length(folder_list)) {
  
  folderss <- glue(folder_to_export,'/{folder_list[i]}')
  
  ifelse(!dir_exists(folderss), dir_create(folderss), print('Folder exists'))
  
}


# Name to export the asci files

##### Name parameters ----

prefix_file_name <- "trim_02_2018_"   # REVIEW!!!!
# Periodo inicio y final (corresponde a lo generado por la app)

prefix_file_name_for_stack <- "2018-04-04_to_2018-06-18"   # REVIEW!!!!
#asci
file_prefix_and_dir <- paste0(folder_to_load,"asci/",prefix_file_name)
file_prefix_and_dir

##### Data --------

# Stacks
# Raster multiband with variables without spatial filter
img_vars <- terra::rast(paste0(folder_to_load,"Period_2018-04-04_to_2018-06-18.tif")) # REVIEW!!!!

# Raster multiband with variables spatially filtered
img_vars_spatially_filtered <- terra::rast(paste0(folder_to_load,
                                                  "Period_Year_2018_spf_mean_Filtered_2018-04-04_to_2018-06-18.tif")) # REVIEW!!!!

#### Processing names

current_names <- names(img_vars_spatially_filtered)

# New band name
# This indicates spf <- Spatially filtered, x3 <- 3x3 window, mean <- filter type "mean"
# This will add the string to the first part of the band names
new_names <- paste0("spf_x3_mean_", current_names)

# Get the number of bands
num_bands <- nlyr(img_vars_spatially_filtered)

# Create new names with a string and band numbers
# new_names <- paste0("spf_x3_mean_", 1:num_bands) --- if we want to rename

# Assigning the bands to a new variable to modify within
raster_multi_band <- img_vars_spatially_filtered

# Set the new names
names(raster_multi_band) <- new_names

# Inspect
names(raster_multi_band) 

# Stack everything in
stacked_raster <- c(img_vars, raster_multi_band)
# Check names
names(stacked_raster) 

stacked_raster

#### Export to asci folder----

for (i in 1:nlyr(stacked_raster)) {
  writeRaster(stacked_raster[[i]], paste0(file_prefix_and_dir,glue("{names(stacked_raster[[i]])}.asc") ) , filetype="AAIGrid", overwrite=TRUE)

}

# Export stack
writeRaster(stacked_raster, paste0(folder_to_export,'geo_tif_stack/',prefix_file_name,prefix_file_name_for_stack,".tif"), filetype="GTiff", overwrite=TRUE)

