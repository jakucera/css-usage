/* 
    RECIPE: APP MANIFEST
    -------------------------------------------------------------
    Author: Joel Kucera
    Description: This recipe looks for app manifest declarations.
        ex, <link rel='manifest' href='/manifest.json'>
*/

void function() {
    var _results = {};

    function checkProperty(manifest, name, value) {
        if (manifest.hasOwnProperty(name) && manifest[name].length > 0) {
            return value;
        }

        return 0x0;
    }

    function scoreManifest(manifest) {
        var score = 0x0000;

        var properties = [
            { name: "gcm_sender_id", value: 0x1 },
            { name: "theme_color", value: 0x2 },
            { name: "background_color", value: 0x4 },
            { name: "display", value: 0x8 },
            { name: "scope", value: 0x10 },
            { name: "short_name", value: 0x20 },
            { name: "icons", value: 0x40 },
            { name: "name", value: 0x80 },
            { name: "start_url", value: 0x100 }
        ];

        for (var i = 0; i < properties.length; i++) {
            score = score | checkProperty(manifest, properties[i].name, properties[i].value);
        }

        return score;
    }

    function downloadComplete()
    {
        try {
            var  manifest = JSON.parse(this.responseText);
            var manifestScore = scoreManifest(manifest);
            _results["score"] = manifestScore;
        } catch (ex) {
            _results["error"] = this.responseText;
        }
    }

    // Do a very minimal validation on the href value to see if it's worth retrieving
    function hrefAppearsValid(href) {
        return href.match(/http[s]?:\/\/.+/gi);
    }

    function appManifest(element, results) {
        if(element.nodeName == 'LINK') {
            var relValue = element.getAttribute('rel');
            if (relValue == 'manifest')
            {
                var value = element.href;
                results[value] = results[value] || { count: 0 };
                results[value].count++;

                _results = results[value];

                if (hrefAppearsValid(element.href)) {
                    var req = new XMLHttpRequest();
                    req.addEventListener("load", downloadComplete);
                    req.addEventListener("error", function () { _results["error"] = this.responseText; });
                    req.addEventListener("abort", function () { _results["error"] = this.responseText; });
                    req.open("GET", element.href);
                    req.send();
                }
            }
        }

        return results;
    }

    window.CSSUsage.StyleWalker.recipesToRun.push(appManifest);
}();