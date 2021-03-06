(function ( cache ) {

	var Reference, getFunctionFromString;

	Evaluator = function ( root, keypath, functionStr, args, priority ) {
		var i, arg;

		this.root = root;
		this.keypath = keypath;

		this.fn = getFunctionFromString( functionStr, args.length );
		this.values = [];
		this.refs = [];

		i = args.length;
		while ( i-- ) {
			arg = args[i];

			if ( arg[0] ) {
				// this is an index ref... we don't need to register a dependant
				this.values[i] = arg[1];
			}

			else {
				this.refs[ this.refs.length ] = new Reference( root, arg[1], this, i, priority );
			}
		}

		this.selfUpdating = ( this.refs.length <= 1 );

		this.update();
	};

	Evaluator.prototype = {
		bubble: function () {
			// If we only have one reference, we can update immediately...
			if ( this.selfUpdating ) {
				this.update();
			}

			// ...otherwise we want to register it as a deferred item, to be
			// updated once all the information is in, to prevent unnecessary
			// cascading. Only if we're already resolved, obviously
			else if ( !this.deferred ) {
				this.root._defEvals[ this.root._defEvals.length ] = this;
				this.deferred = true;
			}
		},

		update: function () {
			var value;

			try {
				value = this.fn.apply( null, this.values );
			} catch ( err ) {
				if ( this.root.debug ) {
					throw err;
				} else {
					value = undefined;
				}
			}

			if ( !isEqual( value, this.value ) ) {
				clearCache( this.root, this.keypath );
				this.root._cache[ this.keypath ] = value;
				notifyDependants( this.root, this.keypath );

				this.value = value;
			}

			return this;
		},

		// TODO should evaluators ever get torn down?
		teardown: function () {
			while ( this.refs.length ) {
				this.refs.pop().teardown();
			}

			clearCache( this.root, this.keypath );
			this.root._evaluators[ this.keypath ] = null;
		},

		// This method forces the evaluator to sync with the current model
		// in the case of a smart update
		refresh: function () {
			if ( !this.selfUpdating ) {
				this.deferred = true;
			}

			var i = this.refs.length;
			while ( i-- ) {
				this.refs[i].update();
			}

			if ( this.deferred ) {
				this.update();
				this.deferred = false;
			}
		}
	};


	Reference = function ( root, keypath, evaluator, argNum, priority ) {
		this.evaluator = evaluator;
		this.keypath = keypath;
		this.root = root;
		this.argNum = argNum;
		this.type = REFERENCE;
		this.priority = priority;

		this.value = evaluator.values[ argNum ] = root.get( keypath );

		registerDependant( this );
	};

	Reference.prototype = {
		update: function () {
			var value = this.root.get( this.keypath );

			if ( !isEqual( value, this.value ) ) {
				this.evaluator.values[ this.argNum ] = value;
				this.evaluator.bubble();

				this.value = value;
			}
		},

		teardown: function () {
			unregisterDependant( this );
		}
	};


	getFunctionFromString = function ( str, i ) {
		var fn, args;

		str = str.replace( /\$\{([0-9]+)\}/g, '_$1' );

		if ( cache[ str ] ) {
			return cache[ str ];
		}

		args = [];
		while ( i-- ) {
			args[i] = '_' + i;
		}

		fn = new Function( args.join( ',' ), 'return(' + str + ')' );

		cache[ str ] = fn;
		return fn;
	};



}({}));