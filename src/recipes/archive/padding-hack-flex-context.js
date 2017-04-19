/* 
    RECIPE: PADDING HACK
    -------------------------------------------------------------
    Author: Greg Whitworth
    Description: The padding hack is utilized in CSS by setting
    a bottom padding with a percentage value of great than 50%
    as this forces the box to set its height to that of the width
    and artificially creating aspect ratio based on its contents.

    This is a variant of the other padding hack recipe looking for
    % padding that is utilized on a flex item.
*/

void function() {
    window.CSSUsage.StyleWalker.recipesToRun.push(function paddingHackOnFlexItem(/*HTML DOM Element*/ element, results) {

        // Bail if the element doesn't have the props we're looking for
        if(!element.CSSUsage || !(element.CSSUsage["padding-bottom"] || element.CSSUsage["padding-top"])) return;
        
        // Bail if the element isn't a flex item
        var parent = element.parentNode;
        var display = window.getComputedStyle(parent).getPropertyValue("display");
        if(display != "flex") return;

        var values = [];     

        // Build up a stack of values to interrogate
        if(element.CSSUsage["padding-top"]) {
            values = values.concat(element.CSSUsage["padding-top"].valuesArray);         
        }
        
        if(element.CSSUsage["padding-bottom"]) {
            values = values.concat(element.CSSUsage["padding-bottom"].valuesArray); 
        }

        for(var i = 0; i < values.length; i++) {
            if(values[i].indexOf('%') != -1) {
                var value = values[i].replace('%', "");
                value = parseFloat(value);

                if(value > 50) {
                    results[value] = results[value] || { count: 0 };
                    results[value].count++;
                }
            }
        }

        return results;
    });
}();