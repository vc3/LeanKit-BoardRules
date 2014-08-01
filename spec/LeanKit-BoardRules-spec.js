
var fs = require('fs');

var boardRules = require('../LeanKit-BoardRules.js');

// Creates a copy of a sample board
function sampleBoard() {
	return JSON.parse(fs.readFileSync('spec\\sample-board.json', 'utf8')).ReplyData[0];
}

// Returns a new date based on another date offset by a number of days
function addDays(date, days) {
	return new Date(date.valueOf() + (days * 1000 * 60 * 60 * 24));
}

// Returns a new date based on another date offset by a number of seconds
function addSeconds(date, seconds) {
	return new Date(date.valueOf() + (seconds * 1000));
}

describe('boardRules.lane()', function () {
	var board = sampleBoard();

	it('finds backlog lanes', function () {
		expect(boardRules.lane(board, 'Backlog|Lane 2') != null).toBe(true);
	});

	it('finds in process lanes', function () {
		expect(boardRules.lane(board, 'TODO') != null).toBe(true);
	});
});

describe('boardRules.cards()', function () {
	var board = sampleBoard();

	it('no filters return all cards', function () {
		var allCards = boardRules.cards(board, [function () { return boardRules.FILTER_RESULT.CardIncluded; }]).length;

		expect(allCards > 0).toBe(true);

		expect(boardRules.cards(board).length).toBe(allCards);
		expect(boardRules.cards(board, null).length).toBe(allCards);
		expect(boardRules.cards(board, []).length).toBe(allCards);
	})
});

describe('boardRules.if.in_lane() / not_in_lane()', function () {
	var board = sampleBoard();

	it('in_lane() should find its child cards', function () {
		var cards = boardRules.cards(board, [boardRules.if.in_lane('Backlog|Lane 1')]);

		expect(cards.length).toBe(1);
		expect(cards[0].Title).toBe('Testing 1');
	})

	it('in_lane() should NOT find cards in sub lanes', function () {
		var cards = boardRules.cards(board, [boardRules.if.in_lane('Backlog|Lane 2')]);
		expect(cards.length).toBe(0);
	})

	it('not_in_lane() should exclude its child cards', function () {
		var cards = boardRules.cards(board, [boardRules.if.not_in_lane('Backlog|Lane 1')]);
		expect(cards.every(function (card) { return card.Title != 'Testing 1' })).toBe(true);
	})
});


describe('boardRules.if.modified() / not_modified()', function () {

	var board;
	var totalCards;
	var oldCardAge = 10;
	var oldCardDate = addDays(new Date(), -oldCardAge);

	beforeEach(function () {
		// set a common modification date for all cards
		board = sampleBoard();
		totalCards = 0;
		boardRules.cards(board).forEach(function (card) {
			card.LastActivity = oldCardDate;
			card.LastMove = oldCardDate;
			++totalCards;
		});
	});

	// modified() -----------------------------------------------------------------------------
	it('modified({in_days}) should not find cards last modified more than <in_days> ago', function () {
		var cards = boardRules.cards(board, [boardRules.if.modified({ in_days: oldCardAge + 1 })]);
		expect(cards.length).toBe(totalCards);
	});

	it('modified({in_days}) should find cards last modified less than <in_days> ago', function () {
		var cards = boardRules.cards(board, [boardRules.if.modified({ in_days: oldCardAge - 1 })]);
		expect(cards.length).toBe(0);
	});

	it('modified({since}) should not find cards last modified before <since>', function () {
		var cards = boardRules.cards(board, [boardRules.if.modified({ since: addSeconds(oldCardDate, -1) })]);
		expect(cards.length).toBe(totalCards);
	});

	it('modified({since}) should find cards last modified after <since>', function () {
		var cards = boardRules.cards(board, [boardRules.if.modified({ since: addSeconds(oldCardDate, 1) })]);
		expect(cards.length).toBe(0);
	});

	it('modified({after_last: \'Move\'}) should find cards only modified after they were last moved', function () {

		var cardTitleModifiedAfterMove = 'Testing 1';

		// Simulate a modification after a move
		boardRules.cards(board).forEach(function (card) {
			if (card.Title == cardTitleModifiedAfterMove) {
				// modified 1 second after it was moved
				card.LastActivity = addSeconds(card.LastMove, 1);
			}
			else {
				// Otherwise, the last activity WAS the move
				card.LastActivity = card.LastMove;
			}
		});

		var cards = boardRules.cards(board, [boardRules.if.modified({ after_last: 'move' })]);
		expect(cards.length).toBe(1);
	});


	// not_modified() -------------------------------------------------------------------------
	it('not_modified({in_days}) should find cards last modified more than <in_days> ago', function () {
		var cards = boardRules.cards(board, [boardRules.if.not_modified({ in_days: oldCardAge + 1 })]);
		expect(cards.length).toBe(0);
	});

	it('not_modified({in_days}) should not find cards last modified less than <in_days> ago', function () {
		var cards = boardRules.cards(board, [boardRules.if.not_modified({ in_days: oldCardAge - 1 })]);
		expect(cards.length).toBe(totalCards);
	});

	it('not_modified({since}) should find cards last modified before <since>', function () {
		var cards = boardRules.cards(board, [boardRules.if.not_modified({ since: addSeconds(oldCardDate, -1) })]);
		expect(cards.length).toBe(0);
	});

	it('not_modified({since}) should not find cards last modified after <since>', function () {
		var cards = boardRules.cards(board, [boardRules.if.not_modified({ since: addSeconds(oldCardDate, 1) })]);
		expect(cards.length).toBe(totalCards);
	});
});



