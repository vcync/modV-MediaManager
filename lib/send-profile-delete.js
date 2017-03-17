module.exports = function(MediaManager) {
	MediaManager.prototype.sendProfileDelete = function sendProfileDelete(data) {
		if(this._firstRun) return;

		this.server.connections.forEach(connection => {
			connection.send(JSON.stringify({
				type: 'profile-delete',
				data: data
			}));
		});
	};
};