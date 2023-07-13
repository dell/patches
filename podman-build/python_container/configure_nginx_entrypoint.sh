#!/bin/bash

# Set up environment variables
export SERVER_NAME=${SERVER_NAME}
export DOMAIN=${DOMAIN}
export IPV4_ADDRESS=${IPV4_ADDRESS}
export SERVER_CERT=${SERVER_CERT}
export SERVER_KEY=${SERVER_KEY}
export SERVER_CA=${SERVER_CA}
export ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}
export ROOT_CERT_PATH=${ROOT_CERT_PATH}
export CERT_DIRECTORY=${CERT_DIRECTORY}
export BACKEND_PORT=${BACKEND_PORT}
export FRONTEND_PORT=${FRONTEND_PORT}

# SERVER_CA, ROOT_CERT_DIRECTORY, and CERT_DIRECTORY are currently unused but I included them here because they may
# be useful in the future.
command="python configure_nginx.py --server-name ${SERVER_NAME} --domain ${DOMAIN} --ipv4-address ${IPV4_ADDRESS}"
command+=" --nginx-config-dir \"/app/nginx_config\" --server-cert ${SERVER_CERT} --server-key ${SERVER_KEY}"
command+=" --server-ca ${SERVER_CA} --root-cert-dir ${ROOT_CERT_DIRECTORY} --root-cert-path ${ROOT_CERT_PATH}"
command+=" --cert-dir ${CERT_DIRECTORY} --backend-port ${BACKEND_PORT} --frontend-port ${FRONTEND_PORT}"

if [[ ${DISABLE_CLIENT_CERT_AUTH} == 'true' ]]; then
  command+=" --disable-client-cert-auth"
fi

if [[ ${DISABLE_CLIENT_CERT_REQUEST} == 'true' ]]; then
  command+=" --disable-client-cert-request"
fi

eval $command