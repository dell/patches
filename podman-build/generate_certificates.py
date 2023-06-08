import argparse
import logging
import os
import textwrap
import time
from datetime import datetime, timedelta
from getpass import getpass
from ipaddress import IPv4Address
from typing import Optional

import yaml
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509 import Certificate
from cryptography.x509.oid import NameOID


class PatchesLogHandler(logging.Handler):
    """Custom log handler for Patches scripts.

    This log handler customizes the log message formatting and output to match
    the text style of the `patches_echo` function in Bash, including colored
    output, timestamp, and 80-character separators.

    Attributes:
        None
    """

    def emit(self, record):
        """Emit a log record.

        This method overrides the `emit` method of the `logging.Handler` class
        to customize the log message formatting and output.

        Args:
            record (logging.LogRecord): The log record to be emitted.

        Returns:
            None
        """
        message = self.format(record)
        level = record.levelname.lower()
        if level == 'error' or level == 'warning':
            color = '\033[1;31m'  # Red color
        else:
            color = '\033[1;33m'  # Yellow color
        reset_color = '\033[0m'  # Reset color

        # Print first line of 80 #
        print('#' * 80)

        # Format the timestamp
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(record.created))

        # Determine the available width for the log message (80 - length of timestamp)
        available_width = 80 - len(timestamp) - 3  # Subtract 3 for timestamp formatting (space, dash, space)

        # Wrap the log message to available width at the nearest word boundary
        wrapped_message = textwrap.fill(message, width=available_width, break_long_words=False)

        # Print timestamp and modified message in the desired color
        print(f'{timestamp} - {color}{wrapped_message}{reset_color}')

        # Print last line of 80 #
        print('#' * 80)


# Set up logging with the custom log handler
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.handlers.clear()
handler = PatchesLogHandler()
handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(handler)


def patches_read(prompt):
    """Custom read command for Patches scripts.
    
    Prompts the user for input and sets the text color to a bold blue.
    
    Args:
        prompt (str): The prompt message to display to the user.
    
    Returns:
        str: The user input.
    """
    color = '\033[1;34m'  # Bold blue color
    reset_color = '\033[0m'  # Reset color

    # Print first line of 80 #
    print('#' * 80)

    # Wrap the prompt at 80 characters
    wrapped_prompt = ""
    line_length = 0
    words = prompt.split()
    for word in words:
        if line_length + len(word) > 80:
            wrapped_prompt += '\n' + word
            line_length = len(word)
        else:
            if line_length > 0:
                wrapped_prompt += ' ' + word
                line_length += len(word) + 1
            else:
                wrapped_prompt += word
                line_length = len(word)

    # Print prompt message
    print(f'{color}{wrapped_prompt}{reset_color}')

    # Print last line of 80 #
    print('#' * 80)

    # Read user input
    user_input = input()

    return user_input


def combine_keys_to_pem(private_key: rsa.RSAPrivateKey, certificate: Certificate) -> bytes:
    """
    Combines a private key and public certificate into a single PEM file.

    Args:
        private_key (rsa.RSAPrivateKey): The private key in cryptography.hazmat.primitives.asymmetric.rsa.RSAPrivateKey
                                         format.
        certificate (Certificate): The public certificate in Certificate format.

    Returns:
        bytes: The combined private and public keys in PEM format.
    """
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    )

    public_bytes = certificate.public_bytes(
        encoding=serialization.Encoding.PEM
    )

    pem = public_bytes + private_bytes

    return pem


def generate_pkcs12_certificate(name: str, private_key: rsa.RSAPrivateKey, certificate: Certificate,
                                root_certificate: Certificate, password: Optional[str] = None) -> bytes:
    """
    Converts the provided RSA private key, X.509 certificate, and root certificate to PKCS#12 format.

    Args:
        name (str): The human-readable name for the certificate.
        private_key (rsa.RSAPrivateKey): The RSA private key.
        certificate (Certificate): The X.509 certificate.
        root_certificate (Certificate): The root certificate.
        password (str, optional): The password for the PKCS#12 certificate. Default is None.

    Returns:
        bytes: The PKCS#12 certificate.
    """
    # Convert private key and certificate to PKCS#12 format
    pkcs12_data = pkcs12.serialize_key_and_certificates(
        name=name.encode('utf-8'),
        key=private_key,
        cert=certificate,
        cas=[root_certificate],
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode()) if password else serialization.NoEncryption(),
    )

    return pkcs12_data


