cd "$(dirname "$0")"
arch=$(uname -m)
if [ "$arch" = "x86_64" ]; then
    dmg_file="./Luminary_amd64.dmg"
elif [ "$arch" = "arm64" ]; then
    dmg_file="./Luminary_arm64.dmg"
else
    echo "Unsupported architecture: $arch"
    exit 1
fi

xattr -c "$dmg_file"
open "$dmg_file"