describe('boardRules.if.tagged() / not_tagged()', function () {

	// Assigns tags to cards based on card sequence
	function boardWithTags(tagMap) {
		// set a common modification date for all cards
		var board = sampleBoard();

		boardRules.cards(board, []).forEach(function (card) {
			card.Tags = (tagMap[card.Title] || '');
		});

		return board;
	}

	it('tagged() should find a card with a single tag', function () {
		var board = boardWithTags({ 'Testing 1': 'Tag1' });

		var cards = boardRules.cards(board, [boardRules.if.tagged('Tag1')]);

		expect(cards.length).toBe(1);
		expect(cards[0].Title).toBe('Testing 1');
	});

	it('not_tagged() should not find a card with a single tag', function () {
		var board = boardWithTags({ 'Testing 1': 'Tag1' });

		var totalCards = boardRules.cards(board).length;
		var cards = boardRules.cards(board, [boardRules.if.not_tagged('Tag1')]);

		expect(cards.length).toBe(totalCards - 1);

		expect(cards.every(function (card) { return card.Title != 'Testing 1' })).toBe(true);
	});

	it('tagged() should find a card with multiple tags, where the tag at the start of the list', function () {
		var board = boardWithTags({ 'Testing 1': 'Tag1,Tag2,Tag3' });

		var cards = boardRules.cards(board, [boardRules.if.tagged('Tag1')]);

		expect(cards.length).toBe(1);
		expect(cards[0].Title).toBe('Testing 1');
	});

	it('tagged() should find a card with multiple tags, where the tag is in the middle of the list', function () {
		var board = boardWithTags({ 'Testing 1': 'Tag1,Tag2,Tag3' });

		var cards = boardRules.cards(board, [boardRules.if.tagged('Tag2')]);

		expect(cards.length).toBe(1);
		expect(cards[0].Title).toBe('Testing 1');
	});

	it('tagged() should find a card with multiple tags, where the tag is at the end of the list', function () {
		var board = boardWithTags({ 'Testing 1': 'Tag1,Tag2,Tag3' });

		var cards = boardRules.cards(board, [boardRules.if.tagged('Tag3')]);

		expect(cards.length).toBe(1);
		expect(cards[0].Title).toBe('Testing 1');
	});

});



describe('boardRules.do.move_to()', function () {
	var board = sampleBoard();


	it('moves one card', function () {
		var leankit = {
			moveCard: mock('moveCard')
		};

		var destLane = boardRules.lane(board, 'Backlog|Lane 2|Lane B');

		var card = boardRules.cards(board, [boardRules.if.not_in_lane(destLane.xFullTitle)])[0];
		expect(!!card).toBe(true);

		leankit.moveCard.should(function (boardId, cardId, toLaneId, position, wipOverrideReason, callback) {
			expect(boardId).toBe(board.Id);
			expect(cardId).toBe(card.Id);
			expect(toLaneId).toBe(destLane.Id);

			callback();
		});

		var callback = mock('callback').should(function (error) { expect(error === undefined).toBe(true); });

		var move_to = boardRules.do.move_to(leankit, board, { lane: destLane.xFullTitle });
		move_to([card], true, callback);

		callback.expectDone();
		leankit.moveCard.expectDone();
	});

	it('moves multiple cards', function () {
		var leankit = {
			moveCard: mock('moveCard')
		};

		var destLane = boardRules.lane(board, 'Backlog|Lane 2|Lane B');

		var cards = boardRules.cards(board, [boardRules.if.not_in_lane(destLane.xFullTitle)]);
		expect(cards.length > 0).toBe(true);

		cards.forEach(function (card) {
			leankit.moveCard.should(function (boardId, cardId, toLaneId, position, wipOverrideReason, callback) {

				expect(boardId).toBe(board.Id);
				expect(cardId).toBe(card.Id);
				expect(toLaneId).toBe(destLane.Id);

				callback();
			});
		});

		var callback = mock('callback').should(function (error) { expect(error === undefined).toBe(true); });

		var move_to = boardRules.do.move_to(leankit, board, { lane: destLane.xFullTitle });
		move_to(cards, true, callback);

		callback.expectDone();
		leankit.moveCard.expectDone();
	});
});

describe('boardRules.run()', function () {
	it('executes rules', function () {
		var leankit = {
			moveCard: mock('moveCard')
		};

		var board = sampleBoard();
		var destLane = boardRules.lane(board, 'Backlog|Lane 2|Lane B');

		var cards = boardRules.cards(board)
			.filter(function (card) {
				return card.Title == 'Testing 1' // Should be only card in Lane 1
			});
		expect(cards.length).toBe(1);

		cards.forEach(function (card) {
			leankit.moveCard.should(function (boardId, cardId, toLaneId, position, wipOverrideReason, callback) {

				expect(boardId).toBe(board.Id);
				expect(cardId).toBe(card.Id);
				expect(toLaneId).toBe(destLane.Id);

				callback();
			});
		});

		var callback = mock('callback').should(function (error) { expect(!!error).toBe(false); });

		boardRules.run(leankit, board, true, [
			{
				cards: { in_lane: 'Backlog|Lane 1' },
				actions: { move_to: { lane: destLane.xFullTitle } }
			}
		],
		callback);

		callback.expectDone();
		leankit.moveCard.expectDone();
	});

	it('skips actions when not in execute mode', function () {
		var leankit = {
			moveCard: mock('moveCard')
		};

		var board = sampleBoard();
		var destLane = boardRules.lane(board, 'Backlog|Lane 2|Lane B');

		var cards = boardRules.cards(board);

		var callback = mock('callback').should(function (error) { expect(!!error).toBe(false); });

		// action should not actually be performed
		leankit.moveCard.expectDone();

		boardRules.run(leankit, board, false, [
			{
				cards: { in_lane: 'Backlog|Lane 1' },
				actions: { move_to: { lane: destLane.xFullTitle } }
			}
		],
		callback);

		callback.expectDone();
	});
});



// Super simple function mocking
function mock(name) {
	var handlers = [];

	var mocked = function () {
		var handler;

		if (handlers.length > 0) {
			handler = handlers[0];
			handlers = handlers.splice(1);
		}
		expect(handler != null).toBe(true);

		return handler.apply(this, arguments);
	}

	mocked.should = function (handler) {
		handlers.push(handler);
		return mocked;
	};

	mocked.expectDone = function () {
		expect(handlers.length).toBe(0, 'Expected no more function calls to remain. ' + name);
		return mocked;
	};

	return mocked;
}