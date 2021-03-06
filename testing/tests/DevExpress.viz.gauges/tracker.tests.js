var $ = require("jquery"),
    noop = require("core/utils/common").noop,
    vizMocks = require("../../helpers/vizMocks.js"),
    Tracker = require("viz/gauges/tracker");

QUnit.module('Tracker', {
    beforeEach: function() {
        this.renderer = new vizMocks.Renderer();
        this.root = new vizMocks.Element();
        this.tracker = new Tracker({ renderer: this.renderer, container: this.root });
    },
    afterEach: function() {
        this.tracker.dispose();
    }
});

QUnit.test('Group is created on construction', function(assert) {
    assert.deepEqual(this.renderer.g.firstCall.returnValue.attr.lastCall.args, [{ "class": "dxg-tracker", fill: "#000000", opacity: 0.0001, stroke: "none", "stroke-width": 0 }], "root settings");
    assert.deepEqual(this.renderer.g.firstCall.returnValue.linkOn.lastCall.args, [this.root, { name: "tracker", after: "peripheral" }], "root is linked to container");
});

QUnit.test('Group is destroyed on dispose', function(assert) {
    this.tracker.dispose();
    this.tracker.dispose = noop;  // To prevent failure on `afterEach`
    assert.deepEqual(this.renderer.g.firstCall.returnValue.linkOff.lastCall.args, [], "root is unlinked");
});

QUnit.test('Group is appended to root on activation', function(assert) {
    this.tracker.activate();
    assert.deepEqual(this.renderer.g.firstCall.returnValue.linkAppend.lastCall.args, [], "root is appended");
});

QUnit.test('Group removed on deactivation', function(assert) {
    this.tracker.deactivate();
    assert.deepEqual(this.renderer.g.firstCall.returnValue.linkRemove.lastCall.args, [], "root is removed");
    assert.deepEqual(this.renderer.g.firstCall.returnValue.clear.lastCall.args, [], "root is cleared");
});

QUnit.test('Element is appended to group on attach', function(assert) {
    var element = this.renderer.path([], "area"),
        target = {},
        info = {};

    this.tracker.attach(element, target, info);

    assert.strictEqual(element.parent, this.tracker._element, 'element is appended');
    assert.deepEqual(element.data.lastCall.args, [{ 'gauge-data-target': target, 'gauge-data-info': info }]);
});

QUnit.test('Element is detached from group on detach', function(assert) {
    var element = this.renderer.path([], "area");

    this.tracker.attach(element, {}, {}).detach(element);

    assert.ok(!element.parent, 'element is detached');
});

var tooltipEnvironment = {
    beforeEach: function() {
        Tracker._DEBUG_reset();
        this.renderer = new vizMocks.Renderer();
        this.renderer.draw(document.createElement('div'));
        this.root = this.renderer.g().append(this.renderer.root);
        this.tracker = new Tracker({ renderer: this.renderer, container: this.root });
        var test = this;
        this.tracker.setTooltipState(true).setCallbacks({
            'tooltip-show': function() {
                return test.onTooltipShow ? test.onTooltipShow.apply(test, arguments) : true;
            },
            'tooltip-hide': function() {
                test.onTooltipHide && test.onTooltipHide.apply(test, arguments);
            }
        });
        this.trigger = function(name, element, x, y) {
            var event = $.Event(name);
            event.target = $(element.element).get(0);
            event.pageX = x;
            event.pageY = y;
            $(this.tracker._element.element).trigger(event);
        };

        this.clock = sinon.useFakeTimers();
    },
    afterEach: function() {
        this.clock.restore();
        this.tracker.dispose();
    }
};

QUnit.module('Tracker - tooltip events', tooltipEnvironment);

QUnit.test('"Show" is raised on mouseover after delay', function(assert) {
    var element = this.renderer.path([], "area"), target = {}, info = {};
    this.tracker.attach(element, target, info);
    element.element["gauge-data-target"] = target; // emulate data attachment
    element.element["gauge-data-info"] = info; // emulate data attachment
    this.onTooltipShow = sinon.spy(function() { return true; });

    this.trigger('mouseover', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);

    assert.strictEqual(this.onTooltipShow.callCount, 1);
    assert.strictEqual(this.onTooltipShow.firstCall.args[0], target, 'target');
    assert.strictEqual(this.onTooltipShow.firstCall.args[1], info, 'info');
    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 1, 'timeout is set 1 time');
});

QUnit.test('"Show" is not raised until mousemove occurs', function(assert) {
    var element = this.renderer.path([], "area"), target = {}, info = {};
    this.tracker.attach(element, target, info);
    element.element["gauge-data-target"] = target; // emulate data attachment
    element.element["gauge-data-info"] = info; // emulate data attachment
    this.onTooltipShow = sinon.spy(function() { return true; });
    this.trigger('mouseover', element, 5, 5);

    this.trigger('mousemove', element, 10, 5);
    this.trigger('mousemove', element, 10, 20);
    this.trigger('mousemove', element, 30, 10);
    this.trigger('mousemove', element, 40, 5);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);

    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 5, 'timeout is set 5 times');
    assert.strictEqual(this.onTooltipShow.callCount, 1);
});

