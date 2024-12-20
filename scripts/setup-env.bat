@echo off
setlocal

echo Setting up environment files...

if not exist ..\src\environments\environment.ts (
    copy ..\src\environments\environment_public.ts ..\src\environments\environment.ts
    echo Created environment.ts from public template
)

if not exist ..\src\environments\environment.development.ts (
    copy ..\src\environments\environment_public.ts ..\src\environments\environment.development.ts
    echo Created environment.development.ts from public template
)

echo Environment files are set up. Edit them with your private settings if needed.
pause
