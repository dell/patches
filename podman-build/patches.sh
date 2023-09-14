#!/bin/bash

################################################################################
# Initial definitions required for the rest of the program                     #
################################################################################

SCRIPT_DIR=$(cd $(dirname $0); pwd)
TOP_DIR=$(cd ${SCRIPT_DIR}/../; pwd)
NGINX_CONFIG_DIR=${SCRIPT_DIR}/nginx_config
containers=("patches-psql" "patches-backend" "patches-frontend" "patches-httpd" "patches-nginx" )
cd ${TOP_DIR}
IMPORT_KEYS=1  # Used to determine if the code was run with import keys

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
  local password=false
  
  if [[ "$prompt" == *"--password"* ]]; then
    # --password is present in the prompt
    password=true
  fi

  # Print first line of 80 #
  printf '%.0s#' {1..80}
  echo

  # Wrap the prompt at 80 characters
  for word in $prompt; do
    if [[ "$word" != "--password" ]]; then  # Skip "--password" from the wrapped prompt
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
    fi
  done

  # Print prompt message
  echo -ne "${color}${wrapped_prompt}${reset_color}"

  # Print last line of 80 #
  echo
  printf '%.0s#' {1..80}
  echo

  # Read user input
  if [ "${password}" = true ]; then
    # Read password securely (hidden input)
    read -s input
  else
    read input
  fi

  # Set the value of RETURN_VALUE variable
  RETURN_VALUE="$input"
}


################################################################################
# Perform checks to make sure that the conditions required to run the program  #
# are met.                                                                     #
################################################################################

if [[ $(id -u) = 0 ]]; then
  patches_echo "Please do not run $(basename $0) as root, it is designed to be run as a normal user account that has podman permissions."
  exit 1
fi

