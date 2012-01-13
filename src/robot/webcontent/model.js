window.model = (function () {

    function Suite(data) {
        var suite = createModelObject(data, "s");
        suite.source = data.source;
        suite.relativeSource = data.relativeSource;
        suite.fullName = data.parent ? data.parent.fullName + "." + data.name : data.name;
        setStats(suite, data.statistics);
        suite.metadata = data.metadata;
        suite.populateKeywords = createIterablePopulator("Keyword");
        suite.populateTests = createIterablePopulator("Test");
        suite.populateSuites = createIterablePopulator("Suite");
        suite.message = data.message;
        suite.children = function () {
            return suite.keywords().concat(suite.tests()).concat(suite.suites());
        };
        suite.searchTests = function (predicate) {
            var tests = [];
            var subSuites = this.suites();
            for (var i in subSuites)
                tests = tests.concat(subSuites[i].searchTests(predicate));
            return tests.concat(util.filter(this.tests(), predicate));
        };
        suite.searchTestsByTag = function (tag) {
            return suite.searchTests(function (test) {
                if (tag.combined)
                    return containsTagPattern(test.tags, tag.combined);
                return containsTag(test.tags, tag.label);
            });
        };
        suite.findSuiteByName = function (name) {
            return findSuiteByName(suite, name);
        };
        suite.allTests = function () {
            return suite.searchTests(function (test) {
                return true;
            });
        };
        suite.criticalTests = function () {
            return suite.searchTests(function (test) {
                return test.isCritical;
            });
        };
        return suite;
    }

    function containsTag(testTags, tagname) {
        testTags = util.map(testTags, util.normalize);
        return util.contains(testTags, util.normalize(tagname));
    }

    function containsTagPattern(testTags, pattern) {
        testTags = util.map(testTags, util.normalize);
        if (pattern.indexOf('&') != -1) {
            var tagnames = pattern.split('&');
            return util.all(util.map(tagnames, function (name) {
                return containsTagPattern(testTags, name);
            }));
        }
        if (pattern.indexOf('NOT') != -1) {
            var tagnames = pattern.split('NOT');
            var required = tagnames[0];
            var notAllowed = tagnames.slice(1);
            return containsTagPattern(testTags, required) &&
                    util.all(util.map(notAllowed, function (name) {
                        return !containsTagPattern(testTags, name);
                    }));
        }
        var matcher = util.Matcher(pattern);
        return util.any(util.map(testTags, matcher.matches));
    }

    function findSuiteByName(suite, name) {
        if (suite.fullName == name)
            return suite;
        var subSuites = suite.suites();
        for (var i in subSuites) {
            var match = findSuiteByName(subSuites[i], name);
            if (match)
                return match;
        }
        return null;
    }

    function setStats(suite, stats) {
        for (var name in stats) {
            suite[name] = stats[name];
        }
    }

    function createModelObject(data, symbol) {
        return {
            name: data.name,
            doc: data.doc,
            status: data.status,
            times: data.times,
            id: data.parent ? data.parent.id + "-" + symbol + (data.index + 1) : symbol + "1",
            callWhenChildrenReady: function (callable) { callable(); }
        };
    }

    function Test(data) {
        var test = createModelObject(data, "t");
        test.fullName = data.parent.fullName + "." + test.name;
        test.formatParentName = function () { return util.formatParentName(test); };
        test.timeout = data.timeout;
        test.populateKeywords = createIterablePopulator("Keyword");
        test.isChildrenLoaded = data.isChildrenLoaded;
        test.callWhenChildrenReady = window.fileLoading.getCallbackHandlerForKeywords(test);
        test.children = function () {
            if (test.isChildrenLoaded)
                return test.keywords();
        };
        test.isCritical = data.isCritical;
        test.tags = data.tags;
        test.message = data.message;
        return test;
    }

    function Keyword(data) {
        var kw = createModelObject(data, "k");
        kw.type = data.type;
        var parent = data.parent;
        var parentPath = (parent.path === undefined) ? parent.fullName : parent.path;
        kw.path = parentPath + "." + data.index;
        kw.arguments = data.args;
        kw.timeout = data.timeout;
        kw.populateMessages = createIterablePopulator("Message");
        kw.populateKeywords = createIterablePopulator("Keyword");
        kw.isChildrenLoaded = data.isChildrenLoaded;
        kw.callWhenChildrenReady = window.fileLoading.getCallbackHandlerForKeywords(kw);
        kw.children = function () {
            if (kw.isChildrenLoaded)
                return kw.keywords();
        };
        return kw;
    }

    function Message(level, date, text, link) {
        return {
            level: level,
            time: util.timeFromDate(date),
            date: util.dateFromDate(date),
            text: text,
            link: link
        };
    }

    function Times(timedata) {
        var start = timedata[0];
        var end = timedata[1];
        var elapsed = timedata[2];
        return {
            elapsedMillis: elapsed,
            elapsedTime: util.formatElapsed(elapsed),
            startTime: util.dateTimeFromDate(start),
            endTime:  util.dateTimeFromDate(end)
        };
    }

    function createIterablePopulator(name) {
        return function (populator) {
            populateIterable(this, name, populator);
        };
    }

    function populateIterable(obj, name, populator) {
        var nameInLowerCase = name.toLowerCase();
        obj[nameInLowerCase + "s"] = createGetAllFunction(populator.numberOfItems, populator.creator);
    }

    function createGetAllFunction(numberOfElements, creator) {
        var cached = undefined;
        return function () {
            if (cached === undefined) {
                cached = [];
                for (var i = 0; i < numberOfElements(); i++) {
                    cached.push(creator(i));
                }
            }
            return cached;
        };
    }

    return {
        Suite: Suite,
        Test: Test,
        Keyword: Keyword,
        Message: Message,
        Times: Times,
        containsTag: containsTag,  // Exposed for tests
        containsTagPattern: containsTagPattern,  // Exposed for tests
    };
}());

