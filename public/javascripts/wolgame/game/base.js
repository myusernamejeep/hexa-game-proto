define('game/base', function(require, exports, module) {
    "use strict";
    var wol = require('wol/wol'),
        Game = require('wol/game'),
        HexGrid = require('game/hexgrid'),
        elements = require('game/textures/elements'),
        Hex = require('game/hex'),
        HexGridComponent = require('game/components/hexgrid'),
        HexTileComponent = require('game/components/hextile'),
        UnitComponent = require('game/components/unit'),
        StatComponent = require('game/components/stats'),
        KeyboardComponent = require('wol/keys')
    ;
    
    var skill_act = ['001-Action01',
	'002-Action02',
	'003-Attack01',
	'004-Attack02',
	'005-Attack03',
	'006-Weapon01',
	'007-Weapon02',
	'008-Weapon03',
	'009-Weapon04',
	'010-Weapon05',
	'011-Weapon06',
	'012-Heal01',
	'013-Heal02',
	'014-Heal03',
	'015-Fire01',
	'016-Ice01',
	'017-Thunder01',
	'018-Water01',
	'019-Earth01',
	'020-Wind01',
	'021-Light01',
	'022-Darkness01',
	'023-Burst01',
	'024-Support01',
	'025-Support02',
	'026-Support03',
	'027-Support04',
	'028-State01',
	'029-Emotion01',
	'030-Explosion01'];

    var URI_BACKGROUND = '/media/background.png';

    // Include assets to the imageQueue
    wol.resources.add(URI_BACKGROUND);
	var magics = {};
    wol.resources.add('/media/into-hyperspace.mp3');
	
	var x =0, y = 0;
	for(var j=1; j<= skill_act.length; j++){
		var magic_name = skill_act[j-1];
		var _act = load_act_anims_png(magics,magic_name, x, y, "skill");
		wol.spritesheets.add(magic_name, _act);	 
	} 
	
	function load_act_anims_png(player, textures_name, x, y, folder, isFlip){
			 
		var images_pth = "javascripts/wolgame/game/" +folder + "/"+ textures_name +".png";
		var anim_sprite_magic = {
			"animations":
			{
				"run": [0, 25, "run" , 10],
				"end" : [-1]
			},
			"images": [images_pth],
			"frames": {
					"height": 192,
					"width":192,
					"regX": 0,
					"regY": 0 
			}
		};
		
		return anim_sprite_magic;
		/*
		var anim_sprite_sheet = anim_sprite_magic;
		var frameData = new createjs.SpriteSheet(anim_sprite_sheet);
 
		var anim_suffix = '';	
		if (isFlip){
			createjs.SpriteSheetUtils.addFlippedFrames(frameData, true, false, false);
			anim_suffix = '_h';	
		}
		var anim_act = new createjs.BitmapAnimation(frameData);
		anim_act.x =  x;
		anim_act.y = y;
		stage.addChild(anim_act);
		console.log(anim_act);
		anim_act.gotoAndPlay("run");
		player[textures_name] = {anim_act:anim_act, current_anim:"run", textures_name:textures_name };
		*/
	}
 
    // Include the elements sprite sheet
    wol.spritesheets.add('elements', elements);

    var HexGridGame = {

        hexgrid: new HexGrid(),
        background: null,
        hexContainer: wol.create.container(),
        unitContainer: wol.create.container(),
        columns:  9,
        rows:  9,
        cachedTextures: {},


        /**
         * Entry point
         */
        init: function() {
            this.parent();
            this.background = wol.create.bitmap(wol.resources.get(URI_BACKGROUND));
            this.add(this.background);
            this.add(this.hexContainer);
            this.add(this.unitContainer);
            this.hexgrid.generate(this.columns, this.rows);
            this.createStaticGridDisplay(this.hexgrid);
            // play the background music
            wol.sound.play(
                '/media/into-hyperspace.mp3',
                null, // interrupt
                null, // delay
                0, // offset
                -1 // loop
            );
        },
        /**
         *
         * @param entity
         * @param id
         * @param code
         * @param name
         * @param playerId
         * @return {*}
         */
        addEntity: function(entity, id, code, name, playerId) {
            // since this is a hex-grid game, we should apply a hexgrid component
            // to the entities we add into the display list.
            entity.addComponent('hexgrid');
            entity.addComponent('unit');
            entity.addComponent('hextile');
            entity.metaData(id, code, name, playerId);
            entity.hide();
            this.add(entity.container, this.unitContainer);
            return this;
        },
        /**
         * Creates a static bitmap for the grid.
         * @param grid
         */
        createStaticGridDisplay: function(grid) {
            var i, container, _this = this;
            container = wol.create.container();
            
            //console.log('this.hexgrid.tiles', this.hexgrid.tiles);
            /**/
            
         
            this.createTiles(this.hexgrid.tiles, 'hex_bg', function(hex) {
                _this.add(hex, container);
                console.log('hex', hex);
            }); 
            
            console.log('container', container);
            /*
            this.randomCreateTiles(this.hexgrid.tiles, function(hex) {
                _this.add(hex, container);
            });
            */
                // Cache the hexTile container.
                // We wait for a tick before we cache it. Because sometimes
                // Chrome fails to render on initial load.
            wol.create.cache(container, wol.width, wol.height);
            this.add(container, this.hexContainer);
        },
        
        tilesSelectable : function(){
        	return ["hex_attack",
            "hex_bg",
            "hex_player_a",
            "hex_player_b",
            "hex_player_selected",
            "hex_select",
            "hex_target"];
        },
        
        randomCreateTiles: function(tiles, callback) {
        	 console.log('tiles.length',tiles );
            var hex, tile, hexes;
            var tilesSelectable = this.tilesSelectable();
            hexes = [];
            for (var i = tiles.length - 1; i >= 0; i--){
            
            	var tile_type = parseInt(Math.random() * tilesSelectable.length);
            	var type =  tilesSelectable[tile_type];
            	//console.log('type',type,tile_type, tilesSelectable);
   				//type || (type = 'hex_bg');
                tile = tiles[i];
                hex = this.getTexture(type);
                hexes.push(hex);
                Hex.position(hex, tile);
                if (wol.isFunction(callback)) {
                    callback.call(this, hex, i);
                }

            }
            return hexes;
        },
        /**
         * Returns an array of hexes as well as issue a callback whenever they're instantiated.
         * @param tiles
         * @param type
         * @param callback
         * @return {Array}
         */
        createTiles: function(tiles, type, callback) {
        	//console.log(tiles, type);
            var hex, tile, hexes;
            type || (type = 'hex_select');
            hexes = [];
            for (var i = tiles.length - 1; i >= 0; i--){
                tile = tiles[i];
                hex = this.getTexture(type);
                hexes.push(hex);
                Hex.position(hex, tile);
                if (wol.isFunction(callback)) {
                    callback.call(this, hex, i);
                }

            }
            return hexes;
        },

        getTexture: function(name) {
            return wol.spritesheets.extract('elements', name);
        },

        getTextureSize: function(texture) {
            var spriteSheet = texture.spriteSheet;
            var frameIndex = spriteSheet.getAnimation(texture.currentAnimation).frames[0][0];
            var assetData = spriteSheet.getFrame(frameIndex);
            return {
                width: assetData.rect.width,
                height: assetData.rect.height
            };
        },

        findNearestPath: function(start, end) {
            var openList,
                closedList,
                currentNode,
                neighbors,
                neighbor,
                scoreG,
                scoreGBest,
                i,
                _len;
            openList = [start];
            closedList = [];
            while(openList.length) {
                var lowestIndex = 0;
                for(i=0,_len = openList.length; i < _len; i++) {
                    if (openList[i].f < openList[lowestIndex].f) {
                        lowestIndex = i;
                    }
                }
                currentNode = openList[lowestIndex];
                // case END: The result has been found.
                if (currentNode.pos() === end.pos()) {
                    var current = currentNode;
                    var parent;
                    var tiles = [];
                    while (current.parent) {
                        tiles.push(current);
                        parent = current.parent; // capture the parent element.
                        current.parent = null; // clear the tile's parent
                        current = parent; // move to the next parent
                    }
                    return tiles.reverse();
                }
                // case DEFAULT: Move current node to the closed list.
                openList.splice(currentNode, 1);
                closedList.push(currentNode);
                // Find the best score in the neighboring tile of the hex.
                neighbors = this.hexgrid.neighbors(currentNode);
                for(i=0, _len = neighbors.length; i < _len; i++) {
                    neighbor = neighbors[i];
                    if (closedList.indexOf(neighbor) > -1 || neighbor.entity) {
                        continue;
                    }
                    scoreG = currentNode.g + 1;
                    scoreGBest = false;
                    // if it's the first time to touch this tile.
                    if(openList.indexOf(neighbor) === -1) {
                        scoreGBest = true;
                        neighbor.h = this.hexgrid.euclidean(neighbor, end);
                        openList.push(neighbor);
                    }
                    else if (scoreG < neighbor.g) {
                        scoreGBest = true;
                    }
                    if (scoreGBest) {
                        neighbor.parent = currentNode;
                        neighbor.g = scoreG;
                        neighbor.f = neighbor.g + neighbor.h;
                    }
                }
            }
            return [];
        }
    };
    return module.exports = Game.extend(HexGridGame);
});