def create_root_ca(country, state, locality, organization_name, root_ca_name, root_cert_directory):
    """Creates a new root Certificate Authority (CA) and private key.

    Args:
        country (str): The country name of the CA.
        state (str): The state or province name of the CA.
        locality (str): The locality name of the CA.
        organization_name (str): # The organization name for the certificate
        root_ca_name (str): The name of the root CA.
        root_cert_directory (str): The directory where the root CA certificates and keys will be stored.

    Returns:
        Tuple of RSAPrivateKey and Certificate: The private key and root CA certificate in
        cryptography.hazmat.primitives.asymmetric.rsa.RSAPrivateKey and cryptography.x509.Certificate formats,
        respectively.

    """

    if not os.path.exists(root_cert_directory):
        os.makedirs(root_cert_directory)
        logging.info(f"Created directory: {os.path.abspath(root_cert_directory)}")
    else:
        logging.info(f"Directory already exists: {os.path.abspath(root_cert_directory)}")

    # Check if key, certificate, or PEM files already exist
    logging.info("Checking if key, certificate, or PEM files already exist")
    key_file = os.path.join(root_cert_directory, f'{root_ca_name}.key')
    crt_file = os.path.join(root_cert_directory, f'{root_ca_name}.crt')
    pem_file = os.path.join(root_cert_directory, f'{root_ca_name}.pem')
    if os.path.isfile(key_file) and os.path.isfile(crt_file):
        # Check if user wants to use existing key and certificate files
        while True:
            use_existing_files = patches_read(f"{key_file} and {crt_file} were found in "
                                       f"{os.path.abspath(root_cert_directory)}. Do you want to use these files "
                                       f"instead of creating new certificates? (yes/no): ")
            if use_existing_files.lower() == 'yes':
                # Load key and certificate files
                logging.info('Reading existing root CA certificate and private key...')
                try:
                    with open(crt_file, 'rb') as f:
                        root_cert = x509.load_pem_x509_certificate(f.read(), default_backend())
                    with open(key_file, 'rb') as f:
                        root_private_key = serialization.load_pem_private_key(f.read(), password=None,
                                                                              backend=default_backend())
                    logging.info('CA cert and key loaded successfully.')
                    return root_private_key, root_cert
                except Exception as e:
                    logging.error(f"Error loading root CA certificate or private key: {e}")
                    return None
            elif use_existing_files.lower() == 'no':
                break
            else:
                logging.info('Please enter "yes" or "no".')

    elif os.path.isfile(pem_file):
        while True:
            use_existing = patches_read(f"{pem_file} was found in {os.path.abspath(root_cert_directory)}. Do you want to use "
                                 f"that file instead of creating a new certificate? (yes/no): ")
            if use_existing.lower() == "yes":
                # Load PEM file
                logging.info('Reading existing root CA certificate in PEM format...')
                try:
                    with open(pem_file, 'rb') as f:
                        root_cert = x509.load_pem_x509_certificate(f.read(), default_backend())
                    root_private_key = None
                    logging.info('CA cert loaded successfully.')
                    return root_private_key, root_cert
                except Exception as e:
                    logging.error(f"Error loading root CA certificate: {e}")
                    return None
            elif use_existing.lower() == "no":
                break
            else:
                logging.info("Invalid input. Please enter 'yes' or 'no'")
    else:
        patches_read(
            f"No root certificates in pem or key/crt format found (expects lowercase .pem or .key/crt). In "
            f"{os.path.abspath(root_cert_directory)}. Based on the variable root_ca_name in config.yml we checked for "
            f"{os.path.join(root_ca_name, os.path.abspath(root_cert_directory), root_ca_name)}(.key/.crt/.pem.) We are"
            f" now automatically going to create the root CA. If this is not what you want exit the program and "
            f"populate the root certificate directory with the appropriate .pem or .key/.crt files. Press enter to "
            f"continue.")

    # Generate private key
    logging.info("Generating private key")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
    )

    # Create and sign the root certificate
    logging.info("Creating and signing the root certificate")
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, country),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
        x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization_name),
        x509.NameAttribute(NameOID.COMMON_NAME, root_ca_name),
    ])

    public_key = (
        x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.utcnow())
            .not_valid_after(datetime.utcnow() + timedelta(days=3650))
            .add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=True,
        ).sign(private_key, hashes.SHA256())
    )

    # Write the key and certificate to files
    logging.info("Writing the key and certificate to files")
    with open(key_file, 'wb') as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    with open(crt_file, 'wb') as f:
        f.write(public_key.public_bytes(serialization.Encoding.PEM))

    logging.info("Concatenating the public and private keys into a single PEM file")
    pem = combine_keys_to_pem(private_key, public_key)
    with open(os.path.join(root_cert_directory, f"{root_ca_name}.pem"), "wb") as f:
        f.write(pem)

    return private_key, public_key


