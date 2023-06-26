#!/bin/bash

# Set the version to be downloaded
VERSION="v1.0.0-beta"

# Function: print_ascii_art
#
# Description: Prints ASCII art with random colors and a border of # symbols.
#
# Parameters:
#   - ascii_art: The ASCII art to be printed.
#
# Returns: None
#
function print_ascii_art() {
  local ascii_art=$1

  # Print the border of #
  printf '%.0s#' {1..80}
  echo

  # Save the current IFS value
  local original_ifs=$IFS

  # Set the IFS to empty to preserve leading/trailing spaces
  IFS=

  # Read each line of the ASCII art and print in random colors
  while IFS= read -r line; do
      color_code="\033[1;$(get_random_color)m"
      reset_color="\033[0m"
      printf "${color_code}%s${reset_color}\n" "$line"
  done <<< "$ascii_art"

  # Restore the original IFS value
  IFS=$original_ifs

  # Print the border of #
  printf '%.0s#' {1..80}
  echo
}

# Function to generate a random color code
get_random_color() {
    local colors=("31" "32" "33" "34" "35" "36")
    local num_colors=${#colors[@]}
    local random_index=$((RANDOM % num_colors))
    echo "${colors[random_index]}"
}

# Check if the user owns the current directory
[[ $(stat -c '%U' .) != $(whoami) ]] && { echo "Error: You do not own the current directory. Please make sure you have the necessary permissions."; exit 1; }

# Step 1: Install wget
sudo dnf install -y wget || { echo "Error: Failed to install wget."; exit 1; }

# Step 2: Download the source code
wget "https://github.com/dell/patches/archive/refs/tags/${VERSION}.tar.gz" || { echo "Error: Failed to download the source code."; exit 1; }

# Step 3: Create the 'patches' directory
mkdir patches || { echo "Error: Failed to create the 'patches' directory."; exit 1; }

# Step 4: Extract the source code
tar -xf "${VERSION}.tar.gz" -C patches --strip-components=1 || { echo "Error: Failed to extract the source code."; exit 1; }
rm -f "${VERSION}.tar.gz" || { echo "Error: Failed to remove the unnecessary tar file."; exit 1; }

# Step 5: Set the install location
INSTALL_DIR=$(pwd)/patches

# Step 6: Change ownership of the files
sudo chown -R $(whoami) $INSTALL_DIR || { echo "Error: Failed to change ownership of the files."; exit 1; }

# Step 7: Install Podman
sudo dnf install -y podman || { echo "Error: Failed to install Podman."; exit 1; }

# Step 8: Test Podman privileges
podman run hello-world || { echo "Error: Podman privileges test failed. Make sure Podman is properly installed and your user has the necessary permissions."; exit 1; }

# Step 9: Open necessary ports
sudo firewall-cmd --zone=public --add-port=80/tcp --add-port=443/tcp --add-port=8080/tcp --permanent || { echo "Error: Failed to open necessary ports."; exit 1; }
sudo firewall-cmd --reload || { echo "Error: Failed to reload the firewall configuration."; exit 1; }

# Step 10: Change ownership of the files to the current user
sudo chown -R $(whoami) $INSTALL_DIR || { echo "Error: Failed to change ownership of the files."; exit 1; }

# Completion message
echo -e "\n\033[1;33mPatches installation completed successfully. All files are owned by the current user.\033[0m"

ascii_art=$(cat << "EOF"
__      __          _                                       _
\ \    / / ___     | |     __      ___    _ __     ___     | |
 \ \/\/ / / -_)    | |    / _|    / _ \  | '  \   / -_)    |_|
  \_/\_/  \___|   _|_|_   \__|_   \___/  |_|_|_|  \___|   _(_)_
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_| """ |
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'
EOF
)

# Call the function to print the ASCII art
print_ascii_art "$ascii_art"

echo -e "\nTo get started, run \033[1;32mbash ./patches/podman-build/patches.sh setup\033[0m"