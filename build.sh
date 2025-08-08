#!/bin/bash

cat << "EOF"
                       _      
                      (_)     
 __      ___   _ _ __  ___  __
 \ \ /\ / / | | | '_ \| \ \/ /
  \ V  V /| |_| | | | | |>  < 
   \_/\_/  \__,_|_| |_|_/_/\_\
EOF

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

confirm() {
  read -r -p "$1 (Y/n): " response
  case "$response" in
    [nN][oO]|[nN]) 
      return 1
      ;;
    *) 
      return 0
      ;;
  esac
}

echo "Checking dependencies..."

node_installed=false
electron_installed=false
builder_installed=false

if command_exists node && command_exists npm; then
  echo "Node.js and npm are installed."
  node_installed=true
else
  echo "Node.js and/or npm not found."
  if confirm "Do you want to install Node.js and npm?"; then
    if command_exists apt-get; then
      sudo apt-get update
      sudo apt-get install -y nodejs npm
      node_installed=true
    else
      echo "Please install Node.js and npm manually: https://nodejs.org/"
      exit 1
    fi
  else
    echo "Skipping Node.js installation. Exiting."
    exit 1
  fi
fi

if npm list -g electron >/dev/null 2>&1; then
  echo "Electron is installed globally."
  electron_installed=true
else
  echo "Electron not found globally."
  if confirm "Do you want to install electron globally?"; then
    sudo npm install -g electron && electron_installed=true
  else
    echo "Skipping electron installation."
  fi
fi

if npm list -g electron-builder >/dev/null 2>&1; then
  echo "Electron-builder is installed globally."
  builder_installed=true
else
  echo "Electron-builder not found globally."
  if confirm "Do you want to install electron-builder globally?"; then
    sudo npm install -g electron-builder && builder_installed=true
  else
    echo "Skipping electron-builder installation."
  fi
fi

if $node_installed && $electron_installed && $builder_installed; then
  echo "All dependencies installed. Running 'npm run build'..."
  npm run build
else
  echo "Not all dependencies are installed. Skipping build."
fi

echo "Done!"
