/*
 * A complete host bridge for this page.
 *
 * The editor takes everything host-specific through one object, so a page that
 * defines `window.PerformanceBandHost` before mounting gets full integration
 * without writing any module code. This file is both the demo's plumbing and a
 * worked example of what a real host supplies.
 */
(function () {
    var ICONS = {
        'fa-plus':
            '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7 1h2v6h6v2H9v6H7V9H1V7h6z"/></svg>',
        'fa-trash':
            '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 1h4l1 1h3v2H2V2h3zM3 5h10l-1 10H4z"/></svg>'
    };

    /*
     * Parses each icon once into a real element and hands back that node. The
     * editor clones it per use, so caching here is safe — and because it is a
     * Node rather than a string, nothing is ever HTML-parsed at render time.
     */
    var iconCache = {};

    function iconNode(name) {
        if (!ICONS[name]) {
            return '';
        }

        if (!iconCache[name]) {
            var wrapper = document.createElement('span');
            wrapper.innerHTML = ICONS[name];
            iconCache[name] = wrapper.firstChild;
        }

        return iconCache[name];
    }

    window.PerformanceBandHost = {
        icon: function (style, icon) {
            return iconNode(icon);
        },

        // The editor already sets `title` on its controls, and this page is
        // happy with the browser's native tooltip — so there is nothing to add.
        // A host with a tooltip library would return whatever attributes that
        // library looks for.
        tooltipAttributes: function () {
            return {};
        },

        // Called after the editor inserts nodes, which is where a host wires up
        // whatever its markup hooks imply. Nothing to do here.
        activate: function () {},

        hideTooltips: function () {}
    };
})();
