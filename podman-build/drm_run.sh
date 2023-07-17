#!/bin/bash

set -e

# Function: patches_echo
#
# Description: Custom echo command for Patches scripts. Changes the output color to a readable font
#              that stands out and adds a logging timestamp to each message.
#
# Parameters:
#   - message: The message to be printed.
#   - options: Additional options for customization. Supported options: "--error".
#
# Returns: None
#
function patches_echo() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  local color='\033[1;33m'  # Yellow color
  local error_color='\033[1;31m'  # Red color
  local reset_color='\033[0m'  # Reset color

  local message="$1"
  local option="$2"

  # Print first line of 80 #
  printf '%.0s#' {1..80}
  echo

  if [[ "$option" == "--error" ]]; then
    # Print timestamp and modified message in red color
    printf "${timestamp} - ${error_color}%s${reset_color}\n" "$message" | fold -sw 80
  else
    # Print timestamp and modified message in yellow color
    printf "${timestamp} - ${color}%s${reset_color}\n" "$message" | fold -sw 80
  fi

  # Print last line of 80 #
  printf '%.0s#' {1..80}
  echo
}

patches_echo "Sleeping for 10 seconds to make sure we're ready to start the repository manager service..."
sleep 10

patches_echo "Starting Dell repository manager service..."
/opt/dell/dellrepositorymanager/DRM_Service.sh &

patches_echo "Sleeping another 10 seconds to be sure the repository manager service is running..."
sleep 10

# Update catalogs
patches_echo "Updating all DRM catalogs before pull..."
/opt/dell/dellrepositorymanager/drm.sh --update --catalog=ALL

patches_echo "Sleeping 3 minutes to wait for DRM to update itself. Do not worry if it says there are no updates available or gives a Connection Refused error..."
sleep 180

patches_echo "Getting the catalog ID for the recent version of the enterprise catalog..."
# Get the catalog ID for the specified catalog name
output="$(/opt/dell/dellrepositorymanager/drm.sh -li=catalogs)"
catalog_name="Enterprise Server Catalog"
catalog_id=""

while IFS= read -r line; do
  if [[ $line == *"$catalog_name"* ]]; then
    catalog_id=$(echo "$line" | awk '{print $NF}')
    break
  fi
done <<< "$output"

# Check if the catalog ID was found
if [[ -n $catalog_id ]]; then
  patches_echo "Using catalog '$catalog_name': $catalog_id to generate repository."
else
  patches_echo "Could not find the catalog 'Enterprise Server Catalog' in the output of '/opt/dell/dellrepositorymanager/drm.sh -li=catalogs'. This is a bug and should be reported. The installation cannot continue." --error
  exit 1
fi

patches_echo "Extracting the current catalog name..."
catalog_name=$(/opt/dell/dellrepositorymanager/drm.sh -li=catalogs | sed -n 's/^[[:space:]]*Enterprise Server Catalog-\([0-9]\{2\}\.[0-9]\{2\}\.[0-9]\{2\}\).*$/Enterprise Server Catalog-\1/p')

# Create the folder
mkdir -p "/patches/drm_export/${catalog_name}"
patches_echo "Created folder /patches/drm_export/${catalog_name}..."

# Set DRM store path
patches_echo "Setting the DRM storepath to /patches/drm_download..."
/opt/dell/dellrepositorymanager/drm.sh --set --storepath="/patches/drm_download/"

# Create repository using the specified catalog ID
patches_echo "Creating the repository using catalog ID ${catalog_id}..."
/opt/dell/dellrepositorymanager/drm.sh --create --repository=patches --catalog="${catalog_id}"

# Configure DRM deployment type and location
patches_echo "Downloading the entire PowerEdge catalog (~30-35GBs) this will take a long time..."

download_output=$(/opt/dell/dellrepositorymanager/drm.sh --deployment-type=share --location="/patches/drm_export/${catalog_name}" --repository=patches 2>&1)

if [[ $download_output == *"Failed"* ]]; then
  patches_echo "Failed to create repository and download the catalog." --error
  patches_echo "drm.sh returned: ${download_output}" --error
  exit 1
else
  patches_echo "Repository creation and download completed successfully."
fi

# Wait for the export to finish. The command above will finish before the job is really done. This waits for the export
# to fully finish by looking for the appropriate catalog name. If this takes more than 30 minutes it will terminate
# the job.

# Define the timeout in seconds (30 minutes)
timeout=$((30 * 60))

start_time=$(date +%s)
elapsed_time=0

patches_echo "Waiting for file patches_1.00_Catalog.xml in /patches/drm_export/${catalog_name}. This usually takes several minutes. The timeout for this job is 30 minutes..."

while [ ! -f "/patches/drm_export/${catalog_name}/patches_1.00_Catalog.xml" ]; do
    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))

    if [ $elapsed_time -gt $timeout ]; then
        patches_echo "Timeout exceeded. File not found after 30 minutes. It looks like something went wrong with the export. This could be a bug or something is running very slowly." --error
        exit 1
    fi

    sleep 1
done

patches_echo "File patches_1.00_Catalog.xml found in /patches/drm_export/${catalog_name}..."
patches_echo "Pull completed..."
