var AudioWrapper = function () {
    this.context   = null;
    this.analyser  = null;
    this.gainNode  = null;
    this.processor = null;
    this.source    = null;
    this.dataArray = null;

    this.time         = 0;
    this.bandMinIndex = 0;
    this.bandMaxIndex = 0;

    this.scaleFunctions = {
        linear     : function ( x ) {
            return x;
        },
        logarithm  : function ( x ) {
            return Math.log2( x + 1 );
        },
        myLogarithm: function ( x ) {
            return Math.atan( x / 10000 - Math.PI ) + 0.1 * Math.log( x + 1 ) + 1.2629;
        }
    };

    this.config = {
        'sampleRate'    : 44100,
        'minFrequencyHz': 50,
        'maxFrequencyHz': 15000,

        'bufferSize': Math.pow( 2, 10 ),

        //analyser
        'fftSize'              : Math.pow( 2, 10 ),
        'maxDecibels'          : -20,
        'minDecibels'          : -50,
        'smoothingTimeConstant': 0,

        'gain' : 10, //log scale. 1: normal, 0.1, twice less, ecc..
        'scale': this.scaleFunctions.linear
    };
};

AudioWrapper.prototype.init = function () {
    this.context             = new (window.AudioContext || window.webkitAudioContext)();
    this.context.destination = null;

    this.analyser                       = this.context.createAnalyser();
    this.analyser.fftSize               = this.config.fftSize;
    this.analyser.maxDecibels           = this.config.maxDecibels;
    this.analyser.minDecibels           = this.config.minDecibels;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

    this.dataArray = new Uint8Array( this.analyser.frequencyBinCount );

    this.processor = this.context.createScriptProcessor( this.config.bufferSize, 1, 1 );

    var self                      = this;
    this.processor.onaudioprocess = function () {
        return self.processAudio( self );
    };

    this.gainNode            = this.context.createGain();
    this.gainNode.gain.value = this.config.gain;

    this.initBandwidth();

    this.prepareUI();
};

AudioWrapper.prototype.connect = function () {
    this.processor.connect( this.context.destination );
};

AudioWrapper.prototype.disconnect = function () {
    this.processor.disconnect( this.context.destination );
};

AudioWrapper.prototype.initStreamSource = function ( stream ) {
    this.source = this.context.createMediaStreamSource( stream );
    this.source
        .connect( this.gainNode )
        //.connect( lowpassFilter )
        .connect( this.analyser )
        .connect( this.processor );
};

AudioWrapper.prototype.initBandwidth = function () {
    var bandInterval = this.config.sampleRate / this.config.fftSize;
    // evaluate the minimum relevand band index.
    // Check if the maximum of the current band index is above the requested threshold. If so, stop
    while ( bandInterval * (this.bandMinIndex + 1) < this.config.minFrequencyHz ) {
        this.bandMinIndex++;
    }

    this.bandMaxIndex = this.config.fftSize / 2;
    while ( bandInterval * this.bandMaxIndex > this.config.maxFrequencyHz ) {
        this.bandMaxIndex--;
    }

    console.log( "Min Freq: " + this.bandMinIndex * bandInterval, "Max Freq: " + this.bandMaxIndex * bandInterval );

};

//callback: needs the self context
AudioWrapper.prototype.processAudio = function ( self ) {
    //get audio data from analyser
    self.analyser.getByteFrequencyData( self.dataArray );

    self.printFrequencyLine( self.time, self.dataArray );

    self.time++;
};

AudioWrapper.prototype.prepareUI = function () {
    var oscilloscope    = document.getElementById( 'oscilloscope' );
    //oscilloscope.height = this.analyser.fftSize / 2;
    oscilloscope.height = this.bandMaxIndex - this.bandMinIndex;
    oscilloscope.width  = this.config.bufferSize;
    var context         = oscilloscope.getContext( '2d' );
    context.clearRect( 0, 0, oscilloscope.width, oscilloscope.height );

    this.time = 0;
};

AudioWrapper.prototype.printFrequencyLine = function ( time, line ) {
    var oscilloscope = document.getElementById( 'oscilloscope' );
    var context      = oscilloscope.getContext( '2d' );
    var canvasData   = context.getImageData( 0, 0, oscilloscope.width, oscilloscope.height );

    var myScale = this.config.scale;

    for ( var i = this.bandMinIndex; i <= this.bandMaxIndex; i++ ) {
        var x     = time % oscilloscope.width;
        var y     = oscilloscope.height - Math.round(
                myScale( i ) / myScale( oscilloscope.height ) * oscilloscope.height );
        var index = (x + y * oscilloscope.width) * 4;

        var color = line[ i ] / 2.55;

        canvasData.data[ index ]     = color;
        canvasData.data[ index + 1 ] = color;
        canvasData.data[ index + 2 ] = color;
        canvasData.data[ index + 3 ] = line[ i ];

        //draw a red line after the current frequency
        index = (x + y * oscilloscope.width + 1) * 4;

        canvasData.data[ index ]     = 255;
        canvasData.data[ index + 1 ] = 0;
        canvasData.data[ index + 2 ] = 0;
        canvasData.data[ index + 3 ] = 255;
    }
    context.putImageData( canvasData, 0, 0 );
};
