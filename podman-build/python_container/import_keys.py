import argparse
import os
from sys import exit

import yaml
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12

from helper_functions import PatchesLogger, ask_yes_no

logger = PatchesLogger.get_logger()


def verify_pem_files(server_pem_file, root_ca_pem_files):
    """Verify if the given files are valid PEM certificate files.

    This function checks if the provided files are valid PEM certificate files.
    It performs the validation using the `cryptography` library.

    Args:
        server_pem_file (str): The path to the server PEM certificate file.
        root_ca_pem_files (list): A list of paths to the ROOT_CA PEM certificate files.

    Returns:
        bool: True if all files are valid PEM certificate files, False otherwise.
    """
    try:
        # Verify server PEM file
        if not os.path.isfile(server_pem_file):
            logger.error(f"File not found: {server_pem_file}")
            return False

        with open(server_pem_file, 'rb') as file:
            pem_data = file.read()
            try:
                x509.load_pem_x509_certificate(pem_data, default_backend())
                # Additional checks or validations can be performed on the certificate object if needed
            except Exception as e:
                logger.error(f"Invalid server PEM file: {server_pem_file} - {str(e)}")
                return False

        # Verify root CA PEM files
        for root_ca_pem_file in root_ca_pem_files:
            if not os.path.isfile(root_ca_pem_file):
                logger.error(f"File not found: {root_ca_pem_file}")
                return False

            with open(root_ca_pem_file, 'rb') as file:
                pem_data = file.read()
                try:
                    x509.load_pem_x509_certificate(pem_data, default_backend())
                    # Additional checks or validations can be performed on the certificate object if needed
                except Exception as e:
                    logger.error(f"Invalid ROOT_CA PEM file: {root_ca_pem_file} - {str(e)}")
                    return False

        return True

    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        exit(1)


def validate_server_cert(server_cert_file, root_ca_cert_files):
    """Validate server's PEM file against the root CA certs.

    This function validates if the server certificate in the provided PEM file
    has been signed by any one of the root CA certificates.

    Args:
        server_cert_file (str): Path to the server's PEM certificate file.
        root_ca_cert_files (list): List of paths to root CA PEM certificate files.

    Returns:
        str: File path of the root CA certificate that signed the server certificate,
             or an empty string if no match is found.
    """
    try:
        # Load server certificate
        with open(server_cert_file, 'rb') as file:
            server_cert_data = file.read()
            server_cert = x509.load_pem_x509_certificate(server_cert_data, default_backend())

        for root_ca_cert_file in root_ca_cert_files:
            # Load root CA certificate
            with open(root_ca_cert_file, 'rb') as file:
                root_ca_cert_data = file.read()
                root_ca_cert = x509.load_pem_x509_certificate(root_ca_cert_data, default_backend())

            # Validate server certificate against the root CA certificate
            try:
                root_ca_cert.public_key().verify(
                    server_cert.signature,
                    server_cert.tbs_certificate_bytes,
                    padding.PKCS1v15(),
                    server_cert.signature_hash_algorithm,
                )
            except InvalidSignature:
                continue  # Try the next root CA cert

            logger.info(f"The server's PEM file is signed by the root CA cert: {root_ca_cert_file}")
            return root_ca_cert_file

        logger.error("The server's PEM file is not signed by any of the provided root CA certs.")
        return ""

    except FileNotFoundError as e:
        logger.error(f"File not found: {e.filename}")
        exit(1)
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        exit(1)


    except FileNotFoundError as e:
        logger.error(f"File not found: {e.filename}")
        exit(1)
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        exit(1)


def verify_certificate_common_name(certificate_file, config_field_name):
    """Verify the common name field in a certificate.

    This function opens the certificate file, verifies that the common name field
    matches the value specified in `config.yml`, and prompts the user to update the
    corresponding field in `config.yml` if they don't match.

    Args:
        certificate_file (str): The path to the certificate file.
        config_field_name (str): The name of the field in `config.yml` to compare.

    Returns:
        bool: True if the common name matches and the corresponding field is updated,
              False otherwise.
    """
    try:
        # Load the certificate
        with open(certificate_file, "rb") as file:
            cert_data = file.read()
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())

        # Get the common name from the certificate
        common_name = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value

        # Load config.yml
        with open("config.yml", "r") as file:  # TODO - revert this
            config_data = yaml.safe_load(file)

        config_value = config_data.get(config_field_name)

        if config_value and common_name != config_value:
            # Prompt the user to update the corresponding field in config.yml
            prompt = f"The common name in the certificate ({common_name}) does not match the expected value ({config_value}).\nDo you want to update {config_field_name} in config.yml to match the certificate? If you do not, this is a fatal error and the program will exit. You will need to fix the field manually."
            if ask_yes_no(prompt):
                return update_config_field(config_field_name, common_name)
            else:
                logger.error("No changes made to the corresponding field.")
                return False
        else:
            return True

    except FileNotFoundError:
        logger.error("Certificate file or config.yml file not found.")
        exit(1)
    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        exit(1)


def update_config_field(config_field_name, new_value):
    """Update the specified field in config.yml with the new value.

    This function loads the config.yml file, finds the specified field,
    and updates it with the new value.

    Args:
        config_field_name (str): The name of the field to update.
        new_value (str): The new value for the field.

    Returns:
        bool: True if the field is updated successfully, False otherwise.
    """
    try:
        with open("config.yml", "r") as file:
            lines = file.readlines()

        with open("config.yml", "w") as file:
            for line in lines:
                if line.strip().startswith(config_field_name + ":"):
                    file.write(f"{config_field_name}: {new_value}\n")
                else:
                    file.write(line)

        logger.info(f"{config_field_name} field updated in config.yml.")
        return True
    except FileNotFoundError:
        logger.error("config.yml file not found.")
        return False
    except Exception as e:
        logger.error(f"Error occurred while updating config.yml: {str(e)}")
        return False


