

// Gets a lane based on its full title
exports.lane = function(board, lane) {
	index(board);

	return board.xIndex.lanesByTitle[lane.toLowerCase()];
}

// Applies filters to a board
exports.cards = function(board, filters) {
	index(board);

	// Iterate over cards and find cards that meet filter criteria
	var cards = [];

	board.xIndex.allLanes.forEach(function (lane) {

		// Each card
		for (var c = 0; c < lane.Cards.length; ++c) {
			var card = lane.Cards[c];

			if (filters && filters.length > 0) {
				// Each filter
				var includedMatches = 0;
				var excludedMatches = 0;
				for (var f = 0; f < filters.length; ++f) {
					var filter = filters[f];
					var filterResult = filter(lane, card);

					if (filterResult == exports.FILTER_RESULT.CardIncluded) {
						++includedMatches;
					}
					else if (filterResult == exports.FILTER_RESULT.CardExcluded) {
						++excludedMatches;
						break;
					}
				}
				if (excludedMatches === 0 && includedMatches > 0) {
					cards.push(card);
				}
			}
			else {
				// no filters
				cards.push(card);
			}
		}
	});

	return cards;
}

// Controls whether or not a card is included or excluded by a filter
exports.FILTER_RESULT = {
	CardIncluded: 'CardIncluded',
	CardExcluded: 'CardExcluded'
};

// Filter factories
exports.if = {

	// All cards in a lane, excluding sub-lanes
	// Options is the pipe-delimited lane name. Ex: 'Backlog|Next Iteration'
	in_lane: function (options) {
		var fullTitleFilter = options.toLowerCase();

		return function (lane, card) {
			if (lane.xFullTitle.toLowerCase() == fullTitleFilter)
				return exports.FILTER_RESULT.CardIncluded;

			return exports.FILTER_RESULT.CardExcluded;
		}
	},

	// All cards not in a lane, excluding sub-lanes
	// Options is the pipe-delimited lane name. Ex: 'Backlog|Next Iteration'
	not_in_lane: function (options) {
		return not(exports.if.in_lane(options));
	},

	// Cards modified within a period of time.
	// Options: {
	//		after_last: 'move' <only includes cards modified after they were last moved>
	//		since: <includes cards modified since this time. default=current time>
	//		id_days: <includes cards modified in this many days. default=0>
	//		in_hours: <includes cards modified in this many hours. default=0>
	//		in_minutes: <includes cards modified in this many minutes. default=0>
	//		in_seconds: <includes cards modified in this many seconds. default=0>
	// }
	modified: function (options) {
		var afterLastMove = ((options.after_last || '').toLowerCase() === 'move');

		var since = options.since;
		if (options.in_days) {
			since = new Date((since || new Date()).valueOf() - (options.in_days * 1000 * 60 * 60 * 24));
		}
		if (options.in_hours) {
			since = new Date((since || new Date()).valueOf() - (options.in_hours * 1000 * 60 * 60));
		}
		if (options.in_minutes) {
			since = new Date((since || new Date()).valueOf() - (options.in_minutes * 1000 * 60));
		}
		if (options.in_seconds) {
			since = new Date((since || new Date()).valueOf() - (options.in_seconds * 1000));
		}

		return function (lane, card) {
			if (
				(!afterLastMove || (new Date(card.LastMove) < new Date(card.LastActivity))) &&
				(!since || (new Date(card.LastActivity) >= since))
			) {
				return exports.FILTER_RESULT.CardIncluded;
			}

			return exports.FILTER_RESULT.CardExcluded;
		}
	},

	// Cards not modified within a period of time.
	// Options: {
	//		after_last: 'move' <only includes cards not modified after they were last moved>
	//		since: <includes cards not modified since this time. default=current time>
	//		id_days: <includes cards not modified in this many days. default=0>
	//		in_hours: <includes cards not modified in this many hours. default=0>
	//		in_minutes: <includes cards not modified in this many minutes. default=0>
	//		in_seconds: <includes cards not modified in this many seconds. default=0>
	// }
	not_modified: function (options) {
		return not(exports.if.modified(options));
	},

	// Cards with a tag
	// Options:single tag name
	tagged: function (options) {
		if (options.indexOf(',') >= 0)
			throw new Error('options must be a single tag name without commas');

		var hasTag = new RegExp('(^|,)' + options + '(,|$)', 'i');

		return function (lane, card) {
			if (hasTag.test(card.Tags))
				return exports.FILTER_RESULT.CardIncluded;

			return exports.FILTER_RESULT.CardExcluded;
		}
	},

	// Cards without a tag
	// Options:single tag name
	not_tagged: function (options) {
		return not(exports.if.tagged(options));
	}
}

// Inverts another filter
function not(filter) {
	return function (lane, card) {
		var result = filter(lane, card);

		if (result === exports.FILTER_RESULT.CardIncluded)
			return exports.FILTER_RESULT.CardExcluded;

		if (result === exports.FILTER_RESULT.CardExcluded)
			return exports.FILTER_RESULT.CardIncluded;
	}
};




// Action factories
exports.do = {

	// Moves cards to a lane
	// options =  {
	//		lane: <pipe-delimited full lane title>,
	//		wipOverrideReason: <optional reason for a wip override if one is needed>
	move_to: function (leankit, board, options, callback) {
		if (!options.lane)
			throw new Error('Lane was not specified');

		// find the lane to move to
		var lane = exports.lane(board, options.lane);

		if (!lane)
			throw new Error('Lane not found. Use a pipe-delimited full title of the lane. Lane=\'' + options.lane + '\'');

		var wipOverrideReason = options.wipOverrideReason;

		return function (cards, execute, callback) {

			forEachAsync(cards, function (card, cardDone) {
				console.log('==> Move card [' + (card.ExternalCardID || card.Id) + ': ' + card.Title + '] to lane [' + lane.xFullTitle + ']');

				if (execute)
					leankit.moveCard(board.Id, card.Id, lane.Id, 0, wipOverrideReason, cardDone);
				else
					cardDone();
			},
			callback);
		};
	}
}

// Executes a rule set
exports.run = function(leankit, boardOrId, execute, rules, callback) {

	function doit(board) {
		var ruleState = [];

		// compilation and validation
		rules.forEach(function (rule) {

			// filters
			if (!rule.cards)
				throw new Error('Rule must specify some card filters');

			var filters = [];

			for (var name in rule.cards) {
				var factory = exports.if[name];

				if (!factory)
					throw new Error('Card filter not found: ' + name);

				filters.push(factory(rule.cards[name]));
			}

			// actions
			if (!rule.actions)
				throw new Error('Rule must specify some actions');

			var actions = [];

			for (var name in rule.actions) {
				var factory = exports.do[name];

				if (!factory)
					throw new Error('Card action not found: ' + name);

				actions.push(factory(leankit, board, rule.actions[name]));
			}

			ruleState.push({ filters: filters, actions: actions, description: JSON.stringify(rule) });
		});

		// select cards
		ruleState.forEach(function (rule) {
			rule.selectedCards = exports.cards(board, rule.filters);
		});

		// execute actions
		forEachAsync(ruleState, function (rule, ruleDone) {

			if (rule.selectedCards.length) {
				console.log('');
				console.log(rule.description);
				console.log('==> ' + rule.selectedCards.length + ' cards');

				forEachAsync(rule.actions, function (action, actionDone) {
					action(rule.selectedCards, execute, function () {
						actionDone.apply(this, arguments);
					});
				},
				ruleDone);
			}
			else
				ruleDone();
		},
		callback);
	}

	if (typeof (boardOrId) === 'number' || typeof (boardOrId) === 'string') {
		console.log('Downloading board...');
		leankit.getBoard(boardOrId, function (error, board) {
			if (error)
				return callback(error);

			doit(board);
		});
	}
	else
		doit(boardOrId);
}


// Build indexes for a board
function index(board) {
	if (board.xIndex)
		return;

	var index = board.xIndex = {
		allLanes: [],
		lanesById: {},
		lanesByTitle: {}
	}

	// Combine Backlog, In Process and Archive lanes
	board.Lanes.forEach(function (lane) {
		index.allLanes.push(lane);
	});

	board.Backlog.forEach(function (lane) {
		index.allLanes.push(lane);
	});

	board.Archive.forEach(function (lane) {
		index.allLanes.push(lane);
	});

	// index the lanes
	index.allLanes.forEach(function (lane) {
		index.lanesById[lane.Id.toString()] = lane;
	});

	// Add xFullTitle to simplify filters
	index.allLanes.forEach(function (lane) {
		var fullTitle = lane.Title;

		for (var parentLane = index.lanesById[lane.ParentLaneId.toString()]; parentLane != null; parentLane = index.lanesById[parentLane.ParentLaneId.toString()]) {
			fullTitle = parentLane.Title + '|' + fullTitle;
		}

		lane.xFullTitle = fullTitle;
		index.lanesByTitle[fullTitle.toLowerCase()] = lane;
	});

}

// Utility function for processing an array asynchronously
function forEachAsync(queue, action, callback) {

	var i = 0;
	var processNext = null;

	doNext = function (error) {
		if (error) {
			if (callback)
				callback(error);
		}
		else if (i < queue.length) {
			action(queue[i++], doNext);
		}
		else {
			if (callback)
				callback();
		}
	};

	doNext();
}