window.stats = (function () {

    function Statistics(totalElems, tagElems, suiteElems) {
        return {total: util.map(totalElems, totalStatElem),
                tag:   util.map(tagElems, tagStatElem),
                suite: util.map(suiteElems, suiteStatElem)};
    }

    function statElem(stat) {
        stat.total = stat.pass + stat.fail;
        var percents = calculatePercents(stat.total, stat.pass, stat.fail);
        stat.passPercent = percents[0];
        stat.failPercent = percents[1];
        var widths = calculateWidths(stat.passPercent, stat.failPercent);
        stat.passWidth = widths[0];
        stat.failWidth = widths[1];
        return stat;
    }

    function totalStatElem(data) {
        var stat = statElem(data);
        stat.type = stat.label == 'Critical Tests' ? 'critical' : 'all';
        return stat;
    }

    function tagStatElem(data) {
        var stat = statElem(data);
        stat.links = parseLinks(stat.links);
        return stat;
    }

    function suiteStatElem(data) {
        var stat = statElem(data);
        stat.fullName = stat.label;
        stat.formatParentName = function () { return util.formatParentName(stat); };
        // compatibility with RF 2.5 outputs
        if (!stat.name)
            stat.name = stat.label.split('.').pop();
        return stat;
    }

    function parseLinks(linksData) {
        if (!linksData)
            return [];
        return util.map(linksData.split(':::'), function (link) {
                var index = link.indexOf(':');
                return {title: link.slice(0, index), url: link.slice(index+1)};
            });
    }

    function calculatePercents(total, passed, failed) {
        if (total == 0)
            return [0.0, 0.0];
        pass = 100.0 * passed / total;
        fail = 100.0 * failed / total;
        if (pass > 0 && pass < 0.1)
            return [0.1, 99.9];
        if (fail > 0 && fail < 0.1)
            return [99.9, 0.1];
        return [Math.round(pass*10)/10, Math.round(fail*10)/10];
    }

    function calculateWidths(num1, num2) {
        if (num1 + num2 == 0)
            return [0.0, 0.0];
        // Make small percentages better visible
        if (num1 > 0 && num1 < 1)
            return [1.0, 99.0];
        if (num2 > 0 && num2 < 1)
            return [99.0, 1.0];
        // Handle situation where both are rounded up
        while (num1 + num2 > 100) {
            if (num1 > num2)
                num1 -= 0.1;
            if (num2 > num1)
                num2 -= 0.1;
        }
        return [num1, num2];
    }

    return {
        Statistics: Statistics
    };

}());
