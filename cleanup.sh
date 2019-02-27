#!/bin/bash

# remove git and source directories
rm -rf ./src ./.git;
# remove files from root that are not needed
rm -rf ./.git* ./app* package* tsconfig.json;

# remove self
rm cleanup.sh;