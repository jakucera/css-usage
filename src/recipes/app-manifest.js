/* 
    RECIPE: APP MANIFEST
    -------------------------------------------------------------
    Author: Joel Kucera
    Description: This recipe looks for app manifest declarations.
        ex, <link rel='manifest' href='/manifest.json'>
        If found it will download the manifest and check for known properties.
*/

void function() {

    // Entry point
    function appManifest(element, results) {
        var analyzer = new AppManifestAnalyzer();

        if(element.nodeName.toLowerCase() === 'link'
           && element.rel !== undefined
           && element.rel.toLowerCase() === 'manifest') {
            analyzer.analyzeManifest(element.href, results);
        }

        return results;
    }

    window.CSSUsage.StyleWalker.recipesToRun.push(appManifest);

    // Analyzer class
    function AppManifestAnalyzer() {
        var _results = {};
        var _self = this;
        var _scoreResult = "score";
        var _errorResult = "error";

        var _manifestStrings = {
            name: "name",
            icons: "icons",
            gcm_sender_id: "gcm_sender_id",
            orientation: "orientation",
            display: "display",
            theme_color: "theme_color",
            background_color: "background_color",
            related_applications: "related_applications",
            description: "description",
            short_name: "short_name",
            start_url: "start_url",
            scope: "scope",
            dir: "dir", // not tested
            prefer_related_applications: "prefer_related_applications", // not tested
            lang: "lang" // not tested
        }

        // Analyze Manifest
        this.analyzeManifest = function (href, results) {
            if (_isValidHrefValue(href)) {
                results[href] = results[href] || { count: 0 };
                results[href].count++;

                _results = results[href];

                _xhrRequest(href, _manifestDownloadComplete, null, null);
            }
        }

        function _isValidHrefValue(href) {
            return href.match(/http[s]?:\/\/.+/gi);
        }

        function _xhrRequest(href, cb, name, value) {
            var req = new XMLHttpRequest();
            req.onreadystatechange = (evt) => { _handleXhrReadyStateChange(evt.target, cb, name, value); };
            req.addEventListener("error", (evt) => { cb(evt.target, name, 0x0); });
            req.addEventListener("abort", (evt) => { cb(evt.target, name, 0x0); });
            req.open("GET", href, false);
            req.send();
        }

        function _handleXhrReadyStateChange(xhr, cb, name, value) {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                cb(xhr, name, value);
            }
        }

        function _manifestDownloadComplete(xhr)
        {
            try {
                var manifest = JSON.parse(xhr.responseText);
                var manifestScore = _scoreManifest(manifest);
                _results[_scoreResult] = manifestScore;
                _results[_errorResult] = 0;
            } catch (ex) {
                console.log("Caught exception: " + ex);
                _results[_errorResult] = 1;
            }
        }

        function _scoreManifest(manifest) {
            var score = 0x0000;

            var properties = [
                { name: "common_name",                         value: 0x00001, test_fn: _testCommonName},
                { name: _manifestStrings.name,                 value: 0x00002, test_fn: _testProperty},
                { name: _manifestStrings.icons,                value: 0x00004, test_fn: _testProperty},
                { name: _manifestStrings.gcm_sender_id,        value: 0x00008, test_fn: _testProperty},
                { name: _manifestStrings.orientation,          value: 0x00010, test_fn: _testProperty},
                { name: _manifestStrings.display,              value: 0x00020, test_fn: _testProperty},
                { name: _manifestStrings.theme_color,          value: 0x00040, test_fn: _testProperty},
                { name: _manifestStrings.background_color,     value: 0x00080, test_fn: _testProperty},
                { name: _manifestStrings.related_applications, value: 0x00100, test_fn: _testProperty},
                { name: _manifestStrings.description,          value: 0x00200, test_fn: _testProperty},
                { name: _manifestStrings.short_name,           value: 0x00400, test_fn: _testProperty},
                { name: _manifestStrings.start_url,            value: 0x00800, test_fn: _testProperty},
                { name: _manifestStrings.scope,                value: 0x01000, test_fn: _testProperty},
                { name: "service_worker",                      value: 0x02000, test_fn: _testServiceWorker},
                { name: "has_https",                           value: 0x04000, test_fn: _testHttpsSupport},
                { name: "valid_icon",                          value: 0x08000, test_fn: _testValidIcon},
                { name: "valid_start_url",                     value: 0x10000, test_fn: _testStartUrl}
            ];

            for (var i = 0; i < properties.length; i++) {
                score = score | properties[i].test_fn(manifest, properties[i].name, properties[i].value);
            }

            return score;
        }

        function _testCommonName(manifest, propertyName, value) {
            var name = "";
            if (_manifestStrings.name in manifest) {
                name = manifest[_manifestStrings.name].toLowerCase();
            }

            var shortName = "";
            if (_manifestStrings.short_name in manifest) {
                shortName = manifest[_manifestStrings.short_name].toLowerCase();
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

        function _testProperty(manifest, name, value) {
            if (manifest.hasOwnProperty(name) && manifest[name].length > 0) {
                return value;
            }

            return 0x0;
        }

        function _testServiceWorker(manifest, name, value) {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready.then(function (res) {
                    if (res["active"].__proto__ === ServiceWorker.prototype) {
                        _results[name] = value;
                    }
                });
            }

            return 0x0;
        }

        function _testHttpsSupport(manifest, name, value) {
            var returnValue = 0x0;

            if (!(_manifestStrings.start_url in manifest)) {
                return returnValue;
            }

            var startUrl = manifest[_manifestStrings.start_url];
            var startUrlIsHttps = startUrl.match(/^https:/);
            var startUrlIsHttp = startUrl.match(/^http:/);
            var locationIsHttps = window.location.protocol === "https:";

            if (startUrlIsHttps || (!startUrlIsHttp && locationIsHttps)) {
                // if start_url is neither http or https we assume it is a relative url
                // and use the window location protocol
                returnValue = value;
            }

            return returnValue;
        }

        function _testValidIcon(manifest, name, value) {
            var req = new XMLHttpRequest();

            var hasIconsProperty = _manifestStrings.icons in manifest && manifest[_manifestStrings.icons].length > 0;
            var hasValidSrc = "src" in manifest[_manifestStrings.icons][0] && manifest[_manifestStrings.icons][0]["src"].length > 0;

            if (hasIconsProperty && hasValidSrc) {
                _xhrRequest(manifest[_manifestStrings.icons][0].src, _testDownloadComplete, name, value);
            } else {
                _results[name] = 0;
            }

            return _results[name];
        }

        function _testStartUrl(manifest, name, value) {
            var req = new XMLHttpRequest();

            if (_manifestStrings.start_url in manifest && manifest[_manifestStrings.start_url].length > 0) {
                _xhrRequest(manifest[_manifestStrings.start_url], _testDownloadComplete, name, value);
                // Save the value of the start url so we can crawl it directly later
                _results[manifest[_manifestStrings.start_url]] = 1;
            } else {
                _results[name] = 0;
            }

            return _results[name];
        }

        function _testDownloadComplete(xhr, name, value) {
            if (xhr.status === 200) {
                _results[name] = value;
            } else {
                _results[name] = 0;
            }
        }
    }
}();