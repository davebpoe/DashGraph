/**
 * @license
 * Copyright 2012 David Poe (davebpoe@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

var DashGraph = DashGraph || {};

/**
 * Stores data that will be plotted and all of it's options.
 * 
 * @param {Array} x A list of increasing x-coordinates for the data. *     
 * @param {Array} y A list of y-coordinates for the data. Must match the length
 *     of x.  Multiple y-values for the given x-coordinate may be specified in
 *     two ways: 1. Each individual y-value is another Array of values, or 2. As 
 *     separate arrays.  For example, for 2 flat lines of 100 points, it could 
 *     be specified as [[1,2], [1,2], [1,2], ...] or as 
 *     [[1,1,1, ...], [2,2,2,...]].  
 * @param {Object} options Optional inputs as listed below:
 *     plotType: String to specify plotting as 'normal', or 'fast'.  Browsers
 *         implement pixel interpolation differently, and the normal algorithm
 *         uses this.  It is a bit slower, and the look can be inconsistent 
 *         between browsers.  Fast rounds every plot line to single pixels.
 *         This keeps a more consistent and faster plot, while sacrificing some
 *         plot quality.
 */
DashGraph.Data = function(x, y, options) {
    // Set input values.
    this.x = x;
    this.y = y;
    
    // If options is not defined, set it to an empty class.
    if (options === undefined) {
        options = {};
    }
    this.plotType = options.plotType ? options.plotType : 'normal';
    
    // Set the filter
    // If there is a filter, then the data has it's own color to specify.
    this.filter = options.filter;
    if (this.filter) {
        this.hasFilter = true;
        this.hasColor = true;
    } else {
        this.hasFilter=  false;
        this.hasColor = false;
    }
    
    // Set internal values.  These specify the range over which the data is 
    // valid.
    this.startInd = 0;
    this.stopInd = this.x.length-1;
}

/**
 * Resets the start and stop inds to be the entire data 
 */
DashGraph.Data.prototype.resetBounds = function() {
    this.startInd = 0;
    this.stopInd = this.x.length-1;
    
    // Set the filter index as well if it exists
    if (this.filter) {
        this.filter.curFiltInd = 0;
        if (this.filter.curFiltInd === (this.filter.index.length-1)) {
            // -1 will never register that it has a next color
            this.filter.nextInd = -1;
        } else {
            // nextInd holds the nextInd where the color changes.
            this.filter.nextInd = this.filter.index[this.filter.curFiltInd + 1];
        }
    }
}

/**
 * Sets the start and stop inds to the first data point before the starTime,
 * and the first data point after the stopTime.
 * @param {Number} startTime The time to set the initial index of the bounds.
 * @param {Number} stopTime The time to set the final index of the bounds.
 */
DashGraph.Data.prototype.setBounds = function(startTime, stopTime) {
    this.startInd = DashGraph.binarySearch(this.x, startTime);
    this.stopInd = DashGraph.binarySearch(this.x, stopTime, true);
    
    // Set the filter index if it exists
    if (this.filter) {
        // If this is beyond our last index, then that is the curFiltInd
        if (this.startInd > this.filter.index[this.filter.index.length-1]) {
            this.filter.curFiltInd = this.filter.index.length-1;
            this.filter.nextInd = -1;
        } else {
            this.filter.curFiltInd = DashGraph.binarySearch(this.filter.index, this.startInd);
            this.filter.nextInd = this.filter.index[this.filter.curFiltInd + 1];
        }
    }
}

/**
 * Searches through the y-data to find the min and max.
 * @return {Array} Returns the min and max values in the data, as [yMin, yMax]
 */
DashGraph.Data.prototype.getYBounds = function() {
    // Determine the maximum and minimum y data.
    // If the y-values are arrays, need to seek through each value
    var startInd = this.startInd;
    var stopInd = this.stopInd;
    var yMin, yMax, i;
    if (DashGraph.isArray(this.y[startInd])) {
        yMin = this.y[startInd][0];
        yMax = this.y[startInd][0];
        var numElems = this.y[startInd].length;
        // Iterate over all the values
        for (i = startInd; i <= stopInd; i++) {
            // Iterate over each value for that particular spot
            for (var j = 0; j < numElems; j++) {
                val = this.y[i][j];
                if (val < yMin) {
                  yMin = val;
                } else if (val > yMax) {
                  yMax = val;
                }
            }            
        }        
    } else {
        yMin = this.y[startInd];
        yMax = this.y[startInd];
        for (i = startInd+1; i <= stopInd; i++) {
            val = this.y[i];
            if (val < yMin) {
              yMin = val;
            } else if (val > yMax) {
              yMax = val;
            }
        }
    }    
    return [yMin, yMax];
}


/**
 * Takes the index into the data and checks the filter to see if the color
 * should change.
 * @param {uint} ind The currently plotted index.
 * @return {bool} Returns true if the filter color changed, false otherwise.
 */
DashGraph.Data.prototype.updateFilter = function(ind) {
    // Only will change if the index is equal to the 'nextInd'
    if (ind === this.filter.nextInd) {
        // Set the next ind
        this.filter.curFiltInd += 1;
        if (this.filter.curFiltInd < (this.filter.index.length)) {
            this.filter.nextInd = this.filter.index[this.filter.curFiltInd+1];
        } else {
            this.filter.nextInd = -1;
        }
        return true;
    } else {
        return false;
    }
}

/**
 * Retrieves the current color of the plot.
 * @return {String} Returns the color as a string, if it exists (null otherwise)
 */
DashGraph.Data.prototype.getColor = function() {
    // Only will change if the index is equal to the 'nextInd'
    if (this.filter) {
        return this.filter.colors[this.filter.curFiltInd];
    } else {
        return null;
    }
}

/**
 * A basic plot, which sets up the canvas and adds data to it. 
 */
DashGraph.Plot = function(node, opts) {
    this.node = node;
    
    // Storage for other data, like the divs used for labels
    this.labelDivs = [];
    this.labelDivPointer = 0;
    
    // Set the options to an empty class if undefined
    if (opts === undefined) {
        opts = {};
    }
  
    // Setup options and calculated values (for now, hard-code all of these)
    this.width = opts.width ? opts.width : 400; // width of the entire plot
    this.height = opts.height ? opts.height: 300; // height of the entire plot
    this.xLabelSize = opts.xLabelSize ? opts.xLabelSize : 50; // Size in pixels that the xlabel will use
    this.yLabelSize = opts.yLabelSize ? opts.yLabelSize : 50; // Size in pixels that the ylabel will use
    this.heightBuffer = opts.heightBuffer ? opts.heightBuffer : 20; // Pixels to buffer at the top of any default plot
    this.minTickPixels = opts.minTickPixels ? opts.minTickPixels : 40; // Minimum pixels between ticks 
    
    // Setup the colors
    this.plotColors = ["#0000AA", "#00AA00", "#AA0000", "#AAAA00", "#AA00AA", "#00AAAA"];
    this.colorInd = 0;
    
    // Setup the data
    this.data = [];
    
    // Setup the zooming
    this.zoom = {};
    this.zoom.xMin = null; // The x-axis min value. (null means plot-determined)
    this.zoom.xMax = null; // The x-axis max value. (null means plot-determined)
    this.zoom.yMin = null; // The y-axis min value. (null means plot-determined)
    this.zoom.yMax = null; // The y-axis max value. (null means plot-determined)
    
    // Set the other options
    this.opts = opts;
 
    // Setup the canvas sizing.
    // Determine the x-size of the plot, and the x-size of the label
    // Determine the y-size of the plot, and the y-size of the label
    this.initialize(); 
}

/**
 * Run initialization code, to setup variables that are used by the
 * plotting schemes
 */
DashGraph.Plot.prototype.initialize = function() {
    // Setup the plot div
    this.node.style.width = this.width + "px";
    this.node.style.height = this.height + "px";
    
    // Setup the inner div, with position: relative, so all inner variables
    // can set their position to absolute within the div
    this.innerNode = document.createElement("div");
    this.innerNode.style.width = this.width + "px";
    this.innerNode.style.height = this.height + "px";
    this.innerNode.style.position = "relative";
    
    // Add the innerNode to the node
    this.node.appendChild(this.innerNode);
    
    // Setup the plot area
    this.plotWidth = this.width - this.xLabelSize;
    this.plotXStart = this.xLabelSize;
    this.plotHeight = this.height - this.yLabelSize;
    this.plotYStart = 0;
    
    // Setup zooming variables
    this.zooming = false; // If a type of zooming is going on
    this.xZooming = false; // If the zoom is a xZoom
    this.yZooming = false; // If the zoom is a yZoom
    this.rectZooming = false;
    
    // Create the non-interactive portion of the plot, which will include
    // axes, grid lines, and the plot of the data itself.
    this.canvas = this.createCanvas();
    this.canvas.style.position = "absolute";
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx = this.canvas.getContext("2d");
    // Create the interactive portion of the plot, which will act as an
    // overlay to allow interactive zoom, and highlighting of points.
    this.overlay = this.createCanvas();
    this.overlay.style.position = "absolute";
    this.overlay.width = this.width;
    this.overlay.height = this.height;
    this.overlay.style.width = this.width + "px";
    this.overlay.style.height = this.height + "px";
    this.ctxOverlay = this.overlay.getContext("2d");
    
    // Add event handler for the overlay
    // Set that to this, so we can access it
    var that = this;
    this.overlay.onmousedown = function (e) {
        that.onmousedown(e);
    }
    this.overlay.onmouseup = function (e) {
        that.onmouseup(e);
    }
    this.overlay.onmousemove = function (e) {
        that.onmousemove(e);
    }
    this.overlay.onmouseout = function (e) {
        that.onmouseout(e);
    }
    this.overlay.ondblclick = function(e) {
        that.ondblclick(e);
    }
    
    // Add the canvases to the div
    this.innerNode.appendChild(this.canvas);
    this.innerNode.appendChild(this.overlay);
}

