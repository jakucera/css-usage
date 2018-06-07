/* 
    RECIPE: Base Element
    -------------------------------------------------------------
    Author: Joel Kucera
    Description: This recipe looks for usage of the base element
*/

void function() {
    window.CSSUsage.StyleWalker.recipesToRun.push( function baseElement( element, results) {

        var elementName = element.nodeName.toLowerCase();
        if (elementName === 'base') {
            results['base'] = 1;
            results[element.href] = 2;
            results[element.getAttribute('href')] = 3;
        }

        return results;
    });
}();