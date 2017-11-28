#!/bin/bash

lccs=(
"568576fce4b0e7594ee73efa=LCCNET"
"519e280ce4b0ac3d2125b827=GCP"
"513f899ce4b0dcc733969431=ETPBR"
"4fa196c3e4b0acd7432ffe28=PPP"
"4f4e476be4b07f02db47e143=NA"
"52cd70e5e4b0c3f95144ebe1=PI"
"4f6a2afce4b0e7aaea01dbc8=GN"
"4f6a3d64e4b0e7aaea01dbfb=NP"
"50367466e4b06c3b908a67dd=GB"
"4f4e4773e4b07f02db47e248=D"
)

for lcc in "${lccs[@]}"
do
    sbid=`echo $lcc | sed "s/=.*$//g"`
    title=`echo $lcc | sed "s/.*=//g"`
    echo $title
    ./bin/import --root $sbid
done