def convert_pkcs_to_pem(pkcs_file, server_pem_folder, root_ca_pem_folder, password=None):
    """Convert a PKCS file to separate PEM files.

    This function takes a PKCS file and converts it into two separate PEM files:
    one containing the server's private and public certificate, and the other
    containing the root CA's public certificate. The PEM files are saved in the
    provided server PEM folder and root CA PEM folder, respectively, using the
    common names as file names.

    Args:
        pkcs_file (str): The path to the PKCS file.
        server_pem_folder (str): The folder path to save the server PEM file.
        root_ca_pem_folder (str): The folder path to save the root CA PEM file.
        password (str, optional): The password for the PKCS file. Defaults to None.

    Returns:
        tuple: A tuple containing the paths to the server PEM file and the root CA PEM file.
    """
    with open(pkcs_file, "rb") as file:
        pkcs_data = file.read()

    # Deserialize PKCS file
    logger.info("Deserializing PKCS file...")
    pkcs12_data = pkcs12.load_key_and_certificates(pkcs_data, password)

    # Extract common names
    logger.info("Extracting common names from the server cert and root cert...")
    common_name_server = pkcs12_data[1].subject.get_attributes_for_oid(
        pkcs12.x509.NameOID.COMMON_NAME)[0].value

    # Generate file paths with common names
    server_pem_file = os.path.join(server_pem_folder, f"{common_name_server}.pem")

    # Export server's certificate (private and public) to PEM
    logger.info("Exporting server certificate to PEM format...")
    server_pem = pkcs12_data[0].private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ) + pkcs12_data[1].public_bytes(encoding=serialization.Encoding.PEM)

    # Write server's PEM file
    with open(server_pem_file, "wb") as file:
        file.write(server_pem)

    # Write root CA PEM files
    root_ca_pem_files = []
    for i, ca_cert in enumerate(pkcs12_data[2]):
        common_name_root_ca = ca_cert.subject.get_attributes_for_oid(
            pkcs12.x509.NameOID.COMMON_NAME)[0].value
        root_ca_pem_file = os.path.join(root_ca_pem_folder, f"{common_name_root_ca}.pem")
        root_ca_pem_files.append(root_ca_pem_file)
        root_ca_pem = ca_cert.public_bytes(encoding=serialization.Encoding.PEM)
        with open(root_ca_pem_file, "wb") as file:
            file.write(root_ca_pem)

    return server_pem_file, root_ca_pem_files


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Import certificates into Patches.')
    parser.add_argument('--server-pem-file', dest='server_pem_file', type=str,
                        help='Path to the server PEM certificate file')
    parser.add_argument('--root-ca-pem-file', dest='root_ca_pem_file', type=str,
                        help='Path to the ROOT_CA PEM certificate file')
    parser.add_argument('--pkcs-file', type=str,
                        help='Path to the PEM certificate file containing server cert and trust chain')
    parser.add_argument('--root-cert-directory', dest='root_cert_directory', type=str,
                        help='Directory path holding the root certificates')
    parser.add_argument('--cert-directory', dest='cert_directory', type=str,
                        help='Directory path holding the regular server certificates')

    # Parse command-line arguments
    args = parser.parse_args()

    if (args.pkcs_file is None and (args.server_pem_file is None or args.root_ca_pem_file is None)) or \
            (args.pkcs_file is not None and (args.server_pem_file is not None or args.root_ca_pem_file is not None)):
        parser.error('Either provide --pkcs-file or both --server-pem-file and --root-ca-pem-file arguments.')
        exit(1)

    root_cert_directory = args.root_cert_directory
    cert_directory = args.cert_directory
    server_pem_file = args.server_pem_file
    root_ca_pem_files = [args.root_ca_pem_file]

    if args.pkcs_file:
        server_pem_file, root_ca_pem_files = convert_pkcs_to_pem(args.pkcs_file, cert_directory, root_cert_directory)

    # Verify the PEM files
    logger.info("Verify both files are in PEM format...")

    result = verify_pem_files(server_pem_file, root_ca_pem_files)
    if result:
        logger.info("Both PEM files are valid.")
    else:
        logger.error("The PEM files did not validate correctly.")
        exit(1)

    logger.info("Validate that the server cert is signed by the root CA cert...")

    root_ca_pem_file = validate_server_cert(server_pem_file, root_ca_pem_files)

    if not root_ca_pem_file:
        logger.error("Error: The server's PEM file is not signed by any of the provided root CA certs. Make sure you "
                     "have the correct root CA cert.")
        exit(1)

    logger.info("Ensure that the common name in the root CA file matches ROOT_CA_NAME in config.yml...")

    if verify_certificate_common_name(root_ca_pem_file, "ROOT_CA_NAME"):
        logger.info("Root CA certificate common name verification successful.")
    else:
        logger.error("Root CA certificate common name verification failed.")

    if verify_certificate_common_name(server_pem_file, "SERVER_NAME"):
        logger.info("Server certificate common name verification successful.")
    else:
        logger.error("Server certificate common name verification failed.")

