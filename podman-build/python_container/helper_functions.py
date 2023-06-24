import logging
import os
import textwrap
import time
from typing import Optional

import yaml
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509 import Certificate
from cryptography.x509 import load_pem_x509_certificate


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


class PatchesLogger:
    """Singleton class for the custom Patches logger.

    This class provides a singleton instance of the logger with a custom log handler
    for Patches scripts. The logger can be accessed using the `get_logger` method.

    Attributes:
        _logger (logging.Logger): The logger instance.
    """

    _logger = None

    @staticmethod
    def get_logger():
        """Get the custom Patches logger instance.

        If the logger instance doesn't exist, it will be created with the custom log handler
        and returned. If the logger instance already exists, it will be directly returned.

        Returns:
            logging.Logger: The custom Patches logger instance.
        """
        if PatchesLogger._logger is None:
            logging.basicConfig(level=logging.INFO)
            logger = logging.getLogger()
            logger.handlers.clear()
            handler = PatchesLogHandler()
            handler.setFormatter(logging.Formatter('%(message)s'))
            logger.addHandler(handler)
            PatchesLogger._logger = logger

        return PatchesLogger._logger


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
        encryption_algorithm=serialization.BestAvailableEncryption(
            password.encode()) if password else serialization.NoEncryption(),
    )

    return pkcs12_data


def convert_pem_files(pem_path):
    """
    Converts PEM files to separate files containing the private key and the public certificate.

    Args:
        pem_path (str): The path to the PEM file.

    Raises:
        ValueError: If the provided PEM file doesn't exist or is not a valid PEM file.

    Returns:
        str: The path to the public certificate file.
    """
    if not os.path.exists(pem_path):
        raise ValueError(f"The PEM file '{pem_path}' does not exist.")

    pem_dir = os.path.dirname(pem_path)

    # Read the contents of the PEM file
    with open(pem_path, 'rb') as pem_file:
        pem_data = pem_file.read()

    # Load the PEM data as an X509 certificate
    cert = load_pem_x509_certificate(pem_data, default_backend())

    # Write the public certificate to a file
    cert_file_path = os.path.join(pem_dir, f"{os.path.splitext(os.path.basename(pem_path))[0]}.crt")
    with open(cert_file_path, 'wb') as cert_file:
        cert_file.write(cert.public_bytes(encoding=serialization.Encoding.PEM))

    private_key = None
    try:
        private_key = load_pem_private_key(pem_data, password=None, backend=default_backend())
    except (ValueError, TypeError):
        pass

    # Write the private key to a file if available
    if private_key is not None:
        key_file_path = os.path.join(pem_dir, f"{os.path.splitext(os.path.basename(pem_path))[0]}.key")
        with open(key_file_path, 'wb') as key_file:
            key_file.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))

    return cert_file_path


def ask_yes_no(prompt):
    """Prompt the user with a yes/no question and return their choice as a boolean value.

    This function displays a prompt to the user, validates their input, and returns
    True if the user answers "yes" and False if the user answers "no".

    Args:
        prompt (str): The prompt message to display to the user.

    Returns:
        bool: True if the user answers "yes", False if the user answers "no".
    """
    logger = PatchesLogger.get_logger()

    while True:
        user_input = patches_read(prompt + " (yes/no): ")
        response = user_input.lower()
        if response == "yes":
            return True
        elif response == "no":
            return False
        else:
            logger.error("Invalid input. Please enter either 'yes' or 'no'.")


def update_config_file(field_name, file_name):
    """
    Updates the specified field in the config.yml file with the given absolute file path.

    Args:
        field_name (str): Name of the field to update.
        file_name (str): The name of the certificate.

    Raises:
        ValueError: If an invalid field name is provided.

    Returns:
        None
    """
    config_file_path = 'config.yml'
    logger = PatchesLogger.get_logger()

    with open(config_file_path, 'r') as config_file:
        lines = config_file.readlines()

    # Find and update the fields. We are using this instead of the YAML library to avoid deleting all the comments
    field_found = False
    for i, line in enumerate(lines):
        if line.startswith(f"{field_name}:"):
            lines[i] = f"{field_name}: {file_name}\n"
            logger.info(f"Replaced {field_name} with {file_name}")
            field_found = True

    if not field_found:
        logger.error(f"Field name '{field_name}' not found in config.yml")
        exit(1)

    # Write back modified data to config.yml
    with open(config_file_path, 'w') as config_file:
        config_file.writelines(lines)

