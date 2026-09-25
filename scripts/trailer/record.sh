#!/bin/sh
# Record every shot, three recorders in parallel. Flight-continuous groups
# (J → I → K, R → S) stay in one recorder, in order. Needs `npm run dev`.
cd "$(dirname "$0")"
node run.mjs record A B C D E F G H > rec-1.log 2>&1 &
node run.mjs record J I K L M > rec-2.log 2>&1 &
node run.mjs record N O P Q R S > rec-3.log 2>&1 &
wait
grep -h "frames in\|errors\|Error" rec-*.log