QUnit.test('"Show" is raised when small mousemove occurs', function(assert) {
    var element = this.renderer.path([], "area"), target = {}, info = {};
    this.tracker.attach(element, target, info);
    element.element["gauge-data-target"] = target; // emulate data attachment
    element.element["gauge-data-info"] = info; // emulate data attachment
    this.onTooltipShow = sinon.spy(function() { return true; });
    this.trigger('mouseover', element, 5, 5);

    this.trigger('mousemove', element, 8, 5);
    this.trigger('mousemove', element, 8, 1);
    this.trigger('mousemove', element, 4, 3);
    this.trigger('mousemove', element, 7, 5);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);

    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 1, 'timeout is set 1 time');
    assert.strictEqual(this.onTooltipShow.callCount, 1);
});

QUnit.test('"Show" is not raised if mouseout occurs during delay', function(assert) {
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = sinon.spy(function() { return true; });
    this.trigger('mouseover', element);

    this.trigger('mouseout', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);

    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 1, 'timeout is set 1 time');
    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutCleared, 1, 'timeout is cleared');

    assert.strictEqual(this.onTooltipShow.callCount, 0);
});

QUnit.test('"Hide" is raised on mousewheel without delay', function(assert) {
    var that = this,
        element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipHide = sinon.spy(function() { return true; });
    this.trigger('mouseover', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);

    that.trigger('dxmousewheel', element);

    assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 0, 'timeout is not set');
    assert.strictEqual(this.onTooltipHide.callCount, 1);
});

QUnit.test('"Hide" is raised on mouseout after delay', function(assert) {
    var that = this,
        element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = sinon.spy(function() {
        that.trigger('mouseout', element);
        return true;
    });
    this.onTooltipHide = sinon.spy(function() { return true; });
    this.trigger('mouseover', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_HIDE_DELAY);

    assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    assert.strictEqual(this.onTooltipShow.callCount, 1);
    assert.strictEqual(this.onTooltipHide.callCount, 1);
});

QUnit.test('"Hide" is not raised if tooltip is not shown', function(assert) {
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipHide = sinon.spy(function() { return true; });

    this.trigger('mouseout', element);
    this.clock.tick(this.tracker.TOOLTIP_HIDE_DELAY);

    assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    assert.strictEqual(this.onTooltipHide.callCount, 0);
});

QUnit.test('"Hide" is not raised if mouseover occurs after mouseout', function(assert) {
    var that = this,
        element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = sinon.spy(function() {
        that.trigger('mouseout', element);
        that.trigger('mouseover', element);
        return true;
    });

    this.onTooltipHide = sinon.spy(function() { return true; });

    this.trigger('mouseover', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_HIDE_DELAY);

    assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutCleared, 1, 'timeout is cleared');

    assert.strictEqual(this.onTooltipHide.callCount, 0);
});

QUnit.test('"Show" is raised after delay on mouseover on other element if tooltip is shown', function(assert) {
    assert.expect(3);
    var element1 = this.renderer.path([], "area"), target1 = {},
        element2 = this.renderer.path([], "area"), target2 = {};
    this.tracker.attach(element1, target1).attach(element2, target2);
    element1.element["gauge-data-target"] = target1; // emulate data attachment
    element2.element["gauge-data-target"] = target2; // emulate data attachment
    this.onTooltipShow = function(tar) {
        assert.strictEqual(tar, target1, 'target 1');

        this.onTooltipShow = function(tar) {
            assert.strictEqual(tar, target2, 'target 2');
            assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 2, 'timeout is set 2 times');
            return true;
        };
        return true;
    };

    this.trigger('mouseover', element1);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
    this.trigger('mouseover', element2);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
});

QUnit.test('"Hide" is raised after delay on mouseover then mouseout on other element if tooltip is shown', function(assert) {
    assert.expect(1);
    var element1 = this.renderer.path([], "area"),
        element2 = this.renderer.path([], "area");
    this.tracker.attach(element1).attach(element2);
    this.onTooltipShow = function(tar) {
        this.trigger('mouseover', element2);
        this.trigger('mouseout', element2);
        return true;
    };
    this.onTooltipHide = function() {
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    };
    this.trigger('mouseover', element1);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_HIDE_DELAY);
});

QUnit.test('"Show" is not raised on mouseout then mouseover if tooltip is shown', function(assert) {
    assert.expect(4);
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = function() {
        this.trigger('mouseout', element);
        this.trigger('mouseover', element);
        this.onTooltipShow = function() {
            assert.ok(false, 'This is not expected to happen!');
            return true;
        };
        assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 2, 'show timeout is set 2 times');
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutCleared, 1, 'show timeout is cleared');
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'hide timeout is set');
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutCleared, 1, 'hide timeout is cleared');
        return true;
    };
    this.trigger('mouseover', element);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_SHOW_DELAY);
});

