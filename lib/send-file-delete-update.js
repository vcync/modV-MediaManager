module.exports = function(MediaManager) {
	MediaManager.prototype.sendFileDeleteUpdate = function sendFileDeleteUpdate(data) {
		if(this._firstRun) return;

		this.server.connections.forEach(connection => {
			connection.send(JSON.stringify({
				type: 'file-update-delete',
				data: data
			}));
		});
	};
};