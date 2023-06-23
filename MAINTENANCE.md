# Required Maintenance Tasks

Listed here are all things which will require routine maintenance and updates.

## Required Version Updates

- PSQL_VERSION in [config.yml](./podman-build/config.yml)
- HTTPD_VERSION in [config.yml](./podman-build/config.yml)
- NGINX_VERSION in [config.yml](./podman-build/config.yml)
- Default DRM installer must be updated [config.yml](./podman-build/config.yml)
  - Currently we are rehosting it with git LFS. The reason is that Dell's website blocks automated scraping so live pulls were not ideal. Moreover this removes any dependencies we have on the DRM version. However this does mean that new versions must be downloaded. Currently, the files are stored in drm_repos
- Update the Node container in [Dockerfile.patches_base](./podman-build/Dockerfile.patches_base)
- The Python version must be updated in [Dockerfile.python](podman-build/python_container/Dockerfile.python)

## Code Maintenance

- NPM/Node packages will break as support shifts. We will need to perform regular package maintenance to ensure compatibility
- We use an [expect script](./podman-build/drm_install.exp) to install DRM automatically. If the DRM installer changes, the expect script must also be updated.
- Any Python packages that update and break each other must be deconflicted
