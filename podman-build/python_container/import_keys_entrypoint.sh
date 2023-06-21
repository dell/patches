#!/bin/sh

export ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}
export CERT_DIRECTORY=${CERT_DIRECTORY}
export server_pem_file=${server_pem_file}
export root_ca_pem_file=${root_ca_pem_file}
export pkcs_file=${pkcs_file}

if [ -n "$server_pem_file" ] && [ -n "$root_ca_pem_file" ]; then
  python import_keys.py --root-cert-directory "${ROOT_CERT_DIRECTORY}" --cert-directory "${CERT_DIRECTORY}" \
    --server-pem-file "${server_pem_file}" --root-ca-pem-file "${root_ca_pem_file}"
elif [ -n "$pkcs_file" ]; then
  python import_keys.py --root-cert-directory "${ROOT_CERT_DIRECTORY}" --cert-directory "${CERT_DIRECTORY}" \
    --pkcs-file "${pkcs_file}"
else
  echo "Either provide both server_pem_file and root_ca_pem_file arguments or provide pkcs_file argument."
  exit 1
fi
