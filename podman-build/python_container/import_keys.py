import argparse
import os
from sys import exit

from helper_functions import PatchesLogger, patches_read
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import padding
import yaml
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from helper_functions import PatchesLogger, ask_yes_no

logger = PatchesLogger.get_logger()


def verify_pem_files(server_pem_file, root_ca_pem_file):
    """Verify if the given files are valid PEM certificate files.

    This function checks if the provided files are valid PEM certificate files.
    It performs the validation using the `cryptography` library.

    Args:
        server_pem_file (str): The path to the server PEM certificate file.
        root_ca_pem_file (str): The path to the ROOT_CA PEM certificate file.

    Returns:
        bool: True if both files are valid PEM certificate files, False otherwise.
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

        # Verify root CA PEM file
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


def validate_server_cert(server_cert_file, root_ca_cert_file):
    """Validate server's PEM file against the root CA cert.

    This function validates if the server certificate in the provided PEM file
    has been signed by the root CA certificate.

    Args:
        server_cert_file (str): Path to the server's PEM certificate file.
        root_ca_cert_file (str): Path to the root CA PEM certificate file.

    Returns:
        bool: True if the server's PEM file is signed by the root CA cert, False otherwise.
    """
    try:
        # Load server certificate
        with open(server_cert_file, 'rb') as file:
            server_cert_data = file.read()
            server_cert = x509.load_pem_x509_certificate(server_cert_data, default_backend())

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
            logger.error("The server's PEM file is not signed by the provided root CA cert.")
            return False

        return True

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
        with open("config.yml", "r") as file:
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


def update_config_field(field_name, new_value):
    """Update a field in config.yml.

    This function loads the config.yml file, finds the specified field,
    and updates it with the new_value.

    Args:
        field_name (str): The name of the field to update.
        new_value (str): The new value for the field.

    Returns:
        bool: True if the field is updated successfully, False otherwise.
    """
    try:
        with open("config.yml", "r") as file:
            config_data = yaml.safe_load(file)

        config_data[field_name] = new_value

        with open("config.yml", "w") as file:
            yaml.dump(config_data, file, default_flow_style=False)

        logger.info(f"{field_name} field updated in config.yml.")
        return True
    except FileNotFoundError:
        logger.error("config.yml file not found.")
        exit(1)
    except Exception as e:
        logger.error(f"Error occurred while updating config.yml: {str(e)}")
        exit(1)


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Verify PEM certificate files.')  # TODO - update
    parser.add_argument('server_pem_file', type=str, help='Path to the server PEM certificate file')
    parser.add_argument('root_ca_pem_file', type=str, help='Path to the ROOT_CA PEM certificate file')

    # Parse command-line arguments
    args = parser.parse_args()
    server_pem_file = args.server_pem_file
    root_ca_pem_file = args.root_ca_pem_file

    # Verify the PEM files
    logger.info("Verify both files are in PEM format...")

    result = verify_pem_files(server_pem_file, root_ca_pem_file)
    if result:
        logger.info("Both PEM files are valid.")
    else:
        logger.error("At least one PEM file is invalid.")  # TODO - update

    logger.info("Validate that the server cert is signed by the root CA cert...")

    validate_server_cert(server_pem_file, root_ca_pem_file)

    logger.info("Ensure that the common name in the root CA file matches ROOT_CA_NAME in config.yml...")

    if verify_certificate_common_name(root_ca_pem_file, "ROOT_CA_NAME"):
        logger.info("Root CA certificate common name verification successful.")
    else:
        logger.error("Root CA certificate common name verification failed.")

    if verify_certificate_common_name(server_pem_file, "SERVER_NAME"):
        logger.info("Server certificate common name verification successful.")
    else:
        logger.error("Server certificate common name verification failed.")