var tooltipTouchEnvironment = {
    beforeEach: function() {
        tooltipEnvironment.beforeEach.apply(this, arguments);
        this.triggerDocument = function(name, element) {
            var event = $.Event(name);
            event.target = element ? $(element.element).get(0) : null;
            event.changedTouches = [{}];    //  Because of ui.events.js
            event.touches = [];
            $(window.document).trigger(event);
        };
        var _trigger = this.trigger;
        this.trigger = function() {
            _trigger.apply(this, arguments);
            this.triggerDocument.apply(this, arguments);    //  Bubbling emulation
        };
    },
    afterEach: tooltipEnvironment.afterEach
};

QUnit.module('Tracker - tooltip touch events', tooltipTouchEnvironment);

QUnit.test('"Show" is raised on touchstart after delay', function(assert) {
    assert.expect(3);
    var element = this.renderer.path([], "area"), target = {}, info = {};
    this.tracker.attach(element, target, info);
    element.element["gauge-data-target"] = target; // emulate data attachment
    element.element["gauge-data-info"] = info; // emulate data attachment
    this.onTooltipShow = function(tar, inf) {
        assert.strictEqual(tar, target, 'target');
        assert.strictEqual(inf, info, 'info');
        assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 1, 'timeout is set 1 time');
        return true;
    };

    this.trigger('touchstart', element);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
});
QUnit.test('"Show" is not raised if touchend occurs during delay', function(assert) {
    assert.expect(2);
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = function() {
        assert.ok(false, 'This is not expected to happen!');
        return true;
    };
    this.trigger('touchstart', element);

    this.triggerDocument('touchend', element);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 1, 'timeout is set');
    assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutCleared, 1, 'timeout is cleared');
});

QUnit.test('"Hide" is raised on touchstart outside the element', function(assert) {
    assert.expect(1);
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = function() {
        this.triggerDocument('touchstart');
        return true;
    };
    this.onTooltipHide = function() {
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    };
    this.trigger('touchstart', element);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_HIDE_DELAY);
});

QUnit.test('"Hide" is not raised if touchend occurs when tooltip is shown', function(assert) {
    assert.expect(1);
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = function() {
        this.triggerDocument('touchend');
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 0, 'timeout is not set');
        return true;
    };
    this.onTooltipHide = function() {
        assert.ok(false, 'This is not expected to happen!');
    };
    this.trigger('touchstart', element);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_HIDE_DELAY);
});

QUnit.test('"Show" is raised after delay on touchstart on other element if tooltip is shown', function(assert) {
    assert.expect(3);
    var element1 = this.renderer.path([], "area"), target1 = {},
        element2 = this.renderer.path([], "area"), target2 = {};
    this.tracker.attach(element1, target1).attach(element2, target2);
    element1.element["gauge-data-target"] = target1; // emulate data attachment
    element2.element["gauge-data-target"] = target2; // emulate data attachment
    this.onTooltipShow = function(tar) {
        assert.strictEqual(tar, target1, 'target 1');
        this.onTooltipShow = function(tar) {
            assert.strictEqual(tar, target2, 'target 2');
            assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 2, 'timeout is set 2 times');
            return true;
        };
        return true;
    };
    this.trigger('touchstart', element1);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    this.trigger('touchstart', element2);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
});

QUnit.test('"Hide" is raised after delay on touchstart then touchend on other element if tooltip is shown', function(assert) {
    assert.expect(1);
    var element1 = this.renderer.path([], "area"),
        element2 = this.renderer.path([], "area");
    this.tracker.attach(element1, element2);
    element1.element["gauge-data-target"] = element2; // emulate data attachment
    this.onTooltipShow = function() {
        this.trigger('touchstart', element2);
        this.triggerDocument('touchend');
        return true;
    };
    this.onTooltipHide = function() {
        assert.strictEqual(this.tracker._DEBUG_hideTooltipTimeoutSet, 1, 'timeout is set');
    };
    this.trigger('touchstart', element1);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_HIDE_DELAY);
});

QUnit.test('"Show" is not raised on touchstart if tooltip is shown', function(assert) {
    assert.expect(1);
    var element = this.renderer.path([], "area");
    this.tracker.attach(element);
    this.onTooltipShow = function() {
        this.trigger('touchstart', element);
        this.onTooltipShow = function() {
            assert.ok(false, 'This is not expected to happen!');
            return true;
        };
        assert.strictEqual(this.tracker._DEBUG_showTooltipTimeoutSet, 2, 'timeout is set 2 times');
        return true;
    };
    this.trigger('touchstart', element);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
    this.clock.tick(this.tracker.TOOLTIP_TOUCH_SHOW_DELAY);
});