def create_ssl_cert(
        root_private_key: RSAPrivateKey,
        root_cert: Certificate,
        cert_directory: str,
        host_name: str,
        country: str,
        state: str,
        locality: str,
        organization_name: str,
        organization_unit: str,
        dns_1: str,
        days: int,
        dns_2: Optional[str] = None,
        ip_1: Optional[IPv4Address] = None,
        ip_2: Optional[IPv4Address] = None,
        password: bool = False) \
        -> None:
    """Creates a new SSL/TLS certificate for a server/client using a root CA.

    Args:
        root_private_key (RSAPrivateKey): The name of the root CA.
        root_cert (Certificate): The name of the directory where the root certificates are stored
        cert_directory (str): The directory where the SSL/TLS certificates and keys will be stored.
        host_name (str): The host_name of the server
        country (str): The country name of the server/client.
        state (str): The state or province name of the server/client.
        locality (str): The locality name of the server/client.
        organization_name (str): The organization name of the server/client.
        organization_unit (str): The organizational unit name of the server/client.
        dns_1 (str): The primary DNS name of the server/client.
        days (int): The number of days the certificate should be valid for
        dns_2 (str, optional): The secondary DNS name of the server/client. Defaults to None.
        ip_1 (IPv4Address, optional): The primary IP address of the server/client. Defaults to None.
        ip_2 (IPv4Address, optional): The secondary IP address of the server/client. Defaults to None.
        password (bool): Indicates whether the user does or does not want to enter a PKCS password

    Returns:
        None
    """

    logging.info(f"Processing {dns_1}...")

    logging.info("Creating private key...")

    # Generate an RSA key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # Write the key to a file. We replace *. to take care of the wildcard for the certificate generation
    with open(os.path.join(cert_directory, f"{host_name.replace('*.', '')}.key"), "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    logging.info("Created the private key")

    logging.info("Creating CSR...")

    # Create a new CSR object
    csr_builder = x509.CertificateSigningRequestBuilder()

    # Set the subject name of the CSR
    logging.info("Setting CSR subject name...")
    csr_builder = csr_builder.subject_name(x509.Name([
        x509.NameAttribute(x509.NameOID.COUNTRY_NAME, country),
        x509.NameAttribute(x509.NameOID.STATE_OR_PROVINCE_NAME, state),
        x509.NameAttribute(x509.NameOID.LOCALITY_NAME, locality),
        x509.NameAttribute(x509.NameOID.ORGANIZATION_NAME, organization_name),
        x509.NameAttribute(x509.NameOID.ORGANIZATIONAL_UNIT_NAME, organization_unit),
        x509.NameAttribute(x509.NameOID.COMMON_NAME, host_name)
    ]))

    # Set the extensions of the CSR
    logging.info("Setting CSR extensions...")
    names = []
    if dns_1 is not None:
        names.append(x509.DNSName(dns_1))
    if dns_2 is not None:
        names.append(x509.DNSName(dns_2))
    if ip_1 is not None:
        names.append(x509.IPAddress(ip_1))
    if ip_2 is not None:
        names.append(x509.IPAddress(ip_2))
    if names:
        csr_builder = csr_builder.add_extension(
            x509.SubjectAlternativeName(names),
            critical=False
        )

    # Sign the CSR using the private key
    logging.info("Signing the CSR using the private key...")
    csr = csr_builder.sign(private_key, hashes.SHA256(), default_backend())

    # Write the CSR to the file
    logging.info("Writing the CSR to the file...")
    # Replace *. to take care of the wildcard for the certificate generation
    with open(os.path.join(cert_directory, f"{host_name.replace('*.', '')}.csr"), 'wb') as f:
        f.write(csr.public_bytes(serialization.Encoding.PEM))

    logging.info(f"Created CSR at {os.path.join(cert_directory, f'{host_name}.csr')}")

    # Create the certificate by signing the CSR with the root certificate
    logging.info("Creating the cert.conf file...")
    builder = x509.CertificateBuilder()
    builder = builder.subject_name(csr.subject)
    builder = builder.issuer_name(root_cert.subject)
    builder = builder.public_key(csr.public_key())
    builder = builder.serial_number(x509.random_serial_number())
    builder = builder.not_valid_before(datetime.utcnow())
    builder = builder.not_valid_after(datetime.utcnow() + timedelta(days=days))
    if dns_2 or ip_1 or ip_2:
        san_list = [x509.DNSName(dns_1)]
        if dns_2:
            san_list.append(x509.DNSName(dns_2))
        if ip_1:
            san_list.append(x509.IPAddress(ip_1))
        if ip_2:
            san_list.append(x509.IPAddress(ip_2))
        builder = builder.add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        )

    # Sign the certificate using the root_key
    public_key = builder.sign(root_private_key, hashes.SHA256(), default_backend())

    # Write the certificate to the file. Replace *. to take care of the wildcard for the certificate generation
    with open(os.path.join(cert_directory, f"{host_name.replace('*.', '')}.crt"), "wb") as f:
        f.write(public_key.public_bytes(serialization.Encoding.PEM))

    # Concatenate the public and private keys into a single file. # Replace *. to take care of the wildcard for the
    # certificate generation
    pem = combine_keys_to_pem(private_key, public_key)
    with open(os.path.join(cert_directory, f"{host_name.replace('*.', '')}.pem"), "wb") as f:
        f.write(pem)

    # Export to PKCS#12
    if password:
        password = getpass(f"Enter the PKCS#12 password you want to use for the host {host_name}: ")

    logging.info("Writing the key to PKCS#12 because Firefox/Chrome do not support both cert/key in the same file"
                 " with PEM.")
    pkcs12_cert = generate_pkcs12_certificate(f"{host_name.replace('*.', '')}", private_key, public_key, root_cert,
                                              password)
    with open(os.path.join(cert_directory, f"{host_name.replace('*.', '')}.p12"), "wb") as f:
        f.write(pkcs12_cert)


