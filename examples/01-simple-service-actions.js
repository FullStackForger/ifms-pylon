var
	Pylon = new require('..'),
	pylon = new Pylon()

pylon
	.create({ name: 'p#1' })
	.register('user/info/request', onInfoRequestAction)
	.register('user/info/data', onInfoDataAction)
	.notify('user/info/request', { userId: 'mark-bevels' })

function onInfoRequestAction (data) {
	console.log('request received: ' + JSON.stringify(data))

	pylon.notify('user/info/data', {
		userId: 'mark-bevels',
		name: 'Mark',
		lname: 'Bevels'
	})
}

function onInfoDataAction (data) {
	console.log('data received: ' + JSON.stringify(data))
}