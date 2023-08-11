#!/bin/bash

# Set the version to be downloaded
VERSION="v1.3.2-beta"

# Check if the script is being run as root
if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root."
  exit 1
fi

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

# Function: patches_read
#
# Description: Custom read command for Patches scripts. Prompts the user for input
#              and sets the text color to a bold blue.
#
# Parameters:
#   - prompt: The prompt message to display to the user.
#   - --password: (Optional) Use this option to securely read a password without displaying the input.
#
# Environment Variables:
#   - RETURN_VALUE: A global variable that stores the user input.
#
# Returns: The user input.
#
function patches_read() {
  local color='\033[1;34m'  # Bold blue color
  local reset_color='\033[0m'  # Reset color
  local prompt="$@"
  local wrapped_prompt=""
  local line_length=0

  # Print first line of 80 #
  printf '%.0s#' {1..80}
  echo

  # Wrap the prompt at 80 characters
  for word in $prompt; do
    if (( line_length + ${#word} > 80 )); then
      wrapped_prompt+="\n${word}"
      line_length=${#word}
    else
      if (( line_length > 0 )); then
        wrapped_prompt+=" ${word}"
        line_length=$(( line_length + ${#word} + 1 ))
      else
        wrapped_prompt+="${word}"
        line_length=${#word}
      fi
    fi
  done

  # Print prompt message
  echo -ne "${color}${wrapped_prompt}${reset_color}"

  # Print last line of 80 #
  echo
  printf '%.0s#' {1..80}
  echo

  # Read user input
  if [[ "$1" == "--password" ]]; then
    # Read password securely (hidden input)
    read -s input
  else
    read input
  fi

  # Set the value of RETURN_VALUE variable
  RETURN_VALUE="$input"
}

# Function: ask_yes_no
#
# Description: This function prompts the user with a yes/no question, validates the input,
#              and returns a boolean value indicating the user's choice.
#
# Parameters:
#   - prompt: The prompt message to display to the user.
#
# Returns:
#   - 0: If the user answers "yes".
#   - 1: If the user answers "no".
#
function ask_yes_no() {
  local prompt="$1 (yes/no): "
  local response

  while true; do
    patches_read "$prompt"
    response=${RETURN_VALUE}
    case "$response" in
      [Yy][Ee][Ss])
        return 0
        ;;
      [Nn][Oo])
        return 1
        ;;
      *)
        patches_echo "Invalid input. Please enter either 'yes' or 'no'."
        ;;
    esac
  done
}

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


# Function: check_user_namespace
#
# Description: Checks if user namespaces, setuid, and setgid are properly configured.
#              If any of the checks fail, it prompts the user for remediation.
#
# Parameters: None
#
# Returns: None
#
check_user_namespace() {
  local fix_applied=false

  # Check if user namespaces are enabled
  if [[ $(cat /proc/sys/user/max_user_namespaces) -eq 0 ]]; then
    if ask_yes_no "Error: User namespaces are not enabled. This usually happens when STIGs are applied or on older versions of Arch. Enabling this will allow the current user and only the current user to run containers on the system. We do this to minimize the privileges required.?"; then
      echo "Enabling user namespaces..."
      echo "user.max_user_namespaces=15000" | tee -a /etc/sysctl.conf > /dev/null
      sysctl -p
    else
      patches_echo "Terminating Patches bootstrap. Installation cannot continue." --error
      exit 1
    fi
  fi

  # Check if setuid is configured
  patches_echo "Contents of /etc/subuid:"
  cat /etc/subuid
  if ! grep -E "^${SUDO_USER}:[[:digit:]]+:[[:digit:]]+" /etc/subuid; then
    if ask_yes_no "Error: Setuid is not configured for the user. This usually happens when STIGs are applied or on older versions of Arch. Enabling this will allow user namespaces to work and keep all our containers running as user only. Do you want to remediate automatically?"; then
      echo "Configuring setuid..."
      sudo usermod --add-subuids 100000-200000 --add-subgids 100000-200000 "${SUDO_USER}"
    else
      patches_echo "Terminating Patches bootstrap. Installation cannot continue." --error
      exit 1
    fi
  fi

  # Check if setgid is configured
  patches_echo "Contents of /etc/subgid:"
  cat /etc/subgid
  if ! grep -E "^${SUDO_USER}:[[:digit:]]+:[[:digit:]]+" /etc/subgid; then
    if ask_yes_no "Error: Setgid is not configured for the user. This usually happens when STIGs are applied or on older versions of Arch. Enabling this will allow user namespaces to work and keep all our containers running as user only. Do you want to remediate automatically?"; then
      echo "Configuring setgid..."
      sudo usermod --add-subuids 100000-200000 --add-subgids 100000-200000 "${SUDO_USER}"
    else
      patches_echo "Terminating Patches bootstrap. Installation cannot continue." --error
      exit 1
    fi
  fi
}


# Function: validate_directory
#
# Description: Checks if the specified directory exists and is valid.
#
# Parameters:
#   - directory: The directory to validate.
#
# Returns:
#   - 0 if the directory exists and is valid.
#   - 1 if the directory does not exist or is invalid.
#
function validate_directory() {
  local directory=$1

  if [ ! -d "$directory" ]; then
    return 1
  fi

  return 0
}

# Function: ask_installation_location
#
# Description: Asks the user for the installation location and validates it.
#
# Returns:
#   - The validated installation location.
#
function ask_installation_location() {
  local location

  while true; do
    patches_read "Enter the folder path to the desired Patches installation location"

    # Remove trailing slash unless the input is just "/"
    if [[ "$RETURN_VALUE" != "/" ]]; then
      RETURN_VALUE=${RETURN_VALUE%/}
    fi

    if validate_directory "$RETURN_VALUE"; then
      break
    else
      patches_echo "The specified location is not valid. Please try again." --error
    fi
  done

  # Prompt the user to confirm the installation location
  local install_location="$RETURN_VALUE"
  if [[ "$install_location" != "/" ]]; then
    install_location="$install_location/patches"
  else
    install_location="/patches"
  fi

  while true; do
    if ask_yes_no "Patches will install to $install_location. Would you like to continue?"; then
      break
    else
      while true; do
        patches_read "Please enter a new installation location: "
        # Remove trailing slash unless the input is just "/"
        if [[ "$RETURN_VALUE" != "/" ]]; then
          RETURN_VALUE=${RETURN_VALUE%/}
          install_location="${RETURN_VALUE}/patches"
        else
          install_location="/patches"
        fi
        if validate_directory "$RETURN_VALUE"; then
          break
        else
          patches_echo "The specified location is not valid. Please try again." --error
        fi
      done
    fi
  done

  RETURN_VALUE=${install_location}

}

# Install wget
dnf install -y wget || { patches_echo "Error: Failed to install wget." --error; exit 1; }

rm -f ${VERSION}.tar.gz

# Download the source code
patches_echo "Running wget to grab Patches version ${VERSION}..."
wget "https://github.com/dell/patches/archive/refs/tags/${VERSION}.tar.gz" || { patches_echo "Error: Failed to download the source code." --error; exit 1; }

# Extract the source code to a temporary directory
tmp_dir=$(mktemp -d)
patches_echo "Untarring archive..."
tar -xf "${VERSION}.tar.gz" -C "$tmp_dir" --strip-components=1 || { patches_echo "Error: Failed to extract the source code." --error; exit 1; }
patches_echo "Removing tar file..."
rm -f "${VERSION}.tar.gz" || { patches_echo "Error: Failed to remove the unnecessary tar file." --error; exit 1; }

# Set the install location
ask_installation_location
INSTALL_DIR=${RETURN_VALUE}

# Remove existing 'patches' directory
if ! rm -rf "${INSTALL_DIR}"; then
  patches_echo "Error: Failed to remove existing 'patches' directory." --error
  exit 1
fi

# Move the extracted content to the installation location
mv "$tmp_dir" "$INSTALL_DIR" || { patches_echo "Error: Failed to move extracted content to the installation location." --error; exit 1; }

# Change ownership of the files
chown -R $SUDO_USER: ${INSTALL_DIR} || { patches_echo "Error: Failed to change ownership of the files." --error; exit 1; }

# Install Podman
dnf install -y podman || { patches_echo "Error: Failed to install Podman." --error; exit 1; }

check_user_namespace

# Test Podman privileges
su -c 'podman run hello-world' $SUDO_USER || { patches_echo "Error: Podman privileges test failed. Make sure Podman is properly installed and your user has the necessary permissions." --error; exit 1; }

# Open necessary ports
firewall-cmd --zone=public --add-port=80/tcp --add-port=443/tcp --add-port=8080/tcp --permanent || { patches_echo "Error: Failed to open necessary ports." --error; exit 1; }
firewall-cmd --reload || { patches_echo "Error: Failed to reload the firewall configuration." --error; exit 1; }

# Completion message
patches_echo -e "\n\033[1;33mPatches installation completed successfully. All files are owned by the current user.\033[0m"

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

echo -e "\nTo get started, run \033[1;32mbash ${INSTALL_DIR}/podman-build/patches.sh setup\033[0m"
