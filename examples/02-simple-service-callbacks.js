var
	Pylon = new require('..'),
	pylon = new Pylon()

pylon
	.create({ name: 'p#1' })
	.register('user/info/request', onInfoRequestAction)
	.notify('user/info/request', { userId: 'mark-bevels' }, onInfoRequestReply)

function onInfoRequestAction (data, respond) {
	console.log('request received: ' + JSON.stringify(data))

	respond({
		userId: 'mark-bevels',
		name: 'Mark',
		lname: 'Bevels'
	})
}

function onInfoRequestReply (data) {
	console.log('data received: ' + JSON.stringify(data))
}