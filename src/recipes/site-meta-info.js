/* 
    RECIPE: Site Meta Info
    -------------------------------------------------------------
    Author: Joel Kucera
    Description: This recipe looks for site meta info including language, description,
        category and twitter card
*/

void function() {
    window.CSSUsage.StyleWalker.recipesToRun.push( function siteMetaInfo( element, results) {

        var elementName = element.nodeName.toLowerCase();
        if (elementName === 'html') {
            results['lang:' + element.lang] = 1;
        } else if (elementName === 'meta') {
            var metaName = element.name.toLowerCase();
            if (metaName === 'description' ||
                metaName === 'category' ||
                metaName === 'twitter:card' ||
                metaName === 'twitter:site') {
                results[metaName + ':' + element.content] = 1;
            }
        }

        return results;
    });
}();