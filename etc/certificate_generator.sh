#!/bin/bash

# Check if OpenSSL is installed
if ! command -v openssl &>/dev/null; then
  echo "OpenSSL not found. Please install OpenSSL and try again."
  exit 1
fi

# Function to generate a random distinguished name
generate_distinguished_name() {
  echo "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=$RANDOM-domain.com"
}

# Step 1: Generate the Certificate Authority (CA)
CA_DIR="ca"
mkdir -p "$CA_DIR"
cd "$CA_DIR"
openssl genpkey -algorithm RSA -out ca.key
openssl req -new -x509 -key ca.key -out ca.crt -days 3650 -subj "$(generate_distinguished_name)"
cd ..

# Step 2: Generate the Client Certificate
CLIENT_DIR="client"
mkdir -p "$CLIENT_DIR"
cd "$CLIENT_DIR"
openssl genpkey -algorithm RSA -out client.key
openssl req -new -key client.key -out client.csr -subj "$(generate_distinguished_name)"
cd ..

# Step 3: Sign the Client Certificate with the CA
cd "$CA_DIR"
openssl x509 -req -in "../$CLIENT_DIR/client.csr" -CA ca.crt -CAkey ca.key -CAcreateserial -out "../$CLIENT_DIR/client.crt" -days 365
cd ..

# Step 4: Create a PKCS#12 file for the client certificate
cd "$CLIENT_DIR"
# Export the client certificate and include the CA certificate chain
openssl pkcs12 -export -out client.p12 -inkey client.key -in client.crt -certfile "../$CA_DIR/ca.crt"
cd ..

echo "Certificate generation completed successfully!"