if [[ $# -eq 0 ]] ; then
    patches_echo 'No arguments provided. Run with -h for help.'
    exit 1
fi

if ! command -v wget &>/dev/null; then
  patches_echo "wget is not installed. Please install wget to continue."
  exit 1
fi

################################################################################
# Function definitions                                                         #
################################################################################

# Function: get_ip_address
#
# Description: Prompts the user to select an interface with an assigned IPv4 address and UP/UP state.
#
# Environment Variables:
#   - interface: A global variable that stores the selected interface.
#   - ipv4_address: A global variable that stores the IPv4 address of the selected interface.
#
# Returns: None

function get_ip_address() {

  patches_echo "Checking interfaces..."
  # Check for invalid interfaces and inform the user that they are ignored
  for iface in $(ip addr | awk '/state/ {print $2}' | sed 's/://; /^lo/d' | grep -v "${interfaces}")
  do
    patches_echo "Ignored $iface because it is not in an UP/UP state with an assigned IPv4 address."
  done

  # Get a list of physical interfaces in an UP/UP state with an assigned IPv4 address
  interfaces=$(ip addr | awk '/state UP/ {print $2}' | sed 's/://; /^lo/d' | xargs -I {} sh -c 'if ip addr show {} | grep -q "inet "; then echo {}; fi')

  if [ -z "${interfaces}" ]; then
    patches_echo "No interfaces found with an assigned IPv4 address and UP/UP state."
    exit 1
  fi

  # Prompt the user to enter an interface
  patches_echo "List of available interfaces:"
  PS3=$(echo -e "\033[1;34mEnter the number of the interface you want to use: \033[0m")
  select interface in "${interfaces[@]}"
  do
    if [ -z "$interface" ]; then
      patches_echo "Invalid input. Please enter a number from 1 to $(echo "${#interfaces[@]}" | wc -w)."
    else
      ipv4_address=$(ip addr show "$interface" | awk '$1 == "inet" {gsub(/\/.*$/, "", $2); print $2}')
      patches_echo "Using interface $interface with IPv4 address $ipv4_address."
      break
    fi
  done
}


# Function to generate a random color code
get_random_color() {
    local colors=("31" "32" "33" "34" "35" "36")
    local num_colors=${#colors[@]}
    local random_index=$((RANDOM % num_colors))
    echo "${colors[random_index]}"
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

ascii_art=$(cat << "EOF"
    ___            _              _                      
   | _ \  __ _    | |_     __    | |_      ___     ___   
   |  _/ / _` |   |  _|   / _|   | ' \    / -_)   (_-<   
  _|_|_  \__,_|   _\__|   \__|_  |_||_|   \___|   /__/_  
_| """ |_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""| 
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'
EOF
)

# Call the function to print the ASCII art
print_ascii_art "$ascii_art"


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

# Function: parse_yaml
#
# Description: This function parses a YAML file and converts it to a Bash script.
#              It takes the path to the YAML file and a prefix as parameters.
#              The function processes the YAML file and generates Bash variable
#              declarations based on its contents.
#
# Parameters:
#   - $1: The path to the YAML file to parse.
#   - $2: The prefix to use for Bash variable names.
#
# Returns: None
#
function parse_yaml {
    local prefix=$2
    # Define regular expressions to match various parts of YAML syntax
    local s='[[:space:]]*'
    local w='[a-zA-Z0-9_]*'
    local fs=$(echo @|tr @ '\034')
    # Use sed to replace various parts of the YAML with Bash syntax
    sed -ne "s|^\($s\):|\1|" \
         -e "s|^\($s\)\($w\)$s:$s[\"']\(.*\)[\"']$s\$|\1$fs\2$fs\3|p" \
         -e "s|^\($s\)\($w\)$s:$s\(.*\)$s\$|\1$fs\2$fs\3|p"  $1 |
    # Use awk to create Bash variables based on the YAML data
    awk -F$fs '{
        indent = length($1)/2;
        vname[indent] = $2;
        for (i in vname) {
            if (i > indent) {
                delete vname[i]
            }
        }
        if (length($3) > 0) {
            vn="";
            for (i=0; i<indent; i++) {
                vn=(vn)(vname[i])("_")
            }
            printf("%s%s%s=\"%s\"\n", "'$prefix'",vn, $2, $3);
        }
    }'
}

# Function: configure_administrator
#
# Description: Configures the administrator for the PostgreSQL database. Executes an SQL script
#              within the specified PostgreSQL container to set up the admin user, roles, and permissions.
#
# Parameters:
#   - administrator_name: The name of the administrator for patches.
#
# Environment Variables:
#   - PSQL_USERNAME: The username for connecting to the PostgreSQL database.
#   - PSQL_PASSWORD: The password for connecting to the PostgreSQL database.
#   - PSQL_PORT: The port number for the PostgreSQL database.
#   - POSTGRES_DB: The name of the PostgreSQL database.
#
# Returns: None
#
configure_administrator() {
  patches_echo "Configuring ${1} as an administrator for the PostgreSQL database..."

  # URL encode the password
  urlencode() {
    local string="${1}"
    local strlen=${#string}
    local encoded=""
    local pos c o

    for ((pos = 0; pos < strlen; pos++)); do
      c="${string:$pos:1}"
      case "$c" in
        [-_.~a-zA-Z0-9]) o="${c}" ;;
        *) printf -v o '%%%02x' "'$c"
      esac
      encoded+="${o}"
    done
    echo "${encoded}"
  }
  encoded_password=$(urlencode "${PSQL_PASSWORD}")

  # Construct the connection URL with the encoded password
  connection_url="postgresql://${PSQL_USERNAME}:${encoded_password}@patches-psql:${PSQL_PORT}/${POSTGRES_DB}"

  # Check if the user already exists in the user_roles table
  user_exists=$(echo "SELECT COUNT(*) FROM user_roles WHERE username = '${1}';" | podman exec -i "patches-psql" psql -t "${connection_url}")

  if [ "${user_exists}" -eq 0 ]; then
    # User doesn't exist in user_roles table, insert a new row
    echo "-- SQL script for setting up admin user
      INSERT INTO users (name) VALUES ('${1}');
      INSERT INTO user_roles (username, role_id, updating_user)
      VALUES ('${1}', 1, 'System');
      " | podman exec -i "patches-psql" psql "${connection_url}"

    patches_echo "${1} added as a Patches administrator."
  else
    # User already exists in user_roles table, update the role
    echo "-- SQL script for updating admin role
      UPDATE user_roles SET role_id = 1, updating_user = 'System'
      WHERE username = '${1}';
      " | podman exec -i "patches-psql" psql "${connection_url}"

    patches_echo "${1}'s administrator role updated."
  fi
}

# Function: cleanup_containers
#
# Description: Stops and removes old containers for the specified names using podman.
#
# Parameters:
#   None
#
# Environment Variables:
#   None
#
# Returns: None
#
function cleanup_containers() {
  patches_echo "Removing any old containers..."
  for container in "${containers[@]}"
  do
    podman rm -f -t 0 $container

    # We ignore errors here beacuse if there are no volumes it will complain
    podman volume rm -f $(podman volume ls -q) 2> /dev/null || true
  done
}

# Function: reset_database
#
# Description: Resets the database by removing parsed XML files and running Knex database migrations.
#              It deletes the parsed XML files directory and executes Knex migrate:rollback and migrate:latest commands.
#
# Parameters: None
#
# Environment Variables:
# - TOP_DIR: The top-level directory path.
#
# Returns: None
#
function reset_database() {
  patches_echo "Reinitializing database by clearing the ${TOP_DIR}/repos/xml/parsed/ directory and resetting the PSQL database..."
  rm -rf ${TOP_DIR}/repos/xml/parsed/*
  podman exec -it patches-backend sh -c '/home/node/app/node_modules/knex/bin/cli.js migrate:rollback --knexfile /home/node/app/server/knexfile.js'
  podman stop patches-backend
  podman start patches-backend
}

# Function: build_drm
#
# Description: This function builds and runs the DRM (Dell Repository Manager) container.
#              It checks for available disk space, validates the DRM_INSTALL_URL variable,
#              extracts the version number from the URL, and performs the build using podman.
#
# Parameters: None
#
# Environment Variables:
# - DRM_INSTALL_URL: The URL pointing to the latest DRM version for Linux.
# - REQUIRED_SPACE: The minimum required disk space in GB for the installation.
#
# Returns: None
function build_drm() {

  podman rm -f -t 0 patches-drm

  if ask_yes_no "The code downloads several 10s of GB of data to populate the Enterprise PowerEdge catalog data for Patches. It checks if you have at least ${REQUIRED_SPACE}GB of disk space available, which is more than what the final container will use. There may be pauses of 60 seconds due to an expect script running to install DRM. Do you want to continue? If you would like more granular control of which patches are downloaded see https://github.com/dell/patches/blob/main/MANUALLY_PULL_REPOS.md."; then

    # Check available disk space of the partition containing ${TOP_DIR}/repos
    patches_echo "Checking which partition we are using..."
    partition=$(df -P "${TOP_DIR}/repos" | awk 'NR==2{print $1}')
    patches_echo "repos folder is on partition ${partition}..."
    available_space=$(df -BG --output=avail "$partition" | sed '1d;s/[^0-9]*//g')

    if [[ "$available_space" -lt "$REQUIRED_SPACE" ]]; then
      patches_echo "Insufficient disk space. At least ${REQUIRED_SPACE}GB of free space is required on the partition: $partition" --error
      patches_echo "Available disk space: $available_space GB" --error
      patches_echo "To check disk space, run the following command: df -BG --output=avail $partition | sed '1d;s/[^0-9]*//g'" --error
      exit 1
    else
      patches_echo "${partition} has sufficient disk space..."
    fi

    patches_echo "Disk space check passed. Continuing installation..."

    do_drm_build=true

    # Check if the DRM container image already exists
    if podman image exists localhost/dell/patches-drm:latest; then
      if ask_yes_no "The DRM container localhost/dell/patches-drm:latest already exists. Do you want to rebuild it from scratch? This probably isn't necessary."; then
        podman rm -f -t 0 patches-drm
        podman rmi -f patches-drm
      else
        do_drm_build=false
      fi
    fi

    if [ "$do_drm_build" = true ]; then
      read -n 1 -s -r -p $'\033[1;35mA script will run that automatically installs DRM. You will see prompts asking \nyou to press various keys. These inputs will be provided automatically. \nYou do not need to press anything. All required prompts for Patches will appear \nin blue. Press any key to continue.\033[0m'

      echo

      podman build \
      --tag dell/patches-drm:latest \
      --squash-all \
      -f "${SCRIPT_DIR}/Dockerfile.drm" \
      --build-arg "DRM_NAME=${DRM_NAME}" \
      "${TOP_DIR}"
    fi

    # Define the container name
    container_name="patches-drm"

    # Run the patches-drm container
    podman run -d --name "$container_name" localhost/dell/patches-drm:latest tail -f /dev/null

    # Get the user ID of drmuser from the container
    user_id=$(podman exec "$container_name" id -u drmuser)
    group_id=$(podman exec "$container_name" id -g drmuser)

    patches_echo "DRM user's ID is ${user_id}. Setting permissions on appropriate directories."

    # Change ownership of directories on the host system
    directories=("${TOP_DIR}/drm_repos/drm_download" "${TOP_DIR}/repos/xml")

    for directory in "${directories[@]}"; do
        chown -R ${user_id}:${group_id} "$directory"
    done

    # Stop and remove the container
    podman rm -f -t 0 "$container_name"

    patches_echo "Beginning DRM pull. This is roughly 30GBs. It is likely this is going to take a long time. Now is a good time to get a coffee."

    podman run \
      --name patches-drm \
      --volume ${TOP_DIR}/drm_repos/drm_download:/patches/drm_download:z \
      --volume ${TOP_DIR}/repos/xml:/patches/drm_export:z \
      localhost/dell/patches-drm:latest

    patches_echo "Restore original directory permissions..."
    for directory in "${directories[@]}"; do
      chown -R $(id -u):$(id -g) "$directory"
    done

    podman rm -f -t 0 "$container_name"

  else
    patches_echo "Installation cancelled." --error
    exit 1
  fi

}

# Function to check if unprivileged ports start at 80 or lower
check_unprivileged_ports() {
  if [ "$(sysctl -n net.ipv4.ip_unprivileged_port_start)" -le 80 ]; then
    return 0 # Ports already start at 80 or lower
  else
    return 1 # Ports don't start at 80 or lower
  fi
}

# check_nginx_status - checks if NGINX is up and running within a timeout of 1 minute
#
# This function checks if NGINX is running by sending a request to http://localhost:443.
# It waits for NGINX to start within a timeout duration of 60 seconds. If NGINX starts
# successfully, it echoes a success message. If the timeout is reached, it echoes an error
# message and exits with status 1.
#
# Parameters:
#   None
#
# Environment Variables:
#   None
#
# Returns:
#   None

check_nginx_status() {
  patches_echo "Waiting for NGINX to start..."
  elapsed_time=0
  TIMEOUT_DURATION=60 # Timeout duration in seconds

  while [ ${elapsed_time} -lt ${TIMEOUT_DURATION} ]; do
    if curl -s -o /dev/null http://localhost:443; then
      patches_echo "NGINX is up and running"
      break
    fi
    patches_echo "Attempting to connect to NGINX..."
    sleep 1
    elapsed_time=$((elapsed_time + 1))
  done

  if [ ${elapsed_time} -ge ${TIMEOUT_DURATION} ]; then
    patches_echo "NGINX failed to start within the timeout period of ${TIMEOUT_DURATION} seconds" --error
    exit 1
  fi
}

# run_nginx - runs an Nginx container using Podman
#
# This function generates the Nginx configuration, asks the user if they want to run with sudo, and then
# runs the Nginx container using Podman. If the user chooses to run with sudo, the container will listen
# on ports 80 and 443. If the user chooses not to run with sudo, the container will listen on port 8080.
#
# Parameters:
#   None
#
# Environment Variables:
#   TOP_DIR - the top-level directory of the Patches application
#   SCRIPT_DIR - the directory in which to write the Nginx configuration file
#   NGINX_VERSION - the version of Nginx to use for the container
#
# Returns:
#   None
function run_nginx() {

  # Check if unprivileged ports start at 80 or lower
  if check_unprivileged_ports; then
    patches_echo "Unprivileged ports already start at 80 or lower. Skipping."
    podman run \
      --name patches-nginx \
      --env-file ${TOP_DIR}/.patches-nginx \
      --volume ${SCRIPT_DIR}/nginx_config/nginx.conf:/etc/nginx/nginx.conf:Z \
      --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:z \
      --publish 443:443 \
      --publish 80:80 \
      --detach \
      --network host-bridge-net \
      docker.io/library/nginx:${NGINX_VERSION}
  else
    # Ask if user wants to run as sudo
    if ask_yes_no "In order to run Patches on ports 80 (redirects to 443) and 443 you will need to change the unprivileged ports on your host to start at port 80. This allows non-root users to bind to any port 80 and higher. You can continue without sudo privileges in which case nginx will run on a high port of your choosing. Users will have to explicitly add the port to all URLs when doing this. Do you want to run as sudo?"; then
      patches_echo "Enter your password *NOTE: on STIGed servers you will have to do enter the password multiple times*:"

      if sudo -v 2>/dev/null; then
        patches_echo "Current user is a sudo user"
      else
        patches_echo "This user does not have sudo privileges. You will need to give this user sudo privileges in order to continue." --error
        exit 1
      fi

      patches_echo "Setting unprivileged ports to start at port 80..."
      sudo sysctl net.ipv4.ip_unprivileged_port_start=80
      sudo touch /etc/sysctl.d/local.conf
      echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.d/local.conf

      patches_echo "Starting nginx. nginx will listen on ports 80 and 443. Port 80 will redirect to 443..."

      podman run \
        --name patches-nginx \
        --env-file ${TOP_DIR}/.patches-nginx \
        --volume ${SCRIPT_DIR}/nginx_config/nginx.conf:/etc/nginx/nginx.conf:Z \
        --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:z \
        --publish 443:443 \
        --publish 80:80 \
        --detach \
        --network host-bridge-net \
        docker.io/library/nginx:${NGINX_VERSION}

    else
      # Prompt the user for the nginx port and validate it
      while true; do
        patches_read "What port would you like to use for nginx?"
        nginx_port="$RETURN_VALUE"

        if (( nginx_port >= 1025 && nginx_port <= 65535 )); then
          break
        else
          patches_echo "Invalid port. Please choose a port within the range 1025 - 65535."
        fi
      done

      patches_echo "Running nginx on port ${nginx_port}. Users will need to manually add both https:// and the port :${nginx_port} to the Patches URL to access it." 

      # Update the config file with the NGINX_PORT
      sed -i "s/^NGINX_PORT:.*/NGINX_PORT: ${nginx_port}/" "${SCRIPT_DIR}/config.yml"

      podman run \
        --name patches-nginx \
        --env-file ${TOP_DIR}/.patches-nginx \
        --volume ${SCRIPT_DIR}/nginx_config/nginx.conf:/etc/nginx/nginx.conf:Z \
        --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:z \
        --publish ${nginx_port}:443 \
        --detach \
        --network host-bridge-net \
        docker.io/library/nginx:${NGINX_VERSION}
    fi
  fi

  check_nginx_status

}

# generate_certificates - This function generates certificates required for
# the server. It ensures that any old containers are cleaned up before running
# the certificate generation process. The function uses Podman to run a
# containerized process that executes a script called
# generate_certificates_entrypoint.sh.
#
# Parameters:
#   None
#
# Environment Variables:
#   - TOP_DIR: The top directory path.
#   - CERT_DIRECTORY: The directory where certificates will be stored.
#   - SCRIPT_DIR: The directory path of the script.
#
# Returns:
#   None
function generate_certificates() {

  # Check if variables interfaces or ipv4_address are not defined
  if [[ -z ${interfaces+x} || -z ${ipv4_address+x} ]]; then
    get_ip_address
  fi

  # Setup environment variables for the certificate generator
  echo "IPV4_ADDRESS=${ipv4_address}" > ${TOP_DIR}/.patches-certificate-generator
  echo "ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}" >> ${TOP_DIR}/.patches-certificate-generator
  echo "CERT_DIRECTORY=${CERT_DIRECTORY}" >> ${TOP_DIR}/.patches-certificate-generator

  # Check to see if the generic client names are still present
  if [[ -n ${clients_gelante+x} ]] && [[ -n ${clients_geleisi+x} ]]; then
    if ask_yes_no "The default client names gelante and geleisi are still present in ${SCRIPT_DIR}/config.yml. This means when you generate keys the only clients that will be available will be named gelante and geleisi. You will likely want to change this to your own client information by modifying ${SCRIPT_DIR}/config.yml. See https://github.com/dell/patches#customizing-setup for details. Would you like to stop the setup?"; then
      patches_echo "Terminating." --error
      exit 1
    fi
  fi

  # Make sure any old containers are cleaned up
  podman rm -f patches-certificate-generator || true

  podman run \
    --name patches-certificate-generator \
    -it \
    --env-file ${TOP_DIR}/.patches-certificate-generator \
    --volume ${TOP_DIR}/${CERT_DIRECTORY}:/app/${CERT_DIRECTORY}:Z \
    --volume ${SCRIPT_DIR}/config.yml:/app/config.yml:Z \
    --entrypoint /app/generate_certificates_entrypoint.sh \
    localhost/dell/patches-python:latest

  # Make sure any old containers are cleaned up
  podman rm -f patches-certificate-generator || true

  # Reparse the YAML file because it has been updated
  eval "$(parse_yaml "${SCRIPT_DIR}/config.yml")"

  printf $'\033[1;35mYour user certificates have been generated. They are available in\n %s/server_certs. Press any key to continue.\033[0m\n' "${TOP_DIR}"
  read -n 1 -s -r -p ""

}

# wait_for_postgresql - waits for PostgreSQL to start within a timeout duration
#
# This function waits for PostgreSQL to be available by executing the `pg_isready` command
# with the specified parameters. It waits until PostgreSQL is ready or the timeout duration
# is reached. If PostgreSQL starts successfully, it echoes a success message. If the timeout
# is reached, it echoes an error message and exits with status 1.
#
# Parameters:
#   None
#
# Environment Variables:
#   POSTGRES_DB - the name of the PostgreSQL database
#   PSQL_USERNAME - the username to connect to PostgreSQL
#   PSQL_HOST - the host address of PostgreSQL
#   PSQL_PORT - the port number of PostgreSQL
#
# Returns:
#   None
wait_for_postgresql() {
  patches_echo "Waiting for PostgreSQL to start..."
  start_time=$(date +%s)
  timeout=60

  until podman exec patches-psql pg_isready --dbname=${POSTGRES_DB} --username=${PSQL_USERNAME} --host=${PSQL_HOST} --port=${PSQL_PORT} >/dev/null 2>&1; do
    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))

    if [[ $elapsed_time -ge $timeout ]]; then
      patches_echo --error "PostgreSQL did not start within ${timeout} seconds."
      exit 1
    fi

    patches_echo "PostgreSQL is not yet available. Retrying..."
    sleep 1
  done

  patches_echo "PSQL server is up and running"
}

# run_postgresql starts a PSQL server and configures the administrator for the PostgreSQL database
#
# Parameters:
#   None
#
# Environment variables:
#   PSQL_VERSION: Version of the PostgreSQL container image to use
#   PATCHES_ADMINISTRATOR: Username of the administrator for the PostgreSQL database
#   PSQL_USERNAME: Username to use for connecting to the PostgreSQL server
#   POSTGRES_DB: Name of the PostgreSQL database
#   PSQL_PORT: Port number on which the PostgreSQL server is running
#   TOP_DIR: Path to the top-level directory
#
# Returns:
#   None
function run_postgresql() {

  patches_echo "Running PSQL server"

  podman run \
    --name "patches-psql" \
    --env-file ${TOP_DIR}/.patches-psql \
    --volume psql-storage:/var/lib/postgresql/data:Z \
    --network host-bridge-net \
    --detach \
    docker.io/library/postgres:${PSQL_VERSION}

  # Wait for PostgreSQL to be available
  wait_for_postgresql

}

# run_patches_services starts the patches-backend and patches-frontend applications using podman
#
# Parameters:
#   None
#
# Environment variables:
#   TOP_DIR: Path to the top-level directory
#   CERT_DIRECTORY: Path to the certificate directory
#   FRONTEND_PORT: Port number for the patches-frontend application
#
# Returns:
#   None
function run_patches_services() {

  # Set NODE_ENV to production for production mode
  echo "NODE_ENV=production" >> ${TOP_DIR}/.patches-backend
  echo "Running patches-backend in production mode"

  # Start podman in production mode
  podman run \
    --name patches-backend \
    --env-file ${TOP_DIR}/.patches-backend \
    --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:Z \
    --volume ${TOP_DIR}/repos/xml:/patches/xml:z \
    --volume ${TOP_DIR}/repos/xml/parsed:/patches/xml/parsed:z \
    --network host-bridge-net \
    --detach \
    localhost/dell/patches-base:latest \
    sh -c 'node /home/node/app/node_modules/knex/bin/cli.js --knexfile /home/node/app/server/knexfile.js migrate:latest && node /home/node/app/server/index.js'

  patches_echo "Running patches-frontend"
  echo "NODE_ENV=production" >> ${TOP_DIR}/.patches-frontend

  podman run \
    --name patches-frontend \
    --env-file ${TOP_DIR}/.patches-frontend \
    --network host-bridge-net \
    --detach \
    localhost/dell/patches-base:latest \
    sh -c "/home/node/app/node_modules/.bin/serve --listen tcp://0.0.0.0:${FRONTEND_PORT} /home/node/app/build"

}

# enable_cron_job enables the creation of a systemd service to run Patches on startup
#
# Parameters:
#   None
#
# Environment variables:
#   SCRIPT_DIR: Path to the directory containing the Patches script
#   USER: Username of the current user
#
# Returns:
#   None
function enable_cron_job() {

  # Check if the script is already executable
  if [ ! -x "$0" ]; then
      # Make the script executable
      chmod +x "$0"
      patches_echo "patches.sh is now executable."
  fi

  # Define the line to be added to the crontab
  CRON_LINE="@reboot $SCRIPT_DIR/patches.sh start"

  # Check if the line already exists in the crontab
  if ! (sudo -u $(whoami) crontab -l | grep -qF "$CRON_LINE"); then
      # If not found, add the line to the user's crontab
      (sudo -u $(whoami) crontab -l; echo "$CRON_LINE") | sudo -u $(whoami) crontab -
      patches_echo "Cron job added to start Patches."
  else
      patches_echo "Cron job already exists. Not adding it again."
  fi

}

# patches_build builds the necessary Docker images for the Patches application
#
# Parameters:
#   None
#
# Environment variables:
#   SCRIPT_DIR: Path to the directory containing the Dockerfiles
#   TOP_DIR: Path to the top-level directory
#
# Returns:
#   None
function patches_build() {

  local container_name="$1"

  if [[ -z "$container_name" ]]; then

    # Delete any old containers still running on the server
    cleanup_containers
    
    podman build \
      --tag dell/patches-python:latest \
      --squash-all \
      -f ${SCRIPT_DIR}/python_container/Dockerfile.python \
      --build-arg "PYTHON_CONTAINER_DIR=podman-build/python_container" \
      ${TOP_DIR}

    podman build \
      --tag dell/patches-base:latest \
      --squash-all \
      -f ${SCRIPT_DIR}/Dockerfile.patches_base \
      ${TOP_DIR}
  else
    case "$container_name" in
      "python")
        podman build \
          --tag dell/patches-python:latest \
          --squash-all \
          -f ${SCRIPT_DIR}/python_container/Dockerfile.python \
          --build-arg "PYTHON_CONTAINER_DIR=podman-build/python_container" \
          ${TOP_DIR}
        ;;
      "base")
        podman build \
          --tag dell/patches-base:latest \
          --squash-all \
          -f ${SCRIPT_DIR}/Dockerfile.patches_base \
          ${TOP_DIR}
        ;;
      *)
        echo "Invalid container name: $container_name"
        exit 1
        ;;
    esac
  fi

  ascii_art=$(cat << "EOF"
   ___              _       _        _                           
  | _ )   _  _     (_)     | |    __| |                          
  | _ \  | +| |    | |     | |   / _` |                          
  |___/   \_,_|   _|_|_   _|_|_  \__,_|                          
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|                         
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'                         
   ___                     _ __     _              _             
  / __|    ___    _ __    | '_ \   | |     ___    | |_     ___   
 | (__    / _ \  | '  \   | .__/   | |    / -_)   |  _|   / -_)  
  \___|   \___/  |_|_|_|  |_|__   _|_|_   \___|   _\__|   \___|  
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""| 
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'  
EOF
)

  print_ascii_art "$ascii_art"

}

# patches_setup performs the setup and configuration steps for Patches.
#
# Description: Performs the setup and configuration steps for Patches.
#   - Checks if the operating system is Rocky Linux.
#   - Prompts the user for the administrator name if PATCHES_ADMINISTRATOR is not set.
#   - Cleans up any old containers.
#   - Sets up environment variables for the Patches backend and frontend.
#   - Enables and starts the Podman service.
#   - Checks the presence of repository XML files and prompts the user to use Dell Repository Manager if no files are found.
#   - Configures Patches interfaces.
#   - Generates Nginx configuration.
#   - Checks for the presence of Patches build containers and builds them if missing.
#   - Removes old containers.
#   - Generates Nginx configuration.
#   - Sets up environment variables for the certificate generator.
#   - Checks for existing keys and prompts the user to continue or generate new keys.
#   - Runs PostgreSQL, Patches services, and Nginx.
#   - Runs an HTTP server container for servicing OME hosts.
#   - Configures the administrator for the PostgreSQL database.
#   - Enables the Patches systemd service.
#
# Parameters:
#   None
#
# Environment Variables:
#   - PATCHES_ADMINISTRATOR: The name of the administrator for Patches.
#
# Returns:
#   None
#
function patches_setup() {

  # Check if the current operating system is Rocky Linux

  if [ -f /etc/os-release ]; then
      source /etc/os-release
      if [[ $ID == "rocky" ]]; then
        patches_echo "Running on Rocky Linux..."
      else
        if ! ask_yes_no "You are not running Rocky Linux. Patches has only been tested on Rocky Linux and we recommend using Rocky Linux. While Patches was designed to run on all *nix flavors, you may run into errors unique to your OS. Do you want to continue?"; then
          patches_echo "Exiting" --error
          exit 1
        fi
      fi
  else
      patches_echo "Warning: Unable to determine the operating system." --error
  fi

  # Declare an associative array to store client names
  declare -A clients

  # Iterate over all defined variables
  for var in $(declare -p | cut -d' ' -f3); do
    # Check if the variable starts with "clients_" and extract the client name
    if [[ $var == clients_* ]]; then
      IFS='_' read -ra parts <<< "$var"
      if [[ ${#parts[@]} -gt 2 ]]; then
        client="${parts[1]}"
        clients["$client"]=1
      fi
    fi
  done

  # Build the client string
  client_string=""
  for client in "${!clients[@]}"; do
    client_string+=" $client"
  done

  # Trim leading space
  client_string=${client_string#" "}

  # Print the client string
  echo "$client_string"

  # Check if PATCHES_ADMINISTRATOR is empty. Will display different text if the user has imported keys vs generated keys
  if [ -z "$PATCHES_ADMINISTRATOR" ]; then
      if [ "$IMPORT_KEYS" -eq 1 ]; then
          patches_read "Please enter the name of the website administrator for patches. In your current ${SCRIPT_DIR}/config.yml you have defined the clients ${client_string}. Any of these will work as the administrator. This *MUST* match the common name on the certificate of the administrator. If it does not match the common name on the certificate you will not be able to access the admin panel. This does not create a local account. This account can see download statistics in the patches UI. You can add administrators later with \`${SCRIPT_DIR}/patches.sh add-admin <admin>.\`"
      else
          patches_read "Please enter the name of the website administrator for patches. This *MUST* match the common name on the certificate of the administrator. If it does not match the common name on the certificate you will not be able to access the admin panel. This does not create a local account. This account can see download statistics in the patches UI. You can add administrators later with \`${SCRIPT_DIR}/patches.sh add-admin <admin>.\`"
      fi
      administrator_name=${RETURN_VALUE}

      # Update the PATCHES_ADMINISTRATOR line in the config file
      sed -i "s/^PATCHES_ADMINISTRATOR:.*/PATCHES_ADMINISTRATOR: $administrator_name/" "${SCRIPT_DIR}/config.yml"

      patches_echo "Administrator name updated in the config file."
  else
      patches_echo "PATCHES_ADMINISTRATOR is already set to: $PATCHES_ADMINISTRATOR"
  fi

  # Check if PSQL_PASSWORD is empty
  if [ -z "$PSQL_PASSWORD" ]; then
      patches_read "Please enter the password you would like to use for the postgresql database" --password
      PSQL_PASSWORD=${RETURN_VALUE}

      # Update the PATCHES_ADMINISTRATOR line in the config file
      sed -i "s/^PSQL_PASSWORD:.*/PSQL_PASSWORD: $PSQL_PASSWORD/" "${SCRIPT_DIR}/config.yml"

      patches_echo "psql password updated"
  else
      patches_echo "PSQL_PASSWORD  is already set..."
  fi

  # Delete any old containers still running on the server
  cleanup_containers

  # Ask the user if they want to disable client certificate authentication
  if ask_yes_no "Do you want to disable client certificate authentication? Disabling client certificate authentication will make it so that users will not be rejected website entry if they do not provide a valid certificate. Note: **You will still need certificates for the admin panel.**"; then
    DISABLE_CLIENT_CERT_AUTH=true
  else
    DISABLE_CLIENT_CERT_AUTH=false
  fi

  # Ask the user if they want to disable client certificate requests
  if ask_yes_no "Do you want to disable client certificate requests? Disabling this means that users will not be prompted at all for a certificate when they visit the website. Only disabling client certificate authentication in the previous step means that users do not have to provide a valid certificate but they will still be prompted for a certificate of some type and that certificate will be logged. This setting effectively disables certificates completely. Users will not be prompted to provide one and this will also disable client certificate authentication. Note: **You will still need certificates for the admin panel.**"; then
    DISABLE_CLIENT_CERT_REQUEST=true
    DISABLE_CLIENT_CERT_AUTH=true
  else
    DISABLE_CLIENT_CERT_REQUEST=false 
  fi

  # TODO - See https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=31653546

  # Setup environment variables for the patches backend
  > ${TOP_DIR}/.patches-backend
  echo "PORT=${BACKEND_PORT}" >> ${TOP_DIR}/.patches-backend
  echo "DATABASE_URL=postgresql://${PSQL_USERNAME}:${PSQL_PASSWORD}@patches-psql:${PSQL_PORT}/patches" >> "${TOP_DIR}/.patches-backend"
  echo "SERVER_CA=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" >> "${TOP_DIR}/.patches-backend"
  echo "XML_PATH=/patches/xml" >> "${TOP_DIR}/.patches-backend"
  echo "PARSED_PATH=/patches/xml/parsed" >> "${TOP_DIR}/.patches-backend"
  echo "REPO_PATH=/patches/xml/" >> "${TOP_DIR}/.patches-backend"
  echo "SSL_ON=0" >> "${TOP_DIR}/.patches-backend" # This is for the connection to postgresql internally
  echo "DISABLE_CLIENT_CERT_AUTH=${DISABLE_CLIENT_CERT_AUTH}" >> "${TOP_DIR}/.patches-backend"
  echo "DISABLE_CLIENT_CERT_REQUEST=${DISABLE_CLIENT_CERT_REQUEST}" >> "${TOP_DIR}/.patches-backend"
  source ${TOP_DIR}/.patches-backend

  # Setup the environment variables for the postgres container
  > ${TOP_DIR}/.patches-psql
  echo "POSTGRES_USER=${PSQL_USERNAME}" >> ${TOP_DIR}/.patches-psql
  echo "POSTGRES_PASSWORD=${PSQL_PASSWORD}" >> ${TOP_DIR}/.patches-psql
  echo "POSTGRES_DB=${POSTGRES_DB}" >> ${TOP_DIR}/.patches-psql

  # Setup environment variables for the patches frontend
  > ${TOP_DIR}/.patches-frontend
  echo "BACKEND_PORT=${BACKEND_PORT}" >> ${TOP_DIR}/.patches-frontend
  echo "PORT=${FRONTEND_PORT}" >> ${TOP_DIR}/.patches-frontend

  systemctl enable --now --user podman podman.socket

  # Check to make sure the user has added the repository files
  xml_files=(`find ./repos/xml -maxdepth 2 -name "*.xml"`)
  if [ ${#xml_files[@]} -gt 0 ]; then 
      echo true 
  else
      patches_echo "We did not find any XML files in the repos/xml/* folders. Your repo XML file should be located in repos/xml/REPO_NAME/repo.xml. Note: the .xml extension is lower case."

      if ask_yes_no "Do you want to use Dell Repository Manager to pull the Enterprise Catalog automatically? If you already have the repository, you may ctrl+c, and then import your repo with \`bash ${SCRIPT_DIR}/patches.sh import-repository\` to import it."; then
        # Check if the DRM container image already exists
        build_drm
      else
          patches_echo "We cannot continue without the repository. Exiting." --error
          exit 1
      fi
  fi

  # Check if variables interfaces or ipv4_address are not defined
  if [[ -z ${interfaces+x} || -z ${ipv4_address+x} ]]; then
    get_ip_address
  fi

  # Create the nginx environment variable configuration file
  echo "IPV4_ADDRESS=${ipv4_address}" > "${TOP_DIR}/.patches-nginx"
  echo "INTERFACE=${interface}" >> "${TOP_DIR}/.patches-nginx"
  echo "SERVER_NAME=${SERVER_NAME}" >> "${TOP_DIR}/.patches-nginx"
  echo "SERVER_DOMAIN=${SERVER_DOMAIN}" >> "${TOP_DIR}/.patches-nginx"
  echo "SERVER_CERT=/patches/${CERT_DIRECTORY}/${SERVER_NAME}.${SERVER_DOMAIN}.crt" >> "${TOP_DIR}/.patches-nginx"
  echo "SERVER_KEY=/patches/${CERT_DIRECTORY}/${SERVER_NAME}.${SERVER_DOMAIN}.key" >> "${TOP_DIR}/.patches-nginx"
  echo "SERVER_CA=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" >> "${TOP_DIR}/.patches-nginx"
  echo "ROOT_CERT_DIRECTORY=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" >> "${TOP_DIR}/.patches-nginx"
  echo "ROOT_CERT_PATH=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}/${ROOT_CA_NAME}.${ROOT_CA_DOMAIN}.crt" >> "${TOP_DIR}/.patches-nginx"
  echo "CERT_DIRECTORY=/patches/${CERT_DIRECTORY}" >> "${TOP_DIR}/.patches-nginx"
  echo "BACKEND_PORT=${BACKEND_PORT}" >> ${TOP_DIR}/.patches-nginx
  echo "FRONTEND_PORT=${FRONTEND_PORT}" >> ${TOP_DIR}/.patches-nginx
  echo "DISABLE_CLIENT_CERT_AUTH=${DISABLE_CLIENT_CERT_AUTH}" >> ${TOP_DIR}/.patches-nginx
  echo "DISABLE_CLIENT_CERT_REQUEST=${DISABLE_CLIENT_CERT_REQUEST}" >> ${TOP_DIR}/.patches-nginx

  # Before continuing we need to make sure that all the build containers are present
  check_images

  # Remove any old containers
  podman rm -f -t 0 'patches-configure-nginx'

  # Generate the nginx configuration
  patches_echo "Generating nginx configuration..."
  podman run \
    --name patches-configure-nginx \
    --env-file ${TOP_DIR}/.patches-nginx \
    --volume ${SCRIPT_DIR}/python_container/nginx.conf.j2:/app/nginx.conf.j2:Z \
    --volume ${SCRIPT_DIR}/nginx_config:/app/nginx_config:Z  \
    --entrypoint /app/configure_nginx_entrypoint.sh \
    localhost/dell/patches-python:latest

  # Remove the configuration container after it is finished
  podman rm -f -t 0 'patches-configure-nginx'

  # Check if keys already exist in the cert directory and if they do prompt the user whether they want to continue
  # with key generation.

  patches_echo "Running validate_certs to make sure certs match..."

  if [[ -n "${ROOT_CA_PEM}" && -n "${SERVER_PEM}" ]]; then
    if [[ -f "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}/${ROOT_CA_PEM}" && -f "${TOP_DIR}/${CERT_DIRECTORY}/${SERVER_PEM}" ]]; then
      validate_certs "${ROOT_CA_PEM}" "${SERVER_PEM}"
    else
      missing_files=()
      if [[ ! -f "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}/${ROOT_CA_PEM}" ]]; then
        missing_files+=("${ROOT_CA_PEM}")
      fi
      if [[ ! -f "${TOP_DIR}/${CERT_DIRECTORY}/${SERVER_PEM}" ]]; then
        missing_files+=("${SERVER_PEM}")
      fi
      missing_files_list=$(IFS=", "; echo "${missing_files[*]}")
      if ! ask_yes_no "Error: The following PEM files specified in the variables ROOT_CA_PEM or SERVER_PEM do not exist:\n\n ${missing_files_list}\n\nDo you want to generate new certificates instead? Type no to terminate patches. You can import existing certificates with \`bash ${SCRIPT_DIR}/patches.sh import-keys <args>\`" --error; then
        patches_echo "Terminating." --error
        exit 1
      else
        generate_certificates
      fi
    fi
  else
    if ! ask_yes_no "No existing certificates configured. Type yes to continue with automatic certificate generation. Type no to terminate patches. You can import existing certificates with \`bash ${SCRIPT_DIR}/patches.sh import-keys <args>\`"; then
      patches_echo "Terminating." --error
      exit 1
    else
      generate_certificates
    fi
  fi

  run_postgresql

  run_patches_services

  run_nginx

  podman run -dit --name patches-httpd --publish 8080:80 --volume ${TOP_DIR}/repos/xml/:/usr/local/apache2/htdocs/:z docker.io/library/httpd:${HTTPD_VERSION}

  patches_echo "Checking if the server is running..."

  if [[ -z $(podman inspect --format '{{.State.Running}}' patches-psql | grep -i true) ]]; then
      patches_echo  "It appears that the PSQL server (patches-psql) container failed to deploy correctly. Try checking its status with 'podman logs patches-psql'." --error
      exit 1
  fi

  if [[ -z $(podman inspect --format '{{.State.Running}}' patches-backend | grep -i true) ]]; then
      patches_echo  "It appears that the Patches backend (patches-backend) container failed to deploy correctly. Try checking its status with 'podman logs patches-backend'." --error
      exit 1
  fi

  if [[ -z $(podman inspect --format '{{.State.Running}}' patches-frontend | grep -i true) ]]; then
      patches_echo  "It appears that the Patches frontend (patches-frontend) container failed to deploy correctly. Try checking its status with 'podman logs patches-frontend'." --error
      exit 1
  fi

  # SQL script for setting up admin user
  patches_echo "Configuring ${PATCHES_ADMINISTRATOR} as the administrator for the PostgreSQL database..."
  configure_administrator "${PATCHES_ADMINISTRATOR}"

  enable_cron_job

  echo "setup_complete" > ${SCRIPT_DIR}/.container-info-patches.txt

  patches_echo "Setup has finished and Patches is running as expected!"

  read -n 1 -s -r -p $'\033[1;35mPlease ensure ports 80, 443, and 8080 are open on your firewall.
Port 80 will redirect to port 443. Port 8080 is used to host an HTTP server for
servicing OME hosts. If you do not open these ports, the service will not work.
Press any key to continue...\033[0m'


  echo 

  ascii_art=$(cat << "EOF"
   ___             _               _ __                          
  / __|    ___    | |_    _  _    | '_ \                         
  \__ \   / -_)   |  _|  | +| |   | .__/                         
  |___/   \___|   _\__|   \_,_|   |_|__                          
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|                         
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'                         
   ___                     _ __     _              _             
  / __|    ___    _ __    | '_ \   | |     ___    | |_     ___   
 | (__    / _ \  | '  \   | .__/   | |    / -_)   |  _|   / -_)  
  \___|   \___/  |_|_|_|  |_|__   _|_|_   \___|   _\__|   \___|  
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""| 
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'  
EOF
)

  print_ascii_art "$ascii_art"

  eval "$(parse_yaml "${SCRIPT_DIR}/config.yml")"

  # Print Setup Summary with random color codes
  echo -e "\e[$(get_random_color)m################################################################################
# Setup Summary:
#   Patches Administrator Name: ${PATCHES_ADMINISTRATOR}
#   Patches Server URL: https://${ipv4_address} or https://${SERVER_NAME}.${SERVER_DOMAIN}
#   Patches Client Certificate Directory: ${TOP_DIR}/${CERT_DIRECTORY}
#
# Next Steps:
#   Next you need to set up client certificates so you can access Patches!
#
#   1. Grab your client certs (.p12) from ${CERT_DIRECTORY} and download them to
#      your local computer.
#   2. Follow the instructions at https://github.com/dell/patches#setting-up-certs
#   3. Don't forget after you import them to restart your browser!
#   4. Add ${SERVER_NAME}.${SERVER_DOMAIN} to your DNS server
#
# Helpful Tips:
#   - If you need to add an admin use ${SCRIPT_DIR}/patches.sh add-admin <admin_common_name>
#   - If you are using OpenManage Enterprise, check out: 
#     https://github.com/dell/patches#openmanage-enterprise-ome
#   - Run \`${SCRIPT_DIR}/patches.sh -h\` for help
#   - If you want to pull new patches run \`${SCRIPT_DIR}/patches.sh pull-patches\`
################################################################################
\e[0m"
}

# import_keys is responsible for importing certificates and keys for Patches
#
# Parameters:
#   If two arguments are provided:
#     arg1: The root CA public certificate (and optionally private key) in PEM format.
#     arg2: The server private key/public certificate in PEM format.
#
#   If one argument is provided:
#     arg1: The file path to a PKCS file which includes the root CA public certificate and the server's public certificate/private key.
#
# Environment Variables:
#   CERT_DIRECTORY: Path to the certificate directory
#   ROOT_CERT_DIRECTORY: Path to the root certificate directory
#   TOP_DIR: Path to the top-level directory
#   SCRIPT_DIR: Path to the directory containing the script
#
# Returns:
#   None
#
# Exits:
#   1: If the number of arguments is less than 1 or too many arguments are provided
#
function import_keys() {

  IMPORT_KEYS=0

  check_images

  if [[ "$#" -lt 2 ]]; then
    patches_echo "Error: import-keys takes arguments in two formats. The first is the root CA public certificate (and optionally private key) in PEM format and the server private key/public certificate in PEM format. The second is a single argument containing the file path to a PKCS file which includes the root CA public certificate and the server's public certificate/private key. Exiting." --error
    exit 1
  fi

  shift

  # Make sure any old containers are cleaned up
  podman rm -f import-keys || true

  echo "ROOT_CERT_DIRECTORY=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" > ${TOP_DIR}/.patches-import-keys
  echo "CERT_DIRECTORY=/patches/${CERT_DIRECTORY}" >> ${TOP_DIR}/.patches-import-keys

  # Remove any old values in config.yml
  # Define the keys to search and remove the values
  keys=("ROOT_CA_PEM:" "SERVER_PEM:" "PKCS_FILE:")

  # Iterate over each key
  for key in "${keys[@]}"; do
    # Search for the key and remove the value
    sed -i "s/\($key\).*$/\1/" "${SCRIPT_DIR}/config.yml"
  done

  mkdir -p "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}"

  if [[ "$#" -eq 2 ]]; then
    root_ca_public_key="$1"
    server_key="$2"

    # Check if server_key is an absolute path
    if [[ ! "$server_key" = /* ]]; then
      patches_echo "Error: Server key path must be an absolute path. This command does not accept relative paths." --error
      exit 1
    fi

    # Check if root_ca_public_key is an absolute path
    if [[ ! "$root_ca_public_key" = /* ]]; then
      patches_echo "Error: Root CA public key path must be an absolute path. This command does not accept relative paths." --error
      exit 1
    fi

    # Copy server key to CERT_DIRECTORY if the target and source are different
    if [[ "${server_key}" != "${TOP_DIR}/${CERT_DIRECTORY}/$(basename "${server_key}")" ]]; then
      cp -f "${server_key}" "${TOP_DIR}/${CERT_DIRECTORY}"
    fi

    # Copy root CA public key to CERT_DIRECTORY/ROOT_CERT_DIRECTORY if the target and source are different
    if [[ "${root_ca_public_key}" != "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}/$(basename "${root_ca_public_key}")" ]]; then
      cp -f "${root_ca_public_key}" "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}"
    fi

    echo "server_pem_file=/patches/${CERT_DIRECTORY}/${server_pem_file}" >> ${TOP_DIR}/.patches-import-keys
    echo "root_ca_pem_file=/patches/${CERT_DIRECTORY}/${root_ca_pem_file}" >> ${TOP_DIR}/.patches-import-keys

    podman run \
      --name import-keys \
      -it \
      --env-file ${TOP_DIR}/.patches-import-keys \
      --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:Z \
      --volume ${SCRIPT_DIR}/config.yml:/app/config.yml:Z \
      --entrypoint /app/import_keys_entrypoint.sh \
      localhost/dell/patches-python:latest
  elif [[ "$#" -eq 1 ]]; then
    pkcs_file="$1"

    patches_read "Enter the password for your PKCS#12 file. If there is no password, leave this empty." --password

    if [[ -n "$RETURN_VALUE" ]]; then
      pkcs_password="$RETURN_VALUE"
    fi

    echo "pkcs_file=/patches/${CERT_DIRECTORY}/$(basename ${pkcs_file})" >> ${TOP_DIR}/.patches-import-keys

    # Check if pkcs_file is an absolute path
    if [[ ! "$pkcs_file" = /* ]]; then
      patches_echo "Error: PKCS file path must be an absolute path. This command does not accept relative paths." --error
      exit 1
    fi

    # Copy PKCS file to CERT_DIRECTORY if the target and source are different
    if [[ "${pkcs_file}" != "${TOP_DIR}/${CERT_DIRECTORY}/$(basename "${pkcs_file}")" ]]; then
      cp -f "${pkcs_file}" "${TOP_DIR}/${CERT_DIRECTORY}"
    fi

    # Add PKCS_PASSWORD as environment variable if pkcs_password is not empty
    # The syntax ${pkcs_password:+--env PKCS_PASSWORD="$pkcs_password"} checks if pkcs_password is not empty
    # If it is not empty, it adds the option "--env PKCS_PASSWORD=<value>" to the command
    podman run \
      --name import-keys \
      -it \
      --env-file ${TOP_DIR}/.patches-import-keys \
      ${pkcs_password:+--env PKCS_PASSWORD="$pkcs_password"} \
      --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:Z \
      --volume ${SCRIPT_DIR}/config.yml:/app/config.yml:Z \
      --entrypoint /app/import_keys_entrypoint.sh \
      localhost/dell/patches-python:latest

  else
    patches_echo "Too many arguments provided to import-keys. import-keys command requires one or two arguments - the root CA public key in PEM format and the server private/public key in PEM format, or a single argument containing the file path to a PKCS file which includes the root CA public key and the server's public/private key. Exiting." --error
  fi

  # Cleanup the container
  podman rm -f import-keys || true

  if ask_yes_no "Do you want to run setup now to install your keys? If you do not run setup the keys will not be applied to Patches until you next run setup."; then
    
    # Reparse the YAML file because it has been updated
    eval "$(parse_yaml "${SCRIPT_DIR}/config.yml")"

    patches_setup
  fi
}

function validate_certs() {

  # Reparse the YAML file because it has been updated
  eval "$(parse_yaml "${SCRIPT_DIR}/config.yml")"

  # Make sure any old containers are cleaned up
  podman rm -f import-keys || true

  echo "ROOT_CERT_DIRECTORY=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" > ${TOP_DIR}/.patches-import-keys
  echo "CERT_DIRECTORY=/patches/${CERT_DIRECTORY}" >> ${TOP_DIR}/.patches-import-keys
  echo "server_pem_file=/patches/${CERT_DIRECTORY}/${2}" >> ${TOP_DIR}/.patches-import-keys
  echo "root_ca_pem_file=/patches/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}/${1}" >> ${TOP_DIR}/.patches-import-keys
  echo "VALIDATE=true" >> ${TOP_DIR}/.patches-import-keys

  podman run \
    --name import-keys \
    -it \
    --env-file ${TOP_DIR}/.patches-import-keys \
    --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:Z \
    --volume ${SCRIPT_DIR}/config.yml:/app/config.yml:Z \
    --entrypoint /app/import_keys_entrypoint.sh \
    localhost/dell/patches-python:latest

  # Make sure any old containers are cleaned up
  podman rm -f import-keys || true
}

# check_images is responsible for checking if the required Patches images exist.
#
# Parameters:
#   None
#
# Environment Variables:
#   None
#
# Returns:
#   0 if all images exist, 1 otherwise
#
check_images() {
  # Making sure Patches build has already run...
  patches_echo "Making sure Patches build has already run..."

  # List of required Patches images
  images=("localhost/dell/patches-base" "localhost/dell/patches-python")
  missing_images=()

  # Checking if each image exists
  for image in "${images[@]}"; do
    if ! podman image exists "$image" >/dev/null 2>&1; then
      missing_images+=("$image")
    fi
  done

  # Handling missing images
  if [[ ${#missing_images[@]} -gt 0 ]]; then
    read -n 1 -s -r -p $'\033[1;35mThere are missing Patches images. The Patches build will now run. Press any key to continue.\033[0m'
    echo 
    patches_build
    return 1
  else
    patches_echo "Patches images already present."
    return 0
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

# Function: patches_stop
#
# Description: Stops the containers used by Patches and checks their status.
#
# Parameters: None
#
# Environment Variables:
#   - containers: An array of container names
#
# Returns: None
#
function patches_stop() {

  if ! check_images; then
    patches_echo "Patches must be set up before running. Please run 'patches setup' first."
    exit 1
  fi

  podman stop patches-httpd
  podman stop patches-nginx
  podman stop patches-frontend
  podman stop patches-backend
  podman stop patches-psql

  # Loop over the containers
  for container_name in "${containers[@]}"; do
      # Check if the container exists
      if podman ps -a --format '{{.Names}}' | grep -q "$container_name"; then
          # Check if the container has exited (status code 0 indicates a correct exit)
          if [ "$(podman inspect -f '{{.State.ExitCode}}' "$container_name")" -eq 0 ]; then
              echo "Container '$container_name' has correctly exited."
          else
              echo "Container '$container_name' has exited with an error (Exit Code: $(podman inspect -f '{{.State.ExitCode}}' "$container_name"))."
          fi
      else
          echo "Container '$container_name' does not exist."
      fi
  done
}

# Function: patches_start
#
# Description: Starts the required containers used by Patches and checks their status.
#
# Parameters: None
#
# Environment Variables:
#   - containers: An array of container names
#
# Returns: None
#
function patches_start() {
  if ! check_images; then
    patches_echo "Patches must be set up before running. Please run 'patches setup' first."
    exit 1
  fi

  podman start patches-psql
  sleep 2
  podman start patches-backend
  sleep 8
  podman start patches-frontend
  sleep 2
  podman start patches-nginx
  podman start patches-httpd
  sleep 5

  # Print status for each container
  for container in "${containers[@]}"; do
      # Check if the container is in a running state
      if podman inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -q "true"; then
          patches_echo "Container '$container' is running."
      else
          patches_echo "Container '$container' is not running." --error
      fi
  done
}

# Function: patches_restart
#
# Description: Restarts the containers used by Patches and checks their status.
#
# Parameters: None
#
# Environment Variables:
#   - containers: An array of container names
#
# Returns: None
#
function patches_restart() {
  if ! check_images; then
    patches_echo "Patches must be set up before running. Please run 'patches setup' first."
    exit 1
  fi

  podman stop patches-httpd
  podman stop patches-nginx
  podman stop patches-frontend
  podman stop patches-backend
  podman stop patches-psql
  podman start patches-psql
  sleep 2
  podman start patches-backend
  sleep 8
  podman start patches-frontend
  sleep 2
  podman start patches-nginx
  podman start patches-httpd
  sleep 5

  # Loop over the containers
  for container in "${containers[@]}"; do
      # Check if the container is in a running state
      if podman inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -q "true"; then
          patches_echo "Container '$container' is running."
      else
          patches_echo "Container '$container' is not running." --error
      fi
  done
}

################################################################################
# Main program                                                                 #
################################################################################

# Call parse_yaml to create Bash variables from the YAML file
eval "$(parse_yaml "${SCRIPT_DIR}/config.yml")"

opts=$(getopt \
  -n $(basename "$0") \
  -o h \
  --longoptions "continuous" \
  --longoptions "container:" \
  -- "$@")
if [[ $? -ne 0 ]]; then
  opts="-h"
  echo
fi


# Color codes
COMMAND_COLOR='\e[1;34m'  # Blue
EXPLANATION_COLOR='\e[0;37m'  # Light gray

# Help menu
eval set -- "$opts"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h)
      echo -e "Usage:  $(basename "$0") (command) [--continuous|--container]"
      echo
      echo -e "Args:"
      echo -e "${COMMAND_COLOR}  rm${EXPLANATION_COLOR}                      Deletes all Patches containers, container images, and volumes."
      echo -e "${COMMAND_COLOR}  pull-patches${EXPLANATION_COLOR}            Forces a fresh pull of all available patches via DRM"
      echo -e "${COMMAND_COLOR}  build${EXPLANATION_COLOR}                   Builds the required containers for Patches"
      echo -e "${COMMAND_COLOR}  setup${EXPLANATION_COLOR}                   Runs Patches setup"
      echo -e "${COMMAND_COLOR}  start${EXPLANATION_COLOR}                   Start up containerized automation server services"
      echo -e "${COMMAND_COLOR}  stop${EXPLANATION_COLOR}                    Stop services"
      echo -e "${COMMAND_COLOR}  restart${EXPLANATION_COLOR}                 Restart all services"      
      echo -e "${COMMAND_COLOR}  run${EXPLANATION_COLOR}                     Allows you to run a command in the automation server container."
      echo -e "${COMMAND_COLOR}  status${EXPLANATION_COLOR}                  Get the status of all the component containers for Patches"
      echo -e "${COMMAND_COLOR}  logs${EXPLANATION_COLOR}                    Get the logs for all the Patches services. They will be written to \${TOP_DIR}/logs"
      echo -e "${COMMAND_COLOR}  add-admin${EXPLANATION_COLOR}               Add an administrator to the admins list for the Patches database. Expects the name"
      echo -e "${EXPLANATION_COLOR}                          of the administrator as an argument"
      echo -e "${COMMAND_COLOR}  reset-database${EXPLANATION_COLOR}          Reset the Patches database and reinitialize it."
      echo -e "${COMMAND_COLOR}  generate-certificates${EXPLANATION_COLOR}   Manually regenerate new certificates for the PKI infrastructure."
      echo -e "${COMMAND_COLOR}  install-service${EXPLANATION_COLOR}         Install the Patches service so it will start on startup. (requires sudo)"
      echo -e "${COMMAND_COLOR}  import-repository${EXPLANATION_COLOR}       Imports an existing repository into Patches"
      echo -e "${COMMAND_COLOR}  import-keys${EXPLANATION_COLOR}             Import existing keys for use with Patches. It accepts one of two argument styles."
      echo -e "${COMMAND_COLOR}  restart-nginx${EXPLANATION_COLOR}           Restarts nginx only. This can be necessary if patches-backend changes IP."
      echo -e "${COMMAND_COLOR}  version${EXPLANATION_COLOR}                 Prints the Patches version."
      echo -e "${EXPLANATION_COLOR}                          The first expects two arguments, the first is the file path to a root CA's public key"
      echo -e "${EXPLANATION_COLOR}                          (and optionally private key) in PEM format. The second is the file path to the Patches"
      echo -e "${EXPLANATION_COLOR}                          server public and private key combined in PEM format. WARNING: This command will fail"
      echo -e "${EXPLANATION_COLOR}                          if the PEM files have import passwords. The second option is to pass the path to a"
      echo -e "${EXPLANATION_COLOR}                          PKCS#12 file containing your server's certificate/private key and the trust chain."
      echo -e "${EXPLANATION_COLOR}                          The PKCS#12 file *can* contain a password."
      echo
      echo -e "Flags:"
      echo -e "${COMMAND_COLOR}  --continuous${EXPLANATION_COLOR}  Runs the 'start' command continuously, retrying failed services. This is primarily"
      echo -e "${EXPLANATION_COLOR}               meant for developer use"
      echo -e "${COMMAND_COLOR}  --container${EXPLANATION_COLOR}   Specifies the name of a specific container to build (optional)"
      echo
      exit 0
      ;;
    --continuous)
      CONTINUOUS="TRUE"
      ;;
    --container)
      shift
      CONTAINER_NAME="$1"
      ;;
    --)
      shift
      break
      ;;
  esac
  shift
done

# Make sure there are no spaces in SERVER_NAME
if [[ $SERVER_NAME == *" "* ]]; then
    patches_echo "Error: SERVER_NAME cannot contain spaces." --error
    exit 1
fi

# Make sure there is no overlap in any of the certificate names as this will cause failures.
# This lesson was learned over the course of an hour on a Saturday and I am sad.
if [[ "$ROOT_CA_NAME" == "$SERVER_NAME" || "$ROOT_CA_NAME" == "$BACKEND_CERT_NAME" || "$ROOT_CA_NAME" == "$FRONTEND_CERT_NAME" || "$SERVER_NAME" == "$BACKEND_CERT_NAME" || "$SERVER_NAME" == "$FRONTEND_CERT_NAME" || "$BACKEND_CERT_NAME" == "$FRONTEND_CERT_NAME" ]]; then
    patches_echo "Error: The following variable(s) have the same value and must be changed:" --error
    if [[ "$ROOT_CA_NAME" == "$SERVER_NAME" ]]; then
        patches_echo "- ROOT_CA_NAME and SERVER_NAME" --error
    fi
    if [[ "$ROOT_CA_NAME" == "$BACKEND_CERT_NAME" ]]; then
        patches_echo "- ROOT_CA_NAME and BACKEND_CERT_NAME" --error
    fi
    if [[ "$ROOT_CA_NAME" == "$FRONTEND_CERT_NAME" ]]; then
        patches_echo "- ROOT_CA_NAME and FRONTEND_CERT_NAME" --error
    fi
    if [[ "$SERVER_NAME" == "$BACKEND_CERT_NAME" ]]; then
        patches_echo "- SERVER_NAME and BACKEND_CERT_NAME" --error
    fi
    if [[ "$SERVER_NAME" == "$FRONTEND_CERT_NAME" ]]; then
        patches_echo "- SERVER_NAME and FRONTEND_CERT_NAME" --error
    fi
    if [[ "$BACKEND_CERT_NAME" == "$FRONTEND_CERT_NAME" ]]; then
        patches_echo "- BACKEND_CERT_NAME and FRONTEND_CERT_NAME" --error
    fi
    exit 1
fi

# Create the bridge network if it doesn't exist
if podman network inspect host-bridge-net &>/dev/null; then
    patches_echo "The 'host-bridge-net' network already exists. Skipping creation."
else
    # Create the host-bridge-net network
    podman network create --driver bridge host-bridge-net
    patches_echo "The 'host-bridge-net' network has been created."
fi

# Check if user inadvertently enabled podman as root
if systemctl is-enabled podman podman.socket; then
  patches_echo "It looks like you are running podman as root. You will need to disable this before continuing with 'systemctl disable --now podman podman.socket'" --error
  exit 1
fi

# Check if podman is installed
patches_echo "Checking if podman is installed..."
if ! which podman; then
  patches_echo "You need to install podman to continue." --error
  exit 1
fi

# Enable podman for user if it isn't already on with the remote socket present
# The test checks if the socket for podman exists. Use -e because it isn't a 
# regular file.
if ! test -e $(podman info --format '{{.Host.RemoteSocket.Path}}'); then
  patches_echo "podman service for user not enabled. Running 'systemctl enable --now --user podman podman.socket'"
  systemctl enable --now --user podman podman.socket
fi

# Export docker host and set it to the filepath of podman's socket
export DOCKER_HOST=unix://$(podman info --format '{{.Host.RemoteSocket.Path}}')

set -e

case $1 in
  rm)
    # Prompt for confirmation before proceeding
    if ! ask_yes_no "Are you sure you want to proceed with container and image deletion? This will remove absolutely everything!"; then
        patches_echo "Operation canceled." --error
        exit 1
    fi

    # Remove containers with time set to 0
    for container in "${containers[@]}"; do
        patches_echo "Removing container: $container"
        podman rm --force --time 0 "$container"
    done

    # Force delete images associated with the containers
    for container in "${containers[@]}"; do
        patches_echo "Deleting images for container: $container"
        image_ids=$(podman images --format "{{.ID}}" --filter "ancestor=$container")
        for image_id in $image_ids; do
            podman rmi --force "$image_id"
        done
    done

    # Delete volumes associated with the containers
    for container in "${containers[@]}"; do
        patches_echo "Deleting volumes for container: $container"
        volume_names=$(podman volume ls --format "{{.Name}}" --filter "label=com.docker.compose.service=$container")
        for volume_name in $volume_names; do
            podman volume rm "$volume_name"
        done
    done

    patches_echo "Container and image deletion complete."
    ;;

  pull-patches)

    podman rm -f -t 0 patches-drm

    # https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=31908626

    if ! ask_yes_no "There may be a Patches outage at stages of the pull as patches are reimported. Do you want to continue?"; then
      patches_echo "Terminating." --error
      exit 1
    fi

    build_drm

    patches_stop
    patches_start

    # Stop and remove the container
    patches_echo "Stopping and removing the DRM container..."
    podman rm -f -t 0 patches-drm
    patches_echo "New patches pulled!"
 
    ;;

  build)

    patches_build ${CONTAINER_NAME}

    ;;

  setup)

    patches_setup

    ;;

  stop)

    patches_stop

    ;;

  start)

    patches_start

    ;;

  restart)
  
    patches_restart

    ;;

  status)
    all_running=true

    for container in "${containers[@]}"; do
      if podman inspect "$container" >/dev/null 2>&1; then
        if podman container exists "$container" && podman container inspect --format '{{.State.Status}}' "$container" | grep -q "running"; then
          patches_echo "Container $container is up and running."
        else
          all_running=false
          patches_echo "Container $container is not running." --error
        fi
      else
        all_running=false
        patches_echo "Container $container not found." --error
      fi
    done

    if ! $all_running; then
      patches_echo "Not all of the containers are running. Patches is down." --error
    else
      patches_echo "Patches running as expected!"
    fi
    ;;

logs)
    logs_folder="logs"
    timestamp=$(date +"%Y%m%d%H%M%S")
    logs_folder_timestamped="${logs_folder}/${timestamp}-logs"
    tar_file="logs.tar.gz"

    mkdir -p "$logs_folder_timestamped"

    patches_echo "Getting the logs now. Sometimes it takes a few moments for the large logs..."

    for container in "${containers[@]}"; do
        error_log_file="${container}_error.log"
        standard_log_file="${container}_standard.log"

        patches_echo "Getting logs for container: $container"

        podman logs "$container" > "$logs_folder_timestamped/$standard_log_file" 2>> "$logs_folder_timestamped/$error_log_file"
    done

    tar -czvf "$tar_file" "$logs_folder_timestamped"

    patches_echo "Logs have been saved to ${TOP_DIR}/$tar_file and the folder ${TOP_DIR}/${logs_folder_timestamped}"
    ;;


  add-admin)

    shift
    if [[ $# -eq 0 ]]; then
      patches_echo "Error: Missing user argument for add-admin command." --error
      echo "Usage:  $(basename $0) add-admin [user]"
      exit 1
    fi
    USER="${1}"
    patches_echo "Adding administrator: $USER"
    configure_administrator ${1}

    ;;

  reset-database)
    
    reset_database

    ;;

  install-service)

      enable_cron_job

    ;;

  generate-certificates)
      # Check if any files exist in CERT_DIRECTORY or ROOT_CERT_DIRECTORY
      if [[ -n $(find "${TOP_DIR}/${CERT_DIRECTORY}" -type f -print -quit) || -n $(find "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" -type f -print -quit) ]]; then
          if ask_yes_no "It looks like certificates already exist. Do you want to delete them? If you say no, we will skip certificate generation."; then
              # Delete all files from CERT_DIRECTORY
              find "${TOP_DIR}/${CERT_DIRECTORY}" -type f -delete

              # Delete all files from ROOT_CERT_DIRECTORY
              find "${TOP_DIR}/${CERT_DIRECTORY}/${ROOT_CERT_DIRECTORY}" -type f -delete

              generate_certificates
              patches_setup
          else
              patches_echo "Skipping certificate generation."
          fi
      else
          generate_certificates
          patches_setup
      fi
      ;;

  import-keys)

    import_keys "$@"

    ;;

  import-repository)

    while true; do
      patches_read "Enter the location of the repository you would like to import. This should be a directory containing a catalog file and associated repository files."
      import_directory=${RETURN_VALUE}

      patches_echo "Setting directory permissions and ownership for ${import_directory}. \`chmod -R 775 ${import_directory}\`. This will fail if your user does not have the ability to run chmod against this directory."
      chmod -R 775 ${import_directory}
      chown "$(whoami)": -R ${import_directory}

      if validate_directory "$import_directory"; then
        if [[ -n $(find "$import_directory" -maxdepth 1 -type f -name "*.xml") ]]; then
          patches_echo "Directory validation complete..."
          break
        else
          patches_echo "There are no XML files found in the directory ${import_directory}. The catalog XML must be present - are you sure you got the path correct? Exiting." --error >&2  # Redirect error message to stderr
          exit 1
        fi
      else
        patches_echo "The specified location is not valid. Please try again." --error
      fi
    done

    if check_images; then
      if ! ask_yes_no "Patches will import $import_directory. When it does this it will remove the original directory to conserve space after the import. Patches will also be stopped during the import and then started afterwards. This should only take a few seconds to complete. Would you like to continue?"; then
        patches_echo "Terminating." --error
        exit 1
      fi
      patches_stop
      mv "$import_directory" "${TOP_DIR}/repos/xml"
      patches_start
    else
      mv "$import_directory" "${TOP_DIR}/repos/xml"
      if ask_yes_no "It looks like the Patches images are not yet configured. Do you want to run setup now?"; then
        patches_setup
      else
        patches_echo "Exiting."
        exit 0
      fi
    fi

    ;;

  restart-nginx)

    podman rm -f -t 0 patches-nginx
    run_nginx

    ;;

  version)

    patches_echo "The current version is v2.0.1-beta"

    ;;

  *)
    patches_echo "Invalid command entered. Type -h for help."
    exit 1
    ;;
esac