parser = argparse.ArgumentParser(description='Script for creating SSL/TLS certificates.')
parser.add_argument('--cert-dir', dest='cert_dir', type=str, required=True, help='The directory where the SSL/TLS '
                                                                                 'certificates and keys will be '
                                                                                 'stored.')
parser.add_argument('--root-cert-dir', dest='root_cert_dir', type=str, required=True, help='The directory where the '
                                                                                           'root CA certificates and '
                                                                                           'keys will be stored.')
parser.add_argument('--ipv4-address', dest='ipv4_address', type=IPv4Address, required=True, help='IPv4 address on '
                                                                                                 'which the nginx proxy'
                                                                                                 ' will listen.')
args = parser.parse_args()

certs_directory = args.cert_dir
root_certs_directory = args.root_cert_dir
ipv4_address = args.ipv4_address

yaml_data = None

with open('config.yml', 'r') as stream:
    try:
        yaml_data = yaml.safe_load(stream)
    except yaml.YAMLError as exc:
        logging.error(exc)

logging.info("Creating the certificate directory.")
if not os.path.exists(yaml_data['CERT_DIRECTORY']):
    os.makedirs(yaml_data['CERT_DIRECTORY'])
    logging.info(f"Created directory: {os.path.abspath(yaml_data['CERT_DIRECTORY'])}")
else:
    logging.info(f"Directory already exists: {os.path.abspath(yaml_data['CERT_DIRECTORY'])}")

root_key, root_crt = create_root_ca(country=yaml_data['country'],
                                    state=yaml_data['state'],
                                    locality=yaml_data['locality'],
                                    root_ca_name=yaml_data['ROOT_CA_NAME'],
                                    organization_name=yaml_data['organization_name'],
                                    root_cert_directory=os.path.join(certs_directory, root_certs_directory))