/**
 * Create a new canvas element.
 */
DashGraph.Plot.prototype.createCanvas = function() {
    var canvas = document.createElement("canvas");
    return canvas;
}

/**
 * Adds a dataset 
 */
DashGraph.Plot.prototype.addData = function(data) {
    this.data.push(data);
}

/**
 * Updates the plot with the latest data 
 */
DashGraph.Plot.prototype.update = function() {
    this.render();
}

/**
 * Renders the data, with option arguments to specify the start and stop points
 */
DashGraph.Plot.prototype.render = function() {
    // Preprocess the data
    this.preprocess();
    
    // Prerender (clear, etc.)
    this.prerender();
  
    // Draw the axes
    this.renderAxes();
  
    // Add the labels
    this.renderLabels();
  
    // Plot the data 
    this.renderData();  
}

/**
 * Preprocesses the data to determine data for later plotting
 */
DashGraph.Plot.prototype.preprocess = function() {
    var val, i, data, startInd, stopInd; // Used as a temporary variable
    var yPixMin, yPixMax, yLimits; // Used to store the min and max y value for the plot
    // Determine the maximum and minimum x data.
    // For now, assume it is in order (so the first and last)
    
    // TODO: If xMin is not specified, these should be stored the
    // first time, and then restored on future times.  Since there will 
    // commonly be zooming out functions to the original axes, and this
    // will save some time.
    
    // TODO: If we only find one point, the binarySearch I believe returns
    // the same value, and this results in a skewed graph.
    
    // Come up with a better name.  These are the min and max x-values found in
    // the data for the purposes of calculating the x-pixel coords. (same for y)
    var xMin, xMax, yMin, yMax;
    
    if (this.zoom.xMin === null) {
        data = this.data[0];
        // Reset the start and stop inds
        data.resetBounds();
        startInd = data.startInd;
        stopInd = data.stopInd;
        // Set the xMin and xMax to the first and last data points
        xMin = data.x[data.startInd];
        xMax = data.x[data.stopInd];
        // Iterate over remaining data
        for (i = 1; i < this.data.length; i++) {
            data = this.data[i];
            data.resetBounds();
            if (xMin > data.x[data.startInd]) {
                xMin = data.x[this.startInd];
            }
            if (xMax < data.x[data.stopInd]) {
                xMax = data.x[this.stopInd];
            }
        }
    } else {
        // Set the xMin and xMax to the start time
        xMin = this.zoom.xMin;
        xMax = this.zoom.xMax;
        // Iterate over each data set and set its bounds to the start/stop time.
        for (i = 0; i < this.data.length; i++) {
            this.data[i].setBounds(xMin, xMax);
        }
    }
    
    // TODO: If xMax and xMin become too close together, the plot gets quite
    //       screwed up.  This should be fixed.
    // Set the xScale to scale the values by to convert to pixel position
    this.xScale = this.plotWidth/(xMax - xMin);
    // Set the xBias for the pixels added to each value.
    this.xBias = this.plotXStart - this.xScale*xMin; 
    
    // Determine the tick spacing for the x data.
    this.xTicks = this.getTicks(xMin, xMax, this.plotWidth);
    
    // Determine the maximum and minimum y data.
    // If there is a specified yMin and yMax, use those.
    if (this.zoom.yMin !== null) {
        // Set the yScale to scale the values by to convert to pixel position
        // The yScale will be negative, since larger values will be higher (which is
        // fewer pixels from the top).  This is done by inverting yMin and yMax
        this.yScale = (this.plotHeight)/(this.zoom.yMin - this.zoom.yMax);
        // Set the yBias for the pixels added to each value.
        this.yBias = this.plotHeight/2 - this.yScale * (this.zoom.yMax+this.zoom.yMin)*.5; 
        // Determine the tick spacing for the y data.
        yPixMin = this.getYPixelPos(this.getYCanvasPos(this.zoom.yMin));
        yPixMax = this.getYPixelPos(this.getYCanvasPos(this.zoom.yMax));
    } else {
        for (i = 0; i < this.data.length; i++) {
            data = this.data[i];
            yLimits = data.getYBounds();
            if (yMin === undefined) {
                yMin = yLimits[0];
                yMax = yLimits[1];
            } else {
                if (yMin > yLimits[0]) {
                    yMin = yLimits[0];
                }
                if (yMax < yLimits[1]) {
                    yMax = yLimits[1];
                }
            }        
        }    
    
        // Set the yScale to scale the values by to convert to pixel position
        // The yScale will be negative, since larger values will be higher (which is
        // fewer pixels from the top).  This is done by inverting yMin and yMax
        this.yScale = (this.plotHeight - (2 * this.heightBuffer))/(yMin - yMax);
        // Set the yBias for the pixels added to each value.
        this.yBias = this.plotHeight/2 - this.yScale * (yMax+yMin)*.5; 
        // Determine the tick spacing for the y data.
        // Fix this to use yMin and yMax from the actual plot area 
        yPixMin = this.getYPixelPos(this.getYCanvasPos(yMin) + this.heightBuffer);
        yPixMax = this.getYPixelPos(this.getYCanvasPos(yMax) - this.heightBuffer);
    }
    
    this.yTicks = this.getTicks(yPixMin, yPixMax, this.plotHeight);
}

/**
 * Clear the plot
 */
DashGraph.Plot.prototype.prerender = function() {
    // Clear
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Clear overlay
    this.clearOverlay();
    
    // Clear the labels
    this.clearLabels();
    
    // Reset the color counter
    this.colorInd = 0;
}

/**
 * Draws the two axes
 */
DashGraph.Plot.prototype.renderAxes = function() {    
    var i, val;
    
    // Draw the x-grid
    this.ctx.strokeStyle = "#DDDDDD"; // TODO: Make this configurable
    this.ctx.beginPath();    
    for (i = 0; i < this.xTicks.length; i++) {
        val = this.getXCanvasPos(this.xTicks[i]) + .5;
        this.ctx.moveTo(val, this.plotYStart-.5);
        this.ctx.lineTo(val, this.plotHeight-.5);
    }
    this.ctx.stroke();
    
    // Draw the y-grid
    this.ctx.strokeStyle = "#DDDDDD"; // TODO: Make this configurable
    this.ctx.beginPath();    
    for (i = 0; i < this.yTicks.length; i++) {
        val = (this.getYCanvasPos(this.yTicks[i]) | 0) - .5;
        this.ctx.moveTo(this.plotXStart+.5, val);
        this.ctx.lineTo(this.width+.5, val);
    }
    this.ctx.stroke();
    
    // Draw the x/y-axes
    this.ctx.strokeStyle = "#999999"; // TODO: Make this configurable
    this.ctx.lineWidth = 1;
    
    /* Draw a line at the axis-borders */
    this.ctx.beginPath();
    this.ctx.moveTo(this.plotXStart+.5, this.plotYStart-.5); // +/- .5 to fill the pixel
    this.ctx.lineTo(this.plotXStart+.5, this.plotHeight-.5);
    this.ctx.lineTo(this.width, this.plotHeight-.5); // Draw to the edge
    this.ctx.stroke(); 
}

/**
 * Renders the labels
 */
DashGraph.Plot.prototype.renderLabels = function() {
    var val;
    // Place the x-markers
    // For each tick, make a new div and set it to the appropriate location
    for (i = 0; i < this.xTicks.length; i++) {
        val = this.addLabelDiv(this.xLabelSize);
        val.style.textAlign = "center";    
        // Set the top and left of the div
        val.style.left = ((this.getXCanvasPos(this.xTicks[i]) | 0) - this.xLabelSize/2) + "px"; // TODO: Remove this | 0 hack later
        val.style.top = this.plotHeight + "px"; // Set the top to the edge of the plot
        val.innerHTML = DashGraph.roundToString(this.xTicks[i], 3);
        this.innerNode.appendChild(val);
    }
    
    // TODO: Place the x-label
    
    // Place the y-markers
    for (i = 0; i < this.yTicks.length; i++) {
        val = this.addLabelDiv(this.yLabelSize);
        val.style.textAlign = "right";
        // Set the top and left of the div
        //TODO: Give this a bit of a buffer
        val.style.left = "0px";
        // TODO: Remove the hack to center the text along the line
        val.style.top = ((this.getYCanvasPos(this.yTicks[i]) | 0) - 10) + "px";
        val.innerHTML = DashGraph.roundToString(this.yTicks[i], 3);
        this.innerNode.appendChild(val);
    }
    
    // TODO: Place the y-label
}

/**
 * Creates a new div, or returns an existing one from a list (for efficiency)
 */
DashGraph.Plot.prototype.addLabelDiv = function(labelSize) {
    // Check to see if a div already exists
    var val;
    if (this.labelDivs.length > 0 && this.labelDivPointer < this.labelDivs.length) {
        val = this.labelDivs[this.labelDivPointer];
        val.style.visibility = 'visible';        
    }
    else {
        val = document.createElement("div");
        // Set parameters for each div
        val.style.position = "absolute";
        val.style.fontSize = "14px"; // TODO: Make this settable
        val.style.width = labelSize + "px"; // TODO: Make this an option
        val.style.lineHeight = "normal";
        val.style.overflow = "hidden";        
        this.labelDivs.push(val);
    }
    this.labelDivPointer += 1;
    return val;
}

/**
 * Clears the labels that are currently made (hides them)
 */
DashGraph.Plot.prototype.clearLabels = function() {
    for (var i = 0; i < this.labelDivs.length; i++) {
        this.labelDivs[i].style.visibility = "hidden";
    }
    this.labelDivPointer = 0;
}

/**
 * Plots the data
 */
DashGraph.Plot.prototype.renderData = function() {
    // Iterate over each dataset    
    var i, j, k, getX, getY, lenData, data, isArrData;
    var xPixVal, yPixVal, xPixValLast, yPixValLast;
    var yVal, xVal;
    var that = this;
    var yTooHigh, yTooLow;
    var updateColor = false; // Used to indicate the color is ready for update.
    for (k = 0; k < this.data.length; k++) {
        // Depending on the plot-type, the "getX" and "getY" calls will be different
        data = this.data[k];
        // Need to compensate for arrays that have multiple data points.
        isArrData = DashGraph.isArray(data.y[data.startInd]);
        if (isArrData) {
            lenData = data.y[data.startInd].length;
        } else {
            lenData = 1;
        }
        if (data.plotType === 'quick') {
            // If we are doing the quick plot, then do a "floor" operation on the result
            getX = function(val) {
                return that.getXCanvasPos(val) | 0;
            }
            if (isArrData) {
                getY = function(val, j) {
                    return that.getYCanvasPos(val[j]) | 0;
                }
            } else {
                getY = function(val) {
                    return that.getYCanvasPos(val) | 0;
                }
            }
        } else {
            getX = function(val) {
                return that.getXCanvasPos(val);
            }
            if (isArrData) {
                getY = function(val, j) {
                    return that.getYCanvasPos(val[j]);
                }
            } else {
                getY = function(val) {
                    return that.getYCanvasPos(val);
                }
            }
        }
        
        // Check to make sure the plot is within the bounds
        if (data.x[0] > this.zoom.xMax || data.x[data.x.length-1] < this.zoom.xMin) {
            continue;
        }
    
        // Iterate over every point in the plot, and draw a line to it
        // Need to deal with the potential for multiple data points.
        j = 0;
        while(lenData !== 0) {
            lenData -= 1;   
            this.ctx.beginPath();
            // TODO: Check the data to see if the style is defined
            if (data.hasColor) {
                this.ctx.strokeStyle = data.getColor();
            } else {
                this.ctx.strokeStyle = this.getColor();
            }
            
            // Set the last pixel to the start point.
            xPixValLast = getX(data.x[data.startInd]);
            yPixValLast = getY(data.y[data.startInd], j);
            
            // Setup variables in case the data is beyond the plot
            yTooHigh = false;
            yTooLow = false;
            
            // If the x-pixel is beyond the edge, it needs to be interpolated to
            // within the boundaries.
            if (xPixValLast < this.plotXStart) {
                var tempX = getX(data.x[data.startInd+1]);
                var tempY = getY(data.y[data.startInd+1], j);
                yPixValLast = DashGraph.interpolate(xPixValLast, yPixValLast, tempX, tempY, this.plotXStart);
                xPixValLast = this.plotXStart;
            }
            // Move to the first point
            this.ctx.moveTo(xPixValLast, yPixValLast);            
            for (i = data.startInd+1; i <= data.stopInd; i++) {
                xPixVal = getX(data.x[i]);
                yPixVal = getY(data.y[i], j);
                
                // Check to see if the filter changed.
                if(data.hasFilter) {
                    if (data.updateFilter(i)) {
                        // This will cause a draw-update for the last point,
                        // whenever 
                        updateColor = true;                        
                    }
                }
                
                if (Math.abs(xPixVal-xPixValLast) < .1 && Math.abs(yPixVal-yPixValLast) < .1) {
                    continue;
                }
                
                // Check if it is too far.  If so, we are done.
                if (xPixVal > this.width) {
                    // Interpolate to the edge, for low-data numbers
                    yPixVal = DashGraph.interpolate(xPixValLast, yPixValLast, xPixVal, yPixVal, this.width);
                    xPixVal = this.width;
                    this.ctx.lineTo(xPixVal, yPixVal);
                    break;
                }  
                
                // Need to check for the value going off screen.
                if (yPixVal < this.plotYStart) {
                    if (!yTooHigh) {
                        yTooHigh = true;
                        // TODO: Draw the line to the point where it crosses
                        xPixValLast = DashGraph.interpolate(yPixValLast, xPixValLast, yPixVal, xPixVal, this.plotYStart);
                        yPixValLast = this.plotYStart;
                        this.ctx.lineTo(xPixValLast, yPixValLast);
                    }
                    
                    xPixValLast = xPixVal;
                    yPixValLast = yPixVal;
                    continue;
                }
                if (yPixVal > this.plotHeight) {
                    if (!yTooLow) {
                        yTooLow = true;
                        // TODO: Draw the line to the point where it crosses
                        xPixValLast = DashGraph.interpolate(yPixValLast, xPixValLast, yPixVal, xPixVal, this.plotHeight);
                        yPixValLast = this.plotHeight;
                        this.ctx.lineTo(xPixValLast, yPixValLast);
                    }
                    xPixValLast = xPixVal;
                    yPixValLast = yPixVal;
                    yTooLow = true;
                    continue;
                }
                
                // Check if the prior was too high or too low
                if (yTooHigh) {
                    // This means it was too high.  Need to interpolate,
                    // and move.
                    xPixValLast = DashGraph.interpolate(yPixValLast, xPixValLast, yPixVal, xPixVal, this.plotYStart);
                    yPixValLast = this.plotYStart;
                    this.ctx.moveTo(xPixValLast, yPixValLast);
                    yTooHigh = false;
                } else if (yTooLow) {
                    // This means it was too high.  Need to interpolate,
                    // and move.
                    xPixValLast = DashGraph.interpolate(yPixValLast, xPixValLast, yPixVal, xPixVal, this.plotHeight);
                    yPixValLast = this.plotHeight;
                    this.ctx.moveTo(xPixValLast, yPixValLast);
                    yTooLow = false;
                }
                
                this.ctx.lineTo(xPixVal, yPixVal);
                if (updateColor) {
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = data.getColor();
                    this.ctx.moveTo(xPixVal, yPixVal);
                    updateColor = false;
                }
                
                xPixValLast = xPixVal;
                yPixValLast = yPixVal;
            }
            this.ctx.stroke();
            j += 1;
        }
    }
}

/**
 * Clears the zooms, so it will zoom to the extents 
 */
DashGraph.Plot.prototype.clearZoom = function() {
    this.zoom.xMin= null;
    this.zoom.xMax = null;
    this.zoom.yMin = null;
    this.zoom.yMax = null;
}
/**
 * Record the position the mouse was pressed at
 */
DashGraph.Plot.prototype.onmousedown = function(e) {
    // TODO: Support multiple zoom types (box, horizontal, etc.)
    // For now, only support x-zooming
    this.xZoomStart = this.eventToCanvasX(e);
    this.yZoomStart = this.eventToCanvasY(e);
    this.zooming = true;
    // Prevents the mouse drag from selecting page text
    if (e.preventDefault) {
        e.preventDefault();  // Firefox, Chrome, etc.
    } else {
        e.returnValue = false;  // IE
        e.cancelBubble = true;
    }
}

/**
 * Record the position the mouse was pressed at
 */
DashGraph.Plot.prototype.onmouseup = function(e) {
    // Don't do anything if we aren't zooming
    if (this.zooming) {
        this.zooming = false;
        // Do an x-zoom if its an x zoom
        if (this.xZooming) {
            this.xZooming = false;
            var xPos = this.eventToCanvasX(e);
            // Call render with the new values
            if (xPos > this.xZoomStart) {
                this.zoom.xMin = this.getXPixelPos(this.xZoomStart);
                this.zoom.xMax = this.getXPixelPos(xPos);
            } else if (xPos < this.xZoomStart) {
                this.zoom.xMin = this.getXPixelPos(xPos);
                this.zoom.xMax = this.getXPixelPos(this.xZoomStart);
            }
            this.render();
        } else if (this.yZooming) {
            this.yZooming = false;
            var yPos = this.eventToCanvasY(e);
            // Call render with the new values
            if (yPos > this.yZoomStart) {
                this.zoom.yMax = this.getYPixelPos(this.yZoomStart);
                this.zoom.yMin = this.getYPixelPos(yPos);
            } else if (yPos < this.yZoomStart) {
                this.zoom.yMax = this.getYPixelPos(yPos);
                this.zoom.yMin = this.getYPixelPos(this.yZoomStart);
            }
            this.render();
        }        
    }    
}

/**
 * Record the position the mouse was pressed at
 */
DashGraph.Plot.prototype.onmousemove = function(e) {    
    // Ensure we are zooming
    if (this.zooming) {
        var xPos = this.eventToCanvasX(e);
        var yPos = this.eventToCanvasY(e);
        // Check the distances the mouse has moved
        var xDist = Math.abs(xPos - this.xZoomStart);
        var yDist = Math.abs(yPos - this.yZoomStart);
        if (xDist > yDist && xDist > 1) {
            this.xZooming = true;
            this.yZooming = false;
            // If the box is extending into the x-tick area, stop it
            if (xPos < this.plotXStart) {
                xPos = this.plotXStart;
            }
            // Draw the bounding box in the overlay
            this.drawXZoom(xPos);
        } else if (yDist > xDist && yDist > 1) {
            this.xZooming = false;
            this.yZooming = true;
            // If the box is extending into the x-tick area, stop it
            if (yPos > this.plotHeight) {
                yPos = this.plotHeight;
            }
            // Draw the bounding box in the overlay
            this.drawYZoom(yPos);
        }
    }
}

/**
 * Record the position the mouse was pressed at
 */
DashGraph.Plot.prototype.ondblclick = function(e) {
    // Zoom out
    // TODO: Add checks for if we are already zoomed out
    this.clearZoom();
    this.render();
}

/**
 * Deal with the mouse exiting the object
 */
DashGraph.Plot.prototype.onmouseout = function(e) {
    this.clearOverlay();
    this.zooming = false;
    this.xZooming = false;
    this.yZooming = false;
    this.rectZooming = false;
}

/**
 * Helper function to return the mouse coordinates relative to the canvas
 * Taken from http://www.quirksmode.org/js/events_properties.html
 */
DashGraph.Plot.prototype.eventToCanvasX = function(e) {
    // OffsetX is exactly what we want, and supported on some browsers
    if (e.offsetX) {
        return e.offsetX;
    }
    // For others, we have to calculate it
    // Grab the pageX (supported on some browsers, not others)
    var posx = 0;
    if (!e) var e = window.event;
    if (e.pageX )     {
        posx = e.pageX;
    }
    else if (e.clientX )    {
        posx = e.clientX + document.body.scrollLeft
            + document.documentElement.scrollLeft;
    }
    
    // Subtract from the x-position of the canvas in the document
    return posx - DashGraph.findPosX(this.canvas);    
}

/**
 * Helper function to return the mouse coordinates relative to the canvas
 * Taken from http://www.quirksmode.org/js/events_properties.html
 */
DashGraph.Plot.prototype.eventToCanvasY = function(e) {
    // OffsetY is exactly what we want, and supported on some browsers
    if (e.offsetY) {
        return e.offsetY;
    }
    // For others, we have to calculate it
    // Grab the pageX (supported on some browsers, not others)
    var posy = 0;
    if (!e) var e = window.event;
    if (e.pageY)     {
        posy = e.pageY;
    }
    else if (e.clientY)    {
        posy = e.clientY + document.body.scrollTop
            + document.documentElement.scrollTop;
    }
    
    // Subtract from the x-position of the canvas in the document
    return posy - DashGraph.findPosY(this.canvas);    
}

/**
 * Draws a box over the plot area to represent the zooming
 */
DashGraph.Plot.prototype.drawXZoom = function(xPos) {
    // First clear any prior zooming
    this.clearOverlay();
    
    // Draw the rectangle
    this.ctxOverlay.fillStyle = "rgba(128,128,128,0.33)";
    this.ctxOverlay.fillRect(this.xZoomStart,this.plotYStart, xPos - this.xZoomStart, this.plotHeight);
}

/**
 * Draws a box over the plot area to represent the zooming
 */
DashGraph.Plot.prototype.drawYZoom = function(yPos) {
    // First clear any prior zooming
    this.clearOverlay();
    
    // Draw the rectangle
    this.ctxOverlay.fillStyle = "rgba(128,128,128,0.33)";
    this.ctxOverlay.fillRect(this.plotXStart, this.yZoomStart, this.plotXStart + this.plotWidth, yPos - this.yZoomStart);
}



/**
 * Clears the overlay in the most efficient way possible
 */
DashGraph.Plot.prototype.clearOverlay = function() {
    // TODO: Store the bounding box of objects drawn on the overlay,
    // so this will be more efficient
    this.ctxOverlay.clearRect(0, 0, this.width, this.height);
}
/**
 * Helper function to determine the canvas position of the x-point
 */
DashGraph.Plot.prototype.getXCanvasPos = function(x) {    
    return (x * this.xScale + this.xBias);
}

/**
 * Helper function to determine the x-value of the x-pixel
 */
DashGraph.Plot.prototype.getXPixelPos = function(x) {
    // TODO: Round this, but for now it looks better without it
    // | 0 is a faster way to do "Math.floor", so using that instead
    return (x-this.xBias)/this.xScale; // TODO: If this works, set a 1/xScale value
}

/**
 * Helper function to determine the canvas position of the y-point
 */
DashGraph.Plot.prototype.getYCanvasPos = function(y) {
    return (y * this.yScale + this.yBias);
}

/**
 * Helper function to determine the canvas position of the y-point
 */
DashGraph.Plot.prototype.getYPixelPos = function(y) {
    // TODO: Round this, but for now it looks better without it
    return (y-this.yBias)/this.yScale; // TODO: If this works, set a 1/yScale value
}

/**
 * Calculate the ticks given a min and max value
 */
DashGraph.Plot.prototype.getTicks = function(minVal, maxVal, pixels) {
    var mults = [.5,1,2,5]; // The possible multiples for the scale
    var ticks = [];
    var scale, low, high, spacing, i, val;
    
    // Calculate the approximate power of the input by the LOG10 of it
    var basePower = Math.floor(Math.log(maxVal-minVal)/Math.LN10);
    // Get the base scale of the function.
    
    // TODO: Make this more efficient.  Can probably remove a lot of these calculations
    // until after the appropriate multiple is discovered.
    var baseScale = Math.pow(10, basePower);
    for (i = 0; i < mults.length; i++) {
        scale = baseScale * mults[i];
        low = Math.floor(minVal / scale) * scale;
        high = Math.ceil(maxVal / scale) * scale;
        nTicks = Math.abs(high - low) / scale;
        spacing = pixels / nTicks;
        if (spacing > this.minTickPixels) break;
    }

    // Make ticks    
    for (i = 0; i < nTicks; i++) {
        // Only add ticks within our region
        val = low + i * scale;
        if (val >= minVal && val <= maxVal) {
            ticks.push(val);
        }        
    }
    return ticks;
}

/**
 * Grabs a unique color from the plots colors.
 */
DashGraph.Plot.prototype.getColor = function () {
    if (this.colorInd === this.plotColors.length) {
        this.colorInd = 0;
    }
    return this.plotColors[this.colorInd++];
}

/**
 * Binary search for a value.
 */
DashGraph.binarySearch = function(a, x, upper) {
    var lo = 0, hi = a.length - 1;
    while(hi - lo > 1) {
        var mid = Math.round((lo + hi) / 2);
        if(a[mid] <= x) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    if (upper) {
        return hi;
    } else {
        return lo;
    }
}

/**
 * Rounds to the specified number of digits, at max.
 */
DashGraph.roundToString = function(val, precision) {   
    return val.toFixed(precision).replace(/\.*0*$/, '');
}


/**
 * Returns the x-coordinate of the supplied object.
 * Taken from dygraph
 */
DashGraph.findPosX = function(obj) {
  var curleft = 0;
  if(obj.offsetParent) {
    var copyObj = obj;
    while(1) {
      curleft += copyObj.offsetLeft;
      if(!copyObj.offsetParent) {
        break;
      }
      copyObj = copyObj.offsetParent;
    }
  } else if(obj.x) {
    curleft += obj.x;
  }
  // This handles the case where the object is inside a scrolled div.
  while(obj && obj != document.body) {
    curleft -= obj.scrollLeft;
    obj = obj.parentNode;
  }
  return curleft;
};

/**
 * Returns the y-coordinate of the supplied object.
 * Taken from dygraph
 */
DashGraph.findPosY = function(obj) {
  var curtop = 0;
  if(obj.offsetParent) {
    var copyObj = obj;
    while(1) {
      curtop += copyObj.offsetTop;
      if(!copyObj.offsetParent) {
        break;
      }
      copyObj = copyObj.offsetParent;
    }
  } else if(obj.y) {
    curtop += obj.y;
  }
  // This handles the case where the object is inside a scrolled div.
  while(obj && obj != document.body) {
    curtop -= obj.scrollTop;
    obj = obj.parentNode;
  }
  return curtop;
};

/**
 * Does linear interpolation between two points. 
 */
DashGraph.interpolate = function(x0, y0, x1, y1, x) {
    return y0 + (x - x0) * (y1 - y0)/(x1-x0);
}

/**
 * Returns if the object is an array 
 */
DashGraph.isArray = function(val) {
    return Object.prototype.toString.call(val) === '[object Array]';
}
