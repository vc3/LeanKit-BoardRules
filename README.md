LeanKit-BoardRules
==================

Node script and module that does things to cards on a LeanKit board.

Command Line Usage (run-rules.js):
----------------------------------
```
node run-rules.js email password <execute|report> configFile');
```

Arguments:
  - email:      Email address of user to connect as
  - password:   Password of user to connect as
  - execute:    Specify to execute the rules
  - report:     Specify to show a report of what will occur if rules are executed
  - configFile:  JavaScript file that defines the rule configuration (exports = {account, boardId, rules})
  

Example config file:
-------------
  
 Config files are just node modules (single JavaScript file) that exports the following:

  - account: The name of your organization account registered with LeanKit.com
  - boardId: The id of the board the rules apply to. You can get this by looking at the URL to a card on the board. Its the first large number in the URL.
  - rules: Array of card selectors and actions. Check out sample-rules.js for an example.
  
  
Example Config:
-------------
```javascript

// How long to wait until a card is demoted in the backlog
var daysUntilDemontion = 30;

exports.account = 'your-account-name';
exports.boardId = 123456789;

exports.rules = [
	// Promote cards with activity
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 2', modified: { after_last: 'Move' } },
		actions: { move_to: { lane: 'Backlog|Aging Out|Generation 1' } }
	},
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 3', modified: { after_last: 'Move' } },
		actions: { move_to: { lane: 'Backlog|Aging Out|Generation 1' } }
	},

	// Demote cards without activity
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 1', not_modified: { in_days: daysUntilDemontion } },
		actions: { move_to: { lane: 'Backlog|Aging Out|Generation 2' } }
	},
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 2', not_modified: { in_days: daysUntilDemontion } },
		actions: { move_to: { lane: 'Backlog|Aging Out|Generation 3' } }
	},

	// Age out cases
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 3', not_modified: { in_days: daysUntilDemontion }, tagged: 'case' },
		actions: { move_to: { lane: 'Backlog|Aged Cases' } }
	},

	// Age out non-cases
	{
		cards: { in_lane: 'Backlog|Aging Out|Generation 3', not_modified: { in_days: daysUntilDemontion }, not_tagged: 'case' },
		actions: { move_to: { lane: 'Archive|Aged Out' } }
	}
];
```

Card Selectors
=============
These selectors apply to all cards in the backlog, in process and archive areas of a board.

Selectors can be extended by adding factory methods to the boardRules.if object. Send a pull request if you'd like to share a selector.


in_lane
-------
Selects all cards in a lane, excluding sub-lanes. Argument is the full, pipe-delimited name of the lane.

Example:
```
{in_lane: 'Backlog|Next Up'}
```


modified
--------
Selects cards modified within a period of time.

Options:
  - after_last: 'move' <only includes cards modified after they were last moved>
  - since: <includes cards modified since this time. default=current time>
  - id_days: <includes cards modified in this many days. default=0>
  - in_hours: <includes cards modified in this many hours. default=0>
  - in_minutes: <includes cards modified in this many minutes. default=0>
  - in_seconds: <includes cards modified in this many seconds. default=0>

Example: cards modified after they were last moved
```
{modified: {after_last: 'mode'}}
```

Example: cards modified within the last week
```
{modified: {in_days: 7}}
```

Example: cards modified after a specific date and time
```
{modified: {since: aJavaScriptDate}}
```

tagged
------
Selects cards that are tagged with a specific tag. Tag matching is case insensitive.

Example:
```
{tagged: 'YourTagName'}
```


not_in_lane, not_modified, not_tagged
-------------------------------------
Appending 'not_' to a selector will invert it. All cards that it would normally exclude will be selected and those normally selected, excluded.


Card Actions
============

Currently there's only one card action: move_to. However, actions are extensible if you'd like to add more (see: boardRules.do). Send a pull request if you'd like to share an action you've written.


move_to
-------
Moves cards into a lane
  - lane: Pipe-delimited full title of the lane. For example: 'Backlog|Next Up'
  - wipOverrideReason: Optional reason for a WIP override if one is needed to move the card into the lane

Example: move cards to the archive
```
{move_to: {lane: 'Archive' }}
```

Example: move cards to the 'Next Up' lane and specify a WIP override reason if needed
``` javascript
{move_to: {lane: 'Backlog|Up Next', wipOverrideReason: 'This is another number one priority!' }}
```


Test Coverage
============
There's pretty good test coverage of the selectors and actions. Tests require Jasmine to run and are in the ```spec``` folder.

```
jasmine-node spec
```