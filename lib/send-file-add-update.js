module.exports = function(MediaManager) {
	MediaManager.prototype.sendFileAddUpdate = function sendFileAddUpdate(data) {
		if(this._firstRun) return;

		this.server.connections.forEach(connection => {
			connection.send(JSON.stringify({
				type: 'file-update-add',
				data: data
			}));
		});
	};
};