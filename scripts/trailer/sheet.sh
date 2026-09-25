#!/bin/bash
# sheet.sh ID [N]: N evenly spaced frames of frames/ID as a 3-wide contact sheet.
cd "$(dirname "$0")"
FF=${FF:-ffmpeg}
id=$1; n=${2:-6}
files=(frames/$id/*.jpg); c=${#files[@]}
args=(); fl=""; ins=""; lay=""
for ((i=0;i<n;i++)); do
  k=$(( i*(c-1)/(n-1) )); args+=(-i "${files[$k]}")
  fl+="[$i]scale=640:360[s$i];"; ins+="[s$i]"; lay+="$(( (i%3)*640 ))_$(( (i/3)*360 ))|"
done
"$FF" -v error -y "${args[@]}" -filter_complex "${fl}${ins}xstack=inputs=$n:layout=${lay%|}" -q:v 3 "sheet-$id.jpg" && echo "sheet-$id.jpg ($c frames)"
