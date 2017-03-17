module.exports = function(MediaManager) {
	MediaManager.prototype.sendProfileAdd = function sendProfileAdd(data) {
		if(this._firstRun) return;

		this.server.connections.forEach(connection => {
			connection.send(JSON.stringify({
				type: 'profile-add',
				data: data
			}));
		});
	};
};