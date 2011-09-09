#/bin/bash
# BrowserAccess measure script

trap exit SIGINT

APP_HOST="http://app.localhost"
TEST_HOST="http://localhost"
PORT_TEST=8000
PORT_RH=8080
PORT_EXT=8081
CLIENT=$1

STARTSIZE=1024
STARTCONCURRENT=100
I=1
J=8
K=10

function post {
	response=`wget -O - $APP_HOST:$PORT_RH/$1 --no-http-keep-alive --post-data="$2" -q`
	while [[ $response = "" ]]; do
		sleep 1
		response=`wget -O - $APP_HOST:$PORT_RH/$1 --no-http-keep-alive --post-data="$2" -q`
	done
}

function control {
	post "measure-control" "$1"
}

function result {
	post "measure-results" "$1"
}

if [ "$(which siege)" = "" ]; then
	echo "Measure failed. Please install siege"
	exit 1
fi

if [ $# > 0 ] ; then
	./run_all.sh &
	`$CLIENT $TEST_HOST:$PORT_TEST/measure.html > /dev/null 2>&1&`
	sleep 3
	control "ready"
	if [[ $response = "true" ]]; then
		#warmup...
		siege -r 2 -c 2 $APP_HOST:$PORT_EXT 2>/dev/null >/dev/null
		siege -r 2 -c 2 $APP_HOST:$PORT_RH 2>/dev/null >/dev/null
		echo "Starting tests..."
		result "init $I $J $K $STARTSIZE $STARTCONCURRENT"
		for ((N=1;N<=$I;N++)); do
			for ((j=0;j<$J;j++)); do
				size=$(( 2**$j * $STARTSIZE ))
				control "set-response-size $size"
				for ((k=0;k<=$K;k++)); do
					C=$(( $k * $STARTCONCURRENT));
					if [ $C = 0 ]; then
						C=1
					fi
					result "control ext $N $C $size"
					IFS=$'\n'
					lines="`siege -r $N -c $C $APP_HOST:$PORT_EXT 2>/dev/null`"
					for line in $lines; do
						result "$line"
					done
					result "end"
					if [[ $response = "fail" ]]; then
						k=$k-1
						continue
					fi
					result "control rh $N $C $size"
					lines="`siege -r $N -c $C $APP_HOST:$PORT_RH 2>/dev/null`"
					for line in $lines; do
						result "$line"
					done
					result "end"
					if [[ $response = "fail" ]]; then
						k=$k-1
						continue
					fi
					unset IFS
				done
			done
		done
	else
		echo "Browser hosted web app measurement script not ready. Status: $response"
	fi
fi

