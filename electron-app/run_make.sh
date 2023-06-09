#!/usr/bin/env bash

# Builds and launches the electron app in production mode
#  - Business logic resides in Python, so this script launches the app
#    in a virtual environment to communicates with the relevant Python
#    packages
#  - Business logic should be ported from Python to nodejs to remove these
#    dependencies from the app

set -eoux pipefail

# activate virtual environment
if [ ! -d "venv" ]; then
	python3 -m venv venv
fi
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -e ../builder
python -m pip install -e ../runner

# Ensure nodemapper up-to-date
pushd ../nodemapper
yarn
yarn build
popd

# compile builderjs
pushd ../builderjs
yarn build
popd

# compile PhyloFlow
rm -rf dist out
#rm -rf node_modules  # deep clean
yarn
yarn build
yarn make

# Run the app
out/PhyloFlow-*/PhyloFlow.app/Contents/MacOS/PhyloFlow
