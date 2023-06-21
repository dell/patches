#!/bin/sh

export ROOT_CERT_DIRECTORY=${ROOT_CERT_DIRECTORY}
export CERT_DIRECTORY=${CERT_DIRECTORY}
export key_1=${key_1}
export key_2=${key_2}

python import_keys.py --root-cert-dir "${ROOT_CERT_DIRECTORY}" --cert-dir "${CERT_DIRECTORY}" --key-1 ${key_1} --key-2 ${key_2}
