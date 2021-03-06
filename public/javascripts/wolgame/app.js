requirejs.config({
    baseUrl: 'javascripts/wolgame'
});

require(['wol/wol','game/main','cookies','wol/keys'], function(wol, Game, Cookies, keys){
    "use strict";

    // use for name
    var vendorName = navigator.vendor.replace(/(^\w+).+/, function (a, b) {
        return b;
    });

    /**
     * The main DOM element container for the game including the UI
     * and the game canvas.
     * @type {HTMLElement}
     */
    var el = document.getElementById('main');
    /**
     * The canvas container.
     * @type {HTMLElement}
     */
    var canvasContainer;
    /**
     * An instance of a game.
     * @type {Game}
     */
    var game = null;

    var socket = null;
    /**
     * Player data.
     * @type {Object}
     */
    var player = {};

    /**
     * List of players in the game.
     * @type {Array}
     */
    var players = [];

    /**
     * A dictionary of the list of teams.
     * @type {Object}
     */
    var teamUsers = {};

    /**
     * Tells the state of the menu. E.g. 'cancel', 'move', etc.
     * @type {null}
     */
    var menuState = null;

    /**
     * A flag to determine if the game is already finished.
     * @type {Boolean}
     */
    var gameEnded = false;

    /**
     * Tinkering mode.
     * @type {Boolean}
     */
    var debug = false;

    /**
     * Debug mode
     * @type {String}
     */
    var host = window.location.hostname.indexOf('local') > -1
        ? 'http://localhost:3000/'
        : 'http://wingsoflemuria.com:3000';

    /**
     * Template for generating html.
     * @type {Object}
     */
    var tpl = {

        /**
         * Basic template substitution
         * @param string
         * @param object
         * @return {*}
         */
        sub: function(string, object) {
            var str = string;
            for(var key in object) {
                str = str.replace("{{" + key + "}}", object[key]);
            }
            return str;
        },
        /**
         *
         * @param data
         * @return {*}
         */
        turnList: function(data) {
            return this.sub("<li class='avatar {{code}} {{alternate}}'></li>", data);
        },
        /**
         *
         * @param data
         * @return {*}
         */
        actionBar: function(data) {
            return this.sub("<div class='bar'></div>", data);
        }
    };

    /**
     * Initialize the socket connection immediately.
     * Load the assets later.
     */
    function init() {
        if (checkUserAgent()) {
            wol.events.emit('sheet.mirror.marine'); // preload the mirrored marine.
            wol.events.emit('sheet.mirror.vanguard'); // preload the mirrored marine.
            //socket = io.connect('http://wingsoflemuria.com:8080/');
            socket = io.connect(host);
            socket
                .on('auth.response', authResponse)
                .on('game.join', joinGame)
                .on('game.start', startGame)
                .on('game.end', endGame)
                .on('player.add', addPlayer)
                .on('players.ready', playersReady)
            ;
            document.body.oncontextmenu = disableContextMenu;
            wol.dom.removeClass(wol.$('#modal-message'), 'hidden');
            wol.events.on('volume.on', soundOn);
            wol.events.on('volume.off', soundOff);
            wol.dom.click(wol.$('#settings .sound-icon'), toggleSound);
            log('initializing');
            wol.dom.empty(wol.$('#modal-message ul'));
            setAuthKey();
        }
    }

    /**
     * Disable to prevent accidentally clicking the Go back menu
     * @param event
     */
    function disableContextMenu(event) {
        console.log('context menu is disabled to prevent accidentally clicking "go back"');
        return false;
    }

    function log(message) {
        var logList = wol.$('#modal-message ul');
        logList.innerHTML += "<li>" + message + "</li>";
    }

    /**
     * When both clients are already ready for the game
     */
    function playersReady() {
        log('Players both ready. Initiating Game');
        wol.play();
        wol.preloader.hide();
        hideMessageLog();
    }

    /**
     * When the game is initialized and ready to be
     * manipulated.
     * @param g
     */
    function ready(g /** Game **/) {
        if (!gameEnded) {
            game = g;
            game.player = player;
            game.debug = debug;
            game.on('unit.update', gameUnitUpdate); //
            game.on('unit.act', gameUnitAct); // when a unit does an action
            game.on('unit.act.end', gameUnitActEnd); // when a unit ends its turn
            game.on('unit.move', gameUnitMove);
            game.on('unit.show.move', showMoveCommand);
            game.on('unit.attack', gameUnitAttack);

            players.forEach(game.addPlayer.bind(game));

            socket
                .on('unit.spawn', unitSpawn)
                .on('unit.attack', unitAttack)
                .on('unit.move', unitMove)
                .on('unit.skip', unitSkip)
                .on('unit.turn', unitTurn)
                .on('units.turn.list', unitsTurnList)
            ;

            setPlayersInfo();
            // initialize mouse events
            wol.dom.click(wol.$('#unit-actions .move.command'), showMoveCommand);
            wol.dom.click(wol.$('#unit-actions .skip.command'), skipTurn);
            wol.keys.on(wol.KeyCodes.ESC, showCancelCommand);
            wol.keys.on(wol.KeyCodes.V, showMoveCommand);
            wol.pause();
            log('Map loaded. Waiting for opponent...');
            send('ready');
        } else {
            log('Map loaded. But opponent left the game.');
        }
    }

    function setPlayersInfo() {
        var playersElement = wol.$('#players'),
            playerLeftElement = wol.dom.query(playersElement, '.left'),
            playerRightElement = wol.dom.query(playersElement, '.right'),
            playerA = players[0],
            playerB = players[players.length-1]
            ;
        wol.dom.query(playerLeftElement, '.name').textContent = playerA.id == player.id ? 'You' : 'Enemy';
        wol.dom.query(playerRightElement, '.name').textContent = playerB.id == player.id ? 'You' : 'Enemy';
        wol.wait(1000, function() {
            wol.dom.removeClass(playersElement,'hidden');
        });

    }

    function hideUnitActionMenu() {
        var actionPanel = wol.$('#unit-actions');
        wol.dom.addClass(actionPanel, 'hidden');
        game.clearHexTiles(game.activeUnit, 'range reach');
        menuState = null;
    }

    function hideMessageLog() {
        wol.dom.addClass(wol.$('#modal-message'), 'hidden');
    }

    function showCancelCommand() {
        if (game.activeUnit.playerId === player.id) {
            game.cancelUnitOptions(game.activeUnit);
            menuState = 'cancel';
        }
    }

    function gameUnitActEnd(unit) {
        menuState = null;
    }

    function gameUnitAct(unit) {
        var actionStats;
        menuState = 'acting';
        if (unit && unit.stats && unit.stats.get) {
            if ((actionStats = unit.stats.get('actions')) && actionStats.value === 0) {
                game.clearHexTiles(unit, 'active');
                hideUnitActionMenu();
            }
        }
    }

    function gameUnitAttack(parameters) {
        var unit = parameters.unit;
        if (game.activeUnit === unit) {
            send('unit.attack', {
                id: unit.id,
                x: parameters.x,
                y: parameters.y
            })
        }
    }

    function gameUnitMove(parameters) {
        var unit = parameters.unit;
        var tile = parameters.tile;
        send('unit.move', {
            id: unit.id,
            x: tile.x,
            y: tile.y
        })
    }


    function unitMove(data) {
        var unit, tile;
        if (unit = game.units.get(data.id)) {
            if (unit.playerId !== player.id) {
                if (tile = game.hexgrid.get(data.x, data.y)) {
                    game.unitMove(unit, tile);
                }
            }
        }
    }

    function skipTurn() {
        if (game.activeUnit.playerId === player.id) {
            send('unit.skip', game.activeUnit.id);
            hideUnitActionMenu();
        }
    }

    function unitAttack(parameters) {
        var id = parameters.id;
        var targets = parameters.targets;
        var unit;
        // verify if unit id exists in the game.
        if (unit = game.units.get(id)) {
            // ignore if the sender is the current player.
            if (unit.playerId !== player.id) {
                //game.unitAttack(unit, targets);
                // verify the target ids
                var targetData;
                var target;
                var targetsFiltered = [];
                for(var i=0; i<targets.length; i++) {
                    targetData = targets[i];
                    if (target = game.units.get(targetData.id)) {
                        targetsFiltered.push({
                            unit: target,
                            damage: targetData.damage
                        });
                    }
                }
                game.unitAttack(unit, targetsFiltered);
            }
        }
    }

    function unitSkip(data) {
        var unit;
        if (unit = game.units.get(data.id)) {
            game.clearHexTiles(unit, 'active');
        }
    }

    function gameUnitUpdate(unit) {
        if (unit === game.activeUnit) {
            var actionPanel = wol.$('#unit-actions');
            var actionBars = wol.dom.query(actionPanel, '.bars');
            var actionStat = unit.stats.get('actions');
            var bars = wol.dom.queryAll(actionBars, '.bar:not(.empty)');
            var index = bars.length - actionStat.value;
            while(index > 0) {
                wol.dom.addClass(bars[bars.length - index], 'empty');
                index--;
            }
        }
    }

    /**
     *
     * @param data
     */
    function unitsTurnList(data) {
        var list = data.turnList;
        var el = wol.$('#turn-list');
        var domList = wol.$(el, 'ul');
        var unit;
        var id;
        var alternate;
        domList.innerHTML = '';
        for (var i = 0, total = list.length; i < total; i++) {
            id = list[i];
            if (unit = game.units.get(id)) {
                alternate = teamUsers[unit.playerId].index > 1 ? 'alt' : '';
                domList.innerHTML += tpl.turnList({ code: unit.code, alternate: alternate });
            }
        }
        wol.dom.removeClass(el, 'hidden');
    }

    /**
     *
     * @param data
     */
    function unitTurn(data) {
        var id = data.id;
        var unit;
        /*
        "hex_attack": [13],
            "hex_bg": [14],
            "hex_player_a": [15],
            "hex_player_b": [16],
            "hex_player_selected": [17],
            "hex_select": [18],
            "hex_target": [19] */
        
        /// most of these are DOM UI stuff. Don't worry :-)
        if (unit = game.units.get(id)) {
        	game.updateRandomGrid(unit);
            game.setUnitActive(unit);
            // active unit is used to identify if the unit commands need to be shown.
            unit.tileStart = unit.tile;
            unit.stats.get('actions').reset();
            setBannerText(
                unit.playerId === player.id ?
                    "It's currently your unit's turn." :
                    'The enemy is taking its turn.'
            );
            if (unit.playerId === player.id) {
                unit.enable();
                // show the unit action panel
                var actionPanel = wol.$('#unit-actions');
                var healthStat = unit.stats.get('health');
                wol.dom.removeClass(actionPanel, 'hidden');
                // update the avatar
                var avatarElement = wol.$(actionPanel, '.avatar');
                wol.dom.removeClass(avatarElement);
                wol.dom.addClass(avatarElement, 'avatar');
                wol.dom.addClass(avatarElement, unit.code);
                // update the action bars
                var actionStat = unit.stats.get('actions');
                var actionBars = wol.$(actionPanel, '.actions .bars');
                var barWidth = 100 / actionStat.max;
                wol.dom.empty(actionBars);
                for(var i=0; i<actionStat.max; i++) {
                    actionBars.innerHTML += tpl.actionBar();
                    wol.dom.last(actionBars).style.width = barWidth + '%';
                }
            }
        }
    }

    function showEndGame(message, lost) {
        var victoryMessage = wol.$('#victory-message');
        wol.dom.addClass(victoryMessage, 'active');
        wol.dom.query(victoryMessage, '.message').textContent = message;
        wol.dom.addClass(wol.$('#players'), 'hidden');
        wol.dom.addClass(wol.$('#unit-actions'), 'hidden');
        if (lost) {
            wol.dom.addClass(victoryMessage, 'lost');
        }
    }

    /**
     * @param data
     */
    function addPlayer(data) {
        players.push(data);
        teamUsers[data.id] = data;
    }

    /**
     *
     * @param data
     */
    function unitSpawn(data) {
        game.unitSpawn(data);
    }

    /**
     *
     * @param topic
     * @param data
     */
    function send(topic, data) {
        //console.log('sending...', topic, data);
        socket.emit(topic, data);
    }

    function setBannerText(message) {
        var bannerElement = wol.$('#players .center');
        bannerElement.textContent = message;
    }

    /**
     *
     */
    function showMoveCommand() {
        var unit;
        if (menuState === 'move') {
            showCancelCommand();
        } else if (menuState !== 'acting') {
            if (unit = game.activeUnit) {
                if (unit.playerId === player.id ) {
                    game.unitRange(unit);
                    menuState = 'move';
                }
            }

        }
    }

    /**
     * Update the client and tell them to start one. I didn't put a
     * condition here to prevent from re-initializing since this is
     * purely a server-side event.
     */
    function joinGame(data) {
        var id = data.id;
        log('Game found. Waiting for players...');
    }

    function startGame(data) {
        if (!game) {
            log('starting game');
            canvasContainer = document.getElementById('game');
            wol.init(Game, canvasContainer, 960, 640, ready);
            log('loading game');
        }
    }

    /**
     *
     */
    function toggleSound() {
        var soundIcon = wol.$('#settings .sound-icon');
        wol.dom.hasClass(soundIcon, 'off') ? wol.sound.volume(1) : wol.sound.volume(0);
        console.log('toggle');
    }

    function soundOn(id) {
        console.log('volume.on');
        wol.dom.removeClass(wol.$('#settings .sound-icon'), 'off');
    }

    function soundOff(id) {
        console.log('volume.off');
        wol.dom.addClass(wol.$('#settings .sound-icon'), 'off');
    }

    function endGame(data) {
        var messageLog = wol.$('#modal-message');
        gameEnded = true;
        switch(data.type) {
            case 'player.leave':
                wol.dom.removeClass(messageLog, 'hidden');
                wol.dom.addClass(wol.$('#unit-actions'),'hidden');
                log(data.message);
                showEndGame('The player has left', true);
                break;
            case 'player.win':
                if (data.winnerId === player.id) {
                    showEndGame('Your team is victorious!');
                } else {
                    showEndGame('Your forces have been eliminated', true);
                }
                break;
        }

    }

    function findGame() {
        var mode = debug ? 'tutorial' : '2v2';
        setTeam();
        log('Finding game...');
        send('game.find', { team: player.team, mode: mode });
    }

    /**
     * Update the client player information
     * @param data
     */
    function authResponse(data) {
        switch (data.type) {
            case 'error':
                log('error: ' + data.error);
                break;
            case 'new_user':
                log('welcome, stranger!');
                log('please set your name to login.');
                log("You will temporarily be identified via cookies.");
                setName();
                break;
            case 'connected':
                player.id = data.id;
                player.name = data.name;
                player.authKey = data.authKey;
                Cookies.set('wol_id', player.authKey);
                log('You are now connected, ' + player.name);
                findGame();
                break;
        }
    }

    function checkUserAgent() {
        var result = true;
        if ('standalone' in window.navigator && !window.navigator.standalone) {
            wol.dom.removeClass(wol.$('#add-to-homescreen'), 'hidden');
            wol.pause();
            wol.$('#main').style.display = 'none';
            result = false;
        } else {
            if ('orientation' in window) {
                var devicePixelRatio = window.devicePixelRatio;
                var viewport = wol.$('meta[name=viewport]');
                var ratio = 1 / devicePixelRatio;
                var orientChange = (function() {
                    var scale = window.orientation === 0 ? 1 : ratio;
                    viewport.setAttribute(
                        'content',
                        'width=device-width' +
                        ', initial-scale=' + scale +
                        ', max-scale=' + scale +
                        ', min-scale=' + scale +
                        ', user-scalable=0'
                    );
                });
                window.onorientationchange = orientChange;
                orientChange();
            }
        }
        if (window.location.search.indexOf('tutorial') > -1) {
            debug = true;
        }
        return result;
    }

    /**
     * Send the client's AuthKey based on Cookies.
     */
    function setAuthKey() {
        var authKey = Cookies.get('wol_id');
        log('authenticating...');
        send('auth', { authKey: authKey});
    }

    function setName() {
        player.name = vendorName;
        log('Player set name');
        send('player.set.name', {
            name: player.name
        });
    }

    function setTeam() {
        player.team = 'lemurians';
        log('Setting team to ' + player.team);
    }
    window.addEventListener('load', init);
});
