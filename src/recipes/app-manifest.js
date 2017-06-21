/* 
    RECIPE: APP MANIFEST
    -------------------------------------------------------------
    Author: Joel Kucera
    Description: This recipe looks for app manifest declarations.
        ex, <link rel='manifest' href='/manifest.json'>
*/

void function() {
    var _results = {};

    function testProperty(manifest, name, value) {
        if (manifest.hasOwnProperty(name) && manifest[name].length > 0) {
            return value;
        }

        return 0x0;
    }

    function testCommonName(manifest, propertyName, value) {
        var name = "";
        if ("name" in manifest) {
            name = manifest["name"].toLowerCase();
        }

        var shortName = "";
        if ("short_name" in manifest) {
            shortName = manifest["short_name"].toLowerCase();
        }

        if (name === "" && shortName === "") {
            return 0x0;
        }

        // top generic/common names in name and short_name fields in previously crawled manifests
        var commonNames = [
            'app',
            'my app',
            'simplesite',
            'canvas',
            'favicon',
            'asp.net mvc boilerplate (required! update this)',
            'push demo',
            'new project'
        ];

        for (var i = 0; i < commonNames.length; i++) {
            if (name == commonNames[i] || shortName == commonNames[i]) {
                return value;
            }
        }

        return 0x0;
    }

    function testServiceWorker(manifest, name, value) {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then(function (res) {
                if (res['active'].__proto__ === ServiceWorker.prototype) {
                    _results["service_worker"] = value;
                }
            });
        }

        return 0x0;
    }

    function testHttpsSupport(manifest, name, value) {
        var returnValue = 0x0;

        if (!("start_url" in manifest)) {
            return returnValue;
        }

        var startUrlIsHttps = manifest['start_url'].match(/^https:/);
        var startUrlIsHttp = manifest['start_url'].match(/^http:/);
        var locationIsHttps = window.location.protocol === "https:";

        if (startUrlIsHttps || (!startUrlIsHttp && locationIsHttps)) {
            // if start_url is neither http or https we assume it is a relative url
            // and use the window location protocol
            returnValue = value;
        }

        return returnValue;
    }

    function iconDownloadComplete(response, value) {
        if (response.target.status == 200 && response.target.response) {
            _results["valid_icon"] = value;
        } else {
            _results["valid_icon"] = 0;
        }
    }

    function testValidIcon(manifest, name, value) {
        var req = new XMLHttpRequest();

        var hasIconsProperty = "icons" in manifest && manifest["icons"].length > 0;
        var hasValidSrc = "src" in manifest["icons"][0] && manifest["icons"][0]["src"].length > 0;

        if (hasIconsProperty && hasValidSrc) {
            req.addEventListener("load", function (response) { iconDownloadComplete(response, value); });
            req.addEventListener("error", function () { _results["valid_icon"] = 0; });
            req.addEventListener("abort", function () { _results["valid_icon"] = 0; });
            req.open("GET", manifest["icons"][0].src);
            req.send();
        } else {
            _results["valid_icon"] = 0;
        }

        return 0x0;
    }

    function startUrlDownloadComplete(response, value) {
        if (response.target.status == 200 && response.target.response) {
            _results["valid_start_url"] = value;
        } else {
            _results["valid_start_url"] = 0;
        }
    }

    function testStartUrl(manifest, name, value) {
        var req = new XMLHttpRequest();

        if ("start_url" in manifest && manifest["start_url"].length > 0) {
            req.addEventListener("load", function (response) { startUrlDownloadComplete(response, value); });
            req.addEventListener("error", function () { _results["valid_start_url"] = 0; });
            req.addEventListener("abort", function () { _results["valid_start_url"] = 0; });
            req.open("GET", manifest["start_url"]);
            req.send();
        } else {
            _results["valid_start_url"] = 0;
        }

        return 0x0;
    }

    function scoreManifest(manifest) {
        var score = 0x0000;

        var properties = [
            { name: "common_name",          value: 0x00001, test_fn: testCommonName },
            { name: "name",                 value: 0x00002, test_fn: testProperty },
            { name: "icons",                value: 0x00004, test_fn: testProperty },
            { name: "gcm_sender_id",        value: 0x00008, test_fn: testProperty },
            { name: "orientation",          value: 0x00010, test_fn: testProperty },
            { name: "display",              value: 0x00020, test_fn: testProperty },
            { name: "theme_color",          value: 0x00040, test_fn: testProperty },
            { name: "background_color",     value: 0x00080, test_fn: testProperty },
            { name: "related_applications", value: 0x00100, test_fn: testProperty },
            { name: "description",          value: 0x00200, test_fn: testProperty },
            { name: "short_name",           value: 0x00400, test_fn: testProperty },
            { name: "start_url",            value: 0x00800, test_fn: testProperty },
            { name: "scope",                value: 0x01000, test_fn: testProperty },
            { name: "service_worker",       value: 0x02000, test_fn: testServiceWorker },
            { name: "has_https",            value: 0x04000, test_fn: testHttpsSupport },
            { name: "valid_icon",           value: 0x08000, test_fn: testValidIcon },
            { name: "valid_start_url",      value: 0x10000, test_fn: testStartUrl }
        ];

        for (var i = 0; i < properties.length; i++) {
            score = score | properties[i].test_fn(manifest, properties[i].name, properties[i].value);
        }

        return score;
    }

    function downloadComplete(request)
    {
        try {
            var manifest = JSON.parse(this.responseText);
            var manifestScore = scoreManifest(manifest);
            _results["score"] = manifestScore;
            _results["error"] = 0;
        } catch (ex) {
            console.log(ex);
            _results["error"] = 1;
        }
    }

    // Do a very minimal validation on the href value to see if it's worth retrieving
    function validHrefValue(href) {
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

                if (validHrefValue(element.href)) {
                    var req = new XMLHttpRequest();
                    req.addEventListener("load", downloadComplete);
                    req.addEventListener("error", function () { _results["error"] = 1; });
                    req.addEventListener("abort", function () { _results["error"] = 1; });
                    req.open("GET", element.href);
                    req.send();
                }
            }
        }

        return results;
    }

    window.CSSUsage.StyleWalker.recipesToRun.push(appManifest);
}();