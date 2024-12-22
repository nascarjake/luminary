#!/bin/bash

# Copy the public environment file as a template if local environment doesn't exist
if [ ! -f ./src/environments/environment.ts ]; then
    cp ./src/environments/environment_public.ts ./src/environments/environment.ts
    echo "Created environment.ts from public template"
fi

if [ ! -f ./src/environments/environment.development.ts ]; then
    cp ./src/environments/environment_public.ts ./src/environments/environment.development.ts
    echo "Created environment.development.ts from public template"
fi

echo "Environment files are set up. Edit them with your private settings if needed."
