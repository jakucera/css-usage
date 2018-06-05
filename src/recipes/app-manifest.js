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
        var _href = '';
        var _scoreResult = "score";
        var _errorResult = "error";
        var _manifestHashResult = "hash";
        var _version = 2;

        // Standard manifest properties
        var _manifestStrings = {
            dir: "dir", // not tested
            lang: "lang", // not tested
            name: "name",
            short_name: "short_name",
            description: "description",
            icons: "icons",
            screenshots: "screenshots", // not tested
            categories: "categories",
            iarc_rating_id: "iarc_rating_id", // not tested
            start_url: "start_url",
            display: "display",
            orientation: "orientation",
            theme_color: "theme_color",
            background_color: "background_color",
            scope: "scope",
            serviceworker: "serviceworker",
            related_applications: "related_applications",
            prefer_related_applications: "prefer_related_applications", // not tested
        }

        // Analyze manifest
        this.analyzeManifest = function (href, results) {
            if (_isValidHrefValue(href)) {
                results[href] = results[href] || { count: 0 };
                results[href].count++;
                _href = href;

                _results = results[href];
                _results["version"] = _version;

                // fire right away to get some results in case the manifest xhr times out
                var event = new CustomEvent('update_results', {detail: {results: _results}});

                // need to use origin of the manifest href, not the window location
                var hostRegex = /(http[s]?:\/\/.*?)\//;
                var hostMatch = hostRegex.exec(href);
                var robotsTxt = hostMatch[1] + '/robots.txt';
                _xhrRequest(robotsTxt, (xhr) => {
                    var allowed = xhr === null || _analyzeRobotsTxt(xhr, href);

                    if(allowed === true) {
                        _xhrRequest(href, _manifestDownloadComplete, null, null);
                    } else {
                        _results["disallowed"] = 1;
                    }
                }, null, null)
            }
        }

        function _isValidHrefValue(href) {
            var regex = RegExp(/http[s]?:\/\/.+/gi);
            return regex.test(href);
        }

        function _xhrRequest(href, cb, name, value) {
            try {
                var req = new XMLHttpRequest();
                req.onreadystatechange = (evt) => { _handleXhrReadyStateChange(evt.target, cb, name, value); };
                req.addEventListener("error", (evt) => { cb(evt.target, name, 0x0); });
                req.addEventListener("abort", (evt) => { cb(evt.target, name, 0x0); });
                req.open("GET", href, false);
                req.send();
            } catch (e) {
                _results["xhrexception"] = 1;
                cb(null, name, value);
            }
        }

        function _handleXhrReadyStateChange(xhr, cb, name, value) {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                cb(xhr, name, value);
            }
        }

        var RobotData = function (text) {
            this.rules = {};
            var _self = this;

            parseText(text);

            function parseText(text) {
                var lines = text.split('\n');

                var agents = [];
                var inGroupSection = false;

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();

                    // trim comments
                    line = line.replace(/#.*/, '');

                    var kv = line.split(':');
                    if (kv.length != 2) {
                        continue;
                    }

                    var key = kv[0].trim();
                    var value = kv[1].trim();

                    if (key.length === 0) {
                        continue;
                    }

                    if (key.toLowerCase() === 'user-agent') {
                        // first agent of the first or new group, reset the agents array
                        if (inGroupSection === true) {
                            inGroupSection = false;
                            agents = [];
                        }
                        // keep adding agents until we see the first rule for the group
                        if (value.length > 0) {
                            agents.push(value.toLowerCase());
                        }
                    } else {
                        inGroupSection = true;

                        if (value.length > 0) {
                            // trailing wildcards (*) are redundant, so remove them
                            value = value.replace(/\*$/, '');

                            // apply this rule to all the agents we found
                            for (var j = 0; j < agents.length; j++) {
                                addRule(agents[j], key.toLowerCase(), value);
                            }
                        }
                    }
                }
            }

            function addRule(agent, ruleType, ruleValue) {
                var agentRules = _self.rules[agent] || [];
                agentRules.push({
                    type: ruleType,
                    value: ruleValue.replace(/\*/, '.*').replace(/\?/, '\\?')
                });

                _self.rules[agent] = agentRules;
            }

            function applyRules(rules, path, type, value, length) {
                var matchFound = false;
                var matchRuleLength = -1;

                for (var i in rules) {
                    var rule = rules[i];
                    if (rule.type === type) {
                        var match = path.match(rule.value)
                        if (match !== null && match.index === 0 && rule.value.length > length) {
                            matchFound = true;
                            matchRuleLength = rule.value.length;
                        }
                    }
                }

                return {
                    match: matchFound,
                    length: matchRuleLength,
                    allowed: value
                };
            }

            this.checkPath = function (path) {
                // default to allow
                var allowed = true;
                // agents in order of precedence
                var agents = ['bingbot', 'msnbot', '*'];
                // rules in order of precedence
                var ruleTypes = [
                    { type: 'disallow', value: false },
                    { type: 'allow', value: true }
                ];
                var appliedRules = null;
                var matchingRuleLength = -1;

                // build the url to the manifest
                var a = document.createElement('a');
                a.href = path;

                // todo, verify that the manifest is on the same host?

                // find a matching group for our bot (bing)
                for (var i = 0; i < agents.length; i++) {
                    var agent = agents[i];
                    if (_self.rules[agent] !== undefined) {
                        appliedRules = _self.rules[agent];
                        break;
                    }
                }

                // if no group applies, return the default allow value
                if (appliedRules === null) {
                    return allowed;
                }

                for (var i = 0; i < ruleTypes.length; i++) {
                    var ruleType = ruleTypes[i];
                    var result = applyRules(appliedRules, a.pathname, ruleType.type, ruleType.value, matchingRuleLength);

                    if (result.match === true) {
                        allowed = result.allowed;
                        matchingRuleLength = result.length;
                    }
                }

                return allowed;
            }
        };

        function _analyzeRobotsTxt(xhr, href) {
            var allowed = true;
            if (xhr.status == 200) {
                var robotData = new RobotData(xhr.responseText);
                allowed = robotData.checkPath(href);
            }

            return allowed;
        }

        function _manifestDownloadComplete(xhr)
        {
            try {
                var manifest = JSON.parse(xhr.responseText);
                var manifestScore = _scoreManifest(manifest);
                _results[_scoreResult] = manifestScore;
                _results[_manifestHashResult] = _getHashOfManifest(xhr.responseText);;
                _results[_errorResult] = 0;
            } catch (ex) {
                console.log("Caught exception: " + ex);
                _results[_errorResult] = 1;
            }

            var event = new CustomEvent('update_results', {detail: {results: _results}});
            window.dispatchEvent(event);
        }

        function _scoreManifest(manifest) {
            var score = 0x0000;

            var properties = [
                { name: "common_name",                         value: 0x00001, test_fn: _testCommonName },
                { name: _manifestStrings.name,                 value: 0x00002, test_fn: _testProperty },
                { name: _manifestStrings.icons,                value: 0x00004, test_fn: _testProperty },
                { name: _manifestStrings.categories,           value: 0x00008, test_fn: _testProperty },
                { name: _manifestStrings.orientation,          value: 0x00010, test_fn: _testProperty },
                { name: _manifestStrings.display,              value: 0x00020, test_fn: _testProperty },
                { name: _manifestStrings.theme_color,          value: 0x00040, test_fn: _testProperty },
                { name: _manifestStrings.background_color,     value: 0x00080, test_fn: _testProperty },
                { name: _manifestStrings.related_applications, value: 0x00100, test_fn: _testProperty },
                { name: _manifestStrings.description,          value: 0x00200, test_fn: _testProperty },
                { name: _manifestStrings.short_name,           value: 0x00400, test_fn: _testProperty },
                { name: _manifestStrings.start_url,            value: 0x00800, test_fn: _testProperty },
                { name: _manifestStrings.scope,                value: 0x01000, test_fn: _testProperty },
                { name: _manifestStrings.serviceworker,        value: 0x02000, test_fn: _testServiceWorker },
                { name: "has_https",                           value: 0x04000, test_fn: _testHttpsSupport },
                { name: "valid_icon",                          value: 0x08000, test_fn: _testValidIcon },
                { name: "valid_start_url",                     value: 0x10000, test_fn: _testStartUrl },
                { name: "has_manifest_extension",              value: 0x20000, test_fn: _testManifestExtensions }
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
                'new project',
                'React PWA'
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
                    var event = new CustomEvent('update_results', {detail: {results: _results}});
                    window.dispatchEvent(event);
                });

                navigator.serviceWorker.addEventListener('controllerchange', (evt) => {
                    var sw = navigator.serviceWorker.controller;
                });

            } else if (_testProperty(manifest, name, value) == value) {
                _results[name] = value;
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
            var hasIconsProperty = _manifestStrings.icons in manifest && manifest[_manifestStrings.icons].length > 0;

            if (hasIconsProperty) {
                var hasValidSrc = "src" in manifest[_manifestStrings.icons][0] && manifest[_manifestStrings.icons][0]["src"].length > 0;

                try {
                    if (hasValidSrc) {
                        var img = document.createElement('img');
                        img.onload = (evt) => {_results[name] = value; };
                        img.onerror = (evt) => { _results[name] = 0; };

                        // todo: the source should be relative to the manifest url
                        img.src = manifest[_manifestStrings.icons][0].src;
                    } else {
                        _results[name] = 0;
                    }
                } catch (ex) {
                    _results[name] = 0;
                }
            }

            return _results[name];
        }

        function _testStartUrl(manifest, name, value) {
            try {
                if (_manifestStrings.start_url in manifest && manifest[_manifestStrings.start_url].length > 0) {
                    // Save the value of the start url so we can crawl it directly later
                    // Use a unique value so we can find it in the scope script
                    _results[manifest[_manifestStrings.start_url]] = 12345678;
                    _xhrRequest(manifest[_manifestStrings.start_url], _testDownloadComplete, name, value);

                    // todo: consider saving a computed start_url based on the rules on w3c
                } else {
                    _results[name] = 0;
                }
            } catch (ex) {
                _results[name] = 0;
            }

            var event = new CustomEvent('update_results', {detail: {results: _results}});
            window.dispatchEvent(event);

            return _results[name];
        }

        function _testDownloadComplete(xhr, name, value) {
            if (xhr.status === 200) {
                _results[name] = value;
            } else {
                _results[name] = 0;
            }
        }

        function _getHashOfManifest(manifest) {
            var hash = 0;
            for (var i = 0; i < manifest.length; i++) {
                var char = manifest.charCodeAt(i);
                hash = ((hash<<5) - hash) + char;
                hash = hash & hash;
            }
            return hash;
        }

        function _testManifestExtensions(manifest, name, value) {
            for (var prop in manifest) {
                if (prop.startsWith('mjs_') || prop.startsWith('gcm_')) {
                    console.log(name + ' ' + value);
                    _results[name] = value;
                    _results[prop] = 1;
                }
            }

            return _results[name];
        }
    }
}();