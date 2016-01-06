// Architecture
//
//   [ p-nexus ]================================================================
//                   |                |                     |                 |
//               [p-nexus]       [ p-gate ]           [ p-api-1 ]        [ p-api-2 ]

'use strict'
var
	Pylon = new require('..'),
	debug = false,
	startTime = Date.now();

var pServer = new Pylon('p-server')
	.create()

var pProxy = new Pylon('p-proxy')
	.connect()
	.register('pulse/info', function (data, respond) {
		var partials = []
		var pulse = data.pulse

		if (debug) console.log((new Date()).toISOString() + ' GATE: pulse/info, asking for partials')
		this.notify('pulse/action/a', data, update)
		this.notify('pulse/action/b', data, update)

		function update(data) {
			partials.push(data.result)
			if (debug) console.log((new Date()).toISOString() + ' GATE: responses updated: ', partials)
			if (partials.length == 2) respond({ pulse: pulse, partials: partials })
		}
	})

var pApi1 = new Pylon('p-api-1')
	.connect()
	.register('pulse/action/a', (data, respond) => {
			if (debug) console.log((new Date()).toISOString() + ' API-1: pulse/action/a, data: ', data)
			respond({ result: 'A'})
	})

var pApi2 = new Pylon('p-api-2')
	.connect()
	.register('pulse/action/b', (data, respond) => {
		if (debug) console.log((new Date()).toISOString() + ' API-2: pulse/action/b, data: ', data)
		respond({ result: 'B' })
	})

function startProcessing(totalPulses) {
	return new Promise(resolve => {

		console.log("Processing of " + totalPulses + " pulses in progress...")
		let pulses = 0

		let interval1  = setInterval(() => {
			if (pulses > totalPulses) return finish()
			pServer.notify('pulse/info', { pulse: pulses }, (data) => {
				if (debug) console.log((new Date()).toISOString() + ' NEXUS: data received: ' + JSON.stringify(data))
			})
			pulses ++
		}, 0)


		let interval2  = setInterval(() => {
			if (pulses > totalPulses) return finish()
			pApi1.notify('pulse/info', { pulse: pulses }, (data) => {
				if (debug) console.log((new Date()).toISOString() + ' API_1: data received: ' + JSON.stringify(data))
			})
			pulses ++
		}, 0)


		let interval3  = setInterval(() => {
			if (pulses > totalPulses) return finish()
			pApi2.notify('pulse/info', { pulse: pulses }, (data) => {
				if (debug) console.log((new Date()).toISOString() + ' API_2: data received: ' + JSON.stringify(data))
			})
			pulses ++
		}, 0)

		function finish() {
			clearInterval(interval1)
			clearInterval(interval2)
			clearInterval(interval3)
			console.log('Processing of ' + totalPulses + ' pulses completed in ' + (Date.now() - startTime) / 1000 + 's')
			resolve()
		}
	})
}



startProcessing(100)
	.then(() => {return startProcessing(200)})
	.then(() => {return startProcessing(500)})
	.then(() => {return startProcessing(1000)})
	.then(() => {return startProcessing(2000)})
	.then(() => {return startProcessing(4000)})
	.then(() => {return startProcessing(5000)})
	.then(() => {return startProcessing(6000)})
	.then(() => {return startProcessing(7000)})
	.then(() => {return startProcessing(8000)})
	.then(() => {return startProcessing(10000)})
	.then(() => {return startProcessing(12000)})
	.then(() => {return startProcessing(15000)})
	.then(() => {return startProcessing(20000)})
	.then(() => {return startProcessing(50000)})

