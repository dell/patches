"""
This script generates an Nginx configuration file using Jinja2 templating. It loads a template from a file named
'config.j2', and uses environment variables to fill in the template. The resulting configuration is then written to
a file named 'nginx.conf' in the directory specified by the SCRIPT_DIR environment variable.
"""

import argparse
import os

from jinja2 import Environment, FileSystemLoader

# Set up argument parser
parser = argparse.ArgumentParser(description='Generates an Nginx configuration file using Jinja2 templating.')
parser.add_argument('--server-name', required=True, help='The domain name of the server (just the name)')
parser.add_argument('--server-domain', required=True, help='The top-level domain of the server')
parser.add_argument('--ipv4-address', required=True, help='The IPv4 address of the server')
parser.add_argument('--nginx-config-dir', required=True, help='The directory in which to write the resulting Nginx '
                                                              'configuration file')
parser.add_argument('--server-cert', required=True, help='Name of the server certificate file')
parser.add_argument('--server-key', required=True, help='Name of the server private key file')
parser.add_argument('--server-ca', required=True, help='Name of the server CA certificate file')
parser.add_argument('--root-cert-dir', required=True, help='Directory containing root CA certificates')
parser.add_argument('--root-cert-path', required=True, help='The path to the root certificate')
parser.add_argument('--cert-dir', required=True, help='Directory containing client certificates')
parser.add_argument('--frontend-port', required=True, type=int, help='Port number for the ReactJS frontend')
parser.add_argument('--backend-port', required=True, type=int, help='Port number for the NodeJS backend')
parser.add_argument('--disable-client-cert-auth', action='store_true',
                    help='Turns off client certificate authentication to use Patches. '
                         'The certificate is still required for the admin page.')

parser.add_argument('--disable-client-cert-request', action='store_true',
                    help='Turns off requests for client certificates. This will stop Patches '
                         'from prompting users for a certificate when they come to the website. '
                         'This will also disable client certificate authentication.')

# Parse arguments
args = parser.parse_args()

# Define variables
dns_1 = args.server_name + '.' + args.server_domain
ip_1 = args.ipv4_address
nginx_config_dir = args.nginx_config_dir
server_cert = args.server_cert
server_key = args.server_key
server_ca = args.server_ca
root_cert_dir = args.root_cert_dir
root_cert_path = args.root_cert_path
cert_dir = args.cert_dir
frontend_port = args.frontend_port
backend_port = args.backend_port
disable_client_cert_auth = args.disable_client_cert_auth
disable_client_cert_request = args.disable_client_cert_request

# Load Jinja2 template
env = Environment(loader=FileSystemLoader('.'))
template = env.get_template('nginx.conf.j2')

# Render template with variables
config = template.render(
    dns_1=dns_1,
    ip_1=ip_1,
    server_cert=server_cert,
    server_key=server_key,
    server_ca=server_ca,
    root_cert_dir=root_cert_dir,
    root_cert_path=root_cert_path,
    cert_dir=cert_dir,
    frontend_port=frontend_port,
    backend_port=backend_port,
    disable_client_cert_auth=disable_client_cert_auth,
    disable_client_cert_request=disable_client_cert_request
)

# Write rendered template to file
with open(os.path.join(nginx_config_dir, 'nginx.conf'), 'w') as f:
    f.write(config)
