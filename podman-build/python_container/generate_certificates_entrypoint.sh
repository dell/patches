#!/bin/sh

export ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}
export CERT_DIRECTORY=${CERT_DIRECTORY}
export IPV4_ADDRESS=${IPV4_ADDRESS}

python generate_certificates.py --root-cert-dir "${ROOT_CERT_DIRECTORY}" --cert-dir "${CERT_DIRECTORY}" --ipv4-address ${IPV4_ADDRESS}
