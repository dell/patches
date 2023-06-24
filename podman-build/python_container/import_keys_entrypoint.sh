#!/bin/bash

export ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}
export CERT_DIRECTORY=${CERT_DIRECTORY}
export server_pem_file=${server_pem_file}
export root_ca_pem_file=${root_ca_pem_file}
export pkcs_file=${pkcs_file}
export PKCS_PASSWORD=${PKCS_PASSWORD}
export VALIDATE=${VALIDATE}

if [ -n "$server_pem_file" ] && [ -n "$root_ca_pem_file" ]; then
  import_keys_args=(--root-cert-directory "${ROOT_CERT_DIRECTORY}" --cert-directory "${CERT_DIRECTORY}" \
    --server-pem-file "${server_pem_file}" --root-ca-pem-file "${root_ca_pem_file}")
  
  # Add --validate argument if VALIDATE is set to true
  if [ "$VALIDATE" = true ]; then
    import_keys_args+=(--validate)
  fi

  python import_keys.py "${import_keys_args[@]}"
elif [ -n "$pkcs_file" ]; then
  # Array to store import_keys.py arguments
  import_keys_args=(--root-cert-directory "${ROOT_CERT_DIRECTORY}" --cert-directory "${CERT_DIRECTORY}" \
    --pkcs-file "${pkcs_file}")

  # Add --pkcs-password argument if PKCS_PASSWORD is defined
  [ -n "$PKCS_PASSWORD" ] && import_keys_args+=(--pkcs-password "$PKCS_PASSWORD")

  # Add --validate argument if VALIDATE is set to true
  if [ "$VALIDATE" = true ]; then
    import_keys_args+=(--validate)
  fi

  # Execute import_keys.py with the constructed arguments
  python import_keys.py "${import_keys_args[@]}"
else
  echo "Either provide both server_pem_file and root_ca_pem_file arguments or provide pkcs_file argument."
  exit 1
fi
