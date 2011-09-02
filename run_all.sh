#!/bin/bash
# Script that runs the ReverseHTTP and the test server

trap exit SIGINT

cd ./test
xterm -e java -Xmx128m -jar run_test_server.jar&
cd ../ReverseHttp
xterm -e java -Xmx2048m -jar run_reversehttp_server.jar&
cd ..