logging.info("Creating the patches server certificate. This will be assigned to the nginx proxy...")

create_ssl_cert(
    root_private_key=root_key,
    root_cert=root_crt,
    cert_directory=certs_directory,
    host_name=f"{yaml_data['SERVER_NAME']}.{yaml_data['DOMAIN']}",
    country=yaml_data['country'],
    state=yaml_data['state'],
    locality=yaml_data['locality'],
    organization_name=yaml_data['organization_name'],
    organization_unit=yaml_data['organization_unit'],
    dns_1=f"{yaml_data['SERVER_NAME']}.{yaml_data['DOMAIN']}",
    dns_2=None,
    ip_1=ipv4_address,
    ip_2=None,
    days=yaml_data['days'])

logging.info("Creating the patches backend certificate...")

create_ssl_cert(
    root_private_key=root_key,
    root_cert=root_crt,
    cert_directory=certs_directory,
    host_name=f"{yaml_data['BACKEND_CERT_NAME']}.{yaml_data['DOMAIN']}",
    country=yaml_data['country'],
    state=yaml_data['state'],
    locality=yaml_data['locality'],
    organization_name=yaml_data['organization_name'],
    organization_unit=yaml_data['organization_unit'],
    dns_1=f"{yaml_data['BACKEND_CERT_NAME']}.{yaml_data['DOMAIN']}",
    dns_2=None,
    ip_1=None,
    ip_2=None,
    days=yaml_data['days'])

logging.info("Creating the patches frontend certificate...")

create_ssl_cert(
    root_private_key=root_key,
    root_cert=root_crt,
    cert_directory=certs_directory,
    host_name=f"{yaml_data['FRONTEND_CERT_NAME']}.{yaml_data['DOMAIN']}",
    country=yaml_data['country'],
    state=yaml_data['state'],
    locality=yaml_data['locality'],
    organization_name=yaml_data['organization_name'],
    organization_unit=yaml_data['organization_unit'],
    dns_1=f"{yaml_data['FRONTEND_CERT_NAME']}.{yaml_data['DOMAIN']}",
    dns_2=None,
    ip_1=None,
    ip_2=None,
    days=yaml_data['days'])

pkcs_password = None

while pkcs_password is None:
    response = patches_read("Do you want to add a password to the PKCS#12 certificates? The password will encrypt the "
                     "PKCS#12 certificate. If you do not add a password, the certificate will work with Chrome and "
                     "Chrome-like browsers, but does not work with Firefox. See "
                     "https://bugzilla.mozilla.org/show_bug.cgi?id=773111. Type yes or no.")
    if response.lower() == 'yes':
        pkcs_password = True
    elif response.lower() == 'no':
        pkcs_password = False
    else:
        print("Invalid input. Please type 'yes' or 'no'.")

for client in yaml_data['clients']:
    ip_address_1 = None
    ip_address_2 = None
    if yaml_data['clients'][client]['ip_1'] is not None:
        try:
            ip_address_1 = IPv4Address(yaml_data['clients'][client]['ip_1'])
        except ValueError as error:
            logging.error(f"Invalid IP address format for {client} ip_1: {error}")

    if yaml_data['clients'][client]['ip_2'] is not None:
        try:
            ip_address_2 = IPv4Address(yaml_data['clients'][client]['ip_2'])
        except ValueError as error:
            logging.error(f"Invalid IP address format for {client} ip_2: {error}")

    create_ssl_cert(
        root_private_key=root_key,
        root_cert=root_crt,
        cert_directory=certs_directory,
        host_name=client,
        country=yaml_data['clients'][client]['country'],
        state=yaml_data['clients'][client]['state'],
        locality=yaml_data['clients'][client]['locality'],
        organization_name=yaml_data['clients'][client]['organization_name'],
        organization_unit=yaml_data['clients'][client]['organization_unit'],
        dns_1=yaml_data['clients'][client]['dns_1'],
        dns_2=yaml_data['clients'][client]['dns_2'],
        ip_1=ip_address_1,
        ip_2=ip_address_2,
        days=yaml_data['clients'][client]['days'],
        password=pkcs_password)